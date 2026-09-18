/** Why a recorded occurrence could not be replayed. */
export type ReplayMissReason =
  | "invalid-request"
  | "no-recorded-request"
  | "no-recorded-resolution";

/**
 * The journal has nothing to answer with. In `strict` mode this is a hard
 * failure rather than a result (ADR-0004 §2): a miss is a failure of the
 * replay harness, not an outcome the agent produced, and returning an
 * error result would let a run continue on a fiction.
 */
export class ReplayMissError extends Error {
  readonly reason: ReplayMissReason;
  readonly runId: string;
  readonly effectId: string;

  constructor(reason: ReplayMissReason, runId: string, effectId: string, message: string) {
    super(message);
    this.name = "ReplayMissError";
    this.reason = reason;
    this.runId = runId;
    this.effectId = effectId;
  }
}

/**
 * The occurrence was recorded, but the effect being replayed is not the
 * effect that was recorded under that id. Reported instead of resolved,
 * because returning the recorded result would feed the agent an answer to
 * a question it did not ask.
 */
export class ReplayMismatchError extends Error {
  readonly runId: string;
  readonly effectId: string;
  readonly field: "type" | "input";
  readonly recorded: string;
  readonly requested: string;

  constructor(
    runId: string,
    effectId: string,
    field: "type" | "input",
    recorded: string,
    requested: string,
  ) {
    super(
      `replaying ${runId}/${effectId}: recorded ${field} ${recorded} but ${requested} was requested`,
    );
    this.name = "ReplayMismatchError";
    this.runId = runId;
    this.effectId = effectId;
    this.field = field;
    this.recorded = recorded;
    this.requested = requested;
  }
}
