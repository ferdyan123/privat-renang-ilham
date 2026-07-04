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

// Harga berdasarkan paket + kategori + jumlah sesi
// Base harga untuk 4x/bulan
export const HARGA_BASE: Record<string, Record<string, number>> = {
  'Semi Privat': { normal: 500000, abk: 600000 },
  'Eksklusif':   { normal: 1000000, abk: 1200000 },
}

export const hitungHarga = (paket: string, kategori: string, jumlahSesi: number): number => {
  const base = HARGA_BASE[paket]?.[kategori === 'abk' ? 'abk' : 'normal'] ?? 0
  return base * (jumlahSesi === 8 ? 2 : 1)
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
