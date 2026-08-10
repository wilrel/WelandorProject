from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Enum as SQLEnum, Float, Boolean, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import enum
from database import Base

class RoleEnum(str, enum.Enum):
    OWNER = "OWNER"
    ADMIN = "ADMIN"
    MANAGER = "MANAGER"
    CASHIER = "CASHIER"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    workspace_memberships = relationship("WorkspaceMember", back_populates="user")

class Workspace(Base):
    __tablename__ = "workspaces"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    logo = Column(String, nullable=True)
    address = Column(Text, nullable=True)
    phone = Column(String, nullable=True)
    currency = Column(String, default="IDR")
    timezone = Column(String, default="Asia/Jakarta")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    members = relationship("WorkspaceMember", back_populates="workspace")

class WorkspaceMember(Base):
    __tablename__ = "workspace_members"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role = Column(SQLEnum(RoleEnum), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    workspace = relationship("Workspace", back_populates="members")
    user = relationship("User", back_populates="workspace_memberships")

class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), nullable=False)
    name = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    products = relationship("Product", back_populates="category")

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    sku = Column(String, index=True, nullable=False)
    name = Column(String, nullable=False)
    unit = Column(String, nullable=False) # e.g. kg, pcs, liter
    selling_price = Column(Float, nullable=False, default=0.0)
    current_hpp = Column(Float, nullable=False, default=0.0)
    current_stock = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    category = relationship("Category", back_populates="products")

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False) # Cashier
    total_amount = Column(Float, nullable=False, default=0.0)
    payment_method = Column(String, nullable=False, default="CASH")
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    items = relationship("TransactionItem", back_populates="transaction")

class TransactionItem(Base):
    __tablename__ = "transaction_items"

    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(Integer, ForeignKey("transactions.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    selling_price = Column(Float, nullable=False)
    hpp = Column(Float, nullable=False) # Locked at time of sale
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    transaction = relationship("Transaction", back_populates="items")
    product = relationship("Product")

class MovementTypeEnum(str, enum.Enum):
    OPENING = "OPENING"
    PURCHASE = "PURCHASE"
    SALE = "SALE"
    ADJUSTMENT = "ADJUSTMENT"
    STOCKTAKE = "STOCKTAKE"

class InventoryMovement(Base):
    __tablename__ = "inventory_movements"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    type = Column(SQLEnum(MovementTypeEnum), nullable=False)
    quantity = Column(Integer, nullable=False) # Can be positive or negative
    previous_stock = Column(Integer, nullable=False)
    new_stock = Column(Integer, nullable=False)
    reference_id = Column(String, nullable=True) # e.g. transaction_id or purchase_id
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    product = relationship("Product")

class ImportJobStatus(str, enum.Enum):
    PENDING = "PENDING"
    VALIDATING = "VALIDATING"
    CONFIRMED = "CONFIRMED"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"

class ImportJob(Base):
    __tablename__ = "import_jobs"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    filename = Column(String, nullable=False)
    status = Column(SQLEnum(ImportJobStatus), default=ImportJobStatus.PENDING, nullable=False)
    total_rows = Column(Integer, default=0)
    imported_rows = Column(Integer, default=0)
    error_rows = Column(Integer, default=0)
    temp_file_path = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)

    errors = relationship("ImportErrorRow", back_populates="job")

class ImportErrorRow(Base):
    __tablename__ = "import_error_rows"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("import_jobs.id"), nullable=False)
    row_number = Column(Integer, nullable=False)
    raw_data = Column(Text, nullable=False)
    error_message = Column(Text, nullable=False)

    job = relationship("ImportJob", back_populates="errors")

class Purchase(Base):
    __tablename__ = "purchases"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    supplier_name = Column(String, nullable=True)
    total_amount = Column(Float, nullable=False, default=0.0)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    items = relationship("PurchaseItem", back_populates="purchase")

class PurchaseItem(Base):
    __tablename__ = "purchase_items"

    id = Column(Integer, primary_key=True, index=True)
    purchase_id = Column(Integer, ForeignKey("purchases.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_cost = Column(Float, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    purchase = relationship("Purchase", back_populates="items")
    product = relationship("Product")
