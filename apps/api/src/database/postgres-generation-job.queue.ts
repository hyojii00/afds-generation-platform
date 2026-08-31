import type {
  GenerationJobLease,
  GenerationJobQueue,
  GenerationJobStatus,
  ProviderNotice,
  ProviderResult,
} from "@afds-generation-platform/generation";
import { sql, type SQL } from "drizzle-orm";
import type { DatabaseService } from "./database.service.js";

type ClaimedRow = {
  id: string;
  prompt: string;
  provider: "mock";
  status: GenerationJobStatus;
  attempt_count: number;
  fencing_token: string;
  callback_token: string;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RecoveredRow = { status: "queued" | "failed" };

function countRecovered(rows: RecoveredRow[]): {
  requeued: number;
  failed: number;
} {
  return {
    requeued: rows.filter((row) => row.status === "queued").length,
    failed: rows.filter((row) => row.status === "failed").length,
  };
}

/** The configured backoff for the attempt that just failed, in SQL. */
function backoffCase(retryBackoffSeconds: readonly number[]): SQL {
  const last = retryBackoffSeconds.at(-1) ?? 0;
  const branches = retryBackoffSeconds.map(
    (seconds, index) => sql`when ${index + 1} then ${seconds}`,
  );

  return sql`(case attempt_count ${sql.join(branches, sql` `)} else ${last} end)::double precision`;
}

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
      ),
      issued as (select gen_random_uuid()::text as token)
      update generation_jobs as job
         set status = 'processing',
             attempt_count = job.attempt_count + 1,
             fencing_token = gen_random_uuid(),
             lease_expires_at = now() + make_interval(secs => ${input.leaseSeconds}),
             callback_token_hash = encode(
               sha256(convert_to(issued.token, 'UTF8')), 'hex'
             ),
             awaiting_deadline = null,
             failure_reason = null
        from claimable, issued
       where job.id = claimable.id
      returning job.id, job.prompt, job.provider, job.status, job.attempt_count,
                job.fencing_token, issued.token as callback_token
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
      callbackToken: row.callback_token,
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

  async awaitProvider(
    lease: GenerationJobLease,
    input: { reference: string; deadlineSeconds: number },
  ): Promise<boolean> {
    return this.applyOwnedUpdate(
      lease,
      sql`status = 'awaiting_provider',
          provider_reference = ${input.reference},
          awaiting_deadline = now() + make_interval(secs => ${input.deadlineSeconds}),
          failure_reason = null`,
    );
  }

  /**
   * Applies a completion notice. The awaiting state, the attempt's token hash,
   * and an unexpired deadline stand in for the lease: a notice for a previous
   * attempt, a wrong token, or a second delivery matches nothing.
   */
  async applyProviderNotice(
    jobId: string,
    callbackTokenHash: string,
    notice: ProviderNotice,
  ): Promise<boolean> {
    if (!uuidPattern.test(jobId)) {
      return false;
    }

    const applied = await this.database.db.execute<{ id: string }>(sql`
      update generation_jobs
         set status = ${notice.status},
             provider_reference = coalesce(
               ${notice.status === "succeeded" ? (notice.reference ?? null) : null},
               provider_reference
             ),
             failure_reason = ${notice.status === "failed" ? notice.reason : null},
             awaiting_deadline = null,
             callback_token_hash = null
       where id = ${jobId}
         and status = 'awaiting_provider'
         and callback_token_hash = ${callbackTokenHash}
         and awaiting_deadline > now()
      returning id
    `);

    return applied.rows.length === 1;
  }

  async recoverExpiredWaits(input: {
    maxAttempts: number;
    retryBackoffSeconds: readonly number[];
  }): Promise<{ requeued: number; failed: number }> {
    const recovered = await this.database.db.execute<RecoveredRow>(sql`
      update generation_jobs
         set status = case
               when attempt_count >= ${input.maxAttempts} then 'failed'
               else 'queued'
             end,
             available_at = now() + make_interval(
               secs => ${backoffCase(input.retryBackoffSeconds)}
             ),
             awaiting_deadline = null,
             callback_token_hash = null,
             failure_reason = 'provider did not report a result'
       where status = 'awaiting_provider'
         and awaiting_deadline <= now()
      returning status
    `);

    return countRecovered(recovered.rows);
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

    return countRecovered(recovered.rows);
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
