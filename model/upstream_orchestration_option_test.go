package model

import (
	"errors"
	"fmt"
	"maps"
	"reflect"
	"slices"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func TestAppendUpstreamModelExclusionPreservesConcurrentUnion(t *testing.T) {
	db := setupUpstreamOrchestrationOptionTest(t)
	require.NoError(t, db.AutoMigrate(&UpstreamSource{}))
	require.NoError(t, UpdateUpstreamOrchestrationPolicy(
		operation_setting.UpstreamRoutingPolicy{
			TargetGroups:            []string{"default"},
			ModelAliases:            map[string]string{},
			ModelExclusions:         map[string][]string{},
			ProtocolModelExclusions: map[string][]string{},
		},
	))
	source := UpstreamSource{
		Key: "source", Name: "Source", ConsoleURL: "https://console.example.com",
	}
	require.NoError(t, db.Create(&source).Error)

	start := make(chan struct{})
	results := make(chan error, 2)
	var writers sync.WaitGroup
	for _, modelName := range []string{"model-a", "model-b"} {
		writers.Go(func() {
			<-start
			added, err := AppendUpstreamModelExclusion(source.ID, "paid", modelName)
			if err == nil && !added {
				err = errors.New("model exclusion was not added")
			}
			results <- err
		})
	}
	close(start)
	writers.Wait()
	close(results)
	for err := range results {
		require.NoError(t, err)
	}

	persisted := readUpstreamOrchestrationOptions(t, db)
	var exclusions map[string][]string
	require.NoError(t, common.UnmarshalJsonStr(
		persisted["upstream_orchestration.model_exclusions"],
		&exclusions,
	))
	assert.ElementsMatch(t, []string{"model-a", "model-b"}, exclusions["source:paid"])
	assert.Equal(
		t,
		exclusions,
		operation_setting.GetUpstreamOrchestrationSetting().ModelExclusions,
	)
	common.OptionMapRWMutex.RLock()
	published := common.OptionMap["upstream_orchestration.model_exclusions"]
	common.OptionMapRWMutex.RUnlock()
	assert.JSONEq(t, persisted["upstream_orchestration.model_exclusions"], published)
}

func TestAppendUpstreamModelExclusionPublishesOnlyAfterSuccessfulTransaction(t *testing.T) {
	db := setupUpstreamOrchestrationOptionTest(t)
	require.NoError(t, db.AutoMigrate(&UpstreamSource{}))
	initial := operation_setting.UpstreamRoutingPolicy{
		TargetGroups:            []string{"default"},
		ModelAliases:            map[string]string{},
		ModelExclusions:         map[string][]string{"source:paid": {"existing"}},
		ProtocolModelExclusions: map[string][]string{},
	}
	require.NoError(t, UpdateUpstreamOrchestrationPolicy(initial))
	source := UpstreamSource{
		Key: "source", Name: "Source", ConsoleURL: "https://console.example.com",
	}
	require.NoError(t, db.Create(&source).Error)
	injected := errors.New("injected exclusion update failure")
	const callbackName = "test:managed_exclusion_update_failure"
	require.NoError(t, db.Callback().Update().Before("gorm:update").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Table == "options" {
			tx.AddError(injected)
		}
	}))
	t.Cleanup(func() {
		require.NoError(t, db.Callback().Update().Remove(callbackName))
	})

	added, err := AppendUpstreamModelExclusion(source.ID, "paid", "not-committed")

	require.ErrorIs(t, err, injected)
	assert.False(t, added)
	persisted := readUpstreamOrchestrationOptions(t, db)
	assert.JSONEq(
		t,
		`{"source:paid":["existing"]}`,
		persisted["upstream_orchestration.model_exclusions"],
	)
	assert.Equal(
		t,
		initial.ModelExclusions,
		operation_setting.GetUpstreamOrchestrationSetting().ModelExclusions,
	)
}

func TestAppendUpstreamModelExclusionWaitsForExternalRowWriter(t *testing.T) {
	db := setupUpstreamOrchestrationOptionTest(t)
	if db.Dialector.Name() != "mysql" && db.Dialector.Name() != "postgres" {
		t.Skip("requires a database with row-level locks")
	}
	require.NoError(t, db.AutoMigrate(&UpstreamSource{}))
	require.NoError(t, UpdateUpstreamOrchestrationPolicy(
		operation_setting.UpstreamRoutingPolicy{
			TargetGroups:            []string{"default"},
			ModelAliases:            map[string]string{},
			ModelExclusions:         map[string][]string{},
			ProtocolModelExclusions: map[string][]string{},
		},
	))
	source := UpstreamSource{
		Key: "source", Name: "Source", ConsoleURL: "https://console.example.com",
	}
	require.NoError(t, db.Create(&source).Error)

	externalLocked := make(chan struct{})
	releaseExternal := make(chan struct{})
	externalDone := make(chan error, 1)
	go func() {
		externalDone <- db.Transaction(func(tx *gorm.DB) error {
			var option Option
			if err := lockForUpdate(tx).
				Where(clause.Eq{
					Column: clause.Column{Name: "key"},
					Value:  upstreamOrchestrationOptionPrefix + "model_exclusions",
				}).
				First(&option).Error; err != nil {
				return err
			}
			option.Value = `{"source:paid":["external-model"]}`
			if err := tx.Save(&option).Error; err != nil {
				return err
			}
			close(externalLocked)
			<-releaseExternal
			return nil
		})
	}()
	select {
	case <-externalLocked:
	case err := <-externalDone:
		require.NoError(t, err)
		t.Fatal("external writer completed before holding its row lock")
	case <-time.After(5 * time.Second):
		t.Fatal("external writer did not acquire its row lock")
	}
	appendDone := make(chan error, 1)
	go func() {
		added, err := AppendUpstreamModelExclusion(source.ID, "paid", "health-model")
		if err == nil && !added {
			err = errors.New("health exclusion was not added")
		}
		appendDone <- err
	}()
	var appendErr error
	completedBeforeRelease := false
	select {
	case appendErr = <-appendDone:
		completedBeforeRelease = true
	case <-time.After(100 * time.Millisecond):
	}
	close(releaseExternal)
	require.NoError(t, <-externalDone)
	if completedBeforeRelease {
		require.NoError(t, appendErr)
		t.Fatal("health exclusion writer did not wait for the external row lock")
	}
	require.NoError(t, <-appendDone)

	persisted := readUpstreamOrchestrationOptions(t, db)
	var exclusions map[string][]string
	require.NoError(t, common.UnmarshalJsonStr(
		persisted["upstream_orchestration.model_exclusions"],
		&exclusions,
	))
	assert.Equal(t, []string{"external-model", "health-model"}, exclusions["source:paid"])
	assert.Equal(
		t,
		exclusions,
		operation_setting.GetUpstreamOrchestrationSetting().ModelExclusions,
	)
}

