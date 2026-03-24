export * from "./tool-contracts.js";
export * from "./outcomes.js";

export function createAgentRuntimePlaceholder() {
  return {
    run: async () => ({ status: "not_implemented" as const })
  };
}
