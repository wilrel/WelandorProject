'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UserPlus } from 'lucide-react';
import AuthShell from '@/components/AuthShell';
import { Button, Field, Input } from '@/components/ui';
import { getErrorMessage, signup } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function RegisterPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [form, setForm] = useState({ storeName: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 6) return setError('Password minimal 6 karakter.');
    if (form.password !== form.confirm) return setError('Konfirmasi password tidak sama.');
    setSubmitting(true);
    try {
      await signup(form.email.trim(), form.password, form.storeName.trim());
      await refresh();
      router.replace('/');
    } catch (err) {
      setError(getErrorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <AuthShell title="Daftarkan toko Anda" subtitle="Buat akun pemilik dan toko pertama Anda.">
      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nama toko" required>
          <Input required minLength={2} value={form.storeName} onChange={update('storeName')} placeholder="Toko Berkah Jaya" />
        </Field>
        <Field label="Email" required>
          <Input type="email" autoComplete="email" required value={form.email} onChange={update('email')} placeholder="nama@toko.com" />
        </Field>
        <Field label="Password" hint="Minimal 6 karakter" required>
          <Input type="password" autoComplete="new-password" required value={form.password} onChange={update('password')} />
        </Field>
        <Field label="Konfirmasi password" required>
          <Input type="password" autoComplete="new-password" required value={form.confirm} onChange={update('confirm')} />
        </Field>
        <Button type="submit" className="w-full" loading={submitting} icon={UserPlus}>Daftar</Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
        Sudah punya akun? <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-700">Masuk</Link>
      </p>
    </AuthShell>
  );
}
