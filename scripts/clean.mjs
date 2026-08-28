import { rm } from "node:fs/promises";

await Promise.all([
  rm("apps/api/dist", { force: true, recursive: true }),
  rm("packages/generation/dist", { force: true, recursive: true }),
]);
