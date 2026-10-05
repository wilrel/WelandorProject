from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional

import models
import schemas
from database import get_db
from core.dependencies import get_current_user, get_workspace_member, require_roles, MANAGE_ROLES

router = APIRouter(prefix="/api/workspaces/{workspace_id}/inventory", tags=["inventory"])

@router.post("/adjust")
def adjust_inventory(
    workspace_id: int,
    product_id: int,
    adjust: schemas.InventoryAdjust,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    member: models.WorkspaceMember = Depends(require_roles(*MANAGE_ROLES)),
):
    product = db.query(models.Product).filter(
        models.Product.id == product_id,
        models.Product.workspace_id == workspace_id
    ).with_for_update().first()

    if not product:
        raise HTTPException(status_code=404, detail="Produk tidak ditemukan")

    old_stock = product.current_stock
    new_stock = adjust.actual_stock
    diff = new_stock - old_stock

    if diff == 0:
        return {"message": "Stok fisik sama dengan stok sistem, tidak ada penyesuaian.", "new_stock": new_stock}

    product.current_stock = new_stock

    db.add(models.InventoryMovement(
        workspace_id=workspace_id,
        product_id=product.id,
        type=models.MovementTypeEnum.ADJUSTMENT,
        quantity=diff,
        previous_stock=old_stock,
        new_stock=new_stock,
        reference_id=(adjust.reason or "Stock Opname").strip(),
        user_id=current_user.id
    ))
    db.commit()

    return {"message": "Stok berhasil disesuaikan", "new_stock": new_stock}

@router.get("/movements", response_model=List[schemas.InventoryMovementResponse])
def get_movements(
    workspace_id: int,
    product_id: Optional[int] = None,
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    member: models.WorkspaceMember = Depends(get_workspace_member),
):
    query = db.query(models.InventoryMovement).options(joinedload(models.InventoryMovement.product)).filter(
        models.InventoryMovement.workspace_id == workspace_id
    )
    if product_id is not None:
        query = query.filter(models.InventoryMovement.product_id == product_id)
    return query.order_by(models.InventoryMovement.timestamp.desc(), models.InventoryMovement.id.desc()).limit(limit).all()
