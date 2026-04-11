# Skills 技能管理模块

## 概述

Skills 模块提供了技能元数据的管理功能，包括 CRUD 操作、搜索、标签过滤和文件下载服务。

## 数据结构

### Skill 技能元数据

```json
{
  "id": 101,
  "slug": "skill-creator",
  "title": "技能开发助手",
  "description": "创建、编辑、改进或审核智能体技能。适用于从零开始创建新技能。",
  "avatar_url": null,
  "category_id": 5,
  "category_avatar_url": "",
  "version": "1.0.0",
  "actual_url": "https://omnirouter.xxx.com/skills/downloads/skill-creator.zip",
  "tag": "效率工具",
  "downloads": 0,
  "stars": 313611,
  "core_features": [
    {
      "title": "技能架构设计",
      "description": "提供清晰的结构与组织原则，让开发更有条理"
    }
  ],
  "use_cases": [
    "技能设计：告诉我你想要完成的任务，我会帮你生成技能和脚本"
  ],
  "is_active": true,
  "created_at": "2026-03-15T15:03:20Z",
  "updated_at": "2026-03-15T15:03:20Z"
}
```

## API 接口

### 公开接口（无需认证）

#### 获取技能列表
```
GET /api/skill/
```

**查询参数：**
- `p`: 页码（默认 1）
- `page_size`: 每页数量（默认 10）
- `tag`: 标签过滤（可选）

**响应示例：**
```json
{
  "success": true,
  "message": "",
  "data": {
    "page": 1,
    "page_size": 10,
    "total": 100,
    "items": [...]
  }
}
```

#### 搜索技能
```
GET /api/skill/search?keyword=xxx
```

**查询参数：**
- `keyword`: 搜索关键词（在标题、描述、标签中搜索）
- `p`: 页码
- `page_size`: 每页数量

#### 获取所有标签
```
GET /api/skill/tags
```

**响应示例：**
```json
{
  "success": true,
  "message": "",
  "data": {
    "tags": ["效率工具", "开发工具", "数据分析"]
  }
}
```

#### 获取技能详情
```
GET /api/skill/:id
```

#### 下载技能
```
GET /api/skill/download/:id
```

**响应示例：**
```json
{
  "success": true,
  "download_url": "https://xxx/skills/downloads/skill-creator.zip",
  "skill": {...}
}
```

### 管理接口（需要管理员权限）

#### 创建技能
```
POST /api/skill/
```

**请求体：**
```json
{
  "slug": "skill-creator",
  "title": "技能开发助手",
  "description": "创建、编辑、改进或审核智能体技能",
  "tag": "效率工具",
  "actual_url": "https://xxx/skills/downloads/skill-creator.zip",
  "core_features": [
    {
      "title": "技能架构设计",
      "description": "提供清晰的结构与组织原则"
    }
  ],
  "use_cases": ["技能设计：..."],
  "is_active": true
}
```

#### 更新技能
```
PUT /api/skill/:id
```

#### 删除技能
```
DELETE /api/skill/:id
```

## 文件下载服务

技能文件存放在 `skills/downloads/` 目录下，通过以下路径访问：

```
GET /skills/downloads/{filename}
```

例如，`skills/downloads/skill-creator.zip` 文件可通过以下 URL 访问：

```
http://localhost:3000/skills/downloads/skill-creator.zip
```

## 数据库表结构

```sql
CREATE TABLE skills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug VARCHAR(128) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  avatar_url VARCHAR(512),
  category_id INTEGER DEFAULT 0,
  category_avatar_url VARCHAR(512) DEFAULT '',
  version VARCHAR(32) DEFAULT '1.0.0',
  actual_url VARCHAR(512),
  tag VARCHAR(128),
  downloads INTEGER DEFAULT 0,
  stars INTEGER DEFAULT 0,
  core_features TEXT,  -- JSON 格式
  use_cases TEXT,      -- JSON 格式
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME,
  updated_at DATETIME,
  deleted_at DATETIME
);

CREATE INDEX idx_skills_tag ON skills(tag);
CREATE INDEX idx_skills_deleted_at ON skills(deleted_at);
```

## 使用示例

### 创建技能

```bash
curl -X POST http://localhost:3000/api/skill/ \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "skill-creator",
    "title": "技能开发助手",
    "description": "创建、编辑、改进或审核智能体技能",
    "tag": "效率工具",
    "actual_url": "http://localhost:3000/skills/downloads/skill-creator.zip",
    "core_features": [
      {
        "title": "技能架构设计",
        "description": "提供清晰的结构与组织原则"
      }
    ],
    "use_cases": ["技能设计：告诉我你想要完成的任务"],
    "is_active": true
  }'
```

### 查询技能列表

```bash
# 获取所有技能
curl http://localhost:3000/api/skill/

# 按标签过滤
curl http://localhost:3000/api/skill/?tag=效率工具

# 分页查询
curl http://localhost:3000/api/skill/?p=2&page_size=20
```

### 搜索技能

```bash
curl "http://localhost:3000/api/skill/search?keyword=开发"
```

## 注意事项

1. **文件上传**：当前版本不包含文件上传功能，需要手动将 `.zip` 文件放到 `skills/downloads/` 目录
2. **权限控制**：创建、更新、删除操作需要管理员权限
3. **软删除**：删除操作为软删除，数据仍保留在数据库中
4. **下载计数**：每次下载会自动增加 `downloads` 字段的计数
