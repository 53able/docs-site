/**
 * Policy evaluation for high-risk operations (harness / runner layer, not free-form prompts).
 */

export type SpendPolicyInput = {
  /** Monetary amount in minor units or abstract cost units. */
  amount: number;
  threshold: number;
  approvalGranted: boolean;
};

export type SpendPolicyResult =
  | { allowed: true }
  | { allowed: false; reason: "approval_required" };

/**
 * Rejects spends above `threshold` unless explicit approval was recorded in harness state.
 *
 * @param input - Amount, threshold, and whether approval was granted out-of-band.
 */
export const evaluateSpendPolicy = (input: SpendPolicyInput): SpendPolicyResult => {
  if (input.amount > input.threshold && !input.approvalGranted) {
    return { allowed: false, reason: "approval_required" };
  }
  return { allowed: true };
};
