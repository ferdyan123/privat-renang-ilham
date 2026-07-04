'use client'
import { useEffect } from 'react'

export default function NotificationSetup() {
  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(console.error)
    }

    // Minta izin notifikasi jika belum
    if ('Notification' in window && Notification.permission === 'default') {
      // Delay 3 detik biar user settle dulu
      const timer = setTimeout(() => {
        Notification.requestPermission().then((permission) => {
          if (permission === 'granted') {
            new Notification('Privat Renang Ilham aktif! 🏊', {
              body: 'Notifikasi tagihan murid akan muncul di sini.',
              icon: '/icon-192.png',
            })
          }
        })
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [])

  return null
}

// Helper: kirim notifikasi lokal (tanpa server push)
export const sendLocalNotif = (title: string, body: string, url = '/dashboard') => {
  if ('Notification' in window && Notification.permission === 'granted') {
    const n = new Notification(title, {
      body,
      icon: '/icon-192.png',
      tag: 'privat-renang-ilham-notif',
    })
    n.onclick = () => {
      window.focus()
      n.close()
    }
  }
}