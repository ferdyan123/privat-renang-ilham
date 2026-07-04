'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { login, isLoggedIn } from '@/lib/auth'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(true)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (isLoggedIn()) {
      router.replace('/dashboard')
    } else {
      setChecking(false)
    }
  }, [router])

  const handleLogin = async () => {
    setError('')
    if (!email.trim() || !password) {
      setError('Email dan password harus diisi')
      return
    }
    setLoading(true)
    try {
      const ok = await login(email, password)
      if (ok) {
        router.replace('/dashboard')
      } else {
        setError('Email atau password salah')
      }
    } finally {
      setLoading(false)
    }
  }

  if (checking) return null

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#E6F4FB] p-4">
      <div className="bg-white rounded-xl shadow-sm p-6 w-full max-w-[360px]">
        <div className="flex items-center gap-2 mb-6 justify-center">
          <div className="w-9 h-9 bg-[#185FA5] rounded-md flex items-center justify-center flex-shrink-0">
            <i className="ti ti-ripple text-white text-xl" />
          </div>
          <span className="text-[16px] font-semibold text-text">Privat Renang Ilham</span>
        </div>

        <label className="text-[12px] text-text-muted block mb-1">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          className="w-full border border-border rounded-md px-3 py-2 text-sm mb-3 bg-bg text-text"
          placeholder="email@contoh.com"
          autoComplete="username"
        />

        <label className="text-[12px] text-text-muted block mb-1">Password</label>
        <div className="relative mb-1">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            className="w-full border border-border rounded-md px-3 py-2 pr-10 text-sm bg-bg text-text"
            placeholder="••••••••"
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-text-muted hover:text-text transition-all"
            tabIndex={-1}
          >
            <i className={`ti ${showPassword ? 'ti-eye-off' : 'ti-eye'} text-[17px]`} />
          </button>
        </div>

        {error && <div className="text-[12px] text-red mt-1 mb-2">{error}</div>}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-[#185FA5] text-white rounded-md py-2.5 text-sm font-semibold mt-3 hover:bg-[#0C447C] disabled:opacity-50 transition-all"
        >
          {loading ? 'Memeriksa...' : 'Masuk'}
        </button>
      </div>
    </div>
  )
}