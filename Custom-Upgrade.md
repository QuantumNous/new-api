# 自定义二次开发修改记录

本文档记录了对 new-api 项目的自定义修改，以便在同步官方更新后能够快速恢复这些修改。

---

## 修改 1：用户组限制功能（并发数、RPM、RPD、TPM、TPD）

### 功能描述
为不同的用户组设置不同的限制：
- **并发数（Concurrency）**：同时进行的请求数限制
- **RPM（Requests Per Minute）**：每分钟请求数限制
- **RPD（Requests Per Day）**：每日请求数限制
- **TPM（Tokens Per Minute）**：每分钟令牌数限制
- **TPD（Tokens Per Day）**：每日令牌数限制

按照"并发数、RPM、RPD、TPM、TPD"的顺序展示。值为 0 表示不限制。

### 新增文件

#### 1. `setting/group_limit.go`（新建文件）
用户组限制配置管理。

**关键结构体和函数**：
```go
// GroupLimitEnabled 是否启用用户组限制功能
var GroupLimitEnabled = false

// GroupLimitConfig 用户组限制配置
type GroupLimitConfig struct {
	Concurrency int   `json:"concurrency"` // 并发数限制，0 表示不限制
	RPM         int   `json:"rpm"`         // 每分钟请求数限制，0 表示不限制
	RPD         int   `json:"rpd"`         // 每日请求数限制，0 表示不限制
	TPM         int64 `json:"tpm"`         // 每分钟令牌数限制，0 表示不限制
	TPD         int64 `json:"tpd"`         // 每日令牌数限制，0 表示不限制
}

// 主要函数
func GetGroupLimitConfig(group string) GroupLimitConfig
func SetGroupLimitConfig(group string, config GroupLimitConfig)
func GetAllGroupLimitConfigs() map[string]GroupLimitConfig
func GroupLimitConfigs2JSONString() string
func UpdateGroupLimitConfigsByJSONString(jsonStr string) error
func ValidateGroupLimitConfigsJSON(jsonStr string) error
```

#### 2. `common/group_limiter.go`（新建文件）
限流器实现，支持内存和 Redis 两种模式。

**主要接口**：
```go
// GroupLimiter 用户组限流器接口
type GroupLimiter interface {
	CheckConcurrency(userID int, limit int) (allowed bool, err error)
	ReleaseConcurrency(userID int) error
	CheckRPM(userID int, limit int) (allowed bool, err error)
	CheckRPD(userID int, limit int) (allowed bool, err error)
	CheckTPM(userID int, limit int64, tokens int64) (allowed bool, err error)
	CheckTPD(userID int, limit int64, tokens int64) (allowed bool, err error)
	RecordTokens(userID int, tokens int64) error
	RecordRPD(userID int) error
	RecordTPD(userID int, tokens int64) error
	GetCurrentConcurrency(userID int) (int, error)
}

// 获取限流器（自动选择内存或Redis）
func GetGroupLimiter() GroupLimiter
```

**包含两个实现**：
- `MemoryGroupLimiter` - 基于内存的限流器（单机部署）
- `RedisGroupLimiter` - 基于 Redis 的限流器（分布式部署）

#### 3. `middleware/group-limit.go`（新建文件）
用户组限制中间件。

**主要函数**：
```go
// GroupLimit 用户组限制中间件（检查并发数、RPM）
func GroupLimit() gin.HandlerFunc

// RecordGroupLimitTokens 记录使用的令牌数（在请求完成后调用）
func RecordGroupLimitTokens(c *gin.Context, tokens int64)

// CheckGroupLimitTPM 检查 TPM 限制
func CheckGroupLimitTPM(c *gin.Context, estimatedTokens int64) bool

// CheckGroupLimitTPD 检查 TPD 限制
func CheckGroupLimitTPD(c *gin.Context, estimatedTokens int64) bool
```

### 修改文件

#### 4. 路由注册（需要在 relay 路由中添加中间件）
在 API 路由中添加 `middleware.GroupLimit()` 中间件。

#### 5. relay 处理完成后调用记录函数
在请求完成后调用 `middleware.RecordGroupLimitTokens(c, totalTokens)` 记录令牌使用量。

---

## 修改 2：数据看板展示用户限制信息

### 功能描述
在前端数据看板（console）页面的"下午好"问候语下方增加展示项，展示用户等级（group）、并发数（concurrency）、TPM、RPM、TPD。若值为0则显示"无限制"。

