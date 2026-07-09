export const ini = (nama: string) =>
  nama.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()

export const fmtTgl = (str: string) =>
  new Date(str + 'T00:00:00').toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

export const fmtShort = (str: string) =>
  new Date(str + 'T00:00:00').toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short',
  })

export const fmtBulan = (str: string) => {
  const [y, m] = str.split('-')
  return new Date(+y, +m - 1, 1).toLocaleDateString('id-ID', {
    month: 'long', year: 'numeric',
  })
}

export const jamSelesai = (jam: string, menit: string, durasi: number) => {
  const t = parseInt(jam) * 60 + parseInt(menit) + durasi
  return String(Math.floor(t / 60) % 24).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0')
}

export const todayStr = () => new Date().toISOString().split('T')[0]
export const bulanStr = () => new Date().toISOString().slice(0, 7)

// Paket di dashboard admin
export const PAKET_LIST = [
  'Semi Privat',
  'Eksklusif',
]

// Paket khusus di form pendaftaran publik (termasuk Adik Kakak)
export const PAKET_LIST_PUBLIK = [
  'Semi Privat',
  'Eksklusif',
  'Adik Kakak',
]

export const ADIK_KAKAK_MIN = 2
export const ADIK_KAKAK_MAX = 5
export const POTONGAN_ADIK_KAKAK = 100000 // potongan per anak (flat)

// Setting harga — sumber kebenarannya di tabel `harga_setting` Supabase (admin-editable).
// Ini cuma default/fallback kalau tabel belum sempat diisi.
export interface HargaSetting {
  semi_privat_normal: number
  semi_privat_abk: number
  eksklusif_normal: number
  eksklusif_abk: number
  adik_kakak_normal: number  // per anak
  adik_kakak_abk: number     // per anak
}

export const DEFAULT_HARGA_SETTING: HargaSetting = {
  semi_privat_normal: 500000,
  semi_privat_abk: 600000,
  eksklusif_normal: 1000000,
  eksklusif_abk: 1200000,
  adik_kakak_normal: 500000,
  adik_kakak_abk: 600000,
}

// Harga paket biasa (Semi Privat / Eksklusif) berdasarkan setting + kategori + jumlah sesi
export const hitungHarga = (setting: HargaSetting, paket: string, kategori: string, jumlahSesi: number): number => {
  const multiplier = jumlahSesi === 8 ? 2 : 1
  const isAbk = kategori === 'abk'
  if (paket === 'Semi Privat') return (isAbk ? setting.semi_privat_abk : setting.semi_privat_normal) * multiplier
  if (paket === 'Eksklusif') return (isAbk ? setting.eksklusif_abk : setting.eksklusif_normal) * multiplier
  return 0
}

// Harga paket Adik Kakak: (harga per anak × jumlah sesi) × jumlah anak, dipotong flat 100rb/anak
export const hitungHargaAdikKakak = (setting: HargaSetting, kategori: string, jumlahAnak: number, jumlahSesi: number): number => {
  const multiplier = jumlahSesi === 8 ? 2 : 1
  const isAbk = kategori === 'abk'
  const hargaPerAnak = (isAbk ? setting.adik_kakak_abk : setting.adik_kakak_normal) * multiplier
  const totalSebelumPotongan = hargaPerAnak * jumlahAnak
  const totalPotongan = POTONGAN_ADIK_KAKAK * jumlahAnak
  return Math.max(0, totalSebelumPotongan - totalPotongan)
}

export const fmtRupiah = (nominal: number): string =>
  'Rp ' + nominal.toLocaleString('id-ID')

// Format angka jadi "300.000" (tanpa "Rp") untuk input harga yang bisa diketik manual
export const formatRibuan = (n: number | string): string => {
  const digits = String(n).replace(/\D/g, '')
  if (!digits || digits === '0') return ''
  return parseInt(digits, 10).toLocaleString('id-ID')
}

// Kebalikan formatRibuan — ambil angka murni dari string berformat "300.000"
export const parseRibuan = (str: string): number => {
  const digits = str.replace(/\D/g, '')
  return digits ? parseInt(digits, 10) : 0
}

// Kolam preset — form bisa ketik custom
export const KOLAM_PRESETS = ['Kolam A', 'Kolam B', 'Kolam VIP']
// Alias untuk kompatibilitas file lama yang masih import KOLAM_LIST
export const KOLAM_LIST = KOLAM_PRESETS

export const HARI_LIST = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
export const COLORS = ['#185FA5', '#1D9E75', '#7F77DD', '#D85A30', '#D4537E', '#BA7517', '#639922']

export const KATEGORI_LIST = [
  { value: 'normal', label: 'Anak Normal' },
  { value: 'abk', label: 'Anak Berkebutuhan Khusus (ABK)' },
]

// ── Pemilik / rekening tujuan (sistem multi-rekening) ────────────────────
// Dipilih di halaman Slot saat generate link pendaftaran, ikut tersimpan
// di pending_members & murid, lalu dipakai lagi di halaman Kirim buat
// nentuin rekening mana yang ditampilkan ke orang tua.
export interface RekeningInfo { nama: string; bank: string; nomor: string }

export const REKENING_ILHAM: RekeningInfo = {
  nama: 'Muhammad Nurilham Aulia Rahman',
  bank: 'Sea Bank',
  nomor: '901452432623',
}

export const REKENING_IBUN: RekeningInfo = {
  nama: 'Ida Farida',
  bank: 'Sea Bank',
  nomor: '901975466695',
}

// Pilihan tetap di selector (Ilham & Ibun) — di luar ini dianggap "custom"
export const PEMILIK_TETAP = ['Ilham', 'Ibun']

// Nama custom (misal "Ferdy") pakai rekening yang sama kaya Ilham — cuma
// beda tag pelacakan, bukan beda rekening.
export const getRekeningByPemilik = (pemilik?: string | null): RekeningInfo =>
  pemilik === 'Ibun' ? REKENING_IBUN : REKENING_ILHAM

// ── Peraturan Sesi Privat ─────────────────────────────────────────────────
// Ditampilkan di bagian bawah form pembayaran (pendaftaran baru & murid lama)
export const PERATURAN_SESI: string[] = [
  'Paket privat berlaku untuk 44 hari (sekitar 1 bulan 14 hari) sejak sesi pertama dimulai.',
  'Seluruh sesi privat harus diselesaikan dalam masa berlaku tersebut.',
  'Apabila masa berlaku telah melewati 44 hari, maka sisa sesi yang belum digunakan akan dianggap hangus.',
  'Pengecualian diberikan apabila siswa sakit. Orang tua/wali diharapkan menginformasikan kondisi tersebut kepada coach, sehingga masa berlaku dapat diperpanjang sesuai kebijakan.',
  'Jika siswa berhalangan hadir (dengan pemberitahuan sebelumnya), maka sesi dapat diganti (reschedule) pada minggu berikutnya.',
  'Jadwal pengganti akan disesuaikan dengan ketersediaan jadwal coach serta kesepakatan dengan orang tua/wali.',
  'Untuk paket kakak beradik, apabila pada jadwal privat hanya satu anak yang hadir sementara anak lainnya tidak hadir, maka keduanya tetap akan dianggap hadir dan absensi pada pertemuan tersebut akan dihitung untuk kedua siswa.',
  'Demi kelancaran proses belajar, mohon memberikan konfirmasi ketidakhadiran atau permohonan reschedule sebelum jadwal privat berlangsung.',
]