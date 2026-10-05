'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Banknote, Boxes, Package, Receipt, RefreshCw, ShoppingCart, TrendingUp } from 'lucide-react';
import SalesChart from '@/components/SalesChart';
import { Badge, Button, buttonClass, Card, EmptyState, PageHeader, Spinner, StatCard, cx } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { getDashboard, getErrorMessage } from '@/lib/api';
import { useResource } from '@/lib/useResource';
import { useAuth } from '@/lib/auth';
import { formatNumber, formatRupiah } from '@/lib/format';

const PERIODS = [7, 30, 90];

export default function DashboardPage() {
  const { workspace } = useAuth();
  const notify = useToast();
  const [days, setDays] = useState(30);
  const { data, loading, reload } = useResource(() => getDashboard(days), [days, workspace?.id], (e) => notify(getErrorMessage(e), 'error'));

  const margin = data && data.period_revenue > 0 ? (data.period_profit / data.period_revenue) * 100 : 0;

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={`Selamat datang di ${workspace?.name ?? 'toko Anda'}`}
        description="Ringkasan performa penjualan dan kondisi stok."
        actions={
          <>
            <Button variant="secondary" icon={RefreshCw} onClick={reload} disabled={loading}>Muat ulang</Button>
            <Link href="/transactions/new" className={buttonClass()}>
              <ShoppingCart className="h-4 w-4" /> Buka Kasir
            </Link>
          </>
        }
      />

      {!data ? (
        <Card><Spinner /></Card>
      ) : (
        <div className={cx('space-y-6 transition-opacity', loading && 'opacity-60')}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={Banknote} label="Omzet hari ini" value={formatRupiah(data.today_revenue)} hint={`${formatNumber(data.today_transactions)} transaksi`} />
            <StatCard icon={TrendingUp} label="Laba kotor hari ini" value={formatRupiah(data.today_profit)} hint="Omzet dikurangi HPP" />
            <StatCard icon={Receipt} label="Rata-rata per transaksi" value={formatRupiah(data.average_basket)} hint={`${days} hari terakhir`} />
            <StatCard icon={Boxes} label="Nilai persediaan" value={formatRupiah(data.inventory_value)} hint={`${formatNumber(data.active_products)} produk aktif`} />
          </div>

          <Card className="p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="font-semibold text-slate-900">Omzet harian</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Total {formatRupiah(data.period_revenue)} · laba kotor {formatRupiah(data.period_profit)} ({margin.toFixed(1)}%) · {formatNumber(data.period_transactions)} transaksi
                </p>
              </div>
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-sm" role="group" aria-label="Periode">
                {PERIODS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setDays(p)}
                    className={cx('rounded-md px-3 py-1 font-medium transition-colors', days === p ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}
                  >
                    {p} hari
                  </button>
                ))}
              </div>
            </div>
            {data.period_transactions === 0 ? (
              <EmptyState icon={TrendingUp} title="Belum ada penjualan pada periode ini" description="Transaksi dari kasir atau import akan tampil di sini." />
            ) : (
              <SalesChart data={data.daily_sales} />
            )}
          </Card>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <div className="border-b border-slate-200 px-5 py-4">
                <h2 className="font-semibold text-slate-900">Produk terlaris</h2>
                <p className="text-sm text-slate-500">Berdasarkan omzet {days} hari terakhir</p>
              </div>
              {data.top_products.length === 0 ? (
                <EmptyState icon={Package} title="Belum ada data" />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.top_products.map((p, i) => {
                    const share = data.top_products[0].revenue > 0 ? (p.revenue / data.top_products[0].revenue) * 100 : 0;
                    return (
                      <li key={p.product_id} className="px-5 py-3">
                        <div className="flex items-center justify-between gap-4 text-sm">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="w-4 text-slate-400">{i + 1}</span>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-slate-900">{p.name}</p>
                              <p className="text-xs text-slate-500">{p.sku} · {formatNumber(p.quantity)} terjual</p>
                            </div>
                          </div>
                          <span className="font-medium text-slate-900">{formatRupiah(p.revenue)}</span>
                        </div>
                        <div className="ml-7 mt-2 h-1.5 rounded-full bg-slate-100">
                          <div className="h-1.5 rounded-full bg-indigo-500" style={{ width: `${share}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            <Card>
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <h2 className="font-semibold text-slate-900">Stok menipis</h2>
                  <p className="text-sm text-slate-500">Stok ≤ {data.low_stock_threshold}</p>
                </div>
                <Link href="/inventory" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">Lihat inventori</Link>
              </div>
              {data.low_stock.length === 0 ? (
                <EmptyState icon={Boxes} title="Semua stok aman" description="Tidak ada produk yang perlu segera direstok." />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.low_stock.map((p) => (
                    <li key={p.id} className="flex items-center justify-between px-5 py-3 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">{p.name}</p>
                        <p className="text-xs text-slate-500">{p.sku}</p>
                      </div>
                      <Badge tone={p.current_stock <= 0 ? 'red' : 'yellow'}>
                        <AlertTriangle className="h-3 w-3" />
                        {p.current_stock <= 0 ? 'Habis' : `${formatNumber(p.current_stock)} ${p.unit}`}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
