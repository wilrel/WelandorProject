'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  Package,
  Boxes,
  Truck,
  FileUp,
  Settings,
  LogOut,
  Store,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { cx } from './ui';

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
  manage?: boolean;
}

const navigation: { section: string; items: NavItem[] }[] = [
  { section: 'Utama', items: [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Kasir (POS)', href: '/transactions/new', icon: ShoppingCart },
    { name: 'Riwayat Transaksi', href: '/transactions', icon: Receipt, exact: true },
  ] },
  { section: 'Stok', items: [
    { name: 'Produk', href: '/products', icon: Package },
    { name: 'Inventori', href: '/inventory', icon: Boxes },
    { name: 'Pembelian', href: '/purchases', icon: Truck, manage: true },
    { name: 'Import Data', href: '/imports', icon: FileUp, manage: true },
  ] },
  { section: 'Lainnya', items: [
    { name: 'Pengaturan', href: '/settings', icon: Settings },
  ] },
];

const ROLE_LABELS: Record<string, string> = { OWNER: 'Pemilik', ADMIN: 'Admin', MANAGER: 'Manajer', CASHIER: 'Kasir' };

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { user, workspace, canManage, logout } = useAuth();

  const isActive = (href: string, exact?: boolean) =>
    href === '/' || exact ? pathname === href : pathname === href || pathname?.startsWith(`${href}/`);

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" onClick={onClose} />}
      <aside className={cx(
        'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform lg:static lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full',
      )}>
        <div className="flex h-16 items-center justify-between gap-3 border-b border-slate-200 px-5">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <Store className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight text-slate-900">TokoBerkah BI</p>
              <p className="truncate text-xs text-slate-500" title={workspace?.name}>{workspace?.name ?? '-'}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 lg:hidden" aria-label="Tutup menu">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
          {navigation.map((group) => {
            const items = group.items.filter((item) => !item.manage || canManage);
            if (items.length === 0) return null;
            return (
              <div key={group.section}>
                <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">{group.section}</p>
                <div className="space-y-1">
                  {items.map((item) => {
                    const active = isActive(item.href, item.exact);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onClose}
                        className={cx(
                          'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                          active ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                        )}
                      >
                        <item.icon className={cx('h-4 w-4 flex-shrink-0', active ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600')} aria-hidden="true" />
                        {item.name}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold uppercase text-slate-600">
              {user?.email.charAt(0)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900" title={user?.email}>{user?.email}</p>
              <p className="text-xs text-slate-500">{workspace ? ROLE_LABELS[workspace.role] : ''}</p>
            </div>
            <button onClick={logout} className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-red-600" title="Keluar" aria-label="Keluar">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