### 修改文件

#### 1. `controller/user.go` - GetSelf 函数
在 `GetSelf` 函数中添加用户组限制信息到响应数据。

**添加的代码**（在 `responseData` 定义之前）：
```go
// 获取用户组的限制配置
var groupLimits map[string]interface{}
if setting.GroupLimitEnabled {
    groupLimitConfig := setting.GetGroupLimitConfig(user.Group)
    groupLimits = map[string]interface{}{
        "enabled":     true,
        "concurrency": groupLimitConfig.Concurrency,
        "tpm":         groupLimitConfig.TPM,
        "rpm":         groupLimitConfig.RPM,
        "tpd":         groupLimitConfig.TPD,
    }
} else {
    groupLimits = map[string]interface{}{
        "enabled": false,
    }
}
```

**在 `responseData` 中添加**：
```go
responseData := map[string]interface{}{
    // ... 其他已有字段 ...
    "group_limits":      groupLimits,                // 新增用户组限制信息
}
```

#### 2. `web/src/components/dashboard/DashboardHeader.jsx`
完整重写组件，添加限制信息展示。

**完整代码**：
```jsx
import React from 'react';
import { Button, Tag, Tooltip } from '@douyinfe/semi-ui';
import { RefreshCw, Search, Users, Zap, Clock, Activity, Calendar } from 'lucide-react';

// 格式化限制值的辅助函数
const formatLimitValue = (value, t) => {
  if (value === 0 || value === undefined || value === null) {
    return t('无限制');
  }
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toString();
};

const DashboardHeader = ({
  getGreeting,
  greetingVisible,
  showSearchModal,
  refresh,
  loading,
  t,
  userGroup,
  groupLimits,
}) => {
  const ICON_BUTTON_CLASS = 'text-white hover:bg-opacity-80 !rounded-full';

  // 检查是否启用了用户组限制功能
const isGroupLimitEnabled = groupLimits?.enabled === true;

// 限制项配置（仅在启用时使用）
const limitItems = isGroupLimitEnabled ? [
    { key: 'group', label: t('用户组'), value: userGroup || 'default', icon: <Users size={14} />, color: 'blue', isGroup: true },
    { key: 'concurrency', label: t('并发数'), value: groupLimits?.concurrency, icon: <Zap size={14} />, color: 'green', tooltip: t('同时进行的请求数限制') },
    { key: 'rpm', label: 'RPM', value: groupLimits?.rpm, icon: <Activity size={14} />, color: 'orange', tooltip: t('每分钟请求数限制') },
    { key: 'tpm', label: 'TPM', value: groupLimits?.tpm, icon: <Clock size={14} />, color: 'purple', tooltip: t('每分钟令牌数限制') },
    { key: 'tpd', label: 'TPD', value: groupLimits?.tpd, icon: <Calendar size={14} />, color: 'cyan', tooltip: t('每日令牌数限制') },
  ] : [];

  return (
    <div className='mb-4'>
      <div className='flex items-center justify-between mb-3'>
        <h2 className='text-2xl font-semibold' style={{ opacity: greetingVisible ? 1 : 0 }}>
          {getGreeting}
        </h2>
        <div className='flex gap-3'>
          <Button type='tertiary' icon={<Search size={16} />} onClick={showSearchModal} />
          <Button type='tertiary' icon={<RefreshCw size={16} />} onClick={refresh} loading={loading} />
        </div>
      </div>
      {/* 用户限制信息行 - 仅在启用时显示 */}
      {isGroupLimitEnabled && limitItems.length > 0 && (
        <div className='flex flex-wrap items-center gap-3' style={{ opacity: greetingVisible ? 1 : 0 }}>
          {limitItems.map((item) => (
            <Tooltip key={item.key} content={item.tooltip || item.label} position='bottom'>
              <Tag color={item.color} size='default' shape='circle' className='flex items-center gap-1.5 cursor-default px-3 py-1'>
                {item.icon}
                <span className='font-medium'>{item.label}:</span>
                <span>{item.isGroup ? item.value : formatLimitValue(item.value, t)}</span>
              </Tag>
            </Tooltip>
          ))}
        </div>
      )}
    </div>
  );
};

export default DashboardHeader;
```

#### 3. `web/src/components/dashboard/index.jsx`
修改 DashboardHeader 调用，传递 userGroup 和 groupLimits 属性。

