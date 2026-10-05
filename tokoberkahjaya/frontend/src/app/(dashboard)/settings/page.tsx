'use client';

import { useState } from 'react';
import { LogOut, Save } from 'lucide-react';
import { Badge, Button, Card, Field, Input, PageHeader, Select } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { getErrorMessage, updateWorkspace } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import type { WorkspaceWithRole } from '@/lib/types';

const TIMEZONES = [
  { value: 'Asia/Jakarta', label: 'WIB (Asia/Jakarta)' },
  { value: 'Asia/Makassar', label: 'WITA (Asia/Makassar)' },
  { value: 'Asia/Jayapura', label: 'WIT (Asia/Jayapura)' },
];

const ROLE_LABELS: Record<string, string> = { OWNER: 'Pemilik', ADMIN: 'Admin', MANAGER: 'Manajer', CASHIER: 'Kasir' };

function StoreProfileForm({ workspace }: { workspace: WorkspaceWithRole }) {
  const { refresh } = useAuth();
  const notify = useToast();
  const canEdit = workspace.role === 'OWNER' || workspace.role === 'ADMIN';
  const [form, setForm] = useState({
    name: workspace.name, address: workspace.address ?? '', phone: workspace.phone ?? '', timezone: workspace.timezone,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateWorkspace({
        name: form.name.trim(),
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
        timezone: form.timezone,
        currency: workspace.currency,
        logo: workspace.logo,
      });
      await refresh();
      notify('Profil toko disimpan');
    } catch (err) {
      notify(getErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
        <Card>
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="font-semibold text-slate-900">Profil toko</h2>
            <p className="text-sm text-slate-500">Ditampilkan di struk dan laporan.</p>
          </div>
          <form onSubmit={handleSave} className="space-y-4 p-6">
            <Field label="Nama toko" required>
              <Input required minLength={2} disabled={!canEdit} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Alamat">
              <Input disabled={!canEdit} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Jl. Pasar Baru No. 12" />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="No. telepon">
                <Input disabled={!canEdit} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0812-xxxx-xxxx" />
              </Field>
              <Field label="Zona waktu" hint="Menentukan batas hari untuk laporan">
                <Select disabled={!canEdit} value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}>
                  {TIMEZONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </Select>
              </Field>
            </div>
            {canEdit ? (
              <div className="flex justify-end">
                <Button type="submit" icon={Save} loading={saving}>Simpan</Button>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Hanya pemilik atau admin yang dapat mengubah profil toko.</p>
            )}
          </form>
        </Card>
  );
}

export default function SettingsPage() {
  const { user, workspace, logout, selectWorkspace } = useAuth();
  const notify = useToast();

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
      <PageHeader title="Pengaturan" description="Profil toko dan informasi akun." />

      <div className="space-y-6">
        {workspace && <StoreProfileForm key={`${workspace.id}-${workspace.name}-${workspace.timezone}`} workspace={workspace} />}

        {user && user.workspaces.length > 1 && (
          <Card>
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="font-semibold text-slate-900">Toko aktif</h2>
            </div>
            <div className="p-6">
              <Select value={workspace?.id} onChange={(e) => { selectWorkspace(Number(e.target.value)); notify('Toko aktif diganti', 'info'); }}>
                {user.workspaces.map((w) => <option key={w.id} value={w.id}>{w.name} — {ROLE_LABELS[w.role]}</option>)}
              </Select>
            </div>
          </Card>
        )}

        <Card>
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="font-semibold text-slate-900">Akun</h2>
          </div>
          <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm">
              <p className="font-medium text-slate-900">{user?.email}</p>
              <p className="mt-1 flex items-center gap-2 text-slate-500">
                {workspace && <Badge tone="indigo">{ROLE_LABELS[workspace.role]}</Badge>}
                {user && <span>Terdaftar sejak {formatDate(user.created_at)}</span>}
              </p>
            </div>
            <Button variant="secondary" icon={LogOut} onClick={logout}>Keluar</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
