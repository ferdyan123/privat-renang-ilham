'use client'
import { useEffect } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

export default function Modal({ open, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 bg-black/45 flex items-end justify-center z-[100]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-bg w-full max-w-[680px] max-h-[90vh] overflow-y-auto rounded-t-[14px] p-5 animate-slide-up">
        <div className="w-9 h-1 bg-border rounded mx-auto mb-4" />
        <div className="text-[15px] font-semibold mb-4 text-text">{title}</div>
        {children}
      </div>
    </div>
  )
}
