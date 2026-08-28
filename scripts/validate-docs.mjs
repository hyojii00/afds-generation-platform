import { access, readFile } from "node:fs/promises";

const requiredFiles = [
  ".afds/constitution.md",
  ".afds/workflow.md",
  "MAP.md",
  "WORKFLOW.md",
  "docs/product/generation-platform.md",
  "docs/architecture/system.md",
  "docs/plans/active-loop.md",
];

await Promise.all(requiredFiles.map((path) => access(path)));

const activeLoop = await readFile("docs/plans/active-loop.md", "utf8");
for (const heading of [
  "## State",
  "## Target",
  "## Allowed scope",
  "## Non-goals",
  "## Acceptance criteria",
  "## Decision gates",
  "## Evidence ledger",
]) {
  if (!activeLoop.includes(heading)) {
    throw new Error(`Active loop is missing required heading: ${heading}`);
  }
}

console.log(`Validated ${requiredFiles.length} AFDS owner documents.`);
