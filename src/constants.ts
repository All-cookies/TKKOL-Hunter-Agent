import { WeightConfig, WEIGHT_PRESETS, PriorityMode } from './types';

// ============ API Configuration ============
export const TIKHUB_API_BASE = 'https://api.tikhub.io/api/v1/tiktok';
export const TIKHUB_API_KEY = process.env.TIKHUB_API_KEY || '';

// ============ Rate Limiting ============
export const SEARCH_RATE_LIMIT_MS = 100;   // 10 req/s for video search
export const ENRICH_RATE_LIMIT_MS = 150;   // ~6 req/s for profile enrichment

// ============ TikHub Endpoints ============
export const ENDPOINTS = {
  VIDEO_SEARCH: '/app/v3/fetch_general_search_result',
  USER_PROFILE: '/web/fetch_user_profile',
} as const;

// ============ Search Defaults ============
export const DEFAULT_MIN_FOLLOWERS = 2000;
export const DEFAULT_MAX_FOLLOWERS = 500000;
export const DEFAULT_LIMIT_PER_KEYWORD = 50;
export const MAX_PAGINATION_OFFSET = 200;  // Stop after 4 pages (50*4)

// ============ Scoring Defaults ============
export const SCORE_TIER_A_THRESHOLD = 80;
export const SCORE_TIER_B_THRESHOLD = 70;

// ============ Email Extraction ============
export const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

// ============ Bio Signal Keywords ============
export const COLLAB_SIGNALS = ['collab', 'partnership', 'brand', 'dm', 'contact', 'inquir', 'business'];
export const CONTENT_KEYWORDS = ['review', 'haul', 'unbox', 'tutorial', 'guide', 'recommend', 'favorite', 'love', '测评', '推荐'];
export const AUDIENCE_CORE_INTENT = ['cat lover', 'cat mom', 'cat parent', 'pet parent', 'feline', 'multi-cat', 'multi pet'];
export const AUDIENCE_BEHAVIORAL = ['busy', 'professional', 'work from home', 'wfh', 'entrepreneur'];
export const AUDIENCE_DEMO = ['urban', 'girl', 'mom', 'woman', 'millennial', 'gen z'];

// ============ Session Storage ============
export const AGENT_DIR = '.tkkol-agent';
export const SESSION_DIR = '.tkkol-agent/sessions';
export const CURRENT_SESSION_FILE = 'current-session.json';

// ============ CLI Prompts ============
export const CLI_PROMPTS = {
  WELCOME: '🤖 TikTok KOL Agent — 说你想推广什么产品？',
  DIAGNOSIS_PROMPT: '好的，让我先了解一下你的产品',
  KEYWORD_CONFIRM: '确认这些关键词吗？想说增减或调整目标数量？',
  COLLECTION_START: '确认，开始采集博主数据...',
  COLLECTION_PAUSED: '采集已暂停。输入"继续"恢复，或输入"调整策略"修改参数',
  SCORING_COMPLETE: '评分完成！以下是优先建联名单',
  ADJUSTMENT_PROMPT: '想调整什么？（权重/关键词/重新评分）',
} as const;

// ============ Priority Mode Labels ============
export const PRIORITY_LABELS: Record<PriorityMode, string> = {
  rapid_launch: '快速启动 — 优先合作潜力和邮箱可达率',
  conversion: '转化优先 — 优先内容相关度和粉丝匹配',
  brand_building: '品牌建设 — 优先内容和调性契合',
  custom: '自定义 — 我自己定义权重',
};

// ============ Output Paths ============
export const OUTPUT_DIR = './output';