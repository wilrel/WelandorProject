from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

import models
import schemas
from database import get_db
from core.dependencies import get_current_user, get_workspace_member, require_roles, MANAGE_ROLES

router = APIRouter(prefix="/api/workspaces/{workspace_id}", tags=["products"])

def _get_product(db: Session, workspace_id: int, product_id: int) -> models.Product:
    product = db.query(models.Product).filter(
        models.Product.id == product_id,
        models.Product.workspace_id == workspace_id,
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Produk tidak ditemukan")
    return product

def _ensure_category(db: Session, workspace_id: int, category_id: int | None):
    if category_id is None:
        return
    exists = db.query(models.Category).filter(
        models.Category.id == category_id,
        models.Category.workspace_id == workspace_id,
    ).first()
    if not exists:
        raise HTTPException(status_code=400, detail="Kategori tidak ditemukan")

def _ensure_sku_available(db: Session, workspace_id: int, sku: str, exclude_id: int | None = None):
    query = db.query(models.Product).filter(
        models.Product.workspace_id == workspace_id,
        models.Product.sku == sku,
    )
    if exclude_id is not None:
        query = query.filter(models.Product.id != exclude_id)
    if query.first():
        raise HTTPException(status_code=400, detail=f"SKU '{sku}' sudah dipakai produk lain")


# --- Categories ---
@router.post("/categories", response_model=schemas.CategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(workspace_id: int, category: schemas.CategoryCreate, db: Session = Depends(get_db), member: models.WorkspaceMember = Depends(require_roles(*MANAGE_ROLES))):
    db_category = models.Category(name=category.name.strip(), workspace_id=workspace_id)
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return db_category

@router.get("/categories", response_model=List[schemas.CategoryResponse])
def get_categories(workspace_id: int, db: Session = Depends(get_db), member: models.WorkspaceMember = Depends(get_workspace_member)):
    return db.query(models.Category).filter(models.Category.workspace_id == workspace_id).order_by(models.Category.name).all()


# --- Products ---
@router.post("/products", response_model=schemas.ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(
    workspace_id: int,
    product: schemas.ProductCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    member: models.WorkspaceMember = Depends(require_roles(*MANAGE_ROLES)),
):
    _ensure_sku_available(db, workspace_id, product.sku)
    _ensure_category(db, workspace_id, product.category_id)

    db_product = models.Product(**product.model_dump(), workspace_id=workspace_id)
    db.add(db_product)
    db.flush()

    # If initial stock is > 0, log opening stock movement
    if db_product.current_stock > 0:
        db.add(models.InventoryMovement(
            workspace_id=workspace_id,
            product_id=db_product.id,
            type=models.MovementTypeEnum.OPENING,
            quantity=db_product.current_stock,
            previous_stock=0,
            new_stock=db_product.current_stock,
            reference_id="INIT",
            user_id=current_user.id,
        ))
    db.commit()
    db.refresh(db_product)
    return db_product

@router.get("/products", response_model=List[schemas.ProductResponse])
def get_products(workspace_id: int, include_inactive: bool = False, db: Session = Depends(get_db), member: models.WorkspaceMember = Depends(get_workspace_member)):
    query = db.query(models.Product).filter(models.Product.workspace_id == workspace_id)
    if not include_inactive:
        query = query.filter(models.Product.is_active.is_(True))
    return query.order_by(models.Product.name).all()

@router.get("/products/{product_id}", response_model=schemas.ProductResponse)
def get_product(workspace_id: int, product_id: int, db: Session = Depends(get_db), member: models.WorkspaceMember = Depends(get_workspace_member)):
    return _get_product(db, workspace_id, product_id)

@router.put("/products/{product_id}", response_model=schemas.ProductResponse)
def update_product(
    workspace_id: int,
    product_id: int,
    payload: schemas.ProductUpdate,
    db: Session = Depends(get_db),
    member: models.WorkspaceMember = Depends(require_roles(*MANAGE_ROLES)),
):
    product = _get_product(db, workspace_id, product_id)
    _ensure_sku_available(db, workspace_id, payload.sku, exclude_id=product.id)
    _ensure_category(db, workspace_id, payload.category_id)
    for field, value in payload.model_dump().items():
        setattr(product, field, value)
    db.commit()
    db.refresh(product)
    return product

@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_product(
    workspace_id: int,
    product_id: int,
    db: Session = Depends(get_db),
    member: models.WorkspaceMember = Depends(require_roles(*MANAGE_ROLES)),
):
    # Products are referenced by sales history, so they are archived rather than deleted.
    product = _get_product(db, workspace_id, product_id)
    product.is_active = False
    db.commit()
