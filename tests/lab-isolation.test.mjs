import assert from 'node:assert/strict';
import test from 'node:test';

import { transformBundle } from '../scripts/build-lab.mjs';

const originalRegistrations = `
customElements.define("apple-home-card",Card)
customElements.define("apple-home-view",View)
customElements.define("ll-strategy-apple-home-strategy",Strategy)
window.customStrategies["apple-home-strategy"]=generate
window.customCards.push({type:"custom:apple-home-strategy"})
const card=document.createElement("apple-home-card")
const config={type:"custom:apple-home-card"}
`;

test('lab build namespaces every browser registration and card reference', () => {
  const result = transformBundle(originalRegistrations);

  assert.match(result, /apple-home-lab-card/);
  assert.match(result, /apple-home-lab-view/);
  assert.match(result, /ll-strategy-apple-home-lab-strategy/);
  assert.match(result, /custom:apple-home-lab-strategy/);
  assert.doesNotMatch(result, /customElements\.define\("apple-home-card"/);
  assert.doesNotMatch(result, /customElements\.define\("apple-home-view"/);
  assert.doesNotMatch(result, /ll-strategy-apple-home-strategy/);
});

test('lab build uses a separate customization event namespace', () => {
  const result = transformBundle('apple-home-customizations-updated apple-home-dashboard-active');

  assert.equal(result, 'apple-home-lab-customizations-updated apple-home-lab-dashboard-active');
});
