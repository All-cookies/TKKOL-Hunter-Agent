# TikHub API 调用规范（API Specification）

本文件定义如何调用 TikHub API 来采集博主数据。包括接口选择、参数说明、响应解析、错误处理等。

---

## 核心接口

### 接口 A：视频搜索（推荐）

用于搜索包含特定关键词的视频，然后从视频的作者信息中提取博主。

**端点：**
```
GET https://api.tikhub.io/api/v1/tiktok/app/v3/fetch_general_search_result
```

**参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `search_type` | int | 是 | `1` = 视频搜索（推荐）、`2` = 音乐搜索、`3` = 用户搜索 |
| `keyword` | string | 是 | 搜索关键词（英文，由 intelligence-prompts 生成） |
| `count` | int | 否 | 返回的结果数（默认 20，最多 100） |
| `offset` | int | 否 | 分页偏移（用于翻页） |
| `api_key` | string | 是 | TikHub API Key |

**示例请求：**
```
https://api.tikhub.io/api/v1/tiktok/app/v3/fetch_general_search_result?
  search_type=1&
  keyword=hydrating+face+mask+tutorial&
  count=50&
  offset=0&
  api_key=YOUR_API_KEY
```

**响应结构（JSON）：**
```json
{
  "status_code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "aweme_info": {
          "aweme_id": "7123456789",
          "desc": "My amazing hydrating mask routine...",
          "statistics": {
            "play_count": 45000,
            "like_count": 3200,
            "comment_count": 180
          },
          "author": {
            "id": "123456789",
            "unique_id": "sarah_beauty_tips",
            "nickname": "Sarah Beauty Tips",
            "follower_count": 324000,
            "following_count": 1200,
            "video_count": 456,
            "heart_count": 12500000,
            "signature": "Beauty & skincare tips | Follower of sustainable beauty | DM for collabs"
          }
        }
      },
      // ... 更多视频结果
    ]
  }
}
```

**关键字段说明：**
- `aweme_id`：视频 ID
- `desc`：视频标题/描述
- `statistics.play_count`：视频播放量（重要：用于评分）
- `author.unique_id`：博主账号名（核心）
- `author.nickname`：博主昵称
- `author.follower_count`：粉丝数
- `author.signature`：博主 Bio（简版，可能不完整）

**为什么选视频搜索而不是用户搜索？**
- 用户搜索（search_type=3）按账号名匹配，结果充斥商家号、机构号、营销号
- 视频搜索模拟真实用户的搜索行为，找到的是"真正在做内容"的创作者
- 返回的 author 字段会包含视频播放量，可用于去重时保留最优视频

---

### 接口 B：用户完整资料（关键）

用于获取博主的完整信息，包括完整 Bio（signature）、邮箱、落地页等。

**端点：**
```
GET https://api.tikhub.io/api/v1/tiktok/web/fetch_user_profile
```

**参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `uniqueId` | string | 是 | 博主账号名（从接口 A 的 author.unique_id 获取） |
| `api_key` | string | 是 | TikHub API Key |

**示例请求：**
```
https://api.tikhub.io/api/v1/tiktok/web/fetch_user_profile?
  uniqueId=sarah_beauty_tips&
  api_key=YOUR_API_KEY
```

**响应结构（JSON）：**
```json
{
  "status_code": 0,
  "message": "success",
  "data": {
    "user": {
      "id": "123456789",
      "unique_id": "sarah_beauty_tips",
      "nickname": "Sarah Beauty Tips",
      "avatar": "https://...",
      "signature": "Beauty & skincare tips | Sustainable beauty advocate | Available for brand partnerships | Contact: sarah.beauty@example.com",
      "follower_count": 324000,
      "following_count": 1200,
      "video_count": 456,
      "heart_count": 12500000,
      "bio_link": {
        "title": "My Beauty Store",
        "link": "https://linktr.ee/sarah_beauty_tips"
      },
      "verified": true,
      "private": false
    }
  }
}
```

**关键字段说明：**
- `signature`：完整 Bio（比视频搜索返回的更完整，这是提取邮箱的主要来源）
- `bio_link.link`：博主的落地页链接（可能包含更多联系方式）
- `follower_count`：当前精确粉丝数
- `verified`：是否认证（可用于评分）

**缓存说明：**
- 该接口有 24h 缓存，如果脚本中断重跑，不会重复扣费
- 同一个 uniqueId 在 24h 内调用多次，只计费一次

