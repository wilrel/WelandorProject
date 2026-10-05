'use client';

import { Fragment, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, Plus, Truck } from 'lucide-react';
import { Card, EmptyState, PageHeader, Spinner, Table, Td, Th, buttonClass } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { getErrorMessage, getPurchases } from '@/lib/api';
import { formatDateTime, formatNumber, formatRupiah } from '@/lib/format';
import type { Purchase } from '@/lib/types';
import { useResource } from '@/lib/useResource';

export default function PurchasesHistoryPage() {
  const notify = useToast();
  const [expanded, setExpanded] = useState<number | null>(null);

  const { data, loading } = useResource(() => getPurchases(), [], (e) => notify(getErrorMessage(e), 'error'));
  const purchases: Purchase[] = data ?? [];

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Pembelian"
        description="Catatan barang masuk dari supplier. Setiap pembelian memperbarui stok dan HPP rata-rata."
        actions={<Link href="/purchases/new" className={buttonClass()}><Plus className="h-4 w-4" /> Pembelian Baru</Link>}
      />

      <Card>
        {loading ? <Spinner /> : purchases.length === 0 ? (
          <EmptyState
            icon={Truck}
            title="Belum ada pembelian"
            description="Catat restok dari supplier agar stok dan HPP selalu akurat."
            action={<Link href="/purchases/new" className={buttonClass()}><Plus className="h-4 w-4" /> Pembelian Baru</Link>}
          />
        ) : (
          <Table head={<tr><Th /><Th>No.</Th><Th>Tanggal</Th><Th>Supplier</Th><Th align="right">Jumlah Item</Th><Th align="right">Total</Th></tr>}>
            {purchases.map((purchase) => {
              const open = expanded === purchase.id;
              return (
                <Fragment key={purchase.id}>
                  <tr className="cursor-pointer hover:bg-slate-50" onClick={() => setExpanded(open ? null : purchase.id)}>
                    <Td className="w-8 text-slate-400">{open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</Td>
                    <Td className="font-mono text-xs font-medium text-slate-900">PO-{purchase.id}</Td>
                    <Td>{formatDateTime(purchase.timestamp)}</Td>
                    <Td className="font-medium text-slate-900">{purchase.supplier_name || <span className="font-normal text-slate-400">Tanpa supplier</span>}</Td>
                    <Td align="right">{formatNumber(purchase.items.reduce((s, i) => s + i.quantity, 0))}</Td>
                    <Td align="right" className="font-semibold text-slate-900">{formatRupiah(purchase.total_amount)}</Td>
                  </tr>
                  {open && (
                    <tr className="bg-slate-50/60">
                      <td colSpan={6} className="px-12 py-3">
                        <table className="w-full text-sm">
                          <tbody>
                            {purchase.items.map((item) => (
                              <tr key={item.id}>
                                <td className="py-1 font-mono text-xs text-slate-500">{item.product?.sku}</td>
                                <td className="py-1 text-slate-700">{item.product?.name}</td>
                                <td className="py-1 text-right text-slate-500">{formatNumber(item.quantity)} × {formatRupiah(item.unit_cost)}</td>
                                <td className="py-1 text-right font-medium text-slate-900">{formatRupiah(item.quantity * item.unit_cost)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </Table>
        )}
      </Card>
    </div>
  );
}
