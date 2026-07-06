package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

// setupTestDB 初始化内存 SQLite，注册所需表
func setupTestDB(t *testing.T) {
	t.Helper()
	origDB := model.DB
	origLogDB := model.LOG_DB
	t.Cleanup(func() { // 恢复全局状态，避免污染其他测试
		model.DB = origDB
		model.LOG_DB = origLogDB
	})
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(
		&model.GroupMappingRule{},
		&model.User{},
		&model.SubscriptionPlan{},
		&model.UserSubscription{},
		&model.Log{},
	); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	model.DB = db
	model.LOG_DB = db // 日志默认写主库（模拟未配 LOG_SQL_DSN 的场景）
	if common.OptionMap == nil {
		common.OptionMap = map[string]string{}
	}
	common.OptionMap["auto_group.protected_groups"] = ""
}

// createTestUser 创建一个测试用户并返回（含唯一 username + aff_code）
func createTestUser(t *testing.T, username, group, jobTitle string) *model.User {
	t.Helper()
	u := &model.User{
		Username:    username,
		DisplayName: username,
		Group:       group,
		JobTitle:    jobTitle,
		Role:        1,
		Status:      1,
		AffCode:     common.GetRandomString(4) + common.GetRandomString(4),
	}
	if err := model.DB.Create(u).Error; err != nil {
		t.Fatalf("create user %s: %v", username, err)
	}
	return u
}

// reloadUser 从 DB 重新查用户，获取最新 group
func reloadUser(t *testing.T, id int) *model.User {
	t.Helper()
	var u model.User
	if err := model.DB.First(&u, id).Error; err != nil {
		t.Fatalf("reload user %d: %v", id, err)
	}
	return &u
}

// ============ ResolveGroupByJobTitle ============

func TestResolveGroupByJobTitle_Hit(t *testing.T) {
	setupTestDB(t)
	if err := model.CreateGroupMappingRule(&model.GroupMappingRule{
		JobTitle: "工程师", TargetGroup: "dev", Enabled: true,
	}); err != nil {
		t.Fatal(err)
	}
	got, err := ResolveGroupByJobTitle("工程师")
	if err != nil {
		t.Fatal(err)
	}
	if got != "dev" {
		t.Errorf("expected dev, got %s", got)
	}
}

func TestResolveGroupByJobTitle_NotFound(t *testing.T) {
	setupTestDB(t)
	got, err := ResolveGroupByJobTitle("不存在")
	if err != nil {
		t.Fatal(err)
	}
	if got != "" {
		t.Errorf("expected empty, got %s", got)
	}
}

func TestResolveGroupByJobTitle_Empty(t *testing.T) {
	setupTestDB(t)
	got, err := ResolveGroupByJobTitle("")
	if err != nil {
		t.Fatal(err)
	}
	if got != "" {
		t.Errorf("expected empty for empty jobtitle, got %s", got)
	}
}

func TestResolveGroupByJobTitle_Disabled(t *testing.T) {
	setupTestDB(t)
	if err := model.CreateGroupMappingRule(&model.GroupMappingRule{
		JobTitle: "设计师", TargetGroup: "design", Enabled: false,
	}); err != nil {
		t.Fatal(err)
	}
	got, err := ResolveGroupByJobTitle("设计师")
	if err != nil {
		t.Fatal(err)
	}
	if got != "" {
		t.Errorf("disabled rule should not match, got %s", got)
	}
}

// ============ IsProtectedGroup ============

func TestIsProtectedGroup_InList(t *testing.T) {
	setupTestDB(t)
	common.OptionMap["auto_group.protected_groups"] = "vip, partner ,trial"
	if !IsProtectedGroup("vip") {
		t.Error("vip should be protected")
	}
	if !IsProtectedGroup("partner") {
		t.Error("partner should be protected (trimmed)")
	}
}

func TestIsProtectedGroup_NotInList(t *testing.T) {
	setupTestDB(t)
	common.OptionMap["auto_group.protected_groups"] = "vip,partner"
	if IsProtectedGroup("dev") {
		t.Error("dev should not be protected")
	}
}

func TestIsProtectedGroup_EmptyConfig(t *testing.T) {
	setupTestDB(t)
	common.OptionMap["auto_group.protected_groups"] = ""
	if IsProtectedGroup("vip") {
		t.Error("empty config: nothing should be protected")
	}
}

// ============ ResolveAndCheckAutoGroup ============

