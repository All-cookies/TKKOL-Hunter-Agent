# 多维度博主评分与排序算法（Scoring Logic）

本文件定义了如何对采集到的博主进行多维度评分和智能排序。

---

## 概述

### 评分框架

每位博主的综合分由 4 个独立维度组成：

```
综合评分 = 内容相关度 × w1 + 粉丝匹配度 × w2 + 合作潜力 × w3 + 增长趋势 × w4

其中：
- 每个维度都是 0-100 的评分
- w1 + w2 + w3 + w4 = 1（权重总和为 1）
- 权重 w 会根据用户的优先级自动调整
```

### 三种优先级模式

根据用户的运营目标，自动切换权重：

| 优先级模式 | 场景 | 权重配置 |
|-----------|------|---------|
| **快速启动** | 想快速获得曝光和合作反馈 | w1=30% w2=20% w3=40% w4=10% |
| **转化优先** | 重点关注销售转化和品质 | w1=40% w2=35% w3=20% w4=5% |
| **品牌建设** | 长期品牌合作和调性契合 | w1=50% w2=30% w3=15% w4=5% |

---

## 维度 1：内容相关度（Content Relevance）

### 定义

博主的内容与目标产品的匹配程度。重点考察：
- 博主发布过多少次相同品类的内容
- 内容的专业深度
- 是否有相关的教程、测评、分享

### 评分标准

| 分数范围 | 定义 | 示例 |
|---------|------|------|
| **90-100** | 极高相关 | 护肤博主，过去 3 个月发布 10+ 个面膜相关视频；bio 明确写"skincare expert" |
| **75-89** | 高相关 | 美妆博主，发布过 5-10 个护肤内容，包括 2-3 个面膜测评 |
| **60-74** | 中等相关 | 综合美妆博主，偶尔发布护肤内容，但不专业或不定期 |
| **40-59** | 低相关 | 生活方式博主，极少涉及护肤话题，偶尔出现 |
| **0-39** | 基本无关 | 美食、娱乐等完全不相关领域 |

### 评分数据来源

```
数据来源优先级：
1. 博主最近 30 天的视频标题 + 描述（权重 40%）
2. Bio 中的关键词（权重 30%）
3. 账号名中的相关词汇（权重 20%）
4. 粉丝互动中的话题（权重 10%）
```

### AI 评分逻辑

```python
def score_content_relevance(influencer_data):
    # 关键词匹配
    keyword_matches = count_matching_keywords(
        influencer_data.recent_videos,
        product_category_keywords
    )
    
    # 垂直度（专业程度）
    relevance_ratio = keyword_matches / total_videos_in_30_days
    
    # 深度（是否有测评、教程等专业内容）
    has_reviews = check_for_reviews(influencer_data)
    has_tutorials = check_for_tutorials(influencer_data)
    
    # 综合评分
    if relevance_ratio > 50%:
        base_score = 85 + (relevance_ratio - 50%) * 30
    elif relevance_ratio > 20%:
        base_score = 60 + relevance_ratio * 25
    else:
        base_score = relevance_ratio * 50
    
    # 深度加分
    if has_reviews: base_score += 10
    if has_tutorials: base_score += 10
    
    return min(base_score, 100)
```

---

## 维度 2：粉丝匹配度（Audience Match）

### 定义

博主的粉丝是否与产品的目标用户群体重合。重点考察：
- 粉丝的年龄段和身份
- 粉丝的性别比例
- 粉丝的地理位置
- 粉丝的消费能力和偏好

### 评分标准

| 分数范围 | 定义 | 示例 |
|---------|------|------|
| **90-100** | 完美匹配 | 目标 25-40 岁都市女性，博主粉丝构成 95% 都是该人群 |
| **75-89** | 高匹配 | 目标人群占粉丝的 75-90%，偏差在可接受范围 |
| **60-74** | 中等匹配 | 目标人群占 50-75%，有一定偏差但仍可接受 |
| **40-59** | 低匹配 | 目标人群占 25-50%，需要评估转化潜力 |
| **0-39** | 不匹配 | 目标人群占 <25% 或完全不同群体 |

### 评分数据来源

