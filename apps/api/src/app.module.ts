import {
  GenerationJobs,
  InMemoryGenerationJobRepository,
} from "@afds-generation-platform/generation";
import { Module } from "@nestjs/common";
import { JobsController } from "./jobs.controller.js";

@Module({
  controllers: [JobsController],
  providers: [
    {
      provide: GenerationJobs,
      useFactory: () =>
        new GenerationJobs(new InMemoryGenerationJobRepository()),
    },
  ],
})
export class AppModule {}
