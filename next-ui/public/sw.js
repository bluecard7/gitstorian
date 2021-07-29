const CACHE_NAME = 'response-cache-v1'

self.addEventListener("activate", event => {
  event.waitUntil(Promise.all([
    caches.open(CACHE_NAME),
    clients.claim(), // allows caching on first load
  ]))
})

// todo: StorageEstimate API to evict entries as needed
// todo: clear cache on load?
self.addEventListener("fetch", event => {
  const { request } = event
  event.respondWith(
    caches.open(CACHE_NAME).then(cache => 
      cache.match(request.url).then(res => {
        if (res) return res
        console.log('not found !!!', request.url)
        return fetch(request).then(res => {
          if (request.url.includes("localhost:8081")) 
            cache.put(request.url, res.clone())
          return res
        })
      })
    )
  )
})
