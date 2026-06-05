import { createTypeSpecLibrary, type JSONSchemaType } from "@typespec/compiler";
import type { XOgenEmitterOptions } from "./emitter.js";

const EmitterOptionsSchema: JSONSchemaType<XOgenEmitterOptions> = {
  type: "object",
  additionalProperties: false,
  properties: {
    "file-type": { type: "string", enum: ["yaml", "json"], nullable: true },
    "output-file": { type: "string", nullable: true },
    "openapi-versions": {
      type: "array",
      items: { type: "string" },
      nullable: true,
    },
  },
  required: [],
};

export const $lib = createTypeSpecLibrary({
  name: "typespec-x-ogen",
  diagnostics: {},
  emitter: {
    options: EmitterOptionsSchema,
  },
});

export const { reportDiagnostic, createDiagnostic } = $lib;
