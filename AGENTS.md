# AGENTS.md

Vue 3 + Vite SPA for a BPMN 2.0 diagram designer built on `bpmn-js`. Most code comments and the docs (README) are in Chinese — preserve that when writing comments.

## Commands

- `npm run dev` — Vite dev server
- `npm run build` / `npm run preview` — production build / preview
- No test, lint, or typecheck tooling is configured. Verify changes with a dev/build run.
- `pack:deps` in package.json references `pack-deps.js`, which does NOT exist. The real offline-packing scripts are `offline-pack-deps.js` and `offline-pack-by-deps.js` (they `npm pack` deps into `pkgs/`). Don't run `pack:deps`.

## Structure

- `src/main.js` → `App.vue` (router-view only) → routes in `src/router/index.js` (`/bpmn`, `/logic-tree`, hash history, `/` redirects to `/bpmn`).
- `src/views/BpmnDesigner.vue` is the page shell; it owns the `formBean` (workflow metadata + `bpmn` + `taskInfo`) and renders the designer.
- **The core designer is `src/components/modeler/index.vue`** (default-exported, imported as `BpmnModeler`). Don't confuse it with the older `src/components/BpmnModeler.vue` name — that path never existed; everything lives under `src/components/modeler/`.
- `src/components/modeler/` holds the DI modules wired into the Modeler via `additionalModules` in `index.vue`'s `initModeler()`:
  - `palette/` (accordion palette + provider + Vue-hosted custom elements panel), `context/`, `i18n/` (Chinese translate), `behavior/` (default create behavior), `renderer/` (custom canvas labels), `properties/PropertyPanel.vue`, `toolbar/ModelerToolbar.vue`.
- Custom bpmn-js modules follow the DI pattern: register through `additionalModules` and declare dependencies via static `$inject`.

## Gotchas

- **`activeElement` must be `shallowRef`, not `ref`** (`modeler/index.vue:61`). Deep-proxying bpmn-js elements throws on read-only props (`labels`) and breaks `updateProperties`, so canvas labels stop refreshing.
- **`.bpmn` files must be imported with `?raw`** to get the XML string; enabled by `assetsInclude: ['**/*.bpmn']` in `vite.config.js`. Importing without `?raw` fails at build time.
- **`@` alias resolves to `/src`** (configured in `vite.config.js`); also relative imports are used throughout — either works.
- Custom attributes (e.g. `busId`, `executeType`) are stored in the in-memory `taskInfo` array only and are NOT written to the BPMN XML. Standard `name` edits must go through `modeling.updateProperties` (enters command stack + relabels). To persist an XML-serializable extension attribute, use `businessObject.set(key, val)`.
- `taskInfo` is the single source of truth for node attributes, keyed by element `id` + `$type`. `syncTaskInfo()` realigns it with the canvas on every `commandStack.changed`.
- Styles for dynamically-injected bpmn-js DOM (palette, preview overlay, renderer badges) must live in **non-scoped** `<style>` blocks.
- `importXML` clears the command stack (so auto-layout is not undoable) and rebuilds element instances — re-run `refreshCanvasState()` after it.
