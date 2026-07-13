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
| Dashboard path/storage: `apple-home` | Dashboard path/storage: `apple-home-lab` |

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

### Reproduced cause of the failed live upgrade

Loading the customized bundle over an already-running original bundle with the same browser names produced a hybrid runtime: the guarded `customElements.define` calls retained the original card and view constructors, while `window.customStrategies['apple-home-strategy']` was replaced by the new strategy function. Normal and canceled cross-area touch drags both completed cleanly when exercised against one coherent manager version. The deployment collision—not the standalone Sortable operation—was the reproducible consistency failure. The lab namespace prevents that mixed-version state.

## Production deployment gate

The mixed-runtime failure is reproduced and prevented by the isolated namespace. The lab may be deployed only as its own dashboard/resource; it must never update or replace the working resource.

Deployment record:

1. Backed up `lovelace_dashboards`, `lovelace_resources`, and any prior lab artifact.
2. Copied only `dist/apple-home-dashboard-lab.js` to `/config/www/apple-home-dashboard-lab.js`.
3. Registered a new lab resource without updating `/local/apple-home-dashboard.js`.
4. Created `Apple Home Lab` at `apple-home-lab` with `strategy.type: custom:apple-home-lab-strategy`.
5. Verified original and lab bundle hashes and resource entries separately.
6. Physical acceptance still covers edit mode, within-room drag, cross-room drag, reload persistence, and sensor promotion on `Apple Home Lab`.
7. `Apple Home` stays untouched regardless of lab results unless the user later requests a deliberate migration.

## Rollback

Remove the lab resource, registry entry, config file, and lab bundle. No rollback step may write to `lovelace.apple_home` or `/config/www/apple-home-dashboard.js`.
