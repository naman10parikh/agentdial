import chalk from "chalk";
import { heading, table, success, error, info, warn } from "../lib/ui.js";
import { ChannelTypeSchema } from "../adapters/types.js";
import type { ChannelType } from "../adapters/types.js";
import {
  getAllRecipeStatuses,
  getRecipe,
  runRecipe,
  verifyAllRecipes,
  getRecipeChannels,
} from "../recipes/index.js";

const brand = chalk.hex("#8B5CF6");
const dim = chalk.hex("#6B7280");
const green = chalk.green;
const red = chalk.red;
const yellow = chalk.yellow;

// ── agentdial recipes (list all) ──

export async function cmdRecipes(): Promise<void> {
  heading("Recipes — Per-Platform Setup Guides");

  const statuses = await getAllRecipeStatuses();

  const rows = statuses.map((s) => {
    const statusIcon = s.verified
      ? green("verified")
      : s.configured
        ? yellow("configured")
        : dim("not set up");

    const tier = `T${String(s.frictionTier)} ${s.frictionLabel}`;
    const steps = `${String(s.automatedSteps)} auto / ${String(s.manualSteps)} manual`;
    const costStr =
      s.cost.monthly === "FREE" ? green("FREE") : yellow(s.cost.monthly);

    return {
      Channel: brand(s.name),
      Status: statusIcon,
      Friction: tier,
      Steps: steps,
      Cost: costStr,
    };
  });

  table(["Channel", "Status", "Friction", "Steps", "Cost"], rows);

  info("Run a recipe: agentdial recipes run <channel>");
  info("Verify all:   agentdial recipes verify");
}

// ── agentdial recipes run <channel> ──

export async function cmdRecipesRun(channel: string): Promise<void> {
  const parsed = ChannelTypeSchema.safeParse(channel);
  if (!parsed.success) {
    error(
      `Unknown channel: ${channel}. Available: ${getRecipeChannels().join(", ")}`,
    );
    return;
  }

  const ch = parsed.data;
  const recipe = getRecipe(ch);
  if (!recipe) {
    error(`No recipe for channel: ${channel}`);
    return;
  }

  heading(`Recipe: ${recipe.name}`);
  info(
    `Friction: T${String(recipe.frictionTier)} — ${recipe.cost.setup} setup, ${recipe.cost.monthly}/mo`,
  );

  console.log("");
  info("Running automated steps...");

  const result = await runRecipe(ch);

  // Show results
  if (result.automatedStepsRun > 0) {
    success(`${String(result.automatedStepsRun)} automated step(s) completed`);
  }

  if (result.manualStepsPending.length > 0) {
    console.log("");
    warn(
      `${String(result.manualStepsPending.length)} manual step(s) remaining:`,
    );
    for (let i = 0; i < result.manualStepsPending.length; i++) {
      const step = result.manualStepsPending[i];
      if (step) {
        console.log(dim(`  ${String(i + 1)}. `) + step);
      }
    }
  }

  if (result.errors.length > 0) {
    console.log("");
    for (const err of result.errors) {
      error(err);
    }
  }

  // Verification result
  if (result.verified) {
    console.log("");
    if (result.verified.ok) {
      success(`Verified: ${result.verified.details ?? "channel is working"}`);
    } else {
      warn(`Not verified: ${result.verified.error ?? "unknown issue"}`);
    }
  }
}

// ── agentdial recipes verify ──

export async function cmdRecipesVerify(): Promise<void> {
  heading("Verifying All Channels");

  const results = await verifyAllRecipes();

  for (const r of results) {
    if (r.ok) {
      success(`${r.channel}: ${r.details ?? "OK"}`);
    } else {
      error(`${r.channel}: ${r.error ?? "failed"}`);
    }
  }

  const passing = results.filter((r) => r.ok).length;
  const total = results.length;
  console.log("");
  info(`${String(passing)}/${String(total)} channels verified`);
}
