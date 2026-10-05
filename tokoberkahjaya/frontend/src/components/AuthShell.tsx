import { Store } from 'lucide-react';

export default function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-full">
      <div className="hidden w-1/2 flex-col justify-between bg-indigo-700 p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/15"><Store className="h-5 w-5" /></span>
          <span className="text-lg font-semibold">TokoBerkah BI</span>
        </div>
        <div>
          <h2 className="text-3xl font-semibold leading-tight">Kelola kasir, stok, dan laporan toko dalam satu tempat.</h2>
          <ul className="mt-6 space-y-2 text-indigo-100">
            <li>• Kasir cepat dengan kontrol stok otomatis</li>
            <li>• HPP rata-rata bergerak dari setiap pembelian</li>
            <li>• Dashboard omzet & laba harian</li>
            <li>• Import penjualan dari CSV / Excel</li>
          </ul>
        </div>
        <p className="text-sm text-indigo-200">© {new Date().getFullYear()} TokoBerkah BI</p>
      </div>
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 text-white"><Store className="h-5 w-5" /></span>
            <span className="text-lg font-semibold text-slate-900">TokoBerkah BI</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
