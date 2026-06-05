import {
  $ogenExtraTags,
  $ogenJsonStreaming,
  $ogenName,
  $ogenOperationGroup,
  $ogenServerName,
} from "./decorators.js";

export { $lib } from "./lib.js";
export { $onValidate } from "./validate.js";
export { $onEmit, type XOgenEmitterOptions } from "./emitter.js";

/**
 * Decorator implementations linked to the `extern dec` declarations in
 * `lib/main.tsp`. They are intentionally exposed only through this
 * namespace-scoped map (not as top-level `$name` exports) so the compiler does
 * not also bind them into the global namespace.
 */
export const $decorators = {
  TypespecXOgen: {
    ogenName: $ogenName,
    ogenExtraTags: $ogenExtraTags,
    ogenOperationGroup: $ogenOperationGroup,
    ogenServerName: $ogenServerName,
    ogenJsonStreaming: $ogenJsonStreaming,
  },
};
