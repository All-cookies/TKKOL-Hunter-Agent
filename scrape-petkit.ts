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
  data_collection_timestamp: string;
}

interface InfluencerWithScores extends Influencer {
  content_relevance: number;
  audience_match: number;
  collab_potential: number;
  growth_trend: number;
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

  // 2. 粉丝匹配度（0-100）
  let audience_match = 60;

  // 根据 Bio 推测粉丝类型
  const target_keywords = ['busy', 'professional', 'cat lover', 'pet parent', 'urban', 'girl', 'mom', 'woman'];
  let target_matches = 0;

  for (const kw of target_keywords) {
    if (bio_lower.includes(kw)) target_matches++;
  }

  if (target_matches >= 2) {
    audience_match = 75 + Math.min(target_matches - 2, 25);
  } else if (target_matches >= 1) {
    audience_match = 65;
  }

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

  // 4. 增长趋势（0-100）
  // 由于我们没有历史数据，这里用粉丝数和verified状态来推测
  let growth_trend = 50;

  if (inf.verified) {
    growth_trend += 20;
  }

  if (inf.follower_count > 50000) {
    growth_trend = 70;  // 大号通常比较稳定
  } else if (inf.follower_count > 10000) {
    growth_trend = 75;  // 中号通常处于增长期
  } else if (inf.follower_count >= 2000) {
    growth_trend = 78;  // 小号往往增长最快
  }

  // 计算综合分（快速启动权重）
  // 快速启动: content=30% audience=20% collab=40% growth=10%
  const overall_score = Math.round(
    content_relevance * 0.3 +
    audience_match * 0.2 +
    collab_potential * 0.4 +
    growth_trend * 0.1
  );

  // 分层
  let tier = 'C';
  if (overall_score >= 80) tier = 'A';
  else if (overall_score >= 70) tier = 'B';

  return {
    ...inf,
    content_relevance,
    audience_match,
    collab_potential,
    growth_trend,
    overall_score,
    tier
  };
}

// ============ 输出格式 ============

function generateCSV(influencers: InfluencerWithScores[]): string {
  let csv = '排序,账号名,昵称,粉丝数,邮箱,综合评分,内容相关度,粉丝匹配,合作潜力,增长趋势,层级,来源关键词,最高播放量,认证\n';

  influencers.forEach((inf, idx) => {
    const email = inf.email || '';
    const bio_escaped = (inf.bio || '').replace(/"/g, '""').replace(/\n/g, ' ');

    csv += `${idx + 1},"${inf.unique_id}","${inf.nickname}",${inf.follower_count},"${email}",${inf.overall_score},${inf.content_relevance},${inf.audience_match},${inf.collab_potential},${inf.growth_trend},"${inf.tier}","${inf.keyword_source}",${inf.max_play_count},"${inf.verified ? 'Yes' : 'No'}"\n`;
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
