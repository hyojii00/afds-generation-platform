import { GenerationJobs } from "@afds-generation-platform/generation";
import { Module } from "@nestjs/common";
import { DatabaseModule } from "./database/database.module.js";
import { DatabaseService } from "./database/database.service.js";
import { PostgresGenerationJobRepository } from "./database/postgres-generation-job.repository.js";
import { JobsController } from "./jobs.controller.js";

@Module({
  imports: [DatabaseModule],
  controllers: [JobsController],
  providers: [
    {
      provide: GenerationJobs,
      useFactory: (database: DatabaseService) =>
        new GenerationJobs(new PostgresGenerationJobRepository(database)),
      inject: [DatabaseService],
    },
  ],
})
export class AppModule {}
