package model

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

// dualPluginSource has a task part for dual-video and relay routes for chat
// and Responses requests.
const dualPluginSource = `
export const meta = {apiVersion: 1, key: "%KEY%", name: "Dual", version: "1.0.0", author: {name: "Test"},
  models: ["dual-video"], fetchMode: "per_task",
  relay: [
    {incoming_path: "/v1/chat/completions", upstream_path: "/chat", models: ["served", "re:^gpt-"]},
    {incoming_path: "/v1/responses", upstream_path: "/responses", models: ["other", "re:^gpt-"]}
  ]};
export function buildSubmitRequest(ctx) { return {url: ctx.baseUrl + "/submit"}; }
export function parseSubmitResponse() { return {taskId: "id"}; }
export function buildQueryRequest(ctx) { return {url: ctx.baseUrl + "/query"}; }
export function parseTaskResult() { return {status: "SUCCESS"}; }
`

const taskOnlyPluginSource = `
export const meta = {apiVersion: 1, key: "%KEY%", name: "Task", version: "1.0.0", author: {name: "Test"}, models: ["served"], fetchMode: "per_task"};
export function buildSubmitRequest(ctx) { return {url: ctx.baseUrl + "/submit"}; }
export function parseSubmitResponse() { return {taskId: "id"}; }
export function buildQueryRequest(ctx) { return {url: ctx.baseUrl + "/query"}; }
export function parseTaskResult() { return {status: "SUCCESS"}; }
`

func registerModelTestPlugin(t *testing.T, source, key string) {
	t.Helper()
	_, err := jsplugin.DefaultRegistry.Register(strings.ReplaceAll(source, "%KEY%", key), jsplugin.Options{})
	require.NoError(t, err)
	t.Cleanup(func() { _ = jsplugin.DefaultRegistry.Unregister(key) })
}

func TestUpdateAuthFlowPayloadSwapsOnlyTheExpectedPayload(t *testing.T) {
	truncateTables(t)
	match := AuthFlowMatch{Purpose: AuthFlowPurposePluginLogin, Provider: "plugin", UserId: 1, SessionId: "session"}
	token, flow, err := CreateAuthFlow(AuthFlowCreate{Purpose: AuthFlowPurposePluginLogin, Provider: "plugin", UserId: 1, SessionId: "session",
		Payload: `{"seq":1}`, ExpiresAt: time.Now().Add(time.Minute)})
	require.NoError(t, err)

	swapped, err := UpdateAuthFlowPayload(token, match, `{"seq":1}`, `{"seq":2}`)
	require.NoError(t, err)
	assert.True(t, swapped)
	swapped, err = UpdateAuthFlowPayload(token, match, `{"seq":1}`, `{"seq":3}`)
	require.NoError(t, err)
	assert.False(t, swapped, "a second writer that read the same state loses")
	stored, err := GetAuthFlow(token, match)
	require.NoError(t, err)
	assert.Equal(t, `{"seq":2}`, stored.Payload)

	other := match
	other.SessionId = "another-session"
	swapped, err = UpdateAuthFlowPayload(token, other, `{"seq":2}`, `{"seq":4}`)
	require.NoError(t, err)
	assert.False(t, swapped, "the flow belongs to its session")

	require.NoError(t, DB.Model(&AuthFlow{}).Where("id = ?", flow.Id).Update("expires_at", time.Now().Add(-time.Second)).Error)
	swapped, err = UpdateAuthFlowPayload(token, match, `{"seq":2}`, `{"seq":5}`)
	require.NoError(t, err)
	assert.False(t, swapped, "an expired flow cannot change")

	_, err = UpdateAuthFlowPayload("", match, `{"seq":2}`, `{"seq":6}`)
	assert.ErrorIs(t, err, ErrAuthFlowInvalid)
}