func TestResolveAndCheckAutoGroup_NotMatched(t *testing.T) {
	setupTestDB(t)
	// 无规则
	g, changed, err := ResolveAndCheckAutoGroup("default", "未知岗")
	if err != nil {
		t.Fatal(err)
	}
	if changed {
		t.Error("should not change when no rule matches")
	}
	if g != "default" {
		t.Errorf("expected default, got %s", g)
	}
}

func TestResolveAndCheckAutoGroup_SameGroup(t *testing.T) {
	setupTestDB(t)
	model.CreateGroupMappingRule(&model.GroupMappingRule{
		JobTitle: "工程师", TargetGroup: "dev", Enabled: true,
	})
	g, changed, err := ResolveAndCheckAutoGroup("dev", "工程师")
	if err != nil {
		t.Fatal(err)
	}
	if changed {
		t.Error("should not change when already in target group")
	}
	if g != "dev" {
		t.Errorf("expected dev, got %s", g)
	}
}

func TestResolveAndCheckAutoGroup_Protected(t *testing.T) {
	setupTestDB(t)
	model.CreateGroupMappingRule(&model.GroupMappingRule{
		JobTitle: "工程师", TargetGroup: "dev", Enabled: true,
	})
	common.OptionMap["auto_group.protected_groups"] = "vip"
	g, changed, err := ResolveAndCheckAutoGroup("vip", "工程师")
	if err != nil {
		t.Fatal(err)
	}
	if changed {
		t.Error("should not change when current group is protected")
	}
	if g != "vip" {
		t.Errorf("expected vip (protected), got %s", g)
	}
}

func TestResolveAndCheckAutoGroup_ShouldChange(t *testing.T) {
	setupTestDB(t)
	model.CreateGroupMappingRule(&model.GroupMappingRule{
		JobTitle: "工程师", TargetGroup: "dev", Enabled: true,
	})
	g, changed, err := ResolveAndCheckAutoGroup("pending", "工程师")
	if err != nil {
		t.Fatal(err)
	}
	if !changed {
		t.Error("should change from pending to dev")
	}
	if g != "dev" {
		t.Errorf("expected dev, got %s", g)
	}
}

// ============ 一键初始化聚合 ============

func TestAggregateJobTitleGroupStats(t *testing.T) {
	setupTestDB(t)
	// 构造用户数据
	users := []model.User{
		{Username: "test_u1", DisplayName: "u1", JobTitle: "工程师", Group: "dev"},
		{Username: "test_u2", DisplayName: "u2", JobTitle: "工程师", Group: "dev"},
		{Username: "test_u3", DisplayName: "u3", JobTitle: "工程师", Group: "test"},
		{Username: "test_u4", DisplayName: "u4", JobTitle: "产品", Group: "pm"},
		{Username: "test_u5", DisplayName: "u5", JobTitle: "", Group: "dev"},   // 空 job_title 排除
		{Username: "test_u6", DisplayName: "u6", JobTitle: "销售", Group: "vip"}, // protected 排除
	}
	for i := range users {
		users[i].AffCode = common.GetRandomString(4) + common.GetRandomString(4) // 确保唯一
		if err := model.DB.Create(&users[i]).Error; err != nil {
			t.Fatal(err)
		}
	}
	stats, err := model.AggregateJobTitleGroupStats([]string{"vip"})
	if err != nil {
		t.Fatal(err)
	}
	byJob := map[string]map[string]int{}
	for _, s := range stats {
		if byJob[s.JobTitle] == nil {
			byJob[s.JobTitle] = map[string]int{}
		}
		byJob[s.JobTitle][s.Group] = s.Count
	}
	// 工程师：dev:2, test:1
	if byJob["工程师"]["dev"] != 2 || byJob["工程师"]["test"] != 1 {
		t.Errorf("engineer stats wrong: %+v", byJob["工程师"])
	}
	// 产品：pm:1
	if byJob["产品"]["pm"] != 1 {
		t.Errorf("pm stats wrong: %+v", byJob["产品"])
	}
	// 销售应被排除（vip 在 protected）
	if _, ok := byJob["销售"]; ok {
		t.Error("销售 should be excluded (protected vip)")
	}
	// 空 job_title 应被排除
	if _, ok := byJob[""]; ok {
		t.Error("empty job_title should be excluded")
	}
}

// ================================================================
// 行为测试（集成风格，通过公共接口验证最终效果）
// ================================================================

