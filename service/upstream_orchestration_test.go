package service

import (
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/wsmanager"
	"github.com/QuantumNous/new-api/relaykit/relayconvert"
	relaytypes "github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func upstreamOrchestrationOptions(t *testing.T, setting *operation_setting.UpstreamOrchestrationSetting) map[string]string {
	t.Helper()
	values, err := config.ConfigToMap(setting)
	require.NoError(t, err)
	options := make(map[string]string, len(values))
	for key, value := range values {
		options["upstream_orchestration."+key] = value
	}
	return options
}

func updateUpstreamOrchestrationForTest(
	t *testing.T,
	update func(*operation_setting.UpstreamOrchestrationSetting),
) {
	t.Helper()
	original := operation_setting.GetUpstreamOrchestrationSetting()
	originalValues, err := config.ConfigToMap(original)
	require.NoError(t, err)
	next := operation_setting.GetUpstreamOrchestrationSetting()
	update(next)
	nextValues, err := config.ConfigToMap(next)
	require.NoError(t, err)
	updated, err := config.GlobalConfig.UpdateFromMap("upstream_orchestration", nextValues)
	require.NoError(t, err)
	require.True(t, updated)
	t.Cleanup(func() {
		updated, err := config.GlobalConfig.UpdateFromMap("upstream_orchestration", originalValues)
		require.NoError(t, err)
		require.True(t, updated)
	})
}

func TestManagedUpstreamOrchestrationSettingSnapshotIsDeeplyDetached(t *testing.T) {
	original := operation_setting.GetUpstreamOrchestrationSetting()
	t.Cleanup(func() {
		require.NoError(t, config.GlobalConfig.LoadFromDB(upstreamOrchestrationOptions(t, original)))
	})
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"upstream_orchestration.target_groups":             `["default","cxy"]`,
		"upstream_orchestration.static_egress_ips":         `{"source":["192.0.2.1"]}`,
		"upstream_orchestration.model_aliases":             `{"public":"actual"}`,
		"upstream_orchestration.model_exclusions":          `{"source:group":["excluded"]}`,
		"upstream_orchestration.protocol_model_exclusions": `{"anthropic":["protocol-excluded"]}`,
	}))

	snapshot := operation_setting.GetUpstreamOrchestrationSetting()
	snapshot.TargetGroups[0] = "mutated"
	snapshot.StaticEgressIPs["source"][0] = "198.51.100.1"
	snapshot.StaticEgressIPs["added"] = []string{"203.0.113.1"}
	snapshot.ModelAliases["public"] = "mutated"
	snapshot.ModelExclusions["source:group"][0] = "mutated"
	snapshot.ProtocolModelExclusions["anthropic"][0] = "mutated"

	fresh := operation_setting.GetUpstreamOrchestrationSetting()
	assert.Equal(t, []string{"default", "cxy"}, fresh.TargetGroups)
	assert.Equal(t, map[string][]string{"source": {"192.0.2.1"}}, fresh.StaticEgressIPs)
	assert.Equal(t, map[string]string{"public": "actual"}, fresh.ModelAliases)
	assert.Equal(t, map[string][]string{"source:group": {"excluded"}}, fresh.ModelExclusions)
	assert.Equal(t, map[string][]string{"anthropic": {"protocol-excluded"}}, fresh.ProtocolModelExclusions)
}

func TestManagedUpstreamOrchestrationSettingConcurrentReadAndReload(t *testing.T) {
	original := operation_setting.GetUpstreamOrchestrationSetting()
	t.Cleanup(func() {
		require.NoError(t, config.GlobalConfig.LoadFromDB(upstreamOrchestrationOptions(t, original)))
	})
	optionSets := []map[string]string{
		{
			"upstream_orchestration.target_groups":             `["default","cxy"]`,
			"upstream_orchestration.static_egress_ips":         `{"source-a":["192.0.2.1","192.0.2.2"]}`,
			"upstream_orchestration.model_aliases":             `{"public-a":"actual-a"}`,
			"upstream_orchestration.model_exclusions":          `{"source-a:group":["excluded-a"]}`,
			"upstream_orchestration.protocol_model_exclusions": `{"openai":["protocol-a"]}`,
		},
		{
			"upstream_orchestration.target_groups":             `["vip"]`,
			"upstream_orchestration.static_egress_ips":         `{"source-b":["198.51.100.1"]}`,
			"upstream_orchestration.model_aliases":             `{"public-b":"actual-b"}`,
			"upstream_orchestration.model_exclusions":          `{"source-b:group":["excluded-b"]}`,
			"upstream_orchestration.protocol_model_exclusions": `{"anthropic":["protocol-b"]}`,
		},
	}

	start := make(chan struct{})
	errs := make(chan error, 100)
	var workers sync.WaitGroup
	workers.Go(func() {
		<-start
		for i := range 100 {
			errs <- config.GlobalConfig.LoadFromDB(optionSets[i%len(optionSets)])
		}
	})
	for range 4 {
		workers.Go(func() {
			<-start
			for range 100 {
				setting := operation_setting.GetUpstreamOrchestrationSetting()
				_ = slices.Clone(setting.TargetGroups)
				for _, values := range setting.StaticEgressIPs {
					_ = slices.Clone(values)
				}
				for key, value := range setting.ModelAliases {
					_, _ = key, value
				}
				for _, values := range setting.ModelExclusions {
					_ = slices.Clone(values)
				}
				for _, values := range setting.ProtocolModelExclusions {
					_ = slices.Clone(values)
				}
			}
		})
	}
	close(start)
	workers.Wait()
	close(errs)
	for err := range errs {
		require.NoError(t, err)
	}
}

func TestManagedUpstreamRouteOverviewsUseEffectiveChannelModelsInTwoQueries(t *testing.T) {
	setupUpstreamRouteOverviewDatabase(t)
	channels := []model.Channel{
		{
			Id: 2101, Name: "first-effective", Key: "first-key",
			Status: common.ChannelStatusEnabled, Group: "default",
			Models: "actual-model, shared-model,actual-model",
		},
		{
			Id: 2102, Name: "second-effective", Key: "second-key",
			Status: common.ChannelStatusEnabled, Group: "default",
			Models: "anthropic-model",
		},
	}
	require.NoError(t, model.DB.Create(&channels).Error)
	routes := []model.UpstreamManagedRoute{
		{
			SourceID: 1, ExternalGroupID: "first", Platform: "openai",
			Protocol: model.UpstreamProtocolOpenAI, ChannelID: 2101,
			State: model.UpstreamRouteStateActive, Rank: 1,
		},
		{
			SourceID: 2, ExternalGroupID: "second", Platform: "anthropic",
			Protocol: model.UpstreamProtocolAnthropic, ChannelID: 2102,
			State: model.UpstreamRouteStateActive, Rank: 2,
		},
		{
			SourceID: 3, ExternalGroupID: "missing", Platform: "openai",
			Protocol: model.UpstreamProtocolOpenAI, ChannelID: 2199,
			State: model.UpstreamRouteStateActive, Rank: 3,
		},
	}
	require.NoError(t, model.DB.Create(&routes).Error)

	queryCount := 0
	const callbackName = "test:managed-route-overview-query-count"
	require.NoError(t, model.DB.Callback().Query().Before("gorm:query").
		Register(callbackName, func(*gorm.DB) {
			queryCount++
		}))
	t.Cleanup(func() {
		require.NoError(t, model.DB.Callback().Query().Remove(callbackName))
	})

	overview, err := ListUpstreamRouteOverviews()

	require.NoError(t, err)
	require.Len(t, overview, 3)
	assert.Equal(t, 2, queryCount)
	assert.Equal(t, []string{"actual-model", "shared-model"}, overview[0].EffectiveModels)
	assert.Equal(t, []string{"anthropic-model"}, overview[1].EffectiveModels)
	assert.Nil(t, overview[2].EffectiveModels)
}

func TestManagedUpstreamRouteOverviewDatabaseFixtureRollsBack(t *testing.T) {
	runnerDialect := os.Getenv("APP_PLUGIN_TEST_DIALECT")
	if runnerDialect == "" {
		runnerDialect = string(common.DatabaseTypeSQLite)
		t.Setenv("APP_PLUGIN_TEST_DIALECT", runnerDialect)
	}
	if runnerDialect == string(common.DatabaseTypeSQLite) && os.Getenv("APP_PLUGIN_TEST_DSN") == "" {
		t.Setenv("APP_PLUGIN_TEST_DSN", filepath.Join(t.TempDir(), "overview.db"))
	}
	require.Equal(t, runnerDialect, os.Getenv("APP_PLUGIN_TEST_DIALECT"))
	require.NotEmpty(t, os.Getenv("APP_PLUGIN_TEST_DSN"))

	for run := range 2 {
		t.Run(strconv.Itoa(run+1), func(t *testing.T) {
			setupUpstreamRouteOverviewDatabase(t)
			require.NoError(t, model.DB.Create(&model.Channel{
				Id: 2101, Name: "repeatable-overview", Key: "repeatable-key",
			}).Error)
			require.NoError(t, model.DB.Create(&model.UpstreamManagedRoute{
				SourceID: 1, ExternalGroupID: "repeatable", Platform: "openai",
				Protocol: model.UpstreamProtocolOpenAI, ChannelID: 2101,
				State: model.UpstreamRouteStateActive,
			}).Error)
		})
	}
}

func setupUpstreamRouteOverviewDatabase(t *testing.T) {
	t.Helper()
	originalDB, originalType := model.DB, common.MainDatabaseType()
	dialectName := os.Getenv("APP_PLUGIN_TEST_DIALECT")
	dsn := os.Getenv("APP_PLUGIN_TEST_DSN")
	var dialector gorm.Dialector
	var databaseType common.DatabaseType
	switch dialectName {
	case "", string(common.DatabaseTypeSQLite):
		if dsn == "" {
			dsn = ":memory:"
		}
		dialector = sqlite.Open(dsn)
		databaseType = common.DatabaseTypeSQLite
	case string(common.DatabaseTypeMySQL):
		dialector = mysql.Open(dsn)
		databaseType = common.DatabaseTypeMySQL
	case string(common.DatabaseTypePostgreSQL):
		dialector = postgres.New(postgres.Config{
			DSN:                  dsn,
			PreferSimpleProtocol: true,
		})
		databaseType = common.DatabaseTypePostgreSQL
	default:
		t.Fatalf("unsupported database dialect %q", dialectName)
	}
	database, err := gorm.Open(dialector, &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := database.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, database.AutoMigrate(
		&model.Channel{},
		&model.UpstreamManagedRoute{},
	))
	transaction := database.Begin()
	require.NoError(t, transaction.Error)
	model.DB = transaction
	common.SetMainDatabaseType(databaseType)
	t.Cleanup(func() {
		rollbackErr := transaction.Rollback().Error
		closeErr := sqlDB.Close()
		model.DB = originalDB
		common.SetMainDatabaseType(originalType)
		require.NoError(t, rollbackErr)
		require.NoError(t, closeErr)
	})
}

func setupUpstreamOrchestrationTest(t *testing.T) {
	t.Helper()
	originalDB := model.DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(
		&model.UpstreamSource{},
		&model.UpstreamGroup{},
		&model.UpstreamManagedRoute{},
		&model.UpstreamMetricSnapshot{},
		&model.UpstreamSyncDevice{},
		&model.UpstreamSyncBatch{},
		&model.UpstreamSyncCommand{},
		&model.Vendor{},
		&model.Model{},
	))
	model.DB = db
	t.Cleanup(func() {
		model.DB = originalDB
	})
}

