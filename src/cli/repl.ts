import inquirer from 'inquirer';
import type { ProductContext, KeywordTask, KeywordRecommendation } from '../types';
import { PRIORITY_LABELS } from '../constants';
import { ClaudeClient } from '../ai/ClaudeClient';
import { TikHubClient } from '../api/TikHubClient';
import { Scorer } from '../scoring/Scorer';
import { getWeightConfig } from '../scoring/WeightConfig';
import { CsvExporter } from '../output/CsvExporter';
import { HtmlReportGenerator } from '../output/HtmlReportGenerator';
import { SessionStore } from '../session/SessionStore';
import { Session } from '../session/SessionState';

export class KOLRepl {
  private session: Session;
  private claude: ClaudeClient;
  private tikhub: TikHubClient;

  constructor(session?: Session) {
    this.session = session || new Session();
    this.claude = new ClaudeClient();
    this.tikhub = new TikHubClient();
  }

  async run() {
    console.log('\n🤖 TikTok KOL Agent — 欢迎！\n');
    console.log('告诉我你想推广什么产品，我们一起找到合适的 TikTok 博主。\n');

    await this.phaseDiagnosis();
    await this.phaseKeywords();
    await this.phaseCollection();
    await this.phaseScoring();
    await this.phaseOutput();

    console.log('\n✅ 完成！所有文件已保存到 output/ 目录。\n');
  }

  // ============ Phase 1: Product Diagnosis ============
  private async phaseDiagnosis() {
    this.session.transitionTo('diagnosis');

    let productInfo = '';
    let isComplete = false;

    while (!isComplete) {
      const { userInput } = await inquirer.prompt([
        {
          type: 'input',
          name: 'userInput',
          message: productInfo ? '👉 请继续补充：' : '📋 请描述你的产品：',
          default: '',
        },
      ]);

      if (!userInput.trim()) {
        console.log('请输入产品信息。\n');
        continue;
      }

      productInfo = productInfo ? productInfo + '\n' + userInput : userInput;

      console.log('\n⏳ AI 分析中...\n');
      const diagnosis = await this.claude.diagnoseProduct(userInput, this.session.productContext);
      console.log(diagnosis.text);

      // Extract structured context from AI response
      if (Object.keys(diagnosis.context).length > 0) {
        this.session.setProductContext(diagnosis.context);
      }

      if (this.session.productContext.brand && this.session.productContext.category) {
        const { confirm } = await inquirer.prompt([
          { type: 'confirm', name: 'confirm', message: '\n产品信息是否完整？确认后进入关键词策略阶段。', default: true },
        ]);
        if (confirm) { isComplete = true; break; }
      }

      const { continue_diagnosis } = await inquirer.prompt([
        { type: 'confirm', name: 'continue_diagnosis', message: '\n继续补充产品信息？', default: true },
      ]);

      if (!continue_diagnosis) {
        // Fallback: try to extract brand and category from user input
        if (!this.session.productContext.brand || !this.session.productContext.category) {
          const input = productInfo || userInput;
          const brandMatch = input.match(/(?:品牌|brand|by)[：:]\s*(\S+)/i) || input.match(/^(\S+)/);
          const catMatch = input.match(/(?:品类|category|是)[：:]\s*(\S+)/i) || input.match(/(\S+)(?:猫砂盆|猫粮|猫|宠物)/);
          if (brandMatch) this.session.setProductContext({ brand: brandMatch[1].replace(/[,，、].*$/, '') });
          if (catMatch) this.session.setProductContext({ category: catMatch[1] });
        }
        isComplete = true;
        break;
      }
    }

    // Set priority mode
    const { priorityMode } = await inquirer.prompt([
      {
        type: 'list',
        name: 'priorityMode',
        message: '🎯 选择优先级模式：',
        choices: [
          { name: PRIORITY_LABELS.rapid_launch, value: 'rapid_launch' },
          { name: PRIORITY_LABELS.conversion, value: 'conversion' },
          { name: PRIORITY_LABELS.brand_building, value: 'brand_building' },
          { name: PRIORITY_LABELS.custom, value: 'custom' },
        ],
        default: 'rapid_launch',
      },
    ]);

    if (priorityMode === 'custom') {
      const { content, audience, collab, growth } = await inquirer.prompt([
        { type: 'number', name: 'content', message: '内容相关度权重 (0-100):', default: 30 },
        { type: 'number', name: 'audience', message: '粉丝匹配权重 (0-100):', default: 20 },
        { type: 'number', name: 'collab', message: '合作潜力权重 (0-100):', default: 40 },
        { type: 'number', name: 'growth', message: '增长趋势权重 (0-100):', default: 10 },
      ]);

      this.session.setPriorityMode('custom', {
        contentRelevance: content / 100,
        audienceMatch: audience / 100,
        collabPotential: collab / 100,
        growthMomentum: growth / 100,
      });
    } else {
      this.session.setPriorityMode(priorityMode as any);
    }

    SessionStore.save(this.session);
  }

