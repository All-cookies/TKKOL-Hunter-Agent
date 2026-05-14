import type { ProductContext } from '../../types';

// ============ Product Diagnosis Prompt ============
export function buildProductDiagnosisPrompt(userMessage: string, currentContext: Partial<ProductContext>): string {
  return `You are an experienced TikTok KOL strategy expert. Your task is to analyze the user's product information and help them prepare for KOL outreach.

USER'S PRODUCT INFO:
${userMessage}

CURRENT CONTEXT (if any):
${JSON.stringify(currentContext, null, 2)}

INSTRUCTIONS:
1. If the user has provided incomplete information, ask 1-2 targeted follow-up questions to clarify:
   - Product category and core selling point
   - Target market and price point
   - Any competitor brands they have in mind
   - Preferred influencer size (mega, macro, micro, nano)

2. If you have enough information, provide a structured product diagnosis including:
   - Product summary (brand, category, price, target market)
   - Target audience profile (age, gender, interests, location)
   - Recommended search dimensions for TikTok KOL discovery
   - Suggested priority mode (rapid_launch / conversion / brand_building)

3. At the VERY END of your response, add a machine-readable JSON block with any product details you've identified. Include ONLY fields you are confident about:

PRODUCT_CONTEXT_JSON
{"brand": "BrandName", "category": "ProductCategory", "price": 0, "targetMarkets": ["US"], "sellingPoints": ["point1", "point2"]}
PRODUCT_CONTEXT_JSON

Keep your main response conversational, like an expert KOL manager advising a brand.`;
}

// ============ Keyword Generation Prompt ============
export function buildKeywordGenerationPrompt(productContext: ProductContext): string {
  return `You are a TikTok KOL keyword strategy expert. Based on the product information below, generate 5-8 high-quality search keywords for discovering relevant TikTok influencers.

PRODUCT CONTEXT (may contain Chinese):
${JSON.stringify(productContext, null, 2)}

CRITICAL REQUIREMENTS:
1. Keywords MUST be in English — TikTok search works with English keywords, not Chinese
2. Keywords should be what a TikTok creator would use in their bio or hashtags
3. Do NOT copy Chinese text directly — translate product concepts to English search terms

TYPES OF KEYWORDS:
- category: English product type (e.g., "smart cat litter box", "automatic pet feeder")
- competitor: English brand names competitors use (e.g., "Catlink", "Lomi", "Purge Planet")
- scene: Use-case scenarios (e.g., "self cleaning litter box", "pet tech for busy owners")
- audience: Target consumer terms (e.g., "cat parent", "pet owner", "multicat household")
- trend: Trending hashtags (e.g., "#smartcat", "#pettech", "#catlitter")

REQUIRED OUTPUT FORMAT:
KEYWORDS_START
1. [KEYWORD] | [source: category/competitor/scene/audience/trend] | [search intent] | [expected influencer type] | [search volume estimate: High/Medium/Low] | [target count]
2. [KEYWORD] | ...
KEYWORDS_END

BAD examples (will be rejected):
- "小佩petkit" — Chinese, not searchable on TikTok
- "宠物智能猫砂盆" — Chinese text, unusable

GOOD examples:
- "smart cat litter box" | category | Product-focused searches | Pet tech creators | High | 40
- "Catlink" | competitor | Competitor audience | Cat care vloggers | Medium | 30
- "automatic cat litter box" | category | Feature searches | Pet lifestyle creators | High | 35

Each keyword must include:
- The actual search term (English only)
- Source category
- Clear reasoning for why this keyword will find quality influencers
- Estimated search volume
- Recommended number of influencers to collect for this keyword`;
}

// ============ Influencer Scoring Prompt ============
export function buildInfluencerScoringPrompt(
  influencers: any[],
  productContext: ProductContext,
  weights: any
): string {
  return `You are a TikTok KOL evaluation expert. Score influencers based on deep contextual understanding, NOT simple keyword matching.

PRODUCT CONTEXT:
${JSON.stringify(productContext, null, 2)}

WEIGHT CONFIGURATION:
${JSON.stringify(weights, null, 2)}

SCORING GUIDELINES:

CONTENT RELEVANCE (0-100):
- Evaluate how well the influencer's content topic, style, and audience overlap with the product
- Consider: content themes, content categories, typical video topics, audience interests
- A pet influencer posting about "cat nutrition" is relevant to a smart cat litter box even if they don't say "review" or "unbox"
- Score HIGH if: content is thematically aligned (pet care ↔ smart pet device, beauty ↔ skincare gadget)
- Score LOW if: random unrelated content

AUDIENCE MATCH (0-100):
- Evaluate how well the influencer's audience demographics and interests match the target consumer
- Consider: audience age/gender/lifestyle, engagement patterns, consumer behavior signals
- A "cat mom" creator with audience of 25-40yo urban women matches a premium cat product
- Look for: lifestyle alignment, purchasing power signals, demographic fit

COLLABORATION POTENTIAL (0-100):
- Has email in bio or link → +40
- Explicit collab signals (open to collabs, brand partnerships, business inquiries) → +15
- Active posting (4+ videos/week) → +15
- Follower count 10K-500K → +15 (mid-tier optimal)
- Verified → +5

ENGAGEMENT RATE → growth momentum:
- engagement_rate = (likes + comments) / followers * 100
- 5%+ → 85-100, 2-5% → 65-85, <2% → 30-65

INFLUENCERS TO SCORE:
${JSON.stringify(influencers.slice(0, 20), null, 2)}

IMPORTANT: Each influencer is uniquely evaluated. Do NOT use a generic checklist. Give each one a personalized score with specific reasoning based on their unique profile.

Respond in JSON format:
{
  "scores": [
    {
      "unique_id": "...",
      "contentRelevance": 0-100,
      "audienceMatch": 0-100,
      "collabPotential": 0-100,
      "engagementRate": 0-100,
      "overallScore": 0-100,
      "reasoning": "specific reason for this score based on the influencer's actual profile and the product context"
    }
  ]
}

Make sure overallScore is a weighted sum using the provided weight configuration.`;
}

// ============ Outreach Advice Prompt ============
export function buildOutreachAdvicePrompt(
  productContext: ProductContext,
  scoredInfluencers: any[],
  stats: any
): string {
  return `You are a KOL outreach strategy expert. Based on the collected and scored influencers, provide actionable outreach recommendations.

PRODUCT CONTEXT:
${JSON.stringify(productContext, null, 2)}

COLLECTED DATA SUMMARY:
${JSON.stringify(stats, null, 2)}

TOP 20 INFLUENCERS:
${JSON.stringify(scoredInfluencers.slice(0, 20), null, 2)}

PROVIDE:
1. PRIORITY TIERS — Group influencers into A/B/C with expected response rates
2. OUTREACH STRATEGY — For each tier, recommend email vs DM approach
3. EMAIL TEMPLATE — A professional initial outreach email template
4. DM TEMPLATE — A concise direct message template for TikTok
5. TIMING RECOMMENDATIONS — When and how to reach out
6. RISK NOTES — Any red flags or注意事项

Be specific and actionable. The brand team should be able to use your recommendations immediately.`;
}