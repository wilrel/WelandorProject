from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, selectinload
from typing import List

import models
import schemas
from database import get_db
from core.dependencies import get_current_user, get_workspace_member, require_roles, MANAGE_ROLES

router = APIRouter(prefix="/api/workspaces/{workspace_id}", tags=["purchases"])

@router.post("/purchases", response_model=schemas.PurchaseResponse, status_code=status.HTTP_201_CREATED)
def create_purchase(
    workspace_id: int,
    purchase: schemas.PurchaseCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    member: models.WorkspaceMember = Depends(require_roles(*MANAGE_ROLES)),
):
    total_amount = 0.0

    db_purchase = models.Purchase(
        workspace_id=workspace_id,
        user_id=current_user.id,
        supplier_name=(purchase.supplier_name or "").strip() or None,
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
            raise HTTPException(status_code=404, detail=f"Produk dengan id {item.product_id} tidak ditemukan")

        total_amount += item.quantity * item.unit_cost

        db.add(models.PurchaseItem(
            purchase_id=db_purchase.id,
            product_id=product.id,
            quantity=item.quantity,
            unit_cost=item.unit_cost
        ))

        # Calculate new HPP using Moving Average. Negative stock carries no cost,
        # so only the positive on-hand quantity is weighted.
        old_stock = product.current_stock
        old_hpp = product.current_hpp
        new_stock = old_stock + item.quantity
        weighted_old_stock = max(old_stock, 0)
        weighted_total = weighted_old_stock + item.quantity
        new_hpp = ((weighted_old_stock * old_hpp) + (item.quantity * item.unit_cost)) / weighted_total

        product.current_stock = new_stock
        product.current_hpp = round(new_hpp, 2)

        db.add(models.InventoryMovement(
            workspace_id=workspace_id,
            product_id=product.id,
            type=models.MovementTypeEnum.PURCHASE,
            quantity=item.quantity,
            previous_stock=old_stock,
            new_stock=new_stock,
            reference_id=f"PURCHASE-{db_purchase.id}",
            user_id=current_user.id
        ))

    db_purchase.total_amount = total_amount
    db.commit()
    db.refresh(db_purchase)

    return db_purchase

@router.get("/purchases", response_model=List[schemas.PurchaseResponse])
def get_purchases(
    workspace_id: int,
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    member: models.WorkspaceMember = Depends(get_workspace_member),
):
    return db.query(models.Purchase).options(
        selectinload(models.Purchase.items).joinedload(models.PurchaseItem.product)
    ).filter(
        models.Purchase.workspace_id == workspace_id
    ).order_by(models.Purchase.timestamp.desc(), models.Purchase.id.desc()).limit(limit).all()