func TestUpdateChannelLocked(t *testing.T) {
	truncateTables(t)
	originalMemoryCache := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true
	t.Cleanup(func() { common.MemoryCacheEnabled = originalMemoryCache; InitChannelCache() })
	channel := Channel{Id: 950001, Type: constant.ChannelTypeTaskPlugin, Status: common.ChannelStatusEnabled, Name: "locked", Key: "first", Models: "m", Group: "default"}
	require.NoError(t, channel.Insert())
	InitChannelCache()

	stored, err := UpdateChannelLocked(channel.Id, func(stored *Channel) error {
		assert.Equal(t, "first", stored.Key)
		stored.Key = "second"
		return nil
	})
	require.NoError(t, err)
	assert.Equal(t, "second", stored.Key)
	cached, err := CacheGetChannel(channel.Id)
	require.NoError(t, err)
	assert.Equal(t, "second", cached.Key, "the cache publishes the new key at once")

	failure := errors.New("plugin failed")
	_, err = UpdateChannelLocked(channel.Id, func(stored *Channel) error {
		stored.Key = "lost"
		return failure
	})
	assert.ErrorIs(t, err, failure)

	_, err = UpdateChannelLocked(channel.Id, func(stored *Channel) error {
		// A key write that skipped the lock lands while the plugin runs.
		require.NoError(t, DB.Model(&Channel{}).Where("id = ?", stored.Id).Update("key", "edited").Error)
		stored.Key = "third"
		return nil
	})
	assert.ErrorIs(t, err, ErrChannelKeyChanged)
	current, err := GetChannelById(channel.Id, true)
	require.NoError(t, err)
	assert.Equal(t, "edited", current.Key, "a lost race never overwrites the newer key")

	_, err = UpdateChannelLocked(channel.Id, func(stored *Channel) error {
		// The polling cursor moves while the status changes.
		require.NoError(t, DB.Model(&Channel{}).Where("id = ?", stored.Id).Update("channel_info", ChannelInfo{MultiKeyPollingIndex: 3}).Error)
		stored.Status = common.ChannelStatusAutoDisabled
		return nil
	})
	require.NoError(t, err)
	current, err = GetChannelById(channel.Id, true)
	require.NoError(t, err)
	assert.Equal(t, common.ChannelStatusAutoDisabled, current.Status)
	assert.Equal(t, 3, current.ChannelInfo.MultiKeyPollingIndex, "only the changed columns are written")
	assert.Equal(t, "edited", current.Key)
	var enabled []bool
	require.NoError(t, DB.Model(&Ability{}).Where("channel_id = ?", channel.Id).Pluck("enabled", &enabled).Error)
	assert.Equal(t, []bool{false}, enabled, "a new status reaches the abilities")

	_, err = UpdateChannelLocked(999999, func(*Channel) error { return nil })
	assert.Error(t, err)
}

func TestProviderChannelSelectionFollowsRelayRoutes(t *testing.T) {
	truncateTables(t)
	registerModelTestPlugin(t, dualPluginSource, "select-dual")
	registerModelTestPlugin(t, taskOnlyPluginSource, "select-task")
	originalMemoryCache := common.MemoryCacheEnabled
	t.Cleanup(func() { common.MemoryCacheEnabled = originalMemoryCache; InitChannelCache() })
	priority := int64(0)
	weight := uint(1)
	dual, task := `{"task_plugin_key":"select-dual"}`, `{"task_plugin_key":"select-task"}`
	for _, channel := range []Channel{
		{Id: 960001, Type: constant.ChannelTypeTaskPlugin, Status: common.ChannelStatusEnabled, Name: "dual", Models: "served,other,gpt-4o", Group: "default", Priority: &priority, Weight: &weight, Setting: &dual},
		{Id: 960002, Type: constant.ChannelTypeTaskPlugin, Status: common.ChannelStatusEnabled, Name: "task", Models: "served,other,gpt-4o", Group: "default", Priority: &priority, Weight: &weight, Setting: &task},
	} {
		require.NoError(t, channel.Insert())
	}
	ordinary := func(path string) []dto.ChannelFilter {
		return []dto.ChannelFilter{{Kind: dto.FilterTaskPluginIdentity, RequestPath: path}}
	}

	for _, memoryCache := range []bool{false, true} {
		common.MemoryCacheEnabled = memoryCache
		InitChannelCache()
		for _, tc := range []struct {
			model, path, want string
		}{
			{model: "served", path: "/v1/chat/completions", want: "dual"},
			{model: "gpt-4o", path: "/v1/chat/completions", want: "dual"},
			{model: "other", path: "/v1/chat/completions"},
			{model: "other", path: "/v1/responses", want: "dual"},
			{model: "served", path: "/v1/embeddings"},
			{model: "served"},
		} {
			selected, err := GetChannel("default", tc.model, 0, ordinary(tc.path))
			require.NoError(t, err)
			if tc.want == "" {
				assert.Nil(t, selected, "memory cache %v: %s %s", memoryCache, tc.path, tc.model)
				continue
			}
			require.NotNil(t, selected, "memory cache %v: %s %s", memoryCache, tc.path, tc.model)
			assert.Equal(t, tc.want, selected.Name, "a task-only plugin channel never serves the relay")
		}
		selected, err := GetChannel("default", "served", 0, identityFilters("select-task", nil))
		require.NoError(t, err)
		require.NotNil(t, selected)
		assert.Equal(t, "task", selected.Name, "task requests keep their own plugin's channels")
	}
}

