package router

import (
	"context"
	"errors"
	"io"
	"maps"
	"net/http"
	"net/http/httptest"
	"net/http/httputil"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
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
	"github.com/stripe/stripe-go/v81/webhook"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func TestUnusedGroupMigration(t *testing.T) {
	dialect := os.Getenv("TEST_GROUP_MIGRATION_DIALECT")
	var driver gorm.Dialector = sqlite.Open(filepath.Join(t.TempDir(), "migration.db"))
	databaseType := common.DatabaseTypeSQLite
	if dialect == "mysql" {
		driver, databaseType = mysql.Open(os.Getenv("TEST_MYSQL_DSN")), common.DatabaseTypeMySQL
	} else if dialect == "postgres" {
		driver, databaseType = postgres.Open(os.Getenv("TEST_POSTGRES_DSN")), common.DatabaseTypePostgreSQL
	}
	db, err := gorm.Open(driver, &gorm.Config{})
	require.NoError(t, err)
	oldDB, oldLogDB := model.DB, model.LOG_DB
	oldMain, oldLog := common.MainDatabaseType(), common.LogDatabaseType()
	common.SetDatabaseTypes(databaseType, databaseType)
	t.Setenv("LOG_SQL_DSN", "")
	previousMaster := common.IsMasterNode
	common.IsMasterNode = false
	oldOptions, oldRatio := common.OptionMap, ratio_setting.GroupRatio2JSONString()
	oldRedis, oldMemory := common.RedisEnabled, common.MemoryCacheEnabled
	oldRedisClient := common.RDB
	oldUsable, oldTopup := setting.UserUsableGroups2JSONString(), common.TopupGroupRatio2JSONString()
	oldAuto, oldNested := setting.AutoGroups2JsonString(), ratio_setting.GroupGroupRatio2JSONString()
	oldSpecial := ratio_setting.GetGroupRatioSetting().GroupSpecialUsableGroup.MarshalJSONString()
	oldLimits := setting.ModelRequestRateLimitGroup2JSONString()
	common.RedisEnabled, common.MemoryCacheEnabled = false, false
	if os.Getenv("TEST_GROUP_MIGRATION_REDIS_URL") != "" {
		t.Setenv("REDIS_CONN_STRING", os.Getenv("TEST_GROUP_MIGRATION_REDIS_URL"))
		require.NoError(t, common.InitRedisClient())
		common.RedisEnabled = true
	}
	common.MemoryCacheEnabled = os.Getenv("TEST_GROUP_MIGRATION_MEMORY_CACHE") == "true"
	model.DB, model.LOG_DB = db, db
	require.NoError(t, model.InitLogDB())
	common.IsMasterNode = previousMaster
	common.OptionMap = map[string]string{}
	t.Cleanup(func() {
		model.DB, model.LOG_DB = oldDB, oldLogDB
		common.SetDatabaseTypes(oldMain, oldLog)
		common.IsMasterNode = false
		require.NoError(t, model.InitLogDB())
		common.IsMasterNode = previousMaster
		model.LOG_DB = oldLogDB
		common.OptionMap = oldOptions
		common.RedisEnabled, common.MemoryCacheEnabled = oldRedis, oldMemory
		if common.RDB != oldRedisClient {
			require.NoError(t, common.RDB.Close())
			common.RDB = oldRedisClient
		}
		require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(oldUsable))
		require.NoError(t, common.UpdateTopupGroupRatioByJSONString(oldTopup))
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(oldRatio))
		require.NoError(t, setting.UpdateAutoGroupsByJsonString(oldAuto))
		require.NoError(t, ratio_setting.UpdateGroupGroupRatioByJSONString(oldNested))
		require.NoError(t, common.UnmarshalJsonStr(oldSpecial, ratio_setting.GetGroupRatioSetting().GroupSpecialUsableGroup))
		require.NoError(t, setting.UpdateModelRequestRateLimitGroupByJSONString(oldLimits))
		sqlDB, err := db.DB()
		require.NoError(t, err)
		require.NoError(t, sqlDB.Close())
	})
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.UserSession{}, &model.UserAccessToken{}, &model.Option{}, &model.Token{}, &model.Channel{}, &model.Ability{}, &model.SubscriptionPlan{}, &model.UserSubscription{}, &model.SubscriptionPreConsumeRecord{}, &model.SubscriptionOrder{}, &model.TopUp{}, &model.Log{}, &model.Task{}, &model.Midjourney{}, &model.AuditLog{}, &model.SystemInstance{}))
	require.NoError(t, i18n.Init())
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1,"unused":0.75}`))
	require.NoError(t, model.UpdateOptionsBulk(map[string]string{"GroupRatio": `{"default":1,"unused":0.75}`, "UserUsableGroups": `{"unused":"Premium access"}`, "TopupGroupRatio": `{"unused":0.85}`}))
	t.Setenv("GROUP_MIGRATION_SINGLE_NODE", "true")
	require.NoError(t, model.InitGroupMigrations(context.Background()))
	root := model.User{Username: "migration-root", AffCode: "migration-root", Role: common.RoleRootUser, Status: common.UserStatusEnabled, Group: "default", AuthVersion: 1, Quota: 100000}
	require.NoError(t, db.Create(&root).Error)
	require.NoError(t, model.PublishUserAuthCache(root.Id))
	now := time.Now().Unix()
	require.NoError(t, model.CreateUserSession(&model.UserSession{SID: "migration-session", UserID: root.Id, Version: 1, UserAuthVersion: 1, Status: model.UserSessionStatusActive, RefreshHash: "test-refresh-hash", LoginMethod: "password", LastActiveAt: now, ExpiresAt: now + 3600}))
	credential, _, err := service.IssueAccessToken(service.AuthIdentity{UserID: root.Id, SessionID: "migration-session", UserAuthVersion: 1, SessionVersion: 1})
	require.NoError(t, err)
	engine := gin.New()
	SetApiRouter(engine)
	request := func(method, path string, payload any) *httptest.ResponseRecorder {
		data, err := common.Marshal(payload)
		require.NoError(t, err)
		req := httptest.NewRequest(method, path, strings.NewReader(string(data)))
		req.Header.Set("Authorization", "Bearer "+credential)
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		engine.ServeHTTP(rec, req)
		return rec
	}
	preview := request(http.MethodGet, "/api/option/group_migration/preview?source=unused&target=premium", nil)
	var observed struct{ Data model.GroupMigrationPreview }
	require.NoError(t, common.Unmarshal(preview.Body.Bytes(), &observed))
	payload := map[string]any{"source": "unused", "target": "premium", "version": observed.Data.Version, "confirmation": observed.Data.Confirmation, "operation_id": "migration-test-01"}
	t.Run("rejects a stale confirmation and a referenced source", func(t *testing.T) {
		invalid := maps.Clone(payload)
		invalid["confirmation"] = "0.invalid"
		assert.Equal(t, http.StatusConflict, request(http.MethodPost, "/api/option/group_migration", invalid).Code)
		key := model.Token{UserId: root.Id, Key: strings.Repeat("b", 48), Group: "unused", UnlimitedQuota: true, ExpiredTime: -1}
		require.NoError(t, db.Create(&key).Error)
		assert.Equal(t, http.StatusConflict, request(http.MethodPost, "/api/option/group_migration", payload).Code)
		require.NoError(t, db.Unscoped().Delete(&key).Error)
	})
	t.Run("paused writes return temporary unavailability and restart retains the barrier", func(t *testing.T) {
		key := model.Token{UserId: root.Id, Key: strings.Repeat("c", 48), Group: "unused", UnlimitedQuota: true, ExpiredTime: -1}
		require.NoError(t, db.Create(&key).Error)
		engine.POST("/v1/chat/completions", middleware.TokenAuth(), middleware.Distribute(), func(c *gin.Context) { c.Status(http.StatusOK) })
		op := model.GroupMigrationOperation{ID: "interrupted-01", Source: "unused", Target: "premium", State: "paused", ActorID: root.Id}
		require.NoError(t, db.Create(&op).Error)
		require.NoError(t, db.Model(&model.GroupMigrationControl{}).Where("id = ?", 1).Updates(map[string]any{"operation_id": op.ID, "owner": "previous-process"}).Error)
		t.Setenv("GROUP_MIGRATION_SINGLE_NODE", "")
		require.NoError(t, model.InitGroupMigrations(context.Background()))
		response := request(http.MethodPost, "/api/token/", map[string]any{"name": "blocked", "group": "unused", "expired_time": -1, "unlimited_quota": true})
		assert.Equal(t, http.StatusServiceUnavailable, response.Code, response.Body.String())
		req := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(`{"model":"probe","messages":[]}`))
		req.Header.Set("Authorization", "Bearer sk-"+key.Key)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Accept-Language", "zh-CN")
		rec := httptest.NewRecorder()
		engine.ServeHTTP(rec, req)
		assert.Equal(t, http.StatusServiceUnavailable, rec.Code, rec.Body.String())
		assert.Contains(t, rec.Body.String(), "分组正在迁移，请稍后重试。")
		assert.Contains(t, request(http.MethodGet, "/api/option/group_migration/interrupted-01", nil).Body.String(), `"state":"paused"`)
		t.Setenv("GROUP_MIGRATION_SINGLE_NODE", "true")
		recovery := request(http.MethodPost, "/api/option/group_migration/interrupted-01/resume", nil)
		require.Equal(t, http.StatusOK, recovery.Code, recovery.Body.String())
		assert.Contains(t, request(http.MethodGet, "/api/option/group_migration/interrupted-01", nil).Body.String(), `"state":"aborted"`)
		require.NoError(t, db.Unscoped().Delete(&key).Error)
	})
	t.Run("known conflicting instance refuses execution", func(t *testing.T) {
		instance := model.SystemInstance{NodeName: "other-serving-node", LastSeenAt: time.Now().Unix()}
		require.NoError(t, db.Create(&instance).Error)
		assert.Equal(t, http.StatusConflict, request(http.MethodPost, "/api/option/group_migration", payload).Code)
		assert.Contains(t, request(http.MethodGet, "/api/option/group_migration/preview?source=unused&target=premium", nil).Body.String(), "Other known serving instances")
		require.NoError(t, db.Delete(&instance).Error)
	})
	t.Run("resume reconciles a terminal commit whose acknowledgement was lost", func(t *testing.T) {
		op := model.GroupMigrationOperation{ID: "lost-acknowledgement", Source: "unused", Target: "premium", State: "paused", ActorID: root.Id}
		require.NoError(t, db.Create(&op).Error)
		require.NoError(t, db.Model(&model.GroupMigrationControl{}).Where("id = ?", 1).Updates(map[string]any{"operation_id": op.ID, "owner": "previous-process"}).Error)
		t.Setenv("GROUP_MIGRATION_SINGLE_NODE", "")
		require.NoError(t, model.InitGroupMigrations(context.Background()))
		// Model the durable result of a terminal commit with a lost reply: the
		// process still has its pause, while the database has released ownership.
		require.NoError(t, db.Model(&op).Update("state", "aborted").Error)
		require.NoError(t, db.Model(&model.GroupMigrationControl{}).Where("id = ?", 1).Updates(map[string]any{"operation_id": "", "owner": ""}).Error)
		t.Setenv("GROUP_MIGRATION_SINGLE_NODE", "true")
		assert.Contains(t, request(http.MethodPost, "/api/option/group_migration/"+op.ID+"/resume", nil).Body.String(), `"state":"aborted"`)
		release, err := model.AdmitGroupRequest("unused")
		require.NoError(t, err)
		release()
	})
	t.Run("committed operations retain the pause until restart recovery publishes configuration", func(t *testing.T) {
		require.NoError(t, model.UpdateOptionsBulk(map[string]string{"GroupRatio": `{"default":1,"unused":0.75,"recover":0.6}`}))
		var prepared struct{ Data model.GroupMigrationPreview }
		require.NoError(t, common.Unmarshal(request(http.MethodGet, "/api/option/group_migration/preview?source=recover&target=recovered", nil).Body.Bytes(), &prepared))
		require.Empty(t, prepared.Data.ExecutionBlockers)
		require.NoError(t, db.Callback().Update().After("gorm:update").Register("test:withdraw-after-commit", func(tx *gorm.DB) {
			if op, ok := tx.Statement.Dest.(*model.GroupMigrationOperation); ok && op.State == "committed" {
				t.Setenv("GROUP_MIGRATION_SINGLE_NODE", "")
			}
		}))
		response := request(http.MethodPost, "/api/option/group_migration", map[string]any{"source": "recover", "target": "recovered", "version": prepared.Data.Version, "confirmation": prepared.Data.Confirmation, "operation_id": "recover-committed"})
		require.NoError(t, db.Callback().Update().Remove("test:withdraw-after-commit"))
		assert.Contains(t, response.Body.String(), `"state":"committed"`)
		assert.ErrorIs(t, model.ValidateGroupReference("recover", false, false), model.ErrGroupMigrationPaused)
		require.NoError(t, model.InitGroupMigrations(context.Background()))
		assert.ErrorIs(t, model.ValidateGroupReference("recovered", false, false), model.ErrGroupMigrationPaused)
		t.Setenv("GROUP_MIGRATION_SINGLE_NODE", "true")
		response = request(http.MethodPost, "/api/option/group_migration/recover-committed/resume", nil)
		assert.Contains(t, response.Body.String(), `"state":"completed"`)
		assert.NoError(t, model.ValidateGroupReference("recovered", false, false))
		assert.False(t, ratio_setting.ContainsGroupRatio("recover"))
		assert.Equal(t, 0.6, ratio_setting.GetGroupRatioCopy()["recovered"])
		// Return to the original preview's configuration for the remaining cases.
		require.NoError(t, model.UpdateOptionsBulk(map[string]string{"GroupRatio": `{"default":1,"unused":0.75}`}))
		require.NoError(t, common.Unmarshal(request(http.MethodGet, "/api/option/group_migration/preview?source=unused&target=premium", nil).Body.Bytes(), &observed))
		payload["version"], payload["confirmation"] = observed.Data.Version, observed.Data.Confirmation
	})
	t.Run("commit failure rolls back all configuration and releases the pause", func(t *testing.T) {
		require.NoError(t, db.Callback().Create().Before("gorm:create").Register("test:migration-failure", func(tx *gorm.DB) {
			if tx.Statement.Table == "options" {
				tx.AddError(errors.New("injected option write failure"))
			}
		}))
		failed := maps.Clone(payload)
		failed["operation_id"] = "rollback-test-01"
		response := request(http.MethodPost, "/api/option/group_migration", failed)
		require.NoError(t, db.Callback().Create().Remove("test:migration-failure"))
		assert.Contains(t, response.Body.String(), `"state":"aborted"`)
		assert.True(t, ratio_setting.ContainsGroupRatio("unused"))
		assert.False(t, ratio_setting.ContainsGroupRatio("premium"))
		assert.NoError(t, model.ValidateGroupReference("unused", false, false))
	})
	t.Run("accepted requests drain while new references and requests are blocked", func(t *testing.T) {
		release, err := model.AdmitGroupRequest("unused")
		require.NoError(t, err)
		defer release()
		started := make(chan struct{})
		finish := make(chan struct{})
		var submitted *httptest.ResponseRecorder
		var once sync.Once
		require.NoError(t, db.Callback().Create().After("gorm:create").Register("test:migration-paused", func(tx *gorm.DB) {
			if tx.Statement.Table == "group_migration_operations" {
				once.Do(func() { close(started) })
			}
		}))
		pending := maps.Clone(payload)
		pending["operation_id"] = "drain-test-01"
		go func() { submitted = request(http.MethodPost, "/api/option/group_migration", pending); close(finish) }()
		select {
		case <-started:
		case <-time.After(5 * time.Second):
			t.Fatal("migration did not start")
		}
		// The durable callback can run before commit; wait for the public
		// admission boundary to report the local pause, without cancelling it.
		require.Eventually(t, func() bool {
			done, err := model.AdmitGroupRequest("unused")
			if err == nil {
				done()
			}
			return errors.Is(err, model.ErrGroupMigrationPaused)
		}, 5*time.Second, 5*time.Millisecond)
		assert.ErrorIs(t, db.Create(&model.Token{UserId: root.Id, Key: "blocked-background", Group: "premium"}).Error, model.ErrGroupMigrationPaused)
		assert.NoError(t, db.Model(&root).Update("quota", 99999).Error)
		select {
		case <-finish:
			t.Fatal("accepted request was not drained")
		default:
		}
		// Withdraw deployment qualification before commit. Accepted traffic
		// itself remains live until it releases naturally.
		t.Setenv("GROUP_MIGRATION_SINGLE_NODE", "")
		release()
		select {
		case <-finish:
		case <-time.After(5 * time.Second):
			t.Fatal("migration did not finish")
		}
		require.NoError(t, db.Callback().Create().Remove("test:migration-paused"))
		assert.Contains(t, submitted.Body.String(), `"state":"paused"`)
		t.Setenv("GROUP_MIGRATION_SINGLE_NODE", "true")
		assert.Contains(t, request(http.MethodPost, "/api/option/group_migration/drain-test-01/resume", nil).Body.String(), `"state":"aborted"`)
	})
	t.Run("a replaced owner cannot commit or clear the durable pause", func(t *testing.T) {
		op := model.GroupMigrationOperation{ID: "fenced-owner-01", Source: "unused", Target: "premium", State: "paused", ActorID: root.Id}
		require.NoError(t, db.Create(&op).Error)
		require.NoError(t, db.Model(&model.GroupMigrationControl{}).Where("id = ?", 1).Updates(map[string]any{"operation_id": op.ID, "owner": "original-process"}).Error)
		t.Setenv("GROUP_MIGRATION_SINGLE_NODE", "")
		require.NoError(t, model.InitGroupMigrations(context.Background()))
		require.NoError(t, db.Model(&model.GroupMigrationControl{}).Where("id = ?", 1).Update("owner", "replacement-process").Error)
		t.Setenv("GROUP_MIGRATION_SINGLE_NODE", "true")
		response := request(http.MethodPost, "/api/option/group_migration/"+op.ID+"/resume", nil)
		require.Equal(t, http.StatusOK, response.Code, response.Body.String())
		var refused struct{ Data model.GroupMigrationOperation }
		require.NoError(t, common.Unmarshal(response.Body.Bytes(), &refused))
		assert.Equal(t, "paused", refused.Data.State)
		assert.Equal(t, model.ErrGroupMigrationPaused.Error(), refused.Data.Reason)
		var control model.GroupMigrationControl
		require.NoError(t, db.First(&control, 1).Error)
		assert.Equal(t, "replacement-process", control.Owner)
		assert.Equal(t, op.ID, control.OperationID)
		assert.ErrorIs(t, model.ValidateGroupReference("unused", false, false), model.ErrGroupMigrationPaused)
		assert.True(t, ratio_setting.ContainsGroupRatio("unused"))
		require.NoError(t, model.InitGroupMigrations(context.Background()))
		assert.Contains(t, request(http.MethodGet, "/api/option/group_migration/"+op.ID, nil).Body.String(), `"state":"aborted"`)
	})
	response := request(http.MethodPost, "/api/option/group_migration", payload)
	require.Equal(t, http.StatusOK, response.Code, response.Body.String())
	assert.Contains(t, response.Body.String(), `"state":"completed"`)
	assert.True(t, ratio_setting.ContainsGroupRatio("premium"))
	assert.False(t, ratio_setting.ContainsGroupRatio("unused"))
	assert.Equal(t, 0.75, ratio_setting.GetGroupRatioCopy()["premium"])
	retry := request(http.MethodPost, "/api/option/group_migration", payload)
	assert.Equal(t, response.Body.String(), retry.Body.String(), "retry must return the same durable result")
	status := request(http.MethodGet, "/api/option/group_migration/migration-test-01", nil)
	assert.Equal(t, response.Body.String(), status.Body.String())
	t.Run("original API keys retain explicit inherited and automatic routing", func(t *testing.T) {
		oldModelRatio := ratio_setting.ModelRatio2JSONString()
		t.Cleanup(func() { require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(oldModelRatio)) })
		require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(`{"gpt-4o-mini":0.075}`))
		require.NoError(t, model.UpdateOptionsBulk(map[string]string{
			"GroupRatio":                 `{"default":1,"premium":0.75,"routing":0.6,"routing-extra":0.9}`,
			"UserUsableGroups":           `{"routing":"Original access","routing-extra":"Other access","auto":"Automatic"}`,
			"AutoGroups":                 `["routing","routing-extra"]`,
			"GroupGroupRatio":            `{"routing":{"routing":0.6,"routing-extra":0.7},"routing-extra":{"routing":0.55}}`,
			"GroupSpecialUsableGroup":    `{"routing":{"+:routing":"Original access","-:default":"Hidden","routing-extra":"Other access"},"routing-extra":{"-:routing":"Hidden"},"default":{"+:routing":"Granted"}}`,
			"TopupGroupRatio":            `{"routing":0.85,"routing-extra":0.95}`,
			"ModelRequestRateLimitGroup": `{"routing":[120,60],"routing-extra":[90,60]}`,
		}))
		playgroundHeld, releasePlayground := make(chan struct{}, 1), make(chan struct{})
		var playgroundReleaseOnce sync.Once
		defer playgroundReleaseOnce.Do(func() { close(releasePlayground) })
		upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			body, err := io.ReadAll(r.Body)
			assert.NoError(t, err)
			if strings.Contains(string(body), "playground") {
				if strings.Contains(string(body), "playground-hold") {
					playgroundHeld <- struct{}{}
					<-releasePlayground
				}
				_, _ = w.Write([]byte(`{"id":"migration-pg","object":"chat.completion","model":"gpt-4o-mini","choices":[{"index":0,"message":{"role":"assistant","content":"ok"},"finish_reason":"stop"}],"usage":{"prompt_tokens":1,"completion_tokens":1,"total_tokens":2}}`))
				return
			}
			_, _ = w.Write([]byte(`{"upstream":"original"}`))
		}))
		defer upstream.Close()
		baseURL := upstream.URL
		channel := model.Channel{Type: constant.ChannelTypeOpenAI, Key: "upstream-private-key", Name: "migration-routing", Status: common.ChannelStatusEnabled, Group: "routing", Models: "migration-probe,gpt-4o-mini", BaseURL: &baseURL}
		require.NoError(t, db.Create(&channel).Error)
		require.NoError(t, db.Create(&model.Ability{Group: "routing", Model: "migration-probe", ChannelId: channel.Id, Enabled: true}).Error)
		require.NoError(t, db.Create(&model.Ability{Group: "routing", Model: "gpt-4o-mini", ChannelId: channel.Id, Enabled: true}).Error)
		user := model.User{Username: "routing-user", AffCode: "routing-user", Role: common.RoleCommonUser, Status: common.UserStatusEnabled, Group: "routing", AuthVersion: 1, Quota: 7000}
		require.NoError(t, db.Create(&user).Error)
		require.NoError(t, model.PublishUserAuthCache(user.Id))
		autoUser := model.User{Username: "auto-routing-user", AffCode: "auto-routing-user", Role: common.RoleCommonUser, Status: common.UserStatusEnabled, Group: "default", AuthVersion: 1, Quota: 7000}
		require.NoError(t, db.Create(&autoUser).Error)
		require.NoError(t, model.PublishUserAuthCache(autoUser.Id))
		credentials := make(map[int]string)
		for _, account := range []model.User{user, autoUser} {
			sid := "routing-session-" + strconv.Itoa(account.Id)
			require.NoError(t, model.CreateUserSession(&model.UserSession{SID: sid, UserID: account.Id, Version: 1, UserAuthVersion: 1, Status: model.UserSessionStatusActive, RefreshHash: "routing-test-refresh", LoginMethod: "password", LastActiveAt: now, ExpiresAt: now + 3600}))
			access, _, err := service.IssueAccessToken(service.AuthIdentity{UserID: account.Id, SessionID: sid, UserAuthVersion: 1, SessionVersion: 1})
			require.NoError(t, err)
			credentials[account.Id] = access
		}
		playground := gin.New()
		SetRelayRouter(playground)
		playgroundProbe := func(accountID int, content string) *httptest.ResponseRecorder {
			body, err := common.Marshal(map[string]any{"model": "gpt-4o-mini", "group": "auto", "messages": []map[string]string{{"role": "user", "content": content}}})
			require.NoError(t, err)
			req := httptest.NewRequest(http.MethodPost, "/pg/chat/completions", strings.NewReader(string(body)))
			req.Header.Set("Authorization", "Bearer "+credentials[accountID])
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Accept-Language", "en")
			rec := httptest.NewRecorder()
			playground.ServeHTTP(rec, req)
			return rec
		}
		keys := []model.Token{
			{Group: "routing"}, {Group: ""}, {Group: "auto"}, {Group: "auto", AutoGroups: `["routing-extra","routing"]`, CrossGroupRetry: true},
		}
		for i := range keys {
			keys[i].UserId, keys[i].Key = user.Id, strings.Repeat(strconv.Itoa(i+1), 48)
			if i >= 2 {
				keys[i].UserId = autoUser.Id
			}
			keys[i].Status, keys[i].ExpiredTime, keys[i].UnlimitedQuota = common.TokenStatusEnabled, -1, true
			require.NoError(t, db.Create(&keys[i]).Error)
		}
		disabledUser := model.User{Username: "disabled-routing", AffCode: "disabled-routing", Status: common.UserStatusDisabled, Group: "routing", Quota: 321}
		require.NoError(t, db.Create(&disabledUser).Error)
		require.NoError(t, db.Delete(&disabledUser).Error)
		require.NoError(t, db.Unscoped().First(&disabledUser, disabledUser.Id).Error)
		disabledToken := model.Token{UserId: disabledUser.Id, Key: strings.Repeat("9", 48), Group: "routing", Status: common.TokenStatusDisabled, RemainQuota: 456, ModelLimitsEnabled: true, ModelLimits: "migration-probe"}
		require.NoError(t, db.Create(&disabledToken).Error)
		require.NoError(t, db.Delete(&disabledToken).Error)
		require.NoError(t, db.Unscoped().First(&disabledToken, disabledToken.Id).Error)
		priority, weight := int64(5), uint(13)
		disabledChannel := model.Channel{Type: constant.ChannelTypeOpenAI, Key: "disabled-key", Name: "disabled-routing", Status: common.ChannelStatusManuallyDisabled, Group: "routing-extra,routing", Models: "migration-probe", Priority: &priority, Weight: &weight}
		require.NoError(t, db.Create(&disabledChannel).Error)
		disabledAbility := model.Ability{Group: "routing", Model: "migration-probe", ChannelId: disabledChannel.Id, Enabled: false, Priority: &priority, Weight: weight}
		require.NoError(t, db.Create(&disabledAbility).Error)
		history := model.Task{TaskID: "historical-routing", UserId: user.Id, Group: "routing", Status: model.TaskStatusSuccess, Quota: 123}
		require.NoError(t, db.Create(&history).Error)
		log := model.AuditLog{EventId: "historical-routing", UserId: user.Id, Content: "historical routing"}
		require.NoError(t, db.Create(&log).Error)
		// Unfinished inherited tasks prevent execution before any resource changes.
		pendingTask := model.Task{TaskID: "pending-routing", UserId: user.Id, Status: model.TaskStatusInProgress}
		require.NoError(t, db.Create(&pendingTask).Error)
		assert.Contains(t, request(http.MethodGet, "/api/option/group_migration/preview?source=routing&target=migrated", nil).Body.String(), "Related unfinished tasks")
		require.NoError(t, db.Delete(&pendingTask).Error)
		plan := model.SubscriptionPlan{Title: "routing-subscription", UpgradeGroup: "routing"}
		require.NoError(t, db.Create(&plan).Error)
		var subscriptionPreview struct{ Data model.GroupMigrationPreview }
		require.NoError(t, common.Unmarshal(request(http.MethodGet, "/api/option/group_migration/preview?source=routing&target=migrated", nil).Body.Bytes(), &subscriptionPreview))
		assert.Empty(t, subscriptionPreview.Data.ExecutionBlockers)
		require.NoError(t, db.Delete(&plan).Error)
		model.InitChannelCache()
		held := make(chan struct{}, len(keys))
		releaseHeld := make(chan struct{})
		var releaseOnce sync.Once
		defer releaseOnce.Do(func() { close(releaseHeld) })
		relay := gin.New()
		relay.POST("/v1/chat/completions", middleware.TokenAuth(), middleware.Distribute(), func(c *gin.Context) {
			group := common.GetContextKeyString(c, constant.ContextKeyUsingGroup)
			if group == "auto" {
				group = common.GetContextKeyString(c, constant.ContextKeyAutoGroup)
			}
			assert.Equal(t, 0.6, service.GetUserGroupRatio(c.GetString("user_group"), group))
			if c.GetHeader("X-Migration-Hold") == "true" {
				held <- struct{}{}
				<-releaseHeld
			}
			target, err := url.Parse(common.GetContextKeyString(c, constant.ContextKeyChannelBaseUrl))
			require.NoError(t, err)
			httputil.NewSingleHostReverseProxy(target).ServeHTTP(c.Writer, c.Request)
		})
		probe := func(key model.Token, hold bool) *httptest.ResponseRecorder {
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			req := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(`{"model":"migration-probe","messages":[]}`))
			req = req.WithContext(ctx)
			req.Header.Set("Authorization", "Bearer sk-"+key.Key)
			req.Header.Set("Content-Type", "application/json")
			if hold {
				req.Header.Set("X-Migration-Hold", "true")
			}
			rec := httptest.NewRecorder()
			relay.ServeHTTP(rec, req)
			return rec
		}
		call := func(key model.Token) {
			t.Helper()
			rec := probe(key, false)
			require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
			assert.JSONEq(t, `{"upstream":"original"}`, rec.Body.String())
		}
		for _, key := range keys {
			call(key)
		}
		pg := playgroundProbe(autoUser.Id, "playground")
		require.Equal(t, http.StatusOK, pg.Code, pg.Body.String())
		var preview struct{ Data model.GroupMigrationPreview }
		require.NoError(t, common.Unmarshal(request(http.MethodGet, "/api/option/group_migration/preview?source=routing&target=migrated", nil).Body.Bytes(), &preview))
		require.Empty(t, preview.Data.ExecutionBlockers)
		require.Empty(t, preview.Data.Blockers)
		beforeCutover := model.GroupRequestVersion()
		// Fail only after all user/token/channel/ability updates have executed.
		require.NoError(t, db.Callback().Create().Before("gorm:create").Register("test:used-migration-failure", func(tx *gorm.DB) {
			if tx.Statement.Table == "options" {
				tx.AddError(errors.New("injected option write failure after resource writes"))
			}
		}))
		failed := request(http.MethodPost, "/api/option/group_migration", model.GroupMigrationSubmission{OperationID: "routing-rollback-04", Source: "routing", Target: "migrated", Version: preview.Data.Version, Confirmation: preview.Data.Confirmation})
		require.NoError(t, db.Callback().Create().Remove("test:used-migration-failure"))
		require.Contains(t, failed.Body.String(), `"state":"aborted"`)
		var unchangedUser model.User
		require.NoError(t, db.First(&unchangedUser, user.Id).Error)
		assert.Equal(t, "routing", unchangedUser.Group)
		var unchangedToken model.Token
		require.NoError(t, db.First(&unchangedToken, keys[0].Id).Error)
		assert.Equal(t, "routing", unchangedToken.Group)
		var unchangedChannel model.Channel
		require.NoError(t, db.First(&unchangedChannel, channel.Id).Error)
		assert.Equal(t, "routing", unchangedChannel.Group)
		var unchangedAbility model.Ability
		require.NoError(t, db.Where("channel_id = ?", channel.Id).First(&unchangedAbility).Error)
		assert.Equal(t, "routing", unchangedAbility.Group)
		for _, key := range keys {
			call(key)
		}
		// Each accepted routing mode remains active while the migration pauses
		// new admissions, including inherited and automatic dependencies.
		playgroundResponse := make(chan *httptest.ResponseRecorder, 1)
		go func() { playgroundResponse <- playgroundProbe(autoUser.Id, "playground-hold") }()
		select {
		case <-playgroundHeld:
		case <-time.After(5 * time.Second):
			t.Fatal("Playground request did not reach upstream")
		}
		// Hold an authenticated DB snapshot across cutover, before admission.
		if common.RedisEnabled {
			require.NoError(t, common.RDB.Del(context.Background(), "user:"+strconv.Itoa(user.Id)).Err())
		}
		authSnapshotRead, resumeAuth := make(chan struct{}), make(chan struct{})
		var authRead atomic.Bool
		var resumeAuthOnce sync.Once
		defer resumeAuthOnce.Do(func() { close(resumeAuth) })
		require.NoError(t, db.Callback().Query().After("gorm:query").Register("test:stale-routing-auth", func(tx *gorm.DB) {
			account, ok := tx.Statement.Dest.(*model.User)
			if ok && account.Id == user.Id && len(tx.Statement.Selects) == 0 && authRead.CompareAndSwap(false, true) {
				close(authSnapshotRead)
				<-resumeAuth
			}
		}))
		defer func() { require.NoError(t, db.Callback().Query().Remove("test:stale-routing-auth")) }()
		stalePlayground := make(chan *httptest.ResponseRecorder, 1)
		go func() { stalePlayground <- playgroundProbe(user.Id, "playground") }()
		select {
		case <-authSnapshotRead:
		case <-time.After(5 * time.Second):
			t.Fatal("Playground authentication did not read its routing snapshot")
		}
		responses := make(chan *httptest.ResponseRecorder, len(keys))
		for _, key := range keys {
			go func() { responses <- probe(key, true) }()
		}
		for range keys {
			select {
			case <-held:
			case <-time.After(5 * time.Second):
				t.Fatal("routing request did not reach the upstream boundary")
			}
		}
		migrated := make(chan *httptest.ResponseRecorder, 1)
		go func() {
			migrated <- request(http.MethodPost, "/api/option/group_migration", model.GroupMigrationSubmission{OperationID: "routing-migration-04", Source: "routing", Target: "migrated", Version: preview.Data.Version, Confirmation: preview.Data.Confirmation})
		}()
		require.Eventually(t, func() bool {
			done, err := model.AdmitGroupRequest("routing")
			if err == nil {
				done()
			}
			return errors.Is(err, model.ErrGroupMigrationPaused)
		}, 5*time.Second, 5*time.Millisecond)
		for _, key := range keys {
			assert.Equal(t, http.StatusServiceUnavailable, probe(key, false).Code)
		}
		assert.Equal(t, http.StatusServiceUnavailable, playgroundProbe(autoUser.Id, "playground").Code)
		assert.ErrorIs(t, db.Create(&model.Task{TaskID: "blocked-inherited", UserId: user.Id}).Error, model.ErrGroupMigrationPaused)
		assert.ErrorIs(t, db.Create(&model.Midjourney{UserId: user.Id}).Error, model.ErrGroupMigrationPaused)
		assert.ErrorIs(t, db.Model(&keys[0]).Update("group", "routing").Error, model.ErrGroupMigrationPaused)
		select {
		case <-migrated:
			t.Fatal("migration completed before accepted requests drained")
		default:
		}
		releaseOnce.Do(func() { close(releaseHeld) })
		for range keys {
			select {
			case rec := <-responses:
				assert.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
			case <-time.After(5 * time.Second):
				t.Fatal("accepted routing request did not finish")
			}
		}
		select {
		case <-migrated:
			t.Fatal("migration completed before Playground drained")
		default:
		}
		playgroundReleaseOnce.Do(func() { close(releasePlayground) })
		select {
		case rec := <-playgroundResponse:
			assert.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
		case <-time.After(5 * time.Second):
			t.Fatal("accepted Playground request did not finish")
		}
		var result *httptest.ResponseRecorder
		select {
		case result = <-migrated:
		case <-time.After(5 * time.Second):
			t.Fatal("migration did not finish after request drain")
		}
		require.Equal(t, http.StatusOK, result.Code, result.Body.String())
		require.Contains(t, result.Body.String(), `"state":"completed"`)
		resumeAuthOnce.Do(func() { close(resumeAuth) })
		select {
		case rec := <-stalePlayground:
			assert.Equal(t, http.StatusServiceUnavailable, rec.Code, rec.Body.String())
			assert.Contains(t, rec.Body.String(), "Group migration is in progress")
		case <-time.After(5 * time.Second):
			t.Fatal("stale Playground authentication did not finish")
		}
		pg = playgroundProbe(autoUser.Id, "playground")
		require.Equal(t, http.StatusOK, pg.Code, pg.Body.String())
		for _, key := range keys {
			call(key)
		}
		var inherited, custom model.Token
		require.NoError(t, db.First(&inherited, keys[1].Id).Error)
		require.NoError(t, db.First(&custom, keys[3].Id).Error)
		assert.Empty(t, inherited.Group)
		assert.JSONEq(t, `["routing-extra","migrated"]`, custom.AutoGroups)
		assert.Equal(t, keys[3].Key, custom.Key)
		assert.True(t, custom.CrossGroupRetry)
		assert.Equal(t, []string{"migrated", "routing-extra"}, setting.GetAutoGroups())
		assert.Equal(t, 0.9, ratio_setting.GetGroupRatio("routing-extra"))
		unrelated, err := model.AdmitGroupRequestAtVersion(beforeCutover, "routing-extra")
		require.NoError(t, err, "unrelated authentication may span a migration")
		unrelated()
		_, err = model.AdmitGroupRequestAtVersion(beforeCutover, "routing")
		assert.ErrorIs(t, err, model.ErrGroupMigrationPaused)
		var restoredUser model.User
		require.NoError(t, db.Unscoped().First(&restoredUser, disabledUser.Id).Error)
		disabledUser.Group = "migrated"
		assert.Equal(t, disabledUser, restoredUser)
		var restoredToken model.Token
		require.NoError(t, db.Unscoped().First(&restoredToken, disabledToken.Id).Error)
		disabledToken.Group = "migrated"
		assert.Equal(t, disabledToken, restoredToken)
		var restoredChannel model.Channel
		require.NoError(t, db.First(&restoredChannel, disabledChannel.Id).Error)
		disabledChannel.Group = "routing-extra,migrated"
		assert.Equal(t, disabledChannel, restoredChannel)
		var restoredAbility model.Ability
		require.NoError(t, db.Where("channel_id = ?", disabledChannel.Id).First(&restoredAbility).Error)
		disabledAbility.Group = "migrated"
		assert.Equal(t, disabledAbility, restoredAbility)
		var historical model.Task
		require.NoError(t, db.First(&historical, history.ID).Error)
		assert.Equal(t, history, historical)
		var historicalLog model.AuditLog
		require.NoError(t, db.First(&historicalLog, log.Id).Error)
		assert.Equal(t, log, historicalLog)
		assert.JSONEq(t, `{"migrated":{"migrated":0.6,"routing-extra":0.7},"routing-extra":{"migrated":0.55}}`, ratio_setting.GroupGroupRatio2JSONString())
		assert.JSONEq(t, `{"migrated":{"+:migrated":"Original access","-:default":"Hidden","routing-extra":"Other access"},"routing-extra":{"-:migrated":"Hidden"},"default":{"+:migrated":"Granted"}}`, ratio_setting.GetGroupRatioSetting().GroupSpecialUsableGroup.MarshalJSONString())
		assert.JSONEq(t, `{"migrated":0.85,"routing-extra":0.95}`, common.TopupGroupRatio2JSONString())
		assert.JSONEq(t, `{"migrated":[120,60],"routing-extra":[90,60]}`, setting.ModelRequestRateLimitGroup2JSONString())
	})
	t.Run("subscription transitions survive migration and retry", func(t *testing.T) {
		oldStripeSecret, oldStripeWebhook, oldStripePrice := setting.StripeApiSecret, setting.StripeWebhookSecret, setting.StripePriceId
		t.Cleanup(func() {
			setting.StripeApiSecret, setting.StripeWebhookSecret, setting.StripePriceId = oldStripeSecret, oldStripeWebhook, oldStripePrice
		})
		setting.StripeApiSecret, setting.StripeWebhookSecret, setting.StripePriceId = "sk_test_migration", "whsec_migration", "price_migration"
		payment := operation_setting.GetPaymentSetting()
		oldPayment := *payment
		t.Cleanup(func() { *payment = oldPayment })
		payment.ComplianceConfirmed = true
		payment.ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion
		var groups map[string]float64
		require.NoError(t, common.UnmarshalJsonStr(ratio_setting.GroupRatio2JSONString(), &groups))
		groups["subscription-old"], groups["subscription-vip"] = 0.8, 0.6
		encoded, err := common.Marshal(groups)
		require.NoError(t, err)
		require.NoError(t, model.UpdateOptionsBulk(map[string]string{"GroupRatio": string(encoded)}))
		users := []model.User{
			{Username: "subscription-payment", AffCode: "sub-payment", Group: "default", Status: common.UserStatusEnabled},
			{Username: "subscription-explicit", AffCode: "sub-explicit", Group: "default", Status: common.UserStatusEnabled},
			{Username: "subscription-restore", AffCode: "sub-restore", Group: "subscription-old", Status: common.UserStatusEnabled},
			{Username: "subscription-bind", AffCode: "sub-bind", Group: "default", Status: common.UserStatusEnabled},
		}
		require.NoError(t, db.Create(&users).Error)
		plans := []model.SubscriptionPlan{
			{Title: "purchase upgrade", UpgradeGroup: "subscription-old", DowngradeGroup: "default", Enabled: true, PriceAmount: 2.5, TotalAmount: 321, DurationUnit: model.SubscriptionDurationDay, DurationValue: 7, QuotaResetPeriod: model.SubscriptionResetDaily},
			{Title: "explicit downgrade", UpgradeGroup: "subscription-vip", DowngradeGroup: "subscription-old", Enabled: true, TotalAmount: 654, DurationUnit: model.SubscriptionDurationDay, DurationValue: 3},
			{Title: "restore previous", UpgradeGroup: "subscription-vip", Enabled: true, DurationUnit: model.SubscriptionDurationDay, DurationValue: 2},
		}
		require.NoError(t, db.Create(&plans).Error)
		require.Contains(t, request(http.MethodPost, "/api/subscription/admin/bind", map[string]int{"user_id": users[0].Id, "plan_id": plans[0].Id}).Body.String(), `"success":true`)
		refundable, err := model.PreConsumeUserSubscription("migration-refundable", users[0].Id, "migration-probe", 0, 3)
		require.NoError(t, err)
		for i := 1; i <= 2; i++ {
			rec := request(http.MethodPost, "/api/subscription/admin/bind", map[string]int{"user_id": users[i].Id, "plan_id": plans[i].Id})
			require.Contains(t, rec.Body.String(), `"success":true`)
		}
		// Disabled plans and cancelled/expired snapshots remain usable by later
		// binding, invalidation or deletion; a status filter would lose references.
		require.NoError(t, db.Model(&plans[1]).Update("enabled", false).Error)
		require.NoError(t, db.First(&plans[1], plans[1].Id).Error)
		now := model.GetDBTimestamp()
		require.NoError(t, db.Model(&model.UserSubscription{}).Where("id = ?", refundable.UserSubscriptionId).Updates(map[string]any{"last_reset_time": now - 2*86400, "next_reset_time": now - 1}).Error)
		require.NoError(t, db.Model(&model.UserSubscription{}).Where("user_id IN ?", []int{users[1].Id, users[2].Id}).Update("end_time", now-1).Error)
		inactive := []model.UserSubscription{
			{UserId: users[3].Id, Status: "expired", UpgradeGroup: "subscription-old", PrevUserGroup: "subscription-old", AmountTotal: 77, AmountUsed: 13, EndTime: now - 10},
			{UserId: users[3].Id, Status: "cancelled", DowngradeGroup: "subscription-old", EndTime: now - 5},
		}
		require.NoError(t, db.Create(&inactive).Error)
		var before []model.UserSubscription
		require.NoError(t, db.Where("user_id IN ?", []int{users[1].Id, users[2].Id, users[3].Id}).Order("id").Find(&before).Error)
		order := model.SubscriptionOrder{UserId: users[0].Id, PlanId: plans[0].Id, TradeNo: "subscription-migration-order", Money: 2.5, Status: common.TopUpStatusPending, PaymentProvider: model.PaymentProviderEpay, PaymentMethod: "alipay"}
		require.NoError(t, order.Insert())
		stripeEvents := make([]*webhook.SignedPayload, 0, 2)
		for _, eventType := range []string{"checkout.session.completed", "checkout.session.async_payment_succeeded"} {
			stripeOrder := model.SubscriptionOrder{UserId: users[0].Id, PlanId: plans[0].Id, TradeNo: "migration-" + eventType, Money: 2.5, Status: common.TopUpStatusPending, PaymentProvider: model.PaymentProviderStripe, PaymentMethod: "stripe"}
			require.NoError(t, stripeOrder.Insert())
			body, err := common.Marshal(map[string]any{"id": "evt_" + eventType, "object": "event", "type": eventType, "data": map[string]any{"object": map[string]string{"id": "cs_test", "client_reference_id": stripeOrder.TradeNo, "status": "complete", "payment_status": "paid"}}})
			require.NoError(t, err)
			stripeEvents = append(stripeEvents, webhook.GenerateTestSignedPayload(&webhook.UnsignedPayload{Payload: body, Secret: setting.StripeWebhookSecret}))
		}
		stripeCallback := func(event *webhook.SignedPayload) *httptest.ResponseRecorder {
			req := httptest.NewRequest(http.MethodPost, "/api/stripe/webhook", strings.NewReader(string(event.Payload)))
			req.Header.Set("Stripe-Signature", event.Header)
			rec := httptest.NewRecorder()
			engine.ServeHTTP(rec, req)
			return rec
		}
		// Warm the actual plan cache before cutover.
		cached, err := model.GetSubscriptionPlanById(plans[0].Id)
		require.NoError(t, err)
		require.Equal(t, "subscription-old", cached.UpgradeGroup)
		var preview struct{ Data model.GroupMigrationPreview }
		require.NoError(t, common.Unmarshal(request(http.MethodGet, "/api/option/group_migration/preview?source=subscription-old&target=subscription-new", nil).Body.Bytes(), &preview))
		require.Empty(t, preview.Data.Blockers)
		require.Empty(t, preview.Data.ExecutionBlockers)
		assert.Equal(t, model.GroupReferenceCount{Records: 2, References: 2}, preview.Data.Counts["subscription_plans"])
		assert.Equal(t, model.GroupReferenceCount{Records: 5, References: 6}, preview.Data.Counts["subscriptions"])
		// Fail after subscription and user updates, before configuration commits.
		require.NoError(t, db.Callback().Create().Before("gorm:create").Register("test:subscription-migration-failure", func(tx *gorm.DB) {
			if tx.Statement.Table == "options" {
				tx.AddError(errors.New("injected subscription migration failure"))
			}
		}))
		failed := request(http.MethodPost, "/api/option/group_migration", model.GroupMigrationSubmission{OperationID: "subscription-rollback-05", Source: "subscription-old", Target: "subscription-new", Version: preview.Data.Version, Confirmation: preview.Data.Confirmation})
		require.NoError(t, db.Callback().Create().Remove("test:subscription-migration-failure"))
		require.Contains(t, failed.Body.String(), `"state":"aborted"`)
		var rolledBack []model.UserSubscription
		require.NoError(t, db.Where("user_id IN ?", []int{users[1].Id, users[2].Id, users[3].Id}).Order("id").Find(&rolledBack).Error)
		assert.Equal(t, before, rolledBack)
		var rolledBackPlans []model.SubscriptionPlan
		require.NoError(t, db.Where("id IN ?", []int{plans[0].Id, plans[1].Id, plans[2].Id}).Order("id").Find(&rolledBackPlans).Error)
		assert.Equal(t, plans, rolledBackPlans)
		assert.Contains(t, ratio_setting.GroupRatio2JSONString(), `"subscription-old"`)
		assert.NotContains(t, ratio_setting.GroupRatio2JSONString(), `"subscription-new"`)
		require.NoError(t, common.Unmarshal(request(http.MethodGet, "/api/option/group_migration/preview?source=subscription-old&target=subscription-new", nil).Body.Bytes(), &preview))
		payload := model.GroupMigrationSubmission{OperationID: "subscription-cutover-05", Source: "subscription-old", Target: "subscription-new", Version: preview.Data.Version, Confirmation: preview.Data.Confirmation}
		release, err := model.AdmitGroupRequest("subscription-old")
		require.NoError(t, err)
		var releaseOnce sync.Once
		defer releaseOnce.Do(release)
		finished := make(chan *httptest.ResponseRecorder, 1)
		go func() { finished <- request(http.MethodPost, "/api/option/group_migration", payload) }()
		require.Eventually(t, func() bool {
			done, err := model.AdmitGroupRequest("subscription-old")
			if err == nil {
				done()
			}
			return errors.Is(err, model.ErrGroupMigrationPaused)
		}, 5*time.Second, 5*time.Millisecond)
		assert.ErrorIs(t, model.CompleteSubscriptionOrder(order.TradeNo, "paid", model.PaymentProviderEpay, ""), model.ErrGroupMigrationPaused)
		for _, event := range stripeEvents {
			assert.Equal(t, http.StatusServiceUnavailable, stripeCallback(event).Code, "unfulfilled payments must remain retryable")
		}
		_, err = model.AdminResetUserSubscriptionsByPlan(users[1].Id, plans[1].Id, false)
		assert.ErrorIs(t, err, model.ErrGroupMigrationPaused)
		_, err = model.AdminResetPlanSubscriptions(plans[1].Id, false)
		assert.ErrorIs(t, err, model.ErrGroupMigrationPaused)
		// Admission is held above: its accounting must finish while migration drains.
		consumed, err := model.PreConsumeUserSubscription("migration-admitted-preconsume", users[0].Id, "migration-probe", 0, 5)
		require.NoError(t, err)
		require.NoError(t, model.PostConsumeUserSubscriptionDelta(consumed.UserSubscriptionId, 2))
		for range 2 {
			require.NoError(t, model.RefundSubscriptionPreConsume("migration-refundable"))
		}
		assert.Equal(t, refundable.UserSubscriptionId, consumed.UserSubscriptionId)
		bind := request(http.MethodPost, "/api/subscription/admin/bind", map[string]int{"user_id": users[3].Id, "plan_id": plans[0].Id})
		assert.Equal(t, http.StatusServiceUnavailable, bind.Code, bind.Body.String())
		count, err := model.ExpireDueSubscriptions(200)
		assert.ErrorIs(t, err, model.ErrGroupMigrationPaused)
		assert.Zero(t, count)
		var stillActive []model.UserSubscription
		require.NoError(t, db.Where("user_id IN ?", []int{users[1].Id, users[2].Id, users[3].Id}).Order("id").Find(&stillActive).Error)
		assert.Equal(t, before, stillActive, "paused lifecycle attempts must roll back status and group changes")
		releaseOnce.Do(release)
		select {
		case rec := <-finished:
			require.Contains(t, rec.Body.String(), `"state":"completed"`)
		case <-time.After(10 * time.Second):
			t.Fatal("subscription migration did not finish")
		}
		cached, err = model.GetSubscriptionPlanById(plans[0].Id)
		require.NoError(t, err)
		plans[0].UpgradeGroup, plans[1].DowngradeGroup = "subscription-new", "subscription-new"
		// Cache normalization is not a persisted commercial change.
		cached.AllowBalancePay, cached.AllowWalletOverflow = nil, nil
		assert.Equal(t, plans[0], *cached)
		var disabled model.SubscriptionPlan
		require.NoError(t, db.First(&disabled, plans[1].Id).Error)
		assert.Equal(t, plans[1], disabled)
		for i := range before {
			if before[i].UpgradeGroup == "subscription-old" {
				before[i].UpgradeGroup = "subscription-new"
			}
			if before[i].DowngradeGroup == "subscription-old" {
				before[i].DowngradeGroup = "subscription-new"
			}
			if before[i].PrevUserGroup == "subscription-old" {
				before[i].PrevUserGroup = "subscription-new"
			}
		}
		var after []model.UserSubscription
		require.NoError(t, db.Where("user_id IN ?", []int{users[1].Id, users[2].Id, users[3].Id}).Order("id").Find(&after).Error)
		assert.Equal(t, before, after, "only name references change")
		for range 2 {
			require.NoError(t, model.CompleteSubscriptionOrder(order.TradeNo, "paid", model.PaymentProviderEpay, ""))
			for _, event := range stripeEvents {
				assert.Equal(t, http.StatusOK, stripeCallback(event).Code)
			}
		}
		paymentSubs, err := model.GetAllUserSubscriptions(users[0].Id)
		require.NoError(t, err)
		require.Len(t, paymentSubs, 4, "callback retries must not duplicate the purchased subscription")
		assert.Zero(t, consumed.AmountUsedBefore, "the automatic reset ran during drain before consumption")
		assert.Equal(t, int64(4), paymentSubs[len(paymentSubs)-1].Subscription.AmountUsed, "reset, pre-consume, settlement and one refund all committed")
		count, err = model.ExpireDueSubscriptions(200)
		require.NoError(t, err)
		assert.Equal(t, 2, count)
		for i, want := range []string{"subscription-new", "subscription-new", "subscription-new"} {
			user, err := model.GetUserById(users[i].Id, true)
			require.NoError(t, err)
			assert.Equal(t, want, user.Group)
			cache, err := model.GetUserCache(users[i].Id)
			require.NoError(t, err)
			assert.Equal(t, want, cache.Group)
		}
		bind = request(http.MethodPost, "/api/subscription/admin/bind", map[string]int{"user_id": users[3].Id, "plan_id": plans[0].Id})
		require.Contains(t, bind.Body.String(), `"success":true`)
		// The old cancelled snapshot is still an effective explicit restoration.
		deleted := request(http.MethodDelete, "/api/subscription/admin/user_subscriptions/"+strconv.Itoa(inactive[1].Id), nil)
		require.Contains(t, deleted.Body.String(), `"success":true`)
	})
	t.Run("subscription quota reset serializes with migration", func(t *testing.T) {
		payment := operation_setting.GetPaymentSetting()
		oldPayment := *payment
		t.Cleanup(func() { *payment = oldPayment })
		payment.ComplianceConfirmed = true
		payment.ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion
		var groups map[string]float64
		require.NoError(t, common.UnmarshalJsonStr(ratio_setting.GroupRatio2JSONString(), &groups))
		groups["reset-old"] = 0.7
		encoded, err := common.Marshal(groups)
		require.NoError(t, err)
		require.NoError(t, model.UpdateOptionsBulk(map[string]string{"GroupRatio": string(encoded)}))
		user := model.User{Username: "migration-reset", AffCode: "migration-reset", Group: "default", Status: common.UserStatusEnabled}
		require.NoError(t, db.Create(&user).Error)
		plan := model.SubscriptionPlan{Title: "migration reset", UpgradeGroup: "reset-old", TotalAmount: 100, DurationUnit: model.SubscriptionDurationDay, DurationValue: 7}
		require.NoError(t, db.Create(&plan).Error)
		require.Contains(t, request(http.MethodPost, "/api/subscription/admin/bind", map[string]int{"user_id": user.Id, "plan_id": plan.Id}).Body.String(), `"success":true`)
		require.NoError(t, db.Model(&model.UserSubscription{}).Where("user_id = ?", user.Id).Update("amount_used", 17).Error)
		var preview struct{ Data model.GroupMigrationPreview }
		require.NoError(t, common.Unmarshal(request(http.MethodGet, "/api/option/group_migration/preview?source=reset-old&target=reset-new", nil).Body.Bytes(), &preview))
		locked, proceed, migrationAttempt := make(chan struct{}), make(chan struct{}), make(chan struct{})
		var queryOnce, releaseOnce, attemptOnce sync.Once
		defer releaseOnce.Do(func() { close(proceed) })
		require.NoError(t, db.Callback().Query().After("gorm:query").Register("test:reset-read", func(tx *gorm.DB) {
			if rows, ok := tx.Statement.Dest.(*[]model.UserSubscription); ok && len(*rows) > 0 && (*rows)[0].UserId == user.Id {
				queryOnce.Do(func() {
					close(locked)
					<-proceed
				})
			}
		}))
		defer func() { require.NoError(t, db.Callback().Query().Remove("test:reset-read")) }()
		require.NoError(t, db.Callback().Update().Before("gorm:update").Register("test:migration-lock-attempt", func(tx *gorm.DB) {
			if tx.Statement.Table == "group_migration_controls" {
				select {
				case <-locked:
					attemptOnce.Do(func() { close(migrationAttempt) })
				default:
				}
			}
		}))
		defer func() { require.NoError(t, db.Callback().Update().Remove("test:migration-lock-attempt")) }()
		resetDone := make(chan error, 1)
		go func() {
			_, err := model.AdminResetUserSubscriptionsByPlan(user.Id, plan.Id, false)
			resetDone <- err
		}()
		select {
		case <-locked:
		case <-time.After(5 * time.Second):
			t.Fatal("reset did not read subscription")
		}
		migrationDone := make(chan *httptest.ResponseRecorder, 1)
		go func() {
			migrationDone <- request(http.MethodPost, "/api/option/group_migration", model.GroupMigrationSubmission{OperationID: "reset-cutover-05", Source: "reset-old", Target: "reset-new", Version: preview.Data.Version, Confirmation: preview.Data.Confirmation})
		}()
		select {
		case <-migrationAttempt:
		case <-time.After(5 * time.Second):
			t.Fatal("migration did not attempt its lock")
		}
		releaseOnce.Do(func() { close(proceed) })
		select {
		case err := <-resetDone:
			require.NoError(t, err)
		case <-time.After(10 * time.Second):
			t.Fatal("reset deadlocked with migration")
		}
		select {
		case rec := <-migrationDone:
			require.Contains(t, rec.Body.String(), `"state":"completed"`)
		case <-time.After(10 * time.Second):
			t.Fatal("migration deadlocked with reset")
		}
		var sub model.UserSubscription
		require.NoError(t, db.Where("user_id = ?", user.Id).First(&sub).Error)
		assert.Zero(t, sub.AmountUsed)
		assert.Equal(t, int64(100), sub.AmountTotal)
		assert.Equal(t, "reset-new", sub.UpgradeGroup)
	})
}

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
	t.Run("execution requires a server deployment declaration", func(t *testing.T) {
		t.Setenv("GROUP_MIGRATION_SINGLE_NODE", "")
		payload := `{"source":"vip","target":"premium","single_node":true}`
		req := httptest.NewRequest(http.MethodPost, "/api/option/group_migration", strings.NewReader(payload))
		req.Header.Set("Authorization", "Bearer "+credential)
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		engine.ServeHTTP(rec, req)
		assert.Equal(t, http.StatusConflict, rec.Code, rec.Body.String())
		assert.Contains(t, rec.Body.String(), "GROUP_MIGRATION_SINGLE_NODE")
	})
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
