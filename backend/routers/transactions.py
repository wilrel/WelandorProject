from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

import models
import schemas
from database import get_db
from core.dependencies import get_current_user

router = APIRouter(prefix="/api/workspaces/{workspace_id}", tags=["transactions"])

@router.post("/transactions", response_model=schemas.TransactionResponse)
def create_transaction(workspace_id: int, transaction: schemas.TransactionCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Verify workspace membership
    member = db.query(models.WorkspaceMember).filter(
        models.WorkspaceMember.workspace_id == workspace_id,
        models.WorkspaceMember.user_id == current_user.id
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this workspace")
        
    # Calculate totals, update stock, log movements
    total_amount = 0.0
    db_items = []
    movements = []
    
    # We create the transaction first to get its ID for movements reference
    db_transaction = models.Transaction(
        workspace_id=workspace_id,
        user_id=current_user.id,
        payment_method=transaction.payment_method,
        total_amount=0.0 # Will update after calculating items
    )
    db.add(db_transaction)
    db.flush() # To get the transaction ID
    
    for item in transaction.items:
        product = db.query(models.Product).filter(
            models.Product.id == item.product_id,
            models.Product.workspace_id == workspace_id
        ).with_for_update().first() # Lock the row to prevent race conditions on stock
        
        if not product:
            db.rollback()
            raise HTTPException(status_code=404, detail=f"Product with id {item.product_id} not found in this workspace")
            
        if product.current_stock < item.quantity:
            db.rollback()
            raise HTTPException(status_code=400, detail=f"Insufficient stock for product {product.name}. Current stock: {product.current_stock}")
            
        # Create transaction item
        subtotal = item.quantity * product.selling_price
        total_amount += subtotal
        
        db_item = models.TransactionItem(
            transaction_id=db_transaction.id,
            product_id=product.id,
            quantity=item.quantity,
            selling_price=product.selling_price,
            hpp=product.current_hpp
        )
        db.add(db_item)
        
        # Update product stock
        previous_stock = product.current_stock
        product.current_stock -= item.quantity
        
        # Log inventory movement
        movement = models.InventoryMovement(
            workspace_id=workspace_id,
            product_id=product.id,
            type=models.MovementTypeEnum.SALE,
            quantity=-item.quantity, # Negative for sale
            previous_stock=previous_stock,
            new_stock=product.current_stock,
            reference_id=f"TRX-{db_transaction.id}",
            user_id=current_user.id
        )
        db.add(movement)
        
    db_transaction.total_amount = total_amount
    db.commit()
    db.refresh(db_transaction)
    
    return db_transaction

@router.get("/transactions", response_model=List[schemas.TransactionResponse])
def get_transactions(workspace_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Verify workspace membership
    member = db.query(models.WorkspaceMember).filter(
        models.WorkspaceMember.workspace_id == workspace_id,
        models.WorkspaceMember.user_id == current_user.id
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this workspace")
        
    transactions = db.query(models.Transaction).filter(
        models.Transaction.workspace_id == workspace_id
    ).order_by(models.Transaction.timestamp.desc()).limit(100).all()
    
    return transactions
