import { GenerationJobs } from "@afds-generation-platform/generation";
import { Module } from "@nestjs/common";
import { DatabaseModule } from "./database/database.module.js";
import { DatabaseService } from "./database/database.service.js";
import { PostgresGenerationJobRepository } from "./database/postgres-generation-job.repository.js";
import { HealthController } from "./health.controller.js";
import { JobsController } from "./jobs.controller.js";
import {
  GENERATION_JOB_QUEUE,
  ProviderCallbacksController,
} from "./provider-callbacks.controller.js";
import { PostgresGenerationJobQueue } from "./database/postgres-generation-job.queue.js";

@Module({
  imports: [DatabaseModule],
  controllers: [HealthController, JobsController, ProviderCallbacksController],
  providers: [
    {
      provide: GenerationJobs,
      useFactory: (database: DatabaseService) =>
        new GenerationJobs(new PostgresGenerationJobRepository(database)),
      inject: [DatabaseService],
    },
    {
      provide: GENERATION_JOB_QUEUE,
      useFactory: (database: DatabaseService) =>
        new PostgresGenerationJobQueue(database),
      inject: [DatabaseService],
    },
  ],
})
export class AppModule {}
