import { createClient } from '@supabase/supabase-js'
import { HargaSetting, DEFAULT_HARGA_SETTING } from './utils'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

// ── Types ──────────────────────────────────────────────────────────────────

export interface Murid {
  id: string
  nama: string
  paket: string
  wa_ortu: string
  kategori: 'normal' | 'abk'
  jadwal_hari: string | null
  jadwal_jam: string | null
  jadwal_kolam: string | null
  harga: number
  jumlah_sesi: number
  aktif: boolean
  pemilik: string
  kelompok_adik_kakak?: string | null
}

export interface Sesi {
  id: string
  tanggal: string
  jam: string
  menit: string
  durasi: number
  kolam: string
}

export interface Absensi {
  id: string
  sesi_id: string
  murid_id: string
  status: 'hadir' | 'izin' | 'alpha'
}

export interface MuridJadwal {
  id: string
  murid_id: string
  hari: string
  jam_mulai: string
  kolam: string | null
}

// Kelas pengganti/makeup — pengecualian 1x per tanggal, gak ngubah pola mingguan tetap
export interface JadwalPengganti {
  id: string
  murid_id: string
  tanggal_asal: string   // 'YYYY-MM-DD' — tanggal spesifik yang di-skip
  tanggal_baru: string   // 'YYYY-MM-DD' — tanggal spesifik penggantinya
  jam: string
  kolam: string | null
  keterangan: string | null
}

export interface JadwalTemplate {
  id: string
  hari: string        // 'Senin', 'Selasa', dst
  jam_mulai: string   // '15:00'
  jam_selesai: string // '16:00'
  durasi: number
  kolam: string
  aktif: boolean
}

export interface AnakAdikKakak { nama: string; usia: number }

export interface PendingMember {
  id: string
  nama_murid: string
  usia: number
  nama_ortu: string
  wa_ortu: string
  paket: string
  jadwal_hari: string
  jadwal_jam: string
  jadwal_kolam: string | null
  jumlah_sesi: number
  harga: number
  bukti_tf_url: string | null
  catatan: string | null
  status: 'menunggu' | 'diterima' | 'ditolak'
  created_at: string
  pemilik: string | null
  kode_promo?: string | null
  diskon?: number
  anak_list?: AnakAdikKakak[] | null
  jumlah_anak?: number | null
}

// ── DB helpers ─────────────────────────────────────────────────────────────

export const getMurid = async (): Promise<Murid[]> => {
  const { data, error } = await supabase
    .from('murid')
    .select('*')
    .eq('aktif', true)
    .order('nama')
  if (error) throw error
  return data
}

export const addMurid = async (
  payload: Omit<Murid, 'id' | 'aktif'>,
  jadwalList?: { hari: string; jam_mulai: string; kolam: string | null }[]
): Promise<Murid> => {
  const { data, error } = await supabase
    .from('murid')
    .insert({ ...payload, aktif: true })
    .select()
    .single()
  if (error) throw error
  if (jadwalList && jadwalList.length > 0) {
    await replaceMuridJadwal(data.id, jadwalList)
  }
  return data
}

export const deleteMurid = async (id: string) => {
  const { error } = await supabase.from('murid').update({ aktif: false }).eq('id', id)
  if (error) throw error
}

// ── Multi jadwal per murid (misal paket 8x/bulan = 2x seminggu) ────────────

// Semua jadwal semua murid sekaligus, join nama & status aktif — dipakai di
// halaman Jadwal & Hari Ini buat nentuin murid mana yang masuk sesi tertentu.
export const getAllMuridJadwal = async (): Promise<
  (MuridJadwal & { murid_nama: string; murid_aktif: boolean })[]
> => {
  const { data, error } = await supabase
    .from('murid_jadwal')
    .select('id, murid_id, hari, jam_mulai, kolam, murid:murid_id ( nama, aktif )')
  if (error) throw error
  return (data ?? []).map((r: any) => ({
    id: r.id,
    murid_id: r.murid_id,
    hari: r.hari,
    jam_mulai: r.jam_mulai,
    kolam: r.kolam,
    murid_nama: r.murid?.nama ?? '',
    murid_aktif: r.murid?.aktif ?? false,
  }))
}