**新增的属性**：
```jsx
<DashboardHeader
  // ... 其他已有属性 ...
  userGroup={userState?.user?.group}
  groupLimits={userState?.user?.group_limits}
/>
```

---

## 修改 3：分组描述由分组倍率控制

### 功能描述
将分组描述的数据来源从"用户可选分组"设置改为"分组倍率"设置，使分组介绍能够在分组倍率配置中统一管理。

### 修改文件

#### 1. `setting/ratio_setting/group_ratio.go`
添加分组描述变量和相关函数。

**添加位置**：在 `var groupRatioMutex sync.RWMutex` 之后

**添加的代码**：
```go
// 分组描述，与分组倍率关联
var groupDescription = map[string]string{
	"default": "默认分组",
	"vip":     "VIP分组",
	"svip":    "SVIP分组",
}

var groupDescriptionMutex sync.RWMutex

// GetGroupDescription 获取分组描述
func GetGroupDescription(name string) string {
	groupDescriptionMutex.RLock()
	defer groupDescriptionMutex.RUnlock()
	desc, ok := groupDescription[name]
	if !ok {
		return name
	}
	return desc
}

// GetGroupDescriptionCopy 获取分组描述的副本
func GetGroupDescriptionCopy() map[string]string

// GroupDescription2JSONString 将分组描述转换为JSON字符串
func GroupDescription2JSONString() string

// UpdateGroupDescriptionByJSONString 通过JSON字符串更新分组描述
func UpdateGroupDescriptionByJSONString(jsonStr string) error
```

#### 2. `controller/option.go` - UpdateOption 函数
添加 GroupDescription 选项的处理。

**添加的代码**（在 `case "GroupRatio":` 之后）：
```go
case "GroupDescription":
    err = ratio_setting.UpdateGroupDescriptionByJSONString(option.Value.(string))
    if err != nil {
        c.JSON(http.StatusOK, gin.H{
            "success": false,
            "message": "分组描述设置失败: " + err.Error(),
        })
        return
    }
```

#### 3. `web/src/pages/Setting/Ratio/GroupRatioSettings.jsx`
添加分组描述设置字段。

**在 inputs 状态中添加**：
```jsx
const [inputs, setInputs] = useState({
    GroupRatio: '',
    GroupDescription: '',  // 新增
    // ... 其他字段
});
```

**添加的表单字段**（在分组倍率字段之后）：
```jsx
<Form.TextArea
  label={t('分组描述')}
  placeholder={t('为一个 JSON 文本，键为分组名称，值为分组描述')}
  extraText={t(
    '分组描述设置，用于在令牌创建时显示分组的描述信息，格式为 JSON 字符串，例如：{"default": "默认分组", "vip": "VIP分组"}',
  )}
  field={'GroupDescription'}
  autosize={{ minRows: 6, maxRows: 12 }}
  trigger='blur'
  stopValidateWithError
  rules={[
    {
      validator: (rule, value) => verifyJSON(value),
      message: t('不是合法的 JSON 字符串'),
    },
  ]}
  onChange={(value) => setInputs({ ...inputs, GroupDescription: value })}
/>
```

#### 4. `model/option.go` - InitOptionMap 和 updateOptionMap 函数
添加 GroupDescription 的初始化和更新处理。

**在 `InitOptionMap` 函数中添加**（在 `GroupRatio` 之后）：
```go
common.OptionMap["GroupDescription"] = ratio_setting.GroupDescription2JSONString()
```

**在 `updateOptionMap` 函数的 switch 语句中添加**（在 `case "GroupRatio":` 之后）：
```go
case "GroupDescription":
    err = ratio_setting.UpdateGroupDescriptionByJSONString(value)
```

#### 5. `controller/group.go` - GetUserGroups 函数
修改分组描述的获取来源。

**修改后**：
```go
func GetUserGroups(c *gin.Context) {
	usableGroups := make(map[string]map[string]interface{})
	userGroup := ""
	userId := c.GetInt("id")
	userGroup, _ = model.GetUserGroup(userId, false)
	userUsableGroups := service.GetUserUsableGroups(userGroup)
	for groupName := range ratio_setting.GetGroupRatioCopy() {
		if _, ok := userUsableGroups[groupName]; ok {
			usableGroups[groupName] = map[string]interface{}{
				"ratio": service.GetUserGroupRatio(userGroup, groupName),
				"desc":  ratio_setting.GetGroupDescription(groupName), // 从分组倍率设置获取描述
			}
		}
	}
	if _, ok := userUsableGroups["auto"]; ok {
		usableGroups["auto"] = map[string]interface{}{
			"ratio": "自动",
			"desc":  ratio_setting.GetGroupDescription("auto"),
		}
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    usableGroups,
	})
}
```

