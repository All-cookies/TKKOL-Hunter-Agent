// ============ Product & Session Types ============

export interface ProductContext {
  brand: string;
  product: string;
  category: string;
  subCategory: string;
  price: number;
  currency: string;
  targetMarkets: string[];
  languages: string[];
  usps: string[];           // Unique Selling Points
  competitors: string[];
  targetAudience: AudienceProfile;
}

export interface AudienceProfile {
  ageRange: string;
  gender: string;
  interests: string[];
  painPoints: string[];
  location: string;
}

// ============ Keyword Types ============

export type KeywordSource = 'category' | 'competitor' | 'scene' | 'audience' | 'trend';

export interface KeywordTask {
  keyword: string;
  source: KeywordSource;
  targetCount: number;
  actualCount: number;
  weight: number;
  avgScore: number;
}

export interface KeywordRecommendation {
  keyword: string;
  source: KeywordSource;
  intent: string;
  expectedInfluencerType: string;
  searchVolumeEstimate: string;
  targetCount: number;
}

// ============ Influencer Types ============

export interface Influencer {
  unique_id: string;
  nickname: string;
  follower_count: number;
  following_count?: number;
  video_count?: number;
  heart_count?: number;
  email?: string;
  bio: string;
  bio_link?: string;
  verified: boolean;
  keyword_source: string;
  max_play_count: number;
  like_count: number;
  comment_count: number;
  data_collection_timestamp: string;
}

export interface ScoredInfluencer extends Influencer {
  contentRelevance: number;
  audienceMatch: number;
  collabPotential: number;
  engagementRate: number;
  overallScore: number;
  tier: 'A' | 'B' | 'C';
  scoreBreakdown: string;
}

// ============ Weight Config Types ============

export type PriorityMode = 'rapid_launch' | 'conversion' | 'brand_building' | 'custom';

export interface WeightConfig {
  contentRelevance: number;
  audienceMatch: number;
  collabPotential: number;
  growthMomentum: number;
}

export const WEIGHT_PRESETS: Record<Exclude<PriorityMode, 'custom'>, WeightConfig> = {
  rapid_launch: { contentRelevance: 0.3, audienceMatch: 0.2, collabPotential: 0.4, growthMomentum: 0.1 },
  conversion: { contentRelevance: 0.4, audienceMatch: 0.35, collabPotential: 0.2, growthMomentum: 0.05 },
  brand_building: { contentRelevance: 0.5, audienceMatch: 0.3, collabPotential: 0.15, growthMomentum: 0.05 },
};

// ============ Session Types ============

export type SessionPhase = 'idle' | 'diagnosis' | 'keywords' | 'collection' | 'scoring' | 'complete';

export interface SessionAdjustment {
  timestamp: string;
  type: 'weight_change' | 'keyword_add' | 'keyword_remove' | 'priority_change';
  description: string;
  before: any;
  after: any;
}

// ============ AI Response Types ============

export interface DiagnosisResult {
  productContext: ProductContext;
  summary: string;
  searchDimensions: string[];
  priorityModeSuggestion: PriorityMode;
}

export interface OutreachAdvice {
  priorityList: OutreachTier[];
  emailTemplate: string;
  dmTemplate: string;
  timePlan: string;
  riskNotes: string;
  dataInsights: DataInsight[];
}

export interface OutreachTier {
  tier: 'A' | 'B' | 'C';
  count: number;
  expectedResponseRate: string;
  strategy: string;
  influencerIds: string[];
}

export interface DataInsight {
  source: string;
  count: number;
  avgScore: number;
  qualityNote: string;
}

// ============ CLI Types ============

export interface CLIProgress {
  phase: SessionPhase;
  currentKeyword: string;
  collectedCount: number;
  targetCount: number;
  percentage: number;
}

export interface CLIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}