```
优先级数据来源：
1. Bio 中对粉丝的描述（权重 35%）
   - "25-40 year old professionals"
   - "skincare enthusiasts"
   - "busy moms"
   
2. 互动评论的内容和语气（权重 30%）
   - 评论者的性别表现（用名字、emoji 等推测）
   - 评论的话题（工作、生活方式等）
   
3. 内容主题和风格（权重 20%）
   - 针对哪个人群的内容
   - 使用的语言和表现形式
   
4. 粉丝增长数据（权重 15%）
   - 持续增长表示吸引了稳定的目标人群
```

### AI 评分逻辑

```python
def score_audience_match(influencer_data, target_audience):
    # 从 bio 提取受众信息
    bio_audience = extract_audience_from_bio(influencer_data.bio)
    bio_match_score = calculate_demographic_match(bio_audience, target_audience)
    
    # 从评论推测粉丝特征
    comments_sample = influencer_data.recent_comments[:50]
    inferred_audience = infer_audience_from_comments(comments_sample)
    comment_match_score = calculate_demographic_match(inferred_audience, target_audience)
    
    # 内容主题匹配
    content_audience = infer_audience_from_content(influencer_data.recent_videos)
    content_match_score = calculate_demographic_match(content_audience, target_audience)
    
    # 加权综合
    match_score = (
        bio_match_score * 0.35 +
        comment_match_score * 0.30 +
        content_match_score * 0.20 +
        follower_growth_consistency(influencer_data) * 0.15
    )
    
    return min(match_score, 100)
```

---

## 维度 3：合作潜力（Collaboration Potential）

### 定义

博主是否容易联系、是否有合作意愿、是否能有效配合。重点考察：
- 是否有邮箱或其他联系方式
- Bio 中是否有合作信号
- 最近的活跃度
- 过往是否有合作案例

### 评分标准

| 分数范围 | 定义 | 示例 |
|---------|------|------|
| **90-100** | 最优合作 | 有邮箱、bio 明确 "open to collab"、最近每周发 5+ 视频、有品牌合作经历 |
| **75-89** | 高合作可能 | 有邮箱、有合作信号、活跃度中等、可能有合作经历 |
| **60-74** | 中等合作可能 | 有邮箱、无明确信号但活跃；或无邮箱但有合作信号 |
| **40-59** | 低合作可能 | 无邮箱、需要私信、活跃度一般；或无任何合作信号 |
| **0-39** | 难以合作 | 无任何联系方式、已停更或休眠账号 |

### 评分数据来源

```
优先级数据来源：
1. 邮箱有无（权重 35%）
   - 有邮箱：得分 +50-80（取决于邮箱位置：bio 直接写、落地页等）
   
2. 合作信号（权重 30%）
   - "open to collaboration"：+20 分
   - "brand partnerships"：+20 分
   - "inquiries"、"DM"：+10 分
   - 无明确信号：+0 分
   
3. 活跃度（权重 20%）
   - 周更新 ≥5 次：+20 分
   - 周更新 2-4 次：+10 分
   - 周更新 1 次或更少：-10 分
   
4. 合作历史（权重 15%）
   - Bio 中提及品牌合作：+15 分
   - 视频中有品牌植入迹象：+10 分
   - 无迹象：+0 分
```

### AI 评分逻辑

```python
def score_collaboration_potential(influencer_data):
    score = 50  # 基础分
    
    # 邮箱评分（权重 35%）
    if influencer_data.email:
        score += 40 * 0.35  # 有邮箱 +40 分
    elif has_contact_form(influencer_data):
        score += 20 * 0.35
    else:
        score -= 10 * 0.35  # 无邮箱 -10 分
    
    # 合作信号（权重 30%）
    collab_signals = count_collab_signals(influencer_data.bio)
    signal_score = min(collab_signals * 10, 30)
    score += signal_score * 0.30
    
    # 活跃度（权重 20%）
    posts_per_week = calculate_posting_frequency(influencer_data)
    if posts_per_week >= 5:
        activity_score = 20
    elif posts_per_week >= 2:
        activity_score = 10
    elif posts_per_week >= 1:
        activity_score = 0
    else:
        activity_score = -15
    score += activity_score * 0.20
    
    # 合作历史（权重 15%）
    history_score = detect_brand_collaborations(influencer_data)
    score += history_score * 0.15
    
    return min(max(score, 0), 100)
```

---

## 维度 4：增长趋势（Growth Momentum）

### 定义

博主账号的发展阶段和发展方向。重点考察：
- 粉丝增长速度
- 视频互动率趋势
- 账号是否处于上升期、稳定期或衰退期

### 评分标准