func setupManagedReconcileOrderingTest(t *testing.T) {
	t.Helper()
	originalDB, originalType := model.DB, common.MainDatabaseType()
	originalMemoryCache := common.MemoryCacheEnabled
	dialectName := os.Getenv("APP_PLUGIN_TEST_DIALECT")
	dsn := os.Getenv("APP_PLUGIN_TEST_DSN")
	var dialector gorm.Dialector
	var databaseType common.DatabaseType
	switch dialectName {
	case "", string(common.DatabaseTypeSQLite):
		if dsn == "" {
			name := strings.NewReplacer("/", "_", " ", "_").Replace(t.Name())
			dsn = "file:" + name + "?mode=memory&cache=shared&_pragma=busy_timeout(5000)"
		}
		dialector = sqlite.Open(dsn)
		databaseType = common.DatabaseTypeSQLite
	case string(common.DatabaseTypeMySQL):
		dialector = mysql.Open(dsn)
		databaseType = common.DatabaseTypeMySQL
	case string(common.DatabaseTypePostgreSQL):
		dialector = postgres.New(postgres.Config{
			DSN:                  dsn,
			PreferSimpleProtocol: true,
		})
		databaseType = common.DatabaseTypePostgreSQL
	default:
		t.Fatalf("unsupported database dialect %q", dialectName)
	}
	database, err := gorm.Open(dialector, &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := database.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(4)
	model.DB = database
	common.SetMainDatabaseType(databaseType)
	common.MemoryCacheEnabled = false
	t.Cleanup(func() {
		require.NoError(t, sqlDB.Close())
		model.DB = originalDB
		common.SetMainDatabaseType(originalType)
		common.MemoryCacheEnabled = originalMemoryCache
	})
	require.NoError(t, model.DB.AutoMigrate(
		&model.UpstreamSource{},
		&model.UpstreamGroup{},
		&model.UpstreamManagedRoute{},
		&model.Channel{},
		&model.Ability{},
		&model.Vendor{},
		&model.Model{},
	))
}

func detachBeforeManagedReconcileMutation(
	t *testing.T,
	routeID int64,
) <-chan error {
	t.Helper()
	detachDone := make(chan error, 1)
	var triggered atomic.Bool
	triggerDetach := func(tx *gorm.DB) {
		if tx.Statement.Table != "upstream_managed_routes" {
			return
		}
		if triggered.CompareAndSwap(false, true) {
			detachDone <- DetachManagedRoute(routeID)
		}
	}
	const queryCallback = "test:detach_before_reconcile_route_lock"
	const updateCallback = "test:detach_before_reconcile_route_update"
	require.NoError(t, model.DB.Callback().Query().Before("gorm:query").Register(queryCallback, func(tx *gorm.DB) {
		if _, singleRoute := tx.Statement.Dest.(*model.UpstreamManagedRoute); singleRoute {
			triggerDetach(tx)
		}
	}))
	require.NoError(t, model.DB.Callback().Update().Before("gorm:update").Register(updateCallback, triggerDetach))
	t.Cleanup(func() {
		require.NoError(t, model.DB.Callback().Query().Remove(queryCallback))
		require.NoError(t, model.DB.Callback().Update().Remove(updateCallback))
	})
	return detachDone
}

func newManagedReconcileOrderingFixture(
	t *testing.T,
	now time.Time,
	healthStatus string,
	groupModels string,
) (model.UpstreamSource, model.UpstreamGroup, model.Channel, model.UpstreamManagedRoute, *[]string) {
	t.Helper()
	fixtureKey := "ordering-" + strconv.FormatInt(time.Now().UnixNano()%1_000_000_000_000, 10)
	source := model.UpstreamSource{
		Key:              fixtureKey,
		Name:             "Ordering Source",
		ConsoleURL:       "https://example.com",
		SelectedEndpoint: "https://new.example.com",
		Status:           model.UpstreamHealthOperational,
		Enabled:          true,
		LastSnapshotAt:   now.Unix(),
	}
	require.NoError(t, model.DB.Create(&source).Error)
	group := model.UpstreamGroup{
		SourceID:            source.ID,
		ExternalID:          "ordering-group",
		Name:                "Ordering Group",
		Platform:            "openai",
		Models:              groupModels,
		EffectiveMultiplier: 0.25,
		HealthStatus:        healthStatus,
		ObservedAt:          now.Unix(),
		RedSince:            now.Add(-time.Hour).Unix(),
	}
	require.NoError(t, model.DB.Create(&group).Error)
	oldEndpoint := "https://old.example.com"
	priority := int64(777)
	channel := model.Channel{
		Name:     "ordering-channel",
		Key:      "fixture-key",
		Type:     constant.ChannelTypeAdvancedCustom,
		Status:   common.ChannelStatusEnabled,
		Group:    "default",
		Models:   "ordering-model",
		BaseURL:  &oldEndpoint,
		Priority: &priority,
	}
	require.NoError(t, model.DB.Create(&channel).Error)
	require.NoError(t, channel.AddAbilities(nil))
	route := model.UpstreamManagedRoute{
		SourceID:            source.ID,
		ExternalGroupID:     group.ExternalID,
		Platform:            group.Platform,
		Protocol:            model.UpstreamProtocolOpenAI,
		ChannelID:           channel.Id,
		State:               model.UpstreamRouteStateActive,
		Rank:                7,
		EffectiveMultiplier: 0.75,
		LastReason:          "independent channel state",
	}
	require.NoError(t, model.DB.Create(&route).Error)
	closeReasons := make([]string, 0, 1)
	unregister := wsmanager.Register(channel.Id, wsmanager.KindResponses, func(reason string) {
		closeReasons = append(closeReasons, reason)
	})
	t.Cleanup(unregister)
	t.Cleanup(func() {
		require.NoError(t, model.DB.Where("channel_id = ?", channel.Id).Delete(&model.Ability{}).Error)
		require.NoError(t, model.DB.Delete(&route).Error)
		require.NoError(t, model.DB.Delete(&channel).Error)
		require.NoError(t, model.DB.Delete(&group).Error)
		require.NoError(t, model.DB.Delete(&source).Error)
	})
	return source, group, channel, route, &closeReasons
}

func TestManagedReconcileDetachOrdering(t *testing.T) {
	now := time.Unix(1_788_320_000, 0)
	for _, tc := range []struct {
		name          string
		healthStatus  string
		groupModels   string
		detachFirst   bool
		wantState     string
		wantStatus    int
		wantModels    string
		wantRank      int
		wantAbility   bool
		abilityActive bool
		wantClose     bool
		excludeModel  bool
	}{
		{
			name: "detach wins before state transition", healthStatus: model.UpstreamHealthFailed,
			groupModels: `["ordering-model"]`, detachFirst: true,
			wantState: model.UpstreamRouteStateDetached, wantStatus: common.ChannelStatusEnabled,
			wantModels: "ordering-model", wantRank: 7, wantAbility: true, abilityActive: true,
		},
		{
			name: "state transition control", healthStatus: model.UpstreamHealthFailed,
			groupModels: `["ordering-model"]`,
			wantState:   model.UpstreamRouteStateQuarantined, wantStatus: common.ChannelStatusAutoDisabled,
			wantModels: "ordering-model", wantRank: 7, wantAbility: true, wantClose: true,
		},
		{
			name: "detach wins before rank update", healthStatus: model.UpstreamHealthOperational,
			groupModels: `["gpt-4.1"]`, detachFirst: true, excludeModel: true,
			wantState: model.UpstreamRouteStateDetached, wantStatus: common.ChannelStatusEnabled,
			wantModels: "ordering-model", wantRank: 7, wantAbility: true, abilityActive: true,
		},
		{
			name: "rank update control", healthStatus: model.UpstreamHealthOperational,
			groupModels: `["gpt-4.1"]`, excludeModel: true,
			wantState: model.UpstreamRouteStateActive, wantStatus: common.ChannelStatusAutoDisabled,
			wantModels: "", wantRank: 0, wantClose: true,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			setupManagedReconcileOrderingTest(t)
			originalRatios := ratio_setting.ModelRatio2JSONString()
			require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(`{"gpt-4.1":1}`))
			t.Cleanup(func() {
				require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(originalRatios))
			})
			updateUpstreamOrchestrationForTest(t, func(setting *operation_setting.UpstreamOrchestrationSetting) {
				setting.Enabled = true
				setting.AutoEnroll = false
				setting.CandidateLimit = 5
				setting.MaxUpstreamMultiplier = 1
				setting.SyncIntervalHours = 4
				setting.TargetGroups = []string{"default"}
				setting.ModelAliases = map[string]string{}
				setting.ModelExclusions = map[string][]string{}
				setting.ProtocolModelExclusions = map[string][]string{}
				if tc.excludeModel {
					setting.ProtocolModelExclusions[model.UpstreamProtocolOpenAI] = []string{"gpt-4.1"}
				}
			})
			_, _, channel, route, closeReasons := newManagedReconcileOrderingFixture(
				t,
				now,
				tc.healthStatus,
				tc.groupModels,
			)
			var detachDone <-chan error
			if tc.detachFirst {
				detachDone = detachBeforeManagedReconcileMutation(t, route.ID)
			}

			_, err := ReconcileManagedUpstreams(now)

			require.NoError(t, err)
			if detachDone != nil {
				select {
				case detachErr := <-detachDone:
					require.NoError(t, detachErr)
				case <-time.After(5 * time.Second):
					t.Fatal("detach barrier was not reached")
				}
			}
			var storedRoute model.UpstreamManagedRoute
			require.NoError(t, model.DB.First(&storedRoute, route.ID).Error)
			assert.Equal(t, tc.detachFirst, storedRoute.Detached)
			assert.Equal(t, tc.wantState, storedRoute.State)
			assert.Equal(t, tc.wantRank, storedRoute.Rank)
			if tc.detachFirst {
				assert.Equal(t, 0.75, storedRoute.EffectiveMultiplier)
				assert.Equal(t, "independent channel state", storedRoute.LastReason)
			}
			var storedChannel model.Channel
			require.NoError(t, model.DB.First(&storedChannel, channel.Id).Error)
			assert.Equal(t, tc.wantStatus, storedChannel.Status)
			assert.Equal(t, tc.wantModels, storedChannel.Models)
			var abilities []model.Ability
			require.NoError(t, model.DB.Where("channel_id = ?", channel.Id).Find(&abilities).Error)
			if !tc.wantAbility {
				assert.Empty(t, abilities)
			} else {
				require.Len(t, abilities, 1)
				assert.Equal(t, tc.abilityActive, abilities[0].Enabled)
			}
			if tc.wantClose {
				assert.Equal(t, []string{ChannelDisabledCloseReason}, *closeReasons)
			} else {
				assert.Empty(t, *closeReasons)
				assert.Equal(t, 1, wsmanager.CloseChannel(channel.Id, "test cleanup"))
			}
		})
	}
}

