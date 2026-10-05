import json
import os
import uuid
from dataclasses import dataclass, field
from datetime import datetime, time
from typing import List, Optional

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session, selectinload
from sqlalchemy.sql import func

import models
import schemas
from core.config import settings
from core.dependencies import get_current_user, get_workspace_member, require_roles, MANAGE_ROLES
from core.timeutil import get_zone, to_db
from database import get_db

router = APIRouter(prefix="/api/workspaces/{workspace_id}/imports", tags=["imports"])

ALLOWED_EXTENSIONS = (".csv", ".xlsx")
PREVIEW_ROWS = 5


@dataclass
class AnalyzedRow:
    index: int
    raw: dict
    errors: List[str] = field(default_factory=list)
    product: Optional[models.Product] = None
    timestamp: Optional[datetime] = None
    quantity: int = 0
    price: float = 0.0


def _read_file(path: str, filename: str, nrows: int | None = None) -> pd.DataFrame:
    # Everything is read as text so SKUs like "00123" keep their leading zeros
    # and numeric parsing errors can be reported per row.
    if filename.lower().endswith(".csv"):
        return pd.read_csv(path, dtype=str, keep_default_na=False, nrows=nrows)
    return pd.read_excel(path, dtype=str, keep_default_na=False, nrows=nrows)


def _parse_number(value: str) -> float:
    text = str(value).strip().replace(" ", "")
    if text.lower().startswith("rp"):
        text = text[2:]
    if not text:
        raise ValueError("empty")
    return float(text)


