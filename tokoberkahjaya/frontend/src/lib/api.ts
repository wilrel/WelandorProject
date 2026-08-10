import axios from 'axios';

const API_URL = 'http://localhost:8000/api';

export const WORKSPACE_ID = 1;

export const api = axios.create({
  baseURL: API_URL,
});

export const initAuth = async () => {
  try {
    const params = new URLSearchParams();
    params.append('username', 'admin@toko.com');
    params.append('password', 'password');
    const res = await axios.post(`${API_URL}/auth/login`, params);
    api.defaults.headers.common['Authorization'] = `Bearer ${res.data.access_token}`;
    return true;
  } catch (error) {
    console.error("Login failed", error);
    return false;
  }
};

export const getProducts = async () => {
  const res = await api.get(`/workspaces/${WORKSPACE_ID}/products`);
  return res.data;
};

export const createProduct = async (product: any) => {
  const res = await api.post(`/products?workspace_id=${WORKSPACE_ID}`, product);
  return res.data;
};

export const createTransaction = async (transaction: any) => {
  const res = await api.post(`/workspaces/${WORKSPACE_ID}/transactions`, transaction);
  return res.data;
};

export const uploadImportFile = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post(`/workspaces/${WORKSPACE_ID}/imports/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return res.data;
};

export const validateImportMapping = async (jobId: number, mapping: any) => {
  const res = await api.post(`/workspaces/${WORKSPACE_ID}/imports/${jobId}/validate`, mapping);
  return res.data;
};

export const confirmImport = async (jobId: number, mapping: any) => {
  const res = await api.post(`/workspaces/${WORKSPACE_ID}/imports/${jobId}/confirm`, mapping);
  return res.data;
};

export const getImports = async () => {
  const res = await api.get(`/workspaces/${WORKSPACE_ID}/imports`);
  return res.data;
};

export const getPurchases = async () => {
  const res = await api.get(`/workspaces/${WORKSPACE_ID}/purchases`);
  return res.data;
};

export const createPurchase = async (purchase: any) => {
  const res = await api.post(`/workspaces/${WORKSPACE_ID}/purchases`, purchase);
  return res.data;
};

export const adjustInventory = async (productId: number, adjust: any) => {
  const res = await api.post(`/workspaces/${WORKSPACE_ID}/inventory/adjust?product_id=${productId}`, adjust);
  return res.data;
};
