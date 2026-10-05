'use client';

import { useMemo, useState } from 'react';
import { Archive, Package, Pencil, Plus, Search } from 'lucide-react';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, Table, Td, Th } from '@/components/ui';
import { useToast } from '@/components/Toast';
import {
  archiveProduct, createCategory, createProduct, getCategories, getErrorMessage, getProducts, updateProduct,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useResource } from '@/lib/useResource';
import { formatNumber, formatRupiah } from '@/lib/format';
import type { Category, Product, ProductInput } from '@/lib/types';

const UNITS = ['pcs', 'kg', 'gram', 'liter', 'botol', 'sak', 'dus', 'pak', 'renteng'];

const emptyForm = {
  sku: '', name: '', unit: 'pcs', selling_price: '', current_hpp: '', current_stock: '0', category_id: '', is_active: true,
};
type FormState = typeof emptyForm;

export default function ProductsPage() {
  const { canManage } = useAuth();
  const notify = useToast();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const [editing, setEditing] = useState<Product | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [newCategory, setNewCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState<Product | null>(null);

  const { data, loading, reload } = useResource(
    () => Promise.all([getProducts(showArchived), getCategories()]),
    [showArchived],
    (e) => notify(getErrorMessage(e), 'error'),
  );
  const products: Product[] = useMemo(() => data?.[0] ?? [], [data]);
  const categories: Category[] = useMemo(() => data?.[1] ?? [], [data]);

  const categoryName = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c.name])), [categories]);

  const filtered = products.filter((p) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
    const matchesCategory = !categoryFilter || String(p.category_id ?? '') === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setNewCategory('');
    setFormOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      sku: p.sku, name: p.name, unit: p.unit,
      selling_price: String(p.selling_price), current_hpp: String(p.current_hpp),
      current_stock: String(p.current_stock), category_id: p.category_id ? String(p.category_id) : '', is_active: p.is_active,
    });
    setNewCategory('');
    setFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      let categoryId = form.category_id ? Number(form.category_id) : null;
      if (form.category_id === '__new' ) {
        if (!newCategory.trim()) throw new Error('Nama kategori baru belum diisi');
        const created = await createCategory(newCategory.trim());
        categoryId = created.id;
      }
      const payload: ProductInput = {
        sku: form.sku.trim(),
        name: form.name.trim(),
        unit: form.unit.trim(),
        selling_price: Number(form.selling_price) || 0,
        current_hpp: Number(form.current_hpp) || 0,
        is_active: form.is_active,
        category_id: categoryId,
      };
      if (editing) {
        await updateProduct(editing.id, payload);
        notify(`Produk ${payload.name} diperbarui`);
      } else {
        await createProduct({ ...payload, current_stock: Number(form.current_stock) || 0 });
        notify(`Produk ${payload.name} ditambahkan`);
      }
      setFormOpen(false);
      reload();
    } catch (err) {
      notify(getErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!archiving) return;
    try {
      await archiveProduct(archiving.id);
      notify(`${archiving.name} diarsipkan`);
      setArchiving(null);
      reload();
    } catch (err) {
      notify(getErrorMessage(err), 'error');
    }
  };

  const price = Number(form.selling_price) || 0;
  const hpp = Number(form.current_hpp) || 0;
  const marginPct = price > 0 ? ((price - hpp) / price) * 100 : 0;

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Produk"
        description="Kelola katalog, harga jual, dan HPP produk toko."
        actions={canManage && <Button icon={Plus} onClick={openCreate}>Tambah Produk</Button>}
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" placeholder="Cari nama atau SKU..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select className="sm:w-48" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} aria-label="Filter kategori">
            <option value="">Semua kategori</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" className="rounded border-slate-300" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            Tampilkan arsip
          </label>
        </div>

        {loading && !data ? <Spinner /> : filtered.length === 0 ? (
          <EmptyState
            icon={Package}
            title={products.length === 0 ? 'Belum ada produk' : 'Produk tidak ditemukan'}
            description={products.length === 0 ? 'Tambahkan produk pertama untuk mulai berjualan.' : 'Coba kata kunci atau filter lain.'}
            action={products.length === 0 && canManage && <Button icon={Plus} onClick={openCreate}>Tambah Produk</Button>}
          />
        ) : (
          <Table head={
            <tr>
              <Th>SKU</Th><Th>Nama Produk</Th><Th>Kategori</Th><Th align="right">Stok</Th>
              <Th align="right">HPP</Th><Th align="right">Harga Jual</Th><Th align="right">Margin</Th>
              {canManage && <Th align="right">Aksi</Th>}
            </tr>
          }>
            {filtered.map((p) => {
              const margin = p.selling_price > 0 ? ((p.selling_price - p.current_hpp) / p.selling_price) * 100 : 0;
              return (
                <tr key={p.id} className="hover:bg-slate-50">
                  <Td className="font-mono text-xs text-slate-500">{p.sku}</Td>
                  <Td className="font-medium text-slate-900">
                    {p.name} {!p.is_active && <span className="ml-1"><Badge>Arsip</Badge></span>}
                  </Td>
                  <Td>{p.category_id ? categoryName[p.category_id] : <span className="text-slate-400">-</span>}</Td>
                  <Td align="right">
                    <Badge tone={p.current_stock <= 0 ? 'red' : p.current_stock <= 5 ? 'yellow' : 'green'}>
                      {formatNumber(p.current_stock)} {p.unit}
                    </Badge>
                  </Td>
                  <Td align="right">{formatRupiah(p.current_hpp)}</Td>
                  <Td align="right" className="font-medium text-slate-900">{formatRupiah(p.selling_price)}</Td>
                  <Td align="right" className={margin < 0 ? 'text-red-600' : ''}>{margin.toFixed(1)}%</Td>
                  {canManage && (
                    <Td align="right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" icon={Pencil} onClick={() => openEdit(p)} aria-label={`Ubah ${p.name}`}>Ubah</Button>
                        {p.is_active && (
                          <Button variant="ghost" size="sm" icon={Archive} onClick={() => setArchiving(p)} aria-label={`Arsipkan ${p.name}`} />
                        )}
                      </div>
                    </Td>
                  )}
                </tr>
              );
            })}
          </Table>
        )}
      </Card>

      <Modal
        open={formOpen}
        size="lg"
        title={editing ? 'Ubah Produk' : 'Tambah Produk'}
        onClose={() => setFormOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>Batal</Button>
            <Button type="submit" form="product-form" loading={saving}>{editing ? 'Simpan Perubahan' : 'Tambah Produk'}</Button>
          </>
        }
      >
        <form id="product-form" onSubmit={handleSave} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="SKU / Kode" required>
            <Input required value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="BRS-5KG" />
          </Field>
          <Field label="Satuan" required>
            <Input required list="unit-options" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            <datalist id="unit-options">{UNITS.map((u) => <option key={u} value={u} />)}</datalist>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Nama produk" required>
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Beras Sania 5kg" />
            </Field>
          </div>
          <Field label="Kategori">
            <Select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
              <option value="">Tanpa kategori</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              <option value="__new">+ Kategori baru...</option>
            </Select>
          </Field>
          {form.category_id === '__new' ? (
            <Field label="Nama kategori baru" required>
              <Input required value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Minuman" />
            </Field>
          ) : <div className="hidden sm:block" />}
          <Field label="HPP (harga modal)" required hint={editing ? 'Otomatis diperbarui dari pembelian' : undefined}>
            <Input required type="number" min="0" step="any" value={form.current_hpp} onChange={(e) => setForm({ ...form, current_hpp: e.target.value })} placeholder="0" />
          </Field>
          <Field label="Harga jual" required hint={price > 0 ? `Margin ${marginPct.toFixed(1)}%` : undefined}>
            <Input required type="number" min="0" step="any" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: e.target.value })} placeholder="0" />
          </Field>
          {editing ? (
            <div className="sm:col-span-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
              Stok saat ini <strong>{formatNumber(editing.current_stock)} {editing.unit}</strong>. Ubah stok lewat menu Pembelian atau Stock Opname di Inventori agar tercatat di riwayat.
            </div>
          ) : (
            <Field label="Stok awal" hint="Dicatat sebagai stok pembukaan">
              <Input type="number" min="0" value={form.current_stock} onChange={(e) => setForm({ ...form, current_stock: e.target.value })} />
            </Field>
          )}
          {editing && (
            <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
              <input type="checkbox" className="rounded border-slate-300" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              Produk aktif (tampil di kasir)
            </label>
          )}
        </form>
      </Modal>

      <Modal
        open={!!archiving}
        title="Arsipkan produk?"
        onClose={() => setArchiving(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setArchiving(null)}>Batal</Button>
            <Button variant="danger" onClick={handleArchive}>Arsipkan</Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          <strong>{archiving?.name}</strong> tidak akan tampil lagi di kasir. Riwayat penjualan tetap tersimpan dan produk dapat diaktifkan kembali kapan saja.
        </p>
      </Modal>
    </div>
  );
}
