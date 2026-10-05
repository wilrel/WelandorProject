'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, Banknote, Boxes, History, PackageX, Search, Settings2 } from 'lucide-react';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, StatCard, Table, Td, Th, cx } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { adjustInventory, getErrorMessage, getMovements, getProducts } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useResource } from '@/lib/useResource';
import { formatDateTime, formatNumber, formatRupiah } from '@/lib/format';
import type { InventoryMovement, MovementType, Product } from '@/lib/types';

const MOVEMENT_LABELS: Record<MovementType, { label: string; tone: 'green' | 'red' | 'yellow' | 'blue' | 'gray' }> = {
  OPENING: { label: 'Stok awal', tone: 'gray' },
  PURCHASE: { label: 'Pembelian', tone: 'green' },
  SALE: { label: 'Penjualan', tone: 'blue' },
  ADJUSTMENT: { label: 'Penyesuaian', tone: 'yellow' },
  STOCKTAKE: { label: 'Stock opname', tone: 'yellow' },
};

export default function InventoryPage() {
  const { canManage } = useAuth();
  const notify = useToast();
  const [tab, setTab] = useState<'stock' | 'history'>('stock');
  const [search, setSearch] = useState('');
  const [onlyLow, setOnlyLow] = useState(false);
  const [historyProduct, setHistoryProduct] = useState('');

  const [adjusting, setAdjusting] = useState<Product | null>(null);
  const [actualStock, setActualStock] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onError = (e: unknown) => notify(getErrorMessage(e), 'error');
  const productsRes = useResource(() => getProducts(), [], onError);
  const movementsRes = useResource(
    () => (tab === 'history' ? getMovements(historyProduct ? Number(historyProduct) : undefined) : Promise.resolve(null)),
    [tab, historyProduct],
    onError,
  );
  const products: Product[] = useMemo(() => productsRes.data ?? [], [productsRes.data]);
  const movements: InventoryMovement[] = movementsRes.data ?? [];
  const loading = tab === 'stock' ? productsRes.loading && !productsRes.data : movementsRes.loading;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) =>
      (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)) && (!onlyLow || p.current_stock <= 5));
  }, [products, search, onlyLow]);

  const totalValue = products.reduce((s, p) => s + Math.max(p.current_stock, 0) * p.current_hpp, 0);
  const lowCount = products.filter((p) => p.current_stock <= 5).length;

  const openAdjust = (p: Product) => {
    setAdjusting(p);
    setActualStock(String(p.current_stock));
    setReason('');
  };

  const diff = adjusting && actualStock !== '' ? Number(actualStock) - adjusting.current_stock : 0;

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjusting || actualStock === '' || diff === 0) return;
    setSubmitting(true);
    try {
      await adjustInventory(adjusting.id, { actual_stock: Number(actualStock), reason: reason.trim() || 'Stock Opname' });
      notify(`Stok ${adjusting.name} disesuaikan menjadi ${actualStock}`);
      setAdjusting(null);
      productsRes.reload();
      if (tab === 'history') movementsRes.reload();
    } catch (err) {
      notify(getErrorMessage(err), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <PageHeader title="Inventori" description="Pantau stok, nilai persediaan, dan riwayat mutasi barang." />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={Banknote} label="Nilai persediaan" value={formatRupiah(totalValue)} hint="Stok × HPP" />
        <StatCard icon={Boxes} label="Produk aktif" value={formatNumber(products.length)} />
        <StatCard icon={PackageX} label="Stok menipis / habis" value={formatNumber(lowCount)} hint="Stok ≤ 5" />
      </div>

      <div className="mb-4 inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-sm shadow-sm">
        {([['stock', 'Stok Produk', Boxes], ['history', 'Riwayat Mutasi', History]] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cx('flex items-center gap-2 rounded-md px-4 py-1.5 font-medium transition-colors', tab === key ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-800')}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === 'stock' ? (
        <Card>
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input className="pl-9" placeholder="Cari nama atau SKU..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" className="rounded border-slate-300" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} />
              Hanya stok menipis
            </label>
          </div>
          {loading ? <Spinner /> : filtered.length === 0 ? (
            <EmptyState icon={Boxes} title="Tidak ada produk" />
          ) : (
            <Table head={
              <tr>
                <Th>SKU</Th><Th>Produk</Th><Th align="right">Stok Sistem</Th><Th align="right">HPP</Th><Th align="right">Nilai Persediaan</Th>
                {canManage && <Th align="right">Aksi</Th>}
              </tr>
            }>
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <Td className="font-mono text-xs text-slate-500">{p.sku}</Td>
                  <Td className="font-medium text-slate-900">{p.name}</Td>
                  <Td align="right">
                    <Badge tone={p.current_stock <= 0 ? 'red' : p.current_stock <= 5 ? 'yellow' : 'green'}>{formatNumber(p.current_stock)} {p.unit}</Badge>
                  </Td>
                  <Td align="right">{formatRupiah(p.current_hpp)}</Td>
                  <Td align="right" className="font-medium text-slate-900">{formatRupiah(Math.max(p.current_stock, 0) * p.current_hpp)}</Td>
                  {canManage && (
                    <Td align="right">
                      <Button variant="ghost" size="sm" icon={Settings2} onClick={() => openAdjust(p)}>Stock Opname</Button>
                    </Td>
                  )}
                </tr>
              ))}
            </Table>
          )}
        </Card>
      ) : (
        <Card>
          <div className="border-b border-slate-200 p-4">
            <Select className="sm:w-72" value={historyProduct} onChange={(e) => setHistoryProduct(e.target.value)} aria-label="Filter produk">
              <option value="">Semua produk</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
            </Select>
          </div>
          {loading ? <Spinner /> : movements.length === 0 ? (
            <EmptyState icon={History} title="Belum ada mutasi stok" />
          ) : (
            <Table head={
              <tr><Th>Waktu</Th><Th>Produk</Th><Th>Jenis</Th><Th align="right">Perubahan</Th><Th align="right">Stok</Th><Th>Referensi</Th></tr>
            }>
              {movements.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <Td>{formatDateTime(m.timestamp)}</Td>
                  <Td>
                    <span className="font-medium text-slate-900">{m.product_name}</span>
                    <span className="ml-2 font-mono text-xs text-slate-400">{m.product_sku}</span>
                  </Td>
                  <Td><Badge tone={MOVEMENT_LABELS[m.type]?.tone ?? 'gray'}>{MOVEMENT_LABELS[m.type]?.label ?? m.type}</Badge></Td>
                  <Td align="right" className={cx('font-medium', m.quantity > 0 ? 'text-emerald-600' : 'text-red-600')}>
                    {m.quantity > 0 ? '+' : ''}{formatNumber(m.quantity)}
                  </Td>
                  <Td align="right" className="text-slate-500">{formatNumber(m.previous_stock)} → <span className="font-medium text-slate-900">{formatNumber(m.new_stock)}</span></Td>
                  <Td className="text-slate-500">{m.reference_id ?? '-'}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      )}

      <Modal
        open={!!adjusting}
        title="Stock Opname"
        onClose={() => setAdjusting(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAdjusting(null)}>Batal</Button>
            <Button type="submit" form="adjust-form" loading={submitting} disabled={actualStock === '' || diff === 0}>Simpan Penyesuaian</Button>
          </>
        }
      >
        {adjusting && (
          <form id="adjust-form" onSubmit={handleAdjust} className="space-y-4">
            <div className="grid grid-cols-2 gap-4 rounded-lg bg-slate-50 p-3 text-sm">
              <div><p className="text-slate-500">Produk</p><p className="font-medium text-slate-900">{adjusting.name}</p></div>
              <div><p className="text-slate-500">Stok sistem</p><p className="font-semibold text-slate-900">{formatNumber(adjusting.current_stock)} {adjusting.unit}</p></div>
            </div>
            <Field label="Stok fisik sebenarnya" required>
              <Input type="number" min={0} required autoFocus value={actualStock} onChange={(e) => setActualStock(e.target.value)} />
            </Field>
            {diff !== 0 && (
              <div className={cx('flex gap-2 rounded-lg p-3 text-sm', diff < 0 ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-800')}>
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <p>Selisih <strong>{diff > 0 ? '+' : ''}{formatNumber(diff)} {adjusting.unit}</strong> (senilai {formatRupiah(Math.abs(diff) * adjusting.current_hpp)}) akan dicatat sebagai penyesuaian.</p>
              </div>
            )}
            <Field label="Alasan">
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Contoh: Rusak, Kedaluwarsa, Opname bulanan" maxLength={200} />
            </Field>
          </form>
        )}
      </Modal>
    </div>
  );
}
