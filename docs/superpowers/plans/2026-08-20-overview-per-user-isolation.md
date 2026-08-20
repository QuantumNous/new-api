# 概览页按用户隔离 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `/dashboard/overview` 概览页在超级管理员之外的所有角色下，仅展示与当前用户「用户分组」关联的模型性能与渠道数据，并在新建用户时提供受隔离的分组下拉框（前端 + 后端双重隔离）。

**Architecture:** 在 `service` 层新增单一共享函数 `GetUserVisibleGroups(role, userGroup)` 作为地基，被性能面板（Part A）、分组下拉/用户写入（Part B）、渠道列表（Part C）三处 controller 复用。隔离逻辑集中在后端，前端仅调整用户表单结构。超级管理员/匿名走 `unrestricted` 全量路径；普通管理员/普通用户走「可见分组交集」路径且 fail-closed（交集为空返回空数据，绝不回退全量）。

**Tech Stack:** Go 1.22+ / Gin / GORM v2 / samber/lo；React 19 + TypeScript + react-hook-form + zod；后端测试 stretchr/testify。

## Global Constraints

- [强制] 所有面向模型的回复、思考必须使用中文；不发送可选客套评论。
- JSON 序列化/反序列化必须走 `common.Marshal` / `common.Unmarshal` / `common.UnmarshalJsonStr` / `common.DecodeJson`，禁止业务代码直接调用 `encoding/json`（类型引用除外）。
- 所有数据库代码必须同时兼容 SQLite、MySQL >= 5.7.8、PostgreSQL >= 9.6；优先 GORM 方法；raw SQL 必须处理方言差异（复用 `commonGroupCol`、`channelGroupFilterCondition()` 等既有跨库实现）。
- 受保护标识（new-api / QuantumNous 品牌、版权头、模块路径 `github.com/QuantumNous/new-api` 等）禁止修改、删除或替换。
- 新增/重写的 Go 后端测试必须用 `stretchr/testify/require`（setup / 致命断言）与 `stretchr/testify/assert`（非致命值检查）。
- 后端测试须保护真实行为/契约，使用确定性表驱动、显式输入与精确期望；不写仅提升覆盖率的测试。
- fail-closed：受限用户可见分组交集为空时一律返回空数据，绝不回退为全量。

---

### Task 1: 共享函数 `service.GetUserVisibleGroups`

**Files:**
- Modify: `service/group.go`（在 `GetUserUsableGroups` 之后新增导出函数）
- Test: `service/group_visible_groups_test.go`（Create）

**Interfaces:**
- Consumes: `setting.GetUserUsableGroupsCopy()`、`ratio_setting.GetGroupRatioSetting()`（经由既有 `GetUserUsableGroups(userGroup)`）、`common.RoleRootUser` / `common.RoleCommonUser`。
- Produces: `func GetUserVisibleGroups(role int, userGroup string) (groups []string, unrestricted bool)` — 供 Task 3/5/6/7 复用。`unrestricted=true` 时 `groups` 为 `nil`；`unrestricted=false` 时 `groups` 为该用户可见分组名集合（恒非空，至少含自身分组）。

- [ ] **Step 1: 写失败测试**

创建 `service/group_visible_groups_test.go`：

```go
package service

import (
	"fmt"
	"sort"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// configureVisibleGroupsTest 只设置用户可用分组；GroupSpecialUsableGroup 保持
// 其默认空值（无需改动），因此不涉及特殊分组增删。
func configureVisibleGroupsTest(t *testing.T) {
	t.Helper()
	originalUsableGroups := setting.UserUsableGroups2JSONString()
	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"default":"Default","vip":"VIP"}`))
	t.Cleanup(func() {
		require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(originalUsableGroups))
	})
}

func TestGetUserVisibleGroupsRootIsUnrestricted(t *testing.T) {
	configureVisibleGroupsTest(t)
	groups, unrestricted := GetUserVisibleGroups(common.RoleRootUser, "default")
	assert.True(t, unrestricted)
	assert.Nil(t, groups)
}

func TestGetUserVisibleGroupsGuestIsUnrestricted(t *testing.T) {
	configureVisibleGroupsTest(t)
	groups, unrestricted := GetUserVisibleGroups(common.RoleGuestUser, "")
	assert.True(t, unrestricted)
	assert.Nil(t, groups)
}

func TestGetUserVisibleGroupsAdminIsScopedToUsableGroups(t *testing.T) {
	configureVisibleGroupsTest(t)
	groups, unrestricted := GetUserVisibleGroups(common.RoleAdminUser, "default")
	assert.False(t, unrestricted)
	sort.Strings(groups)
	assert.Equal(t, []string{"default", "vip"}, groups)
}

