import type { ModelProperty, Namespace, Operation, Program } from "@typespec/compiler";
import { getExtensions, setExtension } from "@typespec/openapi";
import { reportDiagnostic } from "./lib.js";
import {
  JsonStreamingKey,
  OperationGroupKey,
  PropertyNameKey,
  ServerNameKey,
  type OperationGroupContainer,
} from "./state.js";

/** `x-ogen-properties` entry shape on a parent schema. */
type OgenProperties = Record<string, { name: string }>;

/**
 * Runs after type checking, before emit. Applies the extensions that the
 * `@typespec/openapi3` emitter can pick up natively via `setExtension`, so the
 * common cases work with a plain `emit: ["@typespec/openapi3"]` (no wrapper).
 * Also warns when decorators that need the post-processing emitter are used
 * without it.
 */
export function $onValidate(program: Program): void {
  foldPropertyNames(program);
  cascadeOperationGroups(program);
  warnIfEmitterMissing(program);
}

/**
 * Fold `@ogenName` on model properties into each parent's `x-ogen-properties`.
 * Deferred from decoration time because `ModelProperty.model` is only linked
 * once checking completes.
 */
function foldPropertyNames(program: Program): void {
  const map = program.stateMap(PropertyNameKey) as Map<ModelProperty, string>;
  for (const [property, name] of map) {
    const parent = property.model;
    if (parent === undefined) {
      continue;
    }
    const existing =
      (getExtensions(program, parent).get("x-ogen-properties") as OgenProperties | undefined) ?? {};
    existing[property.name] = { name };
    setExtension(program, parent, "x-ogen-properties", existing);
  }
}

/**
 * Apply interface/namespace-level `@ogenOperationGroup` to every contained
 * operation that does not already declare its own group.
 */
function cascadeOperationGroups(program: Program): void {
  const map = program.stateMap(OperationGroupKey) as Map<OperationGroupContainer, string>;
  for (const [container, group] of map) {
    for (const op of collectOperations(container)) {
      if (getExtensions(program, op).get("x-ogen-operation-group") === undefined) {
        setExtension(program, op, "x-ogen-operation-group", group);
      }
    }
  }
}

function collectOperations(container: OperationGroupContainer): Operation[] {
  if (container.kind === "Interface") {
    return [...container.operations.values()];
  }
  const ns = container as Namespace;
  const ops: Operation[] = [...ns.operations.values()];
  for (const iface of ns.interfaces.values()) {
    ops.push(...iface.operations.values());
  }
  for (const child of ns.namespaces.values()) {
    ops.push(...collectOperations(child));
  }
  return ops;
}

/**
 * `@ogenServerName` and `@ogenJsonStreaming` are only realized by the
 * post-processing emitter. Warn if they are used but it is not enabled.
 */
function warnIfEmitterMissing(program: Program): void {
  const emit = program.compilerOptions.emit;
  if (emit === undefined || emit.some((e) => e.includes("typespec-x-ogen"))) {
    return;
  }

  for (const namespace of (
    program.stateMap(ServerNameKey) as Map<Namespace, unknown>
  ).keys()) {
    reportDiagnostic(program, {
      code: "requires-emitter",
      format: { decorator: "ogenServerName" },
      target: namespace,
    });
  }
  for (const operation of (
    program.stateMap(JsonStreamingKey) as Map<Operation, unknown>
  ).keys()) {
    reportDiagnostic(program, {
      code: "requires-emitter",
      format: { decorator: "ogenJsonStreaming" },
      target: operation,
    });
  }
}
