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

  it("cascades a namespace group over direct, interface, and nested ops", async () => {
    const [{ program, a, b, c, d }] = await Tester.compileAndDiagnose(t.code`
      @service(#{ title: "S" }) namespace S;
      @ogenOperationGroup("Grp")
      namespace G {
        @route("/a") @get op ${t.op("a")}(): void;
        @route("/b") @ogenOperationGroup("Own") @get op ${t.op("b")}(): void;
        interface I {
          @route("/c") @get ${t.op("c")}(): void;
        }
        namespace Nested {
          @route("/d") @get op ${t.op("d")}(): void;
        }
      }
    `);
    // dist's $onValidate already cascaded; clear the inherited groups so the
    // src run actually re-applies them (and instruments that path). `b` keeps
    // its own group to exercise the "already set" skip.
    for (const op of [a, c, d]) {
      getExtensions(program, op).delete("x-ogen-operation-group");
    }
    $onValidate(program);
    expect(getExtensions(program, a).get("x-ogen-operation-group")).toBe("Grp");
    expect(getExtensions(program, c).get("x-ogen-operation-group")).toBe("Grp");
    expect(getExtensions(program, d).get("x-ogen-operation-group")).toBe("Grp");
    expect(getExtensions(program, b).get("x-ogen-operation-group")).toBe("Own");
  });

  it("folds multiple property names into one parent", async () => {
    const [{ program, Pet }] = await Tester.compileAndDiagnose(t.code`
      @service(#{ title: "S" }) namespace S;
      model ${t.model("Pet")} {
        @ogenName("Id") id: int32;
        @ogenName("Title") name: string;
      }
      @route("/p") @get op p(): Pet[];
    `);
    // Clear so the src run rebuilds from empty (undefined branch) then extends
    // the now-existing map (defined branch) for the second property.
    getExtensions(program, Pet).delete("x-ogen-properties");
    $onValidate(program);
    expect(getExtensions(program, Pet).get("x-ogen-properties")).toEqual({
      id: { name: "Id" },
      name: { name: "Title" },
    });
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

  it("does not warn when emit is empty (language server default)", async () => {
    const [{ program }] = await Tester.compileAndDiagnose(`
      @service(#{ title: "S" })
      @server("https://api.example.com", "Production")
      @ogenServerName("https://api.example.com", "production")
      namespace S;
      @route("/h") @ogenJsonStreaming @get op h(): string;
    `);
    // The TypeSpec language server sets emit to [] by default (it skips
    // emitters), so an empty list must not produce the missing-emitter warning.
    (program.compilerOptions as any).emit = [];
    const before = program.diagnostics.length;
    $onValidate(program);
    expect(program.diagnostics.length).toBe(before);
  });
});