func TestManagedReconcileAppliesEarlierCommittedSideEffectsOnLaterFailure(t *testing.T) {
	setupManagedReconcileOrderingTest(t)
	common.MemoryCacheEnabled = true
	now := time.Unix(1_788_320_000, 0)
	updateUpstreamOrchestrationForTest(t, func(setting *operation_setting.UpstreamOrchestrationSetting) {
		setting.Enabled = true
		setting.AutoEnroll = false
		setting.SyncIntervalHours = 4
	})
	source, group, firstChannel, firstRoute, closeReasons := newManagedReconcileOrderingFixture(
		t,
		now,
		model.UpstreamHealthFailed,
		`["ordering-model"]`,
	)
	secondChannel := model.Channel{
		Name: "ordering-second", Key: "second-key", Type: constant.ChannelTypeAdvancedCustom,
		Status: common.ChannelStatusEnabled, Group: "default", Models: "ordering-model",
	}
	require.NoError(t, model.DB.Create(&secondChannel).Error)
	require.NoError(t, secondChannel.AddAbilities(nil))
	secondRoute := model.UpstreamManagedRoute{
		SourceID: source.ID, ExternalGroupID: group.ExternalID, Platform: group.Platform,
		Protocol: model.UpstreamProtocolAnthropic, ChannelID: secondChannel.Id,
		State: model.UpstreamRouteStateActive, Rank: 8,
	}
	require.NoError(t, model.DB.Create(&secondRoute).Error)
	t.Cleanup(func() {
		require.NoError(t, model.DB.Where("channel_id = ?", secondChannel.Id).Delete(&model.Ability{}).Error)
		require.NoError(t, model.DB.Delete(&secondRoute).Error)
		require.NoError(t, model.DB.Delete(&secondChannel).Error)
	})
	model.InitChannelCache()

	injected := errors.New("injected second channel update failure")
	channelUpdates := 0
	const callbackName = "test:reconcile_second_channel_update_failure"
	require.NoError(t, model.DB.Callback().Update().Before("gorm:update").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Table != "channels" {
			return
		}
		channelUpdates++
		if channelUpdates == 2 {
			tx.AddError(injected)
		}
	}))
	t.Cleanup(func() {
		require.NoError(t, model.DB.Callback().Update().Remove(callbackName))
	})

	_, err := ReconcileManagedUpstreams(now)

	require.ErrorIs(t, err, injected)
	var storedRoute model.UpstreamManagedRoute
	require.NoError(t, model.DB.First(&storedRoute, firstRoute.ID).Error)
	assert.Equal(t, model.UpstreamRouteStateQuarantined, storedRoute.State)
	var storedChannel model.Channel
	require.NoError(t, model.DB.First(&storedChannel, firstChannel.Id).Error)
	assert.Equal(t, common.ChannelStatusAutoDisabled, storedChannel.Status)
	cachedChannel, cacheErr := model.CacheGetChannel(firstChannel.Id)
	require.NoError(t, cacheErr)
	require.NotNil(t, cachedChannel)
	assert.Equal(t, common.ChannelStatusAutoDisabled, cachedChannel.Status)
	assert.Equal(t, []string{ChannelDisabledCloseReason}, *closeReasons)
}

func TestDisableChannelManagedWebSocketLifecycle(t *testing.T) {
	for _, testCase := range []struct {
		name                string
		createChannel       bool
		consecutiveFailures int
		wantStatus          int
		wantCloseReasons    []string
	}{
		{
			name:                "quarantine closes active websocket",
			createChannel:       true,
			consecutiveFailures: 1,
			wantStatus:          common.ChannelStatusAutoDisabled,
			wantCloseReasons:    []string{ChannelDisabledCloseReason},
		},
		{
			name:          "handled failure below threshold keeps websocket open",
			createChannel: true,
			wantStatus:    common.ChannelStatusEnabled,
		},
		{
			name:                "failed status update keeps websocket open",
			consecutiveFailures: 1,
		},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			setupUpstreamOrchestrationTest(t)
			require.NoError(t, model.DB.AutoMigrate(&model.Channel{}, &model.Ability{}))

			updateUpstreamOrchestrationForTest(t, func(setting *operation_setting.UpstreamOrchestrationSetting) {
				setting.Enabled = true
				setting.FailureThreshold = 2
				setting.FailureWindowMinutes = 5
			})

			channelID := 901
			if testCase.createChannel {
				channel := model.Channel{
					Id:     channelID,
					Name:   "managed-websocket",
					Status: common.ChannelStatusEnabled,
					Group:  "default",
					Models: "gpt-managed",
				}
				require.NoError(t, model.DB.Create(&channel).Error)
				require.NoError(t, channel.AddAbilities(nil))
			}
			require.NoError(t, model.DB.Create(&model.UpstreamManagedRoute{
				SourceID:            1,
				ExternalGroupID:     "managed-websocket",
				Platform:            "openai",
				Protocol:            model.UpstreamProtocolOpenAI,
				ChannelID:           channelID,
				State:               model.UpstreamRouteStateActive,
				ConsecutiveFailures: testCase.consecutiveFailures,
				FailureWindowStart:  common.GetTimestamp(),
			}).Error)

			var closeReasons []string
			unregister := wsmanager.Register(channelID, wsmanager.KindResponses, func(reason string) {
				closeReasons = append(closeReasons, reason)
			})
			t.Cleanup(unregister)

			DisableChannel(relaytypes.ChannelError{
				ChannelId:   channelID,
				ChannelName: "managed-websocket",
				AutoBan:     true,
			}, "managed failure")

			assert.Equal(t, testCase.wantCloseReasons, closeReasons)
			if testCase.createChannel {
				channel, err := model.GetChannelById(channelID, true)
				require.NoError(t, err)
				assert.Equal(t, testCase.wantStatus, channel.Status)
			}
		})
	}
}

func TestManagedRouteStatusChangesCloseWebSockets(t *testing.T) {
	newFixture := func(t *testing.T, channelStatus int, routeState, healthStatus string, createChannel bool) (time.Time, model.UpstreamManagedRoute, *[]string) {
		t.Helper()
		setupUpstreamOrchestrationTest(t)
		require.NoError(t, model.DB.AutoMigrate(&model.Channel{}, &model.Ability{}))

		now := time.Unix(1_788_320_000, 0)
		source := model.UpstreamSource{
			Key:              model.UpstreamSourceKeyHualong,
			Name:             "Managed Status",
			ConsoleURL:       "https://api.hualong.online",
			SelectedEndpoint: "https://api.hualong.online",
			Status:           model.UpstreamHealthOperational,
			Enabled:          true,
			LastSnapshotAt:   now.Unix(),
		}
		require.NoError(t, model.DB.Create(&source).Error)
		group := model.UpstreamGroup{
			SourceID:            source.ID,
			ExternalID:          "managed-status",
			Name:                "Managed Status",
			Platform:            "openai",
			EffectiveMultiplier: 1,
			HealthStatus:        healthStatus,
			ObservedAt:          now.Unix(),
			RedSince:            now.Add(-time.Hour).Unix(),
			Models:              `["gpt-managed"]`,
		}
		require.NoError(t, model.DB.Create(&group).Error)

		channelID := 902
		if createChannel {
			channel := model.Channel{
				Id:     channelID,
				Name:   "managed-status",
				Status: channelStatus,
				Group:  "default",
				Models: "gpt-managed",
			}
			require.NoError(t, model.DB.Create(&channel).Error)
			require.NoError(t, channel.AddAbilities(nil))
		}
		route := model.UpstreamManagedRoute{
			SourceID:        source.ID,
			ExternalGroupID: group.ExternalID,
			Platform:        group.Platform,
			Protocol:        model.UpstreamProtocolOpenAI,
			ChannelID:       channelID,
			State:           routeState,
		}
		require.NoError(t, model.DB.Create(&route).Error)

		closeReasons := make([]string, 0, 1)
		unregister := wsmanager.Register(channelID, wsmanager.KindResponses, func(reason string) {
			closeReasons = append(closeReasons, reason)
		})
		t.Cleanup(unregister)
		return now, route, &closeReasons
	}

	t.Run("reconciliation disable closes once", func(t *testing.T) {
		now, _, closeReasons := newFixture(
			t,
			common.ChannelStatusEnabled,
			model.UpstreamRouteStateActive,
			model.UpstreamHealthFailed,
			true,
		)
		updateUpstreamOrchestrationForTest(t, func(setting *operation_setting.UpstreamOrchestrationSetting) {
			setting.Enabled = true
			setting.AutoEnroll = false
		})

		_, err := ReconcileManagedUpstreams(now)

		require.NoError(t, err)
		assert.Equal(t, []string{ChannelDisabledCloseReason}, *closeReasons)
		assert.Zero(t, wsmanager.CloseChannel(902, "duplicate close"))
	})

	t.Run("reconciliation enable does not close", func(t *testing.T) {
		now, _, closeReasons := newFixture(
			t,
			common.ChannelStatusAutoDisabled,
			model.UpstreamRouteStateShadow,
			model.UpstreamHealthOperational,
			true,
		)
		updateUpstreamOrchestrationForTest(t, func(setting *operation_setting.UpstreamOrchestrationSetting) {
			setting.Enabled = true
			setting.AutoEnroll = false
			setting.ShadowSuccessesRequired = 0
		})

		_, err := ReconcileManagedUpstreams(now)

		require.NoError(t, err)
		assert.Empty(t, *closeReasons)
		assert.Equal(t, 1, wsmanager.CloseChannel(902, "test cleanup"))
	})

	t.Run("reconciliation no change does not close", func(t *testing.T) {
		now, _, closeReasons := newFixture(
			t,
			common.ChannelStatusAutoDisabled,
			model.UpstreamRouteStateQuarantined,
			model.UpstreamHealthFailed,
			true,
		)
		updateUpstreamOrchestrationForTest(t, func(setting *operation_setting.UpstreamOrchestrationSetting) {
			setting.Enabled = true
			setting.AutoEnroll = false
		})

		_, err := ReconcileManagedUpstreams(now)

		require.NoError(t, err)
		assert.Empty(t, *closeReasons)
		assert.Equal(t, 1, wsmanager.CloseChannel(902, "test cleanup"))
	})

	t.Run("manual pause closes once", func(t *testing.T) {
		_, route, closeReasons := newFixture(
			t,
			common.ChannelStatusEnabled,
			model.UpstreamRouteStateActive,
			model.UpstreamHealthOperational,
			true,
		)

		require.NoError(t, PauseManagedRoute(route.ID, "maintenance"))

		assert.Equal(t, []string{ChannelDisabledCloseReason}, *closeReasons)
		assert.Zero(t, wsmanager.CloseChannel(902, "duplicate close"))
	})

	t.Run("status update failure does not close", func(t *testing.T) {
		now, route, closeReasons := newFixture(
			t,
			common.ChannelStatusEnabled,
			model.UpstreamRouteStateActive,
			model.UpstreamHealthFailed,
			false,
		)
		updateUpstreamOrchestrationForTest(t, func(setting *operation_setting.UpstreamOrchestrationSetting) {
			setting.Enabled = true
			setting.AutoEnroll = false
		})

		_, err := ReconcileManagedUpstreams(now)
		require.NoError(t, err)
		assert.Empty(t, *closeReasons)
		require.NoError(t, PauseManagedRoute(route.ID, "maintenance"))
		assert.Empty(t, *closeReasons)
		assert.Equal(t, 1, wsmanager.CloseChannel(902, "test cleanup"))
	})
}

func TestNormalizeUpstreamEndpoints(t *testing.T) {
	t.Run("selects the fastest healthy allowlisted endpoint", func(t *testing.T) {
		slow := int64(50)
		fast := int64(10)
		healthy := true
		endpoints, selected, err := normalizeUpstreamEndpoints(
			model.UpstreamSourceKeyLeyi,
			"https://leyi12.xyz",
			[]dto.UpstreamEndpointSnapshot{
				{Name: "slow", URL: "https://api.leyiapi.com/", LatencyMS: &slow, Healthy: &healthy},
				{Name: "fast", URL: "https://leyiapi.com", LatencyMS: &fast, Healthy: &healthy},
			},
		)
		require.NoError(t, err)
		assert.Len(t, endpoints, 3)
		assert.Equal(t, "https://leyiapi.com", selected)
	})

	t.Run("rejects endpoints outside the source allowlist", func(t *testing.T) {
		_, _, err := normalizeUpstreamEndpoints(
			model.UpstreamSourceKeyLeyi,
			"",
			[]dto.UpstreamEndpointSnapshot{{URL: "https://example.com"}},
		)
		assert.Error(t, err)
	})
}

