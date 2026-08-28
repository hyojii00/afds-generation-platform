import {
  GenerationJobNotFoundError,
  GenerationJobs,
} from "@afds-generation-platform/generation";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
} from "@nestjs/common";

type CreateJobBody = {
  prompt?: unknown;
  provider?: unknown;
};

@Controller("v1/jobs")
export class JobsController {
  constructor(@Inject(GenerationJobs) private readonly jobs: GenerationJobs) {}

  @Post()
  async create(@Body() body: CreateJobBody) {
    if (
      typeof body?.prompt !== "string" ||
      body.prompt.trim().length === 0 ||
      body.provider !== "mock"
    ) {
      throw new BadRequestException(
        'prompt must be non-empty and provider must be "mock"',
      );
    }

    return this.jobs.create({
      prompt: body.prompt.trim(),
      provider: body.provider,
    });
  }

  @Get(":id")
  async get(@Param("id") id: string) {
    try {
      return await this.jobs.get(id);
    } catch (error) {
      if (error instanceof GenerationJobNotFoundError) {
        throw new NotFoundException(error.message);
      }

      throw error;
    }
  }
}
