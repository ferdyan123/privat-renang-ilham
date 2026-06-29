'use client'
import { useEffect, useState } from 'react'

export type ToastType = 'default' | 'success' | 'error'

interface ToastState {
  message: string
  type: ToastType
  visible: boolean
}

let _setToast: ((msg: string, type: ToastType) => void) | null = null

export function showToast(msg: string, type: ToastType = 'default') {
  _setToast?.(msg, type)
}

export function ToastProvider() {
  const [toast, setToast] = useState<ToastState>({ message: '', type: 'default', visible: false })
  let timer: ReturnType<typeof setTimeout>

  _setToast = (msg, type) => {
    clearTimeout(timer)
    setToast({ message: msg, type, visible: true })
    timer = setTimeout(() => setToast((t) => ({ ...t, visible: false })), 2800)
  }

  const bgColor =
    toast.type === 'success' ? 'bg-green' :
    toast.type === 'error'   ? 'bg-red'   : 'bg-[#2C2C2A]'

  return (
    <div
      className={`fixed bottom-5 left-1/2 -translate-x-1/2 ${bgColor} text-white px-[18px] py-[9px] rounded-full text-[13px] z-[300] whitespace-nowrap pointer-events-none transition-opacity duration-200 ${toast.visible ? 'opacity-100' : 'opacity-0'}`}
    >
      {toast.message}
    </div>
  )
}
