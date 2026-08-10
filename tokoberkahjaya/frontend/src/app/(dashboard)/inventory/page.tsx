'use client';

import { useState, useEffect } from 'react';
import { getProducts, adjustInventory, initAuth } from '@/lib/api';
import { Settings2, X, AlertTriangle } from 'lucide-react';

export default function InventoryPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adjustingProduct, setAdjustingProduct] = useState<any | null>(null);
  const [actualStock, setActualStock] = useState<number | ''>('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    setLoading(true);
    await initAuth();
    try {
      const data = await getProducts();
      setProducts(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct || actualStock === '') return;
    if (actualStock === adjustingProduct.current_stock) {
      alert("Actual stock is same as system stock. No adjustment needed.");
      return;
    }
    
    setSubmitting(true);
    try {
      await adjustInventory(adjustingProduct.id, {
        actual_stock: Number(actualStock),
        reason: reason || 'Stock Opname'
      });
      setAdjustingProduct(null);
      setActualStock('');
      setReason('');
      await loadProducts();
    } catch (e: any) {
      alert("Failed to adjust inventory: " + (e.response?.data?.detail || e.message));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-8 relative">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Inventory & Stock Opname</h1>
        <p className="text-gray-500 text-sm mt-1">Manage physical stock discrepancies and monitor current asset value.</p>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">System Stock</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current HPP</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Asset Value</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={6} className="px-6 py-4 text-center text-gray-500">Loading...</td></tr>
            ) : products.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-4 text-center text-gray-500">No products found.</td></tr>
            ) : (
              products.map((p) => {
                const assetValue = p.current_stock * p.current_hpp;
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{p.sku}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-sm font-medium ${p.current_stock <= 5 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                        {p.current_stock} {p.unit}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      Rp {p.current_hpp.toLocaleString('id-ID')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      Rp {assetValue.toLocaleString('id-ID')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button 
                        onClick={() => { setAdjustingProduct(p); setActualStock(p.current_stock); }}
                        className="text-indigo-600 hover:text-indigo-900 flex items-center justify-end w-full"
                      >
                        <Settings2 className="w-4 h-4 mr-1" /> Adjust
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Adjust Modal */}
      {adjustingProduct && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-medium text-gray-900">Stock Opname</h3>
              <button onClick={() => setAdjustingProduct(null)} className="text-gray-400 hover:text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAdjustSubmit} className="px-6 py-4">
              <div className="mb-4">
                <p className="text-sm text-gray-500 mb-1">Product</p>
                <p className="font-medium text-gray-900">{adjustingProduct.name} ({adjustingProduct.sku})</p>
              </div>
              <div className="mb-4">
                <p className="text-sm text-gray-500 mb-1">System Stock</p>
                <p className="font-bold text-gray-900">{adjustingProduct.current_stock} {adjustingProduct.unit}</p>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Actual Physical Stock</label>
                <input 
                  type="number" min="0" required
                  className="w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500"
                  value={actualStock}
                  onChange={(e) => setActualStock(e.target.value ? Number(e.target.value) : '')}
                />
              </div>
              
              {actualStock !== '' && Number(actualStock) !== adjustingProduct.current_stock && (
                <div className={`mb-4 p-3 rounded-md flex text-sm ${Number(actualStock) < adjustingProduct.current_stock ? 'bg-red-50 text-red-800' : 'bg-yellow-50 text-yellow-800'}`}>
                  <AlertTriangle className="w-5 h-5 mr-2 flex-shrink-0" />
                  <p>
                    Difference: <strong>{Number(actualStock) - adjustingProduct.current_stock} {adjustingProduct.unit}</strong>. 
                    This will be recorded as an adjustment.
                  </p>
                </div>
              )}

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason (Optional)</label>
                <input 
                  type="text" 
                  placeholder="e.g. Broken, Expired, Stock Opname 2026"
                  className="w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button type="button" onClick={() => setAdjustingProduct(null)} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={submitting || actualStock === '' || Number(actualStock) === adjustingProduct.current_stock} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-gray-300">
                  {submitting ? 'Saving...' : 'Confirm Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
