import type { Interface, Namespace } from "@typespec/compiler";

/**
 * State keys for decorator data that cannot be applied via
 * `@typespec/openapi`'s `setExtension` (server objects and media type objects
 * are not visited by the openapi3 emitter's `attachExtensions`). The wrapper
 * emitter reads these maps and patches the produced OpenAPI document.
 */
export const OperationGroupKey = Symbol.for("typespec-x-ogen.operationGroup");
export const ServerNameKey = Symbol.for("typespec-x-ogen.serverName");
export const JsonStreamingKey = Symbol.for("typespec-x-ogen.jsonStreaming");

/**
 * `@ogenName` on a model property. The parent model is not yet linked
 * (`ModelProperty.model` is `undefined`) when the property decorator runs, so
 * the value is stored here and folded into the parent's `x-ogen-properties` at
 * emit time.
 */
export const PropertyNameKey = Symbol.for("typespec-x-ogen.propertyName");

/** A single `@ogenServerName` declaration. */
export interface ServerNameEntry {
  readonly namespace: Namespace;
  readonly url: string;
  readonly name: string;
}

/** Where `@ogenJsonStreaming` applies. `undefined` means both request and response. */
export type JsonStreamingLocation = "request" | "response" | undefined;

/** Container that an `@ogenOperationGroup` cascades over. */
export type OperationGroupContainer = Namespace | Interface;
