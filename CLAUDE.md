# CLAUDE.md

Guidance for working in this repository.

## Overview

`typespec-x-ogen` is a **TypeSpec decorator library** that lets users author the
six [ogen](https://ogen.dev/docs/spec/extensions/) OpenAPI vendor extensions
(`x-ogen-*` / `x-oapi-codegen-*`) from TypeSpec. It does **not** replace
`@typespec/openapi3` — that stays the emitter.

## Commands

```sh
npm run build         # tsc -> dist/
npm test              # build + vitest (pretest links the package into node_modules)
npm run coverage      # build + link + vitest --coverage (v8, lcov)
npm run format        # prettier --write . + tsp format
npm run format:check  # CI check (must pass)
```

Requires **Node >= 22** (`@typespec/compiler`/`@typespec/http` need 22+; the test
harness imports `glob` from `fs/promises`). Toolchain pinned in `.tool-versions`
(mise): Node 24.16.0 + pinact.

## Architecture

Two delivery mechanisms depending on what the openapi3 emitter can reach:

1. **Four extensions via `setExtension`** (read natively by `@typespec/openapi3`,
   so they work with plain `emit: ["@typespec/openapi3"]`, no extra emitter):
   `x-ogen-name`, `x-ogen-properties`, `x-oapi-codegen-extra-tags`,
   `x-ogen-operation-group`.
2. **Two extensions via an optional post-processor emitter** — `x-ogen-server-name`
   (server object) and `x-ogen-json-streaming` (media type object) are **not**
   reachable by `setExtension` because the openapi3 emitter never attaches
   extensions to those objects. Users add `typespec-x-ogen` to `emit` **after**
   `@typespec/openapi3`; our `$onEmit` reads the file openapi3 already wrote and
   patches those keys in place (no `getOpenAPI3`, no wrapping).

### Key files (`src/`)

- `decorators.ts` — the five `$ogen*` decorator impls. Trivial: set state or
  `setExtension`.
- `validate.ts` — `$onValidate`: folds `@ogenName`-on-property into the parent's
  `x-ogen-properties` (walking **all** model properties via `navigateProgram` and
  following `sourceProperty`, so a spread target inherits the rename) and cascades
  interface/namespace `@ogenOperationGroup` onto contained ops (both via
  `setExtension`). Also warns when server-name/json-streaming are used without the
  emitter.
- `emitter.ts` — `$onEmit` (post-processor) + the exported pure
  `patchOpenAPIDocument(program, document)` (servers matched by url, ops by
  `resolveOperationId`).
- `lib.ts` — `$lib` (createTypeSpecLibrary) + diagnostics + emitter options schema.
- `state.ts` — state-map keys (`Symbol.for`, so src- and dist-loaded code share
  state) and shared types.
- `index.ts` — exports `$lib`, `$onValidate`, `$onEmit`, and `$decorators`.
- `lib/main.tsp` — `extern dec` declarations in namespace `TypespecXOgen`.

## Gotchas (these were learned the hard way)

- **`ModelProperty.model` is `undefined` during decoration.** `@ogenName` on a
  property therefore stores state and is folded into the parent in `$onValidate`
  (where the graph is complete).
- **Spread copies a property into a _new_ `ModelProperty` instance**, so the
  decorator state is keyed on the origin, not the spread target. `foldPropertyNames`
  walks every property and follows `sourceProperty` to the origin, so
  `@ogenName` on `model Base { ...id }` still lands on `model Pet { ...Base }`.
  Re-declaring the property in the target to re-decorate it is **not** valid
  TypeSpec (duplicate-property error).
- **Expose decorators only through the `$decorators` map** (`index.ts`). Adding
  top-level `export { $ogenName }` makes the compiler also bind them into the
  global namespace → `ambiguous-symbol` errors.
- **State keys use `Symbol.for`** so tests can import logic from `src` while
  decorators run from `dist` and still share the same state maps.
- **server-name/json-streaming need the emitter** in the `emit` list, after
  openapi3. Without it `$onValidate` emits a `requires-emitter` warning.

## Testing

`test/`, vitest with the `createTester` API.

- **Integration** (`extensions.test.ts`, `diagnostics.test.ts`): go through the
  compiler + dist; assert via `getOpenAPI3(program)`.
- **Unit** (`decorators.test.ts`, `validate.test.ts`, `post-processor.test.ts`):
  import logic from **`src`** so vitest's v8 provider instruments it (code the
  compiler loads from `dist` is not instrumentable — c8 was tried and dropped).
- `createTester` resolves the package from `node_modules`, which is gitignored,
  so `scripts/link-self.mjs` (run by `pretest`/`coverage`) creates a self-symlink
  and `typespec-x-ogen` is listed in the tester's `libraries`.
- The warning branch is tested by mutating `program.compilerOptions.emit` then
  calling `$onValidate` (plain `Tester.compile` throws if you set `emit`).

## CI/CD

- `.github/workflows/ci.yml` — format:check + build, then test matrix Node
  **22/24** (not 20), Codecov upload on 24.
- `.github/workflows/release.yml` — on tag `v*.*.*`: verify tag == package
  version, test, `npm publish --provenance --access public` (needs `NPM_TOKEN`),
  GitHub release.
- `.github/workflows/pinact.yml` — official `pinact-action` (validation mode)
  verifying all actions stay SHA-pinned. Config `.github/pinact.yaml` enforces a
  strict 7-day `min_age` for **all** actions (no `actions/*` exemption).
- **All workflow actions are pinned to commit SHAs.** Pin with
  `GITHUB_TOKEN=$(gh auth token) pinact run` (or `-u` to update). Resolve new SHAs
  via `gh api` if avoiding a pinact run. All `actions/checkout` steps use
  `persist-credentials: false` (no job pushes back).
- `.github` Dependabot updates npm (weekly, grouped) + github-actions.

## Conventions

- Prettier, `printWidth: 100`. `.tsp` formatted with `tsp format`.
- Match the surrounding code's comment density and idiom.
- Commit/push only when asked. Do not re-pin actions or change the user's pins
  without asking.
