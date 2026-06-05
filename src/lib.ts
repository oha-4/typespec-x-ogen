import { createTypeSpecLibrary } from "@typespec/compiler";

export const $lib = createTypeSpecLibrary({
  name: "typespec-x-ogen",
  diagnostics: {},
});

export const { reportDiagnostic, createDiagnostic } = $lib;
