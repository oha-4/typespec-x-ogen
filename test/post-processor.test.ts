import { describe, expect, it } from "vitest";
import { patchOpenAPIDocument } from "../dist/src/emitter.js";
import { openApiFor } from "./test-host";

describe("x-ogen-server-name", () => {
  it("patches the matching server object", async () => {
    const { program, document } = await openApiFor(`
      @service(#{ title: "S" })
      @server("https://api.example.com", "Production")
      @ogenServerName("https://api.example.com", "production")
      namespace S;
      @route("/h") @get op h(): string;
    `);
    patchOpenAPIDocument(program, document);
    const server = document.servers.find((s: any) => s.url === "https://api.example.com");
    expect(server["x-ogen-server-name"]).toBe("production");
  });

  it("leaves non-matching servers untouched", async () => {
    const { program, document } = await openApiFor(`
      @service(#{ title: "S" })
      @server("https://api.example.com", "Production")
      @server("https://staging.example.com", "Staging")
      @ogenServerName("https://api.example.com", "production")
      namespace S;
      @route("/h") @get op h(): string;
    `);
    patchOpenAPIDocument(program, document);
    const staging = document.servers.find((s: any) => s.url === "https://staging.example.com");
    expect(staging["x-ogen-server-name"]).toBeUndefined();
  });
});

describe("x-ogen-json-streaming", () => {
  const spec = (decorator: string) => `
    @service(#{ title: "S" }) namespace S;
    model Pet { id: int32; }
    @route("/pets") @post ${decorator} op create(@body pet: Pet): Pet;
  `;

  it("marks both request and response application/json by default", async () => {
    const { program, document } = await openApiFor(spec("@ogenJsonStreaming"));
    patchOpenAPIDocument(program, document);
    const post = document.paths["/pets"].post;
    expect(post.requestBody.content["application/json"]["x-ogen-json-streaming"]).toBe(true);
    expect(post.responses["200"].content["application/json"]["x-ogen-json-streaming"]).toBe(true);
  });

  it("marks only the request when location is request", async () => {
    const { program, document } = await openApiFor(spec(`@ogenJsonStreaming("request")`));
    patchOpenAPIDocument(program, document);
    const post = document.paths["/pets"].post;
    expect(post.requestBody.content["application/json"]["x-ogen-json-streaming"]).toBe(true);
    expect(post.responses["200"].content["application/json"]["x-ogen-json-streaming"]).toBeUndefined();
  });

  it("marks only the response when location is response", async () => {
    const { program, document } = await openApiFor(spec(`@ogenJsonStreaming("response")`));
    patchOpenAPIDocument(program, document);
    const post = document.paths["/pets"].post;
    expect(post.requestBody.content["application/json"]["x-ogen-json-streaming"]).toBeUndefined();
    expect(post.responses["200"].content["application/json"]["x-ogen-json-streaming"]).toBe(true);
  });
});
