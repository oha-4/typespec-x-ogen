# typespec-x-ogen

TypeSpec decorators for [ogen](https://ogen.dev) OpenAPI vendor extensions.

This library lets you author every [ogen extension](https://ogen.dev/docs/spec/extensions/)
(the `x-ogen-*` / `x-oapi-codegen-*` vendor extensions) directly in TypeSpec,
instead of hand-editing the generated OpenAPI document.

It does **not** replace [`@typespec/openapi3`](https://typespec.io/docs/emitters/openapi3/):
`@typespec/openapi3` stays your emitter. Four of the six extensions are applied
during its normal run, with no extra emitter. The remaining two
(`x-ogen-server-name`, `x-ogen-json-streaming`) target OpenAPI objects that
openapi3 does not let libraries extend, so they are applied by an optional
post-processing emitter you add **after** openapi3.

## Install

```sh
npm install typespec-x-ogen
```

Peer dependencies (installed automatically in most setups):

- `@typespec/compiler`
- `@typespec/openapi`
- `@typespec/openapi3`

## Setup

Import the library (this is enough for four of the six extensions) and keep
`@typespec/openapi3` as your emitter:

```yaml
# tspconfig.yaml
emit:
  - "@typespec/openapi3"
```

Works with `emit: ["@typespec/openapi3"]` alone:

- `@ogenName`
- `@ogenExtraTags`
- `@ogenOperationGroup` (operation, interface and namespace)

To also get `@ogenServerName` and `@ogenJsonStreaming`, add `typespec-x-ogen`
**after** `@typespec/openapi3` — it patches openapi3's output in place:

```yaml
# tspconfig.yaml
emit:
  - "@typespec/openapi3"
  - typespec-x-ogen
```

Using `@ogenServerName` / `@ogenJsonStreaming` without the post-processing
emitter produces a warning telling you to add it.

### Post-processor options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `openapi3-output-dir` | `string` | sibling `@typespec/openapi3` dir | Directory of the openapi3 output to patch. Override if you customized openapi3's output location. |

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
openapi3 emitter writes onto the matching schema / operation / property. This
happens in the library's `$onValidate` (so the parent of an `@ogenName`-on-
property and the operation-group cascade can be resolved once checking is
complete) and is picked up by a plain `@typespec/openapi3` run — no extra
emitter required.

Server objects and media-type objects are not visited by that mechanism, so
`x-ogen-server-name` and `x-ogen-json-streaming` cannot be set that way. The
optional `typespec-x-ogen` emitter handles them by reading the OpenAPI document
`@typespec/openapi3` already wrote and patching those two keys in place. It does
not regenerate or wrap the document.

A complete example lives in [`samples/`](./samples).

## Develop

```sh
mise install   # Node 24.16.0 (see .tool-versions)
npm install
npm run build
npm test       # vitest
```

## License

[MIT](./LICENSE) © Yoshito Ohata
