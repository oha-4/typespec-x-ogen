import { expectDiagnostics } from "@typespec/compiler/testing";
import { describe, expect, it } from "vitest";
import { Tester } from "./test-host";

const spec = `
  @service(#{ title: "S" })
  @server("https://api.example.com", "Production")
  @ogenServerName("https://api.example.com", "production")
  namespace S;
  @route("/h") @ogenJsonStreaming @get op h(): string;
`;

describe("requires-emitter warning", () => {
  it("warns when server-name/json-streaming are used without the emitter", async () => {
    const [, diagnostics] =
      await Tester.emit("@typespec/openapi3").compileAndDiagnose(spec);
    expectDiagnostics(diagnostics, [
      { code: "typespec-x-ogen/requires-emitter", severity: "warning" },
      { code: "typespec-x-ogen/requires-emitter", severity: "warning" },
    ]);
  });

  it("does not warn when the typespec-x-ogen emitter is enabled", async () => {
    const [, diagnostics] =
      await Tester.emit("typespec-x-ogen").compileAndDiagnose(spec);
    const requiresEmitter = diagnostics.filter(
      (d) => d.code === "typespec-x-ogen/requires-emitter",
    );
    expect(requiresEmitter).toHaveLength(0);
  });
});