func TestUpdateUpstreamOrchestrationOptionDoesNotOverwriteNewerDatabasePolicy(t *testing.T) {
	db := setupUpstreamOrchestrationOptionTest(t)
	newer := map[string]string{
		"upstream_orchestration.target_groups":             `["database-newer"]`,
		"upstream_orchestration.model_aliases":             `{"database":"newer"}`,
		"upstream_orchestration.model_exclusions":          `{"leyi:newer":["database-newer"]}`,
		"upstream_orchestration.protocol_model_exclusions": `{"anthropic":["database-newer"]}`,
	}
	seedUpstreamOrchestrationOptions(t, db, newer)
	setStaleUpstreamOrchestrationRuntime(t)

	require.NoError(t, UpdateOption(
		"upstream_orchestration.model_aliases",
		`{" request ":" fresh "}`,
	))

	expected := maps.Clone(newer)
	expected["upstream_orchestration.model_aliases"] = `{"request":"fresh"}`
	assert.Equal(t, expected, readUpstreamOrchestrationOptions(t, db))

	runtime := operation_setting.GetUpstreamOrchestrationSetting()
	assert.Equal(t, []string{"runtime-stale"}, runtime.TargetGroups)
	assert.Equal(t, map[string]string{"request": "fresh"}, runtime.ModelAliases)
	assert.Equal(t, map[string][]string{"leyi:stale": {"runtime-stale"}}, runtime.ModelExclusions)
	assert.Equal(t, map[string][]string{"openai": {"runtime-stale"}}, runtime.ProtocolModelExclusions)
	common.OptionMapRWMutex.RLock()
	assert.JSONEq(t, `{"request":"fresh"}`, common.OptionMap["upstream_orchestration.model_aliases"])
	assert.JSONEq(t, `["runtime-stale"]`, common.OptionMap["upstream_orchestration.target_groups"])
	common.OptionMapRWMutex.RUnlock()
}

func TestLoadOptionsFromDatabaseDoesNotPublishStaleUpstreamPolicy(t *testing.T) {
	db := setupUpstreamOrchestrationOptionTest(t)
	seedUpstreamOrchestrationOptions(t, db, map[string]string{
		"upstream_orchestration.target_groups":             `["database-old"]`,
		"upstream_orchestration.model_aliases":             `{"database":"old"}`,
		"upstream_orchestration.model_exclusions":          `{"leyi:old":["database-old"]}`,
		"upstream_orchestration.protocol_model_exclusions": `{"openai":["database-old"]}`,
	})
	setStaleUpstreamOrchestrationRuntime(t)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(2)

	newer := operation_setting.UpstreamRoutingPolicy{
		TargetGroups:            []string{"database-newer"},
		ModelAliases:            map[string]string{"database": "newer"},
		ModelExclusions:         map[string][]string{"leyi:newer": {"database-newer"}},
		ProtocolModelExclusions: map[string][]string{"anthropic": {"database-newer"}},
	}
	writerDone := make(chan struct{})
	var writerErr error
	const callbackName = "test:stale_upstream_reload"
	require.NoError(t, db.Callback().Query().After("gorm:query").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Table != "options" {
			return
		}
		if _, loadingAllOptions := tx.Statement.Dest.(*[]*Option); !loadingAllOptions {
			return
		}
		go func() {
			writerErr = UpdateUpstreamOrchestrationPolicy(newer)
			close(writerDone)
		}()
		if upstreamOrchestrationOptionMutex.TryLock() {
			upstreamOrchestrationOptionMutex.Unlock()
			<-writerDone
		}
	}))
	t.Cleanup(func() {
		require.NoError(t, db.Callback().Query().Remove(callbackName))
	})

	loadOptionsFromDatabase()
	<-writerDone
	require.NoError(t, writerErr)

	persisted := readUpstreamOrchestrationOptions(t, db)
	assert.JSONEq(t, `["database-newer"]`, persisted["upstream_orchestration.target_groups"])
	assert.JSONEq(t, `{"database":"newer"}`, persisted["upstream_orchestration.model_aliases"])
	runtime := operation_setting.GetUpstreamOrchestrationSetting()
	assert.Equal(t, newer.TargetGroups, runtime.TargetGroups)
	assert.Equal(t, newer.ModelAliases, runtime.ModelAliases)
	assert.Equal(t, newer.ModelExclusions, runtime.ModelExclusions)
	assert.Equal(t, newer.ProtocolModelExclusions, runtime.ProtocolModelExclusions)
	common.OptionMapRWMutex.RLock()
	assert.JSONEq(t, `["database-newer"]`, common.OptionMap["upstream_orchestration.target_groups"])
	assert.JSONEq(t, `{"database":"newer"}`, common.OptionMap["upstream_orchestration.model_aliases"])
	common.OptionMapRWMutex.RUnlock()
}

func TestLoadOptionsFromDatabasePublishesCompleteUpstreamPolicy(t *testing.T) {
	db := setupUpstreamOrchestrationOptionTest(t)
	oldPolicy := operation_setting.UpstreamRoutingPolicy{
		TargetGroups:            []string{"old"},
		ModelAliases:            map[string]string{"old": "model"},
		ModelExclusions:         map[string][]string{"source:old": {"old-model"}},
		ProtocolModelExclusions: map[string][]string{"openai": {"old-protocol-model"}},
	}
	require.NoError(t, UpdateUpstreamOrchestrationPolicy(oldPolicy))
	oldValues, _, err := encodeUpstreamOrchestrationPolicy(oldPolicy)
	require.NoError(t, err)
	newPolicy := operation_setting.UpstreamRoutingPolicy{
		TargetGroups:            []string{"new"},
		ModelAliases:            map[string]string{"new": "model"},
		ModelExclusions:         map[string][]string{"source:new": {"new-model"}},
		ProtocolModelExclusions: map[string][]string{"anthropic": {"new-protocol-model"}},
	}
	newValues, _, err := encodeUpstreamOrchestrationPolicy(newPolicy)
	require.NoError(t, err)
	require.NoError(t, db.Transaction(func(tx *gorm.DB) error {
		for key, value := range newValues {
			if err := tx.Model(&Option{}).Where(clause.Eq{
				Column: clause.Column{Name: "key"},
				Value:  key,
			}).
				Update("value", value).Error; err != nil {
				return err
			}
		}
		return nil
	}))

	configHeld := make(chan struct{})
	releaseConfig := make(chan struct{})
	holderDone := make(chan struct{})
	go func() {
		config.GlobalConfig.Read("upstream_orchestration", func(any) {
			close(configHeld)
			<-releaseConfig
		})
		close(holderDone)
	}()
	<-configHeld
	reloadDone := make(chan struct{})
	go func() {
		loadOptionsFromDatabase()
		close(reloadDone)
	}()
	require.Eventually(t, func() bool {
		if common.OptionMapRWMutex.TryLock() {
			common.OptionMapRWMutex.Unlock()
			return false
		}
		return true
	}, 5*time.Second, time.Millisecond)
	observed := make(chan operation_setting.UpstreamRoutingPolicy, 1)
	go func() {
		setting := operation_setting.GetUpstreamOrchestrationSetting()
		observed <- operation_setting.UpstreamRoutingPolicy{
			TargetGroups:            setting.TargetGroups,
			ModelAliases:            setting.ModelAliases,
			ModelExclusions:         setting.ModelExclusions,
			ProtocolModelExclusions: setting.ProtocolModelExclusions,
		}
	}()
	observedOptions := make(chan map[string]string, 1)
	go func() {
		common.OptionMapRWMutex.RLock()
		values := make(map[string]string, len(newValues))
		for key := range newValues {
			values[key] = common.OptionMap[key]
		}
		common.OptionMapRWMutex.RUnlock()
		observedOptions <- values
	}()
	close(releaseConfig)
	snapshot := <-observed
	optionSnapshot := <-observedOptions
	<-holderDone
	<-reloadDone

	assert.True(
		t,
		reflect.DeepEqual(snapshot, oldPolicy) || reflect.DeepEqual(snapshot, newPolicy),
		"observed mixed routing policy: %#v",
		snapshot,
	)
	assert.True(
		t,
		reflect.DeepEqual(optionSnapshot, oldValues) ||
			reflect.DeepEqual(optionSnapshot, newValues),
		"observed mixed routing OptionMap: %#v",
		optionSnapshot,
	)
	current := operation_setting.GetUpstreamOrchestrationSetting()
	assert.Equal(t, newPolicy, operation_setting.UpstreamRoutingPolicy{
		TargetGroups:            current.TargetGroups,
		ModelAliases:            current.ModelAliases,
		ModelExclusions:         current.ModelExclusions,
		ProtocolModelExclusions: current.ProtocolModelExclusions,
	})
	common.OptionMapRWMutex.RLock()
	for key, value := range newValues {
		assert.JSONEq(t, value, common.OptionMap[key])
	}
	common.OptionMapRWMutex.RUnlock()
}

