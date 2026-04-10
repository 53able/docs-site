import { createHash } from "node:crypto";

export type MockLlm = {
  /**
   * Returns a deterministic JSON object for a given prompt string.
   *
   * @param prompt - Arbitrary prompt text.
   */
  completeJson: (prompt: string) => Record<string, unknown>;
};

/**
 * Factory for a deterministic pseudo-LLM (no network). Stable across runs for the same prompt.
 */
export const createMockLlm = (): MockLlm => ({
  completeJson: (prompt: string) => {
    const digest = createHash("sha256").update(prompt, "utf8").digest("hex").slice(0, 16);
    return { mockId: digest, echoLength: prompt.length };
  },
});
