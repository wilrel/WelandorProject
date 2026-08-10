from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

import models
import schemas
from database import get_db
from core.dependencies import get_current_user

router = APIRouter(prefix="/api/workspaces", tags=["workspaces"])

@router.post("", response_model=schemas.WorkspaceResponse)
def create_workspace(workspace: schemas.WorkspaceCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    db_workspace = models.Workspace(**workspace.model_dump())
    db.add(db_workspace)
    db.commit()
    db.refresh(db_workspace)
    
    # Add creator as OWNER
    member = models.WorkspaceMember(
        workspace_id=db_workspace.id,
        user_id=current_user.id,
        role=models.RoleEnum.OWNER
    )
    db.add(member)
    db.commit()
    
    return db_workspace

@router.get("", response_model=List[schemas.WorkspaceResponse])
def get_workspaces(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Get all workspaces the user is a member of
    workspaces = db.query(models.Workspace).join(models.WorkspaceMember).filter(
        models.WorkspaceMember.user_id == current_user.id
    ).all()
    return workspaces