// Jadwal milik 1 murid spesifik — dipakai buat isi form edit di halaman Murid
export const getMuridJadwalByMurid = async (muridId: string): Promise<MuridJadwal[]> => {
  const { data, error } = await supabase.from('murid_jadwal').select('*').eq('murid_id', muridId)
  if (error) throw error
  return data ?? []
}

// Ganti SEMUA slot jadwal seorang murid (hapus yang lama, insert yang baru).
// Juga sinkronin kolom ringkasan lama (jadwal_hari/jadwal_jam/jadwal_kolam) di
// tabel murid biar kartu murid & filter cepat tetap kebaca tanpa join ekstra.
export const replaceMuridJadwal = async (
  muridId: string,
  slots: { hari: string; jam_mulai: string; kolam: string | null }[]
) => {
  const { error: delErr } = await supabase.from('murid_jadwal').delete().eq('murid_id', muridId)
  if (delErr) throw delErr

  if (slots.length > 0) {
    const { error: insErr } = await supabase
      .from('murid_jadwal')
      .insert(slots.map((s) => ({ murid_id: muridId, hari: s.hari, jam_mulai: s.jam_mulai, kolam: s.kolam })))
    if (insErr) throw insErr
  }

  const { error: updErr } = await supabase
    .from('murid')
    .update({
      jadwal_hari: slots.map((s) => s.hari).join(', '),
      jadwal_jam: slots.map((s) => s.jam_mulai).join(', '),
      jadwal_kolam: slots.map((s) => s.kolam ?? '').join(', '),
    })
    .eq('id', muridId)
  if (updErr) throw updErr
}

// Pecah string gabungan "Senin, Rabu" / "16:00, 16:00" / "Kolam A, Kolam A"
// (hasil form pendaftaran multi-jadwal) jadi array slot {hari, jam_mulai, kolam}
export const zipJadwal = (
  hariStr?: string | null,
  jamStr?: string | null,
  kolamStr?: string | null
): { hari: string; jam_mulai: string; kolam: string | null }[] => {
  const haris = (hariStr || '').split(',').map((s) => s.trim()).filter(Boolean)
  const jams = (jamStr || '').split(',').map((s) => s.trim()).filter(Boolean)
  const kolams = (kolamStr || '').split(',').map((s) => s.trim()).filter(Boolean)
  return haris.map((h, i) => ({
    hari: h,
    jam_mulai: jams[i] || jams[0] || '',
    kolam: kolams[i] || kolams[0] || null,
  }))
}

// ── Jadwal pengganti (kelas makeup 1x, tanpa ubah pola mingguan) ───────────

// Semua jadwal pengganti punya 1 murid — dipakai buat isi riwayat di halaman Murid
export const getJadwalPenggantiByMurid = async (muridId: string): Promise<JadwalPengganti[]> => {
  const { data, error } = await supabase
    .from('jadwal_pengganti')
    .select('*')
    .eq('murid_id', muridId)
    .order('tanggal_baru', { ascending: false })
  if (error) throw error
  return data ?? []
}

// SEMUA jadwal pengganti semua murid — dipakai di halaman Hari Ini & Jadwal buat
// nentuin siapa yang perlu di-exclude/include di sesi tanggal tertentu
export const getAllJadwalPengganti = async (): Promise<JadwalPengganti[]> => {
  const { data, error } = await supabase.from('jadwal_pengganti').select('*')
  if (error) throw error
  return data ?? []
}

export const addJadwalPengganti = async (payload: Omit<JadwalPengganti, 'id'>): Promise<JadwalPengganti> => {
  const { data, error } = await supabase.from('jadwal_pengganti').insert(payload).select().single()
  if (error) throw error
  return data
}

export const deleteJadwalPengganti = async (id: string) => {
  const { error } = await supabase.from('jadwal_pengganti').delete().eq('id', id)
  if (error) throw error
}

// Ambil daftar nama "pemilik" custom yang pernah dipakai (di luar Ilham/Ibun)
// dari data murid yang sudah ada — buat suggestion di dropdown, biar nama
// kaya "Ferdy" yang pernah kepake gak perlu diketik ulang.
export const getPemilikSuggestions = async (): Promise<string[]> => {
  const { data, error } = await supabase.from('murid').select('pemilik')
  if (error) throw error
  const set = new Set<string>()
  ;(data ?? []).forEach((r: any) => {
    if (r.pemilik && r.pemilik !== 'Ilham' && r.pemilik !== 'Ibun') set.add(r.pemilik)
  })
  return Array.from(set).sort()
}

