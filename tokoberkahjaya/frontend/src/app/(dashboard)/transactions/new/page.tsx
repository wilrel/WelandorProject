'use client';

import { useMemo, useRef, useState } from 'react';
import { CheckCircle2, Minus, Package, Plus, Printer, Search, ShoppingCart, Trash2 } from 'lucide-react';
import { Button, EmptyState, Input, Modal, Spinner, cx } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { createTransaction, getErrorMessage, getProducts } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useResource } from '@/lib/useResource';
import { PAYMENT_LABELS, formatDateTime, formatNumber, formatRupiah } from '@/lib/format';
import type { PaymentMethod, Product, Transaction } from '@/lib/types';

interface CartLine { product: Product; quantity: number }

const PAYMENT_METHODS: PaymentMethod[] = ['CASH', 'QRIS', 'TRANSFER', 'DEBIT'];
const QUICK_CASH = [10000, 20000, 50000, 100000];

export default function POSTransactionPage() {
  const { workspace } = useAuth();
  const notify = useToast();
  const searchRef = useRef<HTMLInputElement>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [cashReceived, setCashReceived] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<{ trx: Transaction; paid: number } | null>(null);

  const { data, loading, reload: loadProducts } = useResource(() => getProducts(), [], (e) => notify(getErrorMessage(e), 'error'));
  const products: Product[] = useMemo(() => data ?? [], [data]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
  }, [products, search]);

  const addToCart = (product: Product) => {
    const existing = cart.find((line) => line.product.id === product.id);
    const nextQty = (existing?.quantity ?? 0) + 1;
    if (nextQty > product.current_stock) {
      notify(product.current_stock <= 0 ? `${product.name} sedang habis` : `Stok ${product.name} hanya ${product.current_stock}`, 'error');
      return;
    }
    setCart(existing
      ? cart.map((line) => line.product.id === product.id ? { ...line, quantity: nextQty } : line)
      : [...cart, { product, quantity: 1 }]);
  };

  const setQuantity = (productId: number, quantity: number) => {
    const line = cart.find((l) => l.product.id === productId);
    if (!line) return;
    if (quantity < 1) return setCart(cart.filter((l) => l.product.id !== productId));
    if (quantity > line.product.current_stock) {
      notify(`Stok ${line.product.name} hanya ${line.product.current_stock}`, 'error');
      quantity = line.product.current_stock;
    }
    setCart(cart.map((l) => l.product.id === productId ? { ...l, quantity } : l));
  };

  // Enter in the search box adds an exact SKU match (barcode scanner friendly) or the only result.
  const handleSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    const exact = products.find((p) => p.sku.toLowerCase() === search.trim().toLowerCase());
    const target = exact ?? (filteredProducts.length === 1 ? filteredProducts[0] : null);
    if (target) {
      addToCart(target);
      setSearch('');
    }
  };

  const totalItems = cart.reduce((sum, l) => sum + l.quantity, 0);
  const totalAmount = cart.reduce((sum, l) => sum + l.product.selling_price * l.quantity, 0);
  const paid = paymentMethod === 'CASH' ? Number(cashReceived) || 0 : totalAmount;
  const change = paid - totalAmount;
  const canCheckout = cart.length > 0 && (paymentMethod !== 'CASH' || paid >= totalAmount) && !submitting;

  const handleCheckout = async () => {
    if (!canCheckout) return;
    setSubmitting(true);
    try {
      const trx = await createTransaction({
        payment_method: paymentMethod,
        items: cart.map((l) => ({ product_id: l.product.id, quantity: l.quantity })),
      });
      setReceipt({ trx, paid });
      setCart([]);
      setCashReceived('');
      setPaymentMethod('CASH');
      loadProducts();
    } catch (e) {
      notify(getErrorMessage(e), 'error');
      loadProducts();
    } finally {
      setSubmitting(false);
    }
  };

  const closeReceipt = () => {
    setReceipt(null);
    searchRef.current?.focus();
  };

  return (
    <div className="flex h-full flex-col lg:flex-row">
      {/* Products */}
      <section className="flex min-h-0 flex-1 flex-col p-4 sm:p-6">
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <Input
            ref={searchRef}
            autoFocus
            className="py-3 pl-10 text-base"
            placeholder="Cari nama / scan SKU lalu tekan Enter..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleSearchKey}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading && !data ? <Spinner label="Memuat produk..." /> : filteredProducts.length === 0 ? (
            <EmptyState icon={Package} title="Produk tidak ditemukan" description="Periksa kata kunci atau tambahkan produk di menu Produk." />
          ) : (
            <div className="grid grid-cols-2 gap-3 pb-6 md:grid-cols-3 xl:grid-cols-4">
              {filteredProducts.map((product) => {
                const inCart = cart.find((l) => l.product.id === product.id)?.quantity ?? 0;
                const out = product.current_stock <= 0;
                return (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    disabled={out}
                    className={cx(
                      'relative rounded-xl border bg-white p-4 text-left shadow-sm transition-all',
                      out ? 'cursor-not-allowed opacity-50' : 'hover:border-indigo-400 hover:shadow-md active:scale-[0.98]',
                      inCart > 0 ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-slate-200',
                    )}
                  >
                    {inCart > 0 && (
                      <span className="absolute right-2 top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-xs font-semibold text-white">{inCart}</span>
                    )}
                    <p className="font-mono text-xs text-slate-400">{product.sku}</p>
                    <p className="mt-1 line-clamp-2 min-h-10 text-sm font-medium text-slate-900" title={product.name}>{product.name}</p>
                    <div className="mt-3 flex items-end justify-between gap-2">
                      <p className="font-semibold text-indigo-600">{formatRupiah(product.selling_price)}</p>
                      <p className={cx('text-xs', out ? 'font-semibold text-red-600' : product.current_stock <= 5 ? 'font-medium text-amber-600' : 'text-slate-500')}>
                        {out ? 'Habis' : `Stok ${formatNumber(product.current_stock)}`}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Cart */}
      <aside className="flex max-h-[60vh] flex-col border-t border-slate-200 bg-white lg:max-h-none lg:w-[400px] lg:border-l lg:border-t-0">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="flex items-center gap-2 font-semibold text-slate-900">
            <ShoppingCart className="h-5 w-5" /> Pesanan
            {totalItems > 0 && <span className="text-sm font-normal text-slate-500">({totalItems} item)</span>}
          </h2>
          {cart.length > 0 && (
            <button onClick={() => setCart([])} className="text-sm text-slate-500 hover:text-red-600">Kosongkan</button>
          )}
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
          {cart.length === 0 ? (
            <EmptyState icon={ShoppingCart} title="Keranjang kosong" description="Klik produk atau scan SKU untuk menambahkan." />
          ) : cart.map((line) => (
            <div key={line.product.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{line.product.name}</p>
                  <p className="text-xs text-slate-500">{formatRupiah(line.product.selling_price)} / {line.product.unit}</p>
                </div>
                <p className="text-sm font-semibold text-slate-900">{formatRupiah(line.product.selling_price * line.quantity)}</p>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center rounded-lg border border-slate-200">
                  <button onClick={() => setQuantity(line.product.id, line.quantity - 1)} className="p-1.5 text-slate-500 hover:text-indigo-600" aria-label="Kurangi"><Minus className="h-4 w-4" /></button>
                  <input
                    type="number"
                    min={1}
                    value={line.quantity}
                    onChange={(e) => setQuantity(line.product.id, Number(e.target.value) || 0)}
                    className="w-12 border-x border-slate-200 py-1 text-center text-sm font-medium focus:outline-none"
                    aria-label={`Jumlah ${line.product.name}`}
                  />
                  <button onClick={() => setQuantity(line.product.id, line.quantity + 1)} className="p-1.5 text-slate-500 hover:text-indigo-600" aria-label="Tambah"><Plus className="h-4 w-4" /></button>
                </div>
                <button onClick={() => setQuantity(line.product.id, 0)} className="p-1.5 text-slate-400 hover:text-red-600" aria-label={`Hapus ${line.product.name}`}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4 border-t border-slate-200 p-5">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Metode bayar</p>
            <div className="grid grid-cols-4 gap-2">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m}
                  onClick={() => setPaymentMethod(m)}
                  className={cx(
                    'rounded-lg border px-2 py-2 text-xs font-medium transition-colors',
                    paymentMethod === m ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                  )}
                >
                  {PAYMENT_LABELS[m]}
                </button>
              ))}
            </div>
          </div>

          {paymentMethod === 'CASH' && cart.length > 0 && (
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="cash">Uang diterima</label>
              <Input id="cash" type="number" min={0} value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} placeholder="0" />
              <div className="mt-2 flex flex-wrap gap-2">
                <button onClick={() => setCashReceived(String(totalAmount))} className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200">Uang pas</button>
                {QUICK_CASH.filter((v) => v >= totalAmount).slice(0, 3).map((v) => (
                  <button key={v} onClick={() => setCashReceived(String(v))} className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200">
                    {formatRupiah(v)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Total</span>
              <span className="text-2xl font-semibold text-slate-900">{formatRupiah(totalAmount)}</span>
            </div>
            {paymentMethod === 'CASH' && cashReceived !== '' && cart.length > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{change >= 0 ? 'Kembalian' : 'Kurang'}</span>
                <span className={cx('font-semibold', change >= 0 ? 'text-emerald-600' : 'text-red-600')}>{formatRupiah(Math.abs(change))}</span>
              </div>
            )}
          </div>

          <Button size="lg" className="w-full" onClick={handleCheckout} disabled={!canCheckout} loading={submitting}>
            Bayar {formatRupiah(totalAmount)}
          </Button>
        </div>
      </aside>

      <Modal
        open={!!receipt}
        title="Transaksi berhasil"
        onClose={closeReceipt}
        footer={
          <>
            <Button variant="secondary" icon={Printer} onClick={() => window.print()}>Cetak</Button>
            <Button onClick={closeReceipt}>Transaksi baru</Button>
          </>
        }
      >
        {receipt && (
          <div id="receipt" className="text-sm">
            <div className="mb-4 flex flex-col items-center text-center">
              <CheckCircle2 className="mb-2 h-10 w-10 text-emerald-500" />
              <p className="font-semibold text-slate-900">{workspace?.name}</p>
              {workspace?.address && <p className="text-xs text-slate-500">{workspace.address}</p>}
              <p className="mt-1 text-xs text-slate-500">No. TRX-{receipt.trx.id} · {formatDateTime(receipt.trx.timestamp)}</p>
            </div>
            <div className="space-y-1 border-y border-dashed border-slate-300 py-3">
              {receipt.trx.items.map((item) => (
                <div key={item.id} className="flex justify-between gap-4">
                  <span className="text-slate-700">{item.product_name} <span className="text-slate-400">× {item.quantity}</span></span>
                  <span className="text-slate-900">{formatRupiah(item.selling_price * item.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-1">
              <div className="flex justify-between font-semibold text-slate-900"><span>Total</span><span>{formatRupiah(receipt.trx.total_amount)}</span></div>
              <div className="flex justify-between text-slate-600"><span>{PAYMENT_LABELS[receipt.trx.payment_method]}</span><span>{formatRupiah(receipt.paid)}</span></div>
              {receipt.trx.payment_method === 'CASH' && (
                <div className="flex justify-between text-slate-600"><span>Kembalian</span><span>{formatRupiah(receipt.paid - receipt.trx.total_amount)}</span></div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
