/**
 * Node resolve hook so scripts can import project files that use the "@/..."
 * tsconfig path alias and extensionless specifiers (register via --import).
 */
import { pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

function withTsExt(fileUrlHref) {
  if (/\.(ts|tsx|mjs|js|json)$/.test(fileUrlHref)) return fileUrlHref;
  for (const ext of [".ts", ".tsx", "/index.ts"]) {
    const candidate = fileUrlHref + ext;
    try {
      if (existsSync(new URL(candidate))) return candidate;
    } catch { /* not a file URL */ }
  }
  return fileUrlHref;
}

export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    const abs = path.join(root, specifier.slice(2));
    return next(withTsExt(pathToFileURL(abs).href), context);
  }
  return next(specifier, context);
}