func TestLoadOptionsFromDatabaseRechecksRemotePolicyCommit(t *testing.T) {
	db := setupUpstreamOrchestrationOptionTest(t)
	oldPolicy := operation_setting.UpstreamRoutingPolicy{
		TargetGroups:            []string{"old"},
		ModelAliases:            map[string]string{"old": "model"},
		ModelExclusions:         map[string][]string{"source:old": {"old-model"}},
		ProtocolModelExclusions: map[string][]string{"openai": {"old-protocol-model"}},
	}
	require.NoError(t, UpdateUpstreamOrchestrationPolicy(oldPolicy))
	newPolicy := operation_setting.UpstreamRoutingPolicy{
		TargetGroups:            []string{"remote-new"},
		ModelAliases:            map[string]string{"remote": "new"},
		ModelExclusions:         map[string][]string{"source:new": {"remote-new-model"}},
		ProtocolModelExclusions: map[string][]string{"anthropic": {"remote-new-protocol-model"}},
	}
	newValues, _, err := encodeUpstreamOrchestrationPolicy(newPolicy)
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(2)

	var commitOnce sync.Once
	const callbackName = "test:remote_upstream_policy_commit"
	require.NoError(t, db.Callback().Query().After("gorm:query").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Table != "options" {
			return
		}
		if _, loadingAllOptions := tx.Statement.Dest.(*[]*Option); !loadingAllOptions {
			return
		}
		commitOnce.Do(func() {
			committed := make(chan error, 1)
			go func() {
				committed <- db.Transaction(func(writeTx *gorm.DB) error {
					for key, value := range newValues {
						if err := writeTx.Model(&Option{}).Where(clause.Eq{
							Column: clause.Column{Name: "key"},
							Value:  key,
						}).
							Update("value", value).Error; err != nil {
							return err
						}
					}
					return nil
				})
			}()
			require.NoError(t, <-committed)
		})
	}))
	t.Cleanup(func() {
		require.NoError(t, db.Callback().Query().Remove(callbackName))
	})

	loadOptionsFromDatabase()

	current := operation_setting.GetUpstreamOrchestrationSetting()
	assert.Equal(t, newPolicy, operation_setting.UpstreamRoutingPolicy{
		TargetGroups:            current.TargetGroups,
		ModelAliases:            current.ModelAliases,
		ModelExclusions:         current.ModelExclusions,
		ProtocolModelExclusions: current.ProtocolModelExclusions,
	})
}

func TestLoadOptionsFromDatabasePublishesSingleUpstreamSnapshot(t *testing.T) {
	db := setupUpstreamOrchestrationOptionTest(t)
	if db.Dialector.Name() == "sqlite" {
		t.Skip("requires row-level locks for a deterministic inter-transaction commit")
	}
	oldValues := map[string]string{
		upstreamOrchestrationOptionPrefix + "enabled":                      "false",
		upstreamOrchestrationOptionPrefix + "static_egress_ips":            `{"source":["192.0.2.10"]}`,
		upstreamOrchestrationOptionPrefix + "target_groups":                `["old"]`,
		upstreamOrchestrationOptionPrefix + "model_aliases":                `{"public":"old"}`,
		upstreamOrchestrationOptionPrefix + "model_exclusions":             `{"source:old":["old-model"]}`,
		upstreamOrchestrationOptionPrefix + "protocol_model_exclusions":    `{"openai":["old-protocol-model"]}`,
		upstreamOrchestrationOptionPrefix + "probe_concurrency_per_source": "3",
	}
	newValues := map[string]string{
		upstreamOrchestrationOptionPrefix + "enabled":                      "true",
		upstreamOrchestrationOptionPrefix + "static_egress_ips":            `{"source":["198.51.100.10"]}`,
		upstreamOrchestrationOptionPrefix + "target_groups":                `["new"]`,
		upstreamOrchestrationOptionPrefix + "model_aliases":                `{"public":"new"}`,
		upstreamOrchestrationOptionPrefix + "model_exclusions":             `{"source:new":["new-model"]}`,
		upstreamOrchestrationOptionPrefix + "protocol_model_exclusions":    `{"anthropic":["new-protocol-model"]}`,
		upstreamOrchestrationOptionPrefix + "probe_concurrency_per_source": "4",
	}
	seedUpstreamOrchestrationOptions(t, db, oldValues)
	require.NoError(t, config.GlobalConfig.LoadFromDB(oldValues))
	common.OptionMapRWMutex.Lock()
	common.OptionMap = maps.Clone(oldValues)
	common.OptionMapRWMutex.Unlock()
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(2)

	var commitOnce sync.Once
	const callbackName = "test:complete_upstream_snapshot_commit"
	require.NoError(t, db.Callback().Query().After("gorm:query").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Table != "options" {
			return
		}
		if _, loadingAllOptions := tx.Statement.Dest.(*[]*Option); !loadingAllOptions {
			return
		}
		commitOnce.Do(func() {
			committed := make(chan error, 1)
			go func() {
				committed <- db.Transaction(func(writeTx *gorm.DB) error {
					if err := acquireUpstreamPolicyWriteIntentTx(writeTx); err != nil {
						return err
					}
					for _, key := range slices.Sorted(maps.Keys(newValues)) {
						if err := saveOptionTx(
							writeTx,
							key,
							newValues[key],
							optionWriteUpstreamOrchestration,
						); err != nil {
							return err
						}
					}
					return nil
				})
			}()
			require.NoError(t, <-committed)
		})
	}))
	t.Cleanup(func() {
		require.NoError(t, db.Callback().Query().Remove(callbackName))
	})

	loadOptionsFromDatabase()

	current := operation_setting.GetUpstreamOrchestrationSetting()
	currentSnapshot := map[string]any{
		"enabled":                      current.Enabled,
		"static_egress_ips":            current.StaticEgressIPs,
		"target_groups":                current.TargetGroups,
		"model_aliases":                current.ModelAliases,
		"model_exclusions":             current.ModelExclusions,
		"protocol_model_exclusions":    current.ProtocolModelExclusions,
		"probe_concurrency_per_source": current.ProbeConcurrencyPerSource,
	}
	oldSnapshot := map[string]any{
		"enabled":                      false,
		"static_egress_ips":            map[string][]string{"source": {"192.0.2.10"}},
		"target_groups":                []string{"old"},
		"model_aliases":                map[string]string{"public": "old"},
		"model_exclusions":             map[string][]string{"source:old": {"old-model"}},
		"protocol_model_exclusions":    map[string][]string{"openai": {"old-protocol-model"}},
		"probe_concurrency_per_source": 3,
	}
	newSnapshot := map[string]any{
		"enabled":                      true,
		"static_egress_ips":            map[string][]string{"source": {"198.51.100.10"}},
		"target_groups":                []string{"new"},
		"model_aliases":                map[string]string{"public": "new"},
		"model_exclusions":             map[string][]string{"source:new": {"new-model"}},
		"protocol_model_exclusions":    map[string][]string{"anthropic": {"new-protocol-model"}},
		"probe_concurrency_per_source": 4,
	}
	assert.True(
		t,
		reflect.DeepEqual(currentSnapshot, oldSnapshot) ||
			reflect.DeepEqual(currentSnapshot, newSnapshot),
		"runtime contains a mixed upstream snapshot: %#v",
		currentSnapshot,
	)
	assert.Equal(t, newSnapshot, currentSnapshot)

	common.OptionMapRWMutex.RLock()
	optionSnapshot := make(map[string]string, len(newValues))
	for key := range newValues {
		optionSnapshot[key] = common.OptionMap[key]
	}
	common.OptionMapRWMutex.RUnlock()
	assert.True(
		t,
		reflect.DeepEqual(optionSnapshot, oldValues) ||
			reflect.DeepEqual(optionSnapshot, newValues),
		"OptionMap contains a mixed upstream snapshot: %#v",
		optionSnapshot,
	)
	assert.Equal(t, newValues, optionSnapshot)
}

