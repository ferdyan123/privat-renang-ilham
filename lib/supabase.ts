import { createClient } from '@supabase/supabase-js'

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

export interface PendingMember {
  id: string
  nama_murid: string
  usia: number
  nama_ortu: string
  wa_ortu: string
  paket: string
  jadwal_hari: string
  jadwal_jam: string
  jumlah_sesi: number
  harga: number
  bukti_tf_url: string | null
  catatan: string | null
  status: 'menunggu' | 'diterima' | 'ditolak'
  created_at: string
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

export const addMurid = async (payload: Omit<Murid, 'id' | 'aktif'>): Promise<Murid> => {
  const { data, error } = await supabase
    .from('murid')
    .insert({ ...payload, aktif: true })
    .select()
    .single()
  if (error) throw error
  return data
}

export const deleteMurid = async (id: string) => {
  const { error } = await supabase.from('murid').update({ aktif: false }).eq('id', id)
  if (error) throw error
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

export interface SlotInfo {
  hari: string
  jam_mulai: string
  jam_selesai: string  // estimasi jam_mulai + 60 menit
  kolam: string
  status: 'tersedia' | 'penuh'
  kuota: number | null  // sisa kuota anak, null = belum pernah diisi
}

// Ambil semua slot unik dari sesi, gabungkan dengan status dari slot_status
export const getSlotDariJadwal = async (): Promise<SlotInfo[]> => {
  // Ambil semua sesi
  const { data: sesiData, error: sesiErr } = await supabase
    .from('sesi')
    .select('tanggal, jam, menit, durasi, kolam')
  if (sesiErr) throw sesiErr

  // Ambil status dari slot_status
  const { data: statusData } = await supabase
    .from('slot_status')
    .select('*')
  const statusMap: Record<string, 'tersedia' | 'penuh'> = {}
  const kuotaMap: Record<string, number | null> = {}
  ;(statusData ?? []).forEach((s: any) => {
    const key = `${s.hari}__${s.jam_mulai}__${s.kolam}`
    statusMap[key] = s.status
    kuotaMap[key] = s.kuota ?? null
  })

  // Deduplikasi: ambil kombinasi unik hari+jam+kolam dari sesi
  const HARI_ID = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu']
  const seen = new Set<string>()
  const slots: SlotInfo[] = []

  ;(sesiData ?? []).forEach((s: any) => {
    const d = new Date(s.tanggal + 'T00:00:00')
    const hari = HARI_ID[d.getDay()]
    const jam_mulai = `${s.jam}:${s.menit}`
    // Hitung jam selesai
    const totalMenit = parseInt(s.jam) * 60 + parseInt(s.menit) + (s.durasi ?? 60)
    const jam_selesai = `${String(Math.floor(totalMenit/60)%24).padStart(2,'0')}:${String(totalMenit%60).padStart(2,'0')}`
    const key = `${hari}__${jam_mulai}__${s.kolam}`
    if (!seen.has(key)) {
      seen.add(key)
      slots.push({
        hari,
        jam_mulai,
        jam_selesai,
        kolam: s.kolam,
        status: statusMap[key] ?? 'tersedia',
        kuota: kuotaMap[key] ?? null,
      })
    }
  })

  // Sort: by kolam, then hari order, then jam
  const HARI_ORDER = ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu']
  slots.sort((a, b) => {
    if (a.kolam !== b.kolam) return a.kolam.localeCompare(b.kolam)
    const hA = HARI_ORDER.indexOf(a.hari), hB = HARI_ORDER.indexOf(b.hari)
    if (hA !== hB) return hA - hB
    return a.jam_mulai.localeCompare(b.jam_mulai)
  })

  return slots
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