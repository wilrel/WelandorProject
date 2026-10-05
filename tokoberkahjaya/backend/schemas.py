from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from typing import Optional, List
from datetime import datetime, date
from models import RoleEnum

PAYMENT_METHODS = ("CASH", "QRIS", "TRANSFER", "DEBIT")


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# --- Auth ---

class UserBase(BaseModel):
    email: EmailStr

class UserCreate(UserBase):
    password: str = Field(min_length=6, max_length=72)

class UserResponse(UserBase, ORMModel):
    id: int
    created_at: datetime

class Token(BaseModel):
    access_token: str
    token_type: str

class RegisterWithWorkspace(UserCreate):
    workspace_name: str = Field(min_length=2, max_length=100)


# --- Workspaces ---

class WorkspaceBase(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    logo: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    currency: str = "IDR"
    timezone: str = "Asia/Jakarta"

class WorkspaceCreate(WorkspaceBase):
    pass

class WorkspaceUpdate(WorkspaceBase):
    pass

class WorkspaceResponse(WorkspaceBase, ORMModel):
    id: int
    created_at: datetime

class WorkspaceWithRoleResponse(WorkspaceResponse):
    role: RoleEnum

class MeResponse(UserResponse):
    workspaces: List[WorkspaceWithRoleResponse] = []


# --- Categories & Products ---

class CategoryBase(BaseModel):
    name: str = Field(min_length=1, max_length=100)

class CategoryCreate(CategoryBase):
    pass

class CategoryResponse(CategoryBase, ORMModel):
    id: int
    workspace_id: int
    created_at: datetime

class ProductBase(BaseModel):
    sku: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=200)
    unit: str = Field(min_length=1, max_length=20)
    selling_price: float = Field(ge=0)
    current_hpp: float = Field(ge=0)
    is_active: bool = True
    category_id: Optional[int] = None

    @field_validator("sku", "name", "unit")
    @classmethod
    def strip_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("tidak boleh kosong")
        return value

class ProductCreate(ProductBase):
    current_stock: int = Field(default=0, ge=0)

class ProductUpdate(ProductBase):
    """Stock is intentionally not editable here; use purchases or stock adjustments."""

class ProductResponse(ProductBase, ORMModel):
    id: int
    workspace_id: int
    current_stock: int
    created_at: datetime
    updated_at: Optional[datetime] = None


# --- Transactions ---

class TransactionItemBase(BaseModel):
    product_id: int
    quantity: int = Field(gt=0)

class TransactionItemCreate(TransactionItemBase):
    pass

class TransactionItemResponse(TransactionItemBase, ORMModel):
    id: int
    selling_price: float
    hpp: float
    product_name: Optional[str] = None
    product_sku: Optional[str] = None

class TransactionBase(BaseModel):
    payment_method: str = "CASH"

class TransactionCreate(TransactionBase):
    items: List[TransactionItemCreate] = Field(min_length=1)

    @field_validator("payment_method")
    @classmethod
    def valid_payment_method(cls, value: str) -> str:
        value = value.upper()
        if value not in PAYMENT_METHODS:
            raise ValueError(f"harus salah satu dari: {', '.join(PAYMENT_METHODS)}")
        return value

class TransactionResponse(TransactionBase, ORMModel):
    id: int
    workspace_id: int
    user_id: int
    total_amount: float
    timestamp: datetime
    items: List[TransactionItemResponse]


# --- Inventory ---

class InventoryMovementResponse(ORMModel):
    id: int
    workspace_id: int
    product_id: int
    product_name: Optional[str] = None
    product_sku: Optional[str] = None
    type: str
    quantity: int
    previous_stock: int
    new_stock: int
    reference_id: Optional[str] = None
    user_id: int
    timestamp: datetime

class InventoryAdjust(BaseModel):
    actual_stock: int = Field(ge=0)
    reason: str = Field(default="Stock Opname", max_length=200)


# --- Imports ---

class ImportErrorRowResponse(ORMModel):
    id: int
    row_number: int
    raw_data: str
    error_message: str

class ImportJobResponse(ORMModel):
    id: int
    filename: str
    status: str
    total_rows: int
    imported_rows: int
    error_rows: int
    created_at: datetime
    completed_at: Optional[datetime] = None
    errors: List[ImportErrorRowResponse] = []

class ColumnMapping(BaseModel):
    date_col: str
    sku_col: str
    quantity_col: str
    price_col: str

class UploadPreviewResponse(BaseModel):
    job_id: int
    filename: str
    columns: List[str]
    preview_data: List[dict]


# --- Purchases ---

class PurchaseItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(gt=0)
    unit_cost: float = Field(ge=0)

class PurchaseCreate(BaseModel):
    supplier_name: Optional[str] = Field(default=None, max_length=200)
    items: List[PurchaseItemCreate] = Field(min_length=1)

class PurchaseItemResponse(ORMModel):
    id: int
    product_id: int
    quantity: int
    unit_cost: float
    product: Optional[ProductResponse] = None

class PurchaseResponse(ORMModel):
    id: int
    workspace_id: int
    supplier_name: Optional[str] = None
    total_amount: float
    timestamp: datetime
    items: List[PurchaseItemResponse]


# --- Dashboard ---

class DailySales(BaseModel):
    date: date
    revenue: float
    profit: float
    transactions: int

class TopProduct(BaseModel):
    product_id: int
    name: str
    sku: str
    quantity: int
    revenue: float

class LowStockProduct(BaseModel):
    id: int
    name: str
    sku: str
    unit: str
    current_stock: int

class DashboardSummary(BaseModel):
    today_revenue: float
    today_profit: float
    today_transactions: int
    period_revenue: float
    period_profit: float
    period_transactions: int
    average_basket: float
    inventory_value: float
    active_products: int
    low_stock_threshold: int
    low_stock: List[LowStockProduct]
    daily_sales: List[DailySales]
    top_products: List[TopProduct]
