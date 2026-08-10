'use client';

import { useState, useEffect } from 'react';
import { getProducts, createTransaction, initAuth } from '@/lib/api';
import { Search, ShoppingCart, CheckCircle } from 'lucide-react';

export default function POSTransactionPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function load() {
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
    load();
  }, []);

  const addToCart = (product: any) => {
    if (product.current_stock <= 0) {
      alert("Out of stock!");
      return;
    }
    const existing = cart.find(item => item.product.id === product.id);
    if (existing) {
      if (existing.quantity >= product.current_stock) {
        alert("Cannot add more than current stock!");
        return;
      }
      setCart(cart.map(item => 
        item.product.id === product.id 
          ? { ...item, quantity: item.quantity + 1 } 
          : item
      ));
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
  };

  const updateQuantity = (productId: number, newQuantity: number) => {
    if (newQuantity < 1) return;
    const product = products.find(p => p.id === productId);
    if (product && newQuantity > product.current_stock) {
      alert("Cannot add more than current stock!");
      return;
    }
    setCart(cart.map(item => 
      item.product.id === productId ? { ...item, quantity: newQuantity } : item
    ));
  };

  const removeFromCart = (productId: number) => {
    setCart(cart.filter(item => item.product.id !== productId));
  };

  const totalAmount = cart.reduce((sum, item) => sum + (item.product.selling_price * item.quantity), 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    try {
      const payload = {
        payment_method: "CASH",
        items: cart.map(item => ({
          product_id: item.product.id,
          quantity: item.quantity
        }))
      };
      await createTransaction(payload);
      setSuccess(true);
      setCart([]);
      
      // Reload products to get updated stock
      const data = await getProducts();
      setProducts(data);
      
      setTimeout(() => setSuccess(false), 3000);
    } catch (e: any) {
      alert("Failed to checkout: " + e.response?.data?.detail || e.message);
    }
  };

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex h-full bg-gray-50">
      {/* Left side: Products */}
      <div className="flex-1 flex flex-col p-6 overflow-hidden">
        <div className="mb-6 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-lg"
            placeholder="Search by SKU or Name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p>Loading products...</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-20">
              {filteredProducts.map(product => (
                <div 
                  key={product.id} 
                  onClick={() => addToCart(product)}
                  className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 cursor-pointer hover:border-indigo-500 hover:shadow-md transition-all active:scale-95"
                >
                  <div className="text-sm text-gray-500 mb-1">{product.sku}</div>
                  <div className="font-semibold text-gray-900 mb-2 truncate" title={product.name}>{product.name}</div>
                  <div className="flex justify-between items-end mt-4">
                    <div className="font-bold text-indigo-600">Rp {product.selling_price.toLocaleString('id-ID')}</div>
                    <div className={`text-sm ${product.current_stock > 5 ? 'text-green-600' : 'text-red-600 font-bold'}`}>
                      Stock: {product.current_stock}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right side: Cart */}
      <div className="w-96 bg-white border-l border-gray-200 flex flex-col shadow-lg z-10">
        <div className="p-6 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900 flex items-center">
            <ShoppingCart className="mr-2" /> Current Order
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {success && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative flex items-center">
              <CheckCircle className="w-5 h-5 mr-2" /> Transaction Saved!
            </div>
          )}
          {cart.length === 0 ? (
            <div className="text-center text-gray-400 py-10 mt-10">
              <ShoppingCart className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>Cart is empty</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.product.id} className="flex flex-col bg-gray-50 p-3 rounded-lg border border-gray-100">
                <div className="flex justify-between mb-2">
                  <span className="font-medium text-gray-900 truncate">{item.product.name}</span>
                  <span className="font-semibold text-gray-900">
                    Rp {(item.product.selling_price * item.quantity).toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm text-gray-500">
                  <span>Rp {item.product.selling_price.toLocaleString('id-ID')} / {item.product.unit}</span>
                  <div className="flex items-center space-x-3 bg-white rounded-md border border-gray-200 p-1">
                    <button onClick={() => updateQuantity(item.product.id, item.quantity - 1)} className="px-2 hover:text-indigo-600">-</button>
                    <span className="font-semibold w-4 text-center">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.product.id, item.quantity + 1)} className="px-2 hover:text-indigo-600">+</button>
                    <button onClick={() => removeFromCart(item.product.id)} className="px-2 text-red-500 ml-2 border-l pl-2">x</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-6 border-t border-gray-200 bg-white shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)]">
          <div className="flex justify-between items-center mb-6">
            <span className="text-lg text-gray-600 font-medium">Total</span>
            <span className="text-3xl font-bold text-gray-900">Rp {totalAmount.toLocaleString('id-ID')}</span>
          </div>
          <button 
            onClick={handleCheckout}
            disabled={cart.length === 0}
            className={`w-full py-4 rounded-xl text-lg font-bold transition-all shadow-md active:scale-[0.98] ${
              cart.length === 0 
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none' 
                : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-lg'
            }`}
          >
            Charge Rp {totalAmount.toLocaleString('id-ID')}
          </button>
        </div>
      </div>
    </div>
  );
}
