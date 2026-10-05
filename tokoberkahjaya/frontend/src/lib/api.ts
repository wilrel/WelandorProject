import axios, { AxiosError } from 'axios';
import type {
  Category, ColumnMapping, DashboardSummary, ImportJob, InventoryMovement, Product, ProductInput,
  Purchase, PurchaseInput, Transaction, UploadPreview, User, Workspace,
} from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
const TOKEN_KEY = 'tbj.token';
const WORKSPACE_KEY = 'tbj.workspace';

const storage = {
  get(key: string) {
    try { return typeof window === 'undefined' ? null : window.localStorage.getItem(key); } catch { return null; }
  },
  set(key: string, value: string | null) {
    try {
      if (value === null) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, value);
    } catch { /* storage unavailable (private mode) */ }
  },
};

export const session = {
  getToken: () => storage.get(TOKEN_KEY),
  setToken: (token: string | null) => storage.set(TOKEN_KEY, token),
  getWorkspaceId: () => {
    const value = storage.get(WORKSPACE_KEY);
    return value ? Number(value) : null;
  },
  setWorkspaceId: (id: number | null) => storage.set(WORKSPACE_KEY, id === null ? null : String(id)),
  clear: () => { storage.set(TOKEN_KEY, null); storage.set(WORKSPACE_KEY, null); },
};

export const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = session.getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const isAuthCall = error.config?.url?.startsWith('/auth/login') || error.config?.url?.startsWith('/auth/signup');
    if (error.response?.status === 401 && !isAuthCall && typeof window !== 'undefined') {
      session.clear();
      // Outside React here, so a full navigation is the reliable way to reset app state.
      if (!window.location.pathname.startsWith('/login')) window.location.replace('/login?expired=1');
    }
    return Promise.reject(error);
  },
);

/** Turn any API error into a readable Indonesian message. */
export function getErrorMessage(error: unknown, fallback = 'Terjadi kesalahan. Silakan coba lagi.'): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) return 'Tidak dapat terhubung ke server. Pastikan backend sedang berjalan.';
    const detail = (error.response.data as { detail?: unknown })?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      return detail.map((d: { loc?: (string | number)[]; msg?: string }) => {
        const field = d.loc?.filter((p) => p !== 'body').join('.');
        return field ? `${field}: ${d.msg}` : d.msg;
      }).join('; ');
    }
  }
  return error instanceof Error ? error.message : fallback;
}

const ws = () => {
  const id = session.getWorkspaceId();
  if (!id) throw new Error('Workspace belum dipilih');
  return `/workspaces/${id}`;
};

// --- Auth ---
export async function login(email: string, password: string) {
  const params = new URLSearchParams({ username: email, password });
  const res = await api.post<{ access_token: string }>('/auth/login', params);
  session.setToken(res.data.access_token);
}

export async function signup(email: string, password: string, workspaceName: string) {
  const res = await api.post<{ access_token: string }>('/auth/signup', {
    email, password, workspace_name: workspaceName,
  });
  session.setToken(res.data.access_token);
}

export const getMe = async () => (await api.get<User>('/auth/me')).data;

// --- Workspace ---
export const getWorkspace = async () => (await api.get<Workspace>(ws())).data;
export const updateWorkspace = async (data: Partial<Workspace>) => (await api.put<Workspace>(ws(), data)).data;

// --- Dashboard ---
export const getDashboard = async (days = 30) =>
  (await api.get<DashboardSummary>(`${ws()}/dashboard`, { params: { days } })).data;

// --- Products ---
export const getProducts = async (includeInactive = false) =>
  (await api.get<Product[]>(`${ws()}/products`, { params: { include_inactive: includeInactive } })).data;
export const createProduct = async (product: ProductInput) => (await api.post<Product>(`${ws()}/products`, product)).data;
export const updateProduct = async (id: number, product: ProductInput) =>
  (await api.put<Product>(`${ws()}/products/${id}`, product)).data;
export const archiveProduct = async (id: number) => { await api.delete(`${ws()}/products/${id}`); };
export const getCategories = async () => (await api.get<Category[]>(`${ws()}/categories`)).data;
export const createCategory = async (name: string) => (await api.post<Category>(`${ws()}/categories`, { name })).data;

// --- Transactions ---
export const createTransaction = async (transaction: { payment_method: string; items: { product_id: number; quantity: number }[] }) =>
  (await api.post<Transaction>(`${ws()}/transactions`, transaction)).data;
export const getTransactions = async (params: { start_date?: string; end_date?: string; payment_method?: string } = {}) =>
  (await api.get<Transaction[]>(`${ws()}/transactions`, { params })).data;

// --- Imports ---
export async function uploadImportFile(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return (await api.post<UploadPreview>(`${ws()}/imports/upload`, formData)).data;
}
export const validateImportMapping = async (jobId: number, mapping: ColumnMapping) =>
  (await api.post<ImportJob>(`${ws()}/imports/${jobId}/validate`, mapping)).data;
export const confirmImport = async (jobId: number, mapping: ColumnMapping) =>
  (await api.post<{ imported_rows: number; skipped_rows: number }>(`${ws()}/imports/${jobId}/confirm`, mapping)).data;
export const getImports = async () => (await api.get<ImportJob[]>(`${ws()}/imports`)).data;

// --- Purchases ---
export const getPurchases = async () => (await api.get<Purchase[]>(`${ws()}/purchases`)).data;
export const createPurchase = async (purchase: PurchaseInput) => (await api.post<Purchase>(`${ws()}/purchases`, purchase)).data;

// --- Inventory ---
export const adjustInventory = async (productId: number, adjust: { actual_stock: number; reason: string }) =>
  (await api.post(`${ws()}/inventory/adjust`, adjust, { params: { product_id: productId } })).data;
export const getMovements = async (productId?: number) =>
  (await api.get<InventoryMovement[]>(`${ws()}/inventory/movements`, { params: { product_id: productId } })).data;
