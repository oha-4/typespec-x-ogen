# typespec-x-ogen

TypeSpec decorators for [ogen](https://ogen.dev) OpenAPI vendor extensions.

This library lets you author [ogen extensions](https://ogen.dev/docs/spec/extensions/)
(the `x-ogen-*` vendor extensions) directly in TypeSpec, instead of hand-writing
them in the generated OpenAPI document. The decorators attach the corresponding
`x-ogen-*` extension to the emitted OpenAPI 3 output produced by
[`@typespec/openapi3`](https://typespec.io/docs/emitters/openapi3/reference/).

> Status: early scaffold. Decorators are being added incrementally.

## Install

```sh
npm install typespec-x-ogen
```

Peer dependencies:

- `@typespec/compiler`
- `@typespec/openapi`

## Usage

```tsp
import "typespec-x-ogen";

using TypespecXOgen;
```

## Develop

```sh
mise install   # Node 24.16.0 (see .tool-versions)
npm install
npm run build
```

## License

[MIT](./LICENSE) © Yoshito Ohata
