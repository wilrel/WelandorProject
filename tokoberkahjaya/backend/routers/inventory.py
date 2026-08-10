from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

import models
import schemas
from database import get_db
from core.dependencies import get_current_user

router = APIRouter(prefix="/api/workspaces/{workspace_id}/inventory", tags=["inventory"])

@router.post("/adjust")
def adjust_inventory(workspace_id: int, product_id: int, adjust: schemas.InventoryAdjust, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Verify workspace membership
    member = db.query(models.WorkspaceMember).filter(
        models.WorkspaceMember.workspace_id == workspace_id,
        models.WorkspaceMember.user_id == current_user.id
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this workspace")
        
    product = db.query(models.Product).filter(
        models.Product.id == product_id,
        models.Product.workspace_id == workspace_id
    ).with_for_update().first()
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    old_stock = product.current_stock
    new_stock = adjust.actual_stock
    diff = new_stock - old_stock
    
    if diff == 0:
        return {"message": "No adjustment needed, stock matches."}
        
    product.current_stock = new_stock
    
    movement = models.InventoryMovement(
        workspace_id=workspace_id,
        product_id=product.id,
        type=models.MovementTypeEnum.ADJUSTMENT,
        quantity=diff,
        previous_stock=old_stock,
        new_stock=new_stock,
        reference_id=adjust.reason,
        user_id=current_user.id
    )
    db.add(movement)
    db.commit()
    
    return {"message": "Inventory adjusted successfully", "new_stock": new_stock}
