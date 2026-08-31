import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const sourceRoot = "packages/generation/src";
const forbiddenImport =
  /from\s+["'](?:@nestjs\/|fastify(?:\/|["'])|pg(?:\/|["'])|drizzle|[^"']*apps\/api)/;

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? sourceFiles(path) : [path];
    }),
  );

  return files.flat().filter((path) => path.endsWith(".ts"));
}

for (const path of await sourceFiles(sourceRoot)) {
  const source = await readFile(path, "utf8");
  if (forbiddenImport.test(source)) {
    throw new Error(`Generation boundary violation: ${path}`);
  }
}

const apiPackage = JSON.parse(await readFile("apps/api/package.json", "utf8"));
const apiDependencies = apiPackage.dependencies ?? {};

if (!apiDependencies["@nestjs/platform-fastify"]) {
  throw new Error("API must directly depend on @nestjs/platform-fastify");
}

if (apiDependencies["@nestjs/platform-express"]) {
  throw new Error("API must not directly depend on @nestjs/platform-express");
}

console.log("Generation and Fastify adapter boundaries are intact.");