func TestIngestUpstreamSnapshot(t *testing.T) {
	setupUpstreamOrchestrationTest(t)
	now := common.GetTimestamp()
	device := &model.UpstreamSyncDevice{
		DeviceID: "device-one",
		Status:   model.UpstreamSyncDeviceActive,
	}

	t.Run("stores a valid source group and metric once", func(t *testing.T) {
		multiplier := 0.15
		availability := 99.5
		latency := int64(1500)
		snapshot := dto.UpstreamSyncSnapshot{
			SchemaVersion: upstreamSnapshotSchemaVersion,
			SnapshotID:    "snapshot-valid",
			DeviceID:      device.DeviceID,
			CapturedAt:    now,
			Sources: []dto.UpstreamSourceSnapshot{{
				Key:            model.UpstreamSourceKeyHualong,
				Name:           "Hualong",
				ConsoleURL:     "https://api.hualong.online",
				APIBaseURL:     "https://api-fast.hualong.online",
				Status:         model.UpstreamHealthOperational,
				Balance:        floatPointer(25),
				AdapterVersion: "sub2api-1",
				Groups: []dto.UpstreamGroupSnapshot{{
					ExternalID:         "group-1",
					Name:               "GPT Pro",
					Platform:           "openai",
					RateMultiplier:     0.2,
					UserRateMultiplier: &multiplier,
					HealthStatus:       model.UpstreamHealthOperational,
					Availability:       &availability,
					LatencyMS:          &latency,
					Models:             []dto.UpstreamModelSnapshot{{Name: "gpt-5.5"}},
				}},
			}},
		}

		result, err := IngestUpstreamSnapshot(device, snapshot)
		require.NoError(t, err)
		assert.Equal(t, 1, result.Sources)
		assert.Equal(t, 1, result.Groups)
		assert.Equal(t, 1, result.Metrics)

		result, err = IngestUpstreamSnapshot(device, snapshot)
		require.NoError(t, err)
		assert.Zero(t, result.Sources)
		var count int64
		require.NoError(t, model.DB.Model(&model.UpstreamMetricSnapshot{}).Count(&count).Error)
		assert.EqualValues(t, 1, count)
	})

	t.Run("failed partial snapshot preserves last valid operational values", func(t *testing.T) {
		source := model.UpstreamSource{
			Key:                 model.UpstreamSourceKeyEBond,
			Name:                "EBond",
			ConsoleURL:          "https://ebondai.com",
			EndpointCandidates:  `[{"name":"default","url":"https://api.ebondai.com"}]`,
			SelectedEndpoint:    "https://api.ebondai.com",
			Status:              model.UpstreamHealthOperational,
			Enabled:             false,
			Balance:             floatPointer(12),
			LowBalanceThreshold: 7,
			LastSnapshotID:      "old",
			LastSnapshotAt:      now - 60,
			LastSuccessAt:       now - 60,
		}
		require.NoError(t, model.DB.Create(&source).Error)

		_, err := IngestUpstreamSnapshot(device, dto.UpstreamSyncSnapshot{
			SchemaVersion: upstreamSnapshotSchemaVersion,
			SnapshotID:    "snapshot-error",
			DeviceID:      device.DeviceID,
			CapturedAt:    now,
			Sources: []dto.UpstreamSourceSnapshot{{
				Key:        model.UpstreamSourceKeyEBond,
				Name:       "EBond",
				ConsoleURL: "https://ebondai.com",
				Status:     model.UpstreamHealthError,
				Error:      "login required",
			}},
		})
		require.NoError(t, err)

		stored, err := model.GetUpstreamSourceByKey(model.UpstreamSourceKeyEBond)
		require.NoError(t, err)
		assert.False(t, stored.Enabled)
		assert.Equal(t, "https://api.ebondai.com", stored.SelectedEndpoint)
		require.NotNil(t, stored.Balance)
		assert.Equal(t, 12.0, *stored.Balance)
		assert.Equal(t, now-60, stored.LastSuccessAt)
		assert.Equal(t, "login required", stored.LastError)
		assert.Equal(t, model.UpstreamHealthError, stored.Status)
	})
}

func TestManagedAdvancedCustomConfigPrefersNativeProtocols(t *testing.T) {
	for _, platform := range []string{"openai", "anthropic", "grok"} {
		t.Run(platform, func(t *testing.T) {
			payload := dto.UpstreamEnrollmentCommand{Platform: platform}

			openAI := managedAdvancedCustomConfig(payload, model.UpstreamProtocolOpenAI)
			require.Len(t, openAI.Routes, 2)
			assert.Equal(t, "/v1/chat/completions", openAI.Routes[0].UpstreamPath)
			assert.Equal(t, relayconvert.ConverterNone, openAI.Routes[0].Converter)
			assert.Equal(t, "/v1/responses", openAI.Routes[1].UpstreamPath)
			assert.Equal(t, relayconvert.ConverterNone, openAI.Routes[1].Converter)

			anthropic := managedAdvancedCustomConfig(payload, model.UpstreamProtocolAnthropic)
			require.Len(t, anthropic.Routes, 1)
			assert.Equal(t, "/v1/messages", anthropic.Routes[0].UpstreamPath)
			assert.Equal(t, relayconvert.ConverterNone, anthropic.Routes[0].Converter)
		})
	}

	t.Run("explicit fallback overrides", func(t *testing.T) {
		payload := dto.UpstreamEnrollmentCommand{
			Platform:           "openai",
			ResponsesPath:      "/v1/chat/completions",
			ResponsesConverter: relayconvert.ConverterOpenAIResponsesToOpenAIChat,
			MessagesPath:       "/v1/chat/completions",
			MessagesConverter:  relayconvert.ConverterClaudeMessagesToOpenAIChat,
		}

		openAI := managedAdvancedCustomConfig(payload, model.UpstreamProtocolOpenAI)
		assert.Equal(t, payload.ResponsesPath, openAI.Routes[1].UpstreamPath)
		assert.Equal(t, payload.ResponsesConverter, openAI.Routes[1].Converter)

		anthropic := managedAdvancedCustomConfig(payload, model.UpstreamProtocolAnthropic)
		assert.Equal(t, payload.MessagesPath, anthropic.Routes[0].UpstreamPath)
		assert.Equal(t, payload.MessagesConverter, anthropic.Routes[0].Converter)
	})
}

func TestManagedUpstreamChannelUsesConfiguredTargetGroups(t *testing.T) {
	payload := dto.UpstreamEnrollmentCommand{
		SourceKey:       "source",
		ExternalGroupID: "group",
		GroupName:       "Managed",
		Platform:        "openai",
		APIBaseURL:      "https://upstream.example.com",
		Models:          []string{"gpt-test"},
	}

	t.Run("configured normalized groups", func(t *testing.T) {
		updateUpstreamOrchestrationForTest(t, func(setting *operation_setting.UpstreamOrchestrationSetting) {
			setting.TargetGroups = []string{"default", "vip"}
		})

		channel, err := buildManagedUpstreamChannel(payload, "test-key", model.UpstreamProtocolOpenAI)

		require.NoError(t, err)
		assert.Equal(t, "default,vip", channel.Group)
		assert.NotContains(t, channel.Group, "cxy")
	})

	t.Run("normalized default fallback", func(t *testing.T) {
		updateUpstreamOrchestrationForTest(t, func(setting *operation_setting.UpstreamOrchestrationSetting) {
			setting.TargetGroups = nil
		})

		channel, err := buildManagedUpstreamChannel(payload, "test-key", model.UpstreamProtocolOpenAI)

		require.NoError(t, err)
		assert.Equal(t, "default,cxy", channel.Group)
	})
}

func TestManagedTextModelFilter(t *testing.T) {
	assert.True(t, isManagedTextModel("gpt-5.6-sol", "openai"))
	assert.True(t, isManagedTextModel("claude-opus-5", "anthropic"))
	assert.True(t, isManagedTextModel("grok-4.6", "grok"))
	assert.False(t, isManagedTextModel("gpt-image-2", "openai"))
	assert.False(t, isManagedTextModel("grok-imagine", "grok"))
	assert.False(t, isManagedTextModel("grok-imagine-video-1.5", "grok"))
}

func TestManagedModelExcludedIsScopedToSourceGroup(t *testing.T) {
	exclusions := map[string][]string{
		"hualong:21": {"claude-haiku-4-5-20251001"},
	}

	assert.True(t, managedModelExcluded(
		"Hualong",
		"21",
		"claude-haiku-4-5-20251001",
		"claude-haiku-4-5-20251001",
		exclusions,
	))
	assert.False(t, managedModelExcluded(
		"ebond",
		"21",
		"claude-haiku-4-5-20251001",
		"claude-haiku-4-5-20251001",
		exclusions,
	))
}

func TestManagedProtocolModelExcludedSupportsGlobalAndScopedRules(t *testing.T) {
	exclusions := map[string][]string{
		"anthropic":          {"gpt-6-astra"},
		"leyi:openai":        {"gpt-source-only"},
		"ebond:group:openai": {"gpt-group-only"},
	}

	assert.True(t, managedProtocolModelExcluded("hualong", "group", "anthropic", "gpt-6-astra", exclusions))
	assert.False(t, managedProtocolModelExcluded("hualong", "group", "openai", "gpt-6-astra", exclusions))
	assert.True(t, managedProtocolModelExcluded("leyi", "group", "openai", "gpt-source-only", exclusions))
	assert.False(t, managedProtocolModelExcluded("ebond", "other", "openai", "gpt-group-only", exclusions))
	assert.True(t, managedProtocolModelExcluded("ebond", "group", "openai", "gpt-group-only", exclusions))
}

func TestManagedRouteUsesNativeProtocol(t *testing.T) {
	nativeOpenAI := model.Channel{OtherSettings: `{"advanced_custom":{"advanced_routes":[{"incoming_path":"/v1/chat/completions","upstream_path":"/chat/completions","converter":"none"},{"incoming_path":"/v1/responses","upstream_path":"/responses","converter":"none"}]}}`}
	convertedOpenAI := model.Channel{OtherSettings: `{"advanced_custom":{"advanced_routes":[{"incoming_path":"/v1/chat/completions","upstream_path":"/v1/messages","converter":"openai_chat_completions_to_anthropic_messages"}]}}`}
	nativeMessages := model.Channel{OtherSettings: `{"advanced_custom":{"advanced_routes":[{"incoming_path":"/v1/messages","upstream_path":"/v1/messages","converter":"none"}]}}`}
	mixedMessages := model.Channel{OtherSettings: `{"advanced_custom":{"advanced_routes":[{"incoming_path":"/v1/messages","upstream_path":"/v1/messages","converter":"none","models":["gpt-native"]},{"incoming_path":"/v1/messages","upstream_path":"/v1/chat/completions","converter":"anthropic_messages_to_openai_chat_completions","models":["gpt-fallback"]}]}}`}

	assert.True(t, managedRouteUsesNativeProtocol(
		nativeOpenAI,
		model.UpstreamProtocolOpenAI,
	))
	assert.False(t, managedRouteUsesNativeProtocol(
		convertedOpenAI,
		model.UpstreamProtocolOpenAI,
	))
	assert.True(t, managedRouteUsesNativeProtocol(
		nativeMessages,
		model.UpstreamProtocolAnthropic,
	))
	assert.False(t, managedRouteUsesNativeProtocol(
		mixedMessages,
		model.UpstreamProtocolAnthropic,
	))
}

func TestShouldRecordManagedRouteFailure(t *testing.T) {
	tests := []struct {
		name       string
		statusCode int
		errorCode  relaytypes.ErrorCode
		options    []relaytypes.NewAPIErrorOptions
		expected   bool
	}{
		{name: "unauthorized", statusCode: http.StatusUnauthorized, errorCode: relaytypes.ErrorCodeBadResponseStatusCode, expected: true},
		{name: "forbidden", statusCode: http.StatusForbidden, errorCode: relaytypes.ErrorCodeBadResponseStatusCode, expected: true},
		{name: "request timeout", statusCode: http.StatusRequestTimeout, errorCode: relaytypes.ErrorCodeBadResponseStatusCode, expected: true},
		{name: "rate limited", statusCode: http.StatusTooManyRequests, errorCode: relaytypes.ErrorCodeBadResponseStatusCode, expected: true},
		{name: "server error", statusCode: http.StatusInternalServerError, errorCode: relaytypes.ErrorCodeBadResponseStatusCode, expected: true},
		{name: "channel error", statusCode: http.StatusBadRequest, errorCode: relaytypes.ErrorCodeChannelNoAvailableKey, expected: true},
		{name: "ordinary bad request", statusCode: http.StatusBadRequest, errorCode: relaytypes.ErrorCodeBadResponseStatusCode, expected: false},
		{name: "ordinary not found", statusCode: http.StatusNotFound, errorCode: relaytypes.ErrorCodeBadResponseStatusCode, expected: false},
		{
			name:       "local skip retry request timeout remains excluded",
			statusCode: http.StatusRequestTimeout,
			errorCode:  relaytypes.ErrorCodeBadResponseStatusCode,
			options:    []relaytypes.NewAPIErrorOptions{relaytypes.ErrOptionWithSkipRetry()},
			expected:   false,
		},
	}
	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			err := relaytypes.NewOpenAIError(
				errors.New(testCase.name),
				testCase.errorCode,
				testCase.statusCode,
				testCase.options...,
			)
			assert.Equal(t, testCase.expected, ShouldRecordManagedRouteFailure(err))
		})
	}
}

