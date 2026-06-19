import { z } from "zod";

export const codexHookInputSchema = z.object({
  cwd: z.string().min(1).optional(),
  hook_event_name: z.string().min(1),
  session_id: z.string().min(1).optional(),
  tool_name: z.string().min(1).optional(),
});

export type CodexHookInput = z.infer<typeof codexHookInputSchema>;
