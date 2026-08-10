from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

import models
import schemas
from database import get_db
from core.dependencies import get_current_user

router = APIRouter(prefix="/api", tags=["products"])

# --- Categories ---
@router.post("/categories", response_model=schemas.CategoryResponse)
def create_category(category: schemas.CategoryCreate, workspace_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Verify workspace membership
    member = db.query(models.WorkspaceMember).filter(
        models.WorkspaceMember.workspace_id == workspace_id,
        models.WorkspaceMember.user_id == current_user.id
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this workspace")
        
    db_category = models.Category(**category.model_dump(), workspace_id=workspace_id)
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return db_category

@router.get("/workspaces/{workspace_id}/categories", response_model=List[schemas.CategoryResponse])
def get_categories(workspace_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Verify workspace membership
    member = db.query(models.WorkspaceMember).filter(
        models.WorkspaceMember.workspace_id == workspace_id,
        models.WorkspaceMember.user_id == current_user.id
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this workspace")
        
    categories = db.query(models.Category).filter(models.Category.workspace_id == workspace_id).all()
    return categories


# --- Products ---
@router.post("/products", response_model=schemas.ProductResponse)
def create_product(product: schemas.ProductCreate, workspace_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Verify workspace membership
    member = db.query(models.WorkspaceMember).filter(
        models.WorkspaceMember.workspace_id == workspace_id,
        models.WorkspaceMember.user_id == current_user.id
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this workspace")
        
    # Check SKU unique in workspace
    existing_product = db.query(models.Product).filter(
        models.Product.workspace_id == workspace_id,
        models.Product.sku == product.sku
    ).first()
    if existing_product:
        raise HTTPException(status_code=400, detail="SKU already exists in this workspace")
        
    db_product = models.Product(**product.model_dump(), workspace_id=workspace_id)
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    
    # If initial stock is > 0, log opening stock movement
    if db_product.current_stock > 0:
        movement = models.InventoryMovement(
            workspace_id=workspace_id,
            product_id=db_product.id,
            type=models.MovementTypeEnum.OPENING,
            quantity=db_product.current_stock,
            previous_stock=0,
            new_stock=db_product.current_stock,
            reference_id="INIT",
            user_id=current_user.id
        )
        db.add(movement)
        db.commit()
        
    return db_product

@router.get("/workspaces/{workspace_id}/products", response_model=List[schemas.ProductResponse])
def get_products(workspace_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Verify workspace membership
    member = db.query(models.WorkspaceMember).filter(
        models.WorkspaceMember.workspace_id == workspace_id,
        models.WorkspaceMember.user_id == current_user.id
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this workspace")
        
    products = db.query(models.Product).filter(models.Product.workspace_id == workspace_id).all()
    return products