func TestSelectUpstreamCandidateGroupsCapsAtFiveWithSourceDiversity(t *testing.T) {
	candidates := []upstreamRouteCandidate{
		{source: model.UpstreamSource{ID: 1, Key: "a"}, group: model.UpstreamGroup{SourceID: 1, ExternalID: "cheap", Platform: "openai", EffectiveMultiplier: 0.01}, models: []string{"gpt-test"}},
		{source: model.UpstreamSource{ID: 1, Key: "a"}, group: model.UpstreamGroup{SourceID: 1, ExternalID: "duplicate", Platform: "openai", EffectiveMultiplier: 0.02}, models: []string{"gpt-test"}},
		{source: model.UpstreamSource{ID: 2, Key: "b"}, group: model.UpstreamGroup{SourceID: 2, ExternalID: "b", Platform: "openai", EffectiveMultiplier: 0.03}, models: []string{"gpt-test"}},
		{source: model.UpstreamSource{ID: 3, Key: "c"}, group: model.UpstreamGroup{SourceID: 3, ExternalID: "c", Platform: "openai", EffectiveMultiplier: 0.04}, models: []string{"gpt-test"}},
		{source: model.UpstreamSource{ID: 4, Key: "d"}, group: model.UpstreamGroup{SourceID: 4, ExternalID: "d", Platform: "openai", EffectiveMultiplier: 0.05}, models: []string{"gpt-test"}},
		{source: model.UpstreamSource{ID: 5, Key: "e"}, group: model.UpstreamGroup{SourceID: 5, ExternalID: "e", Platform: "openai", EffectiveMultiplier: 0.06}, models: []string{"gpt-test"}},
		{source: model.UpstreamSource{ID: 6, Key: "f"}, group: model.UpstreamGroup{SourceID: 6, ExternalID: "f", Platform: "openai", EffectiveMultiplier: 0.07}, models: []string{"gpt-test"}},
	}

	selected := selectUpstreamCandidateGroups(candidates, 5)

	require.Len(t, selected, 5)
	sourceIDs := make(map[int64]struct{}, len(selected))
	for _, candidate := range selected {
		sourceIDs[candidate.source.ID] = struct{}{}
	}
	assert.Len(t, sourceIDs, 5)
}

func TestSelectUpstreamCandidateGroupsUnlimitedReturnsAllSortedCandidates(t *testing.T) {
	candidates := []upstreamRouteCandidate{
		{source: model.UpstreamSource{ID: 1, Key: "expensive"}, group: model.UpstreamGroup{SourceID: 1, ExternalID: "expensive", Platform: "openai", EffectiveMultiplier: 0.3}, models: []string{"gpt-test"}},
		{source: model.UpstreamSource{ID: 2, Key: "cheap"}, group: model.UpstreamGroup{SourceID: 2, ExternalID: "cheap", Platform: "openai", EffectiveMultiplier: 0.1}, models: []string{"gpt-test"}},
		{source: model.UpstreamSource{ID: 3, Key: "middle"}, group: model.UpstreamGroup{SourceID: 3, ExternalID: "middle", Platform: "openai", EffectiveMultiplier: 0.2}, models: []string{"gpt-test"}},
	}

	selected := selectUpstreamCandidateGroups(candidates, 0)

	require.Len(t, selected, 3)
	for index, externalID := range []string{"cheap", "middle", "expensive"} {
		require.Equal(t, externalID, selected[index].group.ExternalID)
		require.Equal(t, []string{"gpt-test"}, selected[index].models)
	}
}

func TestSelectUpstreamCandidateGroupsNegativeLimitReturnsNone(t *testing.T) {
	candidates := []upstreamRouteCandidate{
		{
			source: model.UpstreamSource{ID: 91, Key: "negative-limit-source"},
			group: model.UpstreamGroup{
				SourceID:            91,
				ExternalID:          "negative-limit-group",
				Platform:            "openai",
				EffectiveMultiplier: 0.1,
			},
			models: []string{"gpt-negative-limit"},
		},
	}

	selected := selectUpstreamCandidateGroups(candidates, -1)

	assert.Nil(t, selected)
}

func TestSelectUpstreamCandidateGroupsPrunesSharedModelsFromExtraGroups(t *testing.T) {
	candidates := []upstreamRouteCandidate{
		{source: model.UpstreamSource{ID: 1, Key: "a"}, group: model.UpstreamGroup{SourceID: 1, ExternalID: "a", Platform: "openai", EffectiveMultiplier: 0.01}, models: []string{"gpt-shared"}},
		{source: model.UpstreamSource{ID: 2, Key: "b"}, group: model.UpstreamGroup{SourceID: 2, ExternalID: "b", Platform: "openai", EffectiveMultiplier: 0.02}, models: []string{"gpt-shared"}},
		{source: model.UpstreamSource{ID: 3, Key: "c"}, group: model.UpstreamGroup{SourceID: 3, ExternalID: "c", Platform: "openai", EffectiveMultiplier: 0.03}, models: []string{"gpt-shared"}},
		{source: model.UpstreamSource{ID: 4, Key: "d"}, group: model.UpstreamGroup{SourceID: 4, ExternalID: "d", Platform: "openai", EffectiveMultiplier: 0.04}, models: []string{"gpt-shared"}},
		{source: model.UpstreamSource{ID: 5, Key: "e"}, group: model.UpstreamGroup{SourceID: 5, ExternalID: "e", Platform: "openai", EffectiveMultiplier: 0.05}, models: []string{"gpt-shared"}},
		{source: model.UpstreamSource{ID: 6, Key: "f"}, group: model.UpstreamGroup{SourceID: 6, ExternalID: "f", Platform: "openai", EffectiveMultiplier: 0.06}, models: []string{"gpt-shared", "gpt-unique"}},
	}

	selected := selectUpstreamCandidateGroups(candidates, 5)

	require.Len(t, selected, 6)
	sharedCount := 0
	for _, candidate := range selected {
		if slices.Contains(candidate.models, "gpt-shared") {
			sharedCount++
		}
		if candidate.group.ExternalID == "f" {
			assert.Equal(t, []string{"gpt-unique"}, candidate.models)
		}
	}
	assert.Equal(t, 5, sharedCount)
}

func TestRankManagedRoutesPersistsSelectedModelSubsets(t *testing.T) {
	setupUpstreamOrchestrationTest(t)
	require.NoError(t, model.DB.AutoMigrate(&model.Channel{}, &model.Ability{}))
	now := time.Unix(1_788_320_000, 0)
	sources := make([]model.UpstreamSource, 0, 6)
	groups := make([]model.UpstreamGroup, 0, 6)
	candidates := make([]upstreamRouteCandidate, 0, 6)
	channelIDs := make(map[string]int)

	for index := 1; index <= 6; index++ {
		source := model.UpstreamSource{
			Key:              string(rune('a' + index - 1)),
			Name:             string(rune('A' + index - 1)),
			ConsoleURL:       "https://example.com",
			SelectedEndpoint: "https://api.example.com",
			Status:           model.UpstreamHealthOperational,
			Enabled:          true,
			LastSnapshotAt:   now.Unix(),
		}
		require.NoError(t, model.DB.Create(&source).Error)
		models := []string{"gpt-shared"}
		if index == 6 {
			models = append(models, "gpt-unique")
		}
		group := model.UpstreamGroup{
			SourceID:            source.ID,
			ExternalID:          source.Key,
			Name:                source.Name,
			Platform:            "openai",
			EffectiveMultiplier: float64(index) / 100,
			HealthStatus:        model.UpstreamHealthOperational,
			ObservedAt:          now.Unix(),
		}
		require.NoError(t, model.DB.Create(&group).Error)
		priority := int64(0)
		weight := uint(100)
		channel := model.Channel{
			Type:     58,
			Status:   common.ChannelStatusEnabled,
			Name:     source.Name,
			Weight:   &weight,
			BaseURL:  &source.SelectedEndpoint,
			Models:   strings.Join(models, ","),
			Group:    "default",
			Priority: &priority,
		}
		require.NoError(t, model.DB.Create(&channel).Error)
		require.NoError(t, channel.AddAbilities(nil))
		require.NoError(t, model.DB.Create(&model.UpstreamManagedRoute{
			SourceID:        source.ID,
			ExternalGroupID: group.ExternalID,
			Platform:        group.Platform,
			Protocol:        model.UpstreamProtocolOpenAI,
			ChannelID:       channel.Id,
			State:           model.UpstreamRouteStateActive,
		}).Error)
		sources = append(sources, source)
		groups = append(groups, group)
		candidates = append(candidates, upstreamRouteCandidate{
			source: source,
			group:  group,
			models: models,
		})
		channelIDs[group.ExternalID] = channel.Id
	}

	selected := selectUpstreamCandidateGroups(candidates, 5)
	result, err := rankManagedRoutes(
		now,
		sources,
		groups,
		selected,
		&operation_setting.UpstreamOrchestrationSetting{SyncIntervalHours: 4},
	)

	require.NoError(t, err)
	assert.Equal(t, 6, result.prioritiesUpdated)
	var sharedCount int64
	require.NoError(t, model.DB.Model(&model.Ability{}).
		Where("model = ? AND enabled = ?", "gpt-shared", true).
		Count(&sharedCount).Error)
	assert.EqualValues(t, 5, sharedCount)
	var sixth model.Channel
	require.NoError(t, model.DB.First(&sixth, channelIDs["f"]).Error)
	assert.Equal(t, "gpt-unique", sixth.Models)
}

func TestRankManagedRoutesReconcilesExistingChannelGroupsAndAbilities(t *testing.T) {
	setupUpstreamOrchestrationTest(t)
	require.NoError(t, model.DB.AutoMigrate(&model.Channel{}, &model.Ability{}))
	now := time.Unix(1_788_320_000, 0)
	source := model.UpstreamSource{
		Key:              "source",
		Name:             "Source",
		SelectedEndpoint: "https://api.example.com",
		Status:           model.UpstreamHealthOperational,
		Enabled:          true,
		LastSnapshotAt:   now.Unix(),
	}
	require.NoError(t, model.DB.Create(&source).Error)
	group := model.UpstreamGroup{
		SourceID:            source.ID,
		ExternalID:          "paid",
		Name:                "Paid",
		Platform:            "openai",
		EffectiveMultiplier: 0.1,
		HealthStatus:        model.UpstreamHealthOperational,
		ObservedAt:          now.Unix(),
	}
	require.NoError(t, model.DB.Create(&group).Error)
	priority := int64(0)
	weight := uint(100)
	channel := model.Channel{
		Type:     constant.ChannelTypeAdvancedCustom,
		Status:   common.ChannelStatusEnabled,
		Name:     "existing-managed",
		Weight:   &weight,
		BaseURL:  &source.SelectedEndpoint,
		Models:   "gpt-old",
		Group:    "legacy",
		Priority: &priority,
	}
	require.NoError(t, model.DB.Create(&channel).Error)
	require.NoError(t, channel.AddAbilities(nil))
	require.NoError(t, model.DB.Create(&model.UpstreamManagedRoute{
		SourceID:        source.ID,
		ExternalGroupID: group.ExternalID,
		Platform:        group.Platform,
		Protocol:        model.UpstreamProtocolOpenAI,
		ChannelID:       channel.Id,
		State:           model.UpstreamRouteStateActive,
	}).Error)
	targetGroups := []string{"premium", "canary"}
	models := []string{"gpt-new", "gpt-second"}

	result, err := rankManagedRoutes(
		now,
		[]model.UpstreamSource{source},
		[]model.UpstreamGroup{group},
		[]upstreamRouteCandidate{{source: source, group: group, models: models}},
		&operation_setting.UpstreamOrchestrationSetting{
			SyncIntervalHours: 4,
			TargetGroups:      targetGroups,
		},
	)

	require.NoError(t, err)
	assert.Equal(t, 1, result.prioritiesUpdated)
	var stored model.Channel
	require.NoError(t, model.DB.First(&stored, channel.Id).Error)
	assert.Equal(t, strings.Join(targetGroups, ","), stored.Group)
	assert.Equal(t, strings.Join(models, ","), stored.Models)
	var abilities []model.Ability
	require.NoError(t, model.DB.Where("channel_id = ?", channel.Id).
		Order("model").Find(&abilities).Error)
	require.Len(t, abilities, len(targetGroups)*len(models))
	for _, ability := range abilities {
		assert.Contains(t, targetGroups, ability.Group)
		assert.Contains(t, models, ability.Model)
		assert.True(t, ability.Enabled)
	}
}

