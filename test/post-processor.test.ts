import { describe, expect, it } from "vitest";
import { patchOpenAPIDocument } from "../src/emitter";
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
    const server = document.servers.find(
      (s: any) => s.url === "https://api.example.com",
    );
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
    const staging = document.servers.find(
      (s: any) => s.url === "https://staging.example.com",
    );
    expect(staging["x-ogen-server-name"]).toBeUndefined();
  });

  it("patches each server independently", async () => {
    const { program, document } = await openApiFor(`
      @service(#{ title: "S" })
      @server("https://api.example.com", "Production")
      @server("https://staging.example.com", "Staging")
      @ogenServerName("https://api.example.com", "production")
      @ogenServerName("https://staging.example.com", "staging")
      namespace S;
      @route("/h") @get op h(): string;
    `);
    patchOpenAPIDocument(program, document);
    const prod = document.servers.find(
      (s: any) => s.url === "https://api.example.com",
    );
    const staging = document.servers.find(
      (s: any) => s.url === "https://staging.example.com",
    );
    expect(prod["x-ogen-server-name"]).toBe("production");
    expect(staging["x-ogen-server-name"]).toBe("staging");
  });

  it("does nothing when the document has no servers", async () => {
    const { program, document } = await openApiFor(`
      @service(#{ title: "S" })
      @ogenServerName("https://api.example.com", "production")
      namespace S;
      @route("/h") @get op h(): string;
    `);
    delete document.servers;
    expect(() => patchOpenAPIDocument(program, document)).not.toThrow();
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
    expect(
      post.requestBody.content["application/json"]["x-ogen-json-streaming"],
    ).toBe(true);
    expect(
      post.responses["200"].content["application/json"][
        "x-ogen-json-streaming"
      ],
    ).toBe(true);
  });

  it("marks only the request when location is request", async () => {
    const { program, document } = await openApiFor(
      spec(`@ogenJsonStreaming("request")`),
    );
    patchOpenAPIDocument(program, document);
    const post = document.paths["/pets"].post;
    expect(
      post.requestBody.content["application/json"]["x-ogen-json-streaming"],
    ).toBe(true);
    expect(
      post.responses["200"].content["application/json"][
        "x-ogen-json-streaming"
      ],
    ).toBeUndefined();
  });

  it("marks only the response when location is response", async () => {
    const { program, document } = await openApiFor(
      spec(`@ogenJsonStreaming("response")`),
    );
    patchOpenAPIDocument(program, document);
    const post = document.paths["/pets"].post;
    expect(
      post.requestBody.content["application/json"]["x-ogen-json-streaming"],
    ).toBeUndefined();
    expect(
      post.responses["200"].content["application/json"][
        "x-ogen-json-streaming"
      ],
    ).toBe(true);
  });

  it("marks +json media types but leaves non-json ones alone", async () => {
    const { program, document } = await openApiFor(spec("@ogenJsonStreaming"));
    const reqContent = document.paths["/pets"].post.requestBody.content;
    reqContent["application/merge-patch+json"] = reqContent["application/json"];
    reqContent["application/xml"] = { schema: {} };
    delete reqContent["application/json"];
    patchOpenAPIDocument(program, document);
    expect(
      reqContent["application/merge-patch+json"]["x-ogen-json-streaming"],
    ).toBe(true);
    expect(
      reqContent["application/xml"]["x-ogen-json-streaming"],
    ).toBeUndefined();
  });

  it("tolerates a document with no paths", async () => {
    const { program } = await openApiFor(spec("@ogenJsonStreaming"));
    expect(() => patchOpenAPIDocument(program, {})).not.toThrow();
  });

  it("tolerates an operation with no responses", async () => {
    const { program, document } = await openApiFor(spec("@ogenJsonStreaming"));
    delete document.paths["/pets"].post.responses;
    patchOpenAPIDocument(program, document);
    const post = document.paths["/pets"].post;
    expect(
      post.requestBody.content["application/json"]["x-ogen-json-streaming"],
    ).toBe(true);
  });

  it("skips operations whose operationId does not match", async () => {
    const { program, document } = await openApiFor(spec("@ogenJsonStreaming"));
    // Break the match so the guard in patchOpenAPIDocument skips it.
    document.paths["/pets"].post.operationId = "doesNotMatch";
    patchOpenAPIDocument(program, document);
    const post = document.paths["/pets"].post;
    expect(
      post.requestBody.content["application/json"]["x-ogen-json-streaming"],
    ).toBeUndefined();
    expect(
      post.responses["200"].content["application/json"][
        "x-ogen-json-streaming"
      ],
    ).toBeUndefined();
  });
});
