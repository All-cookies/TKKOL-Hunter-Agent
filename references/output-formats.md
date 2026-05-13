# 输出格式定义（Output Formats）

本文件定义最终输出的格式：CSV、HTML 报告、建议文档等。

---

## 输出文件清单

```
output/
├── kol-{brand}-{timestamp}.csv           # 建联名单（可直接导入 Excel）
├── kol-{brand}-{timestamp}.html          # 可视化报告（浏览器打开）
├── kol-{brand}-{timestamp}.meta.json     # 元数据（采集统计）
└── index.html                            # 采集中心首页（所有历史记录）
```

---

## 格式 1：CSV 建联名单

**文件名：** `kol-{brand}-{timestamp}.csv`

**编码：** UTF-8 with BOM（Excel 兼容）

**列定义：**

| 列名 | 数据类型 | 说明 | 示例 |
|------|---------|------|------|
| `rank` | int | 排序位置（从 1 开始） | 1 |
| `unique_id` | string | 博主账号名 | sarah_beauty_tips |
| `nickname` | string | 博主昵称 | Sarah Beauty Tips |
| `follower_count` | int | 粉丝数 | 324000 |
| `email` | string | 邮箱地址（如无则留空） | sarah@example.com |
| `bio` | string | 完整 Bio | Beauty tips \| Open to... |
| `bio_link` | string | 落地页链接 | https://linktr.ee/sarah |
| `overall_score` | float | 综合评分 | 90.5 |
| `content_relevance` | int | 内容相关度 | 92 |
| `audience_match` | int | 粉丝匹配度 | 88 |
| `collab_potential` | int | 合作潜力 | 95 |
| `growth_trend` | int | 增长趋势 | 75 |
| `tier` | string | 分层（A/B/C） | A |
| `keyword_source` | string | 来源关键词 | hydrating face mask |
| `max_play_count` | int | 最高视频播放量 | 45000 |
| `verified` | boolean | 是否认证 | true |

**CSV 示例：**
```csv
rank,unique_id,nickname,follower_count,email,bio,bio_link,overall_score,content_relevance,audience_match,collab_potential,growth_trend,tier,keyword_source,max_play_count,verified
1,sarah_beauty_tips,Sarah Beauty Tips,324000,sarah@example.com,"Beauty tips | Open to collab",https://linktr.ee/sarah,90.5,92,88,95,75,A,hydrating face mask tutorial,45000,true
2,makeup_expert,Makeup Expert,187000,,Makeup tutorials,https://example.com,87.2,89,85,88,72,A,hydrating face mask tutorial,32000,false
3,skincare_guru,Skincare Guru,156000,guru@skinmail.com,"Skincare education",https://link.bio/guru,85.0,88,82,80,88,A,hydrating face mask tutorial,28500,true
...
```

**生成规则：**
- 按 `overall_score` 降序排列
- 同分则按 `follower_count` 降序排列
- `email` 列为空的行不删除，而是保留（便于用户手动查找）
- `bio` 和 `bio_link` 列如果包含逗号或换行，用双引号包装

---

## 格式 2：HTML 可视化报告

**文件名：** `kol-{brand}-{timestamp}.html`

**特点：** 可直接在浏览器中打开、搜索、排序、筛选，无需特殊工具

### 页面结构

#### Section 1：采集摘要

```html
<section class="summary">
  <h2>采集摘要</h2>
  <div class="stats">
    <div class="stat-card">
      <div class="stat-label">总采集博主</div>
      <div class="stat-value">174</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">A 级（优先建联）</div>
      <div class="stat-value">58</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">有邮箱</div>
      <div class="stat-value">97 (55.7%)</div>
    </div>
  </div>
  
  <div class="keywords">
    <h3>搜索关键词</h3>
    <ul>
      <li>"hydrating face mask tutorial" — 96 位博主（平均分 80）</li>
      <li>"SK-II mask haul" — 34 位博主（平均分 88）</li>
      ...
    </ul>
  </div>
</section>
```

#### Section 2：Top 10 排序榜

