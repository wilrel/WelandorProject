import os
import sys

# Setup environment
os.environ["DATABASE_URL"] = "sqlite:///./tokoberkahjaya.db"

from database import SessionLocal
import models
from core.security import get_password_hash

def seed_data():
    db = SessionLocal()
    
    # Check if user exists
    user = db.query(models.User).filter(models.User.email == "admin@toko.com").first()
    if not user:
        print("Creating admin user...")
        user = models.User(
            email="admin@toko.com",
            password_hash=get_password_hash("password")
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
    # Check if workspace exists
    workspace = db.query(models.Workspace).filter(models.Workspace.name == "Toko Berkah Jaya").first()
    if not workspace:
        print("Creating workspace...")
        workspace = models.Workspace(
            name="Toko Berkah Jaya"
        )
        db.add(workspace)
        db.commit()
        db.refresh(workspace)
        
        # Add user to workspace
        member = models.WorkspaceMember(
            workspace_id=workspace.id,
            user_id=user.id,
            role=models.RoleEnum.OWNER
        )
        db.add(member)
        db.commit()
        
    print(f"Seed complete. Workspace ID: {workspace.id}")
    db.close()

if __name__ == "__main__":
    seed_data()
