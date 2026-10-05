export type Role = 'OWNER' | 'ADMIN' | 'MANAGER' | 'CASHIER';

export interface Workspace {
  id: number;
  name: string;
  logo: string | null;
  address: string | null;
  phone: string | null;
  currency: string;
  timezone: string;
  created_at: string;
}

export interface WorkspaceWithRole extends Workspace {
  role: Role;
}

export interface User {
  id: number;
  email: string;
  created_at: string;
  workspaces: WorkspaceWithRole[];
}

export interface Category {
  id: number;
  workspace_id: number;
  name: string;
  created_at: string;
}

export interface Product {
  id: number;
  workspace_id: number;
  sku: string;
  name: string;
  unit: string;
  selling_price: number;
  current_hpp: number;
  current_stock: number;
  is_active: boolean;
  category_id: number | null;
  created_at: string;
  updated_at: string | null;
}

export interface ProductInput {
  sku: string;
  name: string;
  unit: string;
  selling_price: number;
  current_hpp: number;
  current_stock?: number;
  is_active: boolean;
  category_id: number | null;
}

export type PaymentMethod = 'CASH' | 'QRIS' | 'TRANSFER' | 'DEBIT';

export interface TransactionItem {
  id: number;
  product_id: number;
  product_name: string | null;
  product_sku: string | null;
  quantity: number;
  selling_price: number;
  hpp: number;
}

export interface Transaction {
  id: number;
  workspace_id: number;
  user_id: number;
  payment_method: string;
  total_amount: number;
  timestamp: string;
  items: TransactionItem[];
}

export interface PurchaseItem {
  id: number;
  product_id: number;
  quantity: number;
  unit_cost: number;
  product: Product | null;
}

export interface Purchase {
  id: number;
  workspace_id: number;
  supplier_name: string | null;
  total_amount: number;
  timestamp: string;
  items: PurchaseItem[];
}

export interface PurchaseInput {
  supplier_name: string | null;
  items: { product_id: number; quantity: number; unit_cost: number }[];
}

export type MovementType = 'OPENING' | 'PURCHASE' | 'SALE' | 'ADJUSTMENT' | 'STOCKTAKE';

export interface InventoryMovement {
  id: number;
  product_id: number;
  product_name: string | null;
  product_sku: string | null;
  type: MovementType;
  quantity: number;
  previous_stock: number;
  new_stock: number;
  reference_id: string | null;
  timestamp: string;
}

export interface ImportErrorRow {
  id: number;
  row_number: number;
  raw_data: string;
  error_message: string;
}

export interface ImportJob {
  id: number;
  filename: string;
  status: 'PENDING' | 'VALIDATING' | 'CONFIRMED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  total_rows: number;
  imported_rows: number;
  error_rows: number;
  created_at: string;
  completed_at: string | null;
  errors: ImportErrorRow[];
}

export interface ColumnMapping {
  date_col: string;
  sku_col: string;
  quantity_col: string;
  price_col: string;
}

export interface UploadPreview {
  job_id: number;
  filename: string;
  columns: string[];
  preview_data: Record<string, string>[];
}

export interface DailySales {
  date: string;
  revenue: number;
  profit: number;
  transactions: number;
}

export interface DashboardSummary {
  today_revenue: number;
  today_profit: number;
  today_transactions: number;
  period_revenue: number;
  period_profit: number;
  period_transactions: number;
  average_basket: number;
  inventory_value: number;
  active_products: number;
  low_stock_threshold: number;
  low_stock: { id: number; name: string; sku: string; unit: string; current_stock: number }[];
  daily_sales: DailySales[];
  top_products: { product_id: number; name: string; sku: string; quantity: number; revenue: number }[];
}