```html
<section class="top10">
  <h2>Top 10 优先建联</h2>
  <div class="influencer-cards">
    <div class="card rank-1">
      <div class="rank-badge">1</div>
      <div class="avatar">
        <img src="https://avatar.url" alt="sarah_beauty_tips">
      </div>
      <div class="info">
        <h3>sarah_beauty_tips</h3>
        <p class="nickname">Sarah Beauty Tips</p>
        <div class="stats">
          <span class="followers">👥 324K</span>
          <span class="score">⭐ 90.5</span>
        </div>
        <div class="dimensions">
          <div class="dim">相关度: 92</div>
          <div class="dim">粉丝匹配: 88</div>
          <div class="dim">合作潜力: 95</div>
          <div class="dim">增长趋势: 75</div>
        </div>
        <div class="contact">
          <span class="email">✉️ sarah@example.com</span>
          <a href="https://tiktok.com/@sarah_beauty_tips" target="_blank">→ TikTok</a>
        </div>
      </div>
    </div>
    <!-- ... 更多卡片 ... -->
  </div>
</section>
```

#### Section 3：分层统计

```html
<section class="tier-stats">
  <h2>分层统计</h2>
  <div class="tier-chart">
    <div class="tier">
      <h3>A 级（≥80）</h3>
      <div class="progress" style="width: 33%">58</div>
      <p>33% | 预期成功率 40-60%</p>
    </div>
    <div class="tier">
      <h3>B 级（70-79）</h3>
      <div class="progress" style="width: 53%">92</div>
      <p>53% | 预期成功率 20-30%</p>
    </div>
    <div class="tier">
      <h3>C 级（<70）</h3>
      <div class="progress" style="width: 14%">24</div>
      <p>14% | 保留观察</p>
    </div>
  </div>
</section>
```

#### Section 4：完整列表（可搜索、可排序）

```html
<section class="full-list">
  <h2>完整博主列表</h2>
  
  <div class="search-bar">
    <input type="text" id="search" placeholder="搜索账号名、昵称...">
  </div>
  
  <div class="filter-bar">
    <label>
      <input type="checkbox" data-tier="A"> A 级
    </label>
    <label>
      <input type="checkbox" data-tier="B"> B 级
    </label>
    <label>
      <input type="checkbox" data-has-email="true"> 有邮箱
    </label>
  </div>
  
  <table id="influencer-table">
    <thead>
      <tr>
        <th>排序</th>
        <th>账号名</th>
        <th>昵称</th>
        <th>粉丝</th>
        <th>邮箱</th>
        <th>综合评分</th>
        <th>相关度</th>
        <th>粉丝匹配</th>
        <th>合作潜力</th>
        <th>增长趋势</th>
        <th>层级</th>
        <th>来源</th>
      </tr>
    </thead>
    <tbody>
      <tr class="tier-A">
        <td>1</td>
        <td><a href="https://tiktok.com/@sarah_beauty_tips">sarah_beauty_tips</a></td>
        <td>Sarah Beauty Tips</td>
        <td>324K</td>
        <td>✓</td>
        <td><strong>90.5</strong></td>
        <td>92</td>
        <td>88</td>
        <td>95</td>
        <td>75</td>
        <td><span class="badge-a">A</span></td>
        <td>hydrating...</td>
      </tr>
      <!-- ... 更多行 ... -->
    </tbody>
  </table>
</section>
```

### 样式和交互

**CSS 特点：**
- 响应式布局（适配手机、平板、桌面）
- 深色/浅色主题切换
- 评分用柱状图或饼图可视化
- Hover 效果展示详细信息

**JavaScript 功能：**
- 搜索：实时过滤账号名、昵称
- 排序：点击列头排序
- 筛选：按层级、邮箱有无、关键词来源筛选
- 导出：选中行后导出为 CSV

---

## 格式 3：元数据 JSON

**文件名：** `kol-{brand}-{timestamp}.meta.json`

**用途：** 用于 index.html 的汇总索引，记录每次采集的统计信息

