# alpheios-components-v3

Scholarly Glass v3 UI — Vue 3 + Vite. **Greenfield rewrite** parallel to legacy
`alpheios-components` (Vue 2). This package never modifies the legacy package;
the two coexist until the webextension switches its default content script.

## Stage 0 (current)

Only `MountPlaceholder.vue` is shipped. The webextension verifies the mount
pipeline by injecting this placeholder into a ShadowRoot when the page URL has
`?alpheios=v3`.

## Build

```bash
cd packages/components-v3
npm install
npm run build
```

Outputs:

- `dist/components-v3.js` — ESM (consumed by webextension webpack)
- `dist/components-v3.umd.cjs` — UMD fallback
- `dist/style.css` — extracted styles

`vue` is an external peer; the consumer bundles it.

## Specs

- Plan: `../../../alpheios_webextension/doc/ui/REFACTOR-V3-PLAN.md`
- Progress: `../../../alpheios_webextension/doc/ui/REFACTOR-V3-PROGRESS.md`
- Visual: `../../../alpheios_webextension/doc/ui/mockups/*.html`
- Tokens: `../../../alpheios_webextension/doc/ui/DESIGN.md`