func TestLoadOptionsFromDatabaseRejectsWholeInvalidUpstreamSnapshot(t *testing.T) {
	db := setupUpstreamOrchestrationOptionTest(t)
	oldValues := map[string]string{
		upstreamOrchestrationOptionPrefix + "enabled":                   "false",
		upstreamOrchestrationOptionPrefix + "static_egress_ips":         `{"source":["192.0.2.10"]}`,
		upstreamOrchestrationOptionPrefix + "target_groups":             `["old"]`,
		upstreamOrchestrationOptionPrefix + "model_aliases":             `{"public":"old"}`,
		upstreamOrchestrationOptionPrefix + "model_exclusions":          `{"source:old":["old-model"]}`,
		upstreamOrchestrationOptionPrefix + "protocol_model_exclusions": `{"openai":["old-protocol-model"]}`,
	}
	require.NoError(t, config.GlobalConfig.LoadFromDB(oldValues))
	common.OptionMapRWMutex.Lock()
	common.OptionMap = maps.Clone(oldValues)
	common.OptionMapRWMutex.Unlock()
	persisted := map[string]string{
		upstreamOrchestrationOptionPrefix + "enabled":                   "true",
		upstreamOrchestrationOptionPrefix + "static_egress_ips":         `{"source":["198.51.100.10"]}`,
		upstreamOrchestrationOptionPrefix + "target_groups":             `[]`,
		upstreamOrchestrationOptionPrefix + "model_aliases":             `{"public":"new"}`,
		upstreamOrchestrationOptionPrefix + "model_exclusions":          `{"source:new":["new-model"]}`,
		upstreamOrchestrationOptionPrefix + "protocol_model_exclusions": `{"anthropic":["new-protocol-model"]}`,
	}
	seedUpstreamOrchestrationOptions(t, db, persisted)

	loadOptionsFromDatabase()

	current := operation_setting.GetUpstreamOrchestrationSetting()
	assert.False(t, current.Enabled)
	assert.Equal(t, map[string][]string{"source": {"192.0.2.10"}}, current.StaticEgressIPs)
	assert.Equal(t, []string{"old"}, current.TargetGroups)
	assert.Equal(t, map[string]string{"public": "old"}, current.ModelAliases)
	assert.Equal(t, map[string][]string{"source:old": {"old-model"}}, current.ModelExclusions)
	assert.Equal(
		t,
		map[string][]string{"openai": {"old-protocol-model"}},
		current.ProtocolModelExclusions,
	)
	common.OptionMapRWMutex.RLock()
	for key, value := range oldValues {
		assert.Equal(t, value, common.OptionMap[key], key)
	}
	common.OptionMapRWMutex.RUnlock()
}

