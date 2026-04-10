import type { HarnessNode, NodeContext } from "./runner.js";
import { HarnessStateSchema, type HarnessState } from "./state.js";

export type TopologyMode = "chain" | "star";

export type StarTopologyConfig = {
  /** Runs once before spokes; typically prepares shared context in artifacts. */
  hub: HarnessNode;
  /** Executed concurrently; each receives the same base state plus `artifacts.starBase`. */
  spokes: HarnessNode[];
  /**
   * Merges spoke outputs into one state. Receives an array of states in spoke order.
   * Must return a full {@link HarnessState}.
   */
  merge: (base: HarnessState, spokeStates: HarnessState[]) => HarnessState;
};

/**
 * Expands a high-level topology into a linear {@link HarnessNode} list so the same runner + state schema apply.
 *
 * @param mode - `chain` keeps order; `star` runs hub then parallel spokes then merge.
 * @param nodes - Sequential nodes when `mode === "chain"`.
 * @param star - Required when `mode === "star"`.
 */
export const buildNodesForTopology = (
  mode: TopologyMode,
  nodes: HarnessNode[],
  star?: StarTopologyConfig,
): HarnessNode[] => {
  if (mode === "chain") {
    return nodes;
  }

  if (!star) {
    throw new Error('star config is required when mode === "star"');
  }

  const starStep: HarnessNode = {
    id: "topology:star",
    run: async (base: HarnessState, ctx: NodeContext) => {
      const hubOut = await star.hub.run(base, ctx);
      const spokeStates = await Promise.all(
        star.spokes.map(async (spoke) => spoke.run(HarnessStateSchema.parse(hubOut), ctx)),
      );
      return star.merge(HarnessStateSchema.parse(hubOut), spokeStates);
    },
  };

  return [starStep];
};
