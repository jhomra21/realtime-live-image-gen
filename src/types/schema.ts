import { z } from 'zod';

// Add this to your existing schema file or create a new one
export const AccountSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  coins: z.number().int().min(0),
  username: z.string().nullable(),
  created_at: z.string().or(z.date()).transform((val) => new Date(val)),
  updated_at: z.string().or(z.date()).nullable().transform((val) => val ? new Date(val) : null)
});

export type Account = z.infer<typeof AccountSchema>;

export type UserCoins = {
  id: string
  user_id: string
  coins: number
  created_at: string
  updated_at: string
}

// Update Database type
export type Database = {
  public: {
    Tables: {
      accounts: {
        Row: Account
        Insert: Omit<Account, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Account, 'id' | 'created_at' | 'updated_at'>>
      }
      // Remove user_coins table since we're not using it
    }
  }
}
