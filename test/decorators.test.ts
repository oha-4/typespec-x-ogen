import { t } from "@typespec/compiler/testing";
import { getExtensions } from "@typespec/openapi";
import { describe, expect, it } from "vitest";
import {
  $ogenExtraTags,
  $ogenJsonStreaming,
  $ogenName,
  $ogenOperationGroup,
  $ogenServerName,
} from "../src/decorators";
import {
  JsonStreamingKey,
  OperationGroupKey,
  PropertyNameKey,
  ServerNameKey,
} from "../src/state";
import { Tester } from "./test-host";

// Decorators only read `context.program`.
const ctx = (program: any) => ({ program }) as any;

describe("$ogenName", () => {
  it("sets x-ogen-name on a model", async () => {
    const { program, Foo } = await Tester.compile(
      t.code`model ${t.model("Foo")} { id: int32; }`,
    );
    $ogenName(ctx(program), Foo, "FooName");
    expect(getExtensions(program, Foo).get("x-ogen-name")).toBe("FooName");
  });

  it("defers a property name into state for later folding", async () => {
    const { program, id } = await Tester.compile(
      t.code`model Foo { ${t.modelProperty("id")}: int32; }`,
    );
    $ogenName(ctx(program), id, "Identifier");
    expect(program.stateMap(PropertyNameKey).get(id)).toBe("Identifier");
  });
});

describe("$ogenExtraTags", () => {
  it("sets x-oapi-codegen-extra-tags on a property", async () => {
    const { program, id } = await Tester.compile(
      t.code`model Foo { ${t.modelProperty("id")}: int32; }`,
    );
    $ogenExtraTags(ctx(program), id, { gorm: "primaryKey" });
    expect(getExtensions(program, id).get("x-oapi-codegen-extra-tags")).toEqual(
      {
        gorm: "primaryKey",
      },
    );
  });
});

describe("$ogenOperationGroup", () => {
  it("sets the extension directly on an operation", async () => {
    const { program, list } = await Tester.compile(
      t.code`op ${t.op("list")}(): void;`,
    );
    $ogenOperationGroup(ctx(program), list, "Pets");
    expect(getExtensions(program, list).get("x-ogen-operation-group")).toBe(
      "Pets",
    );
  });

  it("stores a container group in state for the emitter cascade", async () => {
    const { program, I } = await Tester.compile(
      t.code`interface ${t.interface("I")} { op a(): void; }`,
    );
    $ogenOperationGroup(ctx(program), I, "Pets");
    expect(program.stateMap(OperationGroupKey).get(I)).toBe("Pets");
  });
});

describe("$ogenServerName", () => {
  it("accumulates server name entries on the namespace", async () => {
    const { program, S } = await Tester.compile(
      t.code`namespace ${t.namespace("S")} {}`,
    );
    $ogenServerName(ctx(program), S, "https://a.example.com", "production");
    $ogenServerName(ctx(program), S, "https://b.example.com", "staging");
    expect(program.stateMap(ServerNameKey).get(S)).toEqual([
      { namespace: S, url: "https://a.example.com", name: "production" },
      { namespace: S, url: "https://b.example.com", name: "staging" },
    ]);
  });
});

describe("$ogenJsonStreaming", () => {
  it("records the location (or undefined) per operation", async () => {
    const { program, h } = await Tester.compile(
      t.code`op ${t.op("h")}(): void;`,
    );
    $ogenJsonStreaming(ctx(program), h, "request");
    expect(program.stateMap(JsonStreamingKey).get(h)).toBe("request");
  });
});