func TestPricingProviderChannelUsesRelayRoutes(t *testing.T) {
	resetPricingEndpointTestTables(t)
	registerModelTestPlugin(t, dualPluginSource, "pricing-dual")
	setting := `{"task_plugin_key":"pricing-dual"}`
	require.NoError(t, DB.Create(&Channel{Id: 970001, Type: constant.ChannelTypeTaskPlugin, Key: "k", Status: common.ChannelStatusEnabled, Name: "dual", Setting: &setting}).Error)
	insertPricingEndpointAbility(t, 970001, "gpt-4o")
	insertPricingEndpointAbility(t, 970001, "other")
	insertPricingEndpointAbility(t, 970001, "served")
	insertPricingEndpointAbility(t, 970001, "dual-video")

	for _, memoryCache := range []bool{true, false} {
		common.MemoryCacheEnabled = memoryCache
		InvalidatePricingCache()
		byModel := pricingEndpointTypesByModel(t)

		assert.Equal(t, []constant.EndpointType{constant.EndpointTypeOpenAI, constant.EndpointTypeOpenAIResponse}, byModel["gpt-4o"], "memory cache %v", memoryCache)
		assert.Equal(t, []constant.EndpointType{constant.EndpointTypeOpenAIResponse}, byModel["other"], "memory cache %v", memoryCache)
		assert.Equal(t, []constant.EndpointType{constant.EndpointTypeOpenAI}, byModel["served"], "memory cache %v", memoryCache)
		assert.Equal(t, common.GetEndpointTypesByChannelType(constant.ChannelTypeTaskPlugin, "dual-video"), byModel["dual-video"],
			"memory cache %v: a task model keeps the task plugin endpoints", memoryCache)
	}

	require.NoError(t, jsplugin.DefaultRegistry.Unregister("pricing-dual"))
	InvalidatePricingCache()
	byModel := pricingEndpointTypesByModel(t)
	assert.Equal(t, common.GetEndpointTypesByChannelType(constant.ChannelTypeTaskPlugin, "gpt-4o"), byModel["gpt-4o"], "without its plugin the channel has no relay routes")
}

func TestPricingConversionOfProviderChannelModels(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&Option{}))
	registerModelTestPlugin(t, dualPluginSource, "conversion-dual")
	registerModelTestPlugin(t, taskOnlyPluginSource, "conversion-task")
	dual, task := `{"task_plugin_key":"conversion-dual"}`, `{"task_plugin_key":"conversion-task"}`
	require.NoError(t, (&Channel{Id: 980001, Type: constant.ChannelTypeTaskPlugin, Status: common.ChannelStatusEnabled, Name: "dual", Models: "relay-model", Group: "default", Setting: &dual}).Insert())
	require.NoError(t, (&Channel{Id: 980002, Type: constant.ChannelTypeTaskPlugin, Status: common.ChannelStatusEnabled, Name: "task", Models: "task-model", Group: "default", Setting: &task}).Insert())

	conversion, err := PreviewModelPricingConversion("relay-model", PricingValues{})
	require.NoError(t, err)
	assert.NotEqual(t, "Task pricing must be converted manually using the task usage schema.", conversion.UnsupportedReason, "a relay model prices like an ordinary model")

	conversion, err = PreviewModelPricingConversion("task-model", PricingValues{})
	require.NoError(t, err)
	assert.Equal(t, "Task pricing must be converted manually using the task usage schema.", conversion.UnsupportedReason)
}

