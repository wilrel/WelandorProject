from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from core.dependencies import get_current_user
from core.security import verify_password, get_password_hash, create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES

router = APIRouter(prefix="/api/auth", tags=["auth"])

def _issue_token(user: models.User) -> dict:
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return {"access_token": access_token, "token_type": "bearer"}

def _ensure_email_available(db: Session, email: str):
    if db.query(models.User).filter(models.User.email == email.lower()).first():
        raise HTTPException(status_code=400, detail="Email sudah terdaftar")

@router.post("/register", response_model=schemas.UserResponse, status_code=status.HTTP_201_CREATED)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    _ensure_email_available(db, user.email)
    db_user = models.User(email=user.email.lower(), password_hash=get_password_hash(user.password))
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@router.post("/signup", response_model=schemas.Token, status_code=status.HTTP_201_CREATED)
def signup(payload: schemas.RegisterWithWorkspace, db: Session = Depends(get_db)):
    """Register a user together with their first store (workspace) and log them in."""
    _ensure_email_available(db, payload.email)
    user = models.User(email=payload.email.lower(), password_hash=get_password_hash(payload.password))
    workspace = models.Workspace(name=payload.workspace_name.strip())
    db.add_all([user, workspace])
    db.flush()
    db.add(models.WorkspaceMember(workspace_id=workspace.id, user_id=user.id, role=models.RoleEnum.OWNER))
    db.commit()
    return _issue_token(user)

@router.post("/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username.strip().lower()).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email atau password salah",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return _issue_token(user)

@router.get("/me", response_model=schemas.MeResponse)
def me(current_user: models.User = Depends(get_current_user)):
    workspaces = [
        schemas.WorkspaceWithRoleResponse.model_validate(
            {**schemas.WorkspaceResponse.model_validate(m.workspace).model_dump(), "role": m.role}
        )
        for m in current_user.workspace_memberships
    ]
    return schemas.MeResponse(
        id=current_user.id,
        email=current_user.email,
        created_at=current_user.created_at,
        workspaces=workspaces,
    )
