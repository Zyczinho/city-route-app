import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const css = read('mobile-device-polish.css');

test('mobile-native: viewport-fit, dynamic sheets and no forced zoom disabling', () => {
  const index = read('index.html');
  assert.match(index, /viewport-fit=cover/);
  assert.doesNotMatch(index, /user-scalable=no|maximum-scale=1/);
  assert.match(css, /\.sheet\s*\{\s*max-height:\s*92vh;\s*max-height:\s*92dvh;/);
  assert.match(css, /input:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\), select, textarea\s*\{\s*font-size:\s*max\(16px,\s*1em\)/);
  assert.match(css, /\.top \.city-select select\s*\{\s*font-size:\s*16px;/);
});

test('mobile-native: map sheet controls have 44px touch targets', () => {
  assert.match(css, /\.cr-map-toolbar button\s*\{\s*min-height:\s*44px;/);
  assert.match(css, /\.cr-map-card-actions button\s*\{\s*min-height:\s*44px;/);
  assert.match(css, /\.cr-map-card-close\s*\{[^}]*min-width:\s*44px;[^}]*min-height:\s*44px !important;/);
  assert.match(css, /\.cr-map-card-head h3\s*\{\s*padding-right:\s*52px;/);
  assert.match(css, /\.search \.clear, \.sheet \.close\s*\{\s*min-width:\s*44px;\s*min-height:\s*44px;/);
});

test('mobile-native: tap and list behavior preserve scroll and titles', () => {
  const map = read('map.css');
  const index = read('index.html');
  assert.match(css, /touch-action:\s*manipulation/);
  assert.match(map, /\.cr-map\.is-scroll-mode \.leaflet-container\{touch-action:pan-y!important\}/);
  assert.match(css, /\.place-list \.place > \.info h3\s*\{\s*padding-right:\s*0;/);
  assert.match(css, /\.place-list \.place > \.side \.save-place\s*\{[^}]*min-height:\s*44px;/);
  const mapIndex = index.indexOf('map.css');
  const polishIndex = index.indexOf('mobile-device-polish.css');
  assert.ok(mapIndex !== -1 && polishIndex > mapIndex, 'mobile override must load after map.css');
});