export const getSesi = async (limit = 90): Promise<Sesi[]> => {
  const { data, error } = await supabase
    .from('sesi')
    .select('*')
    .order('tanggal', { ascending: false })
    .order('jam', { ascending: true })
    .limit(limit)
  if (error) throw error
  return data
}

export const getSesiByTanggal = async (tanggal: string): Promise<Sesi[]> => {
  const { data, error } = await supabase
    .from('sesi')
    .select('*')
    .eq('tanggal', tanggal)
    .order('jam')
  if (error) throw error
  return data
}

export const addSesi = async (payload: Omit<Sesi, 'id'>): Promise<Sesi> => {
  const { data, error } = await supabase.from('sesi').insert(payload).select().single()
  if (error) throw error
  return data
}

export const addSesiBatch = async (payloads: Omit<Sesi, 'id'>[]): Promise<Sesi[]> => {
  const { data, error } = await supabase.from('sesi').insert(payloads).select()
  if (error) throw error
  return data
}

export const deleteSesi = async (id: string) => {
  const { error } = await supabase.from('sesi').delete().eq('id', id)
  if (error) throw error
}

export const getAbsensi = async (sesiId: string): Promise<Absensi[]> => {
  const { data, error } = await supabase.from('absensi').select('*').eq('sesi_id', sesiId)
  if (error) throw error
  return data
}

export const upsertAbsensiBatch = async (records: Omit<Absensi, 'id'>[]) => {
  const { data, error } = await supabase
    .from('absensi')
    .upsert(records, { onConflict: 'sesi_id,murid_id' })
    .select()
  if (error) throw error
  return data
}

export const getPendingMembers = async (status: string): Promise<PendingMember[]> => {
  const { data, error } = await supabase
    .from('pending_members')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export const getPendingCount = async (): Promise<number> => {
  const { count } = await supabase
    .from('pending_members')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'menunggu')
  return count ?? 0
}

export const updatePendingStatus = async (id: string, status: string) => {
  const { error } = await supabase.from('pending_members').update({ status }).eq('id', id)
  if (error) throw error
}

// ── Tagihan ────────────────────────────────────────────────────────────────

export interface Tagihan {
  id: string
  murid_id: string
  siklus: number
  sesi_ids: string[]
  jumlah_hadir: number
  status: 'belum_bayar' | 'menunggu_konfirmasi' | 'lunas'
  bukti_tf_url: string | null
  total_harga: number
  created_at: string
  paid_at: string | null
}

export const getTagihanByMurid = async (muridId: string): Promise<Tagihan[]> => {
  const { data, error } = await supabase
    .from('tagihan')
    .select('*')
    .eq('murid_id', muridId)
    .order('siklus', { ascending: false })
  if (error) throw error
  return data
}

export const getTagihanPending = async (): Promise<(Tagihan & { murid: { nama: string; wa_ortu: string; paket: string } })[]> => {
  const { data, error } = await supabase
    .from('tagihan')
    .select('*, murid:murid_id(nama, wa_ortu, paket)')
    .eq('status', 'menunggu_konfirmasi')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as any
}

