import type { Influencer, ScoredInfluencer, WeightConfig, PriorityMode, ProductContext } from '../types';
import { getWeightConfig } from './WeightConfig';
import { COLLAB_SIGNALS, CONTENT_KEYWORDS, AUDIENCE_CORE_INTENT, AUDIENCE_BEHAVIORAL, AUDIENCE_DEMO } from '../constants';

export class Scorer {
  private productContext: Partial<ProductContext>;
  private weights: WeightConfig;

  constructor(productContext: Partial<ProductContext>, priorityMode: PriorityMode, customWeights?: WeightConfig) {
    this.productContext = productContext;
    this.weights = getWeightConfig(priorityMode, customWeights);
  }

  rescore(influencers: Influencer[], priorityMode: PriorityMode, customWeights?: WeightConfig): ScoredInfluencer[] {
    this.weights = getWeightConfig(priorityMode, customWeights);
    return this.scoreAll(influencers);
  }

  scoreAll(influencers: Influencer[]): ScoredInfluencer[] {
    return influencers.map(inf => this.scoreInfluencer(inf));
  }

  scoreInfluencer(inf: Influencer): ScoredInfluencer {
    const contentRelevance = this.calcContentRelevance(inf);
    const audienceMatch = this.calcAudienceMatch(inf);
    const collabPotential = this.calcCollabPotential(inf);
    const engagementRate = this.calcEngagementRate(inf);

    const overallScore = Math.round(
      contentRelevance * this.weights.contentRelevance +
      audienceMatch * this.weights.audienceMatch +
      collabPotential * this.weights.collabPotential +
      engagementRate * this.weights.growthMomentum
    );

    let tier: 'A' | 'B' | 'C' = 'C';
    if (overallScore >= 80) tier = 'A';
    else if (overallScore >= 70) tier = 'B';

    return {
      ...inf,
      contentRelevance: Math.round(contentRelevance),
      audienceMatch: Math.round(audienceMatch),
      collabPotential: Math.round(collabPotential),
      engagementRate: Math.round(engagementRate * 10) / 10,
      overallScore,
      tier,
      scoreBreakdown: this.generateBreakdown(inf, contentRelevance, audienceMatch, collabPotential, engagementRate),
    };
  }

  private calcContentRelevance(inf: Influencer): number {
    const bio_lower = (inf.bio || '').toLowerCase();
    let score = 50;

    let keywordMatches = 0;
    for (const kw of CONTENT_KEYWORDS) {
      if (bio_lower.includes(kw)) keywordMatches++;
    }

    if (keywordMatches >= 3) {
      score = 85 + Math.min(keywordMatches - 3, 15);
    } else if (keywordMatches >= 2) {
      score = 70 + keywordMatches * 10;
    } else if (keywordMatches >= 1) {
      score = 60;
    }

    // Competitor boost
    const competitors = (this.productContext.competitors || []).map(c => c.toLowerCase());
    for (const comp of competitors) {
      if (bio_lower.includes(comp)) {
        score = Math.min(score + 10, 100);
        break;
      }
    }

    return Math.min(score, 100);
  }

  private calcAudienceMatch(inf: Influencer): number {
    const bio_lower = (inf.bio || '').toLowerCase();
    let creatorMatch = 50;

    let coreHits = 0;
    for (const kw of AUDIENCE_CORE_INTENT) {
      if (bio_lower.includes(kw)) coreHits++;
    }

    let behavioralHits = 0;
    for (const kw of AUDIENCE_BEHAVIORAL) {
      if (bio_lower.includes(kw)) behavioralHits++;
    }

    let demoHits = 0;
    for (const kw of AUDIENCE_DEMO) {
      if (bio_lower.includes(kw)) demoHits++;
    }

    creatorMatch += Math.min(coreHits * 15, 30);
    creatorMatch += Math.min(behavioralHits * 10, 20);
    creatorMatch += Math.min(demoHits * 5, 15);
    if (coreHits > 0 && behavioralHits > 0) creatorMatch += 10;

    return Math.min(creatorMatch, 100);
  }

  private calcCollabPotential(inf: Influencer): number {
    let score = 50;
    const bio_lower = (inf.bio || '').toLowerCase();

    if (inf.email) score += 40;

    for (const signal of COLLAB_SIGNALS) {
      if (bio_lower.includes(signal)) {
        score += 10;
        break;
      }
    }

    if (inf.follower_count > 50000) score += 10;
    else if (inf.follower_count > 10000) score += 15;
    else score += 20;

    return Math.min(score, 100);
  }

  private calcEngagementRate(inf: Influencer): number {
    if (!inf.follower_count || inf.follower_count === 0) return 0;

    const totalEngagement = (inf.like_count || 0) + (inf.comment_count || 0);
    const rate = (totalEngagement / inf.follower_count) * 100;

    if (rate >= 5) return Math.min(85 + (rate - 5), 100);
    if (rate >= 2) return 65 + (rate - 2) * (20 / 3);
    return Math.min(30 + rate * 10, 60);
  }

  private generateBreakdown(
    inf: Influencer,
    contentRelevance: number,
    audienceMatch: number,
    collabPotential: number,
    engagementRate: number
  ): string {
    const parts: string[] = [];

    if (contentRelevance >= 75) parts.push('内容高度相关');
    else if (contentRelevance >= 60) parts.push('内容相关');

    if (inf.email) parts.push('有邮箱联系方式');
    else parts.push('无邮箱需私信');

    if (inf.follower_count >= 100000) parts.push(`大V(${inf.follower_count >= 1000000 ? 'M' : 'K'}级)`);
    else if (inf.follower_count >= 10000) parts.push('中小博主');

    if (engagementRate >= 5) parts.push('互动率高');
    else if (engagementRate >= 2) parts.push('互动率中等');

    return parts.join(' · ');
  }
}