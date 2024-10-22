import { z } from 'zod';

// Add this to your existing schema file or create a new one
export const AccountSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  coins: z.number().int(),
  username: z.string().nullable(),
  created_at: z.string().or(z.date()).transform((val) => new Date(val)),
  updated_at: z.string().or(z.date()).nullable().transform((val) => val ? new Date(val) : null)
});

export type Account = z.infer<typeof AccountSchema>;
