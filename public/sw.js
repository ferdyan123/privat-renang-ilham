// SwimTrack Service Worker — notifikasi murid siap tagih
const CACHE_NAME = 'swimtrack-v1'

self.addEventListener('install', (e) => {
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim())
})

// Handle push notifications
self.addEventListener('push', (e) => {
  const data = e.data?.json() ?? {}
  const options = {
    body: data.body || 'Ada notifikasi baru di SwimTrack',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/dashboard' },
    actions: [
      { action: 'open', title: 'Buka Dashboard' },
      { action: 'close', title: 'Tutup' }
    ]
  }
  e.waitUntil(
    self.registration.showNotification(data.title || 'SwimTrack', options)
  )
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  if (e.action === 'close') return
  const url = e.notification.data?.url || '/dashboard'
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(url) && 'focus' in client) return client.focus()
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
