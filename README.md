# Privat Renang Ilham — Aplikasi Manajemen Les Renang

Sistem manajemen les renang berbasis Next.js 14 + Supabase.

---

## 🗂 Struktur 3 Website

| Route | Deskripsi |
|-------|-----------|
| `/dashboard` | Admin dashboard (absensi, murid, jadwal, rekap, grafik, kirim kartu) |
| `/daftar` | Form pendaftaran murid baru (publik, bisa dibagikan ke orang tua) |
| `/kartu?murid=ID&bulan=YYYY-MM` | Kartu kehadiran (link unik per murid per bulan) |

---

## ⚙️ Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Konfigurasi Supabase

Edit file `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_APP_URL=http://localhost:3000  # ganti dengan domain saat production
```

### 3. Buat tabel di Supabase

Jalankan SQL berikut di **Supabase → SQL Editor**:

```sql
-- Tabel murid
CREATE TABLE IF NOT EXISTS murid (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  paket text,
  wa_ortu text,
  aktif boolean default true,
  created_at timestamptz default now()
);

-- Tabel sesi
CREATE TABLE IF NOT EXISTS sesi (
  id uuid primary key default gen_random_uuid(),
  tanggal date not null,
  jam text,
  menit text,
  durasi integer default 60,
  kolam text,
  created_at timestamptz default now()
);

-- Tabel absensi
CREATE TABLE IF NOT EXISTS absensi (
  id uuid primary key default gen_random_uuid(),
  sesi_id uuid references sesi(id) on delete cascade,
  murid_id uuid references murid(id) on delete cascade,
  status text default 'alpha',
  unique(sesi_id, murid_id)
);

-- Tabel pendaftaran (Web 2)
CREATE TABLE IF NOT EXISTS pending_members (
  id uuid primary key default gen_random_uuid(),
  nama_murid text,
  usia integer,
  nama_ortu text,
  wa_ortu text,
  paket text,
  jadwal_hari text,
  jadwal_jam text,
  bukti_tf_url text,
  catatan text,
  status text default 'menunggu',
  created_at timestamptz default now(),
  kode_promo text,
  diskon integer default 0
);

-- Kolom kuota di slot_status (kalau tabel sudah ada dari sebelumnya, jalankan ALTER ini)
ALTER TABLE slot_status ADD COLUMN IF NOT EXISTS kuota integer;

-- Kolom kode_promo & diskon di pending_members (kalau tabel sudah ada dari sebelumnya)
ALTER TABLE pending_members ADD COLUMN IF NOT EXISTS kode_promo text;
ALTER TABLE pending_members ADD COLUMN IF NOT EXISTS diskon integer default 0;

-- Tabel promo / kode referral
CREATE TABLE IF NOT EXISTS promo (
  id uuid primary key default gen_random_uuid(),
  kode text unique not null,
  tipe text not null default 'baru', -- 'baru' | 'lama'
  diskon_nominal integer not null default 0,
  kuota integer not null default 1,
  terpakai integer not null default 0,
  aktif boolean not null default true,
  created_at timestamptz default now()
);
```

### 4. Buat Supabase Storage bucket

Di Supabase → Storage → New bucket:
- Nama: `bukti-tf`
- Public: **ON**

### 5. Jalankan development server

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000)

---

## 🚀 Deploy ke Vercel

```bash
npm install -g vercel
vercel
```

Set environment variables di Vercel dashboard sama seperti `.env.local`.

---

## 📱 Fitur

### Dashboard Admin (`/dashboard`)
- **Hari Ini** — absensi tap-to-toggle per sesi
- **Murid** — tambah/hapus murid aktif
- **Jadwal** — tambah sesi single/berulang mingguan
- **Rekap** — statistik kehadiran per murid per bulan
- **Grafik** — chart tren & per murid (Chart.js)
- **Kirim** — generate link kartu + kirim WA otomatis ke nomor orang tua
- **Pendaftaran** — approval calon murid baru (ACC/Tolak) dengan badge notifikasi

### Form Pendaftaran (`/daftar`)
- Wizard 3 step: Data Murid → Paket & Jadwal → Pembayaran
- Upload bukti transfer ke Supabase Storage
- Langsung masuk ke tabel `pending_members`

### Kartu Kehadiran (`/kartu?murid=ID&bulan=YYYY-MM`)
- Halaman publik read-only
- Tabel absensi lengkap + persentase kehadiran
- Donut chart visual

---

## 🔧 Kustomisasi

| File | Yang bisa diubah |
|------|-----------------|
| `lib/utils.ts` | `PAKET_LIST`, `PAKET_HARGA`, nomor rekening |
| `app/daftar/page.tsx` | `NOREK` (rekening tujuan pembayaran) |
| `tailwind.config.ts` | Warna brand |
| `.env.local` | Supabase credentials |