def _get_job(db: Session, workspace_id: int, job_id: int) -> models.ImportJob:
    job = db.query(models.ImportJob).filter(
        models.ImportJob.id == job_id,
        models.ImportJob.workspace_id == workspace_id,
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job import tidak ditemukan")
    return job


def _load_job_file(job: models.ImportJob) -> pd.DataFrame:
    if not job.temp_file_path or not os.path.exists(job.temp_file_path):
        raise HTTPException(status_code=400, detail="File import sudah tidak tersedia. Silakan unggah ulang.")
    try:
        return _read_file(job.temp_file_path, job.filename)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Gagal membaca file: {e}")


def _analyze(df: pd.DataFrame, mapping: schemas.ColumnMapping, products: dict, zone) -> List[AnalyzedRow]:
    missing = [col for col in (mapping.date_col, mapping.sku_col, mapping.quantity_col, mapping.price_col) if col not in df.columns]
    if missing:
        raise HTTPException(status_code=400, detail=f"Kolom tidak ditemukan di file: {', '.join(missing)}")

    # Track stock as rows are consumed so a file cannot oversell a product.
    remaining_stock = {sku: p.current_stock for sku, p in products.items()}
    rows: List[AnalyzedRow] = []

    for index, record in df.iterrows():
        row = AnalyzedRow(index=int(index), raw={str(k): str(v) for k, v in record.items()})

        sku = str(record[mapping.sku_col]).strip()
        if not sku:
            row.errors.append("SKU kosong")
        elif sku not in products:
            row.errors.append(f"SKU tidak dikenal: {sku}")
        else:
            row.product = products[sku]

        try:
            parsed = pd.to_datetime(str(record[mapping.date_col]).strip())
            if pd.isna(parsed):
                raise ValueError
            # Dates without a time are recorded at midday local time.
            moment = parsed.to_pydatetime()
            if moment.tzinfo is None:
                if moment.time() == time.min:
                    moment = moment.replace(hour=12)
                moment = moment.replace(tzinfo=zone)
            row.timestamp = moment
        except (ValueError, TypeError, OverflowError):
            row.errors.append("Format tanggal tidak valid")

        try:
            qty = _parse_number(record[mapping.quantity_col])
            if qty <= 0:
                row.errors.append("Jumlah harus lebih dari 0")
            elif not float(qty).is_integer():
                row.errors.append("Jumlah harus bilangan bulat")
            else:
                row.quantity = int(qty)
        except ValueError:
            row.errors.append("Format jumlah tidak valid")

        try:
            price = _parse_number(record[mapping.price_col])
            if price < 0:
                row.errors.append("Harga tidak boleh negatif")
            else:
                row.price = price
        except ValueError:
            row.errors.append("Format harga tidak valid")

        if not row.errors and row.product is not None:
            if remaining_stock[sku] < row.quantity:
                row.errors.append(f"Stok {row.product.name} tidak mencukupi (tersisa {remaining_stock[sku]})")
            else:
                remaining_stock[sku] -= row.quantity

        rows.append(row)
    return rows


def _workspace_products(db: Session, workspace_id: int, lock: bool = False) -> dict:
    query = db.query(models.Product).filter(
        models.Product.workspace_id == workspace_id,
        models.Product.is_active.is_(True),
    )
    if lock:
        query = query.with_for_update()
    return {p.sku: p for p in query.all()}


@router.post("/upload", response_model=schemas.UploadPreviewResponse)
async def upload_file(
    workspace_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    member: models.WorkspaceMember = Depends(require_roles(*MANAGE_ROLES)),
):
    filename = os.path.basename(file.filename or "")
    extension = os.path.splitext(filename)[1].lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Hanya file CSV dan XLSX yang didukung")

    content = await file.read()
    if len(content) > settings.MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"Ukuran file maksimal {settings.MAX_UPLOAD_MB} MB")
    if not content:
        raise HTTPException(status_code=400, detail="File kosong")

    # Never trust the client filename for the storage path.
    os.makedirs(settings.TEMP_IMPORT_DIR, exist_ok=True)
    temp_path = os.path.join(settings.TEMP_IMPORT_DIR, f"{workspace_id}_{uuid.uuid4().hex}{extension}")
    with open(temp_path, "wb") as buffer:
        buffer.write(content)

    try:
        df = _read_file(temp_path, filename, nrows=PREVIEW_ROWS)
    except Exception as e:
        os.remove(temp_path)
        raise HTTPException(status_code=400, detail=f"Gagal membaca file: {e}")

    job = models.ImportJob(
        workspace_id=workspace_id,
        user_id=current_user.id,
        filename=filename,
        temp_file_path=temp_path,
        status=models.ImportJobStatus.PENDING
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    return schemas.UploadPreviewResponse(
        job_id=job.id,
        filename=filename,
        columns=[str(c) for c in df.columns],
        preview_data=df.to_dict(orient="records"),
    )


@router.post("/{job_id}/validate", response_model=schemas.ImportJobResponse)
def validate_mapping(
    workspace_id: int,
    job_id: int,
    mapping: schemas.ColumnMapping,
    db: Session = Depends(get_db),
    member: models.WorkspaceMember = Depends(require_roles(*MANAGE_ROLES)),
):
    job = _get_job(db, workspace_id, job_id)
    if job.status in (models.ImportJobStatus.COMPLETED, models.ImportJobStatus.PROCESSING):
        raise HTTPException(status_code=400, detail="Job import ini sudah diproses")

    df = _load_job_file(job)
    rows = _analyze(df, mapping, _workspace_products(db, workspace_id), get_zone(member.workspace.timezone))

    # Clear previous errors if re-validating
    db.query(models.ImportErrorRow).filter(models.ImportErrorRow.job_id == job.id).delete()
    error_count = 0
    for row in rows:
        if row.errors:
            error_count += 1
            db.add(models.ImportErrorRow(
                job_id=job.id,
                row_number=row.index + 2, # +1 for header, +1 for 0-index
                raw_data=json.dumps(row.raw, ensure_ascii=False),
                error_message=", ".join(row.errors),
            ))

    job.total_rows = len(rows)
    job.error_rows = error_count
    valid_rows = len(rows) - error_count
    job.status = models.ImportJobStatus.CONFIRMED if valid_rows > 0 else models.ImportJobStatus.FAILED
    db.commit()
    db.refresh(job)
    return job


@router.post("/{job_id}/confirm")
def confirm_import(
    workspace_id: int,
    job_id: int,
    mapping: schemas.ColumnMapping,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    member: models.WorkspaceMember = Depends(require_roles(*MANAGE_ROLES)),
):
    job = _get_job(db, workspace_id, job_id)
    if job.status != models.ImportJobStatus.CONFIRMED:
        raise HTTPException(status_code=400, detail="Job belum siap dikonfirmasi. Lakukan validasi terlebih dahulu.")

    df = _load_job_file(job)
    # Re-run the analysis against locked, current stock so the import is consistent
    # even if sales happened between validation and confirmation.
    rows = _analyze(df, mapping, _workspace_products(db, workspace_id, lock=True), get_zone(member.workspace.timezone))

    imported = 0
    for row in rows:
        if row.errors or row.product is None:
            continue
        product = row.product
        timestamp = to_db(row.timestamp)

        trx = models.Transaction(
            workspace_id=workspace_id,
            user_id=current_user.id,
            payment_method="IMPORT",
            total_amount=row.quantity * row.price,
            timestamp=timestamp,
        )
        db.add(trx)
        db.flush() # Get trx ID

        db.add(models.TransactionItem(
            transaction_id=trx.id,
            product_id=product.id,
            quantity=row.quantity,
            selling_price=row.price,
            hpp=product.current_hpp
        ))

        prev_stock = product.current_stock
        product.current_stock -= row.quantity

        db.add(models.InventoryMovement(
            workspace_id=workspace_id,
            product_id=product.id,
            type=models.MovementTypeEnum.SALE,
            quantity=-row.quantity,
            previous_stock=prev_stock,
            new_stock=product.current_stock,
            reference_id=f"IMPORT-{job_id}",
            user_id=current_user.id,
            timestamp=timestamp,
        ))
        imported += 1

    job.total_rows = len(rows)
    job.error_rows = len(rows) - imported
    job.imported_rows = imported
    job.status = models.ImportJobStatus.COMPLETED
    job.completed_at = func.now()
    temp_path = job.temp_file_path
    job.temp_file_path = None
    db.commit()

    try:
        os.remove(temp_path)
    except OSError:
        pass

    return {"message": "Import berhasil", "imported_rows": imported, "skipped_rows": len(rows) - imported}


@router.get("", response_model=List[schemas.ImportJobResponse])
def get_imports(workspace_id: int, db: Session = Depends(get_db), member: models.WorkspaceMember = Depends(get_workspace_member)):
    return db.query(models.ImportJob).options(selectinload(models.ImportJob.errors)).filter(
        models.ImportJob.workspace_id == workspace_id
    ).order_by(models.ImportJob.created_at.desc(), models.ImportJob.id.desc()).all()


@router.get("/{job_id}", response_model=schemas.ImportJobResponse)
def get_import(workspace_id: int, job_id: int, db: Session = Depends(get_db), member: models.WorkspaceMember = Depends(get_workspace_member)):
    return _get_job(db, workspace_id, job_id)
