import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

type DrizzleDb = ReturnType<typeof createDb>

function createDb() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL não configurada. Verifique o arquivo .env.local')
  }
  const sql = neon(connectionString)
  return drizzle(sql, { schema })
}

let _db: DrizzleDb | undefined

export const db = new Proxy({} as DrizzleDb, {
  get(_target, prop) {
    if (!_db) _db = createDb()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (_db as any)[prop]
  },
})
