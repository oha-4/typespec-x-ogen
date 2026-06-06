import { describe, expect, it } from "vitest";
import { openApiFor } from "./test-host";

describe("x-ogen-name", () => {
  it("customizes a model type name", async () => {
    const { document } = await openApiFor(`
      @service(#{ title: "S" }) namespace S;
      @ogenName("PetModel") model Pet { id: int32; }
      @route("/p") @get op p(): Pet;
    `);
    expect(document.components.schemas.Pet["x-ogen-name"]).toBe("PetModel");
  });

  it("customizes an enum type name", async () => {
    const { document } = await openApiFor(`
      @service(#{ title: "S" }) namespace S;
      @ogenName("PetStatus") enum Status { available, sold }
      model Pet { status: Status; }
      @route("/p") @get op p(): Pet;
    `);
    expect(document.components.schemas.Status["x-ogen-name"]).toBe("PetStatus");
  });
});

describe("x-ogen-properties", () => {
  it("folds @ogenName on a property into the parent schema", async () => {
    const { document } = await openApiFor(`
      @service(#{ title: "S" }) namespace S;
      model Pet {
        @ogenName("Identifier") id: int32;
        name: string;
      }
      @route("/p") @get op p(): Pet;
    `);
    expect(document.components.schemas.Pet["x-ogen-properties"]).toEqual({
      id: { name: "Identifier" },
    });
  });

  it("folds multiple renamed properties on one model", async () => {
    const { document } = await openApiFor(`
      @service(#{ title: "S" }) namespace S;
      model Pet {
        @ogenName("Identifier") id: int32;
        @ogenName("Title") name: string;
      }
      @route("/p") @get op p(): Pet;
    `);
    expect(document.components.schemas.Pet["x-ogen-properties"]).toEqual({
      id: { name: "Identifier" },
      name: { name: "Title" },
    });
  });

  it("folds independently across multiple models", async () => {
    const { document } = await openApiFor(`
      @service(#{ title: "S" }) namespace S;
      model Pet { @ogenName("PetId") id: int32; }
      model Owner { @ogenName("OwnerId") id: int32; }
      @route("/p") @get op p(): Pet;
      @route("/o") @get op o(): Owner;
    `);
    expect(document.components.schemas.Pet["x-ogen-properties"]).toEqual({
      id: { name: "PetId" },
    });
    expect(document.components.schemas.Owner["x-ogen-properties"]).toEqual({
      id: { name: "OwnerId" },
    });
  });
});

describe("x-oapi-codegen-extra-tags", () => {
  it("adds extra struct tags to a property", async () => {
    const { document } = await openApiFor(`
      @service(#{ title: "S" }) namespace S;
      model Pet {
        @ogenExtraTags(#{ gorm: "primaryKey", valid: "customIdValidator" }) id: int32;
      }
      @route("/p") @get op p(): Pet;
    `);
    expect(document.components.schemas.Pet.properties.id["x-oapi-codegen-extra-tags"]).toEqual({
      gorm: "primaryKey",
      valid: "customIdValidator",
    });
  });
});

describe("x-ogen-operation-group", () => {
  it("applies to a single operation", async () => {
    const { document } = await openApiFor(`
      @service(#{ title: "S" }) namespace S;
      @route("/h") @ogenOperationGroup("System") @get op health(): string;
    `);
    expect(document.paths["/h"].get["x-ogen-operation-group"]).toBe("System");
  });

  it("cascades over an interface", async () => {
    const { document } = await openApiFor(`
      @service(#{ title: "S" }) namespace S;
      @ogenOperationGroup("Pets")
      interface Pets {
        @get list(): string[];
        @post create(): string;
      }
    `);
    expect(document.paths["/"].get["x-ogen-operation-group"]).toBe("Pets");
    expect(document.paths["/"].post["x-ogen-operation-group"]).toBe("Pets");
  });

  it("lets an operation override the interface group", async () => {
    const { document } = await openApiFor(`
      @service(#{ title: "S" }) namespace S;
      @ogenOperationGroup("Pets")
      interface Pets {
        @route("/a") @get a(): string;
        @route("/b") @ogenOperationGroup("Special") @get b(): string;
      }
    `);
    expect(document.paths["/a"].get["x-ogen-operation-group"]).toBe("Pets");
    expect(document.paths["/b"].get["x-ogen-operation-group"]).toBe("Special");
  });
});
