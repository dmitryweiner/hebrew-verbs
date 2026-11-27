interface ServiceWorkerHost {
  serviceWorker?: {
    controller: unknown;
    register: (url: string) => Promise<{ update: () => Promise<unknown> }>;
    addEventListener: (type: 'controllerchange', listener: () => void) => void;
  };
}

/**
 * Registers the offline worker once the page has loaded; failures only disable offline mode.
 * Phones resume a suspended page without a navigation, so the browser never looks for a new
 * worker by itself: we ask on every return to the foreground. When a new version takes control,
 * the page reloads to run it (the first worker of a fresh visit serves the same build, no reload).
 * While `busy()` (a game or a meeting) the reload waits for a route change that finds the page
 * free; the old page loads no hashed asset after its start, so it runs on under the new worker.
 */
export function registerServiceWorker(
  nav: ServiceWorkerHost,
  win: Pick<Window, 'addEventListener'> & { location: Pick<Location, 'reload'> },
  doc: Pick<Document, 'addEventListener' | 'visibilityState'>,
  busy: () => boolean = () => false,
): void {
  const sw = nav.serviceWorker;
  if (!sw) return;
  let controlled = Boolean(sw.controller);
  let waiting = false;
  const reloadWhenFree = () => {
    if (waiting && !busy()) win.location.reload();
  };
  sw.addEventListener('controllerchange', () => {
    waiting = controlled;
    controlled = true;
    reloadWhenFree();
  });
  win.addEventListener('hashchange', reloadWhenFree);
  win.addEventListener('load', () => {
    sw.register('./sw.js')
      .then((registration) => {
        doc.addEventListener('visibilitychange', () => {
          if (doc.visibilityState === 'visible') registration.update().catch(() => {});
        });
      })
      .catch(() => {});
  });
}
