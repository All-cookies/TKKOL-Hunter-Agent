/**
 * Petkit 智能猫砂盆 KOL 采集脚本
 *
 * 使用方式：
 * 1. 安装依赖: npm install axios dotenv
 * 2. 在根目录创建 .env 文件，添加: TIKHUB_API_KEY=你的密钥
 * 3. 运行: npx ts-node scrape-petkit.ts
 * 或用 node 运行: npm install -g ts-node && ts-node scrape-petkit.ts
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

// ============ 配置区域 ============
const CUSTOMIZE = {
  // 产品信息
  PRODUCT_NAME: 'Petkit',
  PRODUCT_FULL_NAME: 'Petkit Automatic Litter Box',
  CATEGORY: 'Pet Tech',
  TARGET_MARKET: 'United States',
  PRICE: 500,

  // API 配置
  API_KEY: process.env.TIKHUB_API_KEY || 'oatYGeA5/Fez3UeuBbXNxkTsaReyfpt7zhT3uRWZbaK3lw29AHyCWgWzFQ==',
  API_BASE_URL: 'https://api.tikhub.io/api/v1/tiktok',

  // 搜索关键词配置
  SEARCH_TASKS: [
    {
      keyword: 'Litter Robot review',
      source: 'competitor',
      targetCount: 7,
      weight: 1.5  // 竞品词权重最高
    },
    {
      keyword: 'best automatic cat litter',
      source: 'category',
      targetCount: 7,
      weight: 1.3
    },
    {
      keyword: 'automatic litter box',
      source: 'category',
      targetCount: 8,
      weight: 1.0
    },
    {
      keyword: 'smart pet gadgets',
      source: 'product',
      targetCount: 5,
      weight: 0.9
    },
    {
      keyword: 'busy professional cat mom',
      source: 'audience',
      targetCount: 5,
      weight: 0.8
    }
  ],

  // 筛选条件
  MIN_FOLLOWER_COUNT: 2000,
  MAX_FOLLOWER_COUNT: 500000,

  // 输出配置
  OUTPUT_DIR: './output',
  OUTPUT_LABEL: 'petkit',
  TIMESTAMP: new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]
};

// ============ 类型定义 ============
interface Author {
  id: string;
  unique_id: string;
  nickname: string;
  follower_count: number;
  following_count: number;
  video_count: number;
  heart_count: number;
  signature: string;
}

interface AwemeInfo {
  aweme_id: string;
  desc: string;
  author: Author;
  statistics: {
    play_count: number;
    like_count: number;
    comment_count: number;
  };
}

interface Influencer {
  unique_id: string;
  nickname: string;
  follower_count: number;
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

interface InfluencerWithScores extends Influencer {
  content_relevance: number;
  creator_match: number;
  collab_potential: number;
  engagement_rate: number;
  overall_score: number;
  tier: string;
}

// ============ 工具函数 ============

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractEmailFromBio(bio: string): string | undefined {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const match = bio.match(emailRegex);
  return match ? match[0] : undefined;
}

function ensureOutputDir() {
  if (!fs.existsSync(CUSTOMIZE.OUTPUT_DIR)) {
    fs.mkdirSync(CUSTOMIZE.OUTPUT_DIR, { recursive: true });
  }
}

// ============ Phase 1: 视频搜索发现创作者 ============

async function searchVideos(keyword: string, count: number = 50): Promise<Influencer[]> {
  const influencers: { [key: string]: Influencer } = {};
  let offset = 0;
  let totalFound = 0;

  console.log(`\n🔍 搜索关键词: "${keyword}"`);

  while (totalFound < count) {
    try {
      const response = await axios.get(`${CUSTOMIZE.API_BASE_URL}/app/v3/fetch_general_search_result`, {
        headers: {
          'Authorization': `Bearer ${CUSTOMIZE.API_KEY}`
        },
        params: {
          search_type: 1,  // 视频搜索
          keyword: keyword,
          count: Math.min(50, count - totalFound),
          offset: offset
        }
      });

      const items = response.data.data?.data || response.data.data || [];
      if (items.length === 0) {
        console.log(`  ℹ️  没有更多结果 (共找到 ${totalFound} 位)`);
        break;
      }

      for (const item of items) {
        const awemeInfo = item.aweme_info;

        // 跳过无效数据
        if (!awemeInfo || !awemeInfo.author) {
          continue;
        }

        const author = awemeInfo.author;

        // 过滤：粉丝数最少 2000
        if (!author.follower_count || author.follower_count < CUSTOMIZE.MIN_FOLLOWER_COUNT) {
          continue;
        }

        const unique_id = author.unique_id;
        const play_count = awemeInfo.statistics?.play_count || 0;
        const like_count = awemeInfo.statistics?.like_count || 0;
        const comment_count = awemeInfo.statistics?.comment_count || 0;

        // 去重：同一博主保留播放量最高的视频
        if (
          !influencers[unique_id] ||
          play_count > influencers[unique_id].max_play_count
        ) {
          influencers[unique_id] = {
            unique_id: unique_id,
            nickname: author.nickname,
            follower_count: author.follower_count,
            bio: author.signature || '',  // 临时简版，后续会更新
            verified: false,
            keyword_source: keyword,
            max_play_count: play_count,
            like_count: like_count,
            comment_count: comment_count,
            data_collection_timestamp: new Date().toISOString()
          };

          totalFound++;

          if (totalFound >= count) break;
        }
      }

      offset += 50;

      // 限速：100ms 间隔 (10 req/s)
      await sleep(100);
    } catch (error) {
      console.error(`  ❌ 搜索错误: ${error}`);
      break;
    }
  }

  console.log(`  ✓ 完成，找到 ${Object.keys(influencers).length} 位博主`);
  return Object.values(influencers);
}

// ============ Phase 2: 批量获取完整 Bio 和邮箱 ============

async function enrichInfluencerData(influencer: Influencer): Promise<Influencer> {
  try {
    const response = await axios.get(`${CUSTOMIZE.API_BASE_URL}/web/fetch_user_profile`, {
      headers: {
        'Authorization': `Bearer ${CUSTOMIZE.API_KEY}`
      },
      params: {
        uniqueId: influencer.unique_id
      }
    });

    const user = response.data.data?.userInfo?.user;

    if (user) {
      influencer.bio = user.signature || influencer.bio;
      influencer.email = extractEmailFromBio(user.signature || '');
      influencer.bio_link = user.bioLink?.link;
      influencer.verified = user.verified || false;
    }

    // 限速：150ms 间隔
    await sleep(150);

    return influencer;
  } catch (error) {
    console.error(`  ⚠️  获取 @${influencer.unique_id} 的数据失败`);
    return influencer;
  }
}

// ============ Phase 3: 智能评分 ============

function scoreInfluencer(inf: Influencer, keyword_source: string): InfluencerWithScores {
  // 1. 内容相关度（0-100）
  let content_relevance = 50;

  // 关键词匹配分析
  const bio_lower = inf.bio.toLowerCase();
  const content_keywords = [
    'litter', 'cat', 'kitten', 'feline', 'pet care',
    'automatic', 'smart', 'review', 'haul', 'unbox'
  ];

  let keyword_matches = 0;
  for (const kw of content_keywords) {
    if (bio_lower.includes(kw)) keyword_matches++;
  }

  if (keyword_matches >= 3) {
    content_relevance = 85 + Math.min(keyword_matches - 3, 15);
  } else if (keyword_matches >= 2) {
    content_relevance = 70 + keyword_matches * 10;
  } else if (keyword_matches >= 1) {
    content_relevance = 60;
  }

  // 竞品词来源加分
  if (keyword_source.toLowerCase().includes('litter robot')) {
    content_relevance = Math.min(content_relevance + 10, 100);
  }

  // 2. 创作者画像匹配（0-100）
  // 衡量博主本人是否属于目标用户群体
  // 分三层：核心意图词 > 行为信号词 > 人口统计词
  const core_intent_keywords = ['cat lover', 'cat mom', 'cat parent', 'pet parent', 'feline', 'multi-cat', 'multi pet'];
  const behavioral_keywords = ['busy', 'professional', 'work from home', 'wfh', 'entrepreneur', 'full time'];
  const demo_keywords = ['urban', 'girl', 'mom', 'woman', 'millennial', 'gen z'];

  let core_hits = 0;
  for (const kw of core_intent_keywords) {
    if (bio_lower.includes(kw)) core_hits++;
  }

  let behavioral_hits = 0;
  for (const kw of behavioral_keywords) {
    if (bio_lower.includes(kw)) behavioral_hits++;
  }

  let demo_hits = 0;
  for (const kw of demo_keywords) {
    if (bio_lower.includes(kw)) demo_hits++;
  }

  // 基础分
  let creator_match = 50;
  // 核心意图词：每个 +15，最高 30
  creator_match += Math.min(core_hits * 15, 30);
  // 行为信号词：每个 +10，最高 20
  creator_match += Math.min(behavioral_hits * 10, 20);
  // 人口统计词：每个 +5，最高 15
  creator_match += Math.min(demo_hits * 5, 15);
  // 组合加分：同时有核心意图 + 行为信号 → 再 +10
  if (core_hits > 0 && behavioral_hits > 0) {
    creator_match += 10;
  }

  creator_match = Math.min(creator_match, 100);

  // 3. 合作潜力（0-100）
  let collab_potential = 50;

  // 有邮箱加分
  if (inf.email) {
    collab_potential += 40;
  }

  // 合作信号词
  const collab_signals = ['collab', 'partnership', 'brand', 'dm', 'contact', 'inquir'];
  for (const signal of collab_signals) {
    if (bio_lower.includes(signal)) {
      collab_potential += 10;
    }
  }

  // 活跃度（从粉丝数推测）
  if (inf.follower_count > 50000) {
    collab_potential += 10;
  } else if (inf.follower_count > 10000) {
    collab_potential += 15;
  } else {
    collab_potential += 20;  // 小号更容易合作
  }

  collab_potential = Math.min(collab_potential, 100);

  // 4. 互动率（0-100）
  // 互动率 = (点赞数 + 评论数) / 粉丝数 × 100
  // 经验阈值：5%+ 为优秀，2-5% 为良好，<2% 为偏低
  let engagement_rate = 0;
  if (inf.follower_count > 0) {
    const total_engagement = (inf.like_count || 0) + (inf.comment_count || 0);
    const rate = (total_engagement / inf.follower_count) * 100;
    if (rate >= 5) {
      engagement_rate = 85 + Math.min(rate - 5, 15);  // 5% 以上：85-100
    } else if (rate >= 2) {
      engagement_rate = 65 + (rate - 2) * (20 / 3);   // 2-5%：65-85
    } else {
      engagement_rate = Math.min(30 + rate * 10, 60); // <2%：30-60
    }
    engagement_rate = Math.round(engagement_rate);
  }

  // 计算综合分（快速启动权重）
  // 快速启动: content=30% audience=20% collab=40% engagement=10%
  const overall_score = Math.round(
    content_relevance * 0.3 +
    creator_match * 0.2 +
    collab_potential * 0.4 +
    engagement_rate * 0.1
  );

  // 分层
  let tier = 'C';
  if (overall_score >= 80) tier = 'A';
  else if (overall_score >= 70) tier = 'B';

  return {
    ...inf,
    content_relevance,
    creator_match,
    collab_potential,
    engagement_rate,
    overall_score,
    tier
  };
}

// ============ 输出格式 ============

function generateCSV(influencers: InfluencerWithScores[]): string {
  let csv = '排序,账号名,昵称,粉丝数,邮箱,综合评分,内容相关度,粉丝匹配,合作潜力,互动率,层级,来源关键词,最高播放量,认证\n';

  influencers.forEach((inf, idx) => {
    const email = inf.email || '';
    const bio_escaped = (inf.bio || '').replace(/"/g, '""').replace(/\n/g, ' ');

    csv += `${idx + 1},"${inf.unique_id}","${inf.nickname}",${inf.follower_count},"${email}",${inf.overall_score},${inf.content_relevance},${inf.creator_match},${inf.collab_potential},${inf.engagement_rate},"${inf.tier}","${inf.keyword_source}",${inf.max_play_count},"${inf.verified ? 'Yes' : 'No'}"\n`;
  });

  return csv;
}

function generateJSON(influencers: InfluencerWithScores[], stats: any): string {
  const data = {
    metadata: {
      product: CUSTOMIZE.PRODUCT_FULL_NAME,
      timestamp: new Date().toISOString(),
      total_count: influencers.length,
      keywords_searched: CUSTOMIZE.SEARCH_TASKS.length,
      target_market: CUSTOMIZE.TARGET_MARKET
    },
    stats: stats,
    influencers: influencers
  };

  return JSON.stringify(data, null, 2);
}

// ============ HTML 报告生成 ============

function generateHTML(influencers: InfluencerWithScores[], stats: any): string {
  const top10 = influencers.slice(0, 10);
  const tiers = { A: influencers.filter(i => i.tier === 'A').length, B: influencers.filter(i => i.tier === 'B').length, C: influencers.filter(i => i.tier === 'C').length };
  const emailCount = influencers.filter(i => i.email).length;
  const timestamp = new Date().toISOString().split('T')[0];
  const tierColors: any = { A: '#4CAF50', B: '#FF9800', C: '#9E9E9E' };

  // Tier bar percentages
  const total = influencers.length;
  const tierPct = (t: string) => Math.round((tiers[t as keyof typeof tiers] / total) * 100);
  const tierSuccessRate: any = { A: '40-60%', B: '20-30%', C: 'Keep for observation' };

  // Generate top 10 cards
  const top10Cards = top10.map((inf, idx) => {
    const tierColor = tierColors[inf.tier];
    const email = inf.email || '';
    const emailClass = email ? 'email-yes' : 'email-no';
    const emailDisplay = email ? `✓ ${email}` : '✗ 暂无邮箱 — 仅 DM';
    const emailBtn = email ? `<button class="card-btn card-btn--mail" onclick="openMail('${email}')">✉️ 发邮件</button><button class="card-btn card-btn--copy" onclick="copyText('${email}')">复制</button>` : `<button class="card-btn card-btn--copy" onclick="copyText('@${inf.unique_id}')">复制 @</button>`;
    const engagementColor = inf.engagement_rate >= 85 ? '#4CAF50' : inf.engagement_rate >= 65 ? '#FF9800' : '#9E9E9E';

    return `<div class="kol-card tier-${inf.tier.toLowerCase()}">
      <div class="kol-card__rank" style="background:${tierColor}">${idx + 1}</div>
      <div class="kol-card__header">
        <a class="kol-card__name" href="https://tiktok.com/@${inf.unique_id}" target="_blank">@${inf.unique_id}</a>
        <span class="kol-card__score" style="color:${tierColor}">${inf.overall_score}<span class="kol-card__score-label"> pts</span></span>
      </div>
      <div class="kol-card__nickname">${inf.nickname}</div>
      <div class="kol-card__meta">
        <span class="kol-card__followers">👥 ${inf.follower_count.toLocaleString()}</span>
        <span class="kol-card__tier badge badge-${inf.tier.toLowerCase()}">Tier ${inf.tier}</span>
      </div>
      <div class="kol-card__dimensions">
        <div class="dim"><span class="dim__label">相关度</span><span class="dim__value">${inf.content_relevance}</span></div>
        <div class="dim"><span class="dim__label">创作者匹配</span><span class="dim__value">${inf.creator_match}</span></div>
        <div class="dim"><span class="dim__label">合作潜力</span><span class="dim__value">${inf.collab_potential}</span></div>
        <div class="dim"><span class="dim__label">互动率</span><span class="dim__value" style="color:${engagementColor}">${inf.engagement_rate}%</span></div>
      </div>
      <div class="kol-card__source">🔍 ${inf.keyword_source}</div>
      <div class="kol-card__footer">
        <span class="kol-card__email ${emailClass}">${emailDisplay}</span>
        <div class="kol-card__actions">${emailBtn}</div>
      </div>
    </div>`;
  }).join('\n');

  // Generate full table rows
  const tableRows = influencers.map((inf, idx) => {
    const email = inf.email || '';
    const emailClass = email ? 'email-yes' : 'email-no';
    const emailDisplay = email ? `✓ <a href="mailto:${email}">${email}</a>` : '✗';
    const verified = inf.verified ? '✓' : '✗';
    const engagementColor = inf.engagement_rate >= 85 ? '#4CAF50' : inf.engagement_rate >= 65 ? '#FF9800' : '#9E9E9E';

    return `<tr data-tier="${inf.tier.toLowerCase()}" class="tier-${inf.tier.toLowerCase()}">
      <td>${idx + 1}</td>
      <td><a href="https://tiktok.com/@${inf.unique_id}" target="_blank">${inf.unique_id}</a></td>
      <td>${inf.nickname}</td>
      <td>${inf.follower_count.toLocaleString()}</td>
      <td class="${emailClass}">${emailDisplay}</td>
      <td><strong>${inf.overall_score}</strong></td>
      <td>${inf.content_relevance}</td>
      <td>${inf.creator_match}</td>
      <td>${inf.collab_potential}</td>
      <td style="color:${engagementColor}">${inf.engagement_rate}%</td>
      <td><span class="badge badge-${inf.tier.toLowerCase()}">${inf.tier}</span></td>
      <td>${inf.keyword_source}</td>
    </tr>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${CUSTOMIZE.PRODUCT_NAME} KOL Report — ${timestamp}</title>
<style>
:root {
  --purple: #0071E3;
  --pink: #FF375F;
  --green: #34C759;
  --orange: #FF9500;
  --red: #FF3B30;
  --gray: #86868B;
  --gray2: #AEAEB2;
  --gray3: #C7C7CC;
  --bg: #FFFFFF;
  --bg2: #F5F5F7;
  --card-bg: #FFFFFF;
  --text: #1D1D1F;
  --text-light: #86868B;
  --border: #D2D2D7;
  --radius: 20px;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif; background: var(--bg2); color: var(--text); line-height: 1.5; -webkit-font-smoothing: antialiased; }
.container { max-width: 1200px; margin: 0 auto; padding: 48px 24px; }

/* Header — Apple magazine style */
.header { background: var(--bg); border-radius: var(--radius); padding: 56px 60px; margin-bottom: 32px; display: flex; justify-content: space-between; align-items: center; }
.header__left { flex: 1; }
.header__label { font-size: 0.75em; font-weight: 600; color: var(--gray); text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 10px; }
.header__title { font-size: 2.8em; font-weight: 700; color: var(--text); line-height: 1.05; margin-bottom: 12px; letter-spacing: -0.02em; }
.header__subtitle { font-size: 1.1em; color: var(--text-light); font-weight: 400; }
.header__right { display: flex; gap: 48px; align-items: center; }
.header__stat { text-align: center; }
.header__stat-value { font-size: 2.6em; font-weight: 700; color: var(--text); line-height: 1; letter-spacing: -0.02em; }
.header__stat-label { font-size: 0.75em; color: var(--gray); margin-top: 6px; font-weight: 500; letter-spacing: 0.04em; }
.header__stat-label--green { color: var(--green); }
.header__stat-label--orange { color: var(--orange); }
.header__stat-label--gray { color: var(--gray); }

