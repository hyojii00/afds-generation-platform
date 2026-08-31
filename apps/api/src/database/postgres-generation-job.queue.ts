import type {
  GenerationJobLease,
  GenerationJobQueue,
  GenerationJobStatus,
  ProviderResult,
} from "@afds-generation-platform/generation";
import { sql } from "drizzle-orm";
import type { DatabaseService } from "./database.service.js";

type ClaimedRow = {
  id: string;
  prompt: string;
  provider: "mock";
  status: GenerationJobStatus;
  attempt_count: number;
  fencing_token: string;
};

type RecoveredRow = { status: "queued" | "failed" };

/**
 * Row leasing over `generation_jobs`. Every ownership decision compares
 * against `now()`, the PostgreSQL transaction timestamp, so worker clocks
 * cannot change who owns a job.
 */
export class PostgresGenerationJobQueue implements GenerationJobQueue {
  constructor(private readonly database: DatabaseService) {}

  async claim(input: {
    leaseSeconds: number;
    maxAttempts: number;
  }): Promise<GenerationJobLease | undefined> {
    const claimed = await this.database.db.execute<ClaimedRow>(sql`
      with claimable as (
        select id
          from generation_jobs
         where status = 'queued'
           and available_at <= now()
           and attempt_count < ${input.maxAttempts}
         order by available_at, created_at
           for update skip locked
         limit 1
      )
      update generation_jobs as job
         set status = 'processing',
             attempt_count = job.attempt_count + 1,
             fencing_token = gen_random_uuid(),
             lease_expires_at = now() + make_interval(secs => ${input.leaseSeconds}),
             failure_reason = null
        from claimable
       where job.id = claimable.id
      returning job.id, job.prompt, job.provider, job.status, job.attempt_count, job.fencing_token
    `);

    const row = claimed.rows[0];

    if (!row) {
      return undefined;
    }

    return {
      jobId: row.id,
      prompt: row.prompt,
      provider: row.provider,
      status: row.status,
      attempt: row.attempt_count,
      fencingToken: row.fencing_token,
    };
  }

  async succeed(
    lease: GenerationJobLease,
    result: ProviderResult,
  ): Promise<boolean> {
    return this.applyOwnedUpdate(
      lease,
      sql`status = 'succeeded',
          failure_reason = null,
          provider_reference = ${result.reference}`,
    );
  }

  async retry(
    lease: GenerationJobLease,
    input: { availableInSeconds: number; reason: string },
  ): Promise<boolean> {
    return this.applyOwnedUpdate(
      lease,
      sql`status = 'queued',
          available_at = now() + make_interval(secs => ${input.availableInSeconds}),
          failure_reason = ${input.reason}`,
    );
  }

  async fail(
    lease: GenerationJobLease,
    input: { reason: string },
  ): Promise<boolean> {
    return this.applyOwnedUpdate(
      lease,
      sql`status = 'failed', failure_reason = ${input.reason}`,
    );
  }

  async recoverExpiredLeases(input: {
    maxAttempts: number;
  }): Promise<{ requeued: number; failed: number }> {
    const recovered = await this.database.db.execute<RecoveredRow>(sql`
      update generation_jobs
         set status = case
               when attempt_count >= ${input.maxAttempts} then 'failed'
               else 'queued'
             end,
             available_at = now(),
             lease_expires_at = null,
             fencing_token = null,
             failure_reason = case
               when attempt_count >= ${input.maxAttempts}
                 then 'lease expired on the final attempt'
               else failure_reason
             end
       where status = 'processing'
         and lease_expires_at <= now()
      returning status
    `);

    return {
      requeued: recovered.rows.filter((row) => row.status === "queued").length,
      failed: recovered.rows.filter((row) => row.status === "failed").length,
    };
  }

  /**
   * Applies a result only while the lease still owns the job: the row must be
   * `processing`, carry this fencing token, and hold an unexpired lease.
   */
  private async applyOwnedUpdate(
    lease: GenerationJobLease,
    assignment: ReturnType<typeof sql>,
  ): Promise<boolean> {
    const applied = await this.database.db.execute<{ id: string }>(sql`
      update generation_jobs
         set ${assignment},
             lease_expires_at = null,
             fencing_token = null
       where id = ${lease.jobId}
         and status = 'processing'
         and fencing_token = ${lease.fencingToken}
         and lease_expires_at > now()
      returning id
    `);

    return applied.rows.length === 1;
  }
}
