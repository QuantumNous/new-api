package router

import (
	"maps"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// The DSNs point only at disposable databases, following the management tests'
// three-engine fixture convention. No existing application database is used.
func TestGroupMigrationPreview(t *testing.T) {
	dialect := os.Getenv("TEST_GROUP_MIGRATION_DIALECT")
	if dialect == "" {
		dialect = "sqlite"
	}
	var driver gorm.Dialector
	databaseType := common.DatabaseTypeSQLite
	switch dialect {
	case "sqlite":
		driver = sqlite.Open(filepath.Join(t.TempDir(), "preview.db"))
	case "mysql":
		driver = mysql.Open(os.Getenv("TEST_MYSQL_DSN"))
		databaseType = common.DatabaseTypeMySQL
	case "postgres":
		driver = postgres.Open(os.Getenv("TEST_POSTGRES_DSN"))
		databaseType = common.DatabaseTypePostgreSQL
	default:
		t.Fatalf("unsupported test dialect: %s", dialect)
	}
	db, err := gorm.Open(driver, &gorm.Config{})
	require.NoError(t, err)
	oldDB, oldLogDB, oldRedis := model.DB, model.LOG_DB, common.RedisEnabled
	oldMain, oldLog := common.MainDatabaseType(), common.LogDatabaseType()
	model.DB, model.LOG_DB, common.RedisEnabled = db, db, false
	common.SetDatabaseTypes(databaseType, databaseType)
	// Initialize dialect-specific column quoting through the normal startup path,
	// while leaving schema migration to this disposable fixture.
	t.Setenv("LOG_SQL_DSN", "")
	previousMaster := common.IsMasterNode
	common.IsMasterNode = false
	require.NoError(t, model.InitLogDB())
	common.IsMasterNode = previousMaster
	t.Cleanup(func() {
		model.DB, model.LOG_DB, common.RedisEnabled = oldDB, oldLogDB, oldRedis
		common.SetDatabaseTypes(oldMain, oldLog)
		common.IsMasterNode = false
		require.NoError(t, model.InitLogDB())
		common.IsMasterNode = previousMaster
		model.LOG_DB = oldLogDB
		sqlDB, _ := db.DB()
		_ = sqlDB.Close()
	})
	require.NoError(t, i18n.Init())
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.UserSession{}, &model.UserAccessToken{}, &model.Option{}, &model.Token{}, &model.Channel{}, &model.Ability{}, &model.SubscriptionPlan{}, &model.UserSubscription{}, &model.Task{}, &model.Midjourney{}, &model.AuditLog{}))
	versionQuery := "SELECT version()"
	if dialect == "sqlite" {
		versionQuery = "SELECT sqlite_version()"
	}
	var engineVersion string
	require.NoError(t, db.Raw(versionQuery).Scan(&engineVersion).Error)
	t.Logf("database: %s %s", dialect, engineVersion)
	db = db.Begin()
	require.NoError(t, db.Error)
	model.DB, model.LOG_DB = db, db
	t.Cleanup(func() { require.NoError(t, db.Rollback().Error) })

	root := model.User{Username: "preview-root", AffCode: "preview-root", Password: "never-expose-password", Role: common.RoleRootUser, Status: common.UserStatusEnabled, Group: "default", AuthVersion: 1}
	require.NoError(t, db.Create(&root).Error)
	require.NoError(t, model.PublishUserAuthCache(root.Id))
	now := time.Now().Unix()
	require.NoError(t, model.CreateUserSession(&model.UserSession{SID: "preview-session", UserID: root.Id, Version: 1, UserAuthVersion: 1, Status: model.UserSessionStatusActive, RefreshHash: "private-refresh-hash", LoginMethod: "password", LastActiveAt: now, ExpiresAt: now + 3600}))
	credential, _, err := service.IssueAccessToken(service.AuthIdentity{UserID: root.Id, SessionID: "preview-session", UserAuthVersion: 1, SessionVersion: 1})
	require.NoError(t, err)
	previousRatio := ratio_setting.GroupRatio2JSONString()
	previousOptions := common.OptionMap
	common.OptionMap = map[string]string{}
	t.Cleanup(func() { common.OptionMap = previousOptions })
	t.Cleanup(func() { require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(previousRatio)) })
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1,"vip":0.8}`))
	require.NoError(t, db.Create(&model.Option{Key: "GroupRatio", Value: `{"default":1,"vip":0.8}`}).Error)
	token := model.Token{UserId: root.Id, Key: "never-expose-key", Group: "vip", AutoGroups: `["vip","default","vip"]`}
	require.NoError(t, db.Create(&token).Error)
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	SetApiRouter(engine)
	type managementResult struct {
		Success bool
		Message string
	}
	manage := func(t *testing.T, method, path string, payload any) managementResult {
		t.Helper()
		data, err := common.Marshal(payload)
		require.NoError(t, err)
		req := httptest.NewRequest(method, path, strings.NewReader(string(data)))
		req.Header.Set("Authorization", "Bearer "+credential)
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		engine.ServeHTTP(rec, req)
		require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
		var result managementResult
		require.NoError(t, common.Unmarshal(rec.Body.Bytes(), &result))
		return result
	}
	request := httptest.NewRequest(http.MethodGet, "/api/option/group_migration/preview?source=vip&target="+url.QueryEscape("premium"), nil)
	request.Header.Set("Authorization", "Bearer "+credential)
	response := httptest.NewRecorder()
	engine.ServeHTTP(response, request)
	require.Equal(t, http.StatusOK, response.Code, response.Body.String())
	var body struct {
		Success bool
		Data    struct {
			Source, Target, Version string
			Counts                  map[string]struct {
				Records    int
				References int
			}
			Blockers []string
		}
	}
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &body))
	require.True(t, body.Success, response.Body.String())
	assert.Equal(t, "vip", body.Data.Source)
	assert.Equal(t, "premium", body.Data.Target)
	assert.NotEmpty(t, body.Data.Version)
	assert.Equal(t, 1, body.Data.Counts["tokens"].Records)
	assert.Equal(t, 3, body.Data.Counts["tokens"].References)
	assert.Empty(t, body.Data.Blockers)
	assert.NotContains(t, response.Body.String(), token.Key)
	assert.NotContains(t, response.Body.String(), root.Password)
	var saved model.Token
	require.NoError(t, db.First(&saved, token.Id).Error)
	assert.Equal(t, token, saved)
	t.Run("ordinary saves cannot rename a referenced group", func(t *testing.T) {
		for _, key := range []string{"GroupRatio", "group_ratio_setting.group_ratio"} {
			payload, err := common.Marshal(map[string]string{"key": key, "value": `{"default":1,"premium":0.8}`})
			require.NoError(t, err)
			req := httptest.NewRequest(http.MethodPut, "/api/option/", strings.NewReader(string(payload)))
			req.Header.Set("Authorization", "Bearer "+credential)
			req.Header.Set("Content-Type", "application/json")
			rec := httptest.NewRecorder()
			engine.ServeHTTP(rec, req)
			var result struct{ Success bool }
			require.NoError(t, common.Unmarshal(rec.Body.Bytes(), &result))
			assert.False(t, result.Success, rec.Body.String())
			assert.True(t, ratio_setting.ContainsGroupRatio("vip"))
			assert.False(t, ratio_setting.ContainsGroupRatio("premium"))
			var option model.Option
			require.NoError(t, db.Where(map[string]any{"key": "GroupRatio"}).First(&option).Error)
			assert.JSONEq(t, `{"default":1,"vip":0.8}`, option.Value)
		}
	})
	t.Run("group settings save atomically and reject invalid references", func(t *testing.T) {
		require.NoError(t, db.SavePoint("group_settings").Error)
		previousTopup := common.TopupGroupRatio2JSONString()
		previousOptions := maps.Clone(common.OptionMap)
		t.Cleanup(func() {
			common.OptionMap = previousOptions
			require.NoError(t, db.RollbackTo("group_settings").Error)
			require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1,"vip":0.8}`))
			require.NoError(t, common.UpdateTopupGroupRatioByJSONString(previousTopup))
		})
		requestSettings := func(values map[string]string) bool {
			payload, err := common.Marshal(values)
			require.NoError(t, err)
			req := httptest.NewRequest(http.MethodPatch, "/api/option/group_settings", strings.NewReader(string(payload)))
			req.Header.Set("Authorization", "Bearer "+credential)
			req.Header.Set("Content-Type", "application/json")
			rec := httptest.NewRecorder()
			engine.ServeHTTP(rec, req)
			require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
			var result struct{ Success bool }
			require.NoError(t, common.Unmarshal(rec.Body.Bytes(), &result))
			return result.Success
		}
		assert.True(t, requestSettings(map[string]string{"GroupRatio": `{"default":1,"vip":0.8,"new":0.6}`, "TopupGroupRatio": `{"new":0.5}`}))
		assert.True(t, ratio_setting.ContainsGroupRatio("new"))
		assert.False(t, requestSettings(map[string]string{"GroupRatio": `{"default":1,"premium":0.8}`, "TopupGroupRatio": `{}`}))
		assert.True(t, ratio_setting.ContainsGroupRatio("vip"))
		assert.True(t, ratio_setting.ContainsGroupRatio("new"))
		assert.False(t, requestSettings(map[string]string{"TopupGroupRatio": `{"missing":0.5}`}))
		for key, value := range map[string]string{
			"AutoGroups": `[""]`, "UserUsableGroups": `{"":"invalid"}`,
			"GroupSpecialUsableGroup": `{"vip":{"+:":"invalid"}}`,
		} {
			assert.False(t, requestSettings(map[string]string{key: value}), key)
		}
		assert.True(t, requestSettings(map[string]string{"GroupRatio": `{"default":1,"vip":0.8}`, "TopupGroupRatio": `{}`}))
		assert.False(t, ratio_setting.ContainsGroupRatio("new"))
		assert.False(t, requestSettings(map[string]string{"GroupRatio": `{"vip":0.8}`}))
		assert.Error(t, model.UpdateOptionsBulk(map[string]string{"group_ratio_setting.group_ratio": `{"default":1}`}))
		assert.True(t, ratio_setting.ContainsGroupRatio("vip"))
	})
	t.Run("token management rejects missing groups without changing credentials", func(t *testing.T) {
		payload, err := common.Marshal(map[string]any{"id": token.Id, "name": "invalid-edit", "group": "missing", "expired_time": -1, "unlimited_quota": true})
		require.NoError(t, err)
		req := httptest.NewRequest(http.MethodPut, "/api/token/", strings.NewReader(string(payload)))
		req.Header.Set("Authorization", "Bearer "+credential)
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		engine.ServeHTTP(rec, req)
		var result struct{ Success bool }
		require.NoError(t, common.Unmarshal(rec.Body.Bytes(), &result))
		assert.False(t, result.Success, rec.Body.String())
		var unchanged model.Token
		require.NoError(t, db.First(&unchanged, token.Id).Error)
		assert.Equal(t, token, unchanged)
	})
	t.Run("management writes preserve data when references are missing", func(t *testing.T) {
		require.NoError(t, db.SavePoint("management_writes").Error)
		t.Cleanup(func() { require.NoError(t, db.RollbackTo("management_writes").Error) })
		payment := operation_setting.GetPaymentSetting()
		oldPayment := *payment
		payment.ComplianceConfirmed = true
		payment.ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion
		t.Cleanup(func() { *payment = oldPayment })
		member := model.User{Username: "managed", AffCode: "managed", Group: "default", Role: common.RoleAdminUser, Status: common.UserStatusEnabled, AuthVersion: 1}
		require.NoError(t, db.Create(&member).Error)
		channel := model.Channel{Name: "protected-channel", Group: "vip", Type: constant.ChannelTypeOpenAI, Key: "channel-secret", Models: "probe", Tag: common.GetPointer("protected")}
		require.NoError(t, db.Create(&channel).Error)
		for _, tc := range []struct {
			method, path string
			payload      any
		}{
			{http.MethodPut, "/api/user/", map[string]any{"id": member.Id, "username": member.Username, "group": "missing"}},
			{http.MethodPost, "/api/user/", map[string]any{"username": "invalid-new", "password": "Strong-Password-123", "role": common.RoleCommonUser, "group": "missing"}},
			{http.MethodPut, "/api/channel/", map[string]any{"id": channel.Id, "name": "changed", "group": "vip,missing"}},
			{http.MethodPut, "/api/channel/", map[string]any{"id": channel.Id, "name": "changed", "group": ",vip,"}},
			{http.MethodPut, "/api/channel/", map[string]any{"id": channel.Id, "name": "changed", "group": " vip "}},
			{http.MethodPut, "/api/channel/tag", map[string]any{"tag": "protected", "new_tag": "changed", "groups": "missing"}},
			{http.MethodPost, "/api/channel/", map[string]any{"mode": "batch", "channel": map[string]any{"name": "invalid-new", "type": constant.ChannelTypeOpenAI, "key": "one\ntwo", "models": "probe", "group": "missing"}}},
			{http.MethodPost, "/api/subscription/admin/plans", map[string]any{"plan": map[string]any{"title": "invalid", "upgrade_group": "missing"}}},
		} {
			result := manage(t, tc.method, tc.path, tc.payload)
			assert.False(t, result.Success, tc.path)
			assert.Contains(t, strings.ToLower(result.Message), "group", tc.path)
			assert.Contains(t, strings.ToLower(result.Message), "does not exist", tc.path)
		}
		var unchangedUser model.User
		require.NoError(t, db.First(&unchangedUser, member.Id).Error)
		assert.Equal(t, member, unchangedUser)
		var unchangedChannel model.Channel
		require.NoError(t, db.First(&unchangedChannel, channel.Id).Error)
		assert.Equal(t, channel, unchangedChannel)
		var users, channels int64
		require.NoError(t, db.Model(&model.User{}).Where("username = ?", "invalid-new").Count(&users).Error)
		require.NoError(t, db.Model(&model.Channel{}).Where("name = ?", "invalid-new").Count(&channels).Error)
		assert.Zero(t, users)
		assert.Zero(t, channels)
		plan := model.SubscriptionPlan{Title: "legacy-invalid", Enabled: true, UpgradeGroup: "missing", DurationUnit: model.SubscriptionDurationMonth, DurationValue: 1}
		require.NoError(t, db.Create(&plan).Error)
		result := manage(t, http.MethodPost, "/api/subscription/admin/bind", map[string]int{"user_id": member.Id, "plan_id": plan.Id})
		assert.False(t, result.Success)
		assert.Equal(t, "Referenced group does not exist.", result.Message)
		var subscriptions int64
		require.NoError(t, db.Model(&model.UserSubscription{}).Where("user_id = ?", member.Id).Count(&subscriptions).Error)
		assert.Zero(t, subscriptions)
		sub := model.UserSubscription{UserId: member.Id, Status: "active", UpgradeGroup: "default", PrevUserGroup: "missing", EndTime: now + 3600}
		require.NoError(t, db.Create(&sub).Error)
		result = manage(t, http.MethodPost, "/api/subscription/admin/user_subscriptions/"+strconv.Itoa(sub.Id)+"/invalidate", map[string]any{})
		assert.False(t, result.Success)
		assert.Equal(t, "Referenced group does not exist.", result.Message)
		var unchangedSubscription model.UserSubscription
		require.NoError(t, db.First(&unchangedSubscription, sub.Id).Error)
		assert.Equal(t, sub, unchangedSubscription)
		require.NoError(t, db.First(&unchangedUser, member.Id).Error)
		assert.Equal(t, member, unchangedUser)
		require.NoError(t, db.Model(&sub).Update("prev_user_group", "default").Error)
		assert.True(t, manage(t, http.MethodPost, "/api/subscription/admin/user_subscriptions/"+strconv.Itoa(sub.Id)+"/invalidate", map[string]any{}).Success)
	})
	t.Run("token inheritance and ordered auto groups remain usable", func(t *testing.T) {
		require.NoError(t, db.SavePoint("token_semantics").Error)
		t.Cleanup(func() { require.NoError(t, db.RollbackTo("token_semantics").Error) })
		for _, group := range []string{"", "auto", "vip"} {
			assert.True(t, manage(t, http.MethodPut, "/api/token/", map[string]any{"id": token.Id, "group": group, "expired_time": -1, "unlimited_quota": true, "auto_groups": []string{}}).Success, group)
		}
		assert.True(t, manage(t, http.MethodPut, "/api/token/", map[string]any{"id": token.Id, "group": "auto", "expired_time": -1, "unlimited_quota": true, "auto_groups": []string{"vip", "default"}}).Success)
		var saved model.Token
		require.NoError(t, db.First(&saved, token.Id).Error)
		groups, err := saved.GetAutoGroups()
		require.NoError(t, err)
		assert.Equal(t, []string{"vip", "default"}, groups)
		assert.Equal(t, token.Key, saved.Key)
		assert.False(t, manage(t, http.MethodPut, "/api/token/", map[string]any{"id": token.Id, "group": "auto", "expired_time": -1, "unlimited_quota": true, "auto_groups": []string{"vip", "missing"}}).Success)
		var unchanged model.Token
		require.NoError(t, db.First(&unchanged, token.Id).Error)
		assert.Equal(t, saved, unchanged)
	})
	t.Run("original API key still resolves its group and channel after rejected saves", func(t *testing.T) {
		require.NoError(t, db.SavePoint("relay_contract").Error)
		previousMemoryCache := common.MemoryCacheEnabled
		previousUsable := setting.UserUsableGroups2JSONString()
		common.MemoryCacheEnabled = false
		t.Cleanup(func() {
			common.MemoryCacheEnabled = previousMemoryCache
			require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(previousUsable))
			require.NoError(t, db.RollbackTo("relay_contract").Error)
		})
		require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"default":"Default","vip":"VIP"}`))
		key := model.Token{UserId: root.Id, Key: strings.Repeat("a", 48), Group: "vip", UnlimitedQuota: true, ExpiredTime: -1, ModelLimitsEnabled: true, ModelLimits: "probe"}
		require.NoError(t, db.Create(&key).Error)
		channel := model.Channel{Name: "probe", Group: "vip", Type: constant.ChannelTypeOpenAI, Key: "upstream-secret", Models: "probe", Status: common.ChannelStatusEnabled}
		require.NoError(t, channel.Insert())
		engine.POST("/v1/chat/completions", middleware.TokenAuth(), middleware.Distribute(), func(c *gin.Context) {
			assert.Equal(t, "vip", common.GetContextKeyString(c, constant.ContextKeyUsingGroup))
			assert.Equal(t, channel.Id, common.GetContextKeyInt(c, constant.ContextKeyChannelId))
			c.JSON(http.StatusOK, gin.H{"choices": []any{gin.H{"message": gin.H{"content": "available"}}}})
		})
		call := func(modelName string) *httptest.ResponseRecorder {
			req := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(`{"model":"`+modelName+`","messages":[]}`))
			req.Header.Set("Authorization", "Bearer sk-"+key.Key)
			req.Header.Set("Content-Type", "application/json")
			rec := httptest.NewRecorder()
			engine.ServeHTTP(rec, req)
			return rec
		}
		assert.Equal(t, http.StatusOK, call("probe").Code)
		result := manage(t, http.MethodPatch, "/api/option/group_settings", map[string]string{"GroupRatio": `{"default":1,"premium":0.8}`})
		assert.False(t, result.Success)
		assert.Equal(t, "This group is still referenced. Use Group migration to change its name.", result.Message)
		assert.Equal(t, http.StatusOK, call("probe").Code)
		assert.Equal(t, http.StatusForbidden, call("forbidden-model").Code)
		var unchanged model.Token
		require.NoError(t, db.First(&unchanged, key.Id).Error)
		assert.Equal(t, key, unchanged)
	})
	t.Run("group settings require an active root session", func(t *testing.T) {
		payload := `{"GroupRatio":"{\"default\":1,\"vip\":0.5}"}`
		request := func(auth string) int {
			req := httptest.NewRequest(http.MethodPatch, "/api/option/group_settings", strings.NewReader(payload))
			req.Header.Set("Content-Type", "application/json")
			if auth != "" {
				req.Header.Set("Authorization", "Bearer "+auth)
			}
			rec := httptest.NewRecorder()
			engine.ServeHTTP(rec, req)
			return rec.Code
		}
		assert.Equal(t, http.StatusUnauthorized, request(""))
		require.NoError(t, db.Model(&root).Update("role", common.RoleAdminUser).Error)
		require.NoError(t, model.PublishUserAuthCache(root.Id))
		assert.Equal(t, http.StatusForbidden, request(credential))
		require.NoError(t, db.Model(&root).Update("role", common.RoleRootUser).Error)
		require.NoError(t, model.PublishUserAuthCache(root.Id))
		require.NoError(t, db.Model(&model.UserSession{}).Where("sid = ?", "preview-session").Update("expires_at", now-1).Error)
		assert.Equal(t, http.StatusUnauthorized, request(credential))
		require.NoError(t, db.Model(&model.UserSession{}).Where("sid = ?", "preview-session").Update("expires_at", now+3600).Error)
		assert.InDelta(t, 0.8, ratio_setting.GetGroupRatio("vip"), 0.00001)
	})

	t.Run("full impact includes recoverable references and exact elements", func(t *testing.T) {
		settings := ratio_setting.GetGroupRatioSetting()
		previous := map[string]string{
			"GroupGroupRatio":         ratio_setting.GroupGroupRatio2JSONString(),
			"GroupSpecialUsableGroup": settings.GroupSpecialUsableGroup.MarshalJSONString(),
			"AutoGroups":              setting.AutoGroups2JsonString(), "UserUsableGroups": setting.UserUsableGroups2JSONString(),
			"TopupGroupRatio": common.TopupGroupRatio2JSONString(), "ModelRequestRateLimitGroup": setting.ModelRequestRateLimitGroup2JSONString(),
		}
		setters := map[string]func(string) error{
			"GroupGroupRatio":         ratio_setting.UpdateGroupGroupRatioByJSONString,
			"GroupSpecialUsableGroup": func(value string) error { return common.UnmarshalJsonStr(value, settings.GroupSpecialUsableGroup) },
			"AutoGroups":              setting.UpdateAutoGroupsByJsonString, "UserUsableGroups": setting.UpdateUserUsableGroupsByJSONString,
			"TopupGroupRatio": common.UpdateTopupGroupRatioByJSONString, "ModelRequestRateLimitGroup": setting.UpdateModelRequestRateLimitGroupByJSONString,
		}
		t.Cleanup(func() {
			for key, value := range previous {
				require.NoError(t, setters[key](value))
			}
		})
		configs := map[string]string{
			"GroupGroupRatio":         `{"vip":{"vip":0.5},"other":{"vip":0.7}}`,
			"GroupSpecialUsableGroup": `{"vip":{"+:vip":"label","-:vip":"vip","vip2":"vip"},"other":{"vip":"label"}}`,
			"AutoGroups":              `["vip","default","vip"]`, "UserUsableGroups": `{"vip":"vip2"}`,
			"TopupGroupRatio": `{"vip":0.9}`, "ModelRequestRateLimitGroup": `{"vip":[10,20]}`,
		}
		for key, value := range configs {
			require.NoError(t, setters[key](value))
			require.NoError(t, db.Create(&model.Option{Key: key, Value: value}).Error)
		}
		member := model.User{Username: "restorable", AffCode: "restorable", Group: "vip", Status: common.UserStatusDisabled}
		require.NoError(t, db.Create(&member).Error)
		require.NoError(t, db.Delete(&member).Error)
		require.NoError(t, db.Delete(&token).Error)
		channel := model.Channel{Group: "vip,vip2,vip", Key: "channel-secret", Status: common.ChannelStatusManuallyDisabled}
		require.NoError(t, db.Create(&channel).Error)
		require.NoError(t, db.Create(&[]model.Ability{{Group: "vip", Model: "a", ChannelId: channel.Id, Enabled: false}, {Group: "vip", Model: "b", ChannelId: channel.Id, Enabled: true}}).Error)
		require.NoError(t, db.Create(&model.SubscriptionPlan{Title: "disabled", UpgradeGroup: "vip", DowngradeGroup: "vip", Enabled: false}).Error)
		require.NoError(t, db.Create(&[]model.UserSubscription{{UserId: member.Id, Status: "expired", UpgradeGroup: "vip", PrevUserGroup: "vip"}, {UserId: member.Id, Status: "cancelled", DowngradeGroup: "vip"}}).Error)
		require.NoError(t, db.Create(&[]model.Task{{UserId: member.Id, Group: "vip", Status: model.TaskStatusSuccess}, {UserId: member.Id, Group: "vip", Status: model.TaskStatusFailure}}).Error)
		require.NoError(t, db.Create(&model.Midjourney{UserId: member.Id, Status: "IN_PROGRESS", Progress: "100%"}).Error)
		requestPreview := func(source, target, auth string) *httptest.ResponseRecorder {
			req := httptest.NewRequest(http.MethodGet, "/api/option/group_migration/preview?"+url.Values{"source": {source}, "target": {target}}.Encode(), nil)
			if auth != "" {
				req.Header.Set("Authorization", "Bearer "+auth)
			}
			rec := httptest.NewRecorder()
			engine.ServeHTTP(rec, req)
			return rec
		}
		snapshot := func() string {
			state := map[string][]map[string]any{}
			for _, table := range []string{"users", "tokens", "channels", "abilities", "subscription_plans", "user_subscriptions", "tasks", "midjourneys", "options"} {
				var rows []map[string]any
				order := "id"
				if table == "abilities" {
					order = "channel_id, model"
				}
				query := db.Table(table).Order(order)
				if table == "options" {
					query = db.Table(table).Order(clause.OrderByColumn{Column: clause.Column{Name: "key"}})
				}
				require.NoError(t, query.Find(&rows).Error)
				state[table] = rows
			}
			data, err := common.Marshal(state)
			require.NoError(t, err)
			return string(data)
		}
		require.NoError(t, db.Model(&channel).Update("group", " vip ,vip2, vip ").Error)
		before := snapshot()
		response = requestPreview("vip", "premium", credential)
		require.Equal(t, http.StatusOK, response.Code, response.Body.String())
		require.NoError(t, common.Unmarshal(response.Body.Bytes(), &body))
		assert.Empty(t, body.Data.Blockers)
		for category, want := range map[string][2]int{"users": {1, 1}, "tokens": {1, 3}, "channels": {1, 2}, "abilities": {2, 2}, "subscription_plans": {1, 2}, "subscriptions": {2, 3}, "configuration": {7, 13}, "saved_configuration": {7, 13}} {
			assert.Equal(t, want[0], body.Data.Counts[category].Records, category)
			assert.Equal(t, want[1], body.Data.Counts[category].References, category)
		}
		assert.Equal(t, before, snapshot(), "preview must not mutate business rows")
		assert.Contains(t, response.Header().Get("Cache-Control"), "no-store")
		for _, secret := range []string{channel.Key, token.Key, root.Password, member.Username} {
			assert.NotContains(t, response.Body.String(), secret)
		}
		version := body.Data.Version
		require.NoError(t, common.Unmarshal(requestPreview("vip", "premium", credential).Body.Bytes(), &body))
		assert.Equal(t, version, body.Data.Version, "unchanged state has a stable version")
		require.NoError(t, db.Unscoped().Model(&model.Token{}).Where("id = ?", token.Id).Update("auto_groups", `["vip","vip","default"]`).Error)
		require.NoError(t, common.Unmarshal(requestPreview("vip", "premium", credential).Body.Bytes(), &body))
		assert.NotEqual(t, version, body.Data.Version, "order changes must invalidate previews even with identical counts")

		for _, tc := range []struct{ source, target, blocker string }{
			{"vip", "vip2", "Target group is already referenced or configured."},
			{"vip", "vip", "Source and target groups must differ."},
			{"missing", "premium", "Source group does not exist."},
			{"default", "premium", "Built-in groups cannot participate in migration."},
			{"vip", "auto", "Built-in groups cannot participate in migration."},
			{"vip", strings.Repeat("界", 51), "Group names must contain 1 to 50 characters without commas, whitespace, control characters or rule prefixes."},
			{"vip", "a,b", "Group names must contain 1 to 50 characters without commas, whitespace, control characters or rule prefixes."},
			{"vip", "a b", "Group names must contain 1 to 50 characters without commas, whitespace, control characters or rule prefixes."},
			{"vip", "+:rule", "Group names must contain 1 to 50 characters without commas, whitespace, control characters or rule prefixes."},
		} {
			t.Run(tc.source+" to "+tc.target, func(t *testing.T) {
				require.NoError(t, common.Unmarshal(requestPreview(tc.source, tc.target, credential).Body.Bytes(), &body))
				assert.Contains(t, body.Data.Blockers, tc.blocker)
			})
		}
		require.NoError(t, db.Create(&model.Option{Key: "group_ratio_setting.group_group_ratio", Value: `{"unlisted":{"alias-only":0.5}}`}).Error)
		require.NoError(t, common.Unmarshal(requestPreview("vip", "alias-only", credential).Body.Bytes(), &body))
		assert.Contains(t, body.Data.Blockers, "Target group is already referenced or configured.")
		require.NoError(t, db.Model(&channel).Update("group", " vip ,"+strings.Repeat("x", 49)).Error)
		require.NoError(t, common.Unmarshal(requestPreview("vip", strings.Repeat("界", 50), credential).Body.Bytes(), &body))
		assert.Contains(t, body.Data.Blockers, "The migrated channel group list would exceed 64 characters.")
		require.NoError(t, db.Model(&channel).Update("group", "vip,vip2,vip").Error)
		require.NoError(t, db.Model(&model.Option{}).Where(map[string]any{"key": "group_ratio_setting.group_group_ratio"}).Update("value", `{"bad":false}`).Error)
		require.NoError(t, common.Unmarshal(requestPreview("vip", "premium", credential).Body.Bytes(), &body))
		assert.Contains(t, body.Data.Blockers, "Invalid group reference data must be repaired before migration.")
		require.NoError(t, db.Model(&model.Option{}).Where(map[string]any{"key": "group_ratio_setting.group_group_ratio"}).Update("value", `{}`).Error)
		require.NoError(t, db.Create(&[]model.Task{{UserId: root.Id, Group: "vip", Status: model.TaskStatusQueued}, {UserId: member.Id, Group: "other", Status: model.TaskStatusInProgress}, {UserId: member.Id, Group: "vip", Status: model.TaskStatusUnknown}}).Error)
		require.NoError(t, db.Create(&[]model.Midjourney{{UserId: member.Id, Status: "IN_PROGRESS", Progress: "90%"}, {UserId: member.Id, Status: "SUCCESS", Progress: "90%"}}).Error)
		response = requestPreview("vip", "premium", credential)
		var taskBody struct {
			Data struct {
				UnfinishedTasks int `json:"unfinished_tasks"`
			}
		}
		require.NoError(t, common.Unmarshal(response.Body.Bytes(), &taskBody))
		assert.Equal(t, 5, taskBody.Data.UnfinishedTasks, "tasks are deduplicated; Midjourney completion follows progress, not status")
		require.NoError(t, common.Unmarshal(response.Body.Bytes(), &body))
		assert.Contains(t, body.Data.Blockers, "Related unfinished tasks must finish before migration.")
		assert.Equal(t, http.StatusUnauthorized, requestPreview("vip", "premium", "").Code)
		require.NoError(t, db.Model(&root).Update("role", common.RoleAdminUser).Error)
		require.NoError(t, model.PublishUserAuthCache(root.Id))
		assert.Equal(t, http.StatusForbidden, requestPreview("vip", "premium", credential).Code)
		require.NoError(t, db.Model(&root).Update("role", common.RoleRootUser).Error)
		require.NoError(t, model.PublishUserAuthCache(root.Id))
		require.NoError(t, db.Model(&model.UserSession{}).Where("sid = ?", "preview-session").Update("expires_at", now-1).Error)
		assert.Equal(t, http.StatusUnauthorized, requestPreview("vip", "premium", credential).Code)
	})
}
