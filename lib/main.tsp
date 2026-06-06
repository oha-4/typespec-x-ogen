import "../dist/src/index.js";

using TypeSpec.Reflection;

namespace TypespecXOgen;

/**
 * Set the ogen `x-ogen-name` extension.
 *
 * - On a model, enum, union or scalar, it customizes the generated Go **type**
 *   name (`x-ogen-name` on the schema).
 * - On a model property, it customizes the generated Go **field** name by
 *   contributing an entry to the parent schema's `x-ogen-properties` map.
 *
 * @param name The Go identifier to generate.
 *
 * @example
 * ```typespec
 * @ogenName("FooBar")
 * model Foo {
 *   @ogenName("Prev") parent: string;
 * }
 * ```
 */
extern dec ogenName(target: Model | Enum | Union | Scalar | ModelProperty, name: valueof string);

/**
 * Set the ogen `x-oapi-codegen-extra-tags` extension on a model property,
 * adding extra Go struct field tags to the generated field.
 *
 * @param tags A map of struct tag name to tag value.
 *
 * @example
 * ```typespec
 * model Pet {
 *   @ogenExtraTags(#{ gorm: "primaryKey", valid: "customIdValidator" })
 *   id: int64;
 * }
 * ```
 */
extern dec ogenExtraTags(target: ModelProperty, tags: valueof Record<string>);

/**
 * Set the ogen `x-ogen-operation-group` extension to group operations into
 * separate handler interfaces.
 *
 * May be applied to a single operation, or to an interface/namespace to apply
 * the group to every operation it contains (operations with their own
 * `@ogenOperationGroup` are left untouched).
 *
 * @param group The operation group name.
 */
extern dec ogenOperationGroup(target: Operation | Interface | Namespace, group: valueof string);

/**
 * Set the ogen `x-ogen-server-name` extension on the server with the given URL,
 * enabling the generated server URL builder. Applied to the service namespace
 * and matched against the `@server` URLs by exact string.
 *
 * @param serverUrl The URL of the `@server` to name (matched verbatim).
 * @param name The server name to generate.
 *
 * @example
 * ```typespec
 * @service
 * @server("https://{region}.example.com", "Regional endpoint")
 * @ogenServerName("https://{region}.example.com", "production")
 * namespace MyService;
 * ```
 */
extern dec ogenServerName(target: Namespace, serverUrl: valueof string, name: valueof string);

/**
 * Set the ogen `x-ogen-json-streaming` extension to enable streaming JSON
 * encoding/decoding for the operation's `application/json` bodies.
 *
 * @param location Restrict to the `"request"` or `"response"` body. When
 * omitted, both request and response JSON bodies are marked.
 */
extern dec ogenJsonStreaming(target: Operation, location?: valueof "request" | "response");