```json
{
  "product": {
    "brand": "HydroGlow",
    "product_name": "Hydrating Face Mask",
    "category": "Skincare",
    "target_markets": ["US", "Canada"]
  },
  "collection": {
    "timestamp": "2025-05-12T10:30:00Z",
    "total_influencers": 174,
    "unique_influencers": 174,
    "with_email": 97,
    "email_rate": 0.557
  },
  "tiers": {
    "A": {"count": 58, "avg_score": 85.3},
    "B": {"count": 92, "avg_score": 74.2},
    "C": {"count": 24, "avg_score": 62.1}
  },
  "keywords": [
    {
      "keyword": "hydrating face mask tutorial",
      "source": "category",
      "count": 96,
      "avg_score": 80
    },
    {
      "keyword": "SK-II mask haul",
      "source": "competitor",
      "count": 34,
      "avg_score": 88
    }
  ],
  "files": {
    "csv": "kol-HydroGlow-20250512T103000Z.csv",
    "html": "kol-HydroGlow-20250512T103000Z.html",
    "json": "kol-HydroGlow-20250512T103000Z.meta.json"
  }
}
```

---

## 格式 4：采集中心首页（index.html）

**用途：** 汇总所有历史采集记录，支持快速查询和切换

### 页面结构

```html
<h1>KOL 采集中心</h1>

<div class="search-bar">
  <input type="text" placeholder="搜索产品名称...">
</div>

<table class="history-table">
  <thead>
    <tr>
      <th>产品</th>
      <th>品类</th>
      <th>采集时间</th>
      <th>总数</th>
      <th>A 级</th>
      <th>有邮箱</th>
      <th>操作</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>HydroGlow（Hydrating Mask）</td>
      <td>Skincare</td>
      <td>2025-05-12 10:30</td>
      <td>174</td>
      <td>58</td>
      <td>97 (55.7%)</td>
      <td>
        <a href="kol-HydroGlow-20250512T103000Z.html">📊 查看报告</a>
        <a href="kol-HydroGlow-20250512T103000Z.csv">📥 下载 CSV</a>
      </td>
    </tr>
    <tr>
      <td>TechPro（Wireless Earbuds）</td>
      <td>Electronics</td>
      <td>2025-05-10 14:20</td>
      <td>256</td>
      <td>89</td>
      <td>142 (55.5%)</td>
      <td>
        <a href="kol-TechPro-20250510T142000Z.html">📊 查看报告</a>
        <a href="kol-TechPro-20250510T142000Z.csv">📥 下载 CSV</a>
      </td>
    </tr>
  </tbody>
</table>
```

---

## 建联建议文档

**格式：** Markdown 文本文件

**文件名：** `kol-{brand}-{timestamp}-advice.md`

**结构：**

```markdown
# {产品} KOL 建联建议

生成时间：{timestamp}

## 📊 采集概览

| 指标 | 数值 |
|------|------|
| 总采集博主数 | 174 |
| A 级优先 | 58 (33%) |
| B 级备选 | 92 (53%) |
| C 级观察 | 24 (14%) |
| 有邮箱 | 97 (55.7%) |

## 🎯 建联计划

### 第一阶段：A 级邮件开发

**目标：** 12-15 位博主（有邮箱的 A 级）

**建议周期：** 第 1 周完成发送

**预期指标：**
- 邮件送达率：95%+
- 回复率：40-50%
- 合作意向率：30-40%

**推荐顺序：**
1. 综合分 ≥88 分
2. 合作潜力评分 ≥90 分
3. 内容相关度 ≥90 分

### 第二阶段：A 级私信跟进

**目标：** 20 位（无邮箱但有合作信号的 A 级）

**建议周期：** 第 3-5 天启动（等邮件反馈）

**预期指标：**
- 回复率：20-30%
- 需要多轮跟进才能转化

### 第三阶段：B 级启动

**触发条件：** A 级回复率 <50% 时启动

**目标：** 50-100 位 B 级博主

**预期指标：**
- 合作意向率：15-25%

## 💡 数据洞察

### 最高质量来源

**竞品词（最优）**
- 关键词：SK-II 相关词
- 贡献：34 位博主
- 平均分：88 分
- 建议：竞品词搜出的博主是最值得联系的，转化率最高

### 质量对比

| 搜索维度 | 博主数 | 平均分 | 建议 |
|---------|--------|--------|------|
| 竞品词 | 34 | 88 | 优先联系 |
| 品类词 | 96 | 80 | 体量大但需筛选 |
| 场景词 | 35 | 75 | 拓展用途 |
| 人群词 | 9 | 71 | 不推荐 |

### 粉丝数 vs 质量

- 粉丝 500K+：平均分 72（大号不一定最优）
- 粉丝 100-500K：平均分 79（最优区间）
- 粉丝 10-100K：平均分 76（质量参差）

**建议：** 不追求大号，而是追求 100K-500K 区间的垂直 KOL

## ⚠️ 风险提示

### 邮箱获取率较低

- 当前：55.7%
- 如需更多邮箱，建议：
  1. 扩大采集规模至 300+ 位
  2. 通过私信联系无邮箱的博主
  3. 访问博主落地页查询邮箱

### 私信渠道占比高

- 无邮箱的 A 级博主占 34%
- 建议准备高质量私信模板
- 预留充足的私信时间

## 📝 建议的邮件和私信文案

### 邮件标题

```
Collaboration Opportunity: HydroGlow Premium Face Mask
```

### 邮件正文模板

```
Hi {nickname},