func TestReloadUpstreamOrchestrationPolicyWaitsForMissingRowWriter(t *testing.T) {
	db := setupUpstreamOrchestrationOptionTest(t)
	setStaleUpstreamOrchestrationRuntime(t)
	seedUpstreamOrchestrationOptions(t, db, map[string]string{
		upstreamOrchestrationOptionPrefix + "target_groups": `["runtime-stale"]`,
	})
	newPolicy := operation_setting.UpstreamRoutingPolicy{
		TargetGroups:            []string{"remote-complete"},
		ModelAliases:            map[string]string{"remote": "complete"},
		ModelExclusions:         map[string][]string{"remote:group": {"remote-model"}},
		ProtocolModelExclusions: map[string][]string{"anthropic": {"remote-protocol-model"}},
	}
	newValues, _, err := encodeUpstreamOrchestrationPolicy(newPolicy)
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	if db.Dialector.Name() != "sqlite" {
		sqlDB.SetMaxOpenConns(2)
	}
	reloadSentinelAttempted := make(chan struct{})
	reloadPolicyReadAttempted := make(chan struct{})
	allowPolicyRead := make(chan struct{})
	var sentinelCreates atomic.Int32
	var policyReadOnce sync.Once
	const createCallback = "test:reload_missing_policy_sentinel"
	require.NoError(t, db.Callback().Create().Before("gorm:create").Register(createCallback, func(tx *gorm.DB) {
		option, ok := tx.Statement.Dest.(*Option)
		if !ok || option.Key != upstreamOrchestrationPolicyLockOptionKey {
			return
		}
		if sentinelCreates.Add(1) == 2 {
			close(reloadSentinelAttempted)
		}
	}))
	const queryCallback = "test:reload_missing_policy_rows"
	require.NoError(t, db.Callback().Query().Before("gorm:query").Register(queryCallback, func(tx *gorm.DB) {
		if tx.Statement.Table != "options" {
			return
		}
		if _, ok := tx.Statement.Dest.(*[]Option); !ok {
			return
		}
		policyReadOnce.Do(func() {
			close(reloadPolicyReadAttempted)
			<-allowPolicyRead
		})
	}))
	t.Cleanup(func() {
		require.NoError(t, db.Callback().Create().Remove(createCallback))
		require.NoError(t, db.Callback().Query().Remove(queryCallback))
	})

	writerReady := make(chan struct{})
	releaseWriter := make(chan struct{})
	writerDone := make(chan error, 1)
	go func() {
		writerDone <- db.Transaction(func(tx *gorm.DB) error {
			if err := acquireUpstreamPolicyWriteIntentTx(tx); err != nil {
				return err
			}
			for _, key := range []string{
				upstreamOrchestrationOptionPrefix + "target_groups",
				upstreamOrchestrationOptionPrefix + "model_aliases",
				upstreamOrchestrationOptionPrefix + "model_exclusions",
				upstreamOrchestrationOptionPrefix + "protocol_model_exclusions",
			} {
				if err := saveOptionTx(
					tx,
					key,
					newValues[key],
					optionWriteUpstreamOrchestration,
				); err != nil {
					return err
				}
			}
			close(writerReady)
			<-releaseWriter
			return nil
		})
	}()
	select {
	case <-writerReady:
	case writerErr := <-writerDone:
		require.NoError(t, writerErr)
		t.Fatal("missing-row writer completed before holding the policy sentinel")
	case <-time.After(5 * time.Second):
		t.Fatal("missing-row writer did not acquire the policy sentinel")
	}

	reloadDone := make(chan error, 1)
	go func() {
		reloadDone <- reloadUpstreamOrchestrationPolicy()
	}()
	if db.Dialector.Name() != "sqlite" {
		select {
		case <-reloadSentinelAttempted:
			close(allowPolicyRead)
		case <-reloadPolicyReadAttempted:
			close(allowPolicyRead)
			select {
			case reloadErr := <-reloadDone:
				require.NoError(t, reloadErr)
				t.Fatal("policy reload completed while the writer held an existing policy row")
			case <-time.After(100 * time.Millisecond):
			}
		case <-time.After(5 * time.Second):
			t.Fatal("policy reload did not attempt the sentinel lock or policy read")
		}
	} else {
		close(allowPolicyRead)
	}
	close(releaseWriter)
	require.NoError(t, <-writerDone)
	require.NoError(t, <-reloadDone)

	current := operation_setting.GetUpstreamOrchestrationSetting()
	assert.Equal(t, newPolicy, operation_setting.UpstreamRoutingPolicy{
		TargetGroups:            current.TargetGroups,
		ModelAliases:            current.ModelAliases,
		ModelExclusions:         current.ModelExclusions,
		ProtocolModelExclusions: current.ProtocolModelExclusions,
	})
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()
	for key, value := range newValues {
		assert.JSONEq(t, value, common.OptionMap[key])
	}
}

func TestUpdateOptionsBulkWritesOnlySuppliedUpstreamPolicyKeys(t *testing.T) {
	db := setupUpstreamOrchestrationOptionTest(t)
	newer := map[string]string{
		"upstream_orchestration.target_groups":             `["database-newer"]`,
		"upstream_orchestration.model_aliases":             `{"database":"newer"}`,
		"upstream_orchestration.model_exclusions":          `{"leyi:newer":["database-newer"]}`,
		"upstream_orchestration.protocol_model_exclusions": `{"anthropic":["database-newer"]}`,
	}
	seedUpstreamOrchestrationOptions(t, db, newer)
	setStaleUpstreamOrchestrationRuntime(t)

	require.NoError(t, UpdateOptionsBulk(map[string]string{
		"upstream_orchestration.target_groups":    `[" request ","request","canary"]`,
		"upstream_orchestration.model_exclusions": `{" leyi:paid ":[" blocked ","blocked"]}`,
	}))

	expected := maps.Clone(newer)
	expected["upstream_orchestration.target_groups"] = `["request","canary"]`
	expected["upstream_orchestration.model_exclusions"] = `{"leyi:paid":["blocked"]}`
	assert.Equal(t, expected, readUpstreamOrchestrationOptions(t, db))

	beforeFailure := readUpstreamOrchestrationOptions(t, db)
	beforeRuntime := operation_setting.GetUpstreamOrchestrationSetting()
	common.OptionMapRWMutex.RLock()
	beforeOptionMap := maps.Clone(common.OptionMap)
	common.OptionMapRWMutex.RUnlock()
	updateCount := 0
	const callbackName = "test:reject_partial_upstream_policy"
	require.NoError(t, db.Callback().Update().Before("gorm:update").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Table != "options" {
			return
		}
		updateCount++
		if updateCount == 2 {
			tx.AddError(errors.New("injected partial policy failure"))
		}
	}))
	err := UpdateOptionsBulk(map[string]string{
		"upstream_orchestration.model_aliases":             `{"atomic":"rollback"}`,
		"upstream_orchestration.protocol_model_exclusions": `{"openai":["rollback"]}`,
	})
	require.ErrorContains(t, err, "injected partial policy failure")
	require.NoError(t, db.Callback().Update().Remove(callbackName))
	assert.Equal(t, beforeFailure, readUpstreamOrchestrationOptions(t, db))
	assert.Equal(t, beforeRuntime, operation_setting.GetUpstreamOrchestrationSetting())
	common.OptionMapRWMutex.RLock()
	assert.Equal(t, beforeOptionMap, common.OptionMap)
	common.OptionMapRWMutex.RUnlock()

	beforeMixed := readUpstreamOrchestrationOptions(t, db)
	err = UpdateOptionsBulk(map[string]string{
		"upstream_orchestration.model_aliases": `{"mixed":"rejected"}`,
		"ordinary.option":                      "must-not-write",
	})
	require.ErrorContains(t, err, "cannot be combined")
	assert.Equal(t, beforeMixed, readUpstreamOrchestrationOptions(t, db))
}

