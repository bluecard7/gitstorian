const CACHE_NAME = 'response-cache-v1'

self.addEventListener("activate", event => {
  event.waitUntil(Promise.all([
    caches.open(CACHE_NAME),
    clients.claim(), // allows caching on first load
  ]))
})

// Problem: caching initial /commits hit 
// prevents switching b/n different repos.
// Will prevent caching initial hit for now, 
// is there a better way?
const cacheable = url => {
  if (url.includes("diffs") || url.includes("raw")) {
    return true
  }
  if (url.includes("commits")) {
    const [lastPathPart] = url.split("/").slice(-1)
    return lastPathPart !== "commits"
  }
}

// todo: StorageEstimate API to evict entries as needed
// todo: clear cache on load?
self.addEventListener("fetch", event => {
  const { request } = event
  event.respondWith(
    caches.open(CACHE_NAME).then(cache => 
      cache.match(request.url).then(res => {
        if (res) return res
        return fetch(request).then(res => {
          if (cacheable(request.url))
            cache.put(request.url, res.clone())
          return res
        })
      })
    )
  )
})
