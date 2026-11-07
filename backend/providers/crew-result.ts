import { crewOutput } from "./naive";
import type { z } from "zod";

export type CrewSnapshot = {
  status: string;
  stop_reason: string | null;
  consumed_micro_usd: number;
  result: z.infer<typeof crewOutput> | null;
  output_valid: boolean;
  approval_required: boolean;
};

// Never expose an intermediate submit_output as a completed review.
export function completedCrewSnapshot(session: {
  status: string; stop_reason: string | null; consumed_micro_usd: number;
  structured_output: unknown; pending_actions: unknown[];
}, expectedDifference?: number | null, sources?: {document_id:string;sha256:string}[]): CrewSnapshot {
  const parsed = crewOutput.safeParse(session.structured_output);
  const finished = session.status === "completed" || (session.status === "idle" && session.stop_reason === "end_turn");
  const refs=parsed.success?parsed.data.document_references??[]:[];
  const referencesValid=sources===undefined || (refs.every(r=>sources.some(s=>s.document_id===r.document_id&&s.sha256===r.sha256)) && (!sources.length||refs.length>0));
  const valid = referencesValid && finished && parsed.success && session.pending_actions.length === 0 && (expectedDifference === undefined || parsed.data.potential_discrepancy_cents === expectedDifference);
  return {
    status: session.status, stop_reason: session.stop_reason,
    consumed_micro_usd: session.consumed_micro_usd,
    result: valid ? parsed.data : null,
    output_valid: valid,
    approval_required: session.pending_actions.length > 0,
  };
}
