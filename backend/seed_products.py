import os
os.environ["DATABASE_URL"] = "sqlite:///./tokoberkahjaya.db"

from database import SessionLocal
import models

def seed_products():
    db = SessionLocal()
    
    workspace = db.query(models.Workspace).first()
    if not workspace:
        print("Please run seed.py first.")
        return
        
    admin = db.query(models.User).filter(models.User.email == "admin@toko.com").first()
    
    products = [
        {"sku": "BRS-5KG", "name": "Beras Sania 5kg", "unit": "sak", "selling_price": 75000, "current_hpp": 70000, "current_stock": 25},
        {"sku": "GLA-1KG", "name": "Gula Pasir Gulaku 1kg", "unit": "pcs", "selling_price": 16000, "current_hpp": 14500, "current_stock": 50},
        {"sku": "MYK-1L", "name": "Minyak Goreng Bimoli 1L", "unit": "pcs", "selling_price": 20000, "current_hpp": 18000, "current_stock": 40},
        {"sku": "TLR-1KG", "name": "Telur Ayam Ras 1kg", "unit": "kg", "selling_price": 28000, "current_hpp": 25000, "current_stock": 15},
        {"sku": "TPG-1KG", "name": "Tepung Terigu Segitiga Biru 1kg", "unit": "pcs", "selling_price": 12000, "current_hpp": 10500, "current_stock": 30},
    ]
    
    print("Seeding products...")
    for p in products:
        existing = db.query(models.Product).filter(models.Product.sku == p["sku"]).first()
        if not existing:
            new_prod = models.Product(**p, workspace_id=workspace.id)
            db.add(new_prod)
            db.commit()
            db.refresh(new_prod)
            
            # Initial stock movement
            movement = models.InventoryMovement(
                workspace_id=workspace.id,
                product_id=new_prod.id,
                type=models.MovementTypeEnum.OPENING,
                quantity=new_prod.current_stock,
                previous_stock=0,
                new_stock=new_prod.current_stock,
                reference_id="INIT",
                user_id=admin.id
            )
            db.add(movement)
            db.commit()
            print(f"Added {p['name']}")
    
    print("Done!")
    db.close()

if __name__ == "__main__":
    seed_products()
