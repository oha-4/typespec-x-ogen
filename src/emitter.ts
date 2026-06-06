import {
  NoTarget,
  resolvePath,
  type EmitContext,
  type Namespace,
  type Operation,
  type Program,
} from "@typespec/compiler";
import { resolveOperationId } from "@typespec/openapi";
import { parse as yamlParse, stringify as yamlStringify } from "yaml";
import { reportDiagnostic } from "./lib.js";
import {
  JsonStreamingKey,
  ServerNameKey,
  type JsonStreamingLocation,
  type ServerNameEntry,
} from "./state.js";

/** Options for the `typespec-x-ogen` post-processing emitter. */
export interface XOgenEmitterOptions {
  /**
   * Directory holding the `@typespec/openapi3` output to patch. Defaults to the
   * sibling `@typespec/openapi3` directory under the shared output dir.
   */
  "openapi3-output-dir"?: string;
}

const HTTP_METHODS = ["get", "put", "post", "delete", "options", "head", "patch", "trace"] as const;

// The OpenAPI document is parsed back from disk, so it is treated loosely.
type AnyObject = Record<string, any>;

/**
 * Post-processes the OpenAPI 3 document produced by `@typespec/openapi3`,
 * injecting the extensions that the openapi3 emitter does not attach to server
 * objects or media type objects: `x-ogen-server-name` and
 * `x-ogen-json-streaming`. Run this emitter *after* `@typespec/openapi3`.
 */
export async function $onEmit(context: EmitContext<XOgenEmitterOptions>): Promise<void> {
  const { program } = context;

  const serverNames = collectServerNames(program);
  const jsonStreaming = program.stateMap(JsonStreamingKey) as Map<Operation, JsonStreamingLocation>;
  if (serverNames.length === 0 && jsonStreaming.size === 0) {
    return;
  }

  const targetDir =
    context.options["openapi3-output-dir"] ??
    resolvePath(context.emitterOutputDir, "..", "@typespec", "openapi3");

  const specFiles = (await readDirSafe(program, targetDir)).filter(isSpecFile);
  if (specFiles.length === 0) {
    reportDiagnostic(program, {
      code: "openapi3-output-not-found",
      format: { dir: targetDir },
      target: NoTarget,
    });
    return;
  }

  for (const name of specFiles) {
    const path = resolvePath(targetDir, name);
    const isJson = name.endsWith(".json");
    const text = (await program.host.readFile(path)).text;
    const document = (isJson ? JSON.parse(text) : yamlParse(text)) as AnyObject;
    patchOpenAPIDocument(program, document);
    await program.host.writeFile(path, serialize(document, isJson));
  }
}

/**
 * Inject `x-ogen-server-name` and `x-ogen-json-streaming` into an OpenAPI 3
 * document (mutating it in place), based on the decorator state recorded on
 * `program`. Servers are matched by URL and operations by their resolved
 * operationId.
 */
export function patchOpenAPIDocument(program: Program, document: AnyObject): void {
  // x-ogen-server-name on matching servers.
  const servers: AnyObject[] | undefined = document.servers;
  if (servers) {
    for (const entry of collectServerNames(program)) {
      for (const server of servers) {
        if (server.url === entry.url) {
          server["x-ogen-server-name"] = entry.name;
        }
      }
    }
  }

  // x-ogen-json-streaming on application/json media types.
  const jsonStreaming = program.stateMap(JsonStreamingKey) as Map<Operation, JsonStreamingLocation>;
  if (jsonStreaming.size > 0) {
    const operationsById = indexOperationsByOperationId(document);
    for (const [op, location] of jsonStreaming) {
      const operation = operationsById.get(resolveOperationId(program, op));
      if (operation) {
        applyJsonStreaming(operation, location);
      }
    }
  }
}

function indexOperationsByOperationId(document: AnyObject): Map<string, AnyObject> {
  const map = new Map<string, AnyObject>();
  const paths: AnyObject = document.paths ?? {};
  for (const pathItem of Object.values<AnyObject>(paths)) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem?.[method];
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

function collectServerNames(program: Program): ServerNameEntry[] {
  const all: ServerNameEntry[] = [];
  for (const list of (
    program.stateMap(ServerNameKey) as Map<Namespace, ServerNameEntry[]>
  ).values()) {
    all.push(...list);
  }
  return all;
}

async function readDirSafe(program: Program, dir: string): Promise<string[]> {
  try {
    return await program.host.readDir(dir);
  } catch {
    return [];
  }
}

function isSpecFile(name: string): boolean {
  return name.endsWith(".yaml") || name.endsWith(".yml") || name.endsWith(".json");
}

function serialize(document: AnyObject, isJson: boolean): string {
  if (isJson) {
    return `${JSON.stringify(document, null, 2)}\n`;
  }
  return yamlStringify(document, { aliasDuplicateObjects: false, lineWidth: 0 });
}