func TestRankManagedRoutesAppliesProtocolModelExclusions(t *testing.T) {
	setupUpstreamOrchestrationTest(t)
	require.NoError(t, model.DB.AutoMigrate(&model.Channel{}, &model.Ability{}))
	now := time.Unix(1_788_320_000, 0)
	endpoint := "https://api.example.com"
	source := model.UpstreamSource{
		Key:              "source",
		Name:             "Source",
		SelectedEndpoint: endpoint,
		Status:           model.UpstreamHealthOperational,
		Enabled:          true,
		LastSnapshotAt:   now.Unix(),
	}
	require.NoError(t, model.DB.Create(&source).Error)
	group := model.UpstreamGroup{
		SourceID:            source.ID,
		ExternalID:          "group",
		Name:                "Group",
		Platform:            "openai",
		EffectiveMultiplier: 0.1,
		HealthStatus:        model.UpstreamHealthOperational,
		ObservedAt:          now.Unix(),
	}
	require.NoError(t, model.DB.Create(&group).Error)
	models := []string{"gpt-5.6-sol", "gpt-6-astra"}
	channels := make(map[string]model.Channel)
	for _, protocol := range []string{model.UpstreamProtocolOpenAI, model.UpstreamProtocolAnthropic} {
		priority := int64(0)
		weight := uint(100)
		channel := model.Channel{
			Type:     constant.ChannelTypeAdvancedCustom,
			Status:   common.ChannelStatusEnabled,
			Name:     protocol,
			Weight:   &weight,
			BaseURL:  &endpoint,
			Models:   strings.Join(models, ","),
			Group:    "default",
			Priority: &priority,
		}
		require.NoError(t, model.DB.Create(&channel).Error)
		require.NoError(t, channel.AddAbilities(nil))
		require.NoError(t, model.DB.Create(&model.UpstreamManagedRoute{
			SourceID:        source.ID,
			ExternalGroupID: group.ExternalID,
			Platform:        group.Platform,
			Protocol:        protocol,
			ChannelID:       channel.Id,
			State:           model.UpstreamRouteStateActive,
		}).Error)
		channels[protocol] = channel
	}

	result, err := rankManagedRoutes(
		now,
		[]model.UpstreamSource{source},
		[]model.UpstreamGroup{group},
		[]upstreamRouteCandidate{{source: source, group: group, models: models}},
		&operation_setting.UpstreamOrchestrationSetting{
			SyncIntervalHours: 4,
			ProtocolModelExclusions: map[string][]string{
				model.UpstreamProtocolAnthropic: {"gpt-6-astra"},
			},
		},
	)
	require.NoError(t, err)
	assert.Equal(t, 2, result.prioritiesUpdated)

	var openAI model.Channel
	require.NoError(t, model.DB.First(&openAI, channels[model.UpstreamProtocolOpenAI].Id).Error)
	assert.Equal(t, "gpt-5.6-sol,gpt-6-astra", openAI.Models)
	var anthropic model.Channel
	require.NoError(t, model.DB.First(&anthropic, channels[model.UpstreamProtocolAnthropic].Id).Error)
	assert.Equal(t, "gpt-5.6-sol", anthropic.Models)
}

func TestReconcileManagedUpstreamsAppliesCommittedRoutingSideEffects(t *testing.T) {
	newFixture := func(
		t *testing.T,
		protocolExclusions map[string][]string,
	) (time.Time, model.Channel) {
		t.Helper()
		previousMemoryCache := common.MemoryCacheEnabled
		t.Cleanup(func() {
			common.MemoryCacheEnabled = previousMemoryCache
			if previousMemoryCache {
				model.InitChannelCache()
			}
		})
		setupUpstreamOrchestrationTest(t)
		common.MemoryCacheEnabled = true
		require.NoError(t, model.DB.AutoMigrate(&model.Channel{}, &model.Ability{}))

		originalModelRatios := ratio_setting.ModelRatio2JSONString()
		require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(`{"gpt-4.1":1}`))
		t.Cleanup(func() {
			require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(originalModelRatios))
		})
		updateUpstreamOrchestrationForTest(t, func(setting *operation_setting.UpstreamOrchestrationSetting) {
			setting.Enabled = true
			setting.AutoEnroll = false
			setting.CandidateLimit = 5
			setting.MaxUpstreamMultiplier = 1
			setting.SyncIntervalHours = 4
			setting.TargetGroups = []string{"default"}
			setting.ModelAliases = map[string]string{}
			setting.ModelExclusions = map[string][]string{}
			setting.ProtocolModelExclusions = protocolExclusions
		})

		now := time.Unix(1_788_320_000, 0)
		endpoint := "https://api.example.com"
		source := model.UpstreamSource{
			Key:              "source",
			Name:             "Source",
			ConsoleURL:       "https://example.com",
			SelectedEndpoint: endpoint,
			Status:           model.UpstreamHealthOperational,
			Enabled:          true,
			LastSnapshotAt:   now.Unix(),
		}
		require.NoError(t, model.DB.Create(&source).Error)
		group := model.UpstreamGroup{
			SourceID:            source.ID,
			ExternalID:          "group",
			Name:                "Group",
			Platform:            "openai",
			Models:              `["gpt-4.1"]`,
			EffectiveMultiplier: 0.1,
			HealthStatus:        model.UpstreamHealthOperational,
			ObservedAt:          now.Unix(),
		}
		require.NoError(t, model.DB.Create(&group).Error)
		priority := int64(999)
		weight := uint(100)
		channel := model.Channel{
			Type:     constant.ChannelTypeAdvancedCustom,
			Status:   common.ChannelStatusEnabled,
			Name:     "managed-route",
			Weight:   &weight,
			BaseURL:  &endpoint,
			Models:   "gpt-4.1",
			Group:    "default",
			Priority: &priority,
		}
		require.NoError(t, model.DB.Create(&channel).Error)
		require.NoError(t, channel.AddAbilities(nil))
		require.NoError(t, model.DB.Create(&model.UpstreamManagedRoute{
			SourceID:            source.ID,
			ExternalGroupID:     group.ExternalID,
			Platform:            group.Platform,
			Protocol:            model.UpstreamProtocolOpenAI,
			ChannelID:           channel.Id,
			State:               model.UpstreamRouteStateActive,
			Rank:                1,
			EffectiveMultiplier: group.EffectiveMultiplier,
			UpdatedAt:           now.Unix(),
		}).Error)
		model.InitChannelCache()
		selected, err := model.GetRandomSatisfiedChannel("default", "gpt-4.1", 0, nil)
		require.NoError(t, err)
		require.NotNil(t, selected)
		require.Equal(t, channel.Id, selected.Id)
		return now, channel
	}

	t.Run("all protocol models excluded", func(t *testing.T) {
		now, channel := newFixture(t, map[string][]string{
			model.UpstreamProtocolOpenAI: {"gpt-4.1"},
		})
		var closeReasons []string
		unregister := wsmanager.Register(channel.Id, wsmanager.KindResponses, func(reason string) {
			closeReasons = append(closeReasons, reason)
		})
		t.Cleanup(unregister)

		summary, err := ReconcileManagedUpstreams(now)

		require.NoError(t, err)
		assert.Zero(t, summary.PrioritiesUpdated)
		var stored model.Channel
		require.NoError(t, model.DB.First(&stored, channel.Id).Error)
		assert.Equal(t, common.ChannelStatusAutoDisabled, stored.Status)
		assert.Empty(t, stored.Models)
		var abilities int64
		require.NoError(t, model.DB.Model(&model.Ability{}).
			Where("channel_id = ?", channel.Id).Count(&abilities).Error)
		assert.Zero(t, abilities)
		selected, selectErr := model.GetRandomSatisfiedChannel("default", "gpt-4.1", 0, nil)
		require.NoError(t, selectErr)
		assert.Nil(t, selected)
		assert.Equal(t, []string{ChannelDisabledCloseReason}, closeReasons)
		assert.Zero(t, wsmanager.CloseChannel(channel.Id, "duplicate close"))
	})

	t.Run("active no-op reconcile remains available", func(t *testing.T) {
		now, channel := newFixture(t, map[string][]string{})
		var closeReasons []string
		unregister := wsmanager.Register(channel.Id, wsmanager.KindResponses, func(reason string) {
			closeReasons = append(closeReasons, reason)
		})
		t.Cleanup(unregister)

		for range 2 {
			summary, err := ReconcileManagedUpstreams(now)
			require.NoError(t, err)
			assert.Equal(t, 1, summary.PrioritiesUpdated)
		}

		var stored model.Channel
		require.NoError(t, model.DB.First(&stored, channel.Id).Error)
		assert.Equal(t, common.ChannelStatusEnabled, stored.Status)
		assert.Equal(t, "gpt-4.1", stored.Models)
		var abilities int64
		require.NoError(t, model.DB.Model(&model.Ability{}).
			Where("channel_id = ? AND enabled = ?", channel.Id, true).
			Count(&abilities).Error)
		assert.EqualValues(t, 1, abilities)
		selected, err := model.GetRandomSatisfiedChannel("default", "gpt-4.1", 0, nil)
		require.NoError(t, err)
		require.NotNil(t, selected)
		assert.Equal(t, channel.Id, selected.Id)
		assert.Empty(t, closeReasons)
		assert.Equal(t, 1, wsmanager.CloseChannel(channel.Id, "test cleanup"))
	})

	for _, tc := range []struct {
		name             string
		corruptAbilities func(*testing.T, model.Channel)
	}{
		{
			name: "missing ability",
			corruptAbilities: func(t *testing.T, channel model.Channel) {
				require.NoError(t, model.DB.
					Where("channel_id = ?", channel.Id).
					Delete(&model.Ability{}).Error)
			},
		},
		{
			name: "disabled and stale abilities",
			corruptAbilities: func(t *testing.T, channel model.Channel) {
				require.NoError(t, model.DB.
					Where("channel_id = ?", channel.Id).
					Delete(&model.Ability{}).Error)
				stalePriority := int64(17)
				require.NoError(t, model.DB.Create(&[]model.Ability{
					{
						Group: "default", Model: "gpt-4.1", ChannelId: channel.Id,
						Enabled: false, Priority: &stalePriority, Weight: 1,
					},
					{
						Group: "legacy", Model: "stale-model", ChannelId: channel.Id,
						Enabled: true, Priority: &stalePriority, Weight: 1,
					},
				}).Error)
			},
		},
	} {
		t.Run("no-op channel repairs "+tc.name, func(t *testing.T) {
			now, channel := newFixture(t, map[string][]string{})
			tc.corruptAbilities(t, channel)
			require.NoError(t, model.DB.Model(&model.Channel{}).
				Where("id = ?", channel.Id).
				Update("status", common.ChannelStatusAutoDisabled).Error)
			model.InitChannelCache()
			require.NoError(t, model.DB.Model(&model.Channel{}).
				Where("id = ?", channel.Id).
				Update("status", common.ChannelStatusEnabled).Error)
			selected, err := model.GetRandomSatisfiedChannel("default", "gpt-4.1", 0, nil)
			require.NoError(t, err)
			assert.Nil(t, selected)

			summary, err := ReconcileManagedUpstreams(now)

			require.NoError(t, err)
			assert.Equal(t, 1, summary.PrioritiesUpdated)
			var abilities []model.Ability
			require.NoError(t, model.DB.Where("channel_id = ?", channel.Id).Find(&abilities).Error)
			require.Len(t, abilities, 1)
			ability := abilities[0]
			assert.Equal(t, "default", ability.Group)
			assert.Equal(t, "gpt-4.1", ability.Model)
			assert.Equal(t, channel.Id, ability.ChannelId)
			assert.True(t, ability.Enabled)
			require.NotNil(t, ability.Priority)
			assert.EqualValues(t, 999, *ability.Priority)
			assert.EqualValues(t, 100, ability.Weight)
			assert.Nil(t, ability.Tag)
			selected, err = model.GetRandomSatisfiedChannel("default", "gpt-4.1", 0, nil)
			require.NoError(t, err)
			require.NotNil(t, selected)
			assert.Equal(t, channel.Id, selected.Id)
		})
	}

	t.Run("no-op ability repair failure rolls back route and cache", func(t *testing.T) {
		now, channel := newFixture(t, map[string][]string{})
		require.NoError(t, model.DB.
			Where("channel_id = ?", channel.Id).
			Delete(&model.Ability{}).Error)
		stalePriority := int64(17)
		stale := model.Ability{
			Group: "legacy", Model: "stale-model", ChannelId: channel.Id,
			Enabled: true, Priority: &stalePriority, Weight: 1,
		}
		require.NoError(t, model.DB.Create(&stale).Error)
		require.NoError(t, model.DB.Model(&model.Channel{}).
			Where("id = ?", channel.Id).
			Update("status", common.ChannelStatusAutoDisabled).Error)
		model.InitChannelCache()
		require.NoError(t, model.DB.Model(&model.Channel{}).
			Where("id = ?", channel.Id).
			Update("status", common.ChannelStatusEnabled).Error)
		var routeBefore model.UpstreamManagedRoute
		require.NoError(t, model.DB.Where("channel_id = ?", channel.Id).First(&routeBefore).Error)
		require.NoError(t, model.DB.Model(&routeBefore).
			Update("updated_at", now.Add(-time.Minute).Unix()).Error)
		require.NoError(t, model.DB.First(&routeBefore, routeBefore.ID).Error)
		injected := errors.New("injected no-op ability repair failure")
		const callbackName = "test:no_op_ability_repair_failure"
		require.NoError(t, model.DB.Callback().Delete().Before("gorm:delete").
			Register(callbackName, func(tx *gorm.DB) {
				if tx.Statement.Table == "abilities" {
					tx.AddError(injected)
				}
			}))
		t.Cleanup(func() {
			require.NoError(t, model.DB.Callback().Delete().Remove(callbackName))
		})

		_, err := ReconcileManagedUpstreams(now)

		require.ErrorIs(t, err, injected)
		var routeAfter model.UpstreamManagedRoute
		require.NoError(t, model.DB.First(&routeAfter, routeBefore.ID).Error)
		assert.Equal(t, routeBefore, routeAfter)
		var abilities []model.Ability
		require.NoError(t, model.DB.Where("channel_id = ?", channel.Id).Find(&abilities).Error)
		assert.Equal(t, []model.Ability{stale}, abilities)
		selected, selectErr := model.GetRandomSatisfiedChannel("default", "gpt-4.1", 0, nil)
		require.NoError(t, selectErr)
		assert.Nil(t, selected)
	})

	t.Run("failed routing transaction has no side effects", func(t *testing.T) {
		now, channel := newFixture(t, map[string][]string{
			model.UpstreamProtocolOpenAI: {"gpt-4.1"},
		})
		var closeReasons []string
		unregister := wsmanager.Register(channel.Id, wsmanager.KindResponses, func(reason string) {
			closeReasons = append(closeReasons, reason)
		})
		t.Cleanup(unregister)
		injected := errors.New("injected managed channel update failure")
		const callbackName = "test:managed_route_channel_update_failure"
		require.NoError(t, model.DB.Callback().Update().Before("gorm:update").Register(callbackName, func(tx *gorm.DB) {
			if tx.Statement.Table == "channels" {
				tx.AddError(injected)
			}
		}))
		t.Cleanup(func() {
			require.NoError(t, model.DB.Callback().Update().Remove(callbackName))
		})

		_, err := ReconcileManagedUpstreams(now)

		require.ErrorIs(t, err, injected)
		var stored model.Channel
		require.NoError(t, model.DB.First(&stored, channel.Id).Error)
		assert.Equal(t, common.ChannelStatusEnabled, stored.Status)
		assert.Equal(t, "gpt-4.1", stored.Models)
		var abilities int64
		require.NoError(t, model.DB.Model(&model.Ability{}).
			Where("channel_id = ? AND enabled = ?", channel.Id, true).
			Count(&abilities).Error)
		assert.EqualValues(t, 1, abilities)
		selected, selectErr := model.GetRandomSatisfiedChannel("default", "gpt-4.1", 0, nil)
		require.NoError(t, selectErr)
		require.NotNil(t, selected)
		assert.Equal(t, channel.Id, selected.Id)
		assert.Empty(t, closeReasons)
		assert.Equal(t, 1, wsmanager.CloseChannel(channel.Id, "test cleanup"))
	})
}

