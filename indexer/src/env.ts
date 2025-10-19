import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  RPC_URL: z.string().default('http://localhost:8545'),
  WS_URL: z.string().default('ws://localhost:8545'),
})

export const env = envSchema.parse(process.env)