---

## 数据采集流程

### Phase 1：视频搜索发现创作者

```
FOR EACH 关键词:
  LOOP offset = 0, 50, 100, 150, ... until no more results:
    1. 调用接口 A（视频搜索）
    2. 从 items[].aweme_info.author 提取博主信息
    3. 过滤：follower_count < 5000 的账号（通常是新号或商家号）
    4. 按 unique_id 全局去重，同一博主保留 play_count 最高的视频
    5. 保存到临时集合
```

**伪代码：**
```python
all_influencers = {}  # unique_id -> influencer_data

for keyword in keywords:
    offset = 0
    while True:
        response = fetch_general_search_result(
            search_type=1,
            keyword=keyword,
            count=50,
            offset=offset
        )
        
        if not response.data.items:
            break
        
        for item in response.data.items:
            author = item.aweme_info.author
            
            # 过滤：粉丝数最少 5000
            if author.follower_count < 5000:
                continue
            
            unique_id = author.unique_id
            play_count = item.aweme_info.statistics.play_count
            
            # 去重：同一博主保留播放量最高的视频
            if unique_id not in all_influencers or \
               play_count > all_influencers[unique_id]['max_play_count']:
                all_influencers[unique_id] = {
                    'unique_id': unique_id,
                    'nickname': author.nickname,
                    'follower_count': author.follower_count,
                    'max_play_count': play_count,
                    'keyword_source': keyword,
                    'video_id': item.aweme_info.aweme_id
                }
        
        offset += 50
        time.sleep(0.1)  # 限速：10 req/s = 100ms 间隔
```

---

### Phase 2：批量获取完整 Bio 和邮箱

```
FOR EACH 博主 in Phase 1 结果:
  1. 调用接口 B（用户完整资料）
  2. 提取完整 signature（Bio）
  3. 从 Bio 和 bioLink 提取邮箱
  4. 提取落地页链接
  5. 添加到最终数据集
```

**伪代码：**
```python
final_influencers = []

for unique_id in all_influencers:
    response = fetch_user_profile(uniqueId=unique_id)
    user = response.data.user
    
    # 提取邮箱
    email = extract_email_from_bio(user.signature)
    if not email and user.bio_link:
        email = extract_email_from_url(user.bio_link.link)
    
    # 组装最终数据
    influencer = {
        'unique_id': unique_id,
        'nickname': user.nickname,
        'follower_count': user.follower_count,
        'verified': user.verified,
        'bio': user.signature,
        'bio_link': user.bio_link.link if user.bio_link else None,
        'email': email,
        'keyword_source': all_influencers[unique_id]['keyword_source'],
        'max_play_count': all_influencers[unique_id]['max_play_count']
    }
    
    final_influencers.append(influencer)
    
    time.sleep(0.15)  # 限速：10 req/s = 100ms，为安全起见用 150ms
```

**邮箱提取正则表达式：**
```python
import re

def extract_email_from_bio(bio):
    """从 Bio 中提取邮箱地址"""
    pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
    matches = re.findall(pattern, bio)
    return matches[0] if matches else None

# 示例
bio = "Beauty tips | DM or email: contact@beautymail.com | Available for collab"
email = extract_email_from_bio(bio)
# 返回：'contact@beautymail.com'
```

---

## 错误处理

### API 限流（Rate Limiting）

```
状态码：429 Too Many Requests
```

**处理方案：**
```python
MAX_RETRIES = 3
RETRY_DELAY = 5  # 秒

for attempt in range(MAX_RETRIES):
    try:
        response = api_call()
        if response.status_code == 429:
            wait_time = RETRY_DELAY * (2 ** attempt)  # 指数退避
            print(f"限流，等待 {wait_time} 秒...")
            time.sleep(wait_time)
            continue
        break
    except Exception as e:
        print(f"Error: {e}")
```

### API 密钥失效

```
状态码：401 Unauthorized
```

**处理方案：**
- 检查 .env 文件中的 TIKHUB_API_KEY 是否正确
- 联系 TikHub 确认账户状态和配额

### 账号不存在

```
状态码：404 Not Found
message: "User not found"
```

**处理方案：**
- 跳过该 unique_id，继续下一个
- 记录日志以便后续审查

---

## 数据验证和质量控制

### 去重规则

