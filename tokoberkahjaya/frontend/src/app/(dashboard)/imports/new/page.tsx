'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Download, FileSpreadsheet, Upload } from 'lucide-react';
import { Button, Card, Field, PageHeader, Select, buttonClass, cx } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { confirmImport, getErrorMessage, uploadImportFile, validateImportMapping } from '@/lib/api';
import { formatNumber } from '@/lib/format';
import type { ColumnMapping, ImportJob, UploadPreview } from '@/lib/types';

const STEPS = ['Unggah', 'Petakan Kolom', 'Validasi', 'Selesai'];

const FIELDS: { key: keyof ColumnMapping; label: string; hint: string; guesses: string[] }[] = [
  { key: 'date_col', label: 'Tanggal', hint: 'Format YYYY-MM-DD disarankan', guesses: ['tanggal', 'date', 'tgl', 'waktu'] },
  { key: 'sku_col', label: 'SKU / Kode Produk', hint: 'Harus sama dengan SKU di menu Produk', guesses: ['sku', 'kode', 'code', 'item'] },
  { key: 'quantity_col', label: 'Jumlah', hint: 'Bilangan bulat > 0', guesses: ['qty', 'jumlah', 'quantity', 'kuantitas'] },
  { key: 'price_col', label: 'Harga Jual / Unit', hint: 'Angka tanpa titik ribuan', guesses: ['harga', 'price', 'sale'] },
];

const TEMPLATE = 'tanggal,sku,jumlah,harga\n2026-08-10,BRS-5KG,2,75000\n2026-08-10,GLA-1KG,5,16000\n';

function guessMapping(columns: string[]): ColumnMapping {
  const used = new Set<string>();
  const mapping = { date_col: '', sku_col: '', quantity_col: '', price_col: '' };
  for (const field of FIELDS) {
    const match = columns.find((c) => !used.has(c) && field.guesses.some((g) => c.toLowerCase().includes(g)));
    if (match) {
      mapping[field.key] = match;
      used.add(match);
    }
  }
  return mapping;
}

