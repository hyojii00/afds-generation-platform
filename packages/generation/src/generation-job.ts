export type GenerationProvider = "mock";
export type GenerationJobStatus = "queued";

export type GenerationJob = Readonly<{
  id: string;
  prompt: string;
  provider: GenerationProvider;
  status: GenerationJobStatus;
  createdAt: string;
}>;
