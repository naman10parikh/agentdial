import type { ChannelType } from "../adapters/types.js";
import { listConfiguredChannels, listCredentials } from "../lib/credentials.js";
import { FRICTION_LABELS } from "./types.js";
import type { Recipe, RecipeStatus, RecipeVerifyResult } from "./types.js";

import { telegramRecipe } from "./telegram.js";
import { discordRecipe } from "./discord.js";
import { slackRecipe } from "./slack.js";
import { twilioSmsRecipe } from "./twilio-sms.js";
import { twilioWhatsappRecipe } from "./twilio-whatsapp.js";
import { voiceRecipe } from "./voice.js";
import { emailRecipe } from "./email.js";

// ── Recipe Registry ──

const RECIPE_REGISTRY = new Map<ChannelType, Recipe>([
  ["telegram", telegramRecipe],
  ["discord", discordRecipe],
  ["slack", slackRecipe],
  ["sms", twilioSmsRecipe],
  ["whatsapp", twilioWhatsappRecipe],
  ["voice", voiceRecipe],
  ["email", emailRecipe],
]);

/** Get a recipe by channel name */
export function getRecipe(channel: ChannelType): Recipe | undefined {
  return RECIPE_REGISTRY.get(channel);
}

/** Get all registered recipes */
export function getAllRecipes(): Recipe[] {
  return Array.from(RECIPE_REGISTRY.values());
}

/** List all recipe channels */
export function getRecipeChannels(): ChannelType[] {
  return Array.from(RECIPE_REGISTRY.keys());
}

// ── Recipe Status ──

export async function getRecipeStatus(recipe: Recipe): Promise<RecipeStatus> {
  const configured = await listConfiguredChannels();
  const isConfigured = configured.includes(recipe.channel);

  let verified = false;
  if (isConfigured) {
    try {
      const result = await recipe.verify();
      verified = result.ok;
    } catch {
      verified = false;
    }
  }

  const automatedSteps = recipe.steps.filter((s) => s.automated).length;
  const manualSteps = recipe.steps.filter((s) => !s.automated).length;

  return {
    channel: recipe.channel,
    name: recipe.name,
    frictionTier: recipe.frictionTier,
    frictionLabel: FRICTION_LABELS[recipe.frictionTier],
    cost: recipe.cost,
    configured: isConfigured,
    verified,
    automatedSteps,
    manualSteps,
    totalSteps: recipe.steps.length,
  };
}

export async function getAllRecipeStatuses(): Promise<RecipeStatus[]> {
  const recipes = getAllRecipes();
  const results: RecipeStatus[] = [];
  for (const recipe of recipes) {
    results.push(await getRecipeStatus(recipe));
  }
  return results;
}

// ── Recipe Runner ──

export interface RecipeRunResult {
  channel: ChannelType;
  completedSteps: number;
  totalSteps: number;
  manualStepsPending: string[];
  automatedStepsRun: number;
  errors: string[];
  verified: RecipeVerifyResult | null;
}

/**
 * Run all automated steps of a recipe.
 * Manual steps are collected and returned for the user to complete.
 */
export async function runRecipe(
  channel: ChannelType,
): Promise<RecipeRunResult> {
  const recipe = RECIPE_REGISTRY.get(channel);
  if (!recipe) {
    return {
      channel,
      completedSteps: 0,
      totalSteps: 0,
      manualStepsPending: [],
      automatedStepsRun: 0,
      errors: [`No recipe found for channel: ${channel}`],
      verified: null,
    };
  }

  const manualStepsPending: string[] = [];
  const errors: string[] = [];
  let automatedStepsRun = 0;
  let completedSteps = 0;

  // Check prerequisites
  for (const prereq of recipe.prerequisites) {
    try {
      const met = await prereq.check();
      if (!met) {
        errors.push(
          `Prerequisite not met: ${prereq.name} — ${prereq.description}`,
        );
      }
    } catch (err) {
      errors.push(
        `Prerequisite check failed: ${prereq.name} — ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // Run steps
  for (const step of recipe.steps) {
    if (step.automated && step.action) {
      try {
        await step.action();
        automatedStepsRun++;
        completedSteps++;
      } catch (err) {
        errors.push(
          `Step failed: "${step.instruction}" — ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    } else if (!step.automated) {
      manualStepsPending.push(step.instruction);
    } else {
      // Automated but no action — credential collection placeholder
      completedSteps++;
      automatedStepsRun++;
    }
  }

  // Verify
  let verified: RecipeVerifyResult | null = null;
  try {
    verified = await recipe.verify();
  } catch (err) {
    errors.push(
      `Verification failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return {
    channel,
    completedSteps,
    totalSteps: recipe.steps.length,
    manualStepsPending,
    automatedStepsRun,
    errors,
    verified,
  };
}

// ── Verify All ──

export async function verifyAllRecipes(): Promise<RecipeVerifyResult[]> {
  const results: RecipeVerifyResult[] = [];
  const configured = await listConfiguredChannels();

  for (const [channel, recipe] of RECIPE_REGISTRY) {
    if (!configured.includes(channel)) {
      results.push({
        ok: false,
        channel,
        error: "Not configured",
      });
      continue;
    }

    try {
      results.push(await recipe.verify());
    } catch (err) {
      results.push({
        ok: false,
        channel,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return results;
}

// Re-export types
export type { Recipe, RecipeStatus, RecipeVerifyResult } from "./types.js";
export { FRICTION_LABELS } from "./types.js";
