import type {
  DecoratorContext,
  Enum,
  Interface,
  Model,
  ModelProperty,
  Namespace,
  Operation,
  Scalar,
  Union,
} from "@typespec/compiler";
import { setExtension } from "@typespec/openapi";
import {
  JsonStreamingKey,
  OperationGroupKey,
  PropertyNameKey,
  ServerNameKey,
  type JsonStreamingLocation,
  type ServerNameEntry,
} from "./state.js";

/** {@link ogenName} implementation. */
export function $ogenName(
  context: DecoratorContext,
  target: Model | Enum | Union | Scalar | ModelProperty,
  name: string,
): void {
  const { program } = context;

  if (target.kind === "ModelProperty") {
    // Custom field name. The parent model is not linked yet (target.model is
    // undefined during property decoration), so defer to the emitter, which
    // folds this into the parent schema's x-ogen-properties.
    program.stateMap(PropertyNameKey).set(target, name);
    return;
  }

  // Custom type name.
  setExtension(program, target, "x-ogen-name", name);
}

/** {@link ogenExtraTags} implementation. */
export function $ogenExtraTags(
  context: DecoratorContext,
  target: ModelProperty,
  tags: Record<string, string>,
): void {
  setExtension(context.program, target, "x-oapi-codegen-extra-tags", tags);
}

/** {@link ogenOperationGroup} implementation. */
export function $ogenOperationGroup(
  context: DecoratorContext,
  target: Operation | Interface | Namespace,
  group: string,
): void {
  const { program } = context;
  if (target.kind === "Operation") {
    setExtension(program, target, "x-ogen-operation-group", group);
    return;
  }
  // Interface / namespace cascade is resolved later by the emitter, because the
  // full set of contained operations is only reliably known at emit time.
  program.stateMap(OperationGroupKey).set(target, group);
}

/** {@link ogenServerName} implementation. */
export function $ogenServerName(
  context: DecoratorContext,
  target: Namespace,
  serverUrl: string,
  name: string,
): void {
  const map = context.program.stateMap(ServerNameKey);
  const list = (map.get(target) as ServerNameEntry[] | undefined) ?? [];
  list.push({ namespace: target, url: serverUrl, name });
  map.set(target, list);
}

/** {@link ogenJsonStreaming} implementation. */
export function $ogenJsonStreaming(
  context: DecoratorContext,
  target: Operation,
  location?: JsonStreamingLocation,
): void {
  context.program.stateMap(JsonStreamingKey).set(target, location);
}
