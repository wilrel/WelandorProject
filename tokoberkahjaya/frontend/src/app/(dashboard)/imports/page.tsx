'use client';

import Link from 'next/link';
import { CheckCircle2, Clock, FileText, FileUp, Plus, XCircle } from 'lucide-react';
import { Badge, Card, EmptyState, PageHeader, Spinner, Table, Td, Th, buttonClass } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { getErrorMessage, getImports } from '@/lib/api';
import { formatDateTime, formatNumber } from '@/lib/format';
import type { ImportJob } from '@/lib/types';
import { useResource } from '@/lib/useResource';

const STATUS: Record<ImportJob['status'], { label: string; tone: 'green' | 'red' | 'gray' | 'yellow' }> = {
  COMPLETED: { label: 'Selesai', tone: 'green' },
  FAILED: { label: 'Gagal', tone: 'red' },
  PENDING: { label: 'Menunggu pemetaan', tone: 'gray' },
  VALIDATING: { label: 'Validasi', tone: 'yellow' },
  CONFIRMED: { label: 'Belum dikonfirmasi', tone: 'yellow' },
  PROCESSING: { label: 'Diproses', tone: 'yellow' },
};

export default function ImportsHistoryPage() {
  const notify = useToast();

  const { data, loading } = useResource(() => getImports(), [], (e) => notify(getErrorMessage(e), 'error'));
  const jobs: ImportJob[] = data ?? [];

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Import Data Penjualan"
        description="Unggah data penjualan dari CSV atau Excel, misalnya dari kasir lama atau pencatatan manual."
        actions={<Link href="/imports/new" className={buttonClass()}><Plus className="h-4 w-4" /> Import Baru</Link>}
      />

      <Card>
        {loading ? <Spinner /> : jobs.length === 0 ? (
          <EmptyState
            icon={FileUp}
            title="Belum ada import"
            description="Mulai dengan mengunggah file CSV/XLSX berisi tanggal, SKU, jumlah, dan harga."
            action={<Link href="/imports/new" className={buttonClass()}><Plus className="h-4 w-4" /> Import Baru</Link>}
          />
        ) : (
          <Table head={<tr><Th>File</Th><Th>Tanggal Unggah</Th><Th>Status</Th><Th align="right">Berhasil</Th><Th align="right">Dilewati</Th></tr>}>
            {jobs.map((job) => {
              const status = STATUS[job.status];
              const Icon = job.status === 'COMPLETED' ? CheckCircle2 : job.status === 'FAILED' ? XCircle : Clock;
              return (
                <tr key={job.id} className="hover:bg-slate-50">
                  <Td className="font-medium text-slate-900"><span className="inline-flex items-center gap-2"><FileText className="h-4 w-4 text-slate-400" />{job.filename}</span></Td>
                  <Td>{formatDateTime(job.created_at)}</Td>
                  <Td><Badge tone={status.tone}><Icon className="h-3 w-3" />{status.label}</Badge></Td>
                  <Td align="right">{formatNumber(job.imported_rows)} / {formatNumber(job.total_rows)}</Td>
                  <Td align="right" className={job.error_rows > 0 ? 'text-red-600' : ''}>{formatNumber(job.error_rows)}</Td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
    </div>
  );
}
