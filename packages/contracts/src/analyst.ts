import { z } from "zod";

/** The Analyst may only call these engine tools (CLAUDE.md §7.12). */
export const AnalystToolNameSchema = z.enum([
  "listSites",
  "getHorizon",
  "getSunEarth",
  "getTimeline",
  "findWindows",
  "probeLit",
]);
export type AnalystToolName = z.infer<typeof AnalystToolNameSchema>;

export const ToolCallRecordSchema = z.object({
  id: z.string().min(1),
  tool: AnalystToolNameSchema,
  /** Validated against the tool's own schema before the call; opaque here. */
  input: z.unknown(),
});
export type ToolCallRecord = z.infer<typeof ToolCallRecordSchema>;

/** A number in a claim, pointing at the tool output that contains it. */
export const GroundingCitationSchema = z.object({
  tool_call_id: z.string().min(1),
  json_path: z.string().min(1),
  value: z.number().finite(),
  unit: z.string().min(1).nullable(),
});
export type GroundingCitation = z.infer<typeof GroundingCitationSchema>;

export const AnalystClaimSchema = z
  .object({
    claim_text: z.string().min(1),
    tool_calls: z.array(ToolCallRecordSchema),
    citations: z.array(GroundingCitationSchema),
    /** Set by the server-side grounding checker, never by the model. */
    grounded: z.boolean(),
  })
  .refine((c) => c.citations.every((cit) => c.tool_calls.some((t) => t.id === cit.tool_call_id)), {
    message: "every citation must reference a tool call in this claim",
    path: ["citations"],
  })
  .refine((c) => !c.grounded || c.citations.length > 0, {
    message: "a grounded claim needs at least one citation",
    path: ["grounded"],
  });
export type AnalystClaim = z.infer<typeof AnalystClaimSchema>;