// useScheduledChannelDatabase isolates these locked-update tests on each real
// dialect selected through TEST_TASK_DB_DIALECT and the standard test DSNs.
func useScheduledChannelDatabase(t *testing.T) {
	t.Helper()
	dialect := common.DatabaseType(os.Getenv("TEST_TASK_DB_DIALECT"))
	var driver gorm.Dialector
	switch dialect {
	case "", common.DatabaseTypeSQLite:
		dialect = common.DatabaseTypeSQLite
		driver = sqlite.Open(fmt.Sprintf("file:sched_model_%d?mode=memory&cache=shared", time.Now().UnixNano()))
	case common.DatabaseTypeMySQL:
		require.NotEmpty(t, os.Getenv("TEST_MYSQL_DSN"))
		driver = mysql.Open(os.Getenv("TEST_MYSQL_DSN"))
	case common.DatabaseTypePostgreSQL:
		require.NotEmpty(t, os.Getenv("TEST_POSTGRES_DSN"))
		driver = postgres.New(postgres.Config{DSN: os.Getenv("TEST_POSTGRES_DSN"), PreferSimpleProtocol: true})
	default:
		t.Fatalf("unsupported test dialect %q", dialect)
	}
	db, err := gorm.Open(driver, &gorm.Config{NamingStrategy: schema.NamingStrategy{TablePrefix: fmt.Sprintf("sched_model_%d_", time.Now().UnixNano())}})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	if dialect == common.DatabaseTypeSQLite {
		// Cancelling a transaction may discard its connection. Keep the shared
		// in-memory database alive so the rollback can be inspected afterwards.
		sqlDB.SetMaxOpenConns(2)
		anchor, err := sqlDB.Conn(context.Background())
		require.NoError(t, err)
		t.Cleanup(func() { require.NoError(t, anchor.Close()) })
	}
	tables := []any{&Channel{}, &Ability{}, &SystemTask{}}
	require.NoError(t, db.AutoMigrate(tables...))
	previousDB, previousType, previousMemory := DB, common.MainDatabaseType(), common.MemoryCacheEnabled
	DB = db
	common.SetMainDatabaseType(dialect)
	common.MemoryCacheEnabled = true
	initCol()
	t.Cleanup(func() {
		require.NoError(t, db.Migrator().DropTable(tables...))
		DB = previousDB
		common.SetMainDatabaseType(previousType)
		common.MemoryCacheEnabled = previousMemory
		initCol()
		InitChannelCache()
		require.NoError(t, sqlDB.Close())
	})
	var version string
	query := "SELECT version()"
	if dialect == common.DatabaseTypeSQLite {
		query = "SELECT sqlite_version()"
	}
	require.NoError(t, db.Raw(query).Scan(&version).Error)
	t.Logf("database: %s %s", dialect, version)
}

func TestScheduledChannelLockedStatus(t *testing.T) {
	useScheduledChannelDatabase(t)
	autoBan, noAutoBan := 1, 0
	for _, memoryCache := range []bool{false, true} {
		t.Run(fmt.Sprintf("cache=%v", memoryCache), func(t *testing.T) {
			common.MemoryCacheEnabled = memoryCache
			channel := Channel{Type: constant.ChannelTypeTaskPlugin, Name: "scheduled", Key: "old", Status: common.ChannelStatusAutoDisabled,
				Models: fmt.Sprintf("scheduled-%v", memoryCache), Group: "default", AutoBan: &autoBan}
			require.NoError(t, channel.Insert())
			InitChannelCache()
			selected, err := GetRandomSatisfiedChannel("default", channel.Models, 0, nil)
			require.NoError(t, err)
			assert.Nil(t, selected)

			stored, err := UpdateScheduledChannelLocked(context.Background(), channel.Id, func(stored *Channel) error {
				stored.Key = "new"
				require.True(t, SetScheduledChannelKeyStatus(stored, 0, common.ChannelStatusEnabled, ""))
				return nil
			})
			require.NoError(t, err)
			assert.Equal(t, "new", stored.Key)
			cached, err := CacheGetChannel(channel.Id)
			require.NoError(t, err)
			assert.Equal(t, "new", cached.Key)
			assert.Equal(t, common.ChannelStatusEnabled, cached.Status)
			selected, err = GetRandomSatisfiedChannel("default", channel.Models, 0, nil)
			require.NoError(t, err)
			require.NotNil(t, selected, "re-enabled channels immediately return to selection")
			assert.Equal(t, channel.Id, selected.Id)
			var ability Ability
			require.NoError(t, DB.Where("channel_id = ?", channel.Id).First(&ability).Error)
			assert.True(t, ability.Enabled)
			before := channelsRevision(t)
			require.NotZero(t, before)

			failure := errors.New("scheduled result rejected")
			_, err = UpdateScheduledChannelLocked(context.Background(), channel.Id, func(stored *Channel) error {
				stored.Key = "invalid"
				SetScheduledChannelKeyStatus(stored, 0, common.ChannelStatusAutoDisabled, "invalid")
				return failure
			})
			assert.ErrorIs(t, err, failure)
			stored, err = GetChannelById(channel.Id, true)
			require.NoError(t, err)
			assert.Equal(t, "new", stored.Key)
			assert.Equal(t, common.ChannelStatusEnabled, stored.Status)
			assert.Equal(t, before, channelsRevision(t), "a failed callback writes neither state nor a sync task")

			_, err = UpdateScheduledChannelLocked(context.Background(), channel.Id, func(stored *Channel) error {
				require.True(t, SetScheduledChannelKeyStatus(stored, 0, common.ChannelStatusAutoDisabled, "Disabled by plugin"))
				return nil
			})
			require.NoError(t, err)
			selected, err = GetRandomSatisfiedChannel("default", channel.Models, 0, nil)
			require.NoError(t, err)
			assert.Nil(t, selected, "disabled channels immediately leave selection")
			stored, err = GetChannelById(channel.Id, true)
			require.NoError(t, err)
			assert.Equal(t, "Disabled by plugin", stored.GetOtherInfo()["status_reason"])

			for _, tc := range []struct {
				name           string
				status, target int
				autoBan        *int
			}{
				{"manual enable", common.ChannelStatusManuallyDisabled, common.ChannelStatusEnabled, &autoBan},
				{"manual auto-disable", common.ChannelStatusManuallyDisabled, common.ChannelStatusAutoDisabled, &autoBan},
				{"auto-disable off", common.ChannelStatusEnabled, common.ChannelStatusAutoDisabled, &noAutoBan},
			} {
				t.Run(tc.name, func(t *testing.T) {
					guarded := Channel{Key: "key", Status: tc.status, AutoBan: tc.autoBan}
					assert.False(t, SetScheduledChannelKeyStatus(&guarded, 0, tc.target, "reason"))
					assert.Equal(t, tc.status, guarded.Status)
				})
			}
		})
	}
}

