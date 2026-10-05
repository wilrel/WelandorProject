'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Plus, Trash2 } from 'lucide-react';
import { Button, Card, Field, Input, PageHeader, Select, Spinner } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { createPurchase, getErrorMessage, getProducts } from '@/lib/api';
import { formatNumber, formatRupiah } from '@/lib/format';
import type { Product } from '@/lib/types';
import { useResource } from '@/lib/useResource';

interface Line { key: number; product_id: string; quantity: string; unit_cost: string }

let lineKey = 0;
const newLine = (): Line => ({ key: ++lineKey, product_id: '', quantity: '1', unit_cost: '' });

export default function NewPurchasePage() {
  const router = useRouter();
  const notify = useToast();
  const [supplierName, setSupplierName] = useState('');
  const [lines, setLines] = useState<Line[]>([newLine()]);
  const [saving, setSaving] = useState(false);

  const { data, loading } = useResource(() => getProducts(), [], (e) => notify(getErrorMessage(e), 'error'));
  const products: Product[] = data ?? [];

  const productById = Object.fromEntries(products.map((p) => [String(p.id), p]));

  const updateLine = (key: number, patch: Partial<Line>) => {
    setLines(lines.map((l) => {
      if (l.key !== key) return l;
      const next = { ...l, ...patch };
      // Pre-fill the cost with the current HPP when a product is picked.
      if (patch.product_id && !l.unit_cost) next.unit_cost = String(productById[patch.product_id]?.current_hpp ?? '');
      return next;
    }));
  };

  const validLines = lines.filter((l) => l.product_id && Number(l.quantity) > 0 && l.unit_cost !== '');
  const total = validLines.reduce((s, l) => s + Number(l.quantity) * Number(l.unit_cost), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validLines.length === 0) return notify('Tambahkan minimal satu produk dengan jumlah dan harga beli.', 'error');
    if (validLines.length !== lines.length) return notify('Lengkapi atau hapus baris yang masih kosong.', 'error');
    setSaving(true);
    try {
      await createPurchase({
        supplier_name: supplierName.trim() || null,
        items: validLines.map((l) => ({ product_id: Number(l.product_id), quantity: Number(l.quantity), unit_cost: Number(l.unit_cost) })),
      });
      notify('Pembelian tersimpan. Stok dan HPP telah diperbarui.');
      router.push('/purchases');
    } catch (err) {
      notify(getErrorMessage(err), 'error');
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
      <Link href="/purchases" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Kembali ke Pembelian
      </Link>
      <PageHeader title="Pembelian Baru" description="Catat barang masuk. HPP dihitung ulang dengan metode rata-rata bergerak." />

      {loading ? <Card><Spinner /></Card> : (
        <form onSubmit={handleSubmit}>
          <Card>
            <div className="border-b border-slate-200 p-5">
              <div className="max-w-md">
                <Field label="Nama supplier">
                  <Input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="Contoh: PT Distributor Sembako" />
                </Field>
              </div>
            </div>

            <div className="space-y-3 bg-slate-50 p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-900">Daftar barang</h3>
                <Button type="button" variant="secondary" size="sm" icon={Plus} onClick={() => setLines([...lines, newLine()])}>Tambah Baris</Button>
              </div>

              {lines.map((line) => {
                const product = productById[line.product_id];
                const subtotal = (Number(line.quantity) || 0) * (Number(line.unit_cost) || 0);
                const costChange = product && line.unit_cost !== '' ? Number(line.unit_cost) - product.current_hpp : 0;
                return (
                  <div key={line.key} className="grid grid-cols-1 items-end gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-12">
                    <div className="sm:col-span-5">
                      <Field label="Produk">
                        <Select value={line.product_id} onChange={(e) => updateLine(line.key, { product_id: e.target.value })} required>
                          <option value="">Pilih produk...</option>
                          {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
                        </Select>
                      </Field>
                    </div>
                    <div className="sm:col-span-2">
                      <Field label={`Jumlah${product ? ` (${product.unit})` : ''}`}>
                        <Input type="number" min={1} required value={line.quantity} onChange={(e) => updateLine(line.key, { quantity: e.target.value })} />
                      </Field>
                    </div>
                    <div className="sm:col-span-2">
                      <Field label="Harga beli / unit">
                        <Input type="number" min={0} step="any" required value={line.unit_cost} onChange={(e) => updateLine(line.key, { unit_cost: e.target.value })} />
                      </Field>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="mb-1 text-sm font-medium text-slate-700">Subtotal</p>
                      <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">{formatRupiah(subtotal)}</p>
                    </div>
                    <div className="sm:col-span-1 sm:text-right">
                      <Button type="button" variant="ghost" icon={Trash2} onClick={() => setLines(lines.filter((l) => l.key !== line.key))} disabled={lines.length === 1} aria-label="Hapus baris" />
                    </div>
                    {product && (
                      <p className="text-xs text-slate-500 sm:col-span-12">
                        Stok saat ini {formatNumber(product.current_stock)} {product.unit} · HPP {formatRupiah(product.current_hpp)}
                        {costChange !== 0 && (
                          <span className={costChange > 0 ? 'text-amber-600' : 'text-emerald-600'}> · harga beli {costChange > 0 ? 'naik' : 'turun'} {formatRupiah(Math.abs(costChange))}</span>
                        )}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col gap-4 border-t border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-slate-500">Total pembelian</p>
                <p className="text-2xl font-semibold text-slate-900">{formatRupiah(total)}</p>
              </div>
              <Button type="submit" variant="success" size="lg" icon={CheckCircle2} loading={saving}>Simpan Pembelian</Button>
            </div>
          </Card>
        </form>
      )}
    </div>
  );
}
