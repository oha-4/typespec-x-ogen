import {
  emitFile,
  resolvePath,
  type EmitContext,
  type Namespace,
  type Operation,
  type Program,
} from "@typespec/compiler";
import { getExtensions, resolveOperationId, setExtension } from "@typespec/openapi";
import { getOpenAPI3 } from "@typespec/openapi3";
import { stringify as yamlStringify } from "yaml";
import {
  JsonStreamingKey,
  OperationGroupKey,
  PropertyNameKey,
  ServerNameKey,
  type JsonStreamingLocation,
  type OperationGroupContainer,
  type ServerNameEntry,
} from "./state.js";
import type { ModelProperty } from "@typespec/compiler";

/** Options for the `typespec-x-ogen` emitter. */
export interface XOgenEmitterOptions {
  /** Output file type. Defaults to `"yaml"`. */
  "file-type"?: "yaml" | "json";
  /**
   * Output file name. Supports `{service-name}`, `{version}` and `{file-type}`
   * interpolation. Defaults to ogen-friendly `openapi.{...}.{file-type}`.
   */
  "output-file"?: string;
  /** OpenAPI versions to emit (forwarded to `@typespec/openapi3`). */
  "openapi-versions"?: string[];
}

const HTTP_METHODS = [
  "get",
  "put",
  "post",
  "delete",
  "options",
  "head",
  "patch",
  "trace",
] as const;

// The OpenAPI document objects are patched with arbitrary `x-ogen-*` keys, so
// they are treated loosely here.
type AnyObject = Record<string, any>;

export async function $onEmit(context: EmitContext<XOgenEmitterOptions>): Promise<void> {
  const { program } = context;
  const options = context.options;
  const fileType = options["file-type"] ?? "yaml";

  // Fold deferred @ogenName-on-property into each parent's x-ogen-properties
  // before generating the document, so the openapi3 emitter picks it up.
  foldPropertyNames(program);

  const getOpenAPI3Options = options["openapi-versions"]
    ? ({ "openapi-versions": options["openapi-versions"] } as Parameters<typeof getOpenAPI3>[1])
    : undefined;
  const records = await getOpenAPI3(program, getOpenAPI3Options);

  const patchState = {
    operationGroups: program.stateMap(OperationGroupKey) as Map<OperationGroupContainer, string>,
    serverNames: collectServerNames(program),
    jsonStreaming: program.stateMap(JsonStreamingKey) as Map<Operation, JsonStreamingLocation>,
  };

  const multipleServices = records.length > 1;

  for (const record of records) {
    const documents = record.versioned
      ? record.versions.map((v) => ({ document: v.document as AnyObject, version: v.version }))
      : [{ document: record.document as AnyObject, version: undefined as string | undefined }];

    const serviceName = record.service.type.name;

    for (const { document, version } of documents) {
      patchDocument(program, document, patchState);
      const filename = resolveFilename(
        options["output-file"],
        fileType,
        serviceName,
        version,
        multipleServices,
      );
      await emitFile(program, {
        path: resolvePath(context.emitterOutputDir, filename),
        content: serialize(document, fileType),
        newLine: "lf",
      });
    }
  }
}

/** `x-ogen-properties` entry shape on a parent schema. */
type OgenProperties = Record<string, { name: string }>;

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

interface PatchState {
  operationGroups: Map<OperationGroupContainer, string>;
  serverNames: ServerNameEntry[];
  jsonStreaming: Map<Operation, JsonStreamingLocation>;
}

function patchDocument(program: Program, document: AnyObject, state: PatchState): void {
  const operationsById = indexOperationsByOperationId(document);

  // x-ogen-operation-group cascade for interfaces/namespaces.
  for (const [container, group] of state.operationGroups) {
    for (const op of collectOperations(container)) {
      const operation = operationsById.get(resolveOperationId(program, op));
      if (operation && operation["x-ogen-operation-group"] === undefined) {
        operation["x-ogen-operation-group"] = group;
      }
    }
  }

  // x-ogen-json-streaming on application/json media types.
  for (const [op, location] of state.jsonStreaming) {
    const operation = operationsById.get(resolveOperationId(program, op));
    if (operation) {
      applyJsonStreaming(operation, location);
    }
  }

  // x-ogen-server-name on matching servers.
  const servers: AnyObject[] | undefined = document.servers;
  if (servers) {
    for (const entry of state.serverNames) {
      for (const server of servers) {
        if (server.url === entry.url) {
          server["x-ogen-server-name"] = entry.name;
        }
      }
    }
  }
}

function indexOperationsByOperationId(document: AnyObject): Map<string, AnyObject> {
  const map = new Map<string, AnyObject>();
  const paths: AnyObject = document.paths ?? {};
  for (const pathItem of Object.values<AnyObject>(paths)) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (operation && typeof operation.operationId === "string") {
        map.set(operation.operationId, operation);
      }
    }
  }
  return map;
}

function applyJsonStreaming(operation: AnyObject, location: JsonStreamingLocation): void {
  if (location !== "response") {
    markJsonMediaTypes(operation.requestBody?.content);
  }
  if (location !== "request") {
    for (const response of Object.values<AnyObject>(operation.responses ?? {})) {
      markJsonMediaTypes(response?.content);
    }
  }
}

function markJsonMediaTypes(content: AnyObject | undefined): void {
  if (!content) {
    return;
  }
  for (const [mediaType, mediaObject] of Object.entries<AnyObject>(content)) {
    if (mediaType === "application/json" || mediaType.endsWith("+json")) {
      mediaObject["x-ogen-json-streaming"] = true;
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

function collectServerNames(program: Program): ServerNameEntry[] {
  const all: ServerNameEntry[] = [];
  for (const list of (
    program.stateMap(ServerNameKey) as Map<Namespace, ServerNameEntry[]>
  ).values()) {
    all.push(...list);
  }
  return all;
}

function resolveFilename(
  outputFile: string | undefined,
  fileType: "yaml" | "json",
  serviceName: string,
  version: string | undefined,
  multipleServices: boolean,
): string {
  if (outputFile) {
    return outputFile
      .replace(/\{service-name\}/g, serviceName)
      .replace(/\{version\}/g, version ?? "")
      .replace(/\{file-type\}/g, fileType);
  }
  const parts = ["openapi"];
  if (multipleServices) {
    parts.push(serviceName);
  }
  if (version) {
    parts.push(version);
  }
  return `${parts.join(".")}.${fileType}`;
}

function serialize(document: AnyObject, fileType: "yaml" | "json"): string {
  if (fileType === "json") {
    return `${JSON.stringify(document, null, 2)}\n`;
  }
  return yamlStringify(document, { aliasDuplicateObjects: false, lineWidth: 0 });
}