func TestScheduledChannelLockedMultiKey(t *testing.T) {
	useScheduledChannelDatabase(t)
	autoBan := 1
	channel := Channel{Type: constant.ChannelTypeTaskPlugin, Name: "scheduled multi", Key: "one\ntwo\nthree", Status: common.ChannelStatusEnabled,
		Models: "scheduled-multi", Group: "default", AutoBan: &autoBan, ChannelInfo: ChannelInfo{IsMultiKey: true, MultiKeySize: 3,
			MultiKeyMode: constant.MultiKeyModePolling, MultiKeyPollingIndex: 2,
			MultiKeyStatusList:     map[int]int{0: common.ChannelStatusAutoDisabled, 1: common.ChannelStatusManuallyDisabled},
			MultiKeyDisabledReason: map[int]string{0: "exhausted", 1: "manual"}}}
	require.NoError(t, channel.Insert())
	InitChannelCache()
	stored, err := UpdateScheduledChannelLocked(context.Background(), channel.Id, func(stored *Channel) error {
		assert.False(t, SetScheduledChannelKeyStatus(stored, 1, common.ChannelStatusEnabled, ""))
		assert.False(t, SetScheduledChannelKeyStatus(stored, 1, common.ChannelStatusAutoDisabled, ""))
		assert.False(t, SetScheduledChannelKeyStatus(stored, 3, common.ChannelStatusEnabled, ""))
		require.True(t, SetScheduledChannelKeyStatus(stored, 0, common.ChannelStatusEnabled, ""))
		return nil
	})
	require.NoError(t, err)
	assert.Equal(t, map[int]int{1: common.ChannelStatusManuallyDisabled}, stored.ChannelInfo.MultiKeyStatusList)
	assert.Equal(t, map[int]string{1: "manual"}, stored.ChannelInfo.MultiKeyDisabledReason)
	cached, err := CacheGetChannel(channel.Id)
	require.NoError(t, err)
	assert.Equal(t, stored.ChannelInfo.MultiKeyStatusList, cached.ChannelInfo.MultiKeyStatusList)
	assert.Equal(t, 2, cached.ChannelInfo.MultiKeyPollingIndex)

	_, err = UpdateScheduledChannelLocked(context.Background(), channel.Id, func(stored *Channel) error {
		require.True(t, SetScheduledChannelKeyStatus(stored, 0, common.ChannelStatusAutoDisabled, "empty"))
		require.True(t, SetScheduledChannelKeyStatus(stored, 2, common.ChannelStatusAutoDisabled, "empty"))
		return nil
	})
	require.NoError(t, err)
	selected, err := GetRandomSatisfiedChannel("default", channel.Models, 0, nil)
	require.NoError(t, err)
	assert.Nil(t, selected)
	stored, err = UpdateScheduledChannelLocked(context.Background(), channel.Id, func(stored *Channel) error {
		require.True(t, SetScheduledChannelKeyStatus(stored, 0, common.ChannelStatusEnabled, ""))
		return nil
	})
	require.NoError(t, err)
	assert.Equal(t, common.ChannelStatusEnabled, stored.Status)
	assert.Equal(t, common.ChannelStatusManuallyDisabled, stored.ChannelInfo.MultiKeyStatusList[1])
	assert.Equal(t, common.ChannelStatusAutoDisabled, stored.ChannelInfo.MultiKeyStatusList[2])
	selected, err = GetRandomSatisfiedChannel("default", channel.Models, 0, nil)
	require.NoError(t, err)
	require.NotNil(t, selected)
	key, index, keyErr := selected.GetNextEnabledKey()
	require.Nil(t, keyErr)
	assert.Equal(t, "one", key)
	assert.Zero(t, index)

}

