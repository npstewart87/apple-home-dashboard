# Apple Home Lab — Isolation and Deployment Gate

## Purpose

This branch is an experimental fork. It must never replace the bundle or saved configuration used by the working `Apple Home` dashboard.

## Isolation contract

| Working dashboard | Lab dashboard |
|---|---|
| Bundle: `apple-home-dashboard.js` | Bundle: `apple-home-dashboard-lab.js` |
| Strategy: `apple-home-strategy` | Strategy: `apple-home-lab-strategy` |
| Card: `apple-home-card` | Card: `apple-home-lab-card` |
| View: `apple-home-view` | View: `apple-home-lab-view` |
| Dashboard path/storage: `apple-home` | Dashboard path/storage: `apple-home-2` |

The lab build is generated with:

```bash
npm test
npm run build:lab
```

The build fails if any original browser registration survives in the lab artifact.

## Current proof

A local touch-enabled Chromium page loaded the original and lab bundles simultaneously and verified:

- both card elements registered;
- both view elements registered;
- both Lovelace strategies registered under distinct keys;
- both sensor cards rendered independently;
- neither sensor render made a Home Assistant service call.

## Production deployment gate

Do not deploy until the edit-mode freeze has a failing automated reproduction and a passing fix.

When that gate passes:

1. Back up `lovelace.apple_home_2`, `lovelace_resources`, and any prior lab bundle.
2. Copy only `dist/apple-home-dashboard-lab.js` to `/config/www/apple-home-dashboard-lab.js`.
3. Register a new resource URL; do not update `/local/apple-home-dashboard.js`.
4. Configure only `Apple Home 2` to use `strategy.type: custom:apple-home-lab-strategy`.
5. Verify original and lab bundle hashes and resource entries separately.
6. Test edit mode, within-room drag, cross-room drag, reload persistence, and sensor promotion on `Apple Home 2`.
7. Leave `Apple Home` untouched regardless of lab results unless the user later requests a deliberate migration.

## Rollback

Remove the lab resource and restore only `lovelace.apple_home_2` from its backup. No rollback step may write to `lovelace.apple_home` or `/config/www/apple-home-dashboard.js`.