func TestUpdateUpstreamOrchestrationOptionsValidatesPersistedAggregate(t *testing.T) {
	t.Run("aggregate size limit rejects partial update atomically", func(t *testing.T) {
		db := setupUpstreamOrchestrationOptionTest(t)
		aliases := make(map[string]string, 256)
		for index := range 256 {
			key := fmt.Sprintf("alias-%03d-%s", index, strings.Repeat("k", 206))
			aliases[key] = strings.Repeat("v", 220)
		}
		initial := operation_setting.UpstreamRoutingPolicy{
			TargetGroups:            []string{"default"},
			ModelAliases:            aliases,
			ModelExclusions:         map[string][]string{},
			ProtocolModelExclusions: map[string][]string{},
		}
		require.NoError(t, UpdateUpstreamOrchestrationPolicy(initial))
		exclusions := make(map[string][]string, 100)
		for index := range 100 {
			key := fmt.Sprintf("source-%03d:group-%s", index, strings.Repeat("g", 96))
			exclusions[key] = []string{strings.Repeat("m", 120)}
		}
		rawExclusions, err := common.Marshal(exclusions)
		require.NoError(t, err)
		beforeDB := readUpstreamOrchestrationOptions(t, db)
		beforeRuntime := operation_setting.GetUpstreamOrchestrationSetting()
		common.OptionMapRWMutex.RLock()
		beforeOptionMap := maps.Clone(common.OptionMap)
		common.OptionMapRWMutex.RUnlock()

		err = UpdateUpstreamOrchestrationOptions(map[string]string{
			upstreamOrchestrationOptionPrefix + "model_exclusions": string(rawExclusions),
		})

		require.ErrorContains(t, err, "routing policy is too large")
		assert.Equal(t, beforeDB, readUpstreamOrchestrationOptions(t, db))
		assert.Equal(t, beforeRuntime, operation_setting.GetUpstreamOrchestrationSetting())
		common.OptionMapRWMutex.RLock()
		assert.Equal(t, beforeOptionMap, common.OptionMap)
		common.OptionMapRWMutex.RUnlock()
	})

	t.Run("invalid omitted row rejects unrelated update", func(t *testing.T) {
		db := setupUpstreamOrchestrationOptionTest(t)
		persisted := map[string]string{
			upstreamOrchestrationOptionPrefix + "target_groups":             `[]`,
			upstreamOrchestrationOptionPrefix + "model_aliases":             `{"existing":"model"}`,
			upstreamOrchestrationOptionPrefix + "model_exclusions":          `{}`,
			upstreamOrchestrationOptionPrefix + "protocol_model_exclusions": `{}`,
		}
		seedUpstreamOrchestrationOptions(t, db, persisted)
		setStaleUpstreamOrchestrationRuntime(t)
		beforeRuntime := operation_setting.GetUpstreamOrchestrationSetting()
		common.OptionMapRWMutex.RLock()
		beforeOptionMap := maps.Clone(common.OptionMap)
		common.OptionMapRWMutex.RUnlock()

		err := UpdateUpstreamOrchestrationOptions(map[string]string{
			upstreamOrchestrationOptionPrefix + "model_aliases": `{"replacement":"model"}`,
		})

		require.ErrorContains(t, err, "target_groups")
		assert.Equal(t, persisted, readUpstreamOrchestrationOptions(t, db))
		assert.Equal(t, beforeRuntime, operation_setting.GetUpstreamOrchestrationSetting())
		common.OptionMapRWMutex.RLock()
		assert.Equal(t, beforeOptionMap, common.OptionMap)
		common.OptionMapRWMutex.RUnlock()
	})

	t.Run("explicit update repairs invalid persisted row only", func(t *testing.T) {
		db := setupUpstreamOrchestrationOptionTest(t)
		persisted := map[string]string{
			upstreamOrchestrationOptionPrefix + "target_groups":             `[]`,
			upstreamOrchestrationOptionPrefix + "model_aliases":             `{"persisted":"model"}`,
			upstreamOrchestrationOptionPrefix + "model_exclusions":          `{"source:paid":["blocked"]}`,
			upstreamOrchestrationOptionPrefix + "protocol_model_exclusions": `{"openai":["protocol-blocked"]}`,
		}
		seedUpstreamOrchestrationOptions(t, db, persisted)
		setStaleUpstreamOrchestrationRuntime(t)

		require.NoError(t, UpdateUpstreamOrchestrationOptions(map[string]string{
			upstreamOrchestrationOptionPrefix + "target_groups": `[" repaired "]`,
		}))

		expected := maps.Clone(persisted)
		expected[upstreamOrchestrationOptionPrefix+"target_groups"] = `["repaired"]`
		assert.Equal(t, expected, readUpstreamOrchestrationOptions(t, db))
		runtime := operation_setting.GetUpstreamOrchestrationSetting()
		assert.Equal(t, []string{"repaired"}, runtime.TargetGroups)
		assert.Equal(t, map[string]string{"runtime": "stale"}, runtime.ModelAliases)
	})

	t.Run("missing rows use runtime defaults without persistence", func(t *testing.T) {
		db := setupUpstreamOrchestrationOptionTest(t)
		setStaleUpstreamOrchestrationRuntime(t)

		require.NoError(t, UpdateUpstreamOrchestrationOptions(map[string]string{
			upstreamOrchestrationOptionPrefix + "model_aliases": `{" request ":" actual "}`,
		}))

		assert.Equal(t, map[string]string{
			upstreamOrchestrationOptionPrefix + "model_aliases": `{"request":"actual"}`,
		}, readUpstreamOrchestrationOptions(t, db))
		runtime := operation_setting.GetUpstreamOrchestrationSetting()
		assert.Equal(t, []string{"runtime-stale"}, runtime.TargetGroups)
		assert.Equal(t, map[string]string{"request": "actual"}, runtime.ModelAliases)
	})
}

func TestConcurrentMissingPolicyRowsPreserveHealthExclusionUnion(t *testing.T) {
	db := setupUpstreamOrchestrationOptionTest(t)
	setStaleUpstreamOrchestrationRuntime(t)
	synchronizeIndependentPolicyCreates(t, db)

	appendFromIndependentNode := func(modelName string) error {
		var publishedValues map[string]string
		var publishedFields map[string]string
		err := runOptionWriteTransaction(db, func(tx *gorm.DB) error {
			policy, _, _, err := normalizeUpstreamOrchestrationOptionsTx(tx, nil)
			if err != nil {
				return err
			}
			const exclusionKey = "source:paid"
			policy.ModelExclusions[exclusionKey] = append(
				policy.ModelExclusions[exclusionKey],
				modelName,
			)
			normalized, err := operation_setting.NormalizeUpstreamRoutingPolicy(policy)
			if err != nil {
				return err
			}
			allValues, allFields, err := encodeUpstreamOrchestrationPolicy(normalized)
			if err != nil {
				return err
			}
			key := upstreamOrchestrationOptionPrefix + "model_exclusions"
			publishedValues = map[string]string{key: allValues[key]}
			publishedFields = map[string]string{"model_exclusions": allFields["model_exclusions"]}
			return saveOptionTx(tx, key, publishedValues[key], optionWriteUpstreamOrchestration)
		})
		if err != nil {
			return err
		}
		return publishUpstreamOrchestrationOptions(publishedValues, publishedFields)
	}

	start := make(chan struct{})
	results := make(chan error, 2)
	var writers sync.WaitGroup
	for _, modelName := range []string{"model-a", "model-b"} {
		writers.Go(func() {
			<-start
			results <- appendFromIndependentNode(modelName)
		})
	}
	close(start)
	writers.Wait()
	close(results)
	for err := range results {
		require.NoError(t, err)
	}

	persisted := readUpstreamOrchestrationOptions(t, db)
	var exclusions map[string][]string
	require.NoError(t, common.UnmarshalJsonStr(
		persisted[upstreamOrchestrationOptionPrefix+"model_exclusions"],
		&exclusions,
	))
	assert.ElementsMatch(t, []string{"model-a", "model-b"}, exclusions["source:paid"])
}

