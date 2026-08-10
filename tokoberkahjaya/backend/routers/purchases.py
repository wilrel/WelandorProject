from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

import models
import schemas
from database import get_db
from core.dependencies import get_current_user

router = APIRouter(prefix="/api/workspaces/{workspace_id}", tags=["purchases"])

@router.post("/purchases", response_model=schemas.PurchaseResponse)
def create_purchase(workspace_id: int, purchase: schemas.PurchaseCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Verify workspace membership
    member = db.query(models.WorkspaceMember).filter(
        models.WorkspaceMember.workspace_id == workspace_id,
        models.WorkspaceMember.user_id == current_user.id
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this workspace")
        
    total_amount = 0.0
    
    db_purchase = models.Purchase(
        workspace_id=workspace_id,
        user_id=current_user.id,
        supplier_name=purchase.supplier_name,
        total_amount=0.0
    )
    db.add(db_purchase)
    db.flush()
    
    for item in purchase.items:
        product = db.query(models.Product).filter(
            models.Product.id == item.product_id,
            models.Product.workspace_id == workspace_id
        ).with_for_update().first()
        
        if not product:
            db.rollback()
            raise HTTPException(status_code=404, detail=f"Product with id {item.product_id} not found")
            
        subtotal = item.quantity * item.unit_cost
        total_amount += subtotal
        
        db_item = models.PurchaseItem(
            purchase_id=db_purchase.id,
            product_id=product.id,
            quantity=item.quantity,
            unit_cost=item.unit_cost
        )
        db.add(db_item)
        
        # Calculate new HPP using Moving Average
        old_stock = product.current_stock
        old_hpp = product.current_hpp
        new_qty = item.quantity
        new_unit_cost = item.unit_cost
        
        new_stock = old_stock + new_qty
        if new_stock > 0:
            new_hpp = ((old_stock * old_hpp) + (new_qty * new_unit_cost)) / new_stock
        else:
            new_hpp = old_hpp
            
        # Update product
        product.current_stock = new_stock
        product.current_hpp = new_hpp
        
        # Log movement
        movement = models.InventoryMovement(
            workspace_id=workspace_id,
            product_id=product.id,
            type=models.MovementTypeEnum.PURCHASE,
            quantity=item.quantity,
            previous_stock=old_stock,
            new_stock=new_stock,
            reference_id=f"PURCHASE-{db_purchase.id}",
            user_id=current_user.id
        )
        db.add(movement)
        
    db_purchase.total_amount = total_amount
    db.commit()
    db.refresh(db_purchase)
    
    return db_purchase

@router.get("/purchases", response_model=List[schemas.PurchaseResponse])
def get_purchases(workspace_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Verify workspace membership
    member = db.query(models.WorkspaceMember).filter(
        models.WorkspaceMember.workspace_id == workspace_id,
        models.WorkspaceMember.user_id == current_user.id
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this workspace")
        
    purchases = db.query(models.Purchase).filter(
        models.Purchase.workspace_id == workspace_id
    ).order_by(models.Purchase.timestamp.desc()).limit(100).all()
    
    return purchases
