package router

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
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
	t.Cleanup(func() {
		model.DB, model.LOG_DB, common.RedisEnabled = oldDB, oldLogDB, oldRedis
		common.SetDatabaseTypes(oldMain, oldLog)
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
	t.Cleanup(func() { require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(previousRatio)) })
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1,"vip":0.8}`))
	require.NoError(t, db.Create(&model.Option{Key: "GroupRatio", Value: `{"default":1,"vip":0.8}`}).Error)
	token := model.Token{UserId: root.Id, Key: "never-expose-key", Group: "vip", AutoGroups: `["vip","default","vip"]`}
	require.NoError(t, db.Create(&token).Error)
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	SetApiRouter(engine)
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
