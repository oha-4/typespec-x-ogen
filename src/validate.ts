import {
  navigateProgram,
  type ModelProperty,
  type Namespace,
  type Operation,
  type Program,
} from "@typespec/compiler";
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
 *
 * Walks every model property in the program rather than just the decorated
 * ones, so a property inherits the name from whatever it was spread/copied from
 * (`sourceProperty`). The rename therefore lands on the spread *target* model,
 * not only the model the decorator was written on.
 */
function foldPropertyNames(program: Program): void {
  const names = program.stateMap(PropertyNameKey) as Map<ModelProperty, string>;
  if (names.size === 0) {
    return;
  }
  navigateProgram(program, {
    modelProperty(property) {
      const name = resolvePropertyName(property, names);
      const parent = property.model;
      if (name === undefined || parent === undefined) {
        return;
      }
      const existing =
        (getExtensions(program, parent).get("x-ogen-properties") as
          | OgenProperties
          | undefined) ?? {};
      existing[property.name] = { name };
      setExtension(program, parent, "x-ogen-properties", existing);
    },
  });
}

/**
 * Resolve the `@ogenName` for a property, following the `sourceProperty` chain
 * so a spread/copied property inherits the name from its origin. A property's
 * own `@ogenName` (if any) wins, since it is found first.
 */
function resolvePropertyName(
  property: ModelProperty,
  names: Map<ModelProperty, string>,
): string | undefined {
  for (
    let current: ModelProperty | undefined = property;
    current !== undefined;
    current = current.sourceProperty
  ) {
    const name = names.get(current);
    if (name !== undefined) {
      return name;
    }
  }
  return undefined;
}

/**
 * Apply interface/namespace-level `@ogenOperationGroup` to every contained
 * operation that does not already declare its own group.
 */
function cascadeOperationGroups(program: Program): void {
  const map = program.stateMap(OperationGroupKey) as Map<
    OperationGroupContainer,
    string
  >;
  for (const [container, group] of map) {
    for (const op of collectOperations(container)) {
      if (
        getExtensions(program, op).get("x-ogen-operation-group") === undefined
      ) {
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
  // An empty `emit` is the language server's default (it skips emitters for
  // perf), so treat it like `undefined`: no emitter runs at all, making the
  // "missing post-processor" warning meaningless noise in the editor.
  const emit = program.compilerOptions.emit;
  if (
    emit === undefined ||
    emit.length === 0 ||
    emit.some((e) => e.includes("typespec-x-ogen"))
  ) {
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