// 行为 1：用户在 pending 组，有规则「工程师→dev」，
//
//	调 TryAutoGroupOnJobTitle 后，用户在 DB 中的 group 变成 dev。
func TestBehavior_AutoGroupChangesUserGroupInDB(t *testing.T) {
	setupTestDB(t)
	model.CreateGroupMappingRule(&model.GroupMappingRule{
		JobTitle: "工程师", TargetGroup: "dev", Enabled: true,
	})
	u := createTestUser(t, "alice", "pending", "工程师")

	finalGroup, changed := TryAutoGroupOnJobTitle(u.Id, u.Group, "工程师")

	if !changed {
		t.Fatal("expected changed=true")
	}
	if finalGroup != "dev" {
		t.Fatalf("expected finalGroup=dev, got %s", finalGroup)
	}
	// 核心验证：DB 中的 group 确实变了
	reloaded := reloadUser(t, u.Id)
	if reloaded.Group != "dev" {
		t.Errorf("DB group should be dev after auto-group, got %s", reloaded.Group)
	}
}

// 行为 2：用户已在目标分组（dev），调 TryAutoGroupOnJobTitle 不做任何变更。
func TestBehavior_NoChangeWhenAlreadyInTargetGroup(t *testing.T) {
	setupTestDB(t)
	model.CreateGroupMappingRule(&model.GroupMappingRule{
		JobTitle: "工程师", TargetGroup: "dev", Enabled: true,
	})
	u := createTestUser(t, "bob", "dev", "工程师")

	_, changed := TryAutoGroupOnJobTitle(u.Id, u.Group, "工程师")

	if changed {
		t.Error("should not change when already in target group")
	}
	reloaded := reloadUser(t, u.Id)
	if reloaded.Group != "dev" {
		t.Errorf("group should remain dev, got %s", reloaded.Group)
	}
}

// 行为 3：用户当前分组在白名单中（vip），即使命中规则也不被修改。
func TestBehavior_ProtectedGroupNotOverwritten(t *testing.T) {
	setupTestDB(t)
	model.CreateGroupMappingRule(&model.GroupMappingRule{
		JobTitle: "工程师", TargetGroup: "dev", Enabled: true,
	})
	common.OptionMap["auto_group.protected_groups"] = "vip"
	u := createTestUser(t, "carol", "vip", "工程师")

	_, changed := TryAutoGroupOnJobTitle(u.Id, u.Group, "工程师")

	if changed {
		t.Error("should not change when current group is protected")
	}
	reloaded := reloadUser(t, u.Id)
	if reloaded.Group != "vip" {
		t.Errorf("group should remain vip (protected), got %s", reloaded.Group)
	}
}

// 行为 4：用户岗位没有对应规则，分组不变。
func TestBehavior_NoRuleNoChange(t *testing.T) {
	setupTestDB(t)
	// 不创建任何规则
	u := createTestUser(t, "dave", "pending", "未知岗")

	_, changed := TryAutoGroupOnJobTitle(u.Id, u.Group, "未知岗")

	if changed {
		t.Error("should not change when no rule matches")
	}
	reloaded := reloadUser(t, u.Id)
	if reloaded.Group != "pending" {
		t.Errorf("group should remain pending, got %s", reloaded.Group)
	}
}

// 行为 5：规则被禁用后不再匹配。
func TestBehavior_DisabledRuleNotMatched(t *testing.T) {
	setupTestDB(t)
	model.CreateGroupMappingRule(&model.GroupMappingRule{
		JobTitle: "设计师", TargetGroup: "design", Enabled: false,
	})
	u := createTestUser(t, "eve", "pending", "设计师")

	_, changed := TryAutoGroupOnJobTitle(u.Id, u.Group, "设计师")

	if changed {
		t.Error("disabled rule should not trigger change")
	}
	reloaded := reloadUser(t, u.Id)
	if reloaded.Group != "pending" {
		t.Errorf("group should remain pending, got %s", reloaded.Group)
	}
}

// 行为 6：JobTitle 为空时不触发变更（创建时拿不到 job_title 的兜底）。
func TestBehavior_EmptyJobTitleNoChange(t *testing.T) {
	setupTestDB(t)
	model.CreateGroupMappingRule(&model.GroupMappingRule{
		JobTitle: "", TargetGroup: "dev", Enabled: true,
	})
	u := createTestUser(t, "frank", "pending", "")

	_, changed := TryAutoGroupOnJobTitle(u.Id, u.Group, "")

	if changed {
		t.Error("empty job_title should not trigger change")
	}
}

