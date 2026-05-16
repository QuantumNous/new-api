# 分组管理增强 — 技术方案

## 需求范围

| # | 需求 | 状态 |
|---|------|------|
| 1 | 展示顺序 + 拖动排序 | 做 |
| 2 | 分组别名（多别名→同一分组，可设独立倍率） | 做 |
| 3 | 分类（预设 + 手动输入） | 做 |
| 4 | 组合线路 | 暂不做 |

现有 `AutoGroups`、`GroupGroupRatio`、`GroupSpecialUsableGroup` 保持 options 存储不变。

---

## 数据模型

### 表: `groups`

```go
type Group struct {
    Id             uint    `json:"id" gorm:"primaryKey;autoIncrement"`
    Name           string  `json:"name" gorm:"type:varchar(64);uniqueIndex;not null"`
    Ratio          float64 `json:"ratio" gorm:"default:1"`
    SortOrder      int     `json:"sort_order" gorm:"default:0"`
    Category       string  `json:"category" gorm:"type:varchar(64);default:''"`
    UserSelectable bool    `json:"user_selectable" gorm:"default:false"`
    Description    string  `json:"description" gorm:"type:text"`
    CreatedAt      int64   `json:"created_at" gorm:"bigint;autoCreateTime"`
    UpdatedAt      int64   `json:"updated_at" gorm:"bigint;autoUpdateTime"`
}
```

### 表: `group_aliases`

```go
type GroupAlias struct {
    Id            uint     `json:"id" gorm:"primaryKey;autoIncrement"`
    Alias         string   `json:"alias" gorm:"type:varchar(64);uniqueIndex;not null"`
    TargetGroup   string   `json:"target_group" gorm:"type:varchar(64);not null;index"`
    RatioOverride *float64 `json:"ratio_override"`
    CreatedAt     int64    `json:"created_at" gorm:"bigint;autoCreateTime"`
    UpdatedAt     int64    `json:"updated_at" gorm:"bigint;autoUpdateTime"`
}
```

---

## Redis 缓存层

### Key 设计

| Key | 类型 | 内容 | TTL |
|-----|------|------|-----|
| `group:ratio:{name}` | STRING | float64 倍率值 | 不过期，变更时主动删除 |
| `group:all` | HASH | field=name, value=JSON(Group) | 不过期，变更时主动删除 |
| `group:usable` | HASH | field=name, value=description | 不过期，变更时主动删除 |
| `group:alias:{alias}` | STRING | JSON `{"target":"xxx","ratio":0.5}` | 不过期，变更时主动删除 |
| `group:alias:all` | HASH | field=alias, value=JSON | 不过期，变更时主动删除 |

### 读取逻辑（热路径）

```go
func GetGroupRatio(name string) (float64, bool) {
    // 1. 读 Redis
    val, err := redis.Get("group:ratio:" + name)
    if err == nil {
        return parseFloat(val), true
    }
    // 2. Redis miss → 读 DB
    group, err := GetGroupByName(name)
    if err != nil {
        return 0, false // 分组不存在
    }
    // 3. 回写 Redis
    redis.Set("group:ratio:"+name, group.Ratio)
    return group.Ratio, true
}

func ResolveAlias(alias string) (*AliasResolved, bool) {
    // 1. 读 Redis
    val, err := redis.Get("group:alias:" + alias)
    if err == nil {
        return parseAliasJSON(val), true
    }
    // 2. Redis miss → 读 DB
    record, err := GetGroupAliasByAlias(alias)
    if err != nil {
        return nil, false // 别名不存在
    }
    // 3. 回写 Redis
    redis.Set("group:alias:"+alias, marshalAlias(record))
    return &AliasResolved{
        TargetGroup:   record.TargetGroup,
        RatioOverride: record.RatioOverride,
    }, true
}

func ContainsGroupRatio(name string) bool {
    _, ok := GetGroupRatio(name)
    return ok
}
```

### 缓存失效

管理员增删改分组/别名时，主动删除相关 Redis key：

```go
func InvalidateGroupCache(name string) {
    redis.Del("group:ratio:" + name)
    redis.Del("group:all")
    redis.Del("group:usable")
}

func InvalidateAllGroupCache() {
    keys, _ := redis.Keys("group:ratio:*")
    if len(keys) > 0 {
        redis.Del(keys...)
    }
    redis.Del("group:all")
    redis.Del("group:usable")
}

func InvalidateAliasCache(alias string) {
    redis.Del("group:alias:" + alias)
    redis.Del("group:alias:all")
}
```

### Redis 不可用时的降级

Redis 读取失败 → 直接查 DB。不缓存到本地内存，保持单一数据源语义。

---

## 别名解析（热路径）

改造位置：`middleware/auth.go:391`

```go
// 改造后
if !ratio_setting.ContainsGroupRatio(tokenGroup) {
    if tokenGroup == "auto" {
        // auto 走原有逻辑
    } else if resolved, ok := alias.Resolve(tokenGroup); ok {
        tokenGroup = resolved.TargetGroup
        if resolved.RatioOverride != nil {
            common.SetContextKey(c, constant.ContextKeyAliasRatioOverride, *resolved.RatioOverride)
        }
    } else {
        abortWithOpenAiMessage(c, http.StatusForbidden, "分组已被弃用")
        return
    }
}
```

