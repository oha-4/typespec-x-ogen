import { resolvePath } from "@typespec/compiler";
import { createTester } from "@typespec/compiler/testing";
import { getOpenAPI3 } from "@typespec/openapi3";
import { fileURLToPath } from "url";

const packageRoot = resolvePath(fileURLToPath(import.meta.url), "../..");

/** Tester with http + the library under test imported and `using`-ed. */
export const Tester = createTester(packageRoot, {
  libraries: ["@typespec/http", "@typespec/openapi", "@typespec/openapi3", "typespec-x-ogen"],
})
  .import("@typespec/http", "typespec-x-ogen")
  .using("Http", "TypespecXOgen");

/** Compile `code` and return the program plus the emitted OpenAPI 3 document. */
export async function openApiFor(code: string): Promise<{ program: any; document: any }> {
  const [{ program }] = await Tester.compileAndDiagnose(code);
  const records = await getOpenAPI3(program, {});
  const record = records[0];
  const document = record.versioned ? record.versions[0].document : record.document;
  return { program, document };
}