| 规则 | 说明 |
|------|------|
| **按 unique_id 去重** | 同一博主多个关键词出现，只保留一条 |
| **保留最优记录** | 同一博主多个视频，保留 play_count 最高的 |
| **最小粉丝数过滤** | follower_count < 5000 的账号过滤掉 |

### 数据完整性检查

```python
def validate_influencer_record(inf):
    """检查采集的数据是否完整"""
    required_fields = ['unique_id', 'follower_count', 'bio']
    
    for field in required_fields:
        if field not in inf or not inf[field]:
            return False
    
    return True
```

### 邮箱质量验证

```python
def is_valid_email(email):
    """简单的邮箱格式验证"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def filter_spam_emails(email):
    """排除常见的垃圾邮箱"""
    spam_domains = ['test@', 'demo@', 'example@']
    for spam in spam_domains:
        if email.startswith(spam):
            return False
    return True
```

---

## 采集脚本配置

### 环境变量设置

**文件：`.env`**
```bash
TIKHUB_API_KEY=your_api_key_here
TIKHUB_BASE_URL=https://api.tikhub.io
```

### 关键词配置

**文件：`keywords.json`**
```json
{
  "keywords": [
    {
      "keyword": "hydrating face mask tutorial",
      "source": "category",
      "target_count": 100
    },
    {
      "keyword": "SK-II mask",
      "source": "competitor",
      "target_count": 50
    },
    {
      "keyword": "5-minute skincare routine",
      "source": "scene",
      "target_count": 80
    }
  ]
}
```

---

## 输出格式

### CSV 导出格式

**文件：`output/kol-{brand}-{timestamp}.csv`**

| 排序 | 账号名 | 粉丝数 | 邮箱 | Bio | 来源关键词 | 最高播放量 |
|------|--------|--------|------|-----|---------|---------|
| 1 | sarah_beauty_tips | 324000 | sarah@example.com | Beauty tips... | hydrating face... | 45000 |
| 2 | makeup_expert | 187000 | no-email | Makeup tutorials... | hydrating face... | 32000 |

### JSON 导出格式

**用于后续的评分和排序**

```json
{
  "metadata": {
    "product": "HydroGlow Mask",
    "timestamp": "2025-05-12T10:30:00Z",
    "total_count": 174,
    "keywords_searched": 5
  },
  "influencers": [
    {
      "unique_id": "sarah_beauty_tips",
      "nickname": "Sarah Beauty Tips",
      "follower_count": 324000,
      "email": "sarah@example.com",
      "bio": "Beauty tips...",
      "bio_link": "https://linktr.ee/sarah",
      "verified": true,
      "keyword_source": "hydrating face mask tutorial",
      "max_play_count": 45000,
      "data_collection_timestamp": "2025-05-12T10:30:00Z"
    }
  ]
}
```

---

## 采集成本估算

### API 配额消耗

| 操作 | 消耗的请求数 | 说明 |
|------|-----------|------|
| 视频搜索（search_type=1） | 每个关键词 × 分页数 | 平均 2-5 页 = 2-5 次请求 |
| 用户完整资料 | 每个博主 × 1 | 同一博主 24h 内缓存 |

### 示例

采集 5 个关键词、目标 400 位博主：
- 视频搜索：5 个关键词 × 3 页平均 = 15 次请求
- 用户完整资料：400 位博主 × 1 = 400 次请求
- **总计：约 415 次请求**

按 TikHub 的标准配额，这通常是可接受的成本。

---

## 调试建议

### 本地测试

```bash
# 测试单个关键词
curl "https://api.tikhub.io/api/v1/tiktok/app/v3/fetch_general_search_result?search_type=1&keyword=skincare&count=10&api_key=YOUR_KEY"

# 测试用户资料
curl "https://api.tikhub.io/api/v1/tiktok/web/fetch_user_profile?uniqueId=sarah_beauty_tips&api_key=YOUR_KEY"
```

### 日志输出

在采集脚本中打印详细日志：
```python
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

logger.info(f"Searching keyword: {keyword}")
logger.info(f"Found {len(results)} influencers")
logger.info(f"Email extraction rate: {email_count}/{total_count}")
```

---

## 最佳实践

1. **限速**：保持 ~100-150ms 的请求间隔（对应 10 req/s）
2. **缓存**：同一 uniqueId 在 24h 内不重复请求
3. **日志**：记录每个请求和错误，便于审计
4. **分批处理**：关键词分批而不是全部并发
5. **异常处理**：完善 try-catch，不要因一个请求失败而中断整个流程