func TestScheduledChannelLockedCancellation(t *testing.T) {
	useScheduledChannelDatabase(t)
	channel := Channel{Type: constant.ChannelTypeTaskPlugin, Name: "cancelled", Key: "old", Status: common.ChannelStatusAutoDisabled}
	require.NoError(t, channel.Insert())
	var sqlLogs bytes.Buffer
	previousDB, previousDebug := DB, common.DebugEnabled
	common.DebugEnabled = true
	DB = DB.Session(&gorm.Session{Logger: newGormLogger(&sqlLogs)})
	t.Cleanup(func() { DB, common.DebugEnabled = previousDB, previousDebug })
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err := UpdateScheduledChannelLocked(ctx, channel.Id, func(*Channel) error {
		t.Fatal("a cancelled run must not enter the hook")
		return nil
	})
	require.ErrorIs(t, err, context.Canceled)

	ctx, cancel = context.WithCancel(context.Background())
	defer cancel()
	_, err = UpdateScheduledChannelLocked(ctx, channel.Id, func(stored *Channel) error {
		stored.Key = "scheduled-private-credential"
		stored.Status = common.ChannelStatusEnabled
		cancel()
		return nil
	})
	require.ErrorIs(t, err, context.Canceled)
	assert.Empty(t, sqlLogs.String(), "a failed credential write must produce no SQL diagnostics, even in debug mode")
	stored, err := GetChannelById(channel.Id, true)
	require.NoError(t, err)
	assert.Equal(t, "old", stored.Key)
	assert.Equal(t, common.ChannelStatusAutoDisabled, stored.Status)

}

func TestScheduledChannelDatabaseRowLock(t *testing.T) {
	useScheduledChannelDatabase(t)
	if common.UsingMainDatabase(common.DatabaseTypeSQLite) {
		t.Skip("SQLite uses its process key lock instead of database row locks")
	}
	channel := Channel{Type: constant.ChannelTypeTaskPlugin, Name: "other node", Key: "old", Status: common.ChannelStatusAutoDisabled}
	require.NoError(t, channel.Insert())
	entered, release := make(chan struct{}), make(chan struct{})
	first := make(chan error, 1)
	go func() {
		first <- DB.Transaction(func(tx *gorm.DB) error {
			var stored Channel
			if err := lockForUpdate(tx).Where("id = ?", channel.Id).First(&stored).Error; err != nil {
				return err
			}
			close(entered)
			<-release
			return tx.Model(&Channel{}).Where("id = ?", channel.Id).Updates(map[string]any{"key": "new", "status": common.ChannelStatusEnabled}).Error
		})
	}()
	<-entered
	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()
	called := false
	_, err := UpdateScheduledChannelLocked(ctx, channel.Id, func(*Channel) error {
		called = true
		return nil
	})
	close(release)
	assert.ErrorIs(t, err, context.DeadlineExceeded)
	assert.False(t, called, "persistence does not apply to an uncommitted row")
	require.NoError(t, <-first)
	_, err = UpdateScheduledChannelLocked(context.Background(), channel.Id, func(stored *Channel) error {
		assert.Equal(t, "new", stored.Key)
		assert.Equal(t, common.ChannelStatusEnabled, stored.Status)
		return nil
	})
	require.NoError(t, err)
}