func TestRankManagedRoutesPreservesChannelWhenSnapshotIsStale(t *testing.T) {
	setupUpstreamOrchestrationTest(t)
	require.NoError(t, model.DB.AutoMigrate(&model.Channel{}, &model.Ability{}))
	now := time.Unix(1_788_320_000, 0)
	setting := &operation_setting.UpstreamOrchestrationSetting{
		SyncIntervalHours: 4,
	}
	source := model.UpstreamSource{
		Key:              "source",
		Name:             "Source",
		ConsoleURL:       "https://example.com",
		SelectedEndpoint: "https://api.example.com",
		Status:           model.UpstreamHealthOperational,
		Enabled:          true,
		LastSnapshotAt:   now.Add(-6 * time.Hour).Unix(),
	}
	require.NoError(t, model.DB.Create(&source).Error)
	group := model.UpstreamGroup{
		SourceID:            source.ID,
		ExternalID:          "group",
		Name:                "Group",
		Platform:            "openai",
		EffectiveMultiplier: 0.5,
		HealthStatus:        model.UpstreamHealthOperational,
		ObservedAt:          now.Add(-6 * time.Hour).Unix(),
	}
	require.NoError(t, model.DB.Create(&group).Error)
	priority := int64(777)
	weight := uint(100)
	baseURL := source.SelectedEndpoint
	channel := model.Channel{
		Type:     58,
		Status:   common.ChannelStatusEnabled,
		Name:     "stale",
		Weight:   &weight,
		BaseURL:  &baseURL,
		Models:   "gpt-stable",
		Group:    "default",
		Priority: &priority,
	}
	require.NoError(t, model.DB.Create(&channel).Error)
	require.NoError(t, channel.AddAbilities(nil))
	route := model.UpstreamManagedRoute{
		SourceID:        source.ID,
		ExternalGroupID: group.ExternalID,
		Platform:        group.Platform,
		Protocol:        model.UpstreamProtocolOpenAI,
		ChannelID:       channel.Id,
		State:           model.UpstreamRouteStateActive,
		Rank:            7,
	}
	require.NoError(t, model.DB.Create(&route).Error)

	result, err := rankManagedRoutes(
		now,
		[]model.UpstreamSource{source},
		[]model.UpstreamGroup{group},
		nil,
		setting,
	)

	require.NoError(t, err)
	assert.Zero(t, result.prioritiesUpdated)
	var reloadedChannel model.Channel
	require.NoError(t, model.DB.First(&reloadedChannel, channel.Id).Error)
	assert.Equal(t, common.ChannelStatusEnabled, reloadedChannel.Status)
	assert.EqualValues(t, 777, *reloadedChannel.Priority)
	assert.Equal(t, "gpt-stable", reloadedChannel.Models)
	var reloadedRoute model.UpstreamManagedRoute
	require.NoError(t, model.DB.First(&reloadedRoute, route.ID).Error)
	assert.EqualValues(t, 7, reloadedRoute.Rank)
}

func TestDesiredManagedRouteStatePromotesValidatedShadow(t *testing.T) {
	now := time.Unix(1_788_320_000, 0)
	setting := &operation_setting.UpstreamOrchestrationSetting{
		SyncIntervalHours:       4,
		ShadowSuccessesRequired: 3,
	}
	source := model.UpstreamSource{
		Enabled:        true,
		Status:         model.UpstreamHealthOperational,
		LastSnapshotAt: now.Unix(),
	}
	group := model.UpstreamGroup{
		HealthStatus: model.UpstreamHealthOperational,
		ObservedAt:   now.Unix(),
	}

	state, reason := desiredManagedRouteState(
		model.UpstreamManagedRoute{
			State:                model.UpstreamRouteStateShadow,
			ConsecutiveSuccesses: 3,
		},
		source,
		group,
		now,
		setting,
	)

	assert.Equal(t, model.UpstreamRouteStateActive, state)
	assert.Empty(t, reason)
}

func TestManagedCandidateSelectionEvaluableRequiresFreshSnapshot(t *testing.T) {
	now := time.Unix(1_788_320_000, 0)
	setting := &operation_setting.UpstreamOrchestrationSetting{
		SyncIntervalHours: 4,
	}
	source := model.UpstreamSource{
		Enabled:          true,
		SelectedEndpoint: "https://api.example.com",
		LastSnapshotAt:   now.Unix(),
	}
	group := model.UpstreamGroup{
		HealthStatus: model.UpstreamHealthOperational,
		ObservedAt:   now.Unix(),
	}

	assert.True(t, managedCandidateSelectionEvaluable(source, group, now, setting))

	source.LastSnapshotAt = now.Add(-6 * time.Hour).Unix()
	assert.False(t, managedCandidateSelectionEvaluable(source, group, now, setting))

	source.LastSnapshotAt = now.Unix()
	group.ObservedAt = now.Add(-6 * time.Hour).Unix()
	assert.False(t, managedCandidateSelectionEvaluable(source, group, now, setting))
}

