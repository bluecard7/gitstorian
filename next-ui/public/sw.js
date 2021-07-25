const CACHE_NAME = 'response-cache-v1'

self.addEventListener("activate", event => {
  event.waitUntil(caches.open(CACHE_NAME))
})

// todo: StorageEstimate API to evict entries as needed
self.addEventListener("fetch", event => {
  const { request } = event
  event.respondWith(
    caches.open(CACHE_NAME).then(cache => 
      cache.match(request.url).then(res => {
        if (res) return res
        console.log('not found !!!')
        return fetch(request).then(res => {
          cache.put(request.url, res.clone())
          return res
        })
      })
    )
  )
})
