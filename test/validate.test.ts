import { t } from "@typespec/compiler/testing";
import { getExtensions } from "@typespec/openapi";
import { describe, expect, it } from "vitest";
import { $onValidate } from "../src/validate";
import { Tester } from "./test-host";

describe("$onValidate", () => {
  it("folds property names and cascades operation groups", async () => {
    const [{ program, Pet, list }] = await Tester.compileAndDiagnose(t.code`
      @service(#{ title: "S" }) namespace S;
      model ${t.model("Pet")} { @ogenName("Identifier") id: int32; }
      @ogenOperationGroup("Pets") interface Pets { @get ${t.op("list")}(): Pet[]; }
    `);
    // Run the src version to instrument it (dist already ran during compile).
    $onValidate(program);
    expect(getExtensions(program, Pet).get("x-ogen-properties")).toEqual({
      id: { name: "Identifier" },
    });
    expect(getExtensions(program, list).get("x-ogen-operation-group")).toBe("Pets");
  });

  it("warns when server-name/json-streaming are used without the emitter", async () => {
    const [{ program }] = await Tester.compileAndDiagnose(`
      @service(#{ title: "S" })
      @server("https://api.example.com", "Production")
      @ogenServerName("https://api.example.com", "production")
      namespace S;
      @route("/h") @ogenJsonStreaming @get op h(): string;
    `);
    (program.compilerOptions as any).emit = ["@typespec/openapi3"];
    $onValidate(program);
    const codes = program.diagnostics.map((d) => d.code);
    expect(codes.filter((c) => c === "typespec-x-ogen/requires-emitter")).toHaveLength(2);
  });

  it("does not warn when the emitter is enabled", async () => {
    const [{ program }] = await Tester.compileAndDiagnose(`
      @service(#{ title: "S" })
      @server("https://api.example.com", "Production")
      @ogenServerName("https://api.example.com", "production")
      namespace S;
      @route("/h") @ogenJsonStreaming @get op h(): string;
    `);
    (program.compilerOptions as any).emit = ["@typespec/openapi3", "typespec-x-ogen"];
    const before = program.diagnostics.length;
    $onValidate(program);
    expect(program.diagnostics.length).toBe(before);
  });
});