func TestConcurrentMissingPolicyRowsKeepAggregateWithinSizeLimit(t *testing.T) {
	db := setupUpstreamOrchestrationOptionTest(t)
	setStaleUpstreamOrchestrationRuntime(t)
	synchronizeIndependentPolicyCreates(t, db)

	aliases := make(map[string]string, 256)
	for index := range 256 {
		key := fmt.Sprintf("alias-%03d-%s", index, strings.Repeat("k", 206))
		aliases[key] = strings.Repeat("v", 220)
	}
	exclusions := make(map[string][]string, 100)
	for index := range 100 {
		key := fmt.Sprintf("source-%03d:group-%s", index, strings.Repeat("g", 96))
		exclusions[key] = []string{strings.Repeat("m", 120)}
	}
	rawAliases, err := common.Marshal(aliases)
	require.NoError(t, err)
	rawExclusions, err := common.Marshal(exclusions)
	require.NoError(t, err)
	writes := []map[string]string{
		{upstreamOrchestrationOptionPrefix + "model_aliases": string(rawAliases)},
		{upstreamOrchestrationOptionPrefix + "model_exclusions": string(rawExclusions)},
	}

	start := make(chan struct{})
	results := make(chan error, len(writes))
	var writers sync.WaitGroup
	for _, values := range writes {
		writers.Go(func() {
			<-start
			results <- writeUpstreamOrchestrationOptionsLocked(values)
		})
	}
	close(start)
	writers.Wait()
	close(results)

	successes := 0
	sizeErrors := 0
	for writeErr := range results {
		if writeErr == nil {
			successes++
			continue
		}
		if strings.Contains(writeErr.Error(), "routing policy is too large") {
			sizeErrors++
			continue
		}
		require.NoError(t, writeErr)
	}
	assert.Equal(t, 1, successes)
	assert.Equal(t, 1, sizeErrors)

	current := operation_setting.GetUpstreamOrchestrationSetting()
	aggregate, _, err := encodeUpstreamOrchestrationPolicy(operation_setting.UpstreamRoutingPolicy{
		TargetGroups:            current.TargetGroups,
		ModelAliases:            current.ModelAliases,
		ModelExclusions:         current.ModelExclusions,
		ProtocolModelExclusions: current.ProtocolModelExclusions,
	})
	require.NoError(t, err)
	maps.Copy(aggregate, readUpstreamOrchestrationOptions(t, db))
	policy, err := decodeUpstreamOrchestrationPolicy(aggregate)
	require.NoError(t, err)
	_, err = operation_setting.NormalizeUpstreamRoutingPolicy(policy)
	require.NoError(t, err)
}

func TestUpstreamPolicyLockOptionIsInternalAndProtected(t *testing.T) {
	db := setupUpstreamOrchestrationOptionTest(t)
	setStaleUpstreamOrchestrationRuntime(t)
	const lockKey = "upstream_orchestration.__policy_lock"
	require.NoError(t, UpdateUpstreamOrchestrationOptions(map[string]string{
		upstreamOrchestrationOptionPrefix + "model_aliases": `{"public":"actual"}`,
	}))

	var lock Option
	require.NoError(t, db.Where(clause.Eq{
		Column: clause.Column{Name: "key"},
		Value:  lockKey,
	}).First(&lock).Error)
	assert.Equal(t, "1", lock.Value)
	common.OptionMapRWMutex.RLock()
	_, published := common.OptionMap[lockKey]
	common.OptionMapRWMutex.RUnlock()
	assert.False(t, published)

	err := UpdateOption(lockKey, "tampered")
	require.ErrorContains(t, err, "requires its controlled writer")
	loadOptionsFromDatabase()
	common.OptionMapRWMutex.RLock()
	_, published = common.OptionMap[lockKey]
	common.OptionMapRWMutex.RUnlock()
	assert.False(t, published)
}

func TestAppendUpstreamModelExclusionValidatesPersistedAggregate(t *testing.T) {
	db := setupUpstreamOrchestrationOptionTest(t)
	require.NoError(t, db.AutoMigrate(&UpstreamSource{}))
	persisted := map[string]string{
		upstreamOrchestrationOptionPrefix + "target_groups":             `["default"]`,
		upstreamOrchestrationOptionPrefix + "model_aliases":             `{" ":"invalid"}`,
		upstreamOrchestrationOptionPrefix + "model_exclusions":          `{"source:paid":["existing"]}`,
		upstreamOrchestrationOptionPrefix + "protocol_model_exclusions": `{}`,
	}
	seedUpstreamOrchestrationOptions(t, db, persisted)
	setStaleUpstreamOrchestrationRuntime(t)
	source := UpstreamSource{
		Key: "source", Name: "Source", ConsoleURL: "https://console.example.com",
	}
	require.NoError(t, db.Create(&source).Error)
	beforeRuntime := operation_setting.GetUpstreamOrchestrationSetting()
	common.OptionMapRWMutex.RLock()
	beforeOptionMap := maps.Clone(common.OptionMap)
	common.OptionMapRWMutex.RUnlock()

	added, err := AppendUpstreamModelExclusion(source.ID, "paid", "health-model")

	require.ErrorContains(t, err, "model alias key")
	assert.False(t, added)
	assert.Equal(t, persisted, readUpstreamOrchestrationOptions(t, db))
	assert.Equal(t, beforeRuntime, operation_setting.GetUpstreamOrchestrationSetting())
	common.OptionMapRWMutex.RLock()
	assert.Equal(t, beforeOptionMap, common.OptionMap)
	common.OptionMapRWMutex.RUnlock()
}

func TestUpdateUpstreamSourceWithOptionsMergesStaticEgressFromDatabase(t *testing.T) {
	db := setupUpstreamOrchestrationOptionTest(t)
	seedUpstreamOrchestrationOptions(t, db, map[string]string{
		"upstream_orchestration.target_groups":             `["database-newer"]`,
		"upstream_orchestration.static_egress_ips":         `{"leyi":["192.0.2.10"],"other":["203.0.113.10"]}`,
		"upstream_orchestration.model_aliases":             `{}`,
		"upstream_orchestration.model_exclusions":          `{}`,
		"upstream_orchestration.protocol_model_exclusions": `{}`,
	})
	setStaleUpstreamOrchestrationRuntime(t)
	source := UpstreamSource{
		Key: "leyi", Name: "Leyi", ConsoleURL: "https://console.example",
		Status: "unknown", Enabled: true, LowBalanceThreshold: 5,
	}
	require.NoError(t, db.AutoMigrate(&UpstreamSource{}))
	require.NoError(t, db.Create(&source).Error)
	enabled := false
	threshold := 12.5

	require.NoError(t, UpdateUpstreamSourceWithOptions(UpstreamSourceMutation{
		SourceID:            source.ID,
		Enabled:             &enabled,
		LowBalanceThreshold: &threshold,
		StaticEgressIPs:     []string{" 198.51.100.10 "},
	}))

	var stored UpstreamSource
	require.NoError(t, db.First(&stored, source.ID).Error)
	assert.False(t, stored.Enabled)
	assert.Equal(t, threshold, stored.LowBalanceThreshold)
	options := readUpstreamOrchestrationOptions(t, db)
	assert.JSONEq(t,
		`{"leyi":["198.51.100.10"],"other":["203.0.113.10"]}`,
		options["upstream_orchestration.static_egress_ips"],
	)
	assert.Equal(t,
		map[string][]string{
			"leyi":  {"198.51.100.10"},
			"other": {"203.0.113.10"},
		},
		operation_setting.GetUpstreamOrchestrationSetting().StaticEgressIPs,
	)
}

