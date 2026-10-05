# TokoBerkah BI

Aplikasi kasir (POS), manajemen stok, dan analitik penjualan untuk toko retail / sembako.

- **Backend:** FastAPI, SQLAlchemy, Alembic (PostgreSQL atau SQLite)
- **Frontend:** Next.js 16, React 19, Tailwind CSS 4

## Fitur

| Modul | Keterangan |
|---|---|
| Autentikasi | Login dan daftar toko baru (JWT); peran Pemilik / Admin / Manajer / Kasir |
| Dashboard | Omzet & laba kotor hari ini, grafik omzet harian (7/30/90 hari), produk terlaris, stok menipis, nilai persediaan |
| Kasir (POS) | Cari / scan SKU, kontrol stok real-time, metode bayar Tunai/QRIS/Transfer/Debit, hitung kembalian, struk siap cetak |
| Riwayat Transaksi | Filter tanggal & metode bayar, detail item, ekspor CSV |
| Produk | Tambah, ubah, arsipkan, kategori, margin otomatis |
| Inventori | Stock opname dengan alasan, riwayat mutasi stok lengkap |
| Pembelian | Restok dari supplier; HPP dihitung ulang dengan rata-rata bergerak |
| Import Data | Import penjualan dari CSV/XLSX: pemetaan kolom otomatis, validasi per baris, cek stok |
| Pengaturan | Profil toko (tampil di struk), zona waktu laporan |

## Menjalankan secara lokal

### 1. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env              # sesuaikan DATABASE_URL & SECRET_KEY
```

Pilih database:

- **SQLite (paling cepat):** kosongkan / hapus `DATABASE_URL` di `.env`.
- **PostgreSQL:** jalankan `docker compose up -d db` dari folder root proyek.

```bash
alembic upgrade head              # buat tabel
python seed.py --demo             # akun demo + produk + 30 hari data penjualan
uvicorn main:app --reload         # dokumentasi API: http://localhost:8000/docs
```

Akun demo: **admin@toko.com / password**

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local        # NEXT_PUBLIC_API_URL=http://localhost:8000/api
npm run dev                       # http://localhost:3000
```

## Pengujian

```bash
cd backend && pytest              # test API (SQLite sementara)
cd frontend && npm run lint && npm run build
```

## Struktur

```
backend/
  core/          konfigurasi, keamanan (JWT, bcrypt), dependency otorisasi, util zona waktu
  routers/       endpoint per modul (auth, dashboard, products, transactions, ...)
  alembic/       migrasi database
  tests/         test API (pytest)
  seed.py        data demo
frontend/src/
  app/login, app/register         halaman autentikasi
  app/(dashboard)/...             halaman aplikasi (dilindungi login)
  components/                     sidebar, komponen UI, toast, grafik
  lib/                            API client, auth context, tipe, format Rupiah/tanggal
```

## Catatan production

- Ganti `SECRET_KEY` dengan nilai acak yang panjang.
- Atur `CORS_ORIGINS` sesuai domain frontend.
- Gunakan PostgreSQL dan jalankan `alembic upgrade head` saat deploy.