func TestGetUserVisibleGroupsAlwaysContainsOwnGroup(t *testing.T) {
	configureVisibleGroupsTest(t)
	groups, unrestricted := GetUserVisibleGroups(common.RoleCommonUser, "standalone")
	assert.False(t, unrestricted)
	assert.Contains(t, groups, "standalone")
	require.NotEmpty(t, groups)
	_ = fmt.Sprint(groups)
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `go test ./service/ -run TestGetUserVisibleGroups -v`
Expected: 编译失败，`undefined: GetUserVisibleGroups`。

- [ ] **Step 3: 实现最小代码**

在 `service/group.go` 的 `GetUserUsableGroups` 函数之后新增（`lo` 已可用则用 `lo.Keys`，此处直接遍历避免新增依赖）：

```go
// GetUserVisibleGroups 返回某用户在分组维度上可见的分组集合。
// 超级管理员与未登录/游客返回 unrestricted=true（不做分组过滤）；
// 其余角色返回 unrestricted=false，groups 为 user.Group 经 GetUserUsableGroups
// 展开后的分组名集合，该集合恒包含用户自身分组（fail-closed 的下界）。
func GetUserVisibleGroups(role int, userGroup string) (groups []string, unrestricted bool) {
	if role >= common.RoleRootUser || role < common.RoleCommonUser {
		return nil, true
	}
	usable := GetUserUsableGroups(userGroup)
	groups = make([]string, 0, len(usable))
	for name := range usable {
		groups = append(groups, name)
	}
	return groups, false
}
```

确认 `service/group.go` 已 import `"github.com/QuantumNous/new-api/common"`（现有文件已导入）。

- [ ] **Step 4: 运行测试确认通过**

Run: `go test ./service/ -run TestGetUserVisibleGroups -v`
Expected: PASS（4 个用例）。

- [ ] **Step 5: 提交**

```bash
git add service/group.go service/group_visible_groups_test.go
git commit -m "feat(service): 新增 GetUserVisibleGroups 分组可见性判定"
```

---

### Task 2: 渠道多分组 OR 过滤器 `ApplyChannelGroupFilterAny`

**Files:**
- Modify: `model/channel.go`（在 `ApplyChannelGroupFilter` 之后新增）
- Test: `model/channel_group_filter_any_test.go`（Create）

**Interfaces:**
- Consumes: 既有 `channelGroupFilterCondition()`、`channelGroupFilterPattern(group)`、`NormalizeChannelGroupFilter(group)`、包级 `model.DB`。
- Produces: `func ApplyChannelGroupFilterAny(query *gorm.DB, groups []string) *gorm.DB` — Task 6 使用。语义：命中 `groups` 中**任一**分组的渠道（OR）；`groups` 归一化后为空则 fail-closed（`WHERE 1 = 0`）。

- [ ] **Step 1: 写失败测试**

创建 `model/channel_group_filter_any_test.go`（用 SQLite 内存库建最小 `channels` 表，只验证 OR 匹配与空集 fail-closed 行为）：

```go
package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func newChannelFilterTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Channel{}))
	t.Cleanup(func() {
		require.NoError(t, db.Exec("DROP TABLE channels").Error)
	})
	return db
}

func seedChannel(t *testing.T, db *gorm.DB, id int, name, group string) {
	t.Helper()
	require.NoError(t, db.Create(&Channel{Id: id, Name: name, Group: group, Status: 1}).Error)
}

func channelIDs(channels []*Channel) []int {
	ids := make([]int, 0, len(channels))
	for _, ch := range channels {
		ids = append(ids, ch.Id)
	}
	return ids
}

func TestApplyChannelGroupFilterAnyMatchesAnyGroup(t *testing.T) {
	db := newChannelFilterTestDB(t)
	seedChannel(t, db, 1, "a", "default")
	seedChannel(t, db, 2, "b", "vip,svip")
	seedChannel(t, db, 3, "c", "svip")

	var got []*Channel
	err := ApplyChannelGroupFilterAny(db.Model(&Channel{}), []string{"default", "vip"}).Find(&got).Error
	require.NoError(t, err)
	assert.ElementsMatch(t, []int{1, 2}, channelIDs(got))
}

func TestApplyChannelGroupFilterAnyEmptyIsFailClosed(t *testing.T) {
	db := newChannelFilterTestDB(t)
	seedChannel(t, db, 1, "a", "default")

	var got []*Channel
	err := ApplyChannelGroupFilterAny(db.Model(&Channel{}), nil).Find(&got).Error
	require.NoError(t, err)
	assert.Empty(t, got)
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `go test ./model/ -run TestApplyChannelGroupFilterAny -v`
Expected: 编译失败，`undefined: ApplyChannelGroupFilterAny`。

- [ ] **Step 3: 实现最小代码**

在 `model/channel.go` 的 `ApplyChannelGroupFilter` 之后新增：

```go
// ApplyChannelGroupFilterAny 对 groups 中任一分组命中的渠道做 OR 过滤。
// 复用单分组的跨库 LIKE 条件；归一化后为空时 fail-closed（返回空结果集），
// 避免受限用户在无可见分组时退化为全量。
func ApplyChannelGroupFilterAny(query *gorm.DB, groups []string) *gorm.DB {
	conditions := make([]string, 0, len(groups))
	args := make([]interface{}, 0, len(groups))
	for _, g := range groups {
		g = NormalizeChannelGroupFilter(g)
		if g == "" {
			continue
		}
		conditions = append(conditions, channelGroupFilterCondition())
		args = append(args, channelGroupFilterPattern(g))
	}
	if len(conditions) == 0 {
		return query.Where("1 = 0")
	}
	return query.Where(strings.Join(conditions, " OR "), args...)
}
```

确认 `model/channel.go` 已 import `"strings"`（现有文件已导入）。

- [ ] **Step 4: 运行测试确认通过**

Run: `go test ./model/ -run TestApplyChannelGroupFilterAny -v`
Expected: PASS（2 个用例）。

- [ ] **Step 5: 提交**

```bash
git add model/channel.go model/channel_group_filter_any_test.go
git commit -m "feat(model): 新增 ApplyChannelGroupFilterAny 多分组 OR 过滤"
```

---

### Task 3: Part A — 性能面板后端分组过滤

**Files:**
- Modify: `controller/perf_metrics.go:14-35`（`GetPerfMetricsSummary`）
- Test: `controller/perf_metrics_summary_test.go`（Create）

**Interfaces:**
- Consumes: `service.GetUserVisibleGroups`（Task 1）、既有 `ratio_setting.GetGroupRatioCopy()`、`perfmetrics.QuerySummaryAll(hours, groups)`、`lo.Keys` / `lo.Intersect`（`samber/lo` 已导入）、`c.GetInt("role")`、`c.GetString("group")`。
- Produces: 无导出符号，仅改内部行为。

- [ ] **Step 1: 写失败测试**

创建 `controller/perf_metrics_summary_test.go`。该测试只验证「分组解析」纯逻辑：把交集计算提取为可测函数 `resolvePerfSummaryGroups`（下一步实现），断言受限/不受限两条路径。

```go
package controller

import (
	"sort"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
)

func TestResolvePerfSummaryGroupsRootGetsAllActive(t *testing.T) {
	active := []string{"default", "vip", "auto"}
	got := resolvePerfSummaryGroups(common.RoleRootUser, "default", active)
	sort.Strings(got)
	assert.Equal(t, []string{"auto", "default", "vip"}, got)
}

func TestResolvePerfSummaryGroupsRestrictedIsIntersection(t *testing.T) {
	active := []string{"default", "vip", "svip", "auto"}
	// 受限用户可见 {default, vip}，交集应剔除 svip 与 auto
	got := resolvePerfSummaryGroupsWithVisible(active, []string{"default", "vip"})
	sort.Strings(got)
	assert.Equal(t, []string{"default", "vip"}, got)
}

func TestResolvePerfSummaryGroupsEmptyIntersectionIsFailClosed(t *testing.T) {
	active := []string{"default", "vip", "auto"}
	got := resolvePerfSummaryGroupsWithVisible(active, []string{"isolated"})
	assert.Empty(t, got)
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `go test ./controller/ -run TestResolvePerfSummaryGroups -v`
Expected: 编译失败，`undefined: resolvePerfSummaryGroups` / `resolvePerfSummaryGroupsWithVisible`。

- [ ] **Step 3: 实现最小代码**

改写 `controller/perf_metrics.go` 中 `GetPerfMetricsSummary`，并新增两个内部辅助函数：

```go
func GetPerfMetricsSummary(c *gin.Context) {
	hours := 24
	if rawHours := c.Query("hours"); rawHours != "" {
		if parsed, err := strconv.Atoi(rawHours); err == nil {
			hours = parsed
		}
	}

	activeGroups := append(lo.Keys(ratio_setting.GetGroupRatioCopy()), "auto")
	groups := resolvePerfSummaryGroups(c.GetInt("role"), c.GetString("group"), activeGroups)

	result, err := perfmetrics.QuerySummaryAll(hours, groups)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    result,
	})
}

// resolvePerfSummaryGroups 依据调用者角色决定性能汇总的分组范围：
// 超级管理员/匿名返回全部活跃分组；受限用户返回「活跃分组 ∩ 可见分组」（fail-closed）。
func resolvePerfSummaryGroups(role int, userGroup string, activeGroups []string) []string {
	visible, unrestricted := service.GetUserVisibleGroups(role, userGroup)
	if unrestricted {
		return activeGroups
	}
	return resolvePerfSummaryGroupsWithVisible(activeGroups, visible)
}

func resolvePerfSummaryGroupsWithVisible(activeGroups, visible []string) []string {
	return lo.Intersect(activeGroups, visible)
}
```

在 `controller/perf_metrics.go` 的 import 块加入 `"github.com/QuantumNous/new-api/service"`。

- [ ] **Step 4: 运行测试确认通过**

Run: `go test ./controller/ -run TestResolvePerfSummaryGroups -v`
Expected: PASS（3 个用例）。

- [ ] **Step 5: 构建校验**

Run: `go build ./...`
Expected: 无错误。

- [ ] **Step 6: 提交**

```bash
git add controller/perf_metrics.go controller/perf_metrics_summary_test.go
git commit -m "feat(perf): 概览性能面板按用户可见分组过滤"
```

---

### Task 4: Part B 后端 — 分组下拉收窄 `GetGroups`

**Files:**
- Modify: `controller/group.go:14-24`（`GetGroups`）
- Test: `controller/groups_scope_test.go`（Create）

**Interfaces:**
- Consumes: `service.GetUserVisibleGroups`（Task 1）、`ratio_setting.GetGroupRatioCopy()`、`c.GetInt("role")`、`c.GetString("group")`。
- Produces: `func resolveVisibleGroupNames(role int, userGroup string, allGroups []string) []string` — 内部辅助，供测试直接断言。

- [ ] **Step 1: 写失败测试**

创建 `controller/groups_scope_test.go`：

```go
package controller

import (
	"sort"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
)

func TestResolveVisibleGroupNamesRootGetsAll(t *testing.T) {
	all := []string{"default", "vip", "svip"}
	got := resolveVisibleGroupNames(common.RoleRootUser, "default", all)
	sort.Strings(got)
	assert.Equal(t, []string{"default", "svip", "vip"}, got)
}

func TestResolveVisibleGroupNamesRestrictedIntersects(t *testing.T) {
	all := []string{"default", "vip", "svip"}
	got := resolveVisibleGroupNamesWithVisible(all, []string{"default", "vip"})
	sort.Strings(got)
	assert.Equal(t, []string{"default", "vip"}, got)
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `go test ./controller/ -run TestResolveVisibleGroupNames -v`
Expected: 编译失败，`undefined: resolveVisibleGroupNames`。

- [ ] **Step 3: 实现最小代码**

改写 `controller/group.go` 的 `GetGroups`，新增两个辅助函数（`GetGroups` 现有实现见文件；替换其函数体）：

```go
func GetGroups(c *gin.Context) {
	allGroups := make([]string, 0)
	for groupName := range ratio_setting.GetGroupRatioCopy() {
		allGroups = append(allGroups, groupName)
	}
	groupNames := resolveVisibleGroupNames(c.GetInt("role"), c.GetString("group"), allGroups)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    groupNames,
	})
}

