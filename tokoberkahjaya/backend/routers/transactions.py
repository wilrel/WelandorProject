from collections import OrderedDict
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, selectinload
from typing import List, Optional

import models
import schemas
from database import get_db
from core.dependencies import get_current_user, get_workspace_member
from core.timeutil import get_zone, local_range_to_db

router = APIRouter(prefix="/api/workspaces/{workspace_id}", tags=["transactions"])

def _merge_quantities(items) -> "OrderedDict[int, int]":
    """Combine repeated lines for the same product so stock is checked against the total."""
    merged: "OrderedDict[int, int]" = OrderedDict()
    for item in items:
        merged[item.product_id] = merged.get(item.product_id, 0) + item.quantity
    return merged

@router.post("/transactions", response_model=schemas.TransactionResponse, status_code=status.HTTP_201_CREATED)
def create_transaction(
    workspace_id: int,
    transaction: schemas.TransactionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    member: models.WorkspaceMember = Depends(get_workspace_member),
):
    total_amount = 0.0

    # We create the transaction first to get its ID for movements reference
    db_transaction = models.Transaction(
        workspace_id=workspace_id,
        user_id=current_user.id,
        payment_method=transaction.payment_method,
        total_amount=0.0 # Will update after calculating items
    )
    db.add(db_transaction)
    db.flush() # To get the transaction ID

    for product_id, quantity in _merge_quantities(transaction.items).items():
        product = db.query(models.Product).filter(
            models.Product.id == product_id,
            models.Product.workspace_id == workspace_id
        ).with_for_update().first() # Lock the row to prevent race conditions on stock

        if not product or not product.is_active:
            db.rollback()
            raise HTTPException(status_code=404, detail=f"Produk dengan id {product_id} tidak ditemukan")

        if product.current_stock < quantity:
            db.rollback()
            raise HTTPException(
                status_code=400,
                detail=f"Stok {product.name} tidak mencukupi. Stok tersedia: {product.current_stock} {product.unit}",
            )

        total_amount += quantity * product.selling_price

        db.add(models.TransactionItem(
            transaction_id=db_transaction.id,
            product_id=product.id,
            quantity=quantity,
            selling_price=product.selling_price,
            hpp=product.current_hpp
        ))

        previous_stock = product.current_stock
        product.current_stock -= quantity

        db.add(models.InventoryMovement(
            workspace_id=workspace_id,
            product_id=product.id,
            type=models.MovementTypeEnum.SALE,
            quantity=-quantity, # Negative for sale
            previous_stock=previous_stock,
            new_stock=product.current_stock,
            reference_id=f"TRX-{db_transaction.id}",
            user_id=current_user.id
        ))

    db_transaction.total_amount = total_amount
    db.commit()
    db.refresh(db_transaction)

    return db_transaction

@router.get("/transactions", response_model=List[schemas.TransactionResponse])
def get_transactions(
    workspace_id: int,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    payment_method: Optional[str] = None,
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    member: models.WorkspaceMember = Depends(get_workspace_member),
):
    query = db.query(models.Transaction).options(
        selectinload(models.Transaction.items).joinedload(models.TransactionItem.product)
    ).filter(models.Transaction.workspace_id == workspace_id)
    lower, upper = local_range_to_db(start_date, end_date, get_zone(member.workspace.timezone))
    if lower is not None:
        query = query.filter(models.Transaction.timestamp >= lower)
    if upper is not None:
        query = query.filter(models.Transaction.timestamp < upper)
    if payment_method:
        query = query.filter(models.Transaction.payment_method == payment_method.upper())

    return query.order_by(models.Transaction.timestamp.desc(), models.Transaction.id.desc()).limit(limit).all()

@router.get("/transactions/{transaction_id}", response_model=schemas.TransactionResponse)
def get_transaction(workspace_id: int, transaction_id: int, db: Session = Depends(get_db), member: models.WorkspaceMember = Depends(get_workspace_member)):
    trx = db.query(models.Transaction).filter(
        models.Transaction.id == transaction_id,
        models.Transaction.workspace_id == workspace_id,
    ).first()
    if not trx:
        raise HTTPException(status_code=404, detail="Transaksi tidak ditemukan")
    return trx