/* Stats Grid — Apple card style */
.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px; }
.stat-card { background: var(--bg); border-radius: var(--radius); padding: 32px 24px; text-align: center; border: none; box-shadow: none; }
.stat-card__value { font-size: 3em; font-weight: 700; color: var(--text); line-height: 1; letter-spacing: -0.03em; }
.stat-card__label { font-size: 0.95em; color: var(--text-light); margin-top: 8px; font-weight: 500; }
.stat-card__sub { font-size: 0.8em; color: var(--gray2); margin-top: 4px; }

/* Tier Section */
.tier-section { background: var(--bg); border-radius: var(--radius); padding: 40px 48px; margin-bottom: 32px; }
.section-title { font-size: 1.4em; font-weight: 700; color: var(--text); margin-bottom: 28px; letter-spacing: -0.01em; }
.tier-bars { display: flex; flex-direction: column; gap: 20px; }
.tier-bar { display: flex; flex-direction: column; gap: 8px; }
.tier-bar__header { display: flex; justify-content: space-between; font-size: 0.95em; font-weight: 600; color: var(--text); }
.tier-bar__meta { color: var(--gray); font-size: 0.85em; font-weight: 400; }
.tier-bar__track { background: var(--bg2); border-radius: 10px; height: 12px; overflow: hidden; }
.tier-bar__fill { height: 100%; border-radius: 10px; display: flex; align-items: center; justify-content: flex-end; padding-right: 12px; color: white; font-size: 0.8em; font-weight: 600; min-width: 36px; }
.tier-bar--a .tier-bar__fill { background: var(--green); }
.tier-bar--b .tier-bar__fill { background: var(--orange); }
.tier-bar--c .tier-bar__fill { background: var(--gray2); }

