// Runs before the app module so a failed app bootstrap cannot prevent PWA updates.
(() => {
  if (!('serviceWorker' in navigator)) return;
  window.__cityRouteSwBootstrapped = true;
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    location.reload();
  });
  navigator.serviceWorker.register('./service-worker.js', {updateViaCache: 'none'})
    .then(registration => registration.update())
    .catch(error => console.warn('City Route: PWA update unavailable', error));
})();
