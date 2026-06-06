import { resolvePath, type EmitContext } from "@typespec/compiler";
import { describe, expect, it } from "vitest";
import { parse as yamlParse, stringify as yamlStringify } from "yaml";
import { $onEmit, type XOgenEmitterOptions } from "../src/emitter";
import { openApiFor } from "./test-host";

/**
 * Minimal in-memory host capturing the three calls `$onEmit` makes
 * (`readDir`/`readFile`/`writeFile`), so the full read-patch-write path runs
 * without touching the real filesystem.
 */
function memHost(files: Record<string, string> = {}) {
  const fs = new Map<string, string>(Object.entries(files));
  return {
    fs,
    async readDir(dir: string): Promise<string[]> {
      const prefix = dir.endsWith("/") ? dir : `${dir}/`;
      const names = new Set<string>();
      for (const path of fs.keys()) {
        if (path.startsWith(prefix)) {
          names.add(path.slice(prefix.length).split("/")[0]);
        }
      }
      return [...names];
    },
    async readFile(path: string): Promise<{ text: string }> {
      const text = fs.get(path);
      if (text === undefined) {
        throw new Error(`ENOENT: ${path}`);
      }
      return { text };
    },
    async writeFile(path: string, content: string): Promise<void> {
      fs.set(path, content);
    },
  };
}

const SIBLING_DIR = "/out/@typespec/openapi3";

/**
 * Compile `code`, render the openapi3 document into `host` at `fileName` (in the
 * sibling dir, as the openapi3 emitter would), run `$onEmit`, and return the
 * patched document plus the program's diagnostics.
 */
async function runEmit(
  code: string,
  { fileName = "openapi.yaml", options = {} as XOgenEmitterOptions } = {},
) {
  const { program, document } = await openApiFor(code);
  const host = memHost();
  const targetDir = options["openapi3-output-dir"] ?? SIBLING_DIR;
  const isJson = fileName.endsWith(".json");
  host.fs.set(
    resolvePath(targetDir, fileName),
    isJson ? JSON.stringify(document) : yamlStringify(document),
  );

  const realHost = program.host;
  (program as any).host = host;
  try {
    await $onEmit({
      program,
      emitterOutputDir: "/out/typespec-x-ogen",
      options,
    } as EmitContext<XOgenEmitterOptions>);
  } finally {
    (program as any).host = realHost;
  }

  const text = host.fs.get(resolvePath(targetDir, fileName))!;
  const patched = isJson ? JSON.parse(text) : yamlParse(text);
  return { patched, program, host };
}

const serverSpec = `
  @service(#{ title: "S" })
  @server("https://api.example.com", "Production")
  @ogenServerName("https://api.example.com", "production")
  namespace S;
  @route("/h") @get op h(): string;
`;

const streamingSpec = `
  @service(#{ title: "S" }) namespace S;
  model Pet { id: int32; }
  @route("/pets") @post @ogenJsonStreaming op create(@body pet: Pet): Pet;
`;

describe("$onEmit", () => {
  it("patches the YAML file the openapi3 emitter wrote", async () => {
    const { patched } = await runEmit(serverSpec);
    const server = patched.servers.find(
      (s: any) => s.url === "https://api.example.com",
    );
    expect(server["x-ogen-server-name"]).toBe("production");
  });

  it("patches a JSON file too", async () => {
    const { patched } = await runEmit(streamingSpec, {
      fileName: "openapi.json",
    });
    const post = patched.paths["/pets"].post;
    expect(
      post.requestBody.content["application/json"]["x-ogen-json-streaming"],
    ).toBe(true);
    expect(
      post.responses["200"].content["application/json"][
        "x-ogen-json-streaming"
      ],
    ).toBe(true);
  });

  it("honors the openapi3-output-dir option", async () => {
    const { patched } = await runEmit(serverSpec, {
      options: { "openapi3-output-dir": "/custom/spec" },
    });
    const server = patched.servers.find(
      (s: any) => s.url === "https://api.example.com",
    );
    expect(server["x-ogen-server-name"]).toBe("production");
  });

  it("warns when no openapi3 output is found", async () => {
    const { program } = await openApiFor(serverSpec);
    const host = memHost(); // empty: no spec files in the target dir
    const realHost = program.host;
    (program as any).host = host;
    try {
      await $onEmit({
        program,
        emitterOutputDir: "/out/typespec-x-ogen",
        options: {},
      } as EmitContext<XOgenEmitterOptions>);
    } finally {
      (program as any).host = realHost;
    }
    const codes = program.diagnostics.map((d) => d.code);
    expect(codes).toContain("typespec-x-ogen/openapi3-output-not-found");
  });

  it("treats an unreadable target dir as missing output", async () => {
    const { program } = await openApiFor(serverSpec);
    const host = {
      async readDir(): Promise<string[]> {
        throw new Error("EACCES");
      },
      async readFile(): Promise<{ text: string }> {
        throw new Error("unused");
      },
      async writeFile(): Promise<void> {},
    };
    const realHost = program.host;
    (program as any).host = host;
    try {
      await $onEmit({
        program,
        emitterOutputDir: "/out/typespec-x-ogen",
        options: {},
      } as EmitContext<XOgenEmitterOptions>);
    } finally {
      (program as any).host = realHost;
    }
    expect(program.diagnostics.map((d) => d.code)).toContain(
      "typespec-x-ogen/openapi3-output-not-found",
    );
  });

  it("handles streaming operations with no request/response content", async () => {
    // A GET returning void: no requestBody, and a 200 with no content.
    const { patched } = await runEmit(`
      @service(#{ title: "S" }) namespace S;
      @route("/h") @ogenJsonStreaming @get op h(): void;
    `);
    expect(patched.paths["/h"].get).toBeDefined();
  });

  it("does nothing when no server-name/json-streaming decorators are used", async () => {
    const { program } = await openApiFor(`
      @service(#{ title: "S" }) namespace S;
      @route("/h") @get op h(): string;
    `);
    const host = memHost();
    const realHost = program.host;
    (program as any).host = host;
    try {
      await $onEmit({
        program,
        emitterOutputDir: "/out/typespec-x-ogen",
        options: {},
      } as EmitContext<XOgenEmitterOptions>);
    } finally {
      (program as any).host = realHost;
    }
    // Early return: nothing read, written, or reported.
    expect(host.fs.size).toBe(0);
    expect(program.diagnostics.map((d) => d.code)).not.toContain(
      "typespec-x-ogen/openapi3-output-not-found",
    );
  });
});
