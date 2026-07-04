// ── Auth sederhana (client-side, tanpa backend) ─────────────────────────────
// Password disimpan sebagai hash SHA-256, bukan teks polos, biar nggak
// langsung kebaca kalau ada yang buka source/bundle JS-nya.
// Ini BUKAN keamanan tingkat enterprise — cukup buat mengunci akses dashboard
// dari orang random yang nemu link-nya, sama seperti pola akses Supabase
// (anon key) yang dipakai app ini.

const AUTH_KEY = 'pri_auth_v1'
const ADMIN_EMAIL = 'muhammadnurilhamaulia@gmail.com'
// Hash SHA-256 dari password admin (bukan password aslinya)
const ADMIN_PASSWORD_HASH = 'b31984046c568f1fac1e6b56298a78cc11b608920db7e6d60bb22bf57cac34cb'

const sha256 = async (text: string): Promise<string> => {
  const enc = new TextEncoder().encode(text)
  const buf = await crypto.subtle.digest('SHA-256', enc)
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export const login = async (email: string, password: string): Promise<boolean> => {
  const hash = await sha256(password)
  const ok = email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase() && hash === ADMIN_PASSWORD_HASH
  if (ok && typeof window !== 'undefined') {
    localStorage.setItem(AUTH_KEY, '1')
  }
  return ok
}

export const isLoggedIn = (): boolean => {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(AUTH_KEY) === '1'
}

export const logout = () => {
  if (typeof window !== 'undefined') localStorage.removeItem(AUTH_KEY)
}