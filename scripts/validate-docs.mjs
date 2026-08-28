import { access, readFile } from "node:fs/promises";

const candidateLoopFiles = [
  "docs/plans/candidates/002-persist-generation-jobs.md",
  "docs/plans/candidates/003-execute-jobs-reliably.md",
  "docs/plans/candidates/004-isolate-provider-integrations.md",
];

const requiredFiles = [
  ".afds/constitution.md",
  ".afds/workflow.md",
  "MAP.md",
  "WORKFLOW.md",
  "docs/product/generation-platform.md",
  "docs/architecture/system.md",
  "docs/architecture/decisions/0001-use-fastify-and-swc.md",
  "docs/plans/active-loop.md",
  "docs/plans/candidates/README.md",
  ...candidateLoopFiles,
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

for (const path of candidateLoopFiles) {
  const candidateLoop = await readFile(path, "utf8");
  if (!candidateLoop.includes("`candidate — not active`")) {
    throw new Error(`Candidate loop must remain inactive: ${path}`);
  }

  for (const heading of [
    "## Target",
    "## Prerequisites",
    "## Proposed scope",
    "## Non-goals",
    "## Decision gates",
    "## Acceptance outline",
    "## Expected evidence",
    "## Primary risks",
  ]) {
    if (!candidateLoop.includes(heading)) {
      throw new Error(`Candidate loop is missing ${heading}: ${path}`);
    }
  }
}

console.log(`Validated ${requiredFiles.length} AFDS owner documents.`);