| 分数范围 | 定义 | 示例 |
|---------|------|------|
| **90-100** | 快速增长 | 月增 10%+，互动率 ≥5%，明显处于上升期 |
| **75-89** | 稳定增长 | 月增 3-10%，互动率 3-5%，持续成长 |
| **60-74** | 温和增长 | 月增 1-3%，互动率 1-3%，缓慢增长或维持 |
| **40-59** | 增长停滞 | 月增 <1% 或近期波动，互动率下降 |
| **0-39** | 衰退中 | 粉丝下降、内容更新停止、账号休眠迹象 |

### 评分数据来源

```
数据来源：
1. 粉丝增长率（权重 50%）
   - 计算最近 30 天或 90 天的增长百分比
   
2. 互动率趋势（权重 30%）
   - 平均每条视频的点赞 + 评论 / 粉丝数
   - 比较最近 7 天 vs 前 30 天的变化
   
3. 发布频率稳定性（权重 20%）
   - 最近是否有停更或明显的更新频率下降
```

### AI 评分逻辑

```python
def score_growth_momentum(influencer_data):
    # 粉丝增长率（50%）
    monthly_growth_rate = calculate_monthly_growth(influencer_data)
    if monthly_growth_rate >= 10:
        growth_score = 90 + min(monthly_growth_rate - 10, 10)
    elif monthly_growth_rate >= 3:
        growth_score = 70 + monthly_growth_rate * 6
    elif monthly_growth_rate >= 1:
        growth_score = 50 + monthly_growth_rate * 10
    elif monthly_growth_rate >= 0:
        growth_score = 30 + monthly_growth_rate * 20
    else:
        growth_score = max(0, 30 + monthly_growth_rate * 30)
    
    growth_score = min(growth_score, 100)
    
    # 互动率趋势（30%）
    engagement_rate = calculate_engagement_rate(influencer_data)
    engagement_trend = compare_recent_vs_previous(
        influencer_data,
        recent_days=7,
        previous_days=30
    )
    engagement_score = engagement_rate * 20 + engagement_trend * 10
    engagement_score = min(engagement_score, 100)
    
    # 发布稳定性（20%）
    update_frequency = calculate_posting_frequency(influencer_data)
    if update_frequency >= 3:  # 每周 3+ 次
        stability_score = 80
    elif update_frequency >= 1:
        stability_score = 60
    else:
        stability_score = 30
    
    # 加权综合
    final_score = (
        growth_score * 0.5 +
        engagement_score * 0.3 +
        stability_score * 0.2
    )
    
    return min(final_score, 100)
```

---

## 综合评分计算

### 公式

```
综合评分（总分）= 
  内容相关度 × 权重1 + 
  粉丝匹配度 × 权重2 + 
  合作潜力 × 权重3 + 
  增长趋势 × 权重4
```

### 三种权重模式

**模式 A：快速启动（Rapid Launch）**
- 目标：快速签约，获得曝光
- 权重：相关度 30% + 粉丝匹配 20% + 合作潜力 40% + 增长趋势 10%
- 适用：新产品上市、快速铺量

```
综合评分 = 相关度×0.3 + 粉丝×0.2 + 合作×0.4 + 增长×0.1
示例：85×0.3 + 80×0.2 + 95×0.4 + 70×0.1 = 85.5 分
```

**模式 B：转化优先（Conversion First）**
- 目标：最大化销售转化
- 权重：相关度 40% + 粉丝匹配 35% + 合作潜力 20% + 增长趋势 5%
- 适用：产品在市场开发阶段、需要实际销售

```
综合评分 = 相关度×0.4 + 粉丝×0.35 + 合作×0.2 + 增长×0.05
示例：90×0.4 + 88×0.35 + 75×0.2 + 60×0.05 = 84.9 分
```

**模式 C：品牌建设（Brand Building）**
- 目标：长期品牌形象和调性契合
- 权重：相关度 50% + 粉丝匹配 30% + 合作潜力 15% + 增长趋势 5%
- 适用：品牌方想做长期的 KOL 合作、建立代言人

```
综合评分 = 相关度×0.5 + 粉丝×0.3 + 合作×0.15 + 增长×0.05
示例：95×0.5 + 90×0.3 + 80×0.15 + 75×0.05 = 90.75 分
```

---

## 分层定义

基于综合评分，将博主分为 3 层：

