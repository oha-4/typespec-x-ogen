import { createTypeSpecLibrary, paramMessage, type JSONSchemaType } from "@typespec/compiler";
import type { XOgenEmitterOptions } from "./emitter.js";

const EmitterOptionsSchema: JSONSchemaType<XOgenEmitterOptions> = {
  type: "object",
  additionalProperties: false,
  properties: {
    "openapi3-output-dir": { type: "string", nullable: true },
  },
  required: [],
};

export const $lib = createTypeSpecLibrary({
  name: "typespec-x-ogen",
  diagnostics: {
    "requires-emitter": {
      severity: "warning",
      messages: {
        default: paramMessage`'@${"decorator"}' has no effect unless the 'typespec-x-ogen' emitter runs. Add 'typespec-x-ogen' to your emit list, after '@typespec/openapi3'.`,
      },
    },
    "openapi3-output-not-found": {
      severity: "warning",
      messages: {
        default: paramMessage`No OpenAPI 3 output found in '${"dir"}'. Ensure '@typespec/openapi3' is listed before 'typespec-x-ogen' in your emit list, or set the 'openapi3-output-dir' option.`,
      },
    },
  },
  emitter: {
    options: EmitterOptionsSchema,
  },
});

export const { reportDiagnostic, createDiagnostic } = $lib;