---

## 恢复步骤

1. 按照上述修改内容，逐个文件进行修改
2. 运行 `go build .` 验证后端编译是否通过
3. 运行 `cd web && npm run build` 验证前端编译是否通过
4. 测试功能是否正常工作

---

## 注意事项

- 在同步官方更新前，建议先备份这些修改过的文件
- 如果官方更新涉及到相同文件的相同位置，可能需要手动合并代码
- 建议使用 Git 分支管理自定义修改，便于与官方代码进行对比和合并

---

## 修改 4：分组描述和限制信息显示优化

### 功能描述
1. 在令牌管理-添加令牌-令牌分组选择框中，显示分组描述和5个限制信息Tag（并发数、RPM、RPD、TPM、TPD）
2. 在个人设置页面，用户分组显示分组描述而非分组名
3. 在数据看板页面，分组信息显示分组描述，Tag大小设置为large，形状为square

### 修改文件

#### 1. `controller/user.go` - GetSelf 函数
添加分组描述字段到用户信息响应。

**在获取用户组限制配置之后添加**：
```go
// 获取用户分组描述
groupDescription := ratio_setting.GetGroupDescription(user.Group)
```

**在 responseData 中添加**：
```go
"group_description": groupDescription,
```

#### 2. `controller/group.go` - GetUserGroups 函数
为分组添加限制信息（并发数、RPM、RPD、TPM、TPD）。

**添加 setting 包导入**：
```go
"github.com/QuantumNous/new-api/setting"
```

**修改后的分组信息结构**：
```go
groupInfo := map[string]interface{}{
    "ratio": service.GetUserGroupRatio(userGroup, groupName),
    "desc":  ratio_setting.GetGroupDescription(groupName),
}
// 添加分组限制信息
if setting.GroupLimitEnabled {
    limitConfig := setting.GetGroupLimitConfig(groupName)
    groupInfo["concurrency"] = limitConfig.Concurrency
    groupInfo["rpm"] = limitConfig.RPM
    groupInfo["rpd"] = limitConfig.RPD
    groupInfo["tpm"] = limitConfig.TPM
    groupInfo["tpd"] = limitConfig.TPD
}
```

#### 3. `web/src/helpers/render.jsx` - renderGroupOption 函数
修改分组选择框的渲染，显示分组描述和限制信息Tag。

**添加格式化函数**：
```jsx
const formatLimitValue = (value) => {
  if (value === 0 || value === undefined || value === null) {
    return '∞';
  }
  // ... 格式化大数字
};
```

**修改 renderGroupOption 函数**，显示分组描述（label）和4个限制信息Tag。

#### 4. `web/src/components/table/tokens/modals/EditTokenModal.jsx`
传递限制信息到分组选项。

**修改 loadGroups 函数**：
```jsx
let localGroupOptions = Object.entries(data).map(([group, info]) => ({
  label: info.desc,
  value: group,
  ratio: info.ratio,
  concurrency: info.concurrency,
  rpm: info.rpm,
  rpd: info.rpd,
  tpm: info.tpm,
  tpd: info.tpd,
}));
```

#### 5. `web/src/components/settings/personal/components/UserInfoHeader.jsx`
用户分组显示分组描述。

**修改显示内容**：
```jsx
{userState?.user?.group_description || userState?.user?.group || t('默认')}
```

#### 6. `web/src/components/dashboard/DashboardHeader.jsx`
数据看板分组信息优化。

**添加 groupDescription 属性**：
```jsx
const DashboardHeader = ({
  // ...
  groupDescription,
  groupLimits,
}) => {
```

**修改分组显示和Tag样式**：
- 分组值使用 `groupDescription || userGroup || 'default'`
- Tag 的 size 改为 'large'，shape 改为 'square'
- 图标大小改为 16

#### 7. `web/src/components/dashboard/index.jsx`
传递 groupDescription 属性。

**添加属性**：
```jsx
<DashboardHeader
  // ...
  groupDescription={userState?.user?.group_description}
  groupLimits={userState?.user?.group_limits}
/>
```

---

