import axios from 'axios';
import {
  TIKHUB_API_BASE,
  TIKHUB_API_KEY,
  SEARCH_RATE_LIMIT_MS,
  ENRICH_RATE_LIMIT_MS,
  ENDPOINTS,
  DEFAULT_MIN_FOLLOWERS,
  EMAIL_REGEX,
} from '../constants';
import type { Influencer, KeywordTask } from '../types';

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function extractEmailFromBio(bio: string): string | undefined {
  const match = bio.match(EMAIL_REGEX);
  return match ? match[0] : undefined;
}

export class TikHubClient {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || TIKHUB_API_KEY;
  }

  private authHeaders() {
    return { 'Authorization': `Bearer ${this.apiKey}` };
  }

  async searchVideos(keyword: string, count: number = 50): Promise<Influencer[]> {
    const influencers: { [key: string]: Influencer } = {};
    let offset = 0;
    let totalFound = 0;

    while (totalFound < count) {
      try {
        const response = await axios.get(`${TIKHUB_API_BASE}${ENDPOINTS.VIDEO_SEARCH}`, {
          headers: this.authHeaders(),
          params: {
            search_type: 1,
            keyword,
            count: Math.min(50, count - totalFound),
            offset,
          },
        });

        const items = response.data.data?.data || response.data.data || [];
        if (items.length === 0) break;

        for (const item of items) {
          const awemeInfo = item.aweme_info;
          if (!awemeInfo || !awemeInfo.author) continue;

          const author = awemeInfo.author;
          if (!author.follower_count || author.follower_count < DEFAULT_MIN_FOLLOWERS) continue;

          const unique_id = author.unique_id;
          const play_count = awemeInfo.statistics?.play_count || 0;

          if (!influencers[unique_id] || play_count > influencers[unique_id].max_play_count) {
            influencers[unique_id] = {
              unique_id,
              nickname: author.nickname,
              follower_count: author.follower_count,
              following_count: author.following_count,
              video_count: author.video_count,
              heart_count: author.heart_count,
              bio: author.signature || '',
              email: undefined,
              verified: false,
              keyword_source: keyword,
              max_play_count: play_count,
              like_count: awemeInfo.statistics?.like_count || 0,
              comment_count: awemeInfo.statistics?.comment_count || 0,
              data_collection_timestamp: new Date().toISOString(),
            };
            totalFound++;
            if (totalFound >= count) break;
          }
        }

        offset += 50;
        await sleep(SEARCH_RATE_LIMIT_MS);
      } catch (error) {
        console.error(`  ❌ 搜索错误: ${error}`);
        break;
      }
    }

    return Object.values(influencers);
  }

  async enrichInfluencer(influencer: Influencer): Promise<Influencer> {
    try {
      const response = await axios.get(`${TIKHUB_API_BASE}${ENDPOINTS.USER_PROFILE}`, {
        headers: this.authHeaders(),
        params: { uniqueId: influencer.unique_id },
      });

      const user = response.data.data?.userInfo?.user;
      if (user) {
        influencer.bio = user.signature || influencer.bio;
        influencer.email = extractEmailFromBio(user.signature || '');
        influencer.bio_link = user.bioLink?.link;
        influencer.verified = user.verified || false;
      }

      await sleep(ENRICH_RATE_LIMIT_MS);
    } catch (error) {
      // fall through with existing data
    }
    return influencer;
  }

  async searchMultiple(
    tasks: KeywordTask[],
    onProgress?: (keyword: string, collected: number, total: number) => void
  ): Promise<Influencer[]> {
    const allInfluencers: { [key: string]: Influencer } = {};

    for (const task of tasks) {
      const results = await this.searchVideos(task.keyword, task.targetCount);
      for (const inf of results) {
        if (!allInfluencers[inf.unique_id]) {
          allInfluencers[inf.unique_id] = inf;
        } else if (inf.max_play_count > allInfluencers[inf.unique_id].max_play_count) {
          allInfluencers[inf.unique_id] = inf;
        }
      }
      onProgress?.(task.keyword, results.length, task.targetCount);
    }

    return Object.values(allInfluencers);
  }

  async enrichAll(
    influencers: Influencer[],
    onProgress?: (current: number, total: number) => void
  ): Promise<Influencer[]> {
    const enriched: Influencer[] = [];
    for (let i = 0; i < influencers.length; i++) {
      const inf = influencers[i];
      const result = await this.enrichInfluencer(inf);
      enriched.push(result);
      onProgress?.(i + 1, influencers.length);
    }
    return enriched;
  }
}