| 层级 | 分数范围 | 特征 | 建议行动 |
|------|---------|------|---------|
| **A 级（优先建联）** | ≥80 | 各维度均衡优秀或某个维度特别强 | 立即联系，预期成功率 40-60% |
| **B 级（值得联系）** | 70-79 | 整体不错但有明显短板 | 第二梯队，预期成功率 20-30% |
| **C 级（备选观察）** | <70 | 有潜力但当前不够优秀 | 观察期，可定期复查 |

---

## 特殊场景调整

### 场景 1：小而精的微型 KOL

某些博主粉丝数少（<10K），但内容极度垂直、互动率高。

**调整规则：**
- 如果内容相关度 ≥95 且互动率 ≥10%，增加 5-10 分的补偿分
- 合作潜力如果有邮箱，也增加 5-10 分
- 这类 KOL 往往是最容易成功合作的

### 场景 2：大 V（粉丝 500K+）

大号通常有以下特点：
- 粉丝庞大但粉丝匹配度可能下降
- 合作费用高，但流量大

**调整规则：**
- 内容相关度和粉丝匹配度如果偏低，降分 10-15
- 合作潜力通常较高（有团队处理合作），加分 10
- 不自动倾向大号，而是看实际匹配度

### 场景 3：休眠账号（3 个月未更新）

**调整规则：**
- 增长趋势直接降至 0-20 分
- 合作潜力降 20 分（可能已不活跃）
- 即使其他维度好，综合分也受限

---

## 排序输出

### CSV 中的排序

```
排序 | 账号名 | 粉丝数 | 综合分 | 相关度 | 粉丝匹配 | 合作潜力 | 增长趋势 | 邮箱 | 层级
-----|--------|--------|--------|--------|---------|---------|---------|------|-----
1    | @sarah | 324K   | 90.5   | 92     | 88      | 95      | 78      | YES  | A
2    | @makeup| 187K   | 87.2   | 89     | 85      | 88      | 72      | YES  | A
3    | @girls | 95K    | 85.0   | 88     | 82      | 80      | 88      | NO   | A
...  |        |        |        |        |         |         |         |      |
50   | @alice | 45K    | 72.1   | 75     | 70      | 70      | 72      | YES  | B
```

### 分层统计

```
总采集博主数：174 位

A 级（≥80）：58 位（33%）
  └─ 其中有邮箱：38 位（65%）
  
B 级（70-79）：92 位（53%）
  └─ 其中有邮箱：51 位（55%）
  
C 级（<70）：24 位（14%）
  └─ 其中有邮箱：8 位（33%）
```

---

## 品类特殊调整

不同品类的红人评分标准可能有所不同：

### 美妆护肤类
- 内容相关度权重提升（博主专业度很重要）
- 粉丝匹配度权重正常
- 合作潜力同样重要

### 电子产品类
- 粉丝匹配度权重提升（需要科技爱好者粉丝）
- 增长趋势同样重要（产品趋势变化快）
- 内容深度（测评、拆箱等）特别重要

### 食品/快消类
- 合作潜力权重提升（这类 KOL 通常接受度高）
- 增长趋势权重提升（快消产品风口变化快）
- 粉丝匹配度可略降低（覆盖面更广）

---

## 计算示例

**产品背景：**
- 高端护肤面膜（$45）
- 目标：北美 25-40 岁职业女性
- 优先级：快速启动

**博主 A（@sarah_skincare）：**
- 内容相关度：92 分（专业护肤博主，近期发布 8 个面膜相关视频）
- 粉丝匹配度：88 分（粉丝主要是 25-35 岁职业女性，有医学背景粉丝）
- 合作潜力：95 分（有邮箱、bio 明确写"open to collaboration"、最近每周发 4+ 视频）
- 增长趋势：75 分（月增 2.5%，互动率稳定 4.2%）

**综合评分（快速启动权重）：**
```
= 92×0.3 + 88×0.2 + 95×0.4 + 75×0.1
= 27.6 + 17.6 + 38 + 7.5
= 90.7 分
```

**结论：A 级优先建联，首批联系名单**

---

## 监控和迭代

### 实际合作反馈

在完成几次合作后，收集实际数据：
- 哪个评分维度最能预测合作成功？
- 权重是否需要调整？
- 不同品类是否需要不同权重？

### 定期审视

- 每月更新一次增长趋势数据
- 发现权重调整机会并记录
- 对新品类的初期评分保持灵活性
