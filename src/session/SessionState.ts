import type { SessionPhase, ProductContext, KeywordTask, Influencer, ScoredInfluencer, PriorityMode, WeightConfig, SessionAdjustment } from '../types';

export class Session {
  id: string;
  createdAt: string;
  updatedAt: string;
  currentPhase: SessionPhase;
  productContext: Partial<ProductContext>;
  priorityMode: PriorityMode;
  customWeights: WeightConfig | null;
  keywords: KeywordTask[];
  influencers: Influencer[];
  scoredInfluencers: ScoredInfluencer[];
  adjustments: SessionAdjustment[];
  isComplete: boolean;

  constructor() {
    this.id = `session-${Date.now()}`;
    this.createdAt = new Date().toISOString();
    this.updatedAt = this.createdAt;
    this.currentPhase = 'idle';
    this.productContext = {};
    this.priorityMode = 'rapid_launch';
    this.customWeights = null;
    this.keywords = [];
    this.influencers = [];
    this.scoredInfluencers = [];
    this.adjustments = [];
    this.isComplete = false;
  }

  transitionTo(phase: SessionPhase) {
    this.currentPhase = phase;
    this.updatedAt = new Date().toISOString();
  }

  addAdjustment(type: SessionAdjustment['type'], description: string, before: any, after: any) {
    this.adjustments.push({
      timestamp: new Date().toISOString(),
      type,
      description,
      before,
      after,
    });
    this.updatedAt = new Date().toISOString();
  }

  setProductContext(context: Partial<ProductContext>) {
    this.productContext = { ...this.productContext, ...context };
    this.updatedAt = new Date().toISOString();
  }

  setKeywords(keywords: KeywordTask[]) {
    this.keywords = keywords;
    this.updatedAt = new Date().toISOString();
  }

  setInfluencers(influencers: Influencer[]) {
    this.influencers = influencers;
    this.updatedAt = new Date().toISOString();
  }

  setScoredInfluencers(scored: ScoredInfluencer[]) {
    this.scoredInfluencers = scored;
    this.updatedAt = new Date().toISOString();
  }

  setPriorityMode(mode: PriorityMode, customWeights?: WeightConfig) {
    const before = { mode: this.priorityMode, weights: this.customWeights };
    this.priorityMode = mode;
    if (mode === 'custom' && customWeights) {
      this.customWeights = customWeights;
    }
    this.addAdjustment('priority_change', `Priority changed to ${mode}`, before, { mode, weights: this.customWeights });
    this.updatedAt = new Date().toISOString();
  }

  toJSON() {
    return {
      id: this.id,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      currentPhase: this.currentPhase,
      productContext: this.productContext,
      priorityMode: this.priorityMode,
      customWeights: this.customWeights,
      keywords: this.keywords,
      influencers: this.influencers,
      scoredInfluencers: this.scoredInfluencers,
      adjustments: this.adjustments,
      isComplete: this.isComplete,
    };
  }

  static fromJSON(json: any): Session {
    const state = new Session();
    Object.assign(state, json);
    return state;
  }
}