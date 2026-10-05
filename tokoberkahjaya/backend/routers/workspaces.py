from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

import models
import schemas
from database import get_db
from core.dependencies import get_current_user, get_workspace_member, require_roles

router = APIRouter(prefix="/api/workspaces", tags=["workspaces"])

@router.post("", response_model=schemas.WorkspaceResponse, status_code=status.HTTP_201_CREATED)
def create_workspace(workspace: schemas.WorkspaceCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    db_workspace = models.Workspace(**workspace.model_dump())
    db.add(db_workspace)
    db.flush()

    # Add creator as OWNER
    db.add(models.WorkspaceMember(workspace_id=db_workspace.id, user_id=current_user.id, role=models.RoleEnum.OWNER))
    db.commit()
    db.refresh(db_workspace)
    return db_workspace

@router.get("", response_model=List[schemas.WorkspaceResponse])
def get_workspaces(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Get all workspaces the user is a member of
    return db.query(models.Workspace).join(models.WorkspaceMember).filter(
        models.WorkspaceMember.user_id == current_user.id
    ).all()

@router.get("/{workspace_id}", response_model=schemas.WorkspaceResponse)
def get_workspace(workspace_id: int, db: Session = Depends(get_db), member: models.WorkspaceMember = Depends(get_workspace_member)):
    return member.workspace

@router.put("/{workspace_id}", response_model=schemas.WorkspaceResponse)
def update_workspace(
    workspace_id: int,
    payload: schemas.WorkspaceUpdate,
    db: Session = Depends(get_db),
    member: models.WorkspaceMember = Depends(require_roles(models.RoleEnum.OWNER, models.RoleEnum.ADMIN)),
):
    workspace = member.workspace
    if workspace is None:
        raise HTTPException(status_code=404, detail="Workspace tidak ditemukan")
    for field, value in payload.model_dump().items():
        setattr(workspace, field, value)
    db.commit()
    db.refresh(workspace)
    return workspace