  // ============ Phase 2: Keyword Generation ============
  private async phaseKeywords() {
    this.session.transitionTo('keywords');

    console.log('\n⏳ AI 正在生成搜索关键词策略...\n');

    const productContext = this.session.productContext as ProductContext;
    const recommendations = await this.claude.generateKeywords(productContext);

    if (recommendations.length === 0) {
      console.log('⚠️ AI 未能生成关键词，使用默认关键词。\n');
      const ctx = this.session.productContext;
      const defaults = [
        ctx.category || 'pet products', 'category', 'Product category',
        ctx.brand || 'pet brand', 'competitor', 'Brand discovery',
        'pet tech', 'audience', 'Pet owner audience',
        'review', 'scene', 'Product review content',
      ];
      for (let i = 0; i < defaults.length; i += 3) {
        recommendations.push({
          keyword: defaults[i],
          source: defaults[i + 1] as any,
          intent: defaults[i + 2],
          expectedInfluencerType: 'Pet lifestyle',
          searchVolumeEstimate: 'Medium',
          targetCount: 30,
        });
      }
    }

    console.log('🔍 AI 推荐的搜索关键词：\n');
    recommendations.forEach((kw, i) => {
      console.log(`${i + 1}. "${kw.keyword}"`);
      console.log(`   类型：${kw.source} | 预期：${kw.expectedInfluencerType} | 目标：${kw.targetCount} 位`);
      console.log();
    });

    const { confirmed } = await inquirer.prompt([
      { type: 'confirm', name: 'confirmed', message: '确认这些关键词，开始采集？', default: true },
    ]);

    if (!confirmed) {
      const { add_more } = await inquirer.prompt([
        { type: 'input', name: 'add_more', message: '输入要添加的关键词（多个用逗号分隔）：' },
      ]);

      if (add_more.trim()) {
        const newKeywords = add_more.split(',').map((k: string) => k.trim()).filter(Boolean);
        for (const kw of newKeywords) {
          recommendations.push({
            keyword: kw,
            source: 'user_added' as any,
            intent: 'User added',
            expectedInfluencerType: 'Unknown',
            searchVolumeEstimate: 'Medium',
            targetCount: 30,
          });
        }
      }
    }

    const keywordTasks: KeywordTask[] = recommendations.map((kw) => ({
      keyword: kw.keyword,
      source: kw.source as any,
      targetCount: kw.targetCount,
      actualCount: 0,
      weight: kw.source === 'competitor' ? 1.5 : kw.source === 'category' ? 1.0 : 0.8,
      avgScore: 0,
    }));

    this.session.setKeywords(keywordTasks);
    SessionStore.save(this.session);
  }

  // ============ Phase 3: Data Collection ============
  private async phaseCollection() {
    this.session.transitionTo('collection');

    console.log('\n📥 开始采集博主数据...\n');

    const tikhub = new TikHubClient();
    const tasks = this.session.keywords;
    const allInfluencers: any[] = [];

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      console.log(`[${i + 1}/${tasks.length}] 搜索: "${task.keyword}"`);

      const results = await tikhub.searchVideos(task.keyword, task.targetCount);
      task.actualCount = results.length;
      allInfluencers.push(...results);

      console.log(`  ✓ 获取 ${results.length} 位博主`);
    }

    console.log(`\n✓ 搜索完成，共 ${allInfluencers.length} 位博主（去重前）`);

    const uniqueMap: { [key: string]: any } = {};
    for (const inf of allInfluencers) {
      if (!uniqueMap[inf.unique_id]) {
        uniqueMap[inf.unique_id] = inf;
      } else if (inf.max_play_count > uniqueMap[inf.unique_id].max_play_count) {
        uniqueMap[inf.unique_id] = inf;
      }
    }
    const influencers = Object.values(uniqueMap);
    console.log(`✓ 去重后: ${influencers.length} 位博主\n`);

    this.session.setInfluencers(influencers);

    console.log('📋 正在补全博主资料和邮箱...\n');

    const enriched: any[] = [];
    for (let i = 0; i < influencers.length; i++) {
      process.stdout.write(`\r  [${i + 1}/${influencers.length}] 补全中...`);
      const inf = await tikhub.enrichInfluencer(influencers[i]);
      enriched.push(inf);
    }

    console.log(`\n\n✓ 补全完成`);
    const emailCount = enriched.filter(i => i.email).length;
    console.log(`✓ 有邮箱: ${emailCount} 位 (${Math.round(emailCount / enriched.length * 100)}%)\n`);

