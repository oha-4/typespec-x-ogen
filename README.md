# typespec-x-ogen

TypeSpec decorators for [ogen](https://ogen.dev) OpenAPI vendor extensions.

This library lets you author every [ogen extension](https://ogen.dev/docs/spec/extensions/)
(the `x-ogen-*` / `x-oapi-codegen-*` vendor extensions) directly in TypeSpec,
instead of hand-editing the generated OpenAPI document. It ships a thin emitter
that wraps [`@typespec/openapi3`](https://typespec.io/docs/emitters/openapi3/)
and injects the extensions into the produced document.

## Install

```sh
npm install typespec-x-ogen
```

Peer dependencies (installed automatically in most setups):

- `@typespec/compiler`
- `@typespec/openapi`
- `@typespec/openapi3`

## Setup

Use `typespec-x-ogen` as your emitter (it wraps `@typespec/openapi3`, so you do
**not** also list `@typespec/openapi3`):

```yaml
# tspconfig.yaml
emit:
  - typespec-x-ogen
```

All options are optional:

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `file-type` | `"yaml" \| "json"` | inferred from `output-file`, else `"yaml"` | Output format. |
| `output-file` | `string` | `openapi.{service-name}.{version}.{file-type}` | Output file name. Supports `{service-name}`, `{version}`, `{file-type}`. |
| `openapi-versions` | `string[]` | `["3.0.0"]` | OpenAPI versions to emit (forwarded to `@typespec/openapi3`). |

`file-type` does not need to be set — it is inferred from the `output-file`
extension (`.json` / `.yaml` / `.yml`) and defaults to `yaml`.

## Decorators

All decorators live in the `TypespecXOgen` namespace:

```tsp
import "typespec-x-ogen";

using TypespecXOgen;
```

### `@ogenName(name)` — `x-ogen-name` / `x-ogen-properties`

Customize the generated Go identifier.

- On a **model / enum / union / scalar** → `x-ogen-name` (custom **type** name).
- On a **model property** → folded into the parent schema's `x-ogen-properties`
  (custom **field** name).

```tsp
@ogenName("PetModel")
model Pet {
  @ogenName("Identifier")
  id: int64;
}
```

### `@ogenExtraTags(tags)` — `x-oapi-codegen-extra-tags`

Add extra Go struct field tags to a property.

```tsp
model Pet {
  @ogenExtraTags(#{ gorm: "primaryKey", valid: "customIdValidator" })
  id: int64;
}
```

### `@ogenOperationGroup(group)` — `x-ogen-operation-group`

Group operations into separate handler interfaces. Applies to an operation, or
to an interface/namespace to cascade over all contained operations (operations
with their own `@ogenOperationGroup` win).

```tsp
@ogenOperationGroup("Pets")
interface Pets {
  @get list(): Pet[];
}

@ogenOperationGroup("System")
@get op health(): string;
```

### `@ogenServerName(serverUrl, name)` — `x-ogen-server-name`

Name a server so ogen generates a server URL builder. Applied to the service
namespace; `serverUrl` is matched against the `@server` URL verbatim.

```tsp
@service
@server("https://api.example.com", "Production endpoint")
@ogenServerName("https://api.example.com", "production")
namespace PetStore;
```

### `@ogenJsonStreaming(location?)` — `x-ogen-json-streaming`

Enable streaming JSON encoding/decoding for an operation's `application/json`
bodies. Pass `"request"` or `"response"` to narrow; omit for both.

```tsp
@ogenJsonStreaming
@post op create(@body pet: Pet): Pet;
```

## How it works

Most extensions are applied with `@typespec/openapi`'s `setExtension`, which the
openapi3 emitter writes onto the matching schema / operation / property. Server
objects and media-type objects are not visited by that mechanism, so
`x-ogen-server-name` and `x-ogen-json-streaming` (and interface/namespace-level
operation-group cascading) are patched into the document by this library's
emitter after calling `getOpenAPI3`.

A complete example lives in [`samples/`](./samples).

## Develop

```sh
mise install   # Node 24.16.0 (see .tool-versions)
npm install
npm run build
```

## License

[MIT](./LICENSE) © Yoshito Ohata
