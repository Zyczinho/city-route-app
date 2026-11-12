import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { readFileSync } from 'node:fs';

// User scenario: a guest builds a route, saves it, reloads the page and still finds it in saved routes.
// Guest-only and offline: Supabase is blocked, so no account, secret or production data is touched.
const places = JSON.parse(readFileSync('data/places.json', 'utf8')) as Array<{ id?: string; lat?: number; lng?: number; kind?: string }>;
const seed = places
  .filter((p) => p.id && Number.isFinite(p.lat) && Number.isFinite(p.lng) && p.kind !== 'hotel')
  .slice(0, 3)
  .map((p) => p.id as string);

test('zapisana trasa jest widoczna po odświeżeniu strony', async ({ app, browser }) => {
  expect(seed.length).toBe(3);
  await browser.route(/supabase\.co/, (route) => route.abort());
  // Seed only on the very first load: a reload must read what the app itself persisted.
  await browser.addInitScript((ids: string[]) => {
    localStorage.setItem('city-route-first-launch-v1', '1');
    if (!localStorage.getItem('city-route-v1')) {
      localStorage.setItem('city-route-v1', JSON.stringify({
        version: 1, tester: { id: 'e2e-route-save', nickname: 'E2E' }, basket: ids, basketsByCity: { warsaw: ids },
        events: [], session: null, cityId: 'warsaw', userPlaces: [], placeReviews: {},
      }));
    }
  }, seed);

  await app.open('/#my-route');
  await expect(browser.locator('.stops li[data-stop]')).toHaveCount(3);

  const name = 'Trasa e2e ' + Date.now();
  await browser.locator('button[data-action="save-basket"]').click();
  await browser.locator('#route-save-name').fill(name);
  await browser.locator('.route-save-submit').click();

  await browser.reload();
  await app.open('/#social-saved');
  await expect(browser.locator('[data-saved-routes-cards]')).toContainText(name);
});
