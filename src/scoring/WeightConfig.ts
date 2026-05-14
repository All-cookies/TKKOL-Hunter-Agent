import type { WeightConfig, PriorityMode } from '../types';

export const WEIGHT_PRESETS: Record<Exclude<PriorityMode, 'custom'>, WeightConfig> = {
  rapid_launch: { contentRelevance: 0.3, audienceMatch: 0.2, collabPotential: 0.4, growthMomentum: 0.1 },
  conversion: { contentRelevance: 0.4, audienceMatch: 0.35, collabPotential: 0.2, growthMomentum: 0.05 },
  brand_building: { contentRelevance: 0.5, audienceMatch: 0.3, collabPotential: 0.15, growthMomentum: 0.05 },
};

export function getWeightConfig(mode: PriorityMode, custom?: WeightConfig): WeightConfig {
  if (mode === 'custom' && custom) return custom;
  return WEIGHT_PRESETS[mode as Exclude<PriorityMode, 'custom'>];
}

export function validateWeightConfig(config: WeightConfig): boolean {
  const sum = config.contentRelevance + config.audienceMatch + config.collabPotential + config.growthMomentum;
  return Math.abs(sum - 1.0) < 0.001;
}