func TestDesiredManagedRouteStateSafetyMatrix(t *testing.T) {
	now := time.Unix(1_788_320_000, 0)
	setting := &operation_setting.UpstreamOrchestrationSetting{
		SyncIntervalHours:       4,
		RedLongTermHours:        24,
		ShadowSuccessesRequired: 3,
	}
	positiveBalance := 10.0
	zeroBalance := 0.0
	baseSource := model.UpstreamSource{
		Enabled:        true,
		Balance:        &positiveBalance,
		LastSnapshotAt: now.Unix(),
	}
	tests := []struct {
		name     string
		route    model.UpstreamManagedRoute
		source   model.UpstreamSource
		group    model.UpstreamGroup
		expected string
	}{
		{
			name:     "degraded validated shadow activates",
			route:    model.UpstreamManagedRoute{State: model.UpstreamRouteStateShadow, ConsecutiveSuccesses: 3},
			source:   baseSource,
			group:    model.UpstreamGroup{HealthStatus: model.UpstreamHealthDegraded, ObservedAt: now.Unix()},
			expected: model.UpstreamRouteStateActive,
		},
		{
			name:     "unknown remains shadow",
			route:    model.UpstreamManagedRoute{State: model.UpstreamRouteStateShadow, ConsecutiveSuccesses: 3},
			source:   baseSource,
			group:    model.UpstreamGroup{HealthStatus: model.UpstreamHealthUnknown, ObservedAt: now.Unix()},
			expected: model.UpstreamRouteStateShadow,
		},
		{
			name:     "red quarantines",
			route:    model.UpstreamManagedRoute{State: model.UpstreamRouteStateActive},
			source:   baseSource,
			group:    model.UpstreamGroup{HealthStatus: model.UpstreamHealthFailed, ObservedAt: now.Unix(), RedSince: now.Add(-time.Hour).Unix()},
			expected: model.UpstreamRouteStateQuarantined,
		},
		{
			name:     "red for 24 hours becomes long red",
			route:    model.UpstreamManagedRoute{State: model.UpstreamRouteStateQuarantined},
			source:   baseSource,
			group:    model.UpstreamGroup{HealthStatus: model.UpstreamHealthFailed, ObservedAt: now.Unix(), RedSince: now.Add(-25 * time.Hour).Unix()},
			expected: model.UpstreamRouteStateLongRed,
		},
		{
			name:     "zero balance quarantines",
			route:    model.UpstreamManagedRoute{State: model.UpstreamRouteStateActive},
			source:   model.UpstreamSource{Enabled: true, Balance: &zeroBalance, LastSnapshotAt: now.Unix()},
			group:    model.UpstreamGroup{HealthStatus: model.UpstreamHealthOperational, ObservedAt: now.Unix()},
			expected: model.UpstreamRouteStateQuarantined,
		},
	}
	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			state, _ := desiredManagedRouteState(
				testCase.route,
				testCase.source,
				testCase.group,
				now,
				setting,
			)
			assert.Equal(t, testCase.expected, state)
		})
	}
}

func TestManagedRouteRecoveryBackoff(t *testing.T) {
	setupUpstreamOrchestrationTest(t)
	route := model.UpstreamManagedRoute{
		SourceID:        1,
		ExternalGroupID: "recovery",
		Platform:        "openai",
		Protocol:        model.UpstreamProtocolOpenAI,
		ChannelID:       1001,
		State:           model.UpstreamRouteStateShadow,
	}
	require.NoError(t, model.DB.Create(&route).Error)
	expectedDelays := []int64{300, 900, 3600, 14400, 0}
	for attempt, expectedDelay := range expectedDelays {
		before := common.GetTimestamp()
		require.NoError(t, MarkManagedRouteProbeResult(route.ID, false, 10, "failed"))
		var stored model.UpstreamManagedRoute
		require.NoError(t, model.DB.First(&stored, route.ID).Error)
		assert.Equal(t, attempt+1, stored.RecoveryAttempts)
		if expectedDelay == 0 {
			assert.Zero(t, stored.NextProbeAt)
			continue
		}
		assert.GreaterOrEqual(t, stored.NextProbeAt, before+expectedDelay)
		assert.LessOrEqual(t, stored.NextProbeAt, common.GetTimestamp()+expectedDelay)
	}
}

func TestEnqueueStaleManagedRouteProbesUnlimitedSchedulesEveryRoute(t *testing.T) {
	setupUpstreamOrchestrationTest(t)
	updateUpstreamOrchestrationForTest(t, func(setting *operation_setting.UpstreamOrchestrationSetting) {
		setting.CandidateLimit = 0
	})

	now := time.Unix(1_788_320_000, 0).Unix()
	groupIDs := []string{
		"unlimited-due-1",
		"unlimited-due-2",
		"unlimited-due-3",
		"unlimited-due-4",
		"unlimited-due-5",
		"unlimited-due-6",
	}
	routes := make([]model.UpstreamManagedRoute, 0, len(groupIDs)+2)
	for index, groupID := range groupIDs {
		routes = append(routes, model.UpstreamManagedRoute{
			SourceID:        int64(101 + index),
			ExternalGroupID: groupID,
			Platform:        "openai",
			Protocol:        model.UpstreamProtocolOpenAI,
			ChannelID:       7101 + index,
			State:           model.UpstreamRouteStateActive,
			Rank:            index + 1,
			LastSuccessAt:   now - 120,
		})
	}
	routes = append(routes,
		model.UpstreamManagedRoute{
			SourceID:        107,
			ExternalGroupID: "unlimited-future-probe",
			Platform:        "openai",
			Protocol:        model.UpstreamProtocolOpenAI,
			ChannelID:       7107,
			State:           model.UpstreamRouteStateActive,
			Rank:            7,
			LastSuccessAt:   now - 120,
			NextProbeAt:     now + 60,
		},
		model.UpstreamManagedRoute{
			SourceID:        108,
			ExternalGroupID: "unlimited-fresh",
			Platform:        "openai",
			Protocol:        model.UpstreamProtocolOpenAI,
			ChannelID:       7108,
			State:           model.UpstreamRouteStateActive,
			Rank:            8,
			LastSuccessAt:   now,
			NextProbeAt:     now - 30,
		},
	)
	require.NoError(t, model.DB.Create(&routes).Error)
	updateCount := 0
	const callbackName = "test:count-unlimited-managed-route-probe-updates"
	require.NoError(t, model.DB.Callback().Update().Before("gorm:update").Register(callbackName, func(*gorm.DB) {
		updateCount++
	}))
	t.Cleanup(func() {
		require.NoError(t, model.DB.Callback().Update().Remove(callbackName))
	})
	current := &model.UpstreamManagedRoute{
		SourceID:        199,
		ExternalGroupID: "unlimited-current",
		Platform:        "openai",
		Protocol:        model.UpstreamProtocolOpenAI,
		ChannelID:       7199,
		State:           model.UpstreamRouteStateActive,
	}

	enqueueStaleManagedRouteProbes(current, now, 60)

	assert.Equal(t, 1, updateCount)
	for _, groupID := range groupIDs {
		var stored model.UpstreamManagedRoute
		require.NoError(t, model.DB.Where("external_group_id = ?", groupID).First(&stored).Error)
		assert.Equal(t, now, stored.NextProbeAt)
	}
	var futureProbe model.UpstreamManagedRoute
	require.NoError(t, model.DB.Where("external_group_id = ?", "unlimited-future-probe").First(&futureProbe).Error)
	assert.Equal(t, now+60, futureProbe.NextProbeAt)
	var fresh model.UpstreamManagedRoute
	require.NoError(t, model.DB.Where("external_group_id = ?", "unlimited-fresh").First(&fresh).Error)
	assert.Equal(t, now-30, fresh.NextProbeAt)
}

func TestEnqueueStaleManagedRouteProbesPositiveLimitSchedulesOrderedSubset(t *testing.T) {
	setupUpstreamOrchestrationTest(t)
	updateUpstreamOrchestrationForTest(t, func(setting *operation_setting.UpstreamOrchestrationSetting) {
		setting.CandidateLimit = 2
	})

	now := time.Unix(1_788_320_000, 0).Unix()
	routes := []model.UpstreamManagedRoute{
		{
			SourceID:        201,
			ExternalGroupID: "positive-limit-rank-30",
			Platform:        "openai",
			Protocol:        model.UpstreamProtocolOpenAI,
			ChannelID:       7201,
			State:           model.UpstreamRouteStateActive,
			Rank:            30,
			LastSuccessAt:   now - 120,
			NextProbeAt:     now - 30,
		},
		{
			SourceID:        202,
			ExternalGroupID: "positive-limit-rank-10",
			Platform:        "openai",
			Protocol:        model.UpstreamProtocolOpenAI,
			ChannelID:       7202,
			State:           model.UpstreamRouteStateActive,
			Rank:            10,
			LastSuccessAt:   now - 120,
			NextProbeAt:     now - 30,
		},
		{
			SourceID:        203,
			ExternalGroupID: "positive-limit-rank-20",
			Platform:        "openai",
			Protocol:        model.UpstreamProtocolOpenAI,
			ChannelID:       7203,
			State:           model.UpstreamRouteStateActive,
			Rank:            20,
			LastSuccessAt:   now - 120,
			NextProbeAt:     now - 30,
		},
	}
	require.NoError(t, model.DB.Create(&routes).Error)
	current := &model.UpstreamManagedRoute{
		SourceID:        299,
		ExternalGroupID: "positive-limit-current",
		Platform:        "openai",
		Protocol:        model.UpstreamProtocolOpenAI,
		ChannelID:       7299,
		State:           model.UpstreamRouteStateActive,
	}

	enqueueStaleManagedRouteProbes(current, now, 60)

	expectedNextProbeAt := map[string]int64{
		"positive-limit-rank-10": now,
		"positive-limit-rank-20": now,
		"positive-limit-rank-30": now - 30,
	}
	for groupID, expected := range expectedNextProbeAt {
		var stored model.UpstreamManagedRoute
		require.NoError(t, model.DB.Where("external_group_id = ?", groupID).First(&stored).Error)
		assert.Equal(t, expected, stored.NextProbeAt)
	}
}

func TestShadowProbeDoesNotEnableChannelBeforeOrchestration(t *testing.T) {
	setupUpstreamOrchestrationTest(t)
	updateUpstreamOrchestrationForTest(t, func(setting *operation_setting.UpstreamOrchestrationSetting) {
		setting.Enabled = false
		setting.ShadowSuccessesRequired = 3
	})

	route := model.UpstreamManagedRoute{
		SourceID:        1,
		ExternalGroupID: "20",
		Platform:        "openai",
		Protocol:        model.UpstreamProtocolOpenAI,
		ChannelID:       999,
		State:           model.UpstreamRouteStateShadow,
		NextProbeAt:     common.GetTimestamp(),
	}
	require.NoError(t, model.DB.Create(&route).Error)

	for attempt := 1; attempt <= 3; attempt++ {
		require.NoError(t, MarkManagedRouteProbeResult(route.ID, true, int64(attempt), ""))
	}

	var stored model.UpstreamManagedRoute
	require.NoError(t, model.DB.First(&stored, route.ID).Error)
	assert.Equal(t, model.UpstreamRouteStateShadow, stored.State)
	assert.Equal(t, 3, stored.ConsecutiveSuccesses)
}

func TestPrepareManagedUpstreamShadowsIsIdempotent(t *testing.T) {
	setupUpstreamOrchestrationTest(t)
	now := time.Unix(1_788_320_000, 0)
	updateUpstreamOrchestrationForTest(t, func(setting *operation_setting.UpstreamOrchestrationSetting) {
		setting.AutoEnroll = true
	})
	originalModelRatios := ratio_setting.ModelRatio2JSONString()
	require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(`{"gpt-4.1":1}`))
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(originalModelRatios))
	})

	source := model.UpstreamSource{
		Key:              model.UpstreamSourceKeyHualong,
		Name:             "Hualong",
		ConsoleURL:       "https://api.hualong.online",
		SelectedEndpoint: "https://api.hualong.online",
		Status:           model.UpstreamHealthOperational,
		Enabled:          true,
		LastSnapshotAt:   now.Unix(),
		LastSuccessAt:    now.Unix(),
	}
	require.NoError(t, model.DB.Create(&source).Error)
	require.NoError(t, model.DB.Create(&model.UpstreamGroup{
		SourceID:            source.ID,
		ExternalID:          "20",
		Name:                "GPT Pro",
		Platform:            "openai",
		BaseMultiplier:      0.15,
		EffectiveMultiplier: 0.15,
		HealthStatus:        model.UpstreamHealthOperational,
		Models:              `["gpt-4.1"]`,
		ObservedAt:          now.Unix(),
	}).Error)

	first, err := PrepareManagedUpstreamShadows(now)
	require.NoError(t, err)
	assert.Equal(t, 1, first.EnrollmentQueued)

	second, err := PrepareManagedUpstreamShadows(now)
	require.NoError(t, err)
	assert.Zero(t, second.EnrollmentQueued)

	var commandCount int64
	require.NoError(t, model.DB.Model(&model.UpstreamSyncCommand{}).Count(&commandCount).Error)
	assert.EqualValues(t, 1, commandCount)
}

func floatPointer(value float64) *float64 {
	return &value
}
