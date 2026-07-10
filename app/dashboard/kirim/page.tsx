'use client'
import { useEffect, useState, Suspense, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { getMurid, getSesi, createTagihan, getSiklusBerjalan, Murid, Sesi } from '@/lib/supabase'
import { fmtShort, fmtRupiah, getRekeningByPemilik } from '@/lib/utils'
import { showToast } from '@/components/ui/Toast'
import Avatar from '@/components/ui/Avatar'
import { supabase } from '@/lib/supabase'

interface SiklusInfo {
  sesiHadir: string[]
  jumlahTarget: number
  siapTagih: boolean
  siklusBerikutnya: number
  sesiDetail: Sesi[]
}

// Jumlah hadir (sesi yang belum masuk tagihan, status hadir) per murid
// dipakai buat sorting. Dipanggil paralel biar cepat.
async function getJumlahHadirMurid(muridId: string): Promise<number> {
  try {
    const { data: tagihanLunas } = await supabase
      .from('tagihan').select('sesi_ids')
      .eq('murid_id', muridId).in('status', ['lunas', 'menunggu_konfirmasi'])
    const sudahDibayar = new Set<string>((tagihanLunas ?? []).flatMap((t: any) => t.sesi_ids ?? []))
    const { data } = await supabase
      .from('absensi').select('sesi_id').eq('murid_id', muridId).eq('status', 'hadir')
    return ((data ?? []) as any[]).filter((a) => !sudahDibayar.has(a.sesi_id)).length
  } catch { return 0 }
}

export default function KirimPage() {
  return (
    <Suspense fallback={<div className="text-center py-12 text-text-muted text-sm"><i className="ti ti-loader-2 text-3xl block mb-2 animate-spin" />Memuat...</div>}>
      <KirimPageContent />
    </Suspense>
  )
}

function KirimPageContent() {
  const searchParams = useSearchParams()

  // ── State utama ────────────────────────────────────────────────
  const [muridList, setMuridList] = useState<Murid[]>([])
  const [hadirMap, setHadirMap] = useState<Record<string, number>>({})  // murid_id → jumlah hadir
  const [loadingList, setLoadingList] = useState(true)

  const [tab, setTab] = useState<'4x' | '8x' | 'adik_kakak'>('4x')
  const [selectedKey, setSelectedKey] = useState('')   // murid.id ATAU kelompok_adik_kakak
  const [siklus, setSiklus] = useState<SiklusInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generatedLink, setGeneratedLink] = useState('')

  // ── Load murid + jumlah hadir ──────────────────────────────────
  useEffect(() => {
    const init = async () => {
      setLoadingList(true)
      try {
        const list = await getMurid()
        setMuridList(list)

        // Load jumlah hadir paralel buat semua murid
        const entries = await Promise.all(list.map(async (m) => {
          const n = await getJumlahHadirMurid(m.id)
          return [m.id, n] as [string, number]
        }))
        setHadirMap(Object.fromEntries(entries))

        // Auto-select dari query param ?murid=
        const muridParam = searchParams.get('murid')
        if (muridParam && list.some((m) => m.id === muridParam)) {
          const m = list.find((m) => m.id === muridParam)!
          const tabBaru = m.kelompok_adik_kakak ? 'adik_kakak' : m.paket.includes('8') ? '8x' : '4x'
          setTab(tabBaru)
          const key = m.kelompok_adik_kakak || m.id
          setSelectedKey(key)
          checkSiklusForKey(key, list)
        }
      } catch {
        showToast('Gagal load murid', 'error')
      } finally {
        setLoadingList(false)
      }
    }
    init()
  }, [])

  // ── Grouping Adik Kakak & sorting ─────────────────────────────
  // "Entitas" = 1 murid biasa ATAU 1 grup Adik Kakak (N anak, 1 baris UI)
  type Entitas = { key: string; members: Murid[] }

  const entitasByTab = useMemo<Entitas[]>(() => {
    // Pisahkan by tab
    const byTab = muridList.filter((m) => {
      if (tab === 'adik_kakak') return !!m.kelompok_adik_kakak
      if (tab === '8x') return !m.kelompok_adik_kakak && (m.jumlah_sesi === 8 || m.paket.includes('8'))
      return !m.kelompok_adik_kakak && !(m.jumlah_sesi === 8 || m.paket.includes('8'))
    })

    // Grouping
    const seen = new Set<string>()
    const entitas: Entitas[] = []
    byTab.forEach((m) => {
      const key = m.kelompok_adik_kakak || m.id
      if (seen.has(key)) return
      seen.add(key)
      const members = m.kelompok_adik_kakak
        ? byTab.filter((x) => x.kelompok_adik_kakak === key)
        : [m]
      entitas.push({ key, members })
    })

    // Sort: jumlah hadir terbanyak dulu (hadir = sum semua member di grup)
    return entitas.sort((a, b) => {
      const sumA = a.members.reduce((s, m) => s + (hadirMap[m.id] ?? 0), 0)
      const sumB = b.members.reduce((s, m) => s + (hadirMap[m.id] ?? 0), 0)
      return sumB - sumA  // descending
    })
  }, [muridList, hadirMap, tab])

  // ── Hitung hadir per entitas ───────────────────────────────────
  // Untuk group Adik Kakak: ambil MAX dari anggota (bukan sum), karena mereka
  // mengikuti sesi yang SAMA — jumlahnya semestinya identik tapi kalau ada
  // divergensi (mis. absensi lama sebelum sistem group), pakai yang terbesar.
  const hadirEntitas = (e: Entitas) =>
    Math.max(0, ...e.members.map((m) => hadirMap[m.id] ?? 0))

  // ── Cek siklus buat entitas yang dipilih ─────────────────────
  const checkSiklusForKey = async (key: string, list: Murid[] = muridList) => {
    setSelectedKey(key)
    setSiklus(null)
    setGeneratedLink('')
    if (!key) return
    setLoading(true)
    try {
      // Cari representative murid buat siklus (pakai anggota pertama)
      const representative = list.find((m) => (m.kelompok_adik_kakak || m.id) === key)
      if (!representative) return
      const info = await getSiklusBerjalan(representative.id, representative.paket)
      const sesiAll = await getSesi(500)
      const sesiDetail = sesiAll
        .filter((s) => info.sesiHadir.includes(s.id))
        .sort((a, b) => a.tanggal.localeCompare(b.tanggal))
      setSiklus({ ...info, sesiDetail })
    } catch (e: any) {
      showToast('Gagal cek siklus: ' + e?.message, 'error')
    } finally { setLoading(false) }
  }

  // Entitas yang sedang dipilih
  const selectedEntitas = entitasByTab.find((e) => e.key === selectedKey)
    ?? muridList.filter((m) => (m.kelompok_adik_kakak || m.id) === selectedKey)
        .reduce<Entitas | null>((_, m) => {
          const members = muridList.filter((x) => (x.kelompok_adik_kakak || x.id) === selectedKey)
          return { key: selectedKey, members }
        }, null)

  const muridRepresentative = selectedEntitas?.members[0] ?? null
  const namaDisplay = selectedEntitas?.members.map((m) => m.nama).join(' & ') ?? ''
  const REKENING = getRekeningByPemilik(muridRepresentative?.pemilik)

  const generateTagihan = async () => {
    if (!siklus || !muridRepresentative) return
    setGenerating(true)
    try {
      const sesiUntukTagihan = siklus.sesiHadir.slice(0, siklus.jumlahTarget)
      const tagihan = await createTagihan({
        murid_id: muridRepresentative.id,
        siklus: siklus.siklusBerikutnya,
        sesi_ids: sesiUntukTagihan,
        jumlah_hadir: sesiUntukTagihan.length,
        status: 'belum_bayar',
        bukti_tf_url: null,
        total_harga: muridRepresentative.harga ?? 0,
      })
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
      setGeneratedLink(`${appUrl}/kartu?tagihan=${tagihan.id}`)
      // Refresh hadir count representative setelah tagihan dibuat
      const n = await getJumlahHadirMurid(muridRepresentative.id)
      setHadirMap((prev) => ({ ...prev, [muridRepresentative.id]: n }))
      showToast('Tagihan berhasil dibuat ✓', 'success')
    } catch (e: any) {
      showToast('Gagal buat tagihan: ' + e?.message, 'error')
    } finally { setGenerating(false) }
  }

  const jadwalLabel = siklus?.sesiDetail[0]
    ? `${new Date(siklus.sesiDetail[0].tanggal + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long' })} ${siklus.sesiDetail[0].jam}:${siklus.sesiDetail[0].menit} · ${siklus.sesiDetail[0].kolam}`
    : '—'

  const kirimWA = () => {
    if (!generatedLink || !muridRepresentative || !siklus) return
    const harga = (selectedEntitas?.members.reduce((s, m) => s + (m.harga ?? 0), 0)) ?? 0
    const isGroup = (selectedEntitas?.members.length ?? 1) > 1
    const msg =
`*Tagihan Les Renang - Privat Renang Ilham* 🏊

Halo orang tua dari *${namaDisplay}* 👋

Berikut detail tagihan siklus #${siklus.siklusBerikutnya}:

👤 *Nama:* ${namaDisplay}
📦 *Paket:* ${muridRepresentative.paket}${isGroup ? ` (${selectedEntitas?.members.length} anak)` : ''} (${muridRepresentative.jumlah_sesi ?? 4}x/bulan)
📅 *Jadwal:* ${jadwalLabel}
✅ *Kehadiran:* ${siklus.jumlahTarget}x hadir
💰 *Total tagihan:* ${harga > 0 ? fmtRupiah(harga) : 'sesuai paket'}

💳 *Pembayaran:*
Silakan transfer ke:
Nama Rekening: ${REKENING.nama}
Bank: ${REKENING.bank}
No. Rekening: ${REKENING.nomor}

📋 *Lihat detail & upload bukti bayar:*
${generatedLink}

_Terima kasih! 💙_`

    const wa = muridRepresentative.wa_ortu ? '62' + muridRepresentative.wa_ortu.replace(/^0/, '') : ''
    if (!wa) { showToast('Nomor WA orang tua tidak ada', 'error'); return }
    window.open(`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const copyLink = () => {
    navigator.clipboard.writeText(generatedLink).then(() => showToast('Link disalin ✓', 'success'))
  }

  // ── Tab counts ─────────────────────────────────────────────────
  const count4x = useMemo(() => muridList.filter((m) => !m.kelompok_adik_kakak && !(m.jumlah_sesi === 8 || m.paket.includes('8'))).length, [muridList])
  const count8x = useMemo(() => muridList.filter((m) => !m.kelompok_adik_kakak && (m.jumlah_sesi === 8 || m.paket.includes('8'))).length, [muridList])
  const countAK = useMemo(() => {
    const keys = new Set(muridList.filter((m) => !!m.kelompok_adik_kakak).map((m) => m.kelompok_adik_kakak))
    return keys.size
  }, [muridList])

  const TABS: { key: typeof tab; label: string; count: number }[] = [
    { key: '4x', label: 'Paket 4x', count: count4x },
    { key: '8x', label: 'Paket 8x', count: count8x },
    { key: 'adik_kakak', label: 'Adik Kakak', count: countAK },
  ]

  return (
    <div className="max-w-[720px] mx-auto">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-xl mb-5 bg-[#E6F4FB]" style={{height:110}}>
        <svg className="absolute bottom-0 left-0 w-full" viewBox="0 0 400 50" preserveAspectRatio="none" style={{height:36}}>
          <path fill="#B8DEF0" fillOpacity="0.6"
            d="M0,25 C50,40 100,10 150,25 C200,40 250,10 300,25 C350,40 380,15 400,25 L400,50 L0,50 Z">
            <animate attributeName="d" dur="4s" repeatCount="indefinite"
              values="M0,25 C50,40 100,10 150,25 C200,40 250,10 300,25 C350,40 380,15 400,25 L400,50 L0,50 Z;
                      M0,18 C60,35 110,8 160,22 C210,38 260,8 310,22 C355,38 385,12 400,18 L400,50 L0,50 Z;
                      M0,25 C50,40 100,10 150,25 C200,40 250,10 300,25 C350,40 380,15 400,25 L400,50 L0,50 Z"/>
          </path>
        </svg>
        <div className="absolute" style={{bottom:28,left:0,animation:'swimRight 9s linear infinite'}}>
          <svg width="56" height="24" viewBox="0 0 64 28">
            <ellipse cx="32" cy="17" rx="13" ry="6" fill="#F9C784"/>
            <circle cx="47" cy="11" r="7" fill="#F9C784"/>
            <ellipse cx="47" cy="6" rx="7" ry="4" fill="#185FA5"/>
            <ellipse cx="19" cy="14" rx="9" ry="3.5" fill="#F9C784" transform="rotate(-18 19 14)">
              <animateTransform attributeName="transform" type="rotate" values="-18 19 14;-32 19 14;-18 19 14" dur="0.85s" repeatCount="indefinite"/>
            </ellipse>
            <ellipse cx="19" cy="21" rx="9" ry="3.5" fill="#F9C784" transform="rotate(18 19 21)">
              <animateTransform attributeName="transform" type="rotate" values="18 19 21;32 19 21;18 19 21" dur="0.85s" repeatCount="indefinite" begin="0.42s"/>
            </ellipse>
            <ellipse cx="17" cy="17" rx="11" ry="2.5" fill="#185FA5" transform="rotate(-12 17 17)">
              <animateTransform attributeName="transform" type="rotate" values="-12 17 17;-26 17 17;-12 17 17" dur="0.65s" repeatCount="indefinite"/>
            </ellipse>
            <ellipse cx="17" cy="22" rx="11" ry="2.5" fill="#185FA5" transform="rotate(12 17 22)">
              <animateTransform attributeName="transform" type="rotate" values="12 17 22;26 17 22;12 17 22" dur="0.65s" repeatCount="indefinite" begin="0.32s"/>
            </ellipse>
            <ellipse cx="30" cy="17" rx="9" ry="4.5" fill="#185FA5" opacity="0.65"/>
          </svg>
        </div>
        <style>{`@keyframes swimRight{0%{left:-70px}100%{left:calc(100% + 10px)}}`}</style>
        <div className="absolute top-4 left-5">
          <div className="text-[16px] font-bold text-[#0C447C]">Kirim Tagihan</div>
          <div className="text-[12px] text-[#185FA5]/70">Generate & kirim ke WhatsApp orang tua</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 mb-4 bg-bg-2 p-1 rounded-lg">
        {TABS.map((t) => (
          <button key={t.key}
            onClick={() => { setTab(t.key); setSelectedKey(''); setSiklus(null); setGeneratedLink('') }}
            className={`flex-1 py-2 rounded-md text-[12px] font-semibold transition-all flex items-center justify-center gap-1.5 ${tab === t.key ? 'bg-bg text-blue shadow-sm border border-border' : 'text-text-muted hover:text-text'}`}>
            {t.label}
            {t.count > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${tab === t.key ? 'bg-blue text-white' : 'bg-border text-text-muted'}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Daftar entitas berdasarkan tab, diurutkan jumlah hadir DESC */}
      <div className="bg-bg border border-border rounded-lg p-4 shadow-sm mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-[12px] text-text-muted">
            {tab === 'adik_kakak' ? 'Pilih grup' : 'Pilih murid'} — diurutkan jumlah hadir terbanyak
          </label>
          <span className="text-[10px] text-text-muted flex items-center gap-1">
            <i className="ti ti-arrows-sort text-[10px]" />Auto-sort: Hadir ↓
          </span>
        </div>

        {loadingList ? (
          <div className="text-center py-6 text-text-muted text-sm">
            <i className="ti ti-loader-2 text-xl block mb-1.5 animate-spin" />Memuat...
          </div>
        ) : entitasByTab.length === 0 ? (
          <div className="text-center py-6 text-text-muted text-sm">
            Belum ada murid di kategori ini
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {entitasByTab.map((e, idx) => {
              const nama = e.members.map((m) => m.nama).join(' & ')
              const hadir = hadirEntitas(e)
              const first = e.members[0]
              const isSelected = selectedKey === e.key
              const isGroup = e.members.length > 1
              return (
                <button key={e.key} onClick={() => checkSiklusForKey(e.key)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left ${isSelected ? 'border-blue bg-blue-light' : 'border-border hover:border-blue/40'}`}>
                  {/* Rank badge */}
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${idx === 0 ? 'bg-blue text-white' : 'bg-border text-text-muted'}`}>
                    {idx + 1}
                  </div>
                  <Avatar nama={nama} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-text truncate flex items-center gap-1.5">
                      {nama}
                      {isGroup && <span className="text-[9px] bg-blue-light text-blue px-1 py-0.5 rounded-full flex-shrink-0 border border-blue/20">Adik Kakak</span>}
                    </div>
                    <div className="text-[11px] text-text-muted">{first.paket}</div>
                  </div>
                  {/* Hadir badge */}
                  <div className={`flex-shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full ${hadir > 0 ? 'bg-green/10 text-green' : 'bg-border/60 text-text-muted'}`}>
                    {hadir > 0 ? `${hadir}x hadir` : '0x'}
                  </div>
                  {isSelected && <i className="ti ti-check text-blue flex-shrink-0" />}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {loading && (
        <div className="text-center py-8 text-text-muted text-sm">
          <i className="ti ti-loader-2 text-2xl block mb-2 animate-spin" />Mengecek siklus...
        </div>
      )}

      {siklus && muridRepresentative && !loading && (
        <div className="bg-bg border border-border rounded-lg p-4 shadow-sm mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[14px] font-semibold text-text">Siklus #{siklus.siklusBerikutnya}</div>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${siklus.siapTagih ? 'bg-green/10 text-green' : 'bg-yellow/10 text-yellow'}`}>
              {siklus.siapTagih ? '✓ Siap tagih' : `${siklus.sesiHadir.length}/${siklus.jumlahTarget} hadir`}
            </span>
          </div>

          <div className="bg-bg-2 rounded-md px-3 py-2 mb-3 text-[12px] flex flex-wrap gap-x-4 gap-y-1">
            <div><span className="text-text-muted">Nama: </span><strong className="text-text">{namaDisplay}</strong></div>
            <div><span className="text-text-muted">Paket: </span><strong className="text-text">{muridRepresentative.paket} ({muridRepresentative.jumlah_sesi ?? 4}x)</strong></div>
            <div><span className="text-text-muted">Jadwal: </span><strong className="text-text">{jadwalLabel}</strong></div>
            {(selectedEntitas?.members.reduce((s, m) => s + (m.harga ?? 0), 0) ?? 0) > 0 && (
              <div><span className="text-text-muted">Tagihan: </span>
                <strong className="text-blue">{fmtRupiah(selectedEntitas!.members.reduce((s, m) => s + (m.harga ?? 0), 0))}</strong>
              </div>
            )}
          </div>

          <div className="mb-3">
            <div className="flex justify-between text-[11px] text-text-muted mb-1">
              <span>Kehadiran siklus ini</span>
              <span>{Math.min(siklus.sesiHadir.length, siklus.jumlahTarget)}/{siklus.jumlahTarget}</span>
            </div>
            <div className="h-2.5 bg-bg-3 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${siklus.siapTagih ? 'bg-green' : 'bg-blue'}`}
                style={{ width: `${Math.min(siklus.sesiHadir.length / siklus.jumlahTarget * 100, 100)}%` }} />
            </div>
          </div>

          {siklus.sesiDetail.length > 0 && (
            <div className="flex flex-col gap-1.5 mb-3">
              {siklus.sesiDetail.slice(0, siklus.jumlahTarget).map((s, i) => (
                <div key={s.id} className="flex items-center gap-2.5 bg-blue-light rounded-md px-3 py-2">
                  <span className="w-5 h-5 bg-blue rounded-full text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">{i+1}</span>
                  <span className="text-[12px] font-medium text-text">{fmtShort(s.tanggal)}</span>
                  <span className="text-[11px] text-text-muted">{s.jam}:{s.menit}</span>
                  <span className="text-[11px] text-text-muted ml-auto">{s.kolam}</span>
                </div>
              ))}
            </div>
          )}

          {siklus.sesiHadir.length === 0 && (
            <div className="text-center py-4 text-text-muted text-[13px] mb-3">Belum ada kehadiran di siklus ini</div>
          )}

          <div className="bg-blue-light border border-blue/10 rounded-md px-3 py-2.5 mb-3 text-[12px]">
            <div className="font-semibold text-blue mb-1">💳 Info Pembayaran (dikirim ke WA)</div>
            <div className="text-text-muted space-y-0.5">
              <div>Nama: <strong className="text-text">{REKENING.nama}</strong></div>
              <div>Bank: <strong className="text-text">{REKENING.bank}</strong></div>
              <div>No. Rek: <strong className="text-text font-mono">{REKENING.nomor}</strong></div>
            </div>
          </div>

          {siklus.siapTagih ? (
            !generatedLink ? (
              <button onClick={generateTagihan} disabled={generating}
                className="w-full bg-[#185FA5] text-white rounded-md py-2.5 text-[14px] font-semibold hover:bg-[#0C447C] disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                <i className="ti ti-file-invoice" />
                {generating ? 'Membuat tagihan...' : 'Buat & Generate Link Tagihan'}
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="bg-bg-2 border border-border rounded-md px-3 py-2 text-[12px] text-blue break-all">{generatedLink}</div>
                <div className="flex gap-2">
                  <button onClick={copyLink}
                    className="flex-1 flex items-center justify-center gap-1.5 border border-border text-text text-[13px] font-medium py-2 rounded-md hover:bg-bg-2 transition-all">
                    <i className="ti ti-copy" />Salin
                  </button>
                  <button onClick={kirimWA}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-[#25D366] text-white text-[13px] font-semibold py-2 rounded-md hover:bg-[#1ab254] transition-all">
                    <i className="ti ti-brand-whatsapp" />Kirim WA
                  </button>
                </div>
              </div>
            )
          ) : (
            <div className="text-center text-[12px] text-text-muted bg-bg-2 rounded-md py-3">
              Butuh <strong className="text-text">{siklus.jumlahTarget - siklus.sesiHadir.length}x hadir lagi</strong> untuk bisa tagih
            </div>
          )}
        </div>
      )}
    </div>
  )
}