## 修改文件清单

| 文件路径 | 修改类型 | 说明 |
|---------|---------|------|
| `setting/group_limit.go` | 新建 | 用户组限制配置管理 |
| `common/group_limiter.go` | 新建 | 限流器实现（内存/Redis） |
| `middleware/group-limit.go` | 新建 | 用户组限制中间件 |
| `controller/user.go` | 修改 | GetSelf 函数添加 group_limits |
| `web/src/components/dashboard/DashboardHeader.jsx` | 重写 | 添加用户限制信息展示 |
| `web/src/components/dashboard/index.jsx` | 修改 | 传递 userGroup 和 groupLimits 属性 |
| `setting/ratio_setting/group_ratio.go` | 修改 | 添加 groupDescription 和相关函数 |
| `controller/group.go` | 修改 | GetUserGroups 使用新的描述来源 |
| `controller/option.go` | 修改 | 添加 GroupDescription 选项处理 |
| `model/option.go` | 修改 | 添加 GroupDescription 初始化和更新处理 |
| `web/src/pages/Setting/Ratio/GroupRatioSettings.jsx` | 修改 | 添加分组描述设置字段 |
| `web/src/components/settings/personal/components/UserInfoHeader.jsx` | 修改 | 用户分组显示分组描述 |
| `web/src/components/dashboard/DashboardHeader.jsx` | 修改 | 分组显示分组描述，Tag样式优化 |
| `web/src/components/dashboard/index.jsx` | 修改 | 传递 groupDescription 属性 |
| `web/src/components/settings/RatioSetting.jsx` | 修改 | 添加 GroupDescription 到 inputs 状态 |
| `web/src/pages/Setting/RateLimit/SettingsGroupLimit.jsx` | 修改 | 添加 RPD 配置说明和示例 |
| `web/src/helpers/render.jsx` | 修改 | renderGroupOption 添加 RPD Tag |
| `web/src/components/table/tokens/modals/EditTokenModal.jsx` | 修改 | loadGroups 添加 rpd 字段 |

---

## 修改 5：修复分组描述保存报错问题

### 问题描述
在分组倍率设置中修改分组描述后保存时，报错"你似乎并没有修改什么"。

### 问题原因
`web/src/components/settings/RatioSetting.jsx` 的 `inputs` 初始状态中没有包含 `GroupDescription` 字段。

前端的 `GroupRatioSettings.jsx` 组件在 `useEffect` 中只会从 `props.options` 复制那些在自己 `inputs` 初始状态中存在的键。由于父组件 `RatioSetting.jsx` 的 `inputs` 状态没有 `GroupDescription`，导致虽然后端返回了 `GroupDescription`，但它没有被正确传递到子组件，从而导致 `compareObjects` 函数无法检测到变化。

### 修复方案

#### 修改文件：`web/src/components/settings/RatioSetting.jsx`

**在 inputs 状态中添加 GroupDescription**：
```jsx
let [inputs, setInputs] = useState({
    ModelPrice: '',
    ModelRatio: '',
    CacheRatio: '',
    CompletionRatio: '',
    GroupRatio: '',
    GroupDescription: '',  // 新增此行
    GroupGroupRatio: '',
    ImageRatio: '',
    AudioCompletionRatio: '',
    AutoGroups: '',
    DefaultUseAutoGroup: false,
    ExposeRatioEnabled: false,
    UserUsableGroups: '',
    'group_ratio_setting.group_special_usable_group': '',
});
```

### 修复原理
添加 `GroupDescription: ''` 到父组件的 `inputs` 初始状态后：
1. 后端返回的 `GroupDescription` 会被正确设置到 `inputs` 中
2. 子组件 `GroupRatioSettings.jsx` 能够从 `props.options` 中获取到 `GroupDescription`
3. `compareObjects` 函数能够正确检测到 `GroupDescription` 的变化
4. 保存时能够正确提交修改

---

## 修改 6：修复用户组限制中间件执行顺序问题

### 问题描述
用户组限制功能（并发数、RPM、RPD、TPM、TPD）不生效，所有限制都无法正常工作。

### 问题原因
`GroupLimit()` 中间件在全局路由器上注册，在 `TokenAuth()` 之前执行。但 `GroupLimit()` 需要从上下文中获取用户组信息（`ContextKeyTokenGroup` 或 `ContextKeyUserGroup`），这些信息是在 `TokenAuth()` 中通过 `SetupContextForToken()` 和 `userCache.WriteContext()` 设置的。