I've been following your amazing skincare content and love how you 
test products thoroughly!

We're launching HydroGlow, a premium hydrating face mask designed for 
busy professionals like your audience. I think your followers would 
really benefit from your honest review.

We'd love to collaborate with you:
- Product: HydroGlow Mask (complimentary)
- Timeline: [specify]
- Fee: [offer]

Here's our media kit: [link to media kit]

Let me know if you're interested!

Best regards,
{Your Name}
{Company}
{Contact}
```

### 私信文案（简洁版）

```
Hey {nickname}! 👋

I really loved your recent hydrating skincare routine video! 

We just launched HydroGlow mask and think you'd love it. Interested 
in testing it out?

Here's more info: [media kit link]

DM me if you want to chat! 💬
```

## 📅 时间规划

| 阶段 | 时间 | 行动 |
|------|------|------|
| 第 1 周 | 第 1-2 天 | 准备邮件和媒体包 |
|  | 第 3-5 天 | 发送给 12-15 位 A 级博主 |
| 第 2 周 | 第 6-8 天 | 跟进邮件反馈 |
|  | 第 9-10 天 | 启动 A 级私信 |
| 第 3 周 | 第 15 天 | 评估转化率，决定是否启动 B 级 |

## 🔄 后续优化建议

1. **数据积累**：记录邮件反馈、合作成功率
2. **权重调整**：如果转化率不达预期，调整评分权重
3. **新关键词**：发现效果好的搜索维度后，扩大搜索量
4. **定期更新**：每月检查一次排序，刷新 A 级博主列表
```

---

## CSS 样式概览

### 颜色方案

```css
:root {
  --color-primary: #FF6B6B;        /* 品牌色 */
  --color-tier-a: #4CAF50;         /* A 级绿色 */
  --color-tier-b: #FFC107;         /* B 级黄色 */
  --color-tier-c: #9E9E9E;         /* C 级灰色 */
  --color-text: #333;
  --color-bg: #F5F5F5;
  --color-border: #DDD;
}
```

### 响应式断点

```css
/* Desktop */
@media (min-width: 1024px) { ... }

/* Tablet */
@media (min-width: 768px) and (max-width: 1023px) { ... }

/* Mobile */
@media (max-width: 767px) { ... }
```

---

## 生成脚本清单

生成这些输出文件的主要函数：

| 函数 | 输入 | 输出 |
|------|------|------|
| `export_to_csv()` | influencers list | CSV 文件 |
| `generate_html_report()` | influencers list + metadata | HTML 报告 |
| `generate_meta_json()` | influencers list + stats | meta.json |
| `generate_advice_doc()` | influencers list + stats | Markdown 建议 |
| `update_index_html()` | all meta.json files | index.html |
