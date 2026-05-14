import OpenAI from 'openai';
import type { ProductContext, KeywordRecommendation } from '../types';
import { buildProductDiagnosisPrompt, buildKeywordGenerationPrompt, buildInfluencerScoringPrompt, buildOutreachAdvicePrompt } from './prompts/index';

// Strip <think> reasoning blocks from MiniMax responses
function stripThinkBlocks(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

const client = new OpenAI({
  baseURL: 'https://api.minimax.chat/v1',
  apiKey: process.env.MINIMAX_API_KEY || '',
});

export class ClaudeClient {
  private model = 'MiniMax-M2.7';

  async diagnoseProduct(userMessage: string, currentContext: Partial<ProductContext>): Promise<{ text: string; context: Partial<ProductContext> }> {
    const prompt = buildProductDiagnosisPrompt(userMessage, currentContext);

    const response = await client.chat.completions.create({
      model: this.model,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    let raw = response.choices[0]?.message?.content || '';
    raw = stripThinkBlocks(raw);

    // Try to parse structured product context
    let context: Partial<ProductContext> = {};
    const jsonMatch = raw.match(/PRODUCT_CONTEXT_JSON\n([\s\S]*?)\nPRODUCT_CONTEXT_JSON/);
    if (jsonMatch) {
      try {
        context = JSON.parse(jsonMatch[1]);
      } catch (e) {
        // ignore parse error
      }
    }

    // Remove the JSON block from displayed text
    const text = raw.replace(/PRODUCT_CONTEXT_JSON[\s\S]*?PRODUCT_CONTEXT_JSON/, '').trim();

    return { text, context };
  }

  async generateKeywords(productContext: ProductContext): Promise<KeywordRecommendation[]> {
    const prompt = buildKeywordGenerationPrompt(productContext);

    const response = await client.chat.completions.create({
      model: this.model,
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    let raw = response.choices[0]?.message?.content || '';
    raw = stripThinkBlocks(raw);

    const keywords: KeywordRecommendation[] = [];
    const lines = raw.split('\n');
    let inSection = false;

    for (const line of lines) {
      if (line.trim() === 'KEYWORDS_START') { inSection = true; continue; }
      if (line.trim() === 'KEYWORDS_END') break;
      if (!inSection) continue;

      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const match = trimmed.match(/^\d+\.\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(\d+)/);
      if (match) {
        keywords.push({
          keyword: match[1].trim(),
          source: match[2].trim().split(':')[1]?.trim() as any || 'category',
          intent: match[3].trim(),
          expectedInfluencerType: match[4].trim(),
          searchVolumeEstimate: match[5].trim(),
          targetCount: parseInt(match[6]),
        });
      }
    }

    return keywords;
  }

  async scoreInfluencerBatch(
    influencers: any[],
    productContext: ProductContext,
    weights: any
  ): Promise<any[]> {
    const allScores: any[] = [];

    for (let i = 0; i < influencers.length; i += 20) {
      const batch = influencers.slice(i, i + 20);
      const prompt = buildInfluencerScoringPrompt(batch, productContext, weights);

      const response = await client.chat.completions.create({
        model: this.model,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      });

      let raw = response.choices[0]?.message?.content || '';
      raw = stripThinkBlocks(raw);

      try {
        const scores = this.extractScoresFromResponse(raw);
        allScores.push(...scores);
      } catch (e) {
        // fallback: no scores for this batch
      }
    }

    return allScores;
  }

  private extractScoresFromResponse(raw: string): any[] {
    const scores: any[] = [];

    // Try to find JSON with "scores" array
    const scoresMatch = raw.match(/"scores"\s*:\s*\[([\s\S]*?)\]\s*\}/);
    if (scoresMatch) {
      try {
        const arrayContent = scoresMatch[1];
        const objects = this.splitScoreObjects(arrayContent);
        for (const obj of objects) {
          try {
            const parsed = JSON.parse('{' + obj + '}');
            if (parsed.unique_id && typeof parsed.overallScore === 'number') {
              scores.push(parsed);
            }
          } catch (e) {
            // skip invalid object
          }
        }
      } catch (e) {
        // fall through
      }
    }

    // Fallback: try direct JSON parse
    if (scores.length === 0) {
      try {
        const jsonMatch = raw.match(/\{[\s\S]*\}\s*$/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed.scores)) {
            scores.push(...parsed.scores);
          }
        }
      } catch (e) {
        // fall through
      }
    }

    return scores;
  }

  private splitScoreObjects(arrayContent: string): string[] {
    const objects: string[] = [];
    let depth = 0;
    let current = '';
    let inString = false;
    let escaped = false;

    for (let i = 0; i < arrayContent.length; i++) {
      const char = arrayContent[i];

      if (escaped) {
        current += char;
        escaped = false;
        continue;
      }

      if (char === '\\') {
        current += char;
        escaped = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        current += char;
        continue;
      }

      if (inString) {
        current += char;
        continue;
      }

      if (char === '{') {
        depth++;
        current += char;
      } else if (char === '}') {
        depth--;
        current += char;
        if (depth === 0) {
          objects.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }

    return objects;
  }

  async generateOutreachAdvice(
    productContext: ProductContext,
    scoredInfluencers: any[],
    stats: any
  ): Promise<any> {
    const prompt = buildOutreachAdvicePrompt(productContext, scoredInfluencers, stats);

    const response = await client.chat.completions.create({
      model: this.model,
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    let raw = response.choices[0]?.message?.content || '';
    raw = stripThinkBlocks(raw);

    return {
      priorityList: [],
      emailTemplate: raw,
      dmTemplate: 'DM template generation failed',
      timePlan: 'Time plan generation failed',
      riskNotes: 'Risk notes generation failed',
      dataInsights: [],
    };
  }
}