/* Top 10 */
.top10-section { margin-bottom: 40px; }
.top10-section__title { font-size: 1.4em; font-weight: 700; color: var(--text); margin-bottom: 20px; letter-spacing: -0.01em; }
.top10-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }

/* KOL Card — Apple card style */
.kol-card { background: var(--bg); border-radius: var(--radius); padding: 28px 24px 22px; border: none; box-shadow: 0 2px 12px rgba(0,0,0,0.04); position: relative; transition: transform 0.25s cubic-bezier(0.25, 0.1, 0.25, 1), box-shadow 0.25s cubic-bezier(0.25, 0.1, 0.25, 1); }
.kol-card:hover { transform: translateY(-4px); box-shadow: 0 8px 30px rgba(0,0,0,0.08); }
.kol-card::before { display: none; }
.kol-card__rank { position: absolute; top: 20px; right: 20px; width: 32px; height: 32px; background: var(--bg2); color: var(--gray); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.95em; }
.kol-card__header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; padding-right: 36px; }
.kol-card__name { font-size: 1.1em; font-weight: 700; color: var(--text); text-decoration: none; letter-spacing: -0.01em; }
.kol-card__name:hover { color: var(--purple); }
.kol-card__score { font-size: 1.6em; font-weight: 700; color: var(--text); letter-spacing: -0.03em; line-height: 1; }
.kol-card__score-label { font-size: 0.4em; color: var(--gray); }
.kol-card__nickname { color: var(--text-light); font-size: 0.9em; margin-bottom: 14px; font-weight: 400; }
.kol-card__meta { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
.kol-card__followers { font-size: 0.9em; font-weight: 600; color: var(--text); }
.kol-card__tier { font-size: 0.72em; padding: 3px 10px; border-radius: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
.badge-a { background: var(--green); }
.badge-b { background: var(--orange); }
.badge-c { background: var(--gray2); }
.kol-card__dimensions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px; }
.dim { background: var(--bg2); padding: 10px 12px; border-radius: 10px; display: flex; justify-content: space-between; align-items: center; }
.dim__label { font-size: 0.8em; color: var(--gray); font-weight: 500; }
.dim__value { font-size: 0.9em; font-weight: 700; color: var(--text); }
.kol-card__source { font-size: 0.8em; color: var(--gray); margin-bottom: 16px; }
.kol-card__footer { border-top: 1px solid var(--border); padding-top: 14px; display: flex; flex-direction: column; gap: 10px; }
.kol-card__email { font-size: 0.85em; }
.kol-card__email.email-yes { color: var(--green); }
.kol-card__email.email-no { color: var(--gray2); }
.kol-card__actions { display: flex; gap: 8px; }

/* Buttons — Apple style */
.card-btn { flex: 1; padding: 9px 14px; border-radius: 12px; font-size: 0.85em; cursor: pointer; border: none; transition: all 0.15s; font-weight: 600; letter-spacing: 0.01em; }
.card-btn--mail { background: #0071E3; color: white; }
.card-btn--mail:hover { background: #0077ED; }
.card-btn--copy { background: var(--bg2); color: var(--text); }
.card-btn--copy:hover { background: #E8E8ED; }
.card-btn:active { transform: scale(0.97); }

/* Full List */
.full-list { background: var(--bg); padding: 40px 48px; border-radius: var(--radius); margin-bottom: 40px; }
.batch-bar { display: flex; align-items: center; gap: 20px; padding: 16px 20px; background: var(--bg2); border-radius: 14px; margin-bottom: 16px; flex-wrap: wrap; }
.batch-bar__select { display: flex; align-items: center; gap: 8px; font-size: 0.9em; color: var(--text); cursor: pointer; font-weight: 500; }
.batch-bar__select input { width: 16px; height: 16px; cursor: pointer; accent-color: var(--purple); }
.batch-bar__count { font-size: 0.9em; color: var(--gray); }
.batch-bar__actions { margin-left: auto; display: flex; gap: 10px; }
.batch-btn { padding: 9px 18px; border-radius: 12px; font-size: 0.88em; cursor: pointer; border: none; transition: all 0.15s; font-weight: 600; letter-spacing: 0.01em; }
.batch-btn--primary { background: var(--purple); color: white; }
.batch-btn--primary:hover { background: #0077ED; }
.batch-btn--primary:disabled { background: var(--gray3); cursor: not-allowed; }
.batch-btn--secondary { background: var(--bg2); color: var(--text); }
.batch-btn--secondary:hover { background: #E8E8ED; }
.search-bar { margin-bottom: 14px; }
.search-bar input { width: 100%; padding: 13px 18px; border: 1.5px solid var(--border); border-radius: 12px; font-size: 0.95em; transition: border-color 0.2s; background: var(--bg); color: var(--text); }
.search-bar input:focus { border-color: var(--purple); outline: none; }
.search-bar input::placeholder { color: var(--gray2); }
.filter-bar { display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
.filter-bar label { display: flex; align-items: center; gap: 7px; font-size: 0.88em; cursor: pointer; padding: 7px 14px; background: var(--bg2); border-radius: 10px; transition: background 0.15s; font-weight: 500; color: var(--text); }
.filter-bar label:hover { background: #E8E8ED; }
.filter-bar input { width: 15px; height: 15px; accent-color: var(--purple); cursor: pointer; }

/* Table — Apple style */
table { width: 100%; border-collapse: collapse; }
th { background: transparent; padding: 12px 10px; text-align: left; font-size: 0.78em; font-weight: 600; color: var(--gray); text-transform: uppercase; letter-spacing: 0.06em; cursor: pointer; user-select: none; border-bottom: 1.5px solid var(--border); }
th:hover { color: var(--text); }
th::after { content: ''; display: inline-block; margin-left: 6px; opacity: 0.3; }
th.sort-asc::after { content: ' ↑'; }
th.sort-desc::after { content: ' ↓'; }
td { padding: 14px 10px; border-bottom: 1px solid var(--border); font-size: 0.9em; color: var(--text); }
tr:last-child td { border-bottom: none; }
tr:hover td { background: var(--bg2); }
tr.tier-a td:first-child { border-left: 3px solid var(--green); }
tr.tier-b td:first-child { border-left: 3px solid var(--orange); }
tr.tier-c td:first-child { border-left: 3px solid var(--gray2); }
tr.selected td { background: #F5F9FF; }
td a { color: var(--purple); text-decoration: none; }
td a:hover { text-decoration: underline; }
td.email-yes { color: var(--green); }
td.email-no { color: var(--gray2); }

/* Toast */
.toast { position: fixed; bottom: 28px; right: 28px; background: var(--text); color: white; padding: 14px 22px; border-radius: 14px; font-size: 0.88em; opacity: 0; transform: translateY(16px); transition: all 0.3s cubic-bezier(0.25, 0.1, 0.25, 1); pointer-events: none; z-index: 9999; font-weight: 500; letter-spacing: 0.01em; }
.toast.show { opacity: 1; transform: translateY(0); }

/* Footer */
footer { text-align: center; padding: 40px 20px; color: var(--gray); font-size: 0.82em; }

/* Responsive */
@media (max-width: 900px) {
  .header { flex-direction: column; padding: 36px 32px; gap: 32px; }
  .header__right { gap: 28px; }
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
  .stat-card__value { font-size: 2.2em; }
}
@media (max-width: 640px) {
  .container { padding: 24px 16px; }
  .stats-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
  .stat-card { padding: 20px 16px; }
  .stat-card__value { font-size: 1.8em; }
  .top10-grid { grid-template-columns: 1fr; }
  .header { padding: 28px 24px; }
  .header__title { font-size: 2em; }
  .header__right { flex-wrap: wrap; gap: 20px; }
  .full-list { padding: 24px 20px; }
  .tier-section { padding: 28px 24px; }
  table { font-size: 0.82em; }
  th, td { padding: 10px 6px; }
  .batch-bar { flex-direction: column; align-items: flex-start; }
  .batch-bar__actions { margin-left: 0; }
}
</style>
</head>
<body>
<div class="container">
  <header class="header">
    <div class="header__left">
      <div class="header__label">KOL 建联报告</div>
      <h1 class="header__title">${CUSTOMIZE.PRODUCT_FULL_NAME}</h1>
      <div class="header__subtitle">目标市场：${CUSTOMIZE.TARGET_MARKET} · 定价：$${CUSTOMIZE.PRICE}</div>
    </div>
    <div class="header__right">
      <div class="header__stat">
        <span class="header__stat-value">${influencers.length}</span>
        <span class="header__stat-label">总博主数</span>
      </div>
      <div class="header__stat">
        <span class="header__stat-value" style="color:#4CAF50">${tiers.A}</span>
        <span class="header__stat-label">A级 ≥80分</span>
      </div>
      <div class="header__divider"></div>
      <div class="header__stat">
        <span class="header__stat-value" style="color:#FF9800">${tiers.B}</span>
        <span class="header__stat-label">B级 70-79分</span>
      </div>
      <div class="header__stat">
        <span class="header__stat-value" style="color:#9E9E9E">${tiers.C}</span>
        <span class="header__stat-label">C级 &lt;70分</span>
      </div>
    </div>
  </header>

  <section class="stats-grid">
    <div class="stat-card">
      <div class="stat-card__value">${influencers.length}</div>
      <div class="stat-card__label">总博主数</div>
    </div>
    <div class="stat-card">
      <div class="stat-card__value stat-card__value--green">${tiers.A}</div>
      <div class="stat-card__label">Tier A (≥80 分)</div>
      <div class="stat-card__sub">回复率参考 40-60%</div>
    </div>
    <div class="stat-card">
      <div class="stat-card__value stat-card__value--orange">${tiers.B}</div>
      <div class="stat-card__label">Tier B (70-79 分)</div>
      <div class="stat-card__sub">回复率参考 20-30%</div>
    </div>
    <div class="stat-card">
      <div class="stat-card__value stat-card__value--purple">${Math.round((emailCount / total) * 100)}%</div>
      <div class="stat-card__label">有邮箱</div>
      <div class="stat-card__sub">${emailCount} / ${total} creators</div>
    </div>
  </section>

  <section class="tier-section">
    <h2 class="section-title">Tier Distribution</h2>
    <div class="tier-bars">
      <div class="tier-bar tier-bar--a">
        <div class="tier-bar__header"><span>Tier A (≥80 分)</span><span class="tier-bar__meta">${tiers.A} 位博主 · 回复率 40-60%</span></div>
        <div class="tier-bar__track"><div class="tier-bar__fill" style="width:${tierPct('A')}%">${tiers.A}</div></div>
      </div>
      <div class="tier-bar tier-bar--b">
        <div class="tier-bar__header"><span>Tier B (70-79 分)</span><span class="tier-bar__meta">${tiers.B} 位博主 · 回复率 20-30%</span></div>
        <div class="tier-bar__track"><div class="tier-bar__fill" style="width:${tierPct('B')}%">${tiers.B}</div></div>
      </div>
      <div class="tier-bar tier-bar--c">
        <div class="tier-bar__header"><span>Tier C (&lt;70 分)</span><span class="tier-bar__meta">${tiers.C} 位博主 · 持续观察</span></div>
        <div class="tier-bar__track"><div class="tier-bar__fill" style="width:${tierPct('C')}%">${tiers.C}</div></div>
      </div>
    </div>
  </section>

  <section class="top10-section">
    <div class="top10-section__header">
      <h2 class="top10-section__title">Top 10 优先建联</h2>
    </div>
    <div class="top10-grid">
      ${top10Cards}
    </div>
  </section>

  <section class="full-list">
    <h2 class="section-title">完整列表（${influencers.length} 位）</h2>
    <div class="batch-bar">
      <label class="batch-bar__select"><input type="checkbox" id="selectAll"> 全选可见行</label>
      <span class="batch-bar__count" id="selectedCount"></span>
      <div class="batch-bar__actions">
        <button class="batch-btn batch-btn--primary" id="copyAllBtn" disabled>复制选中邮箱</button>
        <button class="batch-btn batch-btn--secondary" id="clearSelection">清除</button>
      </div>
    </div>
    <div class="search-bar">
      <input type="text" id="searchInput" placeholder="Search username, nickname...">
    </div>
    <div class="filter-bar">
      <label><input type="checkbox" data-tier="A"> A</label>
      <label><input type="checkbox" data-tier="B"> B</label>
      <label><input type="checkbox" data-tier="C"> C</label>
      <label><input type="checkbox" data-has-email="true"> 有邮箱</label>
    </div>
    <table id="influencerTable">
      <thead>
        <tr>
          <th data-sort="rank">排序</th>
          <th data-sort="unique_id">账号名</th>
          <th data-sort="nickname">昵称</th>
          <th data-sort="follower_count">粉丝数</th>
          <th data-sort="email">邮箱</th>
          <th data-sort="overall_score">综合分</th>
          <th data-sort="content_relevance">相关度</th>
          <th data-sort="creator_match">创作者匹配</th>
          <th data-sort="collab_potential">合作潜力</th>
          <th data-sort="engagement_rate">互动率</th>
          <th data-sort="tier">等级</th>
          <th data-sort="keyword_source">来源</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
  </section>
</div>

<footer>
  <p>Generated ${timestamp} · TikTok KOL Agent · ${stats.total} creators collected</p>
</footer>

<script>
function showToast(msg) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.className = 'toast show';
  setTimeout(() => t.className = 'toast', 2000);
}
function copyText(text) { navigator.clipboard.writeText(text).then(() => showToast('已复制: ' + text)); }
function openMail(email) { window.open('mailto:' + email, '_blank'); }

const table = document.getElementById('influencerTable');
const searchInput = document.getElementById('searchInput');

searchInput.addEventListener('input', () => {
  const term = searchInput.value.toLowerCase();
  table.querySelectorAll('tbody tr').forEach(row => {
    row.style.display = row.textContent.toLowerCase().includes(term) ? '' : 'none';
  });
});

document.querySelectorAll('.filter-bar input[type="checkbox"]').forEach(cb => {
  cb.addEventListener('change', () => {
    const checkedTiers = [...document.querySelectorAll('.filter-bar input[data-tier]:checked')].map(c => c.dataset.tier.toLowerCase());
    const hasEmailOnly = document.querySelector('input[data-has-email="true"]').checked;
    table.querySelectorAll('tbody tr').forEach(row => {
      const tierMatch = checkedTiers.length === 0 || checkedTiers.includes(row.dataset.tier);
      const hasEmail = row.querySelector('.email-yes') !== null;
      row.style.display = (tierMatch && (!hasEmailOnly || hasEmail)) ? '' : 'none';
    });
  });
});

document.querySelectorAll('th[data-sort]').forEach(th => {
  th.addEventListener('click', () => {
    const isAsc = th.classList.contains('sort-asc');
    document.querySelectorAll('th').forEach(t => t.classList.remove('sort-asc', 'sort-desc'));
    th.classList.add(isAsc ? 'sort-desc' : 'sort-asc');
    const rows = [...table.querySelectorAll('tbody tr')];
    rows.sort((a, b) => {
      const aVal = a.children[[...th.parentElement.children].indexOf(th)].textContent;
      const bVal = b.children[[...th.parentElement.children].indexOf(th)].textContent;
      const aNum = parseFloat(aVal.replace(/,/g, ''));
      const bNum = parseFloat(bVal.replace(/,/g, ''));
      if (!isNaN(aNum) && !isNaN(bNum)) return isAsc ? bNum - aNum : aNum - bNum;
      return isAsc ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
    });
    rows.forEach(row => table.querySelector('tbody').appendChild(row));
  });
});

function updateBatchBar() {
  const count = table.querySelectorAll('tbody tr.selected').length;
  document.getElementById('selectedCount').textContent = count ? count + ' 已选' : '';
  document.getElementById('copyAllBtn').disabled = count === 0;
}

table.querySelectorAll('tbody tr').forEach(row => {
  row.style.cursor = 'pointer';
  row.addEventListener('click', e => {
    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'A' || e.target.tagName === 'INPUT') return;
    row.classList.toggle('selected');
    updateBatchBar();
  });
});

document.getElementById('selectAll').addEventListener('change', function() {
  table.querySelectorAll('tbody tr').forEach(row => {
    if (row.style.display !== 'none') row.classList.toggle('selected', this.checked);
  });
  updateBatchBar();
});

document.getElementById('copyAllBtn').addEventListener('click', () => {
  const emails = [...table.querySelectorAll('tbody tr.selected')]
    .map(row => row.querySelector('.email-yes a')?.textContent?.trim())
    .filter(Boolean);
  if (!emails.length) return;
  navigator.clipboard.writeText(emails.join(', ')).then(() => showToast('已复制 ' + emails.length + ' 个邮箱'));
});

document.getElementById('clearSelection').addEventListener('click', () => {
  table.querySelectorAll('tbody tr.selected').forEach(r => r.classList.remove('selected'));
  document.getElementById('selectAll').checked = false;
  updateBatchBar();
});
</script>
</body>
</html>`;
}

// ============ 主程序 ============

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║        Petkit KOL 采集和评分系统（快速启动模式）             ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  ensureOutputDir();

  console.log(`📦 产品: ${CUSTOMIZE.PRODUCT_FULL_NAME}`);
  console.log(`🎯 目标市场: ${CUSTOMIZE.TARGET_MARKET}`);
  console.log(`💰 价格: $${CUSTOMIZE.PRICE}`);
  console.log(`🔍 目标采集: 30 位博主\n`);

  // ============ Phase 1: 采集 ============
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📥 Phase 1: 视频搜索发现创作者\n');

  let allInfluencers: Influencer[] = [];

  for (const task of CUSTOMIZE.SEARCH_TASKS) {
    const results = await searchVideos(task.keyword, task.targetCount);
    allInfluencers = allInfluencers.concat(results);
  }

  console.log(`\n✓ 第一阶段完成，共采集 ${allInfluencers.length} 位博主（去重前）`);

  // 按 unique_id 全局去重
  const uniqueInfluencers: { [key: string]: Influencer } = {};
  for (const inf of allInfluencers) {
    if (!uniqueInfluencers[inf.unique_id]) {
      uniqueInfluencers[inf.unique_id] = inf;
    } else if (inf.max_play_count > uniqueInfluencers[inf.unique_id].max_play_count) {
      uniqueInfluencers[inf.unique_id] = inf;
    }
  }

  allInfluencers = Object.values(uniqueInfluencers);
  console.log(`✓ 去重后: ${allInfluencers.length} 位博主\n`);

  // ============ Phase 2: 补全数据 ============
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📋 Phase 2: 批量获取完整 Bio 和邮箱\n');

  let enrichedInfluencers: Influencer[] = [];
  for (let i = 0; i < allInfluencers.length; i++) {
    const inf = allInfluencers[i];
    console.log(`  [${i + 1}/${allInfluencers.length}] 获取 @${inf.unique_id} 的完整信息...`);

    const enriched = await enrichInfluencerData(inf);
    enrichedInfluencers.push(enriched);
  }

  const emailCount = enrichedInfluencers.filter(i => i.email).length;
  console.log(`\n✓ 第二阶段完成`);
  console.log(`✓ 有邮箱: ${emailCount} 位 (${Math.round(emailCount / enrichedInfluencers.length * 100)}%)\n`);

  // ============ Phase 3: 智能评分 ============
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('⭐ Phase 3: 多维度智能评分\n');

  const scoredInfluencers: InfluencerWithScores[] = enrichedInfluencers.map(inf =>
    scoreInfluencer(inf, inf.keyword_source)
  );

  // 排序
  scoredInfluencers.sort((a, b) => b.overall_score - a.overall_score);

  console.log('✓ 评分完成，按综合分排序\n');

  // ============ 统计 ============
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📊 采集统计\n');

  const tierStats = {
    A: scoredInfluencers.filter(i => i.tier === 'A').length,
    B: scoredInfluencers.filter(i => i.tier === 'B').length,
    C: scoredInfluencers.filter(i => i.tier === 'C').length
  };

  console.log(`📈 总采集: ${scoredInfluencers.length} 位博主`);
  console.log(`  ├─ A 级 (≥80 分): ${tierStats.A} 位`);
  console.log(`  ├─ B 级 (70-79 分): ${tierStats.B} 位`);
  console.log(`  └─ C 级 (<70 分): ${tierStats.C} 位`);
  console.log(`📧 有邮箱: ${emailCount} 位 (${Math.round(emailCount / scoredInfluencers.length * 100)}%)`);

  // 按来源统计
  const bySource: any = {};
  for (const inf of scoredInfluencers) {
    if (!bySource[inf.keyword_source]) {
      bySource[inf.keyword_source] = [];
    }
    bySource[inf.keyword_source].push(inf);
  }

  console.log('\n🔍 按搜索关键词统计:');
  for (const [source, influencers] of Object.entries(bySource)) {
    const list = influencers as InfluencerWithScores[];
    const avgScore = Math.round(list.reduce((sum, i) => sum + i.overall_score, 0) / list.length);
    console.log(`  • "${source}": ${list.length} 位 (平均分 ${avgScore})`);
  }

  const stats = {
    total: scoredInfluencers.length,
    tiers: tierStats,
    email_rate: (emailCount / scoredInfluencers.length).toFixed(2),
    by_source: Object.keys(bySource).reduce((acc, key) => {
      acc[key] = bySource[key].length;
      return acc;
    }, {} as any)
  };

  // ============ 输出文件 ============
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('💾 生成输出文件\n');

  const csvFilename = `kol-${CUSTOMIZE.OUTPUT_LABEL}-${CUSTOMIZE.TIMESTAMP}.csv`;
  const jsonFilename = `kol-${CUSTOMIZE.OUTPUT_LABEL}-${CUSTOMIZE.TIMESTAMP}.json`;
  const metaFilename = `kol-${CUSTOMIZE.OUTPUT_LABEL}-${CUSTOMIZE.TIMESTAMP}.meta.json`;

  const csvPath = path.join(CUSTOMIZE.OUTPUT_DIR, csvFilename);
  const jsonPath = path.join(CUSTOMIZE.OUTPUT_DIR, jsonFilename);
  const metaPath = path.join(CUSTOMIZE.OUTPUT_DIR, metaFilename);

  // CSV
  fs.writeFileSync(csvPath, generateCSV(scoredInfluencers));
  console.log(`✓ CSV 名单: ${csvFilename}`);

  // JSON
  fs.writeFileSync(jsonPath, generateJSON(scoredInfluencers, stats));
  console.log(`✓ JSON 数据: ${jsonFilename}`);

  // Meta
  fs.writeFileSync(metaPath, JSON.stringify({
    product: CUSTOMIZE.PRODUCT_FULL_NAME,
    timestamp: new Date().toISOString(),
    stats: stats
  }, null, 2));
  console.log(`✓ 元数据: ${metaFilename}`);

  // HTML
  const htmlFilename = `kol-${CUSTOMIZE.OUTPUT_LABEL}-${CUSTOMIZE.TIMESTAMP}.html`;
  const htmlPath = path.join(CUSTOMIZE.OUTPUT_DIR, htmlFilename);
  fs.writeFileSync(htmlPath, generateHTML(scoredInfluencers, stats));
  console.log(`✓ HTML 报告: ${htmlFilename}`);

  // ============ Top 10 展示 ============
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('👑 Top 10 优先建联名单\n');

  for (let i = 0; i < Math.min(10, scoredInfluencers.length); i++) {
    const inf = scoredInfluencers[i];
    const email_badge = inf.email ? '✉️' : '📱';
    console.log(
      `${i + 1}. @${inf.unique_id} (${inf.overall_score} 分) ${inf.tier}级`
    );
    console.log(
      `   昵称: ${inf.nickname} | 粉丝: ${inf.follower_count.toLocaleString()}`
    );
    console.log(
      `   ${email_badge} ${inf.email || '无邮箱，需私信'}`
    );
    console.log(
      `   来源: ${inf.keyword_source}`
    );
    console.log();
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('✅ 采集完成！');
  console.log(`📁 所有文件已保存到: ${CUSTOMIZE.OUTPUT_DIR}/`);
  console.log('\n💡 建议:');
  console.log('   1. 优先联系 A 级有邮箱的博主（邮件回复率 40-50%）');
  console.log('   2. 竞品词来源的博主质量最高（Litter Robot review）');
  console.log('   3. 小号（2K-10K 粉）往往比大号更容易合作');
  console.log('\n');
}

main().catch(console.error);
