import { describe, expect, it } from "vitest";
import { createMockLlm } from "./mockLlm.js";
import { evaluateSpendPolicy } from "./policy.js";
import { normalizeIsoDate } from "./deterministic.js";
import {
  CrashAfterCheckpointError,
  createMemoryCheckpointStore,
  runHarness,
  type HarnessNode,
} from "./runner.js";
import { buildNodesForTopology } from "./topology.js";
import {
  HarnessStateSchema,
  PlannerToExecutorPayloadSchema,
  promptView,
  type HarnessState,
} from "./state.js";

const baseState = (): HarnessState =>
  HarnessStateSchema.parse({
    phase: "init",
    taskId: "demo",
    nextNodeIndex: 0,
    artifacts: {},
    approvalGranted: false,
  });

describe("TC-3.1 deterministic transforms", () => {
  it("normalizes ISO dates without an LLM", () => {
    expect(normalizeIsoDate("  2026-04-10  ")).toBe("2026-04-10");
    expect(normalizeIsoDate("not-a-date")).toBe("not-a-date");
  });
});

describe("policy layer (TC-11 style)", () => {
  it("blocks high spend without approval", () => {
    expect(evaluateSpendPolicy({ amount: 100, threshold: 50, approvalGranted: false })).toEqual({
      allowed: false,
      reason: "approval_required",
    });
  });

  it("allows when approval is recorded in harness state", () => {
    expect(evaluateSpendPolicy({ amount: 100, threshold: 50, approvalGranted: true })).toEqual({
      allowed: true,
    });
  });
});

describe("mock LLM determinism", () => {
  it("returns stable structured output for identical prompts", () => {
    const llm = createMockLlm();
    const a = llm.completeJson("hello");
    const b = llm.completeJson("hello");
    expect(a).toEqual(b);
    expect(typeof a.mockId).toBe("string");
  });
});

describe("TC-5.1 crash after checkpoint then resume (no double-apply)", () => {
  it("restarts from saved nextNodeIndex without re-running finished nodes", async () => {
    const checkpoint = createMemoryCheckpointStore();
    const threadId = "thread-crash";
    let sideEffectTicks = 0;

    const nodes: HarnessNode[] = [
      {
        id: "step-a",
        run: (s) => {
          sideEffectTicks += 1;
          return { ...s, artifacts: { ...s.artifacts, a: true } };
        },
      },
      {
        id: "step-b",
        run: (s) => {
          sideEffectTicks += 1;
          return { ...s, artifacts: { ...s.artifacts, b: true } };
        },
      },
      {
        id: "step-c",
        run: (s) => {
          sideEffectTicks += 1;
          return { ...s, artifacts: { ...s.artifacts, c: true } };
        },
      },
    ];

    await expect(async () =>
      runHarness({
        runId: "run-1",
        threadId,
        nodes,
        initialState: baseState(),
        checkpoint,
        simulateCrashAfterCheckpointOfStepIndex: 1,
      }),
    ).rejects.toThrowError(CrashAfterCheckpointError);

    expect(sideEffectTicks).toBe(2);

    const recovered = checkpoint.load(threadId);
    expect(recovered).toBeDefined();
    expect(recovered?.nextNodeIndex).toBe(2);

    const { state: finalState } = await runHarness({
      runId: "run-1-resume",
      threadId,
      nodes,
      initialState: HarnessStateSchema.parse(recovered),
      checkpoint,
    });

    expect(sideEffectTicks).toBe(3);
    expect(finalState.artifacts).toMatchObject({ a: true, b: true, c: true });
    expect(finalState.phase).toBe("done");
  });
});

describe("TC-6.1 agent A to B payload contract", () => {
  it("does not treat invalid planner output as executor input", async () => {
    const checkpoint = createMemoryCheckpointStore();
    const nodes: HarnessNode[] = [
      {
        id: "planner",
        run: (s) => ({
          ...s,
          artifacts: { ...s.artifacts, plan: { wrongShape: true } },
        }),
      },
      {
        id: "executor",
        run: (s) => {
          const parsed = PlannerToExecutorPayloadSchema.safeParse(s.artifacts.plan);
          if (!parsed.success) {
            return {
              ...s,
              phase: "failed",
              lastError: "invalid_planner_payload",
            };
          }
          return { ...s, artifacts: { ...s.artifacts, executed: parsed.data.targetId } };
        },
      },
    ];

    const { state } = await runHarness({
      runId: "run-contract",
      threadId: "t-contract",
      nodes,
      initialState: baseState(),
      checkpoint,
    });

    expect(state.phase).toBe("failed");
    expect(state.lastError).toBe("invalid_planner_payload");
    expect(state.artifacts.executed).toBeUndefined();
  });

  it("accepts valid planner payloads", async () => {
    const checkpoint = createMemoryCheckpointStore();
    const nodes: HarnessNode[] = [
      {
        id: "planner",
        run: (s) => ({
          ...s,
          artifacts: {
            ...s.artifacts,
            plan: { intent: "summarize" as const, targetId: "doc-1" },
          },
        }),
      },
      {
        id: "executor",
        run: (s) => {
          const parsed = PlannerToExecutorPayloadSchema.safeParse(s.artifacts.plan);
          if (!parsed.success) {
            return { ...s, phase: "failed", lastError: "invalid_planner_payload" };
          }
          return { ...s, artifacts: { ...s.artifacts, executed: parsed.data.targetId } };
        },
      },
    ];

    const { state } = await runHarness({
      runId: "run-contract-ok",
      threadId: "t-contract-ok",
      nodes,
      initialState: baseState(),
      checkpoint,
    });

    expect(state.phase).toBe("done");
    expect(state.artifacts.executed).toBe("doc-1");
  });
});

