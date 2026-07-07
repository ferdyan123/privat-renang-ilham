'use client'
import { useEffect, useState } from 'react'
import { getPendingMembers, updatePendingStatus, addMurid, getTagihanPending, getTagihanHistory, updateTagihanStatus, PendingMember } from '@/lib/supabase'
import { showToast } from '@/components/ui/Toast'
import Avatar from '@/components/ui/Avatar'

type DaftarFilter = 'menunggu' | 'diterima' | 'ditolak'

export default function DaftarPage() {
  const [filter, setFilter] = useState<DaftarFilter>('menunggu')
  const [list, setList] = useState<PendingMember[]>([])
  const [tagihanList, setTagihanList] = useState<any[]>([])
  const [historyList, setHistoryList] = useState<any[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [historyFilter, setHistoryFilter] = useState<'semua' | 'lunas' | 'belum_bayar'>('semua')
  const [loading, setLoading] = useState(false)
  const [loadingTagihan, setLoadingTagihan] = useState(false)

  const loadPendaftaran = async () => {
    setLoading(true)
    try { setList(await getPendingMembers(filter)) }
    catch (e: any) {
      if (e?.code === '42P01') setList([])
      else showToast('Gagal load pendaftaran', 'error')
    }
    finally { setLoading(false) }
  }

  const loadTagihan = async () => {
    setLoadingTagihan(true)
    try { setTagihanList(await getTagihanPending()) }
    catch (e: any) {
      if (e?.code !== '42P01') showToast('Gagal load tagihan', 'error')
    }
    finally { setLoadingTagihan(false) }
  }

  const loadHistory = async () => {
    try { setHistoryList(await getTagihanHistory()) }
    catch (e: any) {
      if (e?.code !== '42P01') console.error(e)
    }
  }

  useEffect(() => { loadPendaftaran() }, [filter])
  useEffect(() => { loadTagihan(); loadHistory() }, [])

  const handleAcc = async (d: PendingMember) => {
    if (!confirm(`ACC pendaftaran ${d.nama_murid}?`)) return
    try {
      await updatePendingStatus(d.id, 'diterima')
      // Kolam disimpan sebagai teks di dalam catatan, format "Kolam: Kolam A"
      const kolamMatch = d.catatan?.match(/Kolam:\s*([^|]+)/)
      const kolam = kolamMatch ? kolamMatch[1].trim() : ''
      await addMurid({
        nama: d.nama_murid,
        paket: d.paket,
        wa_ortu: d.wa_ortu,
        kategori: 'normal',
        jadwal_hari: d.jadwal_hari,
        jadwal_jam: d.jadwal_jam,
        jadwal_kolam: kolam,
        harga: d.harga ?? 0,
        jumlah_sesi: d.jumlah_sesi ?? 4,
        pemilik: d.pemilik || 'Ilham',
      })
      showToast(`${d.nama_murid} diterima ✓`, 'success')
      loadPendaftaran()
    } catch { showToast('Gagal acc', 'error') }
  }

  const handleTolak = async (d: PendingMember) => {
    if (!confirm(`Tolak pendaftaran ${d.nama_murid}?`)) return
    try {
      await updatePendingStatus(d.id, 'ditolak')
      showToast('Ditolak')
      loadPendaftaran()
    } catch { showToast('Gagal tolak', 'error') }
  }

  const handleKonfirmasiTagihan = async (t: any) => {
    if (!confirm(`Konfirmasi pembayaran ${t.murid?.nama} siklus #${t.siklus}?`)) return
    try {
      await updateTagihanStatus(t.id, 'lunas')
      showToast(`Pembayaran ${t.murid?.nama} dikonfirmasi ✓ — Siklus baru dimulai`, 'success')
      loadTagihan()
      loadHistory()
    } catch { showToast('Gagal konfirmasi', 'error') }
  }

  const handleTolakTagihan = async (t: any) => {
    if (!confirm(`Tolak bukti pembayaran ${t.murid?.nama}? Mereka perlu upload ulang.`)) return
    try {
      await updateTagihanStatus(t.id, 'belum_bayar')
      showToast('Bukti ditolak, murid perlu upload ulang')
      loadTagihan()
      loadHistory()
    } catch { showToast('Gagal tolak', 'error') }
  }

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      menunggu: 'bg-yellow/10 text-yellow',
      diterima: 'bg-green/10 text-green',
      ditolak: 'bg-red/10 text-red',
    }
    const lbl: Record<string, string> = {
      menunggu: 'Menunggu', diterima: 'Diterima', ditolak: 'Ditolak'
    }
    return <span className={`${map[s] ?? 'bg-bg-2 text-text-muted'} text-[11px] font-semibold px-2 py-0.5 rounded-full`}>{lbl[s] ?? s}</span>
  }

  return (
    <div className="max-w-[720px] mx-auto">

      {/* ── SECTION 1: TAGIHAN MASUK ── */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[14px] font-semibold text-text">Tagihan Masuk</div>
            <div className="text-[12px] text-text-muted">Bukti pembayaran yang menunggu konfirmasi</div>
          </div>
          {tagihanList.length > 0 && (
            <span className="bg-[#E24B4A] text-white text-[11px] font-bold px-2 py-0.5 rounded-full">{tagihanList.length}</span>
          )}
        </div>

        {loadingTagihan && (
          <div className="text-center py-6 text-text-muted text-sm">
            <i className="ti ti-loader-2 text-2xl block mb-1 animate-spin" />Memuat...
          </div>
        )}

        {!loadingTagihan && tagihanList.length === 0 && (
          <div className="bg-bg border border-border rounded-lg px-4 py-6 text-center text-text-muted">
            <i className="ti ti-inbox text-3xl block mb-2 opacity-30" />
            <div className="text-[13px]">Tidak ada tagihan yang menunggu konfirmasi</div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {tagihanList.map((t) => (
            <div key={t.id} className="bg-bg border border-yellow/30 rounded-lg p-4 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <Avatar nama={t.murid?.nama ?? '?'} />
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-semibold text-text">{t.murid?.nama}</div>
                  <div className="text-[12px] text-text-muted">{t.murid?.paket} · Siklus #{t.siklus} · {t.jumlah_hadir}x hadir</div>
                </div>
                <span className="bg-yellow/10 text-yellow text-[11px] font-semibold px-2 py-0.5 rounded-full">⏳ Menunggu</span>
              </div>

              {t.bukti_tf_url && (
                <a href={t.bukti_tf_url} target="_blank"
                  className="flex items-center gap-1.5 text-[12px] text-blue mb-3 hover:underline w-fit">
                  <i className="ti ti-photo text-sm" />Lihat bukti pembayaran
                </a>
              )}

              <div className="flex gap-2">
                <button onClick={() => handleTolakTagihan(t)}
                  className="flex-1 flex items-center justify-center gap-1.5 border border-red/30 text-red text-[13px] font-medium py-2 rounded-md hover:bg-red/5 transition-all">
                  <i className="ti ti-x text-sm" />Tolak
                </button>
                <button onClick={() => handleKonfirmasiTagihan(t)}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-green text-white text-[13px] font-semibold py-2 rounded-md hover:bg-green/90 transition-all">
                  <i className="ti ti-check text-sm" />Konfirmasi Lunas
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Toggle History Pembayaran */}
      <div className="mb-6">
        <button onClick={() => setShowHistory(!showHistory)}
          className="flex items-center gap-1.5 text-[12px] text-text-muted hover:text-text mb-3">
          <i className={`ti ti-chevron-${showHistory ? 'down' : 'right'} text-sm`} />
          Riwayat Pembayaran ({historyList.length})
        </button>

        {showHistory && (
          <>
            {/* Filter chips — sama seperti pendaftaran murid baru */}
            <div className="flex gap-2 mb-3">
              {(['semua', 'lunas', 'belum_bayar'] as const).map((f) => (
                <button key={f} onClick={() => setHistoryFilter(f)}
                  className={`px-3 py-1.5 rounded-full text-[12px] font-medium border transition-all ${historyFilter === f ? 'bg-[#185FA5] text-white border-[#185FA5]' : 'border-border text-text-muted hover:border-blue'}`}>
                  {f === 'semua' ? 'Semua' : f === 'lunas' ? 'Lunas' : 'Belum Bayar'}
                </button>
              ))}
              <button onClick={loadHistory} className="ml-auto text-[12px] text-text-muted flex items-center gap-1 hover:text-text">
                <i className="ti ti-refresh text-sm" />Refresh
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {historyList
                .filter((t) => historyFilter === 'semua' || t.status === historyFilter)
                .map((t) => (
                <div key={t.id} className="bg-bg border border-border rounded-lg px-3 py-2.5 flex items-center gap-3 shadow-sm">
                  <Avatar nama={t.murid?.nama ?? '?'} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-text">{t.murid?.nama}</div>
                    <div className="text-[11px] text-text-muted">{t.murid?.paket} · Siklus #{t.siklus} · {t.jumlah_hadir}x hadir</div>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                    t.status === 'lunas' ? 'bg-green/10 text-green' : 'bg-bg-2 text-text-muted'
                  }`}>
                    {t.status === 'lunas' ? '✓ Lunas' : 'Belum bayar'}
                  </span>
                  {t.bukti_tf_url && (
                    <a href={t.bukti_tf_url} target="_blank" className="text-blue flex-shrink-0">
                      <i className="ti ti-photo text-sm" />
                    </a>
                  )}
                </div>
              ))}

              {historyList.filter((t) => historyFilter === 'semua' || t.status === historyFilter).length === 0 && (
                <div className="text-center py-6 text-text-muted text-[12px]">
                  Tidak ada data {historyFilter === 'semua' ? '' : historyFilter === 'lunas' ? 'yang lunas' : 'yang belum bayar'}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-px bg-border" />
        <span className="text-[11px] text-text-muted font-medium uppercase tracking-wide">Pendaftaran Murid Baru</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* ── SECTION 2: PENDAFTARAN ── */}
      <div className="text-[12px] text-text-muted mb-3">Calon murid menunggu konfirmasi admin</div>

      <div className="flex gap-2 mb-4">
        {(['menunggu', 'diterima', 'ditolak'] as DaftarFilter[]).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-[12px] font-medium border transition-all capitalize ${filter === f ? 'bg-[#185FA5] text-white border-[#185FA5]' : 'border-border text-text-muted hover:border-blue'}`}>
            {f === 'menunggu' ? 'Menunggu' : f === 'diterima' ? 'Diterima' : 'Ditolak'}
          </button>
        ))}
        <button onClick={loadPendaftaran} className="ml-auto text-[12px] text-text-muted flex items-center gap-1 hover:text-text">
          <i className="ti ti-refresh text-sm" />Refresh
        </button>
      </div>

      {loading && (
        <div className="text-center py-8 text-text-muted text-sm">
          <i className="ti ti-loader-2 text-2xl block mb-1 animate-spin" />Memuat...
        </div>
      )}

      {!loading && list.length === 0 && (
        <div className="text-center py-10 text-text-muted">
          <i className="ti ti-user-check text-4xl block mb-2 opacity-40" />
          <p className="text-sm">
            {filter === 'menunggu' ? 'Tidak ada pendaftaran yang menunggu' : `Tidak ada data ${filter}`}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {list.map((d) => {
          const tgl = new Date(d.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
          return (
            <div key={d.id} className="bg-bg border border-border rounded-lg p-4 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <Avatar nama={d.nama_murid} />
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-semibold text-text">{d.nama_murid}</div>
                  <div className="text-[12px] text-text-muted flex items-center gap-2 flex-wrap">
                    {tgl} · {statusBadge(d.status)}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                {[
                  { label: 'Usia', val: `${d.usia} tahun` },
                  { label: 'Paket', val: d.paket },
                  { label: 'Orang tua', val: d.nama_ortu },
                  { label: 'No. WA', val: d.wa_ortu || '—' },
                  { label: 'Jadwal', val: `${d.jadwal_hari || '—'} ${d.jadwal_jam || ''}`.trim() },
                  { label: 'Catatan', val: d.catatan || '—' },
                ].map((item) => (
                  <div key={item.label} className="bg-bg-2 rounded-md p-2.5">
                    <div className="text-[10px] text-text-muted uppercase tracking-wide mb-0.5">{item.label}</div>
                    <div className="text-[12px] font-medium text-text truncate">{item.val}</div>
                  </div>
                ))}
              </div>
              {d.bukti_tf_url ? (
                <a href={d.bukti_tf_url} target="_blank"
                  className="inline-flex items-center gap-1.5 text-[12px] text-blue mb-3 hover:underline">
                  <i className="ti ti-photo text-sm" />Lihat bukti pembayaran
                </a>
              ) : (
                <div className="text-[12px] text-text-muted mb-3">Belum ada bukti pembayaran</div>
              )}
              {d.status === 'menunggu' && (
                <div className="flex gap-2">
                  <button onClick={() => handleTolak(d)}
                    className="flex-1 flex items-center justify-center gap-1.5 border border-red/30 text-red text-[13px] font-medium py-2 rounded-md hover:bg-red/5 transition-all">
                    <i className="ti ti-x text-sm" />Tolak
                  </button>
                  <button onClick={() => handleAcc(d)}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-green text-white text-[13px] font-semibold py-2 rounded-md hover:bg-green/90 transition-all">
                    <i className="ti ti-check text-sm" />ACC & Tambah Murid
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

    </div>
  )
}