// resolveVisibleGroupNames 依据调用者角色决定分组下拉可选项：
// 超级管理员返回全部分组；受限管理员返回「全部分组 ∩ 可见分组」。
func resolveVisibleGroupNames(role int, userGroup string, allGroups []string) []string {
	visible, unrestricted := service.GetUserVisibleGroups(role, userGroup)
	if unrestricted {
		return allGroups
	}
	return resolveVisibleGroupNamesWithVisible(allGroups, visible)
}

func resolveVisibleGroupNamesWithVisible(allGroups, visible []string) []string {
	visibleSet := make(map[string]struct{}, len(visible))
	for _, g := range visible {
		visibleSet[g] = struct{}{}
	}
	filtered := make([]string, 0, len(allGroups))
	for _, g := range allGroups {
		if _, ok := visibleSet[g]; ok {
			filtered = append(filtered, g)
		}
	}
	return filtered
}
```

`controller/group.go` 已 import `service`，无需新增。

- [ ] **Step 4: 运行测试确认通过**

Run: `go test ./controller/ -run TestResolveVisibleGroupNames -v`
Expected: PASS（2 个用例）。

- [ ] **Step 5: 提交**

```bash
git add controller/group.go controller/groups_scope_test.go
git commit -m "feat(group): /api/group 分组列表按调用者可见分组收窄"
```

---

### Task 5: Part B 后端 — 用户写入分组越界校验

**Files:**
- Modify: `controller/user.go`（`CreateUser` ~ line 1003、`UpdateUser` ~ line 665）
- Test: `controller/user_group_scope_test.go`（Create）

**Interfaces:**
- Consumes: `service.GetUserVisibleGroups`（Task 1）。
- Produces: `func callerCanAssignGroup(role int, userGroup, targetGroup string) bool` — 内部辅助，供 `CreateUser`/`UpdateUser` 与测试复用。

- [ ] **Step 1: 写失败测试**

创建 `controller/user_group_scope_test.go`。为避免依赖数据库，只测纯判定 `callerCanAssignGroup`（配置可用分组同 Task 1 fixture）：

```go
package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func configureUserGroupScopeTest(t *testing.T) {
	t.Helper()
	original := setting.UserUsableGroups2JSONString()
	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"default":"Default","vip":"VIP"}`))
	t.Cleanup(func() {
		require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(original))
	})
}

func TestCallerCanAssignGroupRootAlwaysTrue(t *testing.T) {
	configureUserGroupScopeTest(t)
	assert.True(t, callerCanAssignGroup(common.RoleRootUser, "default", "anything"))
}

func TestCallerCanAssignGroupAdminWithinVisible(t *testing.T) {
	configureUserGroupScopeTest(t)
	assert.True(t, callerCanAssignGroup(common.RoleAdminUser, "default", "vip"))
}

func TestCallerCanAssignGroupAdminRejectsOutOfScope(t *testing.T) {
	configureUserGroupScopeTest(t)
	assert.False(t, callerCanAssignGroup(common.RoleAdminUser, "default", "svip"))
}

func TestCallerCanAssignGroupEmptyTargetAllowed(t *testing.T) {
	// 空分组交由既有默认逻辑处理，不视为越界
	configureUserGroupScopeTest(t)
	assert.True(t, callerCanAssignGroup(common.RoleAdminUser, "default", ""))
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `go test ./controller/ -run TestCallerCanAssignGroup -v`
Expected: 编译失败，`undefined: callerCanAssignGroup`。

- [ ] **Step 3: 实现最小代码 — 辅助函数**

在 `controller/user.go` 中 `CreateUser` 之前新增：

```go
// callerCanAssignGroup 校验非超级管理员为用户指派的分组是否在其可见分组集合内。
// 空 targetGroup 交由既有默认逻辑处理，视为合法。超级管理员不受限。
func callerCanAssignGroup(role int, userGroup, targetGroup string) bool {
	if targetGroup == "" {
		return true
	}
	visible, unrestricted := service.GetUserVisibleGroups(role, userGroup)
	if unrestricted {
		return true
	}
	for _, g := range visible {
		if g == targetGroup {
			return true
		}
	}
	return false
}
```

确认 `controller/user.go` 已 import `service`（现有文件已在多处调用 `service.GetUserUsableGroups`，已导入）。

- [ ] **Step 4: 在 CreateUser 接入校验**

在 `CreateUser` 内、`cleanUser := model.User{...}` 之前插入校验，并把 `Group` 纳入 `cleanUser`：

```go
	myRole := c.GetInt("role")
	if user.Role >= myRole {
		common.ApiErrorI18n(c, i18n.MsgUserCannotCreateHigherLevel)
		return
	}
	if !callerCanAssignGroup(myRole, c.GetString("group"), user.Group) {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	// Even for admin users, we cannot fully trust them!
	cleanUser := model.User{
		Username:    user.Username,
		Password:    user.Password,
		DisplayName: user.DisplayName,
		Role:        user.Role, // 保持管理员设置的角色
		Group:       user.Group, // 受 callerCanAssignGroup 校验；空值由模型默认处理
	}
```

- [ ] **Step 5: 在 UpdateUser 接入校验**

在 `UpdateUser` 内、`canManageTargetRole` 校验通过之后、`model.DB.Transaction(...)` 之前插入：

```go
	if !callerCanAssignGroup(myRole, c.GetString("group"), updatedUser.Group) {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
```

（`myRole` 在 `UpdateUser` 中已定义于 `canManageTargetRole` 之前。）

- [ ] **Step 6: 运行测试确认通过 + 构建**

Run: `go test ./controller/ -run TestCallerCanAssignGroup -v && go build ./...`
Expected: 测试 PASS（4 用例）、构建无错误。

- [ ] **Step 7: 提交**

```bash
git add controller/user.go controller/user_group_scope_test.go
git commit -m "feat(user): 新建/更新用户时校验分组不越界并持久化 Group"
```

---

### Task 6: Part C — 渠道列表/计数按可见分组隔离

**Files:**
- Modify: `controller/channel.go`（`GetAllChannels` ~ line 100，含 tag 模式、`total`、`type_counts` 三处子查询）
- Test: `controller/channel_visible_scope_test.go`（Create）

**Interfaces:**
- Consumes: `service.GetUserVisibleGroups`（Task 1）、`model.ApplyChannelGroupFilterAny`（Task 2）、既有 `buildChannelListQuery`、`model.NormalizeChannelGroupFilter`。
- Produces: `func scopedChannelGroupQuery(base *gorm.DB, role int, userGroup, requestedGroup string) (*gorm.DB, bool)` — 返回加了可见性约束的查询与 `ok`（`false` 表示越界请求，调用方应直接返回空）。供 `GetAllChannels` 各子查询与测试复用。

说明：`GetAllChannels` 现有实现把 `groupFilter`（来自 `?group=`）传入 `buildChannelListQuery(groupFilter, statusFilter, typeFilter)`。改造思路 —— 对受限用户，在 `buildChannelListQuery` 产出的 `*gorm.DB` 上再叠加可见分组约束；对超级管理员保持原样。为使各处（列表、`total`、`type_counts`、tag 模式）一致，统一通过 `scopedChannelGroupQuery` 包裹。

- [ ] **Step 1: 写失败测试**

创建 `controller/channel_visible_scope_test.go`，用 SQLite 内存库验证受限用户仅见可见分组渠道、越界 `?group=` 返回空、超级管理员见全量。复用与 Task 2 相同的建表方式，但断言经 `scopedChannelGroupQuery` 组合后的结果。

```go
package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func newChannelScopeDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Channel{}))
	require.NoError(t, db.Create(&model.Channel{Id: 1, Name: "a", Group: "default", Status: 1}).Error)
	require.NoError(t, db.Create(&model.Channel{Id: 2, Name: "b", Group: "vip", Status: 1}).Error)
	require.NoError(t, db.Create(&model.Channel{Id: 3, Name: "c", Group: "svip", Status: 1}).Error)
	t.Cleanup(func() { require.NoError(t, db.Exec("DROP TABLE channels").Error) })
	return db
}

func countScoped(t *testing.T, q *gorm.DB, ok bool) int64 {
	t.Helper()
	if !ok {
		return 0
	}
	var n int64
	require.NoError(t, q.Count(&n).Error)
	return n
}

func TestScopedChannelGroupQueryRootSeesAll(t *testing.T) {
	db := newChannelScopeDB(t)
	q, ok := scopedChannelGroupQuery(db.Model(&model.Channel{}), common.RoleRootUser, "default", "")
	assert.Equal(t, int64(3), countScoped(t, q, ok))
}

func TestScopedChannelGroupQueryRestrictedSeesOnlyVisible(t *testing.T) {
	configureVisibleGroupsForChannelTest(t) // 可见 {default, vip}
	db := newChannelScopeDB(t)
	q, ok := scopedChannelGroupQuery(db.Model(&model.Channel{}), common.RoleAdminUser, "default", "")
	assert.Equal(t, int64(2), countScoped(t, q, ok))
}

func TestScopedChannelGroupQueryRejectsOutOfScopeRequestedGroup(t *testing.T) {
	configureVisibleGroupsForChannelTest(t)
	db := newChannelScopeDB(t)
	_, ok := scopedChannelGroupQuery(db.Model(&model.Channel{}), common.RoleAdminUser, "default", "svip")
	assert.False(t, ok)
}

func TestScopedChannelGroupQueryRestrictedHonorsInScopeRequestedGroup(t *testing.T) {
	configureVisibleGroupsForChannelTest(t)
	db := newChannelScopeDB(t)
	q, ok := scopedChannelGroupQuery(db.Model(&model.Channel{}), common.RoleAdminUser, "default", "vip")
	assert.Equal(t, int64(1), countScoped(t, q, ok))
}
```

在同文件末尾新增 fixture（配置可见分组 = {default, vip}）：

```go
func configureVisibleGroupsForChannelTest(t *testing.T) {
	t.Helper()
	original := setting.UserUsableGroups2JSONString()
	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"default":"Default","vip":"VIP"}`))
	t.Cleanup(func() {
		require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(original))
	})
}
```

并在 import 块加入 `"github.com/QuantumNous/new-api/setting"`。

- [ ] **Step 2: 运行测试确认失败**

Run: `go test ./controller/ -run TestScopedChannelGroupQuery -v`
Expected: 编译失败，`undefined: scopedChannelGroupQuery`。

- [ ] **Step 3: 实现 `scopedChannelGroupQuery`**

在 `controller/channel.go` 中 `buildChannelListQuery` 之后新增：

```go
// scopedChannelGroupQuery 在 base 查询上叠加渠道可见性约束。
// 超级管理员/匿名不受限（尊重 requestedGroup 的既有行为，直接返回 base）；
// 受限用户：requestedGroup 为空时按其全部可见分组 OR 过滤；
// requestedGroup 非空且越界时返回 ok=false（调用方应返回空结果）。
func scopedChannelGroupQuery(base *gorm.DB, role int, userGroup, requestedGroup string) (*gorm.DB, bool) {
	visible, unrestricted := service.GetUserVisibleGroups(role, userGroup)
	if unrestricted {
		return base, true
	}
	requestedGroup = model.NormalizeChannelGroupFilter(requestedGroup)
	if requestedGroup != "" {
		for _, g := range visible {
			if g == requestedGroup {
				return base, true // requestedGroup 已在 buildChannelListQuery 里过滤
			}
		}
		return base, false
	}
	return model.ApplyChannelGroupFilterAny(base, visible), true
}
```

在 `controller/channel.go` import 块加入 `"github.com/QuantumNous/new-api/service"`（若未导入）。

- [ ] **Step 4: 运行测试确认通过**

Run: `go test ./controller/ -run TestScopedChannelGroupQuery -v`
Expected: PASS（4 用例）。

- [ ] **Step 5: 在 GetAllChannels 接入**

改造 `GetAllChannels`：在解析出 `role`/`userGroup` 后，对每个由 `buildChannelListQuery(...)` 产出的查询用 `scopedChannelGroupQuery` 包裹；越界（`ok=false`）时直接返回空列表结构。具体：

1. 函数开头，`groupFilter := model.NormalizeChannelGroupFilter(c.Query("group"))` 之后加：

```go
	role := c.GetInt("role")
	userGroup := c.GetString("group")
	// 越界的单分组请求：受限用户请求了不可见分组，直接返回空
	if _, ok := scopedChannelGroupQuery(model.DB.Model(&model.Channel{}), role, userGroup, groupFilter); !ok {
		common.ApiSuccess(c, gin.H{
			"items": make([]*model.Channel, 0), "total": 0,
			"page": pageInfo.GetPage(), "page_size": pageInfo.GetPageSize(),
			"type_counts": map[int64]int64{},
		})
		return
	}
```

2. 定义一个局部闭包，统一给 `buildChannelListQuery` 结果套上可见性：

```go
	scoped := func(statusFilter, typeFilter int) *gorm.DB {
		q, _ := scopedChannelGroupQuery(buildChannelListQuery(groupFilter, statusFilter, typeFilter), role, userGroup, groupFilter)
		return q
	}
```

3. 将函数体内所有 `buildChannelListQuery(groupFilter, statusFilter, typeFilter)` 调用替换为 `scoped(statusFilter, typeFilter)`（tag 模式的 3 处、非 tag 分支的 `Count`+列表 2 处、`countQuery` 的 `buildChannelListQuery(groupFilter, statusFilter, -1)` → `scoped(statusFilter, -1)`）。tag 模式中带 `.Where("tag = ?", *tag)` 的保持在 `scoped(...)` 结果上继续 `.Where`。

- [ ] **Step 6: 构建 + 回归**

Run: `go build ./... && go test ./controller/ -run 'TestScopedChannelGroupQuery|TestResolvePerfSummaryGroups|TestResolveVisibleGroupNames|TestCallerCanAssignGroup' -v`
Expected: 构建无错误；全部 PASS。

- [ ] **Step 7: 提交**

```bash
git add controller/channel.go controller/channel_visible_scope_test.go
git commit -m "feat(channel): 渠道列表/计数按用户可见分组隔离"
```

---

### Task 7: Part C — 单渠道读取与搜索加固

**Files:**
- Modify: `controller/channel.go`（`GetChannel` ~ line 397、`SearchChannels` ~ line 275）
- Test: `controller/channel_single_scope_test.go`（Create）