由于执行顺序错误，`GroupLimit()` 无法获取用户组信息，导致跳过限流检查。

### 修复方案

#### 修改文件：`router/relay-router.go`

**修改前**：
```go
func SetRelayRouter(router *gin.Engine) {
	router.Use(middleware.CORS())
	router.Use(middleware.DecompressRequestMiddleware())
	router.Use(middleware.BodyStorageCleanup())
	router.Use(middleware.StatsMiddleware())
	router.Use(middleware.GroupLimit()) // 在全局注册，TokenAuth 之前执行
	// ...
	modelsRouter := router.Group("/v1/models")
	modelsRouter.Use(middleware.TokenAuth())
	// ...
}
```

**修改后**：
```go
func SetRelayRouter(router *gin.Engine) {
	router.Use(middleware.CORS())
	router.Use(middleware.DecompressRequestMiddleware())
	router.Use(middleware.BodyStorageCleanup())
	router.Use(middleware.StatsMiddleware())
	// GroupLimit 移到各路由组中，在 TokenAuth 之后执行
	
	modelsRouter := router.Group("/v1/models")
	modelsRouter.Use(middleware.TokenAuth())
	modelsRouter.Use(middleware.GroupLimit()) // 在 TokenAuth 之后
	// ...
}
```

**需要修改的路由组**：
1. `/v1/models` - `TokenAuth()` → `GroupLimit()`
2. `/v1beta/models` - `TokenAuth()` → `GroupLimit()`
3. `/v1beta/openai/models` - `TokenAuth()` → `GroupLimit()`
4. `/v1` (主要 API 路由) - `TokenAuth()` → `GroupLimit()` → `ModelRequestRateLimit()`
5. `/suno` - `TokenAuth()` → `GroupLimit()` → `Distribute()`
6. `/v1beta` (Gemini) - `TokenAuth()` → `GroupLimit()` → `ModelRequestRateLimit()` → `Distribute()`
7. `/mj` (Midjourney) - `TokenAuth()` → `GroupLimit()` → `Distribute()`

### 修复原理
将 `GroupLimit()` 中间件从全局路由器移到各个路由组中，确保在 `TokenAuth()` 之后执行。这样 `GroupLimit()` 就能正确获取用户组信息，限流功能才能正常工作。

### 完整修改后的路由注册代码

```go
func SetRelayRouter(router *gin.Engine) {
	router.Use(middleware.CORS())
	router.Use(middleware.DecompressRequestMiddleware())
	router.Use(middleware.BodyStorageCleanup())
	router.Use(middleware.StatsMiddleware())
	
	modelsRouter := router.Group("/v1/models")
	modelsRouter.Use(middleware.TokenAuth())
	modelsRouter.Use(middleware.GroupLimit()) // 必须在 TokenAuth 之后
	// ...

	geminiRouter := router.Group("/v1beta/models")
	geminiRouter.Use(middleware.TokenAuth())
	geminiRouter.Use(middleware.GroupLimit())
	// ...

	geminiCompatibleRouter := router.Group("/v1beta/openai/models")
	geminiCompatibleRouter.Use(middleware.TokenAuth())
	geminiCompatibleRouter.Use(middleware.GroupLimit())
	// ...

	relayV1Router := router.Group("/v1")
	relayV1Router.Use(middleware.TokenAuth())
	relayV1Router.Use(middleware.GroupLimit()) // 必须在 TokenAuth 之后
	relayV1Router.Use(middleware.ModelRequestRateLimit())
	// ...

	relaySunoRouter := router.Group("/suno")
	relaySunoRouter.Use(middleware.TokenAuth(), middleware.GroupLimit(), middleware.Distribute())
	// ...

	relayGeminiRouter := router.Group("/v1beta")
	relayGeminiRouter.Use(middleware.TokenAuth())
	relayGeminiRouter.Use(middleware.GroupLimit())
	relayGeminiRouter.Use(middleware.ModelRequestRateLimit())
	relayGeminiRouter.Use(middleware.Distribute())
	// ...
}

func registerMjRouterGroup(relayMjRouter *gin.RouterGroup) {
	relayMjRouter.GET("/image/:id", relay.RelayMidjourneyImage)
	relayMjRouter.Use(middleware.TokenAuth(), middleware.GroupLimit(), middleware.Distribute())
	// ...
}
```
