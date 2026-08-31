import {
  type GenerationJob,
  type GenerationJobRepository,
  reportedStatus,
} from "@afds-generation-platform/generation";
import { eq } from "drizzle-orm";
import type { DatabaseService } from "./database.service.js";
import { generationJobsTable } from "./generation-jobs.schema.js";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class PostgresGenerationJobRepository
  implements GenerationJobRepository
{
  constructor(private readonly database: DatabaseService) {}

  async save(job: GenerationJob): Promise<void> {
    await this.database.db.insert(generationJobsTable).values({
      id: job.id,
      prompt: job.prompt,
      provider: job.provider,
      status: job.status,
      createdAt: new Date(job.createdAt),
    });
  }

  async findById(id: string): Promise<GenerationJob | undefined> {
    if (!uuidPattern.test(id)) {
      return undefined;
    }

    const [row] = await this.database.db
      .select()
      .from(generationJobsTable)
      .where(eq(generationJobsTable.id, id))
      .limit(1);

    if (!row) {
      return undefined;
    }

    return {
      id: row.id,
      prompt: row.prompt,
      provider: row.provider,
      status: reportedStatus(row.status),
      createdAt: row.createdAt.toISOString(),
    };
  }
}