export const createTagihan = async (payload: Omit<Tagihan, 'id' | 'created_at' | 'paid_at'>): Promise<Tagihan> => {
  const { data, error } = await supabase
    .from('tagihan')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export const updateTagihanStatus = async (id: string, status: string, bukti_tf_url?: string) => {
  const payload: Record<string, any> = { status }
  if (bukti_tf_url) payload.bukti_tf_url = bukti_tf_url
  if (status === 'lunas') payload.paid_at = new Date().toISOString()
  const { error } = await supabase.from('tagihan').update(payload).eq('id', id)
  if (error) throw error
}

// Hitung siklus berjalan murid — kembalikan sesi hadir yang belum masuk tagihan lunas
export const getSiklusBerjalan = async (muridId: string, paket: string, jumlahSesiOverride?: number): Promise<{
  sesiHadir: string[]
  jumlahTarget: number
  siapTagih: boolean
  siklusBerikutnya: number
}> => {
  const jumlahTarget = jumlahSesiOverride ?? (paket.includes('8') ? 8 : 4)

  // Ambil semua tagihan lunas untuk tahu sesi mana yang sudah dibayar
  const { data: tagihanLunas } = await supabase
    .from('tagihan')
    .select('sesi_ids, siklus')
    .eq('murid_id', muridId)
    .in('status', ['lunas', 'menunggu_konfirmasi'])
    .order('siklus', { ascending: false })

  const sudahDibayarIds = new Set<string>(
    (tagihanLunas ?? []).flatMap((t: any) => t.sesi_ids ?? [])
  )
  const siklusBerikutnya = tagihanLunas && tagihanLunas.length > 0 ? tagihanLunas[0].siklus + 1 : 1

  // Ambil semua absensi hadir murid ini
  const { data: absenHadir } = await supabase
    .from('absensi')
    .select('sesi_id, sesi:sesi_id(tanggal)')
    .eq('murid_id', muridId)
    .eq('status', 'hadir')

  // Filter yang belum masuk tagihan, urutkan berdasarkan tanggal
  const belumDibayar = ((absenHadir ?? []) as any[])
    .filter((a) => !sudahDibayarIds.has(a.sesi_id))
    .sort((a, b) => (a.sesi?.tanggal ?? '').localeCompare(b.sesi?.tanggal ?? ''))
    .map((a) => a.sesi_id)

  return {
    sesiHadir: belumDibayar,
    jumlahTarget,
    siapTagih: belumDibayar.length >= jumlahTarget,
    siklusBerikutnya,
  }
}

// ── Pembayaran (history konfirmasi) ───────────────────────────────────────

export interface Pembayaran {
  id: string
  tagihan_id: string
  murid_id: string
  siklus: number
  bukti_tf_url: string
  status: 'menunggu' | 'lunas'
  created_at: string
  confirmed_at: string | null
}

export const createPembayaran = async (payload: Omit<Pembayaran, 'id' | 'created_at' | 'confirmed_at'>): Promise<Pembayaran> => {
  const { data, error } = await supabase
    .from('pembayaran')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export const getPembayaran = async (): Promise<(Pembayaran & { murid: { nama: string; paket: string } })[]> => {
  const { data, error } = await supabase
    .from('pembayaran')
    .select('*, murid:murid_id(nama, paket)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as any
}

export const konfirmasiPembayaran = async (id: string) => {
  const { error } = await supabase
    .from('pembayaran')
    .update({ status: 'lunas', confirmed_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export const updateMurid = async (id: string, payload: Partial<Omit<Murid, 'id'>>) => {
  const { error } = await supabase.from('murid').update(payload).eq('id', id)
  if (error) throw error
}

export const updateSesi = async (id: string, payload: Partial<Omit<Sesi, 'id'>>) => {
  const { error } = await supabase.from('sesi').update(payload).eq('id', id)
  if (error) throw error
}

export const getTagihanHistory = async (): Promise<(Tagihan & { murid: { nama: string; wa_ortu: string; paket: string } })[]> => {
  const { data, error } = await supabase
    .from('tagihan')
    .select('*, murid:murid_id(nama, wa_ortu, paket)')
    .in('status', ['lunas', 'belum_bayar'])
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return data as any
}

// ── Rekap Pemasukan (keuangan) ────────────────────────────────────────────

const POTONGAN_REFERRAL = 100000

export interface PemasukanItem {
  id: string
  nama: string
  pemilik: string
  kategori: 'baru' | 'lama'
  tanggal: string
  totalSebelumPromo: number
  diskonPromo: number
  kodePromo?: string | null
  netto: number
}

// Hitung potongan sesuai aturan: Ilham selalu full, Ibun selalu potong 100rb,
// pemilik custom (di luar Ilham/Ibun) cuma kepotong pas transaksi "murid baru" (pendaftaran pertama).
const hitungPotongan = (pemilik: string, kategori: 'baru' | 'lama', totalAsli: number): number => {
  if (pemilik === 'Ilham') return 0
  if (pemilik === 'Ibun') return Math.min(POTONGAN_REFERRAL, totalAsli)
  // Pemilik custom (nama lain)
  return kategori === 'baru' ? Math.min(POTONGAN_REFERRAL, totalAsli) : 0
}

// bulan format 'YYYY-MM'
export const getRekapPemasukan = async (bulan: string): Promise<PemasukanItem[]> => {
  const items: PemasukanItem[] = []

  // Murid Baru — dari pendaftaran yang sudah di-ACC (pending_members diterima)
  const { data: pendaftaran, error: e1 } = await supabase
    .from('pending_members')
    .select('id, nama_murid, pemilik, harga, created_at, kode_promo, diskon')
    .eq('status', 'diterima')
    .gte('created_at', `${bulan}-01`)
    .lt('created_at', bulanBerikutnya(bulan))
  if (e1) throw e1
  ;(pendaftaran ?? []).forEach((p: any) => {
    const pemilik = p.pemilik || 'Ilham'
    const totalAsli = p.harga ?? 0
    const diskonPromo = p.kode_promo ? (p.diskon ?? 0) : hitungPotongan(pemilik, 'baru', totalAsli)
    items.push({
      id: `baru-${p.id}`, nama: p.nama_murid, pemilik, kategori: 'baru',
      tanggal: p.created_at, totalSebelumPromo: totalAsli,
      diskonPromo, kodePromo: p.kode_promo ?? null, netto: totalAsli - diskonPromo,
    })
  })

  // Murid Lama — dari tagihan siklus bulanan yang sudah lunas
  const { data: tagihanLunas, error: e2 } = await supabase
    .from('tagihan')
    .select('id, total_harga, paid_at, murid:murid_id(nama, pemilik)')
    .eq('status', 'lunas')
    .gte('paid_at', `${bulan}-01`)
    .lt('paid_at', bulanBerikutnya(bulan))
  if (e2) throw e2
  ;(tagihanLunas ?? []).forEach((t: any) => {
    const pemilik = t.murid?.pemilik || 'Ilham'
    const totalAsli = t.total_harga ?? 0
    const diskonPromo = hitungPotongan(pemilik, 'lama', totalAsli)
    items.push({
      id: `lama-${t.id}`, nama: t.murid?.nama ?? '-', pemilik, kategori: 'lama',
      tanggal: t.paid_at, totalSebelumPromo: totalAsli,
      diskonPromo, kodePromo: null, netto: totalAsli - diskonPromo,
    })
  })

  items.sort((a, b) => b.tanggal.localeCompare(a.tanggal))
  return items
}

const bulanBerikutnya = (bulan: string): string => {
  const [y, m] = bulan.split('-').map(Number)
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
  return `${next}-01`
}

// Daftar bulan yang punya transaksi (buat dropdown filter di halaman Pemasukan)
export const getBulanPemasukanList = async (): Promise<string[]> => {
  const [{ data: p }, { data: t }] = await Promise.all([
    supabase.from('pending_members').select('created_at').eq('status', 'diterima'),
    supabase.from('tagihan').select('paid_at').eq('status', 'lunas'),
  ])
  const bulanSet = new Set<string>()
  ;(p ?? []).forEach((r: any) => r.created_at && bulanSet.add(r.created_at.slice(0, 7)))
  ;(t ?? []).forEach((r: any) => r.paid_at && bulanSet.add(r.paid_at.slice(0, 7)))
  return Array.from(bulanSet).sort().reverse()
}

// ── Cek semua murid yang sudah siap tagih (untuk notifikasi otomatis) ─────
export const getMuridSiapTagih = async (): Promise<{
  murid: Murid
  jumlahHadir: number
  jumlahTarget: number
}[]> => {
  const muridAll = await getMurid()
  const results = []
  for (const m of muridAll) {
    const info = await getSiklusBerjalan(m.id, m.paket)
    if (info.siapTagih) {
      results.push({
        murid: m,
        jumlahHadir: info.sesiHadir.length,
        jumlahTarget: info.jumlahTarget,
      })
    }
  }
  return results
}

// ── Slot Status (dari data sesi, deduplikasi hari+jam+kolam) ─────────────

// ── Jadwal Template (pola mingguan tetap, tanpa tanggal) ────────────────────

export const getJadwalTemplate = async (): Promise<JadwalTemplate[]> => {
  const { data, error } = await supabase
    .from('jadwal_template')
    .select('*')
    .eq('aktif', true)
    .order('kolam')
  if (error) throw error
  const HARI_ORDER = ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu']
  return (data ?? []).sort((a: JadwalTemplate, b: JadwalTemplate) => {
    if (a.kolam !== b.kolam) return a.kolam.localeCompare(b.kolam)
    const hA = HARI_ORDER.indexOf(a.hari), hB = HARI_ORDER.indexOf(b.hari)
    if (hA !== hB) return hA - hB
    return a.jam_mulai.localeCompare(b.jam_mulai)
  })
}

export const addJadwalTemplate = async (
  payload: Omit<JadwalTemplate, 'id' | 'aktif'>
): Promise<JadwalTemplate> => {
  const { data, error } = await supabase
    .from('jadwal_template')
    .insert({ ...payload, aktif: true })
    .select()
    .single()
  if (error) throw error
  return data
}

export const updateJadwalTemplate = async (
  id: string, payload: Partial<Omit<JadwalTemplate, 'id'>>
): Promise<void> => {
  const { error } = await supabase.from('jadwal_template').update(payload).eq('id', id)
  if (error) throw error
}

export const deleteJadwalTemplate = async (id: string): Promise<void> => {
  const { error } = await supabase.from('jadwal_template').delete().eq('id', id)
  if (error) throw error
}

// ── Slot info (untuk form /daftar & halaman Slot) ────────────────────────────
// Sekarang baca dari jadwal_template, bukan deduplikasi dari tabel sesi.

export interface SlotInfo {
  hari: string
  jam_mulai: string
  jam_selesai: string
  kolam: string
  status: 'tersedia' | 'penuh'
  kuota: number | null
}

export const getSlotDariJadwal = async (): Promise<SlotInfo[]> => {
  const [templates, statusData] = await Promise.all([
    getJadwalTemplate(),
    supabase.from('slot_status').select('*').then(r => r.data ?? []),
  ])

  const statusMap: Record<string, 'tersedia' | 'penuh'> = {}
  const kuotaMap: Record<string, number | null> = {}
  ;(statusData as any[]).forEach((s) => {
    const key = `${s.hari}__${s.jam_mulai}__${s.kolam}`
    statusMap[key] = s.status
    kuotaMap[key] = s.kuota ?? null
  })

  return templates.map((t) => {
    const key = `${t.hari}__${t.jam_mulai}__${t.kolam}`
    return {
      hari: t.hari,
      jam_mulai: t.jam_mulai,
      jam_selesai: t.jam_selesai,
      kolam: t.kolam,
      status: statusMap[key] ?? 'tersedia',
      kuota: kuotaMap[key] ?? null,
    }
  })
}

// Klik tombol "Penuh" manual → status penuh, kuota otomatis 0
export const setSlotPenuh = async (hari: string, jam_mulai: string, kolam: string) => {
  const { error } = await supabase
    .from('slot_status')
    .upsert({ hari, jam_mulai, kolam, status: 'penuh', kuota: 0 }, { onConflict: 'hari,jam_mulai,kolam' })
  if (error) throw error
}

// Klik tombol "Tersedia" manual (dari kondisi penuh) → status tersedia, kuota default 1 kalau belum ada
export const setSlotTersedia = async (hari: string, jam_mulai: string, kolam: string, kuotaDefault = 1) => {
  const { error } = await supabase
    .from('slot_status')
    .upsert({ hari, jam_mulai, kolam, status: 'tersedia', kuota: kuotaDefault }, { onConflict: 'hari,jam_mulai,kolam' })
  if (error) throw error
}

// Ketik/atur angka sisa kuota manual → status mengikuti otomatis (0 = penuh, >0 = tersedia)
export const setSlotKuota = async (hari: string, jam_mulai: string, kolam: string, kuota: number) => {
  const kuotaFinal = Math.max(0, kuota)
  const status = kuotaFinal > 0 ? 'tersedia' : 'penuh'
  const { error } = await supabase
    .from('slot_status')
    .upsert({ hari, jam_mulai, kolam, status, kuota: kuotaFinal }, { onConflict: 'hari,jam_mulai,kolam' })
  if (error) throw error
}

// Alias untuk kompatibilitas daftar publik
export const getJadwalSlot = getSlotDariJadwal
export type JadwalSlot = SlotInfo

// ── Promo / Kode Referral ─────────────────────────────────────

export interface PromoInfo {
  id: string
  kode: string
  tipe: 'baru' | 'lama'
  diskon_nominal: number
  kuota: number
  terpakai: number
  aktif: boolean
  created_at: string
}

// Ambil semua kode promo (buat halaman admin)
export const getAllPromo = async (): Promise<PromoInfo[]> => {
  const { data, error } = await supabase
    .from('promo')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

// Buat kode promo baru
export const createPromo = async (
  kode: string,
  tipe: 'baru' | 'lama',
  diskon_nominal: number,
  kuota: number
) => {
  const { error } = await supabase
    .from('promo')
    .insert({ kode: kode.trim().toUpperCase(), tipe, diskon_nominal, kuota, terpakai: 0, aktif: true })
  if (error) throw error
}

// Nonaktifkan kode promo manual
export const nonaktifkanPromo = async (id: string) => {
  const { error } = await supabase.from('promo').update({ aktif: false }).eq('id', id)
  if (error) throw error
}

// Hapus kode promo permanen dari database
export const hapusPromo = async (id: string) => {
  const { error } = await supabase.from('promo').delete().eq('id', id)
  if (error) throw error
}

// Ambil daftar anak/pendaftar yang pakai kode promo tertentu
export const getMuridPakaiPromo = async (kode: string) => {
  const { data, error } = await supabase
    .from('pending_members')
    .select('id, nama_murid, nama_ortu, status, diskon, created_at')
    .eq('kode_promo', kode)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

// Cek apakah ada minimal 1 kode promo yang masih aktif (buat nampilin/nyembunyiin box kode di form daftar)
export const adaPromoAktif = async (): Promise<boolean> => {
  const { count, error } = await supabase
    .from('promo')
    .select('*', { count: 'exact', head: true })
    .eq('aktif', true)
  if (error) throw error
  return (count ?? 0) > 0
}

// Validasi kode promo yang diketik orang tua di form daftar
export const validasiPromo = async (kode: string): Promise<PromoInfo | null> => {
  const { data, error } = await supabase
    .from('promo')
    .select('*')
    .eq('kode', kode.trim().toUpperCase())
    .eq('aktif', true)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  if (data.terpakai >= data.kuota) return null // kuota abis dianggap expired
  return data
}

// Dipanggil setelah pendaftaran berhasil disubmit dengan kode promo valid
export const pakaiPromo = async (id: string, terpakaiSekarang: number, kuota: number) => {
  const terpakaiBaru = terpakaiSekarang + 1
  const { error } = await supabase
    .from('promo')
    .update({ terpakai: terpakaiBaru, aktif: terpakaiBaru < kuota })
    .eq('id', id)
  if (error) throw error
}

// ── Setting Harga (admin-editable, dipakai form pendaftaran & halaman Slot) ─

export const getHargaSetting = async (): Promise<HargaSetting> => {
  const { data, error } = await supabase
    .from('harga_setting')
    .select('*')
    .eq('id', 'default')
    .maybeSingle()
  if (error) {
    // Tabel belum ada / belum di-migrate — fallback ke default biar gak crash
    return DEFAULT_HARGA_SETTING
  }
  if (!data) return DEFAULT_HARGA_SETTING
  return {
    semi_privat_normal: data.semi_privat_normal ?? DEFAULT_HARGA_SETTING.semi_privat_normal,
    semi_privat_abk: data.semi_privat_abk ?? DEFAULT_HARGA_SETTING.semi_privat_abk,
    eksklusif_normal: data.eksklusif_normal ?? DEFAULT_HARGA_SETTING.eksklusif_normal,
    eksklusif_abk: data.eksklusif_abk ?? DEFAULT_HARGA_SETTING.eksklusif_abk,
    adik_kakak_normal: data.adik_kakak_normal ?? DEFAULT_HARGA_SETTING.adik_kakak_normal,
    adik_kakak_abk: data.adik_kakak_abk ?? DEFAULT_HARGA_SETTING.adik_kakak_abk,
  }
}

export const updateHargaSetting = async (setting: HargaSetting) => {
  const { error } = await supabase
    .from('harga_setting')
    .upsert({ id: 'default', ...setting, updated_at: new Date().toISOString() })
  if (error) throw error
}