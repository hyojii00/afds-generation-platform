import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./generation-jobs.schema.js";
import { generationJobsTable } from "./generation-jobs.schema.js";

export class DatabaseService {
  readonly pool: Pool;
  readonly db: NodePgDatabase<typeof schema>;

  constructor(connectionString: string) {
    if (!connectionString) {
      throw new Error("DATABASE_URL is required");
    }

    this.pool = new Pool({ connectionString });
    this.db = drizzle(this.pool, { schema });
  }

  async assertReady(): Promise<void> {
    await this.db
      .select({ id: generationJobsTable.id })
      .from(generationJobsTable)
      .limit(0);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