**Interfaces:**
- Consumes: `service.GetUserVisibleGroups`（Task 1）、既有 `Channel.Group`。
- Produces: `func channelVisibleToCaller(channelGroup string, role int, userGroup string) bool` — 内部辅助，供 `GetChannel` 与搜索结果后过滤及测试复用。

- [ ] **Step 1: 写失败测试**

创建 `controller/channel_single_scope_test.go`：

```go
package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
)

func TestChannelVisibleToCallerRootAlways(t *testing.T) {
	assert.True(t, channelVisibleToCaller("svip", common.RoleRootUser, "default"))
}

func TestChannelVisibleToCallerRestrictedMatch(t *testing.T) {
	configureVisibleGroupsForChannelTest(t) // 可见 {default, vip}
	assert.True(t, channelVisibleToCaller("vip,svip", common.RoleAdminUser, "default"))
}

func TestChannelVisibleToCallerRestrictedNoMatch(t *testing.T) {
	configureVisibleGroupsForChannelTest(t)
	assert.False(t, channelVisibleToCaller("svip", common.RoleAdminUser, "default"))
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `go test ./controller/ -run TestChannelVisibleToCaller -v`
Expected: 编译失败，`undefined: channelVisibleToCaller`。

- [ ] **Step 3: 实现辅助函数**

在 `controller/channel.go` 的 `scopedChannelGroupQuery` 之后新增：

```go
// channelVisibleToCaller 判定某渠道（其 Channel.Group 为逗号分隔列表）
// 是否与调用者的可见分组集合有交集。超级管理员/匿名恒可见。
func channelVisibleToCaller(channelGroup string, role int, userGroup string) bool {
	visible, unrestricted := service.GetUserVisibleGroups(role, userGroup)
	if unrestricted {
		return true
	}
	visibleSet := make(map[string]struct{}, len(visible))
	for _, g := range visible {
		visibleSet[g] = struct{}{}
	}
	for _, g := range strings.Split(strings.Trim(channelGroup, ","), ",") {
		if g == "" {
			continue
		}
		if _, ok := visibleSet[strings.TrimSpace(g)]; ok {
			return true
		}
	}
	return false
}
```

确认 `controller/channel.go` 已 import `"strings"`（现有文件已导入）。

- [ ] **Step 4: 在 GetChannel 接入**

在 `GetChannel` 中 `channel, err := model.GetChannelById(id, false)` 成功、`clearChannelInfo` 之前插入越界判定：

```go
	if channel == nil || !channelVisibleToCaller(channel.Group, c.GetInt("role"), c.GetString("group")) {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	clearChannelInfo(channel)
```

（`GetChannel` 现有代码把 `clearChannelInfo` 放在 `if channel != nil` 内；用上面判定替换该 `if` 块。确认 `controller/channel.go` 已 import i18n 包 `"github.com/QuantumNous/new-api/i18n"`；若未导入则改用既有 `common.ApiError(c, errors.New("channel not found"))` 风格，与文件内其他 404 保持一致。）

- [ ] **Step 5: 在 SearchChannels 接入结果后过滤**

在 `SearchChannels` 得到 `channelData`（tag 与非 tag 两分支汇合后、`statusFilter` 过滤块**之前**）插入受限用户后过滤：

```go
	role := c.GetInt("role")
	userGroup := c.GetString("group")
	if _, unrestricted := service.GetUserVisibleGroups(role, userGroup); !unrestricted {
		visibleChannels := make([]*model.Channel, 0, len(channelData))
		for _, ch := range channelData {
			if channelVisibleToCaller(ch.Group, role, userGroup) {
				visibleChannels = append(visibleChannels, ch)
			}
		}
		channelData = visibleChannels
	}
```

- [ ] **Step 6: 运行测试 + 构建**

Run: `go test ./controller/ -run TestChannelVisibleToCaller -v && go build ./...`
Expected: 测试 PASS（3 用例）；构建无错误。

- [ ] **Step 7: 提交**

```bash
git add controller/channel.go controller/channel_single_scope_test.go
git commit -m "feat(channel): 单渠道读取与搜索按用户可见分组加固"
```

---

### Task 8: Part B 前端 — 新建用户分组下拉框

**Files:**
- Modify: `web/src/features/users/components/users-mutate-drawer.tsx`（约 351-390：将 `group` 字段从 `{isUpdate && ...}` 区块拆出）
- Modify: `web/src/features/users/lib/user-form.ts:96-104`（`transformFormDataToPayload`：新建态也发送 `group`）

**Interfaces:**
- Consumes: 既有 `getGroups` query、`groups` 数组、`USER_FORM_DEFAULT_VALUES.group = DEFAULT_GROUP('default')`、`form` 控件。
- Produces: 新建态渲染 Group 下拉、默认 `default`；payload 在新建时携带 `group`。

- [ ] **Step 1: 拆出 Group 下拉为独立区块**

在 `users-mutate-drawer.tsx` 中，把当前位于 `{isUpdate && (<SideDrawerSection>...Group & Quota...`）内的 `group` `FormField` 移出为**始终渲染**的独立 `SideDrawerSection`（放在密码区块之后、`{isUpdate && ...}` 额度区块之前）。保留 `quota_dollars` 等其余字段仍在 `{isUpdate && ...}` 内。新区块结构：

```tsx
              <SideDrawerSection>
                <h3 className='text-sm font-medium'>{t('Group')}</h3>
                <FormField
                  control={form.control}
                  name='group'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Group')}</FormLabel>
                      <Select
                        items={groups.map((group) => ({
                          value: group,
                          label: group,
                        }))}
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('Select a group')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent alignItemWithTrigger={false}>
                          <SelectGroup>
                            {groups.map((group) => (
                              <SelectItem key={group} value={group}>
                                {group}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </SideDrawerSection>
```

并从原 `{isUpdate && (<SideDrawerSection> Group & Quota ...)}` 区块中删除已移出的 `group` `FormField`，将该区块标题改为仅额度相关（如 `t('Quota')`）。

- [ ] **Step 2: 新建态 payload 携带 group**

修改 `web/src/features/users/lib/user-form.ts` `transformFormDataToPayload` 的新建分支：

```ts
  // For create: send required fields + selected group
  if (userId === undefined) {
    payload.role = role
    payload.group = data.group
  } else {
    // For update: quota is adjusted atomically via /api/user/manage, not sent here
    payload.group = data.group
    payload.remark = data.remark || undefined
    payload.id = userId
  }
```

- [ ] **Step 3: 校验前端类型与构建**

Run: `cd web && bun run build`
Expected: 构建成功，无 TS 错误。（若项目有更快的类型检查脚本如 `bun run typecheck`，可先用它。）

- [ ] **Step 4: 提交**

```bash
git add web/src/features/users/components/users-mutate-drawer.tsx web/src/features/users/lib/user-form.ts
git commit -m "feat(users): 新建用户表单增加分组下拉并提交 group"
```

---

### Task 9: 全量回归与收尾

**Files:**
- 无新增；跨模块验证。

- [ ] **Step 1: 后端受影响包测试**

Run: `go test ./service/... ./model/... ./controller/...`
Expected: 全部 PASS。

- [ ] **Step 2: 后端全量构建**

Run: `go build ./...`
Expected: 无错误。

- [ ] **Step 3: relaykit 独立构建校验（若本次改动触及 relaykit —— 本计划未触及，作为安全网确认）**

Run: `cd relaykit && GOWORK=off go build ./...`
Expected: 无错误。

- [ ] **Step 4: 前端构建**

Run: `cd web && bun run build`
Expected: 构建成功。

- [ ] **Step 5: 最终提交（如有 lint/format 产生的零散改动）**

```bash
git add -A
git commit -m "chore: 概览页按用户隔离收尾回归" || echo "无额外改动"
```

---

## Self-Review

**Spec 覆盖核对：**

- Spec §2.1 共享函数 `GetUserVisibleGroups` → Task 1 ✓
- Spec §3（Part A 性能面板后端过滤，fail-closed，前端门槛不变，SummaryCards 不改）→ Task 3 ✓；§3.3 跨页副作用已在评审确认采用「共享端点上下文感知」，Task 3 的实现即此方案 ✓
- Spec §4（Part B 前端下拉拆分 + 默认 default；后端 GetGroups 收窄；用户写入校验）→ Task 4（GetGroups）、Task 5（写入校验 + 持久化 Group）、Task 8（前端）✓
- Spec §5（Part C 列表/计数隔离、多分组 OR 过滤、单读/搜索加固；路由与前端门槛不改；写操作为非目标）→ Task 2（过滤器）、Task 6（列表/计数）、Task 7（单读/搜索）✓；路由与 `adminOnly` 未改动符合「不改」要求 ✓
- Spec §8 测试计划 → 各 Task 内的表驱动 testify 测试 ✓
- Spec §9 文件清单 → 与各 Task Files 一致 ✓

**Placeholder 扫描：** 无 TBD/TODO；每个代码步骤均含完整代码块与精确命令/期望。

**类型一致性核对：**
- `GetUserVisibleGroups(role int, userGroup string) (groups []string, unrestricted bool)` 在 Task 1 定义，Task 3/4/5/6/7 一致调用 ✓
- `ApplyChannelGroupFilterAny(query *gorm.DB, groups []string) *gorm.DB` Task 2 定义、Task 6 使用 ✓
- `scopedChannelGroupQuery(base *gorm.DB, role int, userGroup, requestedGroup string) (*gorm.DB, bool)` Task 6 定义并自用 ✓
- `channelVisibleToCaller(channelGroup string, role int, userGroup string) bool` Task 7 定义并自用 ✓
- `callerCanAssignGroup(role int, userGroup, targetGroup string) bool` Task 5 定义并自用 ✓
- fixture `configureVisibleGroupsForChannelTest` 在 Task 6 定义，Task 7 复用（同包 `controller`，跨 `_test.go` 文件可见）✓

**已知实现注意点（供执行者留意，非缺陷）：**
- Task 7 `GetChannel` 的 404 返回风格需与 `controller/channel.go` 既有约定一致：若文件已 import `i18n` 用 `common.ApiErrorI18n(c, i18n.MsgInvalidParams)`，否则用 `common.ApiError`。执行时以文件实际 import 为准。
- Task 6 替换 `buildChannelListQuery(...)` 调用点务必覆盖全部 5~6 处，避免计数与列表口径不一致。