// 行为 7：分组变更后，bind_group 订阅会被同步创建（端到端验证订阅联动）。
func TestBehavior_GroupChangeTriggersSubscriptionSync(t *testing.T) {
	setupTestDB(t)
	// 准备规则
	model.CreateGroupMappingRule(&model.GroupMappingRule{
		JobTitle: "工程师", TargetGroup: "dev", Enabled: true,
	})
	// 准备 dev 分组的 bind_group 订阅计划
	plan := &model.SubscriptionPlan{
		Title:       "dev 套餐",
		BindGroup:   "dev",
		Enabled:     true,
		TotalAmount: 1000000,
	}
	model.DB.Create(plan)
	u := createTestUser(t, "grace", "pending", "工程师")

	TryAutoGroupOnJobTitle(u.Id, u.Group, "工程师")

	// 验证：用户的 bind_group 订阅被创建
	var count int64
	model.DB.Model(&model.UserSubscription{}).
		Where("user_id = ? AND source = ?", u.Id, "bind_group").
		Count(&count)
	if count != 1 {
		t.Errorf("expected 1 bind_group subscription, got %d", count)
	}
}

// 行为 8：分组从 dev 切换到 pm 时，旧的 dev bind_group 订阅被删除、新的 pm 订阅被创建。
func TestBehavior_GroupSwitchDeletesOldAndCreatesNewSubscription(t *testing.T) {
	setupTestDB(t)
	model.CreateGroupMappingRule(&model.GroupMappingRule{
		JobTitle: "全栈", TargetGroup: "pm", Enabled: true,
	})
	devPlan := &model.SubscriptionPlan{Title: "dev 套餐", BindGroup: "dev", Enabled: true, TotalAmount: 500000}
	pmPlan := &model.SubscriptionPlan{Title: "pm 套餐", BindGroup: "pm", Enabled: true, TotalAmount: 800000}
	model.DB.Create(devPlan)
	model.DB.Create(pmPlan)
	u := createTestUser(t, "heidi", "dev", "全栈")

	TryAutoGroupOnJobTitle(u.Id, u.Group, "全栈")

	// dev 订阅应被删除
	var devCount int64
	model.DB.Model(&model.UserSubscription{}).
		Where("user_id = ? AND source = ?", u.Id, "bind_group").
		Count(&devCount)
	if devCount != 1 {
		t.Errorf("expected 1 bind_group sub (pm only), got %d", devCount)
	}
	// 验证新订阅是 pm 的
	var sub model.UserSubscription
	model.DB.Where("user_id = ? AND source = ?", u.Id, "bind_group").First(&sub)
	if sub.PlanId != pmPlan.Id {
		t.Errorf("expected plan_id=%d (pm), got %d", pmPlan.Id, sub.PlanId)
	}
}

// 行为 9：变更后系统日志被记录。
func TestBehavior_AutoGroupWritesSystemLog(t *testing.T) {
	setupTestDB(t)
	model.CreateGroupMappingRule(&model.GroupMappingRule{
		JobTitle: "工程师", TargetGroup: "dev", Enabled: true,
	})
	u := createTestUser(t, "ivan", "pending", "工程师")

	TryAutoGroupOnJobTitle(u.Id, u.Group, "工程师")

	var logCount int64
	model.DB.Model(&model.Log{}).
		Where("user_id = ? AND type = ?", u.Id, model.LogTypeSystem).
		Count(&logCount)
	if logCount == 0 {
		t.Error("expected at least 1 system log entry after auto-group")
	}
}

// 行为 10：TryAutoGroupOnJobTitle 在内部 panic 时安全 recover，不向上抛。
func TestBehavior_PanicDoesNotPropagate(t *testing.T) {
	setupTestDB(t)
	// 故意构造会导致 panic 的场景：删掉 DB 连接
	model.CreateGroupMappingRule(&model.GroupMappingRule{
		JobTitle: "工程师", TargetGroup: "dev", Enabled: true,
	})
	u := createTestUser(t, "judy", "pending", "工程师")
	// 替换 DB 为一个会 panic 的 session（模拟极端故障）
	origDB := model.DB
	model.DB = nil
	defer func() { model.DB = origDB }()

	// 不应 panic
	finalGroup, changed := TryAutoGroupOnJobTitle(u.Id, u.Group, "工程师")

	if changed {
		t.Error("should not report changed on failure")
	}
	if finalGroup != "pending" {
		t.Errorf("should return original group on failure, got %s", finalGroup)
	}
}