func TestUpdateUpstreamSourceWithOptionsIgnoresInvalidUnchangedPolicy(t *testing.T) {
	for _, tc := range []struct {
		name             string
		mutation         UpstreamSourceMutation
		wantEnabled      bool
		wantThreshold    float64
		wantStaticEgress string
	}{
		{
			name:        "disable source",
			mutation:    UpstreamSourceMutation{Enabled: func() *bool { value := false; return &value }()},
			wantEnabled: false, wantThreshold: 5,
			wantStaticEgress: `{"source":["192.0.2.10"]}`,
		},
		{
			name: "update low balance threshold",
			mutation: UpstreamSourceMutation{
				LowBalanceThreshold: func() *float64 { value := 12.5; return &value }(),
			},
			wantEnabled: true, wantThreshold: 12.5,
			wantStaticEgress: `{"source":["192.0.2.10"]}`,
		},
		{
			name:             "repair static egress",
			mutation:         UpstreamSourceMutation{StaticEgressIPs: []string{"198.51.100.10"}},
			wantEnabled:      true,
			wantThreshold:    5,
			wantStaticEgress: `{"source":["198.51.100.10"]}`,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			db := setupUpstreamOrchestrationOptionTest(t)
			require.NoError(t, db.AutoMigrate(&UpstreamSource{}))
			policyRows := map[string]string{
				upstreamOrchestrationOptionPrefix + "target_groups":             `[]`,
				upstreamOrchestrationOptionPrefix + "model_aliases":             `{"persisted":"unchanged"}`,
				upstreamOrchestrationOptionPrefix + "model_exclusions":          `{"source:paid":["blocked"]}`,
				upstreamOrchestrationOptionPrefix + "protocol_model_exclusions": `{"openai":["blocked"]}`,
			}
			persisted := maps.Clone(policyRows)
			persisted[upstreamOrchestrationStaticEgressOptionKey] = `{"source":["192.0.2.10"]}`
			seedUpstreamOrchestrationOptions(t, db, persisted)
			setStaleUpstreamOrchestrationRuntime(t)
			beforeRuntime := operation_setting.GetUpstreamOrchestrationSetting()
			source := UpstreamSource{
				Key: "source", Name: "Source", ConsoleURL: "https://console.example",
				Status: "unknown", Enabled: true, LowBalanceThreshold: 5,
			}
			require.NoError(t, db.Create(&source).Error)
			mutation := tc.mutation
			mutation.SourceID = source.ID

			require.NoError(t, UpdateUpstreamSourceWithOptions(mutation))

			var stored UpstreamSource
			require.NoError(t, db.First(&stored, source.ID).Error)
			assert.Equal(t, tc.wantEnabled, stored.Enabled)
			assert.Equal(t, tc.wantThreshold, stored.LowBalanceThreshold)
			after := readUpstreamOrchestrationOptions(t, db)
			for key, value := range policyRows {
				assert.Equal(t, value, after[key], key)
			}
			assert.JSONEq(t, tc.wantStaticEgress, after[upstreamOrchestrationStaticEgressOptionKey])
			current := operation_setting.GetUpstreamOrchestrationSetting()
			assert.Equal(t, beforeRuntime.TargetGroups, current.TargetGroups)
			assert.Equal(t, beforeRuntime.ModelAliases, current.ModelAliases)
			assert.Equal(t, beforeRuntime.ModelExclusions, current.ModelExclusions)
			assert.Equal(
				t,
				beforeRuntime.ProtocolModelExclusions,
				current.ProtocolModelExclusions,
			)
			if mutation.StaticEgressIPs == nil {
				assert.Equal(t, beforeRuntime.StaticEgressIPs, current.StaticEgressIPs)
			} else {
				assert.Equal(
					t,
					map[string][]string{"source": {"198.51.100.10"}},
					current.StaticEgressIPs,
				)
			}
		})
	}
}

func setupUpstreamOrchestrationOptionTest(t *testing.T) *gorm.DB {
	t.Helper()
	previousOptions := maps.Clone(common.OptionMap)
	previousSetting, err := config.ConfigToMap(operation_setting.GetUpstreamOrchestrationSetting())
	require.NoError(t, err)

	db := useMigrationTestDB(t)
	require.NoError(t, db.AutoMigrate(&Option{}))

	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		common.OptionMap = previousOptions
		common.OptionMapRWMutex.Unlock()
		updated, restoreErr := config.GlobalConfig.UpdateFromMap(
			"upstream_orchestration",
			previousSetting,
		)
		require.NoError(t, restoreErr)
		require.True(t, updated)
	})
	return db
}

func seedUpstreamOrchestrationOptions(t *testing.T, db *gorm.DB, values map[string]string) {
	t.Helper()
	rows := make([]Option, 0, len(values))
	for key, value := range values {
		rows = append(rows, Option{Key: key, Value: value})
	}
	require.NoError(t, db.Create(&rows).Error)
}

func setStaleUpstreamOrchestrationRuntime(t *testing.T) {
	t.Helper()
	stale := map[string]string{
		"target_groups":             `["runtime-stale"]`,
		"static_egress_ips":         `{"leyi":["192.0.2.99"]}`,
		"model_aliases":             `{"runtime":"stale"}`,
		"model_exclusions":          `{"leyi:stale":["runtime-stale"]}`,
		"protocol_model_exclusions": `{"openai":["runtime-stale"]}`,
	}
	updated, err := config.GlobalConfig.UpdateFromMap("upstream_orchestration", stale)
	require.NoError(t, err)
	require.True(t, updated)
	common.OptionMapRWMutex.Lock()
	common.OptionMap = make(map[string]string, len(stale))
	for key, value := range stale {
		common.OptionMap["upstream_orchestration."+key] = value
	}
	common.OptionMapRWMutex.Unlock()
}

func readUpstreamOrchestrationOptions(t *testing.T, db *gorm.DB) map[string]string {
	t.Helper()
	var rows []Option
	require.NoError(t, db.Where(clause.Like{
		Column: clause.Column{Name: "key"},
		Value:  "upstream_orchestration.%",
	}).Find(&rows).Error)
	values := make(map[string]string, len(rows))
	for _, row := range rows {
		if isUpstreamOrchestrationInternalOption(row.Key) {
			continue
		}
		values[row.Key] = row.Value
	}
	return values
}

func synchronizeIndependentPolicyCreates(t *testing.T, db *gorm.DB) {
	t.Helper()
	if db.Dialector.Name() == "sqlite" {
		return
	}
	var arrivals atomic.Int32
	bothReady := make(chan struct{})
	const callbackName = "test:missing_upstream_policy_rows_create"
	require.NoError(t, db.Callback().Create().Before("gorm:create").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Table != "options" {
			return
		}
		option, creatingOption := tx.Statement.Dest.(*Option)
		if !creatingOption ||
			!IsUpstreamOrchestrationPolicyOption(option.Key) &&
				!isUpstreamOrchestrationInternalOption(option.Key) {
			return
		}
		arrival := arrivals.Add(1)
		if arrival > 2 {
			return
		}
		if arrival == 2 {
			close(bothReady)
		}
		<-bothReady
	}))
	t.Cleanup(func() {
		require.NoError(t, db.Callback().Create().Remove(callbackName))
	})
}
