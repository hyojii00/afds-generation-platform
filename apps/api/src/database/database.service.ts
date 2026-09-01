import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./generation-jobs.schema.js";
import { generationJobsTable } from "./generation-jobs.schema.js";

export class DatabaseService {
  readonly pool: Pool;
  readonly db: NodePgDatabase<typeof schema>;
  private closing: Promise<void> | undefined;

  constructor(connectionString: string) {
    if (!connectionString) {
      throw new Error("DATABASE_URL is required");
    }

    this.pool = new Pool({ connectionString });
    this.db = drizzle(this.pool, { schema });
  }

  async assertReady(): Promise<void> {
    await this.db.select().from(generationJobsTable).limit(0);
  }

  /**
   * Idempotent: shutdown may run after the pool has already been closed.
   * Every caller awaits the same close, so a failed one is never reported as
   * a success.
   */
  async close(): Promise<void> {
    this.closing ??= this.pool.end();
    await this.closing;
  }
}
