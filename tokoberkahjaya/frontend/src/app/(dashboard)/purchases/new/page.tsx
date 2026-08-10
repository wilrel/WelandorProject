'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getProducts, createPurchase, initAuth } from '@/lib/api';
import { Plus, Trash2, CheckCircle } from 'lucide-react';

export default function NewPurchasePage() {
  const router = useRouter();
  const [products, setProducts] = useState<any[]>([]);
  const [supplierName, setSupplierName] = useState('');
  const [items, setItems] = useState<{product_id: number, quantity: number, unit_cost: number}[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      await initAuth();
      const data = await getProducts();
      setProducts(data);
    }
    load();
  }, []);

  const addItem = () => {
    if (products.length === 0) return;
    setItems([...items, { product_id: products[0].id, quantity: 1, unit_cost: 0 }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: string, value: number) => {
    const newItems = [...items];
    (newItems[index] as any)[field] = value;
    setItems(newItems);
  };

  const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unit_cost), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return alert("Please add at least one item.");
    
    setLoading(true);
    try {
      await createPurchase({
        supplier_name: supplierName,
        items: items
      });
      router.push('/purchases');
    } catch (e: any) {
      alert("Failed to create purchase: " + (e.response?.data?.detail || e.message));
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">New Purchase (Restock)</h1>
        <p className="text-gray-500 text-sm mt-1">Record incoming stock. This will update the current HPP automatically.</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-1">Supplier Name</label>
          <input 
            type="text" 
            className="w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500"
            value={supplierName}
            onChange={e => setSupplierName(e.target.value)}
            placeholder="e.g. PT Distributor Sembako"
          />
        </div>

        <div className="p-6 bg-gray-50">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">Items</h3>
            <button type="button" onClick={addItem} className="text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-md hover:bg-indigo-100 flex items-center text-sm font-medium">
              <Plus className="w-4 h-4 mr-1" /> Add Item
            </button>
          </div>

          <div className="space-y-4">
            {items.map((item, index) => (
              <div key={index} className="flex space-x-4 items-end bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Product</label>
                  <select 
                    className="w-full border border-gray-300 rounded-md py-2 px-3 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                    value={item.product_id}
                    onChange={e => updateItem(index, 'product_id', parseInt(e.target.value))}
                  >
                    {products.map(p => <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>)}
                  </select>
                </div>
                <div className="w-24">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Qty</label>
                  <input 
                    type="number" min="1"
                    className="w-full border border-gray-300 rounded-md py-2 px-3 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                    value={item.quantity}
                    onChange={e => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="w-40">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Unit Cost (Rp)</label>
                  <input 
                    type="number" min="0"
                    className="w-full border border-gray-300 rounded-md py-2 px-3 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                    value={item.unit_cost}
                    onChange={e => updateItem(index, 'unit_cost', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="w-32">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Subtotal</label>
                  <div className="py-2 px-3 text-sm font-semibold bg-gray-50 rounded-md border border-gray-100">
                    {(item.quantity * item.unit_cost).toLocaleString('id-ID')}
                  </div>
                </div>
                <button type="button" onClick={() => removeItem(index)} className="p-2 text-gray-400 hover:text-red-500 mb-0.5">
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
            
            {items.length === 0 && (
              <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg bg-white">
                No items added yet.
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-between items-center bg-white">
          <div>
            <span className="text-sm text-gray-500">Total Purchase</span>
            <div className="text-2xl font-bold text-gray-900">Rp {totalAmount.toLocaleString('id-ID')}</div>
          </div>
          <button 
            type="submit"
            disabled={loading || items.length === 0}
            className="bg-green-600 text-white px-6 py-2.5 rounded-md hover:bg-green-700 disabled:bg-gray-300 flex items-center font-medium transition"
          >
            {loading ? "Saving..." : "Save Purchase"} <CheckCircle className="w-5 h-5 ml-2" />
          </button>
        </div>
      </form>
    </div>
  );
}
