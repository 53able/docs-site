import { z } from "zod";

/** High-level lifecycle for a harness run. */
export const HarnessPhaseSchema = z.enum(["init", "running", "done", "failed"]);

export type HarnessPhase = z.infer<typeof HarnessPhaseSchema>;

/**
 * Canonical harness state. Conversation text MUST be derived from this object (see `promptView`),
 * not treated as the source of truth.
 */
export const HarnessStateSchema = z.object({
  phase: HarnessPhaseSchema,
  taskId: z.string(),
  /** Index of the next {@link HarnessNode} to execute (0-based). */
  nextNodeIndex: z.number().int().nonnegative(),
  artifacts: z.record(z.string(), z.unknown()),
  approvalGranted: z.boolean(),
  lastError: z.string().optional(),
});

export type HarnessState = z.infer<typeof HarnessStateSchema>;

/**
 * Serializes state into a stable prompt-facing view for tests and UI adapters.
 *
 * @param state - Harness state snapshot.
 * @returns Single string view; business logic must not parse this back as authority.
 */
export const promptView = (state: HarnessState): string => {
  const payload = {
    phase: state.phase,
    taskId: state.taskId,
    nextNodeIndex: state.nextNodeIndex,
    artifacts: state.artifacts,
    approvalGranted: state.approvalGranted,
    lastError: state.lastError,
  };
  return JSON.stringify(payload, null, 0);
};

/** Payload passed from planner-style node to executor node (TC-6.1 boundary). */
export const PlannerToExecutorPayloadSchema = z.object({
  intent: z.enum(["summarize", "refactor"]),
  targetId: z.string().min(1),
});

export type PlannerToExecutorPayload = z.infer<typeof PlannerToExecutorPayloadSchema>;