function downloadTemplate() {
  const url = URL.createObjectURL(new Blob([TEMPLATE], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'template-import-penjualan.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export default function NewImportPage() {
  const notify = useToast();
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<UploadPreview | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({ date_col: '', sku_col: '', quantity_col: '', price_col: '' });
  const [validation, setValidation] = useState<ImportJob | null>(null);
  const [result, setResult] = useState<{ imported_rows: number; skipped_rows: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setLoading(true);
    try {
      await action();
    } catch (e) {
      notify(getErrorMessage(e), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = () => run(async () => {
    if (!file) return;
    const res = await uploadImportFile(file);
    setPreview(res);
    setMapping(guessMapping(res.columns));
    setStep(1);
  });

  const mappingComplete = Object.values(mapping).every(Boolean);
  const duplicateMapping = new Set(Object.values(mapping).filter(Boolean)).size !== Object.values(mapping).filter(Boolean).length;

  const handleValidate = () => run(async () => {
    if (!preview) return;
    setValidation(await validateImportMapping(preview.job_id, mapping));
    setStep(2);
  });

  const handleConfirm = () => run(async () => {
    if (!preview) return;
    setResult(await confirmImport(preview.job_id, mapping));
    setStep(3);
  });

  const pickFile = (f: File | null | undefined) => {
    if (!f) return;
    if (!/\.(csv|xlsx)$/i.test(f.name)) return notify('Hanya file .csv atau .xlsx yang didukung', 'error');
    setFile(f);
  };

  const validRows = validation ? validation.total_rows - validation.error_rows : 0;

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6 lg:p-8">
      <Link href="/imports" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Kembali ke riwayat import
      </Link>
      <PageHeader title="Import Data Penjualan" description="Setiap baris valid dicatat sebagai transaksi dan mengurangi stok." />

      <ol className="mb-6 flex items-center gap-2 text-sm">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span className={cx('flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold',
              i < step ? 'bg-indigo-600 text-white' : i === step ? 'border-2 border-indigo-600 text-indigo-600' : 'border border-slate-300 text-slate-400')}>
              {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </span>
            <span className={cx('hidden font-medium sm:inline', i <= step ? 'text-slate-900' : 'text-slate-400')}>{label}</span>
            {i < STEPS.length - 1 && <span className={cx('h-px flex-1', i < step ? 'bg-indigo-600' : 'bg-slate-200')} />}
          </li>
        ))}
      </ol>

      <Card className="p-6">
        {step === 0 && (
          <div className="space-y-6">
            <label
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files?.[0]); }}
              className={cx('flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors',
                dragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50')}
            >
              {file ? <FileSpreadsheet className="mb-3 h-10 w-10 text-indigo-500" /> : <Upload className="mb-3 h-10 w-10 text-slate-400" />}
              <p className="font-medium text-slate-900">{file ? file.name : 'Klik atau seret file ke sini'}</p>
              <p className="mt-1 text-sm text-slate-500">{file ? `${(file.size / 1024).toFixed(1)} KB` : 'Format .csv atau .xlsx, maks. 10 MB'}</p>
              <input type="file" className="sr-only" accept=".csv,.xlsx" onChange={(e) => pickFile(e.target.files?.[0])} />
            </label>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button onClick={downloadTemplate} className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700">
                <Download className="h-4 w-4" /> Unduh template CSV
              </button>
              <Button onClick={handleUpload} disabled={!file} loading={loading}>Lanjut ke Pemetaan <ArrowRight className="h-4 w-4" /></Button>
            </div>
          </div>
        )}

        {step === 1 && preview && (
          <div className="space-y-6">
            <div>
              <h2 className="font-semibold text-slate-900">Petakan kolom file</h2>
              <p className="text-sm text-slate-500">Kolom sudah ditebak otomatis. Periksa kembali sebelum validasi.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {FIELDS.map((field) => (
                <Field key={field.key} label={field.label} hint={field.hint} required>
                  <Select value={mapping[field.key]} onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value })}>
                    <option value="">Pilih kolom...</option>
                    {preview.columns.map((col) => <option key={col} value={col}>{col}</option>)}
                  </Select>
                </Field>
              ))}
            </div>
            {duplicateMapping && <p className="text-sm text-red-600">Satu kolom tidak boleh dipakai untuk dua field.</p>}

            <div className="overflow-hidden rounded-lg border border-slate-200">
              <p className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Pratinjau 5 baris pertama</p>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead><tr>{preview.columns.map((c) => <th key={c} className="whitespace-nowrap px-3 py-2 text-left font-medium text-slate-600">{c}</th>)}</tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {preview.preview_data.map((row, i) => (
                      <tr key={i}>{preview.columns.map((c) => <td key={c} className="whitespace-nowrap px-3 py-2 text-slate-600">{String(row[c] ?? '')}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(0)}>Kembali</Button>
              <Button onClick={handleValidate} disabled={!mappingComplete || duplicateMapping} loading={loading}>Validasi Data <ArrowRight className="h-4 w-4" /></Button>
            </div>
          </div>
        )}

        {step === 2 && validation && (
          <div className="space-y-6">
            <h2 className="font-semibold text-slate-900">Hasil validasi</h2>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-slate-200 p-4 text-center">
                <p className="text-2xl font-semibold text-slate-900">{formatNumber(validation.total_rows)}</p>
                <p className="text-sm text-slate-500">Total baris</p>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-center">
                <p className="text-2xl font-semibold text-emerald-700">{formatNumber(validRows)}</p>
                <p className="text-sm text-emerald-700">Valid</p>
              </div>
              <div className={cx('rounded-lg border p-4 text-center', validation.error_rows ? 'border-red-200 bg-red-50' : 'border-slate-200')}>
                <p className={cx('text-2xl font-semibold', validation.error_rows ? 'text-red-700' : 'text-slate-900')}>{formatNumber(validation.error_rows)}</p>
                <p className={cx('text-sm', validation.error_rows ? 'text-red-700' : 'text-slate-500')}>Bermasalah</p>
              </div>
            </div>

            {validation.errors.length > 0 && (
              <div className="overflow-hidden rounded-lg border border-red-200">
                <p className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-800">
                  <AlertTriangle className="h-4 w-4" /> Baris bermasalah {validation.errors.length > 50 && '(50 pertama)'}
                </p>
                <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
                  {validation.errors.slice(0, 50).map((err) => (
                    <li key={err.id} className="px-4 py-3 text-sm">
                      <p className="font-medium text-red-700">Baris {err.row_number}: {err.error_message}</p>
                      <p className="mt-1 truncate font-mono text-xs text-slate-500">{err.raw_data}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className={cx('rounded-lg px-4 py-3 text-sm', validRows === 0 ? 'bg-red-50 text-red-700' : 'bg-slate-50 text-slate-600')}>
              {validRows === 0
                ? 'Tidak ada baris valid. Perbaiki file lalu unggah ulang.'
                : validation.error_rows > 0
                  ? `${formatNumber(validRows)} baris valid akan diimpor; baris bermasalah dilewati.`
                  : 'Semua baris valid dan siap diimpor.'}
            </p>

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}>Kembali</Button>
              <Button variant="success" onClick={handleConfirm} disabled={validRows === 0} loading={loading} icon={CheckCircle2}>Konfirmasi & Import</Button>
            </div>
          </div>
        )}

        {step === 3 && result && (
          <div className="py-8 text-center">
            <CheckCircle2 className="mx-auto mb-4 h-14 w-14 text-emerald-500" />
            <h2 className="text-xl font-semibold text-slate-900">Import berhasil</h2>
            <p className="mt-1 text-slate-500">
              {formatNumber(result.imported_rows)} transaksi tercatat{result.skipped_rows > 0 && `, ${formatNumber(result.skipped_rows)} baris dilewati`}. Stok telah diperbarui.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Link href="/imports" className={buttonClass('secondary')}>Riwayat Import</Link>
              <Link href="/transactions" className={buttonClass()}>Lihat Transaksi</Link>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
