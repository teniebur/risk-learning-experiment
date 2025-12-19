const CACHE_NAME = 'risk-learning-v1';
const urlsToCache = [
  './mkturk.html',
  './mkturk_installsettings.js',
  './mkturk_dropbox.js',
  './mkturk_utils.js',
  './mkturk_ImageBuffer.js',
  './mkturk_TrialQueue.js',
  './mkturk_screenfunctions.js',
  './mkturk_eventlisteners.js',
  './mkturk_globalvariables.js',
  './mkturk_automator.js',
  './mkturk_bluetooth.js',
  './mkturk_usb.js',
  './risklearningexperimentlogo192.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      }
    )
  );
});
