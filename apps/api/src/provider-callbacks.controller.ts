import type {
  GenerationJobQueue,
  ProviderNotice,
} from "@afds-generation-platform/generation";
import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
} from "@nestjs/common";
import { hashCallbackToken } from "./providers/callback-token.js";

export const GENERATION_JOB_QUEUE = Symbol("GENERATION_JOB_QUEUE");

type NoticeBody = {
  status?: unknown;
  reference?: unknown;
  reason?: unknown;
};

function parseNotice(body: NoticeBody): ProviderNotice {
  if (body?.status === "succeeded") {
    if (body.reference !== undefined && typeof body.reference !== "string") {
      throw new BadRequestException("reference must be a string");
    }

    return { status: "succeeded", reference: body.reference };
  }

  if (body?.status === "failed") {
    return {
      status: "failed",
      reason: typeof body.reason === "string" ? body.reason : "provider failed",
    };
  }

  throw new BadRequestException('status must be "succeeded" or "failed"');
}

@Controller("v1/provider-callbacks")
export class ProviderCallbacksController {
  constructor(
    @Inject(GENERATION_JOB_QUEUE) private readonly queue: GenerationJobQueue,
  ) {}

  /**
   * Every rejection answers `404`, so the route cannot be used to learn which
   * jobs exist, which are awaiting, or which tokens are valid.
   */
  @Post(":id/:token")
  @HttpCode(204)
  async receive(
    @Param("id") id: string,
    @Param("token") token: string,
    @Body() body: NoticeBody,
  ): Promise<void> {
    const notice = parseNotice(body);
    const applied = await this.queue.applyProviderNotice(
      id,
      hashCallbackToken(token),
      notice,
    );

    if (!applied) {
      throw new NotFoundException("no awaiting generation job matches");
    }
  }
}
