'use client';

import { Fragment, useState } from 'react';
import Link from 'next/link';
import { Banknote, ChevronDown, ChevronRight, Download, Receipt, ShoppingCart, TrendingUp } from 'lucide-react';
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, Select, Spinner, StatCard, Table, Td, Th, buttonClass } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { getErrorMessage, getTransactions } from '@/lib/api';
import { PAYMENT_LABELS, formatDateTime, formatNumber, formatRupiah } from '@/lib/format';
import type { Transaction } from '@/lib/types';
import { useResource } from '@/lib/useResource';

const toISODate = (d: Date) => {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

function downloadCsv(transactions: Transaction[]) {
  const rows = [['No', 'Waktu', 'Metode', 'SKU', 'Produk', 'Qty', 'Harga', 'HPP', 'Subtotal']];
  for (const trx of transactions) {
    for (const item of trx.items) {
      rows.push([
        `TRX-${trx.id}`, new Date(trx.timestamp).toISOString(), trx.payment_method, item.product_sku ?? '',
        item.product_name ?? '', String(item.quantity), String(item.selling_price), String(item.hpp),
        String(item.quantity * item.selling_price),
      ]);
    }
  }
  const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `transaksi-${toISODate(new Date())}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function TransactionsPage() {
  const notify = useToast();
  const [startDate, setStartDate] = useState(() => toISODate(new Date(Date.now() - 6 * 86400000)));
  const [endDate, setEndDate] = useState(() => toISODate(new Date()));
  const [method, setMethod] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);

  const { data, loading } = useResource(
    () => getTransactions({ start_date: startDate || undefined, end_date: endDate || undefined, payment_method: method || undefined }),
    [startDate, endDate, method],
    (e) => notify(getErrorMessage(e), 'error'),
  );
  const transactions: Transaction[] = data ?? [];

  const revenue = transactions.reduce((s, t) => s + t.total_amount, 0);
  const profit = transactions.reduce((s, t) => s + t.items.reduce((a, i) => a + i.quantity * (i.selling_price - i.hpp), 0), 0);

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Riwayat Transaksi"
        description="Semua penjualan dari kasir dan hasil import."
        actions={
          <>
            <Button variant="secondary" icon={Download} onClick={() => downloadCsv(transactions)} disabled={transactions.length === 0}>Ekspor CSV</Button>
            <Link href="/transactions/new" className={buttonClass()}><ShoppingCart className="h-4 w-4" /> Transaksi Baru</Link>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={Receipt} label="Jumlah transaksi" value={formatNumber(transactions.length)} hint="Maks. 100 transaksi terbaru" />
        <StatCard icon={Banknote} label="Total omzet" value={formatRupiah(revenue)} />
        <StatCard icon={TrendingUp} label="Laba kotor" value={formatRupiah(profit)} />
      </div>

      <Card>
        <div className="grid grid-cols-1 gap-3 border-b border-slate-200 p-4 sm:grid-cols-4">
          <Field label="Dari tanggal"><Input type="date" value={startDate} max={endDate || undefined} onChange={(e) => setStartDate(e.target.value)} /></Field>
          <Field label="Sampai tanggal"><Input type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} /></Field>
          <Field label="Metode bayar">
            <Select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="">Semua metode</option>
              {Object.entries(PAYMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
        </div>

        {loading ? <Spinner /> : transactions.length === 0 ? (
          <EmptyState icon={Receipt} title="Tidak ada transaksi" description="Ubah rentang tanggal atau filter metode bayar." />
        ) : (
          <Table head={
            <tr><Th /><Th>No. Transaksi</Th><Th>Waktu</Th><Th>Metode</Th><Th align="right">Item</Th><Th align="right">Total</Th></tr>
          }>
            {transactions.map((trx) => {
              const open = expanded === trx.id;
              return (
                <Fragment key={trx.id}>
                  <tr className="cursor-pointer hover:bg-slate-50" onClick={() => setExpanded(open ? null : trx.id)}>
                    <Td className="w-8 text-slate-400">{open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</Td>
                    <Td className="font-mono text-xs font-medium text-slate-900">TRX-{trx.id}</Td>
                    <Td>{formatDateTime(trx.timestamp)}</Td>
                    <Td><Badge tone={trx.payment_method === 'IMPORT' ? 'gray' : trx.payment_method === 'CASH' ? 'green' : 'blue'}>{PAYMENT_LABELS[trx.payment_method] ?? trx.payment_method}</Badge></Td>
                    <Td align="right">{formatNumber(trx.items.reduce((s, i) => s + i.quantity, 0))}</Td>
                    <Td align="right" className="font-semibold text-slate-900">{formatRupiah(trx.total_amount)}</Td>
                  </tr>
                  {open && (
                    <tr className="bg-slate-50/60">
                      <td colSpan={6} className="px-12 py-3">
                        <table className="w-full text-sm">
                          <tbody>
                            {trx.items.map((item) => (
                              <tr key={item.id}>
                                <td className="py-1 font-mono text-xs text-slate-500">{item.product_sku}</td>
                                <td className="py-1 text-slate-700">{item.product_name}</td>
                                <td className="py-1 text-right text-slate-500">{formatNumber(item.quantity)} × {formatRupiah(item.selling_price)}</td>
                                <td className="py-1 text-right font-medium text-slate-900">{formatRupiah(item.quantity * item.selling_price)}</td>
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