describe("TC-7.1 trace shape", () => {
  it("records run metadata, timing, and tool calls", async () => {
    const checkpoint = createMemoryCheckpointStore();
    const nodes: HarnessNode[] = [
      {
        id: "with-tools",
        run: (s, ctx) => {
          ctx.recordToolCall("mock.fetch", { id: 1 });
          return { ...s, artifacts: { ...s.artifacts, ok: true } };
        },
      },
    ];

    const { trace } = await runHarness({
      runId: "run-trace",
      threadId: "t-trace",
      nodes,
      initialState: baseState(),
      checkpoint,
    });

    expect(trace.runId).toBe("run-trace");
    expect(trace.threadId).toBe("t-trace");
    expect(trace.startedAt).toBeLessThanOrEqual(Date.now());
    expect(trace.finishedAt).toBeDefined();
    expect(trace.nodeSpans).toHaveLength(1);
    expect(trace.nodeSpans[0]?.nodeId).toBe("with-tools");
    expect(trace.nodeSpans[0]?.toolCalls).toEqual([{ name: "mock.fetch", args: { id: 1 } }]);
  });
});

describe("TC-9.1 topology comparison (chain vs star)", () => {
  const runScenario = async (mode: "chain" | "star") => {
    const checkpoint = createMemoryCheckpointStore();
    const threadId = `t-${mode}`;

    const costNode =
      (id: string): HarnessNode =>
      ({
        id,
        run: (s) => {
          const prev = typeof s.artifacts.totalCost === "number" ? s.artifacts.totalCost : 0;
          return {
            ...s,
            artifacts: { ...s.artifacts, totalCost: prev + 1 },
          };
        },
      });

    const nodes =
      mode === "chain"
        ? buildNodesForTopology("chain", [costNode("c1"), costNode("c2"), costNode("c3")])
        : buildNodesForTopology("star", [], {
            hub: {
              id: "hub",
              run: (s) => ({
                ...s,
                artifacts: { ...s.artifacts, totalCost: 1 },
              }),
            },
            spokes: [
              {
                id: "s1",
                run: (s) => ({ ...s, artifacts: { ...s.artifacts, spoke1: true } }),
              },
              {
                id: "s2",
                run: (s) => ({ ...s, artifacts: { ...s.artifacts, spoke2: true } }),
              },
            ],
            merge: (base, spokeStates) => {
              const hubCost = typeof base.artifacts.totalCost === "number" ? base.artifacts.totalCost : 0;
              return {
                ...base,
                artifacts: {
                  ...base.artifacts,
                  totalCost: hubCost + spokeStates.length,
                  starMerged: true,
                },
              };
            },
          });

    const { state, trace } = await runHarness({
      runId: `run-${mode}`,
      threadId,
      nodes,
      initialState: baseState(),
      checkpoint,
    });

    return { state, trace };
  };

  it("exposes different span counts while keeping comparable cost metrics", async () => {
    const chain = await runScenario("chain");
    const star = await runScenario("star");

    expect(chain.trace.nodeSpans).toHaveLength(3);
    expect(star.trace.nodeSpans).toHaveLength(1);
    expect(chain.state.artifacts.totalCost).toBe(3);
    expect(star.state.artifacts.totalCost).toBe(3);
    expect(star.state.artifacts.starMerged).toBe(true);
  });
});

describe("promptView is derived from state (state authority)", () => {
  it("serializes canonical fields for UI adapters", () => {
    const s = baseState();
    const v1 = promptView(s);
    const v2 = promptView({ ...s, artifacts: { note: "x" } });
    expect(v1).not.toBe(v2);
    expect(v2).toContain("note");
  });
});