计费时：`service/group.go:GetUserGroupRatio` 优先检查 context 中的 alias ratio override：

```go
func GetUserGroupRatio(userId int, userGroup, group string) float64 {
    // 优先：别名独立倍率（从 context 传入）
    // 其次：用户级别覆盖
    if ratio, ok := ratio_setting.GetUserGroupRatioOverride(userId, group); ok {
        return ratio
    }
    // 再次：分组特殊倍率
    ratio, ok := ratio_setting.GetGroupGroupRatio(userGroup, group)
    if ok {
        return ratio
    }
    // 最后：分组基础倍率
    r, _ := ratio_setting.GetGroupRatio(group)
    return r
}
```

注：alias ratio override 在 `GetUserGroupRatio` 之前由调用方从 context 取出，若存在则直接使用，不再走后续逻辑。

---

## API 设计

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/group/` | 获取所有分组（按 sort_order 排序） |
| POST | `/api/group/` | 创建分组 |
| PUT | `/api/group/:id` | 更新分组 |
| DELETE | `/api/group/:id` | 删除分组 |
| PUT | `/api/group/sort` | 批量更新排序 `[{id, sort_order}]` |
| GET | `/api/group/categories` | 获取所有已用分类（去重） |
| GET | `/api/group_alias/` | 获取所有别名 |
| POST | `/api/group_alias/` | 创建别名 |
| PUT | `/api/group_alias/:id` | 更新别名 |
| DELETE | `/api/group_alias/:id` | 删除别名 |

---

## 前端改造

| 区域 | 改动 |
|------|------|
| GroupTable | 新增拖拽排序（`@dnd-kit/sortable`）、新增 category 列（Select + allowCreate，预设：`OpenAI / Claude / Google / 国产 / 图片 / 其他`） |
| 新增 AliasManager 组件 | 别名 CRUD（alias 输入、target_group 下拉、ratio_override 可选输入） |
| 分类筛选 | 表格上方按 category 过滤/折叠展示 |

---

## 上线方案（0 停机）

### 前提

- 双容器发布（Nginx 负载 A/B），发布过程中不编辑分组设置
- Redis 为共享实例（A、B 容器连同一个 Redis）

### 发布流程

```
T0  构建新镜像，部署到 B 容器
T1  B 启动：
    ├─ GORM AutoMigrate 创建 groups / group_aliases 表
    ├─ 检查 groups 表是否为空
    ├─ 为空 → 从 options 读取 GroupRatio + UserUsableGroups → 写入 groups 表
    ├─ 预热：从 groups 表加载数据写入 Redis
    └─ 健康检查通过
T2  Nginx 切流量到 B（A 仍运行旧代码，读 options + 内存 map，不受影响）
T3  确认 B 正常后，更新 A 为新镜像
T4  A 启动，检测 groups 表已有数据，跳过迁移，从 Redis 读取
```

### 回退方案

| 场景 | 操作 |
|------|------|
| B 启动失败 | Nginx 不切，A 继续服务，无影响 |
| B 服务异常 | Nginx 切回 A，A 读 options + 内存 map（数据未变，完全一致） |

### 注意事项

- B 写入 Redis 的 group 缓存 key 不影响 A（A 旧代码不读这些 key）
- 回退后 Redis 中残留的 group key 无害，下次部署新代码时会覆盖

### 迁移逻辑

```go
func MigrateGroupsFromOptions() {
    var count int64
    DB.Model(&Group{}).Count(&count)
    if count > 0 {
        return // 已迁移，跳过
    }

    ratioMap := parseJSON(GetOption("GroupRatio"))
    usableMap := parseJSON(GetOption("UserUsableGroups"))

    sortOrder := 0
    for name, ratio := range ratioMap {
        _, selectable := usableMap[name]
        group := Group{
            Name:           name,
            Ratio:          ratio,
            SortOrder:      sortOrder,
            Category:       "",
            UserSelectable: selectable,
            Description:    usableMap[name],
        }
        DB.Create(&group)
        sortOrder++
    }
}

func WarmUpGroupCache() {
    groups, _ := GetAllGroups()
    for _, g := range groups {
        redis.Set("group:ratio:"+g.Name, g.Ratio)
    }
    usableMap := buildUsableMap(groups)
    redis.HMSet("group:usable", usableMap)
    allMap := buildAllMap(groups)
    redis.HMSet("group:all", allMap)
}
```

---

## 时间估算

| 阶段 | 内容 | 预计 |
|------|------|------|
| 后端 Model + Migration | 表定义、AutoMigrate、迁移逻辑 | 2h |
| 后端 Redis 缓存层 | 读写封装、失效逻辑、预热 | 2h |
| 后端 CRUD API | 分组 + 别名的增删改查、排序接口 | 3h |
| 后端 热路径改造 | auth 别名解析、计费倍率适配 | 2h |
| 前端 GroupTable 改造 | 拖拽排序 + category 列 | 3h |
| 前端 AliasManager | 别名管理组件 | 2h |
| 测试 | 单元测试 + 手动验证 | 3h |
| **合计** | | **~17h** |