    this.session.setInfluencers(enriched);
    SessionStore.save(this.session);
  }

  // ============ Phase 4: Scoring ============
  private async phaseScoring() {
    this.session.transitionTo('scoring');

    console.log('\n⭐ 正在进行多维度评分...\n');

    const weights = getWeightConfig(this.session.priorityMode as any, this.session.customWeights || undefined);
    console.log(`使用权重配置: 内容${Math.round(weights.contentRelevance * 100)}% 粉丝${Math.round(weights.audienceMatch * 100)}% 合作${Math.round(weights.collabPotential * 100)}% 增长${Math.round(weights.growthMomentum * 100)}%\n`);

    console.log('⏳ AI 正在分析博主内容相关性...\n');
    const aiScores = await this.claude.scoreInfluencerBatch(
      this.session.influencers,
      this.session.productContext as ProductContext,
      weights
    );

    const scoreMap = new Map<string, any>();
    for (const s of aiScores) {
      scoreMap.set(s.unique_id, s);
    }

    const scored = this.session.influencers.map(inf => {
      const aiScore = scoreMap.get(inf.unique_id);
      if (aiScore) {
        return this.buildScoredInfluencer(inf, aiScore, weights);
      }
      const fallback = new Scorer(this.session.productContext, this.session.priorityMode as any).scoreInfluencer(inf);
      return fallback;
    });

    scored.sort((a, b) => b.overallScore - a.overallScore);

    this.session.setScoredInfluencers(scored);

    const tierStats = { A: scored.filter(i => i.tier === 'A').length, B: scored.filter(i => i.tier === 'B').length, C: scored.filter(i => i.tier === 'C').length };

    console.log('📊 评分完成！\n');
    console.log(`  A 级 (≥80): ${tierStats.A} 位`);
    console.log(`  B 级 (70-79): ${tierStats.B} 位`);
    console.log(`  C 级 (<70): ${tierStats.C} 位\n`);

    console.log('👑 Top 10 优先建联名单：\n');
    for (let i = 0; i < Math.min(10, scored.length); i++) {
      const inf = scored[i];
      const emailBadge = inf.email ? '✉️' : '📱';
      console.log(`${i + 1}. @${inf.unique_id} (${inf.overallScore}分) ${inf.tier}级`);
      console.log(`   粉丝: ${inf.follower_count.toLocaleString()} | ${emailBadge} ${inf.email || '无邮箱'}`);
      console.log();
    }

    SessionStore.save(this.session);
  }

  private buildScoredInfluencer(inf: any, aiScore: any, weights: any): any {
    const overallScore = Math.round(
      aiScore.contentRelevance * weights.contentRelevance +
      aiScore.audienceMatch * weights.audienceMatch +
      aiScore.collabPotential * weights.collabPotential +
      aiScore.engagementRate * weights.growthMomentum
    );

    let tier: 'A' | 'B' | 'C' = 'C';
    if (overallScore >= 80) tier = 'A';
    else if (overallScore >= 70) tier = 'B';

    return {
      ...inf,
      contentRelevance: aiScore.contentRelevance,
      audienceMatch: aiScore.audienceMatch,
      collabPotential: aiScore.collabPotential,
      engagementRate: aiScore.engagementRate,
      overallScore,
      tier,
      scoreBreakdown: aiScore.reasoning || 'AI智能评分',
    };
  }

  // ============ Phase 5: Output ============
  private async phaseOutput() {
    this.session.transitionTo('complete');
    this.session.isComplete = true;

    const scored = this.session.scoredInfluencers;
    const productFullName = `${this.session.productContext.brand || ''} ${this.session.productContext.product || ''}`.trim();
    const label = this.extractBrandFromInput();
    const timestamp = this.getTimestamp();
    const targetMarket = this.session.productContext.targetMarkets?.join(', ') || 'Unknown';
    const price = this.session.productContext.price || 0;

    const stats = {
      total: scored.length,
      emailRate: scored.filter(i => i.email).length / scored.length,
      tiers: {
        A: scored.filter(i => i.tier === 'A').length,
        B: scored.filter(i => i.tier === 'B').length,
        C: scored.filter(i => i.tier === 'C').length,
      },
    };

    console.log('\n💾 生成输出文件...\n');

    const csvPath = CsvExporter.export(scored, label, timestamp);
    console.log(`✓ CSV: ${csvPath}`);

    const htmlPath = HtmlReportGenerator.generate(
      scored, stats, productFullName, targetMarket, price, label, timestamp
    );
    console.log(`✓ HTML: ${htmlPath}`);

    SessionStore.save(this.session);
  }

  private extractBrandFromInput(): string {
    const ctx = this.session.productContext;
    if (ctx.brand) {
      return ctx.brand.toLowerCase().replace(/\s+/g, '-');
    }
    const input = this.session.productContext.product || '';
    const brandPatterns = [
      /^[a-zA-Z0-9]+/i,
      /[a-zA-Z0-9]+(?:pet|kit|pro|life|home)/i,
    ];
    for (const pattern of brandPatterns) {
      const match = input.match(pattern);
      if (match) {
        return match[0].toLowerCase().replace(/[^a-z0-9]/g, '-');
      }
    }
    return 'product';
  }

  private getTimestamp(): string {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  }

  getSession(): Session {
    return this.session;
  }
}