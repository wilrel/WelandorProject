"""Seed a demo store.

Usage:
    python seed.py           # admin user, workspace, categories and products
    python seed.py --demo    # also generate 30 days of sample sales for the dashboard
"""
import random
import sys
from datetime import datetime, timedelta, timezone

import models
from core.security import get_password_hash
from core.timeutil import to_db
from database import Base, SessionLocal, engine

ADMIN_EMAIL = "admin@toko.com"
ADMIN_PASSWORD = "password"
WORKSPACE_NAME = "Toko Berkah Jaya"

CATALOG = {
    "Beras & Tepung": [
        ("BRS-5KG", "Beras Sania 5kg", "sak", 75000, 70000, 25),
        ("TPG-1KG", "Tepung Terigu Segitiga Biru 1kg", "pcs", 12000, 10500, 30),
    ],
    "Gula & Minyak": [
        ("GLA-1KG", "Gula Pasir Gulaku 1kg", "pcs", 16000, 14500, 50),
        ("MYK-1L", "Minyak Goreng Bimoli 1L", "pcs", 20000, 18000, 40),
        ("MYK-2L", "Minyak Goreng Sunco 2L", "pcs", 38000, 34500, 4),
    ],
    "Telur & Protein": [
        ("TLR-1KG", "Telur Ayam Ras 1kg", "kg", 28000, 25000, 15),
    ],
    "Makanan Instan": [
        ("IDM-GRG", "Indomie Goreng", "pcs", 3500, 2900, 120),
        ("IDM-SOTO", "Indomie Soto", "pcs", 3300, 2750, 3),
    ],
    "Minuman": [
        ("AQA-600", "Aqua 600ml", "botol", 4000, 3000, 48),
        ("KPI-ABC", "Kopi ABC Susu Sachet", "pcs", 2000, 1500, 80),
    ],
}


def get_or_create_admin(db):
    user = db.query(models.User).filter(models.User.email == ADMIN_EMAIL).first()
    if not user:
        print("Membuat user admin...")
        user = models.User(email=ADMIN_EMAIL, password_hash=get_password_hash(ADMIN_PASSWORD))
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def get_or_create_workspace(db, user):
    workspace = db.query(models.Workspace).filter(models.Workspace.name == WORKSPACE_NAME).first()
    if not workspace:
        print("Membuat workspace...")
        workspace = models.Workspace(
            name=WORKSPACE_NAME,
            address="Jl. Pasar Baru No. 12, Purwokerto",
            phone="0812-0000-0000",
        )
        db.add(workspace)
        db.flush()
        db.add(models.WorkspaceMember(workspace_id=workspace.id, user_id=user.id, role=models.RoleEnum.OWNER))
        db.commit()
        db.refresh(workspace)
    return workspace


def seed_catalog(db, workspace, user):
    for category_name, products in CATALOG.items():
        category = db.query(models.Category).filter(
            models.Category.workspace_id == workspace.id, models.Category.name == category_name
        ).first()
        if not category:
            category = models.Category(workspace_id=workspace.id, name=category_name)
            db.add(category)
            db.flush()

        for sku, name, unit, price, hpp, stock in products:
            exists = db.query(models.Product).filter(
                models.Product.workspace_id == workspace.id, models.Product.sku == sku
            ).first()
            if exists:
                continue
            product = models.Product(
                workspace_id=workspace.id, category_id=category.id, sku=sku, name=name, unit=unit,
                selling_price=price, current_hpp=hpp, current_stock=stock,
            )
            db.add(product)
            db.flush()
            db.add(models.InventoryMovement(
                workspace_id=workspace.id, product_id=product.id, type=models.MovementTypeEnum.OPENING,
                quantity=stock, previous_stock=0, new_stock=stock, reference_id="INIT", user_id=user.id,
            ))
            print(f"  + {name}")
    db.commit()


def seed_demo_sales(db, workspace, user, days=30):
    if db.query(models.Transaction).filter(models.Transaction.workspace_id == workspace.id).first():
        print("Transaksi sudah ada, data demo dilewati.")
        return

    rng = random.Random(42)
    products = db.query(models.Product).filter(models.Product.workspace_id == workspace.id).all()
    now = datetime.now(timezone.utc)
    count = 0
    for day_offset in range(days, -1, -1):
        for _ in range(rng.randint(3, 9)):
            moment = now - timedelta(days=day_offset, hours=rng.randint(0, 10), minutes=rng.randint(0, 59))
            if moment > now:
                continue
            picks = rng.sample(products, k=rng.randint(1, 3))
            trx = models.Transaction(
                workspace_id=workspace.id, user_id=user.id, total_amount=0.0,
                payment_method=rng.choice(["CASH", "CASH", "QRIS", "TRANSFER"]), timestamp=to_db(moment),
            )
            db.add(trx)
            db.flush()
            total = 0.0
            for product in picks:
                qty = rng.randint(1, 3)
                if product.current_stock - qty < 2:
                    # Keep the demo realistic: restock instead of overselling.
                    restock = 30
                    db.add(models.InventoryMovement(
                        workspace_id=workspace.id, product_id=product.id, type=models.MovementTypeEnum.PURCHASE,
                        quantity=restock, previous_stock=product.current_stock,
                        new_stock=product.current_stock + restock, reference_id="DEMO-RESTOCK",
                        user_id=user.id, timestamp=to_db(moment),
                    ))
                    product.current_stock += restock
                db.add(models.TransactionItem(
                    transaction_id=trx.id, product_id=product.id, quantity=qty,
                    selling_price=product.selling_price, hpp=product.current_hpp,
                ))
                db.add(models.InventoryMovement(
                    workspace_id=workspace.id, product_id=product.id, type=models.MovementTypeEnum.SALE,
                    quantity=-qty, previous_stock=product.current_stock, new_stock=product.current_stock - qty,
                    reference_id=f"TRX-{trx.id}", user_id=user.id, timestamp=to_db(moment),
                ))
                product.current_stock -= qty
                total += qty * product.selling_price
            trx.total_amount = total
            count += 1
    db.commit()
    print(f"{count} transaksi demo dibuat.")


def main():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        user = get_or_create_admin(db)
        workspace = get_or_create_workspace(db, user)
        print("Mengisi kategori & produk...")
        seed_catalog(db, workspace, user)
        if "--demo" in sys.argv:
            seed_demo_sales(db, workspace, user)
        print(f"Selesai. Login: {ADMIN_EMAIL} / {ADMIN_PASSWORD} (workspace ID {workspace.id})")
    finally:
        db.close()


if __name__ == "__main__":
    main()
