'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Menu, Store } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/lib/auth';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, workspace, loading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex h-full items-center justify-center text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Memuat...
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <div>
          <Store className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="font-medium text-slate-900">Akun Anda belum terhubung ke toko mana pun.</p>
          <p className="mt-1 text-sm text-slate-500">Minta pemilik toko menambahkan Anda sebagai anggota.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4 lg:hidden">
          <button onClick={() => setMenuOpen(true)} className="rounded-md p-2 text-slate-600 hover:bg-slate-100" aria-label="Buka menu">
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-semibold text-slate-900">{workspace.name}</span>
        </header>
        <main key={workspace.id} className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
