import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { IdentitySchema } from "../adapters/types.js";
import type { Identity } from "../adapters/types.js";

const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---/;

export async function parseIdentity(filePath: string): Promise<Identity> {
  if (!existsSync(filePath)) {
    throw new Error(`Identity file not found: ${filePath}`);
  }

  const raw = await readFile(filePath, "utf-8");
  const match = FRONTMATTER_REGEX.exec(raw);

  if (!match?.[1]) {
    throw new Error(
      `No YAML frontmatter found in ${filePath}. Expected ---\\n...\\n--- block.`,
    );
  }

  const yaml = parseYaml(match[1]) as unknown;
  return IdentitySchema.parse(yaml);
}

export async function writeIdentity(
  filePath: string,
  identity: Identity,
  body?: string,
): Promise<void> {
  const validated = IdentitySchema.parse(identity);
  const yaml = stringifyYaml(validated, { lineWidth: 0 });
  const bodyContent = body ?? generateDefaultBody(validated);
  const content = `---\n${yaml}---\n\n${bodyContent}\n`;
  await writeFile(filePath, content, "utf-8");
}

export function validateIdentity(data: unknown): Identity {
  return IdentitySchema.parse(data);
}

function generateDefaultBody(identity: Identity): string {
  const lines: string[] = [`# ${identity.name}`, ""];

  if (identity.tagline) {
    lines.push(`> ${identity.tagline}`, "");
  }

  lines.push(
    "## Personality",
    "",
    "<!-- Describe your agent's personality, tone, and communication style -->",
    "",
    "## Capabilities",
    "",
    "<!-- List what your agent can do -->",
    "",
    "## Boundaries",
    "",
    "<!-- Define what your agent should NOT do -->",
  );

  return lines.join("\n");
}
