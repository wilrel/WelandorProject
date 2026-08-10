from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
from models import RoleEnum

class UserBase(BaseModel):
    email: EmailStr

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class WorkspaceBase(BaseModel):
    name: str
    logo: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    currency: str = "IDR"
    timezone: str = "Asia/Jakarta"

class WorkspaceCreate(WorkspaceBase):
    pass

class WorkspaceResponse(WorkspaceBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# --- Phase 2 Schemas ---

class CategoryBase(BaseModel):
    name: str

class CategoryCreate(CategoryBase):
    pass

class CategoryResponse(CategoryBase):
    id: int
    workspace_id: int
    created_at: datetime

    class Config:
        from_attributes = True

class ProductBase(BaseModel):
    sku: str
    name: str
    unit: str
    selling_price: float
    current_hpp: float
    current_stock: int
    is_active: bool = True
    category_id: Optional[int] = None

class ProductCreate(ProductBase):
    pass

class ProductResponse(ProductBase):
    id: int
    workspace_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class TransactionItemBase(BaseModel):
    product_id: int
    quantity: int

class TransactionItemCreate(TransactionItemBase):
    pass

class TransactionItemResponse(TransactionItemBase):
    id: int
    selling_price: float
    hpp: float

    class Config:
        from_attributes = True

class TransactionBase(BaseModel):
    payment_method: str = "CASH"

class TransactionCreate(TransactionBase):
    items: List[TransactionItemCreate]

class TransactionResponse(TransactionBase):
    id: int
    workspace_id: int
    user_id: int
    total_amount: float
    timestamp: datetime
    items: List[TransactionItemResponse]

    class Config:
        from_attributes = True

class InventoryMovementResponse(BaseModel):
    id: int
    workspace_id: int
    product_id: int
    type: str
    quantity: int
    previous_stock: int
    new_stock: int
    reference_id: Optional[str] = None
    user_id: int
    timestamp: datetime

    class Config:
        from_attributes = True

# --- Phase 3 Schemas ---
class ImportErrorRowResponse(BaseModel):
    id: int
    row_number: int
    raw_data: str
    error_message: str

    class Config:
        from_attributes = True

class ImportJobResponse(BaseModel):
    id: int
    filename: str
    status: str
    total_rows: int
    imported_rows: int
    error_rows: int
    created_at: datetime
    completed_at: Optional[datetime] = None
    errors: List[ImportErrorRowResponse] = []

    class Config:
        from_attributes = True

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

# --- Phase 4 Schemas ---

class PurchaseItemCreate(BaseModel):
    product_id: int
    quantity: int
    unit_cost: float

class PurchaseCreate(BaseModel):
    supplier_name: Optional[str] = None
    items: List[PurchaseItemCreate]

class PurchaseItemResponse(BaseModel):
    id: int
    product_id: int
    quantity: int
    unit_cost: float
    
    # Optional nested product
    product: Optional[ProductResponse] = None

    class Config:
        from_attributes = True

class PurchaseResponse(BaseModel):
    id: int
    workspace_id: int
    supplier_name: Optional[str] = None
    total_amount: float
    timestamp: datetime
    items: List[PurchaseItemResponse]

    class Config:
        from_attributes = True

class InventoryAdjust(BaseModel):
    actual_stock: int
    reason: str
