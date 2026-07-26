import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { neon } from '@neondatabase/serverless'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set. Nothing to migrate.')
  process.exit(1)
}

const here = dirname(fileURLToPath(import.meta.url))
const schema = await readFile(join(here, 'schema.sql'), 'utf8')
const sql = neon(url)

// Neon's HTTP driver runs one statement per call, so split on the statement
// boundary. Every statement in schema.sql is idempotent (`if not exists`).
//
// Comment lines are stripped *inside* each statement rather than used to filter
// statements out — a leading comment block would otherwise silently swallow the
// table that follows it, and a missing table only shows up much later as a
// confusing runtime error.
const statements = schema
  .split(/;\s*$/m)
  .map(chunk => chunk
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n')
    .trim())
  .filter(statement => statement.length > 0)

for (const statement of statements) {
  await sql.query(statement)
  console.log(`✓ ${statement.split('\n')[0].slice(0, 72)}`)
}

console.log(`\nApplied ${statements.length} statements.`)
