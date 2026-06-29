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

// Hanya 2 paket: 4x dan 8x per bulan
export const PAKET_LIST = [
  'Private (4x/bulan)',
  'Private (8x/bulan)',
]

export const PAKET_HARGA: Record<string, number> = {
  'Private (4x/bulan)': 250000,
  'Private (8x/bulan)': 450000,
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