import { z } from "zod";
import { HarnessStateSchema, type HarnessState } from "./state.js";

export const ToolCallSchema = z.object({
  name: z.string(),
  args: z.unknown(),
});

export type ToolCall = z.infer<typeof ToolCallSchema>;

export const NodeSpanSchema = z.object({
  nodeId: z.string(),
  startedAt: z.number(),
  finishedAt: z.number(),
  toolCalls: z.array(ToolCallSchema),
});

export type NodeSpan = z.infer<typeof NodeSpanSchema>;

export const RunTraceSchema = z.object({
  runId: z.string(),
  threadId: z.string(),
  startedAt: z.number(),
  finishedAt: z.number().optional(),
  nodeSpans: z.array(NodeSpanSchema),
});

export type RunTrace = z.infer<typeof RunTraceSchema>;

export type NodeContext = {
  /** Records a tool invocation for observability (TC-7.1). */
  recordToolCall: (name: string, args: unknown) => void;
};

export type HarnessNode = {
  id: string;
  run: (state: HarnessState, ctx: NodeContext) => HarnessState | Promise<HarnessState>;
};

export type CheckpointStore = {
  save: (threadId: string, state: HarnessState) => void;
  load: (threadId: string) => HarnessState | undefined;
};

export class CrashAfterCheckpointError extends Error {
  public readonly stepIndex: number;

  public constructor(stepIndex: number) {
    super(`Simulated crash after checkpoint at stepIndex=${String(stepIndex)}`);
    this.name = "CrashAfterCheckpointError";
    this.stepIndex = stepIndex;
  }
}

export type RunHarnessOptions = {
  runId: string;
  threadId: string;
  nodes: HarnessNode[];
  initialState: HarnessState;
  checkpoint: CheckpointStore;
  /**
   * After finishing the node at this 0-based index, persist checkpoint then throw {@link CrashAfterCheckpointError}.
   * Used to exercise resume without double-applying earlier steps.
   */
  simulateCrashAfterCheckpointOfStepIndex?: number;
};

export type RunHarnessResult = {
  state: HarnessState;
  trace: RunTrace;
};

const nowMs = (): number => Date.now();

/**
 * Executes harness nodes in order starting at `initialState.nextNodeIndex`, persisting checkpoints after each node.
 *
 * @param options - Run identifiers, nodes, state snapshot, checkpoint backend, optional crash simulation.
 */
export const runHarness = async (options: RunHarnessOptions): Promise<RunHarnessResult> => {
  const { runId, threadId, nodes, checkpoint, simulateCrashAfterCheckpointOfStepIndex } = options;
  const startedAt = nowMs();
  const trace: RunTrace = {
    runId,
    threadId,
    startedAt,
    nodeSpans: [],
  };

  let state = HarnessStateSchema.parse(options.initialState);
  state = { ...state, phase: "running" };

  for (let i = state.nextNodeIndex; i < nodes.length; i += 1) {
    const node = nodes[i];
    if (!node) {
      break;
    }
    const toolCalls: ToolCall[] = [];
    const ctx: NodeContext = {
      recordToolCall: (name: string, args: unknown) => {
        toolCalls.push(ToolCallSchema.parse({ name, args }));
      },
    };
    const spanStarted = nowMs();
    const nextState = await node.run(state, ctx);
    const withIndex = HarnessStateSchema.parse({
      ...nextState,
      nextNodeIndex: i + 1,
    });
    state =
      withIndex.phase === "failed"
        ? withIndex
        : { ...withIndex, phase: "running" };
    checkpoint.save(threadId, state);
    trace.nodeSpans.push({
      nodeId: node.id,
      startedAt: spanStarted,
      finishedAt: nowMs(),
      toolCalls,
    });

    if (simulateCrashAfterCheckpointOfStepIndex === i) {
      throw new CrashAfterCheckpointError(i);
    }

    if (state.phase === "failed") {
      const finishedAt = nowMs();
      return {
        state,
        trace: { ...trace, finishedAt, nodeSpans: trace.nodeSpans },
      };
    }
  }

  state = { ...state, phase: "done" };
  const finishedAt = nowMs();
  return {
    state,
    trace: { ...trace, finishedAt, nodeSpans: trace.nodeSpans },
  };
};

/**
 * In-memory checkpoint store for tests and local experiments.
 */
export const createMemoryCheckpointStore = (): CheckpointStore => {
  const data = new Map<string, HarnessState>();
  return {
    save: (threadId: string, snapshot: HarnessState) => {
      data.set(threadId, HarnessStateSchema.parse(snapshot));
    },
    load: (threadId: string) => data.get(threadId),
  };
};
