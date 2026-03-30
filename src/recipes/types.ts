import { z } from "zod";
import type { ChannelType } from "../adapters/types.js";

// ── Friction Tiers ──
// 0 = zero-config (e.g. AgentMail)
// 1 = paste one token (e.g. Telegram BotFather)
// 2 = create app + paste token (e.g. Discord Dev Portal)
// 3 = create account + configure (e.g. Twilio SMS)
// 4 = external verification required (e.g. WhatsApp Business)

export const FrictionTierSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
]);

export type FrictionTier = z.infer<typeof FrictionTierSchema>;

export const FRICTION_LABELS: Record<FrictionTier, string> = {
  0: "Zero-config",
  1: "Paste one token",
  2: "Create app + token",
  3: "Account + configure",
  4: "External verification",
};

// ── Cost ──

export const RecipeCostSchema = z.object({
  setup: z.string(),
  monthly: z.string(),
  perMessage: z.string(),
});

export type RecipeCost = z.infer<typeof RecipeCostSchema>;

// ── Prerequisite ──

export interface RecipePrerequisite {
  name: string;
  description: string;
  check: () => Promise<boolean>;
}

// ── Step ──

export interface RecipeStep {
  /** Whether agentdial can execute this step automatically */
  automated: boolean;
  /** Human-readable instruction */
  instruction: string;
  /** Automated action — only present when automated=true */
  action?: () => Promise<void>;
}

// ── Recipe ──

export interface Recipe {
  /** Channel this recipe sets up */
  channel: ChannelType;
  /** Human-readable recipe name */
  name: string;
  /** Friction tier 0-4 */
  frictionTier: FrictionTier;
  /** Cost breakdown */
  cost: RecipeCost;
  /** What must be true before running this recipe */
  prerequisites: RecipePrerequisite[];
  /** Ordered steps to complete setup */
  steps: RecipeStep[];
  /** Verify the channel is working end-to-end */
  verify: () => Promise<RecipeVerifyResult>;
}

// ── Verify Result ──

export const RecipeVerifyResultSchema = z.object({
  ok: z.boolean(),
  channel: z.string(),
  error: z.string().optional(),
  details: z.string().optional(),
});

export type RecipeVerifyResult = z.infer<typeof RecipeVerifyResultSchema>;

// ── Recipe Status (for CLI display) ──

export interface RecipeStatus {
  channel: ChannelType;
  name: string;
  frictionTier: FrictionTier;
  frictionLabel: string;
  cost: RecipeCost;
  configured: boolean;
  verified: boolean;
  automatedSteps: number;
  manualSteps: number;
  totalSteps: number;
}
