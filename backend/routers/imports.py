import os
import shutil
import pandas as pd
import json
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List

import models
import schemas
from database import get_db
from core.dependencies import get_current_user

router = APIRouter(prefix="/api/workspaces/{workspace_id}/imports", tags=["imports"])

TEMP_DIR = "temp_imports"
os.makedirs(TEMP_DIR, exist_ok=True)

@router.post("/upload", response_model=schemas.UploadPreviewResponse)
async def upload_file(workspace_id: int, file: UploadFile = File(...), db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Verify workspace membership
    member = db.query(models.WorkspaceMember).filter(
        models.WorkspaceMember.workspace_id == workspace_id,
        models.WorkspaceMember.user_id == current_user.id
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this workspace")

    # Validate extension
    if not file.filename.endswith(('.csv', '.xlsx')):
        raise HTTPException(status_code=400, detail="Only CSV and XLSX files are supported")

    # Save temp file
    temp_path = os.path.join(TEMP_DIR, f"{workspace_id}_{current_user.id}_{file.filename}")
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Read preview with Pandas
    try:
        if file.filename.endswith('.csv'):
            df = pd.read_csv(temp_path, nrows=5)
        else:
            df = pd.read_excel(temp_path, nrows=5)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {str(e)}")

    columns = df.columns.tolist()
    # Replace NaN with None for JSON serialization
    preview_data = df.fillna("").to_dict(orient="records")

    # Create Job
    job = models.ImportJob(
        workspace_id=workspace_id,
        user_id=current_user.id,
        filename=file.filename,
        temp_file_path=temp_path,
        status=models.ImportJobStatus.PENDING
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    return schemas.UploadPreviewResponse(
        job_id=job.id,
        filename=file.filename,
        columns=columns,
        preview_data=preview_data
    )

@router.post("/{job_id}/validate", response_model=schemas.ImportJobResponse)
def validate_mapping(workspace_id: int, job_id: int, mapping: schemas.ColumnMapping, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    job = db.query(models.ImportJob).filter(models.ImportJob.id == job_id, models.ImportJob.workspace_id == workspace_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    job.status = models.ImportJobStatus.VALIDATING
    db.commit()

    # Clear previous errors if re-validating
    db.query(models.ImportErrorRow).filter(models.ImportErrorRow.job_id == job.id).delete()

    try:
        if job.filename.endswith('.csv'):
            df = pd.read_csv(job.temp_file_path)
        else:
            df = pd.read_excel(job.temp_file_path)
    except Exception as e:
        job.status = models.ImportJobStatus.FAILED
        db.commit()
        raise HTTPException(status_code=400, detail=f"Failed to read file: {str(e)}")

    total_rows = len(df)
    error_count = 0

    # Fetch valid SKUs for this workspace
    valid_skus = {p.sku: p.id for p in db.query(models.Product).filter(models.Product.workspace_id == workspace_id).all()}

    # Prepare standard dataframe
    try:
        mapped_df = df[[mapping.date_col, mapping.sku_col, mapping.quantity_col, mapping.price_col]].copy()
    except KeyError as e:
        raise HTTPException(status_code=400, detail=f"Mapped column not found in file: {str(e)}")
        
    mapped_df.columns = ['date', 'sku', 'quantity', 'price']

    for index, row in mapped_df.iterrows():
        errors = []
        raw_dict = row.to_dict()
        
        # Check missing values
        if pd.isna(row['sku']) or str(row['sku']).strip() == "":
            errors.append("SKU is missing")
        elif str(row['sku']).strip() not in valid_skus:
            errors.append(f"Unknown SKU: {row['sku']}")

        try:
            qty = float(row['quantity'])
            if pd.isna(qty) or qty <= 0:
                errors.append("Quantity must be greater than 0")
        except ValueError:
            errors.append("Invalid quantity format")

        try:
            price = float(row['price'])
            if pd.isna(price) or price < 0:
                errors.append("Price must be 0 or greater")
        except ValueError:
            errors.append("Invalid price format")

        if errors:
            error_count += 1
            # Just take the original row for raw data
            original_row_dict = df.iloc[index].fillna("").to_dict()
            err_row = models.ImportErrorRow(
                job_id=job.id,
                row_number=index + 2, # +1 for header, +1 for 0-index
                raw_data=json.dumps(original_row_dict),
                error_message=", ".join(errors)
            )
            db.add(err_row)

    job.total_rows = total_rows
    job.error_rows = error_count
    job.status = models.ImportJobStatus.CONFIRMED if error_count < total_rows else models.ImportJobStatus.FAILED
    db.commit()
    db.refresh(job)

    # Return with errors
    return job

@router.post("/{job_id}/confirm")
def confirm_import(workspace_id: int, job_id: int, mapping: schemas.ColumnMapping, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    job = db.query(models.ImportJob).filter(models.ImportJob.id == job_id, models.ImportJob.workspace_id == workspace_id).first()
    if not job or job.status != models.ImportJobStatus.CONFIRMED:
        raise HTTPException(status_code=400, detail="Job not ready for confirmation")

    job.status = models.ImportJobStatus.PROCESSING
    db.commit()

    if job.filename.endswith('.csv'):
        df = pd.read_csv(job.temp_file_path)
    else:
        df = pd.read_excel(job.temp_file_path)

    # Get error rows to skip
    error_rows_q = db.query(models.ImportErrorRow.row_number).filter(models.ImportErrorRow.job_id == job_id).all()
    error_indices = set([r[0] - 2 for r in error_rows_q])

    valid_products = {p.sku: p for p in db.query(models.Product).filter(models.Product.workspace_id == workspace_id).all()}

    imported = 0
    # Process rows
    for index, row in df.iterrows():
        if index in error_indices:
            continue
            
        sku_val = str(row[mapping.sku_col]).strip()
        product = valid_products.get(sku_val)
        if not product:
            continue # Should have been caught by validation, but just in case
            
        qty = int(float(row[mapping.quantity_col]))
        price = float(row[mapping.price_col])

        # Create Transaction
        trx = models.Transaction(
            workspace_id=workspace_id,
            user_id=current_user.id,
            payment_method="IMPORT",
            total_amount=qty * price
        )
        db.add(trx)
        db.flush() # Get trx ID

        # Create Transaction Item
        item = models.TransactionItem(
            transaction_id=trx.id,
            product_id=product.id,
            quantity=qty,
            selling_price=price,
            hpp=product.current_hpp
        )
        db.add(item)
        
        # Deduct Stock
        prev_stock = product.current_stock
        product.current_stock -= qty
        
        # Create Movement
        mov = models.InventoryMovement(
            workspace_id=workspace_id,
            product_id=product.id,
            type=models.MovementTypeEnum.SALE,
            quantity=-qty,
            previous_stock=prev_stock,
            new_stock=product.current_stock,
            reference_id=f"IMPORT-{job_id}",
            user_id=current_user.id
        )
        db.add(mov)
        
        imported += 1

    job.imported_rows = imported
    job.status = models.ImportJobStatus.COMPLETED
    from sqlalchemy.sql import func
    job.completed_at = func.now()
    
    # Cleanup temp file
    try:
        os.remove(job.temp_file_path)
    except:
        pass
        
    db.commit()
    return {"message": "Import completed successfully", "imported_rows": imported}

@router.get("", response_model=List[schemas.ImportJobResponse])
def get_imports(workspace_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    jobs = db.query(models.ImportJob).filter(models.ImportJob.workspace_id == workspace_id).order_by(models.ImportJob.created_at.desc()).all()
    return jobs
