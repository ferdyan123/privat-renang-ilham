'use client'
import { useEffect, useState } from 'react'
import { getMurid, addMurid, deleteMurid, Murid } from '@/lib/supabase'
import { PAKET_LIST, KATEGORI_LIST } from '@/lib/utils'
import { showToast } from '@/components/ui/Toast'
import Modal from '@/components/ui/Modal'
import Avatar from '@/components/ui/Avatar'

export default function MuridPage() {
  const [list, setList] = useState<Murid[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    nama: '', paket: PAKET_LIST[0], wa_ortu: '', kategori: 'normal' as 'normal' | 'abk'
  })

  const load = async () => {
    setLoading(true)
    try { setList(await getMurid()) }
    catch (e: any) { showToast('Gagal load murid: ' + (e?.message || ''), 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const filtered = list.filter((m) =>
    m.nama.toLowerCase().includes(search.toLowerCase())
  )

  const handleAdd = async () => {
    if (!form.nama.trim()) { showToast('Nama harus diisi'); return }
    setSaving(true)
    try {
      await addMurid(form)
      showToast('Murid ditambahkan ✓', 'success')
      setShowAdd(false)
      setForm({ nama: '', paket: PAKET_LIST[0], wa_ortu: '', kategori: 'normal' })
      load()
    } catch (e: any) {
      showToast('Gagal: ' + (e?.message || 'cek konsol'), 'error')
      console.error(e)
    }
    finally { setSaving(false) }
  }

  const handleDelete = async (m: Murid) => {
    if (!confirm(`Hapus ${m.nama}? Data absensi tetap tersimpan.`)) return
    try {
      await deleteMurid(m.id)
      showToast(`${m.nama} dihapus`)
      load()
    } catch (e: any) { showToast('Gagal hapus: ' + e?.message, 'error') }
  }

  const normalCount = list.filter((m) => m.kategori !== 'abk').length
  const abkCount = list.filter((m) => m.kategori === 'abk').length

  return (
    <div className="max-w-[720px] mx-auto">
      {/* Search + add */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1 relative">
          <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-base" />
          <input
            className="w-full pl-9 pr-3 py-2 border border-border rounded-md text-sm bg-bg text-text placeholder:text-text-muted"
            placeholder="Cari murid..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 bg-[#185FA5] text-white px-3 py-2 rounded-md text-sm font-medium"
        >
          <i className="ti ti-plus text-base" />Tambah
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-blue-light border border-blue/20 rounded-md px-3 py-2 text-center">
          <div className="text-[18px] font-bold text-blue">{list.length}</div>
          <div className="text-[11px] text-text-muted">Total aktif</div>
        </div>
        <div className="bg-bg border border-border rounded-md px-3 py-2 text-center">
          <div className="text-[18px] font-bold text-text">{normalCount}</div>
          <div className="text-[11px] text-text-muted">Normal</div>
        </div>
        <div className="bg-yellow/10 border border-yellow/20 rounded-md px-3 py-2 text-center">
          <div className="text-[18px] font-bold text-yellow">{abkCount}</div>
          <div className="text-[11px] text-text-muted">ABK</div>
        </div>
      </div>

      {loading && (
        <div className="text-center py-12 text-text-muted text-sm">
          <i className="ti ti-loader-2 text-3xl block mb-2 animate-spin" />Memuat...
        </div>
      )}

      {/* List */}
      <div className="flex flex-col gap-2">
        {filtered.map((m) => (
          <div key={m.id} className="bg-bg border border-border rounded-lg px-4 py-3 flex items-center gap-3 shadow-sm">
            <Avatar nama={m.nama} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="text-[14px] font-semibold text-text truncate">{m.nama}</div>
                {m.kategori === 'abk' && (
                  <span className="bg-yellow/10 text-yellow text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0">ABK</span>
                )}
              </div>
              <div className="text-[12px] text-text-muted">{m.paket}</div>
            </div>
            <div className="flex items-center gap-2">
              {m.wa_ortu && (
                <a
                  href={`https://wa.me/62${m.wa_ortu.replace(/^0/, '')}`}
                  target="_blank"
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-[#E6F1FB] text-blue hover:bg-blue hover:text-white transition-all"
                >
                  <i className="ti ti-brand-whatsapp text-base" />
                </a>
              )}
              <button
                onClick={() => handleDelete(m)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-red/10 text-text-muted hover:text-red transition-all"
              >
                <i className="ti ti-trash text-base" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {!loading && filtered.length === 0 && (
        <div className="text-center py-12 text-text-muted">
          <i className="ti ti-users text-4xl block mb-2 opacity-40" />
          <p className="text-sm">{search ? 'Murid tidak ditemukan' : 'Belum ada murid aktif'}</p>
        </div>
      )}

      {/* Modal tambah */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Tambah Murid Baru">
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-[12px] text-text-muted block mb-1">Nama murid</label>
            <input type="text" placeholder="Nama lengkap"
              value={form.nama}
              onChange={(e) => setForm({ ...form, nama: e.target.value })}
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-bg text-text" />
          </div>

          <div>
            <label className="text-[12px] text-text-muted block mb-1">No. WA orang tua</label>
            <input type="tel" placeholder="08xxxxxxxxxx"
              value={form.wa_ortu}
              onChange={(e) => setForm({ ...form, wa_ortu: e.target.value })}
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-bg text-text" />
          </div>

          <div>
            <label className="text-[12px] text-text-muted block mb-2">Paket</label>
            <div className="flex flex-col gap-1.5">
              {PAKET_LIST.map((p) => (
                <button key={p} onClick={() => setForm({ ...form, paket: p })}
                  className={`text-left px-3 py-2 rounded-md border text-[13px] transition-all ${form.paket === p ? 'bg-blue-light border-blue text-blue font-semibold' : 'border-border text-text'}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[12px] text-text-muted block mb-2">Kategori murid</label>
            <div className="grid grid-cols-2 gap-2">
              {KATEGORI_LIST.map((k) => (
                <button key={k.value} onClick={() => setForm({ ...form, kategori: k.value as 'normal' | 'abk' })}
                  className={`py-2.5 px-3 rounded-md border text-[12px] font-medium text-left transition-all ${form.kategori === k.value
                    ? k.value === 'abk' ? 'bg-yellow/10 border-yellow text-yellow' : 'bg-blue-light border-blue text-blue'
                    : 'border-border text-text-muted'}`}>
                  <div className="font-semibold">{k.value === 'normal' ? '🏊' : '⭐'} {k.value === 'normal' ? 'Normal' : 'ABK'}</div>
                  <div className="text-[10px] mt-0.5 opacity-70">{k.value === 'normal' ? 'Anak reguler' : 'Berkebutuhan khusus'}</div>
                </button>
              ))}
            </div>
          </div>

          <button onClick={handleAdd} disabled={saving}
            className="w-full bg-[#185FA5] text-white rounded-md py-2.5 text-sm font-semibold mt-1 hover:bg-[#0C447C] disabled:opacity-50 transition-all">
            {saving ? 'Menyimpan...' : 'Tambah Murid'}
          </button>
        </div>
      </Modal>
    </div>
  )
}