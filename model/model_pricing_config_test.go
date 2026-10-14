package model

import (
	"errors"
	"fmt"
	"maps"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"gorm.io/gorm/utils/tests"
)

func modelPricingSQLiteDSN(path string) string {
	return "file:" + path + "?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)&_txlock=immediate"
}

type blockingBillingExpression struct {
	value   string
	started chan<- struct{}
	release <-chan struct{}
}

func (expression blockingBillingExpression) MarshalJSON() ([]byte, error) {
	close(expression.started)
	<-expression.release
	return []byte(strconv.Quote(expression.value)), nil
}

func TestPublishModelPricingOptionsDoesNotPublishBillingBeforePreEncodingCompletes(t *testing.T) {
	const (
		modelName   = "aggregate-seedream-publication"
		pluginKey   = "doubao"
		requestExpr = `tier("request", fixed(0.01)) * image_count`
		taskExpr    = `tier("task", u("image_count") * 0.01)`
	)

	useModelPricingOptionDatabase(t)
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"billing_setting.billing_mode":          fmt.Sprintf(`{%q:%q}`, modelName, billing_setting.BillingModeRatio),
		"billing_setting.billing_expr":          `{}`,
		billing_setting.PluginBillingExprOption: `{}`,
	}))

	started := make(chan struct{})
	release := make(chan struct{})
	committed := defaultPricingMaps()
	committed["billing_setting.billing_mode"][modelName] = billing_setting.BillingModeTieredExpr
	committed["billing_setting.billing_expr"][modelName] = requestExpr
	committed[billing_setting.PluginBillingExprOption][billing_setting.PluginBillingExprKey(pluginKey, modelName)] =
		blockingBillingExpression{value: taskExpr, started: started, release: release}

	published := make(chan error, 1)
	go func() {
		published <- publishModelPricingOptions(committed)
	}()

	select {
	case <-started:
	case <-time.After(5 * time.Second):
		require.FailNow(t, "timed out waiting for plugin expression publication")
	}
	decision := billing_setting.ResolveTaskBillingDecision(pluginKey, modelName, modelName)
	close(release)
	require.NoError(t, <-published)

	assert.Equal(t, billing_setting.BillingDecision{Mode: billing_setting.BillingModeRatio}, decision)
	finalDecision := billing_setting.ResolveTaskBillingDecision(pluginKey, modelName, modelName)
	assert.Equal(t, billing_setting.BillingDecision{
		Mode: billing_setting.BillingModeTieredExpr, Expression: taskExpr, ExpressionExists: true,
	}, finalDecision)
}

func TestResolvePricingBillingDecisionUsesOneAliasFallbackDecision(t *testing.T) {
	const (
		alias      = "aggregate-seedream-alias"
		mapped     = "aggregate-seedream-target"
		aliasExpr  = `tier("alias", u("image_count") * 0.01)`
		mappedExpr = `tier("mapped", u("image_count") * 0.02)`
	)

	previousConfig := config.GlobalConfig.ExportAllConfigs()
	previousAliases := taskAliasViewPtr.Load()
	generation := jsplugin.DefaultRegistry.Generation()
	aliases := newTaskAliasView(generation)
	aliases.byFold[jsplugin.ASCIIFold(alias)] = TaskAliasTarget{
		Alias: alias, Declared: mapped, PluginKey: "doubao",
	}
	taskAliasViewPtr.Store(aliases)
	t.Cleanup(func() {
		taskAliasViewPtr.Store(previousAliases)
		require.NoError(t, config.GlobalConfig.LoadFromDB(previousConfig))
	})

	for _, test := range []struct {
		name        string
		modes       string
		expressions string
		expected    billing_setting.BillingDecision
	}{
		{
			name: "alias expression precedes mapped expression",
			modes: fmt.Sprintf(`{%q:%q,%q:%q}`,
				alias, billing_setting.BillingModeTieredExpr,
				mapped, billing_setting.BillingModeTieredExpr),
			expressions: fmt.Sprintf(`{%q:%q,%q:%q}`, alias, aliasExpr, mapped, mappedExpr),
			expected: billing_setting.BillingDecision{
				Mode: billing_setting.BillingModeTieredExpr, Expression: aliasExpr, ExpressionExists: true,
			},
		},
		{
			name: "mapped expression is the alias fallback",
			modes: fmt.Sprintf(`{%q:%q,%q:%q}`,
				alias, billing_setting.BillingModeRatio,
				mapped, billing_setting.BillingModeTieredExpr),
			expressions: fmt.Sprintf(`{%q:%q}`, mapped, mappedExpr),
			expected: billing_setting.BillingDecision{
				Mode: billing_setting.BillingModeTieredExpr, Expression: mappedExpr, ExpressionExists: true,
			},
		},
		{
			name: "missing alias expression fails closed before mapped fallback",
			modes: fmt.Sprintf(`{%q:%q,%q:%q}`,
				alias, billing_setting.BillingModeTieredExpr,
				mapped, billing_setting.BillingModeTieredExpr),
			expressions: fmt.Sprintf(`{%q:%q}`, mapped, mappedExpr),
			expected: billing_setting.BillingDecision{
				Mode: billing_setting.BillingModeTieredExpr,
			},
		},
		{
			name: "ratio remains the final fallback",
			modes: fmt.Sprintf(`{%q:%q,%q:%q}`,
				alias, billing_setting.BillingModeRatio,
				mapped, billing_setting.BillingModeRatio),
			expressions: `{}`,
			expected:    billing_setting.BillingDecision{Mode: billing_setting.BillingModeRatio},
		},
	} {
		t.Run(test.name, func(t *testing.T) {
			require.NoError(t, billing_setting.UpdateBillingSettingOptions(map[string]string{
				billing_setting.BillingModeOption:       test.modes,
				billing_setting.BillingExprOption:       test.expressions,
				billing_setting.PluginBillingExprOption: `{}`,
			}))

			assert.Equal(t, test.expected, resolvePricingBillingDecision(generation, alias))
		})
	}
}

func openModelPricingInstanceDatabases(t *testing.T) (*gorm.DB, *gorm.DB) {
	t.Helper()
	path := filepath.Join(t.TempDir(), "model-pricing.sqlite")
	dsn := modelPricingSQLiteDSN(path)
	first, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	second, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, first.AutoMigrate(
		&Option{},
		&UpstreamPriceEvidence{},
		&Vendor{},
		&Model{},
		&Channel{},
		&Ability{},
	))
	for _, database := range []*gorm.DB{first, second} {
		sqlDB, err := database.DB()
		require.NoError(t, err)
		sqlDB.SetMaxOpenConns(1)
		t.Cleanup(func() { require.NoError(t, sqlDB.Close()) })
	}
	return first, second
}

func TestOpenModelPricingInstanceDatabasesUsesProductionSQLiteContract(t *testing.T) {
	assert.Equal(t,
		"file:model-pricing.sqlite?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)&_txlock=immediate",
		modelPricingSQLiteDSN("model-pricing.sqlite"),
	)

	first, second := openModelPricingInstanceDatabases(t)
	for _, database := range []*gorm.DB{first, second} {
		var busyTimeout int
		require.NoError(t, database.Raw("PRAGMA busy_timeout").Scan(&busyTimeout).Error)
		assert.Equal(t, 5000, busyTimeout)
		var journalMode string
		require.NoError(t, database.Raw("PRAGMA journal_mode").Scan(&journalMode).Error)
		assert.Equal(t, "wal", strings.ToLower(journalMode))
	}
}

func modelPricingCASEvidence(modelName, hashCharacter string) UpstreamPriceEvidence {
	return UpstreamPriceEvidence{
		Vendor:          "test",
		ModelName:       modelName,
		Currency:        "USD",
		Unit:            "per_1m_tokens",
		NormalizedPrice: `{"input_per_m":1}`,
		SourceURL:       "https://example.invalid/pricing",
		EvidenceHash:    strings.Repeat(hashCharacter, 64),
		Status:          UpstreamPriceStatusApplied,
	}
}

func TestNormalizeLegacyPricingEntriesUsesDeterministicCanonicalPrecedence(t *testing.T) {
	const canonical = "gpt-4-gizmo-*"

	t.Run("explicit canonical wins over conflicting aliases", func(t *testing.T) {
		entries := map[string]any{
			canonical:           float64(15),
			"gpt-4-gizmo-alpha": float64(1),
			"gpt-4-gizmo-beta":  float64(2),
		}
		for range 256 {
			normalized, err := normalizeLegacyPricingEntries("ModelRatio", entries)
			require.NoError(t, err)
			assert.Equal(t, map[string]any{canonical: float64(15)}, normalized)
		}
	})

	t.Run("conflicting aliases without canonical are rejected", func(t *testing.T) {
		for range 256 {
			_, err := normalizeLegacyPricingEntries("ModelRatio", map[string]any{
				"gpt-4-gizmo-alpha": float64(1),
				"gpt-4-gizmo-beta":  float64(2),
			})
			require.ErrorContains(t, err, "conflicting aliases for "+canonical)
		}
	})
}

func TestReadModelPricingMapsQuotesKeyBeforeForUpdate(t *testing.T) {
	database, err := gorm.Open(tests.DummyDialector{}, &gorm.Config{DryRun: true})
	require.NoError(t, err)

	previousMain, previousLog := common.MainDatabaseType(), common.LogDatabaseType()
	common.SetDatabaseTypes(common.DatabaseTypeMySQL, previousLog)
	t.Cleanup(func() {
		common.SetDatabaseTypes(previousMain, previousLog)
	})

	var query string
	require.NoError(t, database.Callback().Query().After("gorm:query").Register("capture_pricing_options_query", func(tx *gorm.DB) {
		if _, ok := tx.Statement.Dest.(*[]Option); ok {
			query = tx.Statement.SQL.String()
		}
	}))

	_, _, _, err = readModelPricingMaps(lockForUpdate(database))
	require.NoError(t, err)
	require.NotEmpty(t, query)
	assert.Contains(t, query, "ORDER BY `key` FOR UPDATE")
	assert.NotRegexp(t, `(?i)ORDER BY[[:space:]]+key([[:space:],]|$)`, query)
}

func TestMutateModelPricingOptionsLocksPricingRowsWithoutQueryingAliases(t *testing.T) {
	database := useModelPricingOptionDatabase(t)
	previousMain, previousLog := common.MainDatabaseType(), common.LogDatabaseType()
	common.SetDatabaseTypes(common.DatabaseTypeMySQL, previousLog)
	t.Cleanup(func() {
		common.SetDatabaseTypes(previousMain, previousLog)
	})

	type observation struct {
		locked, orderedByKey bool
	}
	var observations []observation
	var events []string
	var channelQueries, channelsBeforeMutation int
	require.NoError(t, database.Callback().Query().Before("gorm:query").Register("observe_pricing_lock_order", func(tx *gorm.DB) {
		switch tx.Statement.Dest.(type) {
		case *[]Option:
			_, locked := tx.Statement.Clauses["FOR"]
			orderClause, ordered := tx.Statement.Clauses["ORDER BY"]
			orderBy, validOrder := orderClause.Expression.(clause.OrderBy)
			orderedByKey := ordered && validOrder && len(orderBy.Columns) == 1 &&
				orderBy.Columns[0].Column.Name == "key" && !orderBy.Columns[0].Desc
			observations = append(observations, observation{locked: locked, orderedByKey: orderedByKey})
			events = append(events, "pricing")
		case *[]Channel:
			channelQueries++
			events = append(events, "channels")
		}
		// SQLite cannot execute FOR UPDATE; inspection above proves what the
		// MySQL/PostgreSQL query builder received before local execution.
		delete(tx.Statement.Clauses, "FOR")
	}))

	err := mutateModelPricingOptions(func(_ *gorm.DB, _ map[string]map[string]any) error {
		channelsBeforeMutation = channelQueries
		events = append(events, "mutation")
		return nil
	})
	require.NoError(t, err)
	require.Equal(t, []string{"pricing", "mutation"}, events)
	require.Equal(t, []observation{{locked: true, orderedByKey: true}}, observations)
	assert.Zero(t, channelsBeforeMutation)
	assert.Zero(t, channelQueries)
}

type modelPricingCASResult struct {
	database  *gorm.DB
	errors    [2]error
	anchors   [2]string
	casMisses int64
}

func runModelPricingCASCollision(t *testing.T, modelNames [2]string, ratios [2]float64, withEvidence bool) modelPricingCASResult {
	t.Helper()
	first, second := openModelPricingInstanceDatabases(t)
	emptyVersion := ModelPricingVersion(PricingValues{})
	instances := [2]*gorm.DB{first, second}
	type anchorRead struct {
		index int
		value string
	}
	type workerResult struct {
		index int
		err   error
	}
	anchorReads := make(chan anchorRead, 2)
	results := make(chan workerResult, 2)
	releases := [2]chan struct{}{make(chan struct{}), make(chan struct{})}
	var casMisses atomic.Int64

	for index, instance := range instances {
		var firstAnchorRead atomic.Bool
		callbackSuffix := strconv.Itoa(index)
		require.NoError(t, instance.Callback().Query().After("gorm:query").Register("coordinate_pricing_anchor_"+callbackSuffix, func(tx *gorm.DB) {
			anchor, isOption := tx.Statement.Dest.(*Option)
			if !isOption || tx.Error != nil || !firstAnchorRead.CompareAndSwap(false, true) {
				return
			}
			anchorReads <- anchorRead{index: index, value: anchor.Value}
			select {
			case <-releases[index]:
			case <-time.After(5 * time.Second):
				tx.AddError(errors.New("timed out waiting to release model pricing revision read"))
			}
		}))
		require.NoError(t, instance.Callback().Update().After("gorm:update").Register("observe_pricing_cas_miss_"+callbackSuffix, func(tx *gorm.DB) {
			if tx.Error != nil || tx.RowsAffected != 0 {
				return
			}
			for _, variable := range tx.Statement.Vars {
				if key, ok := variable.(string); ok && key == modelPricingRevisionOptionKey {
					casMisses.Add(1)
					return
				}
			}
		}))
	}

	for index, instance := range instances {
		go func(index int, instance *gorm.DB) {
			var afterPricing func(*gorm.DB) error
			if withEvidence {
				evidence := modelPricingCASEvidence(modelNames[index], string(rune('a'+index)))
				afterPricing = func(tx *gorm.DB) error {
					return tx.Create(&evidence).Error
				}
			}
			_, err := updateModelPricingDatabase(instance, []ModelPricingChange{{
				ModelName:       modelNames[index],
				ExpectedVersion: emptyVersion,
				Pricing:         PricingValues{"ModelRatio": ratios[index]},
			}}, afterPricing)
			results <- workerResult{index: index, err: err}
		}(index, instance)
	}

	collision := modelPricingCASResult{database: first}
	for range 2 {
		select {
		case read := <-anchorReads:
			collision.anchors[read.index] = read.value
		case <-time.After(5 * time.Second):
			require.FailNow(t, "timed out waiting for model pricing revision reads")
		}
	}
	close(releases[0])
	select {
	case result := <-results:
		require.Equal(t, 0, result.index)
		collision.errors[result.index] = result.err
	case <-time.After(5 * time.Second):
		require.FailNow(t, "timed out waiting for first model pricing writer")
	}
	close(releases[1])
	select {
	case result := <-results:
		require.Equal(t, 1, result.index)
		collision.errors[result.index] = result.err
	case <-time.After(5 * time.Second):
		require.FailNow(t, "timed out waiting for second model pricing writer")
	}
	collision.casMisses = casMisses.Load()
	return collision
}

func TestUpdateModelPricingDatabaseUsesDurableCrossInstanceCAS(t *testing.T) {
	t.Run("same model stale version commits once with evidence", func(t *testing.T) {
		const modelName = "cross-instance-model"
		collision := runModelPricingCASCollision(t,
			[2]string{modelName, modelName},
			[2]float64{1, 2},
			true,
		)
		require.Equal(t, [2]string{"0", "0"}, collision.anchors)
		require.NoError(t, collision.errors[0])
		require.ErrorIs(t, collision.errors[1], ErrModelPricingConflict)
		assert.Equal(t, int64(1), collision.casMisses)

		var evidenceCount int64
		require.NoError(t, collision.database.Model(&UpstreamPriceEvidence{}).Where("model_name = ?", modelName).Count(&evidenceCount).Error)
		assert.Equal(t, int64(1), evidenceCount)
		var revision Option
		require.NoError(t, collision.database.Where("key = ?", modelPricingRevisionOptionKey).First(&revision).Error)
		assert.Equal(t, "1", revision.Value)
		var option Option
		require.NoError(t, collision.database.Where("key = ?", "ModelRatio").First(&option).Error)
		var storedRatios map[string]float64
		require.NoError(t, common.UnmarshalJsonStr(option.Value, &storedRatios))
		assert.Equal(t, float64(1), storedRatios[modelName])
	})

	t.Run("unrelated models both survive a CAS retry", func(t *testing.T) {
		collision := runModelPricingCASCollision(t,
			[2]string{"unrelated-a", "unrelated-b"},
			[2]float64{3, 4},
			false,
		)
		require.Equal(t, [2]string{"0", "0"}, collision.anchors)
		require.NoError(t, collision.errors[0])
		require.NoError(t, collision.errors[1])
		assert.Equal(t, int64(1), collision.casMisses)

		var revision Option
		require.NoError(t, collision.database.Where("key = ?", modelPricingRevisionOptionKey).First(&revision).Error)
		assert.Equal(t, "2", revision.Value)
		var option Option
		require.NoError(t, collision.database.Where("key = ?", "ModelRatio").First(&option).Error)
		var storedRatios map[string]float64
		require.NoError(t, common.UnmarshalJsonStr(option.Value, &storedRatios))
		assert.Equal(t, float64(3), storedRatios["unrelated-a"])
		assert.Equal(t, float64(4), storedRatios["unrelated-b"])
	})
}

func useModelPricingOptionDatabases(t *testing.T) (*gorm.DB, *gorm.DB) {
	t.Helper()
	first, second := openModelPricingInstanceDatabases(t)
	previousDB := DB
	previousConfig := config.GlobalConfig.ExportAllConfigs()
	previousAliasView := taskAliasViewPtr.Load()
	restoreRatios := []struct {
		value   string
		restore func(string) error
	}{
		{ratio_setting.ModelPrice2JSONString(), ratio_setting.UpdateModelPriceByJSONString},
		{ratio_setting.ModelRatio2JSONString(), ratio_setting.UpdateModelRatioByJSONString},
		{ratio_setting.CompletionRatio2JSONString(), ratio_setting.UpdateCompletionRatioByJSONString},
		{ratio_setting.CacheRatio2JSONString(), ratio_setting.UpdateCacheRatioByJSONString},
		{ratio_setting.CreateCacheRatio2JSONString(), ratio_setting.UpdateCreateCacheRatioByJSONString},
		{ratio_setting.ImageRatio2JSONString(), ratio_setting.UpdateImageRatioByJSONString},
		{ratio_setting.AudioRatio2JSONString(), ratio_setting.UpdateAudioRatioByJSONString},
		{ratio_setting.AudioCompletionRatio2JSONString(), ratio_setting.UpdateAudioCompletionRatioByJSONString},
	}
	DB = first
	common.OptionMapRWMutex.Lock()
	previousOptions := common.OptionMap
	common.OptionMap = make(map[string]string)
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		for _, ratio := range restoreRatios {
			require.NoError(t, ratio.restore(ratio.value))
		}
		require.NoError(t, config.GlobalConfig.LoadFromDB(previousConfig))
		taskAliasViewPtr.Store(previousAliasView)
		common.OptionMapRWMutex.Lock()
		common.OptionMap = previousOptions
		common.OptionMapRWMutex.Unlock()
		DB = previousDB
	})
	return first, second
}

func useModelPricingOptionDatabase(t *testing.T) *gorm.DB {
	t.Helper()
	first, _ := useModelPricingOptionDatabases(t)
	return first
}

func TestModelPricingRevisionIsInternalOnly(t *testing.T) {
	for _, test := range []struct {
		name, key string
		bulk      bool
	}{
		{"single exact", modelPricingRevisionOptionKey, false},
		{"single case folded", strings.ToUpper(modelPricingRevisionOptionKey), false},
		{"bulk exact", modelPricingRevisionOptionKey, true},
		{"bulk case folded", strings.ToUpper(modelPricingRevisionOptionKey), true},
	} {
		t.Run(test.name, func(t *testing.T) {
			database := useModelPricingOptionDatabase(t)
			require.NoError(t, database.Create(&Option{Key: modelPricingRevisionOptionKey, Value: "7"}).Error)
			require.NoError(t, database.Create(&Option{Key: "public-option", Value: "before"}).Error)

			var err error
			if test.bulk {
				err = UpdateOptionsBulk(map[string]string{test.key: "9", "public-option": "after"})
			} else {
				err = UpdateOption(test.key, "9")
			}
			require.ErrorContains(t, err, "protected option")

			var revision Option
			require.NoError(t, database.Where("key = ?", modelPricingRevisionOptionKey).First(&revision).Error)
			assert.Equal(t, "7", revision.Value)
			var foldedCount int64
			require.NoError(t, database.Model(&Option{}).Where("key = ?", strings.ToUpper(modelPricingRevisionOptionKey)).Count(&foldedCount).Error)
			assert.Zero(t, foldedCount)
			var public Option
			require.NoError(t, database.Where("key = ?", "public-option").First(&public).Error)
			assert.Equal(t, "before", public.Value)
		})
	}

	t.Run("database loading and generic listing hide revision rows", func(t *testing.T) {
		database := useModelPricingOptionDatabase(t)
		require.NoError(t, database.Create(&[]Option{
			{Key: modelPricingRevisionOptionKey, Value: "7"},
			{Key: strings.ToUpper(modelPricingRevisionOptionKey), Value: "stale"},
			{Key: "public-option", Value: "visible"},
		}).Error)

		options, err := AllOption()
		require.NoError(t, err)
		keys := make([]string, 0, len(options))
		for _, option := range options {
			keys = append(keys, option.Key)
		}
		assert.Equal(t, []string{"public-option"}, keys)

		loadOptionsFromDatabase()
		common.OptionMapRWMutex.RLock()
		loaded := maps.Clone(common.OptionMap)
		common.OptionMapRWMutex.RUnlock()
		assert.Equal(t, "visible", loaded["public-option"])
		assert.NotContains(t, loaded, modelPricingRevisionOptionKey)
		assert.NotContains(t, loaded, strings.ToUpper(modelPricingRevisionOptionKey))

		_, err = mutateModelPricingOptionsDatabase(database, func(_ *gorm.DB, _ map[string]map[string]any) error {
			return nil
		})
		require.NoError(t, err)
		var revision Option
		require.NoError(t, database.Where("key = ?", modelPricingRevisionOptionKey).First(&revision).Error)
		assert.Equal(t, "8", revision.Value)
	})
}

func TestValidateModelPricingRequiresUsableMainExpressionWithPluginVariants(t *testing.T) {
	const modelName = "main-expression-source-of-truth"
	for _, spec := range []struct {
		key, field, unit string
	}{
		{"main-expression-alpha", "seconds", "second"},
		{"main-expression-beta", "credits", "credit"},
	} {
		source := fmt.Sprintf(`
export const meta = {
  apiVersion: 1, key: %q, name: %q, version: "1.0.0", author: {name: "Test"},
  models: [%q], fetchMode: "per_task",
  usageSchema: {%s: {type: "number", unit: %q}}
};
export function buildSubmitRequest() { return {}; }
export function parseSubmitResponse() { return {}; }
export function buildQueryRequest() { return {}; }
export function parseTaskResult() { return {}; }
`, spec.key, spec.key, modelName, spec.field, spec.unit)
		_, err := jsplugin.DefaultRegistry.Register(source, jsplugin.Options{})
		require.NoError(t, err)
		t.Cleanup(func() { jsplugin.DefaultRegistry.Unregister(spec.key) })
	}
	variants := map[string]any{
		"main-expression-alpha": `tier("alpha", u("seconds") * 1)`,
		"main-expression-beta":  `tier("beta", u("credits") * 1)`,
	}
	for _, test := range []struct {
		name, expression string
	}{
		{"empty", ""},
		{"undeclared usage key", `tier("main", u("undeclared") * 1)`},
	} {
		t.Run(test.name, func(t *testing.T) {
			err := ValidateModelPricing(modelName, PricingValues{
				"billing_setting.billing_mode":          billing_setting.BillingModeTieredExpr,
				"billing_setting.billing_expr":          test.expression,
				billing_setting.PluginBillingExprOption: variants,
			})
			require.Error(t, err)
		})
	}
}

func TestValidateModelPricingRejectsUnusableUnchangedMainExpressionAfterProviderChanges(t *testing.T) {
	const (
		modelName  = "main-expression-provider-change"
		expression = `tier("main", u("seconds") * 1)`
	)
	previous := PricingValues{
		"billing_setting.billing_mode": billing_setting.BillingModeTieredExpr,
		"billing_setting.billing_expr": expression,
	}

	t.Run("all providers disappear", func(t *testing.T) {
		err := validateModelPricing(modelName, previous, previous, nil, nil, newTaskAliasView(jsplugin.DefaultRegistry.Generation()))
		require.ErrorContains(t, err, "no task plugin usage schema")
	})

	t.Run("provider returns with incompatible schema", func(t *testing.T) {
		const pluginKey = "main-return-provider"
		source := fmt.Sprintf(`
export const meta = {
  apiVersion: 1, key: %q, name: %q, version: "1.0.0", author: {name: "Test"},
  models: [%q], fetchMode: "per_task",
  usageSchema: {credits: {type: "number", unit: "credit"}}
};
export function buildSubmitRequest() { return {}; }
export function parseSubmitResponse() { return {}; }
export function buildQueryRequest() { return {}; }
export function parseTaskResult() { return {}; }
`, pluginKey, pluginKey, modelName)
		_, err := jsplugin.DefaultRegistry.Register(source, jsplugin.Options{})
		require.NoError(t, err)
		t.Cleanup(func() { jsplugin.DefaultRegistry.Unregister(pluginKey) })

		err = validateModelPricing(modelName, previous, previous, nil, nil, newTaskAliasView(jsplugin.DefaultRegistry.Generation()))
		require.ErrorContains(t, err, `usage key "seconds" is not declared`)
	})
}

func TestGetModelPricingSnapshotUsesRuntimeAliasExpressionPrecedence(t *testing.T) {
	database := useModelPricingOptionDatabase(t)
	previousAliasView := taskAliasViewPtr.Load()
	t.Cleanup(func() { taskAliasViewPtr.Store(previousAliasView) })

	const (
		alias              = "snapshot-runtime-alias"
		mainTarget         = "snapshot-main-target"
		overrideTarget     = "snapshot-override-target"
		pluginKey          = "snapshot-runtime-plugin"
		targetMainExpr     = `tier("target-main", u("seconds") * 1)`
		targetFallbackExpr = `tier("target-fallback", u("seconds") * 2)`
		targetProviderExpr = `tier("target-provider", u("seconds") * 3)`
		aliasMainExpr      = `tier("alias-main", u("seconds") * 4)`
		aliasProviderExpr  = `tier("alias-provider", u("seconds") * 5)`
	)
	source := fmt.Sprintf(`
export const meta = {
  apiVersion: 1, key: %q, name: %q, version: "1.0.0", author: {name: "Test"},
  models: [%q, %q], fetchMode: "per_task",
  usageSchema: {seconds: {type: "number", unit: "second"}}
};
export function buildSubmitRequest() { return {}; }
export function parseSubmitResponse() { return {}; }
export function buildQueryRequest() { return {}; }
export function parseTaskResult() { return {}; }
`, pluginKey, pluginKey, mainTarget, overrideTarget)
	_, err := jsplugin.DefaultRegistry.Register(source, jsplugin.Options{})
	require.NoError(t, err)
	t.Cleanup(func() { jsplugin.DefaultRegistry.Unregister(pluginKey) })

	writeOption := func(key string, entries map[string]string) {
		t.Helper()
		encoded, marshalErr := common.Marshal(entries)
		require.NoError(t, marshalErr)
		require.NoError(t, database.Create(&Option{Key: key, Value: string(encoded)}).Error)
	}
	writeOption("billing_setting.billing_mode", map[string]string{
		mainTarget:     billing_setting.BillingModeTieredExpr,
		overrideTarget: billing_setting.BillingModeTieredExpr,
	})
	writeOption("billing_setting.billing_expr", map[string]string{
		mainTarget:     targetMainExpr,
		overrideTarget: targetFallbackExpr,
	})
	writeOption(billing_setting.PluginBillingExprOption, map[string]string{
		billing_setting.PluginBillingExprKey(pluginKey, overrideTarget): targetProviderExpr,
	})

	mapping := fmt.Sprintf(`{%q:%q}`, alias, mainTarget)
	channel := Channel{
		Status: common.ChannelStatusEnabled, Name: "snapshot runtime alias",
		Models: alias, ModelMapping: &mapping,
	}
	require.NoError(t, database.Create(&channel).Error)
	rebuildTaskAliasView()

	snapshot, err := GetModelPricingSnapshot([]string{alias})
	require.NoError(t, err)
	require.Len(t, snapshot.Entries, 1)
	require.Len(t, snapshot.Entries[0].PluginVariants, 1)
	assert.Empty(t, snapshot.Entries[0].Configured)
	assert.Equal(t, snapshot.EmptyVersion, snapshot.Entries[0].Version)
	assert.Equal(t, targetMainExpr, snapshot.Entries[0].PluginVariants[0].Effective)

	remapped := fmt.Sprintf(`{%q:%q}`, alias, overrideTarget)
	require.NoError(t, database.Model(&Channel{}).Where("id = ?", channel.Id).Update("model_mapping", remapped).Error)
	rebuildTaskAliasView()
	snapshot, err = GetModelPricingSnapshot([]string{alias})
	require.NoError(t, err)
	require.Len(t, snapshot.Entries[0].PluginVariants, 1)
	assert.Empty(t, snapshot.Entries[0].Configured)
	assert.Equal(t, snapshot.EmptyVersion, snapshot.Entries[0].Version)
	assert.Equal(t, targetProviderExpr, snapshot.Entries[0].PluginVariants[0].Effective)

	require.NoError(t, database.Model(&Option{}).
		Where("key = ?", "billing_setting.billing_mode").
		Update("value", fmt.Sprintf(`{%q:%q,%q:%q,%q:%q}`,
			mainTarget, billing_setting.BillingModeTieredExpr,
			overrideTarget, billing_setting.BillingModeTieredExpr,
			alias, billing_setting.BillingModeTieredExpr)).Error)
	require.NoError(t, database.Model(&Option{}).
		Where("key = ?", "billing_setting.billing_expr").
		Update("value", fmt.Sprintf(`{%q:%q,%q:%q,%q:%q}`, mainTarget, targetMainExpr, overrideTarget, targetFallbackExpr, alias, aliasMainExpr)).Error)
	require.NoError(t, database.Model(&Channel{}).Where("id = ?", channel.Id).Update("model_mapping", mapping).Error)
	rebuildTaskAliasView()
	snapshot, err = GetModelPricingSnapshot([]string{alias})
	require.NoError(t, err)
	require.Len(t, snapshot.Entries[0].PluginVariants, 1)
	assert.Equal(t, aliasMainExpr, snapshot.Entries[0].PluginVariants[0].Effective)

	require.NoError(t, database.Model(&Option{}).
		Where("key = ?", billing_setting.PluginBillingExprOption).
		Update("value", fmt.Sprintf(`{%q:%q,%q:%q}`,
			billing_setting.PluginBillingExprKey(pluginKey, overrideTarget), targetProviderExpr,
			billing_setting.PluginBillingExprKey(pluginKey, alias), aliasProviderExpr)).Error)
	require.NoError(t, database.Model(&Channel{}).Where("id = ?", channel.Id).Update("model_mapping", remapped).Error)
	rebuildTaskAliasView()
	snapshot, err = GetModelPricingSnapshot([]string{alias})
	require.NoError(t, err)
	require.Len(t, snapshot.Entries[0].PluginVariants, 1)
	assert.Equal(t, aliasProviderExpr, snapshot.Entries[0].PluginVariants[0].Effective)
}

type sharedAliasPricingFixture struct {
	database                *gorm.DB
	alias, target           string
	alphaPlugin, betaPlugin string
}

func setupSharedAliasPricing(t *testing.T, suffix string) sharedAliasPricingFixture {
	t.Helper()
	database := useModelPricingOptionDatabase(t)
	fixture := sharedAliasPricingFixture{
		database:    database,
		alias:       "r4-shared-alias-" + suffix,
		target:      "r4-shared-target-" + suffix,
		alphaPlugin: "r4-alpha-" + suffix,
		betaPlugin:  "r4-beta-" + suffix,
	}
	for _, spec := range []struct {
		key, field, unit string
	}{
		{fixture.alphaPlugin, "seconds", "second"},
		{fixture.betaPlugin, "credits", "credit"},
	} {
		source := fmt.Sprintf(`
export const meta = {
  apiVersion: 1, key: %q, name: %q, version: "1.0.0", author: {name: "Test"},
  models: [%q], fetchMode: "per_task",
  usageSchema: {%s: {type: "number", unit: %q}}
};
export function buildSubmitRequest() { return {}; }
export function parseSubmitResponse() { return {}; }
export function buildQueryRequest() { return {}; }
export function parseTaskResult() { return {}; }
`, spec.key, spec.key, fixture.target, spec.field, spec.unit)
		_, err := jsplugin.DefaultRegistry.Register(source, jsplugin.Options{})
		require.NoError(t, err)
		t.Cleanup(func() { jsplugin.DefaultRegistry.Unregister(spec.key) })
	}
	mapping := fmt.Sprintf(`{%q:%q}`, fixture.alias, fixture.target)
	setting := fmt.Sprintf(`{"task_plugin_key":%q}`, fixture.betaPlugin)
	require.NoError(t, database.Create(&Channel{
		Type: constant.ChannelTypeTaskPlugin, Status: common.ChannelStatusEnabled,
		Name: "R4 shared alias " + suffix, Models: fixture.alias, Group: "default",
		ModelMapping: &mapping, Setting: &setting,
	}).Error)
	rebuildTaskAliasView()
	return fixture
}

func seedSharedAliasCandidatePricing(t *testing.T, fixture sharedAliasPricingFixture, aliasMain, targetMain string, targetVariants map[string]string) {
	t.Helper()
	pluginExpressions := make(map[string]string, len(targetVariants))
	for plugin, expression := range targetVariants {
		pluginExpressions[billing_setting.PluginBillingExprKey(plugin, fixture.target)] = expression
	}
	modes := map[string]string{fixture.target: billing_setting.BillingModeTieredExpr}
	expressions := map[string]string{fixture.target: targetMain}
	if aliasMain != "" {
		modes[fixture.alias] = billing_setting.BillingModeTieredExpr
		expressions[fixture.alias] = aliasMain
	}
	for key, entries := range map[string]map[string]string{
		"billing_setting.billing_mode":          modes,
		"billing_setting.billing_expr":          expressions,
		billing_setting.PluginBillingExprOption: pluginExpressions,
	} {
		raw, err := common.Marshal(entries)
		require.NoError(t, err)
		require.NoError(t, fixture.database.Create(&Option{Key: key, Value: string(raw)}).Error)
	}
}

func sharedAliasCandidateEntries(t *testing.T, fixture sharedAliasPricingFixture) map[string]ModelPricingEntry {
	t.Helper()
	snapshot, err := GetModelPricingSnapshot([]string{fixture.alias, fixture.target})
	require.NoError(t, err)
	require.Len(t, snapshot.Entries, 2)
	entries := make(map[string]ModelPricingEntry, len(snapshot.Entries))
	for _, entry := range snapshot.Entries {
		entries[entry.ModelName] = entry
	}
	return entries
}

func requireSharedAliasCandidateRejectionIsAtomic(t *testing.T, fixture sharedAliasPricingFixture, changes []ModelPricingChange) error {
	t.Helper()
	baselineEvidence := modelPricingCASEvidence("existing-candidate-evidence", "a")
	require.NoError(t, fixture.database.Create(&baselineEvidence).Error)
	var beforeOptions []Option
	require.NoError(t, fixture.database.Order("key").Find(&beforeOptions).Error)

	err := UpdateModelPricingWithEvidence(changes, []UpstreamPriceEvidence{
		modelPricingCASEvidence("rejected-candidate-evidence", "b"),
	})
	require.Error(t, err)

	var afterOptions []Option
	require.NoError(t, fixture.database.Order("key").Find(&afterOptions).Error)
	assert.Equal(t, beforeOptions, afterOptions)
	var revision Option
	require.NoError(t, fixture.database.Where("key = ?", modelPricingRevisionOptionKey).First(&revision).Error)
	assert.Equal(t, "7", revision.Value)
	var evidence []UpstreamPriceEvidence
	require.NoError(t, fixture.database.Order("id").Find(&evidence).Error)
	require.Len(t, evidence, 1)
	assert.Equal(t, baselineEvidence.EvidenceHash, evidence[0].EvidenceHash)
	return err
}

func TestUpdateModelPricingPreservesDependentAliasRatioFallback(t *testing.T) {
	const secondsExpr = `tier("seconds", u("seconds") * 1)`

	t.Run("accepts target-only ratio update", func(t *testing.T) {
		fixture := setupSharedAliasPricing(t, "ratio-target")
		initial := sharedAliasCandidateEntries(t, fixture)

		require.NoError(t, UpdateModelPricing([]ModelPricingChange{{
			ModelName:       fixture.target,
			ExpectedVersion: initial[fixture.target].Version,
			Pricing:         PricingValues{"ModelRatio": float64(2)},
		}}))

		saved := sharedAliasCandidateEntries(t, fixture)
		assert.Equal(t, float64(2), saved[fixture.target].Configured["ModelRatio"])
		assert.Empty(t, saved[fixture.alias].Configured)
	})

	t.Run("accepts alias-only ratio update", func(t *testing.T) {
		fixture := setupSharedAliasPricing(t, "ratio-alias")
		initial := sharedAliasCandidateEntries(t, fixture)

		require.NoError(t, UpdateModelPricing([]ModelPricingChange{{
			ModelName:       fixture.alias,
			ExpectedVersion: initial[fixture.alias].Version,
			Pricing:         PricingValues{"ModelRatio": float64(3)},
		}}))

		saved := sharedAliasCandidateEntries(t, fixture)
		assert.Equal(t, float64(3), saved[fixture.alias].Configured["ModelRatio"])
		assert.Empty(t, saved[fixture.target].Configured)
	})

	t.Run("accepts mixed-provider shared target ratio update", func(t *testing.T) {
		fixture := setupSharedAliasPricing(t, "ratio-shared")
		ratios, err := common.Marshal(map[string]float64{fixture.target: 1})
		require.NoError(t, err)
		require.NoError(t, fixture.database.Create(&Option{Key: "ModelRatio", Value: string(ratios)}).Error)
		initial := sharedAliasCandidateEntries(t, fixture)
		require.Len(t, initial[fixture.alias].PluginVariants, 2)

		require.NoError(t, UpdateModelPricing([]ModelPricingChange{{
			ModelName:       fixture.target,
			ExpectedVersion: initial[fixture.target].Version,
			Pricing:         PricingValues{"ModelRatio": float64(4)},
		}}))

		saved := sharedAliasCandidateEntries(t, fixture)
		assert.Equal(t, float64(4), saved[fixture.target].Configured["ModelRatio"])
		for _, variant := range saved[fixture.alias].PluginVariants {
			assert.Empty(t, variant.Effective)
			assert.False(t, variant.Compatible)
		}
	})

	t.Run("rejects transition from ratio to invalid tiered state", func(t *testing.T) {
		fixture := setupSharedAliasPricing(t, "ratio-invalid-tiered")
		ratios, err := common.Marshal(map[string]float64{fixture.target: 1})
		require.NoError(t, err)
		require.NoError(t, fixture.database.Create(&Option{Key: "ModelRatio", Value: string(ratios)}).Error)
		require.NoError(t, fixture.database.Create(&Option{Key: modelPricingRevisionOptionKey, Value: "7"}).Error)
		initial := sharedAliasCandidateEntries(t, fixture)

		err = requireSharedAliasCandidateRejectionIsAtomic(t, fixture, []ModelPricingChange{{
			ModelName:       fixture.target,
			ExpectedVersion: initial[fixture.target].Version,
			Pricing: PricingValues{
				"billing_setting.billing_mode": billing_setting.BillingModeTieredExpr,
				"billing_setting.billing_expr": secondsExpr,
			},
		}})
		assert.ErrorContains(t, err, "model "+fixture.target+": plugin "+fixture.betaPlugin)
		assert.ErrorContains(t, err, `usage key "seconds" is not declared`)
	})
}

func TestUpdateModelPricingValidatesFinalCandidateForDependentAliases(t *testing.T) {
	const (
		secondsExpr = `tier("seconds", u("seconds") * 1)`
		creditsExpr = `tier("credits", u("credits") * 1)`
	)

	t.Run("rejects target replacement with unchanged alias draft", func(t *testing.T) {
		fixture := setupSharedAliasPricing(t, "cand-reject")
		seedSharedAliasCandidatePricing(t, fixture, secondsExpr, secondsExpr, map[string]string{
			fixture.betaPlugin: creditsExpr,
		})
		require.NoError(t, fixture.database.Create(&Option{Key: modelPricingRevisionOptionKey, Value: "7"}).Error)
		initial := sharedAliasCandidateEntries(t, fixture)

		err := requireSharedAliasCandidateRejectionIsAtomic(t, fixture, []ModelPricingChange{
			{
				ModelName:       fixture.target,
				ExpectedVersion: initial[fixture.target].Version,
				Pricing: PricingValues{
					"billing_setting.billing_mode":          billing_setting.BillingModeTieredExpr,
					"billing_setting.billing_expr":          creditsExpr,
					billing_setting.PluginBillingExprOption: map[string]any{fixture.alphaPlugin: secondsExpr},
				},
			},
			{
				ModelName:       fixture.alias,
				ExpectedVersion: initial[fixture.alias].Version,
				Pricing:         maps.Clone(initial[fixture.alias].Configured),
			},
		})
		assert.ErrorContains(t, err, "model "+fixture.alias+": plugin "+fixture.betaPlugin)
		assert.ErrorContains(t, err, `usage key "seconds" is not declared`)
	})

	t.Run("accepts inverse batch that adds required target override", func(t *testing.T) {
		fixture := setupSharedAliasPricing(t, "cand-inverse")
		seedSharedAliasCandidatePricing(t, fixture, secondsExpr, creditsExpr, map[string]string{
			fixture.alphaPlugin: secondsExpr,
		})
		initial := sharedAliasCandidateEntries(t, fixture)

		require.NoError(t, UpdateModelPricing([]ModelPricingChange{
			{
				ModelName:       fixture.target,
				ExpectedVersion: initial[fixture.target].Version,
				Pricing: PricingValues{
					"billing_setting.billing_mode":          billing_setting.BillingModeTieredExpr,
					"billing_setting.billing_expr":          secondsExpr,
					billing_setting.PluginBillingExprOption: map[string]any{fixture.betaPlugin: creditsExpr},
				},
			},
			{
				ModelName:       fixture.alias,
				ExpectedVersion: initial[fixture.alias].Version,
				Pricing:         maps.Clone(initial[fixture.alias].Configured),
			},
		}))

		saved := sharedAliasCandidateEntries(t, fixture)
		require.Len(t, saved[fixture.alias].PluginVariants, 2)
		for _, variant := range saved[fixture.alias].PluginVariants {
			assert.True(t, variant.Compatible)
		}
	})

	t.Run("accepts target-only change when alias inherits target state", func(t *testing.T) {
		fixture := setupSharedAliasPricing(t, "cand-inherit")
		seedSharedAliasCandidatePricing(t, fixture, "", secondsExpr, map[string]string{
			fixture.betaPlugin: creditsExpr,
		})
		initial := sharedAliasCandidateEntries(t, fixture)
		assert.Empty(t, initial[fixture.alias].Configured)

		require.NoError(t, UpdateModelPricing([]ModelPricingChange{{
			ModelName:       fixture.target,
			ExpectedVersion: initial[fixture.target].Version,
			Pricing: PricingValues{
				"billing_setting.billing_mode":          billing_setting.BillingModeTieredExpr,
				"billing_setting.billing_expr":          creditsExpr,
				billing_setting.PluginBillingExprOption: map[string]any{fixture.alphaPlugin: secondsExpr},
			},
		}}))

		saved := sharedAliasCandidateEntries(t, fixture)
		assert.Empty(t, saved[fixture.alias].Configured)
		require.Len(t, saved[fixture.alias].PluginVariants, 2)
		for _, variant := range saved[fixture.alias].PluginVariants {
			assert.True(t, variant.Compatible)
		}
	})

	t.Run("rejects target-only change that breaks active alias", func(t *testing.T) {
		fixture := setupSharedAliasPricing(t, "cand-target")
		seedSharedAliasCandidatePricing(t, fixture, secondsExpr, secondsExpr, map[string]string{
			fixture.betaPlugin: creditsExpr,
		})
		require.NoError(t, fixture.database.Create(&Option{Key: modelPricingRevisionOptionKey, Value: "7"}).Error)
		initial := sharedAliasCandidateEntries(t, fixture)

		err := requireSharedAliasCandidateRejectionIsAtomic(t, fixture, []ModelPricingChange{{
			ModelName:       fixture.target,
			ExpectedVersion: initial[fixture.target].Version,
			Pricing: PricingValues{
				"billing_setting.billing_mode":          billing_setting.BillingModeTieredExpr,
				"billing_setting.billing_expr":          creditsExpr,
				billing_setting.PluginBillingExprOption: map[string]any{fixture.alphaPlugin: secondsExpr},
			},
		}})
		assert.ErrorContains(t, err, "model "+fixture.alias+": plugin "+fixture.betaPlugin)
		assert.ErrorContains(t, err, `usage key "seconds" is not declared`)
	})

	t.Run("valid batch is order independent", func(t *testing.T) {
		run := func(t *testing.T, reverse bool) map[string]string {
			t.Helper()
			fixture := setupSharedAliasPricing(t, "cand-order")
			seedSharedAliasCandidatePricing(t, fixture, secondsExpr, creditsExpr, map[string]string{
				fixture.alphaPlugin: secondsExpr,
			})
			initial := sharedAliasCandidateEntries(t, fixture)
			changes := []ModelPricingChange{
				{
					ModelName:       fixture.target,
					ExpectedVersion: initial[fixture.target].Version,
					Pricing: PricingValues{
						"billing_setting.billing_mode":          billing_setting.BillingModeTieredExpr,
						"billing_setting.billing_expr":          secondsExpr,
						billing_setting.PluginBillingExprOption: map[string]any{fixture.betaPlugin: creditsExpr},
					},
				},
				{
					ModelName:       fixture.alias,
					ExpectedVersion: initial[fixture.alias].Version,
					Pricing:         maps.Clone(initial[fixture.alias].Configured),
				},
			}
			if reverse {
				slices.Reverse(changes)
			}
			require.NoError(t, UpdateModelPricing(changes))

			var rows []Option
			require.NoError(t, fixture.database.Order("key").Find(&rows).Error)
			stored := make(map[string]string, len(rows))
			for _, row := range rows {
				stored[row.Key] = row.Value
			}
			return stored
		}

		var targetFirst, aliasFirst map[string]string
		t.Run("target then alias", func(t *testing.T) {
			targetFirst = run(t, false)
		})
		t.Run("alias then target", func(t *testing.T) {
			aliasFirst = run(t, true)
		})
		assert.Equal(t, targetFirst, aliasFirst)
	})
}

func TestAliasPricingUsesEveryProviderForCanonicalTarget(t *testing.T) {
	const (
		mainExpr = `tier("main", u("seconds") * 1)`
		betaExpr = `tier("beta", u("credits") * 2)`
	)

	t.Run("snapshot exposes both provider schemas", func(t *testing.T) {
		fixture := setupSharedAliasPricing(t, "snapshot")

		snapshot, err := GetModelPricingSnapshot([]string{fixture.alias})
		require.NoError(t, err)
		require.Len(t, snapshot.Entries, 1)
		require.Len(t, snapshot.Entries[0].PluginVariants, 2)
		variants := make(map[string]ModelPricingPluginVariant)
		for _, variant := range snapshot.Entries[0].PluginVariants {
			variants[variant.PluginKey] = variant
		}
		assert.Contains(t, variants[fixture.alphaPlugin].UsageSchema, "seconds")
		assert.Contains(t, variants[fixture.betaPlugin].UsageSchema, "credits")
		assert.False(t, variants[fixture.alphaPlugin].Stale)
		assert.False(t, variants[fixture.betaPlugin].Stale)
	})

	t.Run("second provider override saves", func(t *testing.T) {
		fixture := setupSharedAliasPricing(t, "save")
		initial, err := GetModelPricingSnapshot([]string{fixture.alias})
		require.NoError(t, err)
		require.Len(t, initial.Entries, 1)

		require.NoError(t, UpdateModelPricing([]ModelPricingChange{{
			ModelName:       fixture.alias,
			ExpectedVersion: initial.Entries[0].Version,
			Pricing: PricingValues{
				"billing_setting.billing_mode":          billing_setting.BillingModeTieredExpr,
				"billing_setting.billing_expr":          mainExpr,
				billing_setting.PluginBillingExprOption: map[string]any{fixture.betaPlugin: betaExpr},
			},
		}}))
		saved, err := GetModelPricingSnapshot([]string{fixture.alias})
		require.NoError(t, err)
		variants := make(map[string]ModelPricingPluginVariant)
		for _, variant := range saved.Entries[0].PluginVariants {
			variants[variant.PluginKey] = variant
		}
		assert.Equal(t, betaExpr, variants[fixture.betaPlugin].Configured)
		assert.False(t, variants[fixture.betaPlugin].Stale)
	})

	t.Run("second provider override is not removable as stale", func(t *testing.T) {
		fixture := setupSharedAliasPricing(t, "removal")
		for _, row := range []Option{
			{Key: "billing_setting.billing_mode", Value: fmt.Sprintf(`{%q:%q}`, fixture.alias, billing_setting.BillingModeTieredExpr)},
			{Key: "billing_setting.billing_expr", Value: fmt.Sprintf(`{%q:%q}`, fixture.alias, mainExpr)},
			{Key: billing_setting.PluginBillingExprOption, Value: fmt.Sprintf(`{%q:%q}`,
				billing_setting.PluginBillingExprKey(fixture.betaPlugin, fixture.alias), betaExpr)},
		} {
			require.NoError(t, fixture.database.Create(&row).Error)
		}

		err := UpdateModelPricingOptions(map[string]string{billing_setting.PluginBillingExprOption: `{}`})
		require.ErrorContains(t, err, "plugin "+fixture.betaPlugin)
		var stored Option
		require.NoError(t, fixture.database.Where("key = ?", billing_setting.PluginBillingExprOption).First(&stored).Error)
		assert.Contains(t, stored.Value, billing_setting.PluginBillingExprKey(fixture.betaPlugin, fixture.alias))
	})

	t.Run("main fallback validates every unoverridden provider", func(t *testing.T) {
		fixture := setupSharedAliasPricing(t, "fallback")

		_, err := PreviewModelPricing(fixture.alias, PricingValues{
			"billing_setting.billing_mode": billing_setting.BillingModeTieredExpr,
			"billing_setting.billing_expr": mainExpr,
		})
		require.ErrorContains(t, err, "plugin "+fixture.betaPlugin)
	})

	t.Run("canonical target overrides cover preview providers", func(t *testing.T) {
		for _, test := range []struct {
			name, mainExpression string
			targetOverrides      func(sharedAliasPricingFixture) map[string]string
		}{
			{
				name:           "task main",
				mainExpression: mainExpr,
				targetOverrides: func(fixture sharedAliasPricingFixture) map[string]string {
					return map[string]string{
						billing_setting.PluginBillingExprKey(fixture.betaPlugin, fixture.target): betaExpr,
					}
				},
			},
			{
				name:           "request main",
				mainExpression: `tier("request", fixed(0.01))`,
				targetOverrides: func(fixture sharedAliasPricingFixture) map[string]string {
					return map[string]string{
						billing_setting.PluginBillingExprKey(fixture.alphaPlugin, fixture.target): mainExpr,
						billing_setting.PluginBillingExprKey(fixture.betaPlugin, fixture.target):  betaExpr,
					}
				},
			},
		} {
			t.Run(test.name, func(t *testing.T) {
				fixture := setupSharedAliasPricing(t, "preview-"+strings.ReplaceAll(test.name, " ", "-"))
				raw, err := common.Marshal(test.targetOverrides(fixture))
				require.NoError(t, err)
				require.NoError(t, fixture.database.Create(&Option{
					Key: billing_setting.PluginBillingExprOption, Value: string(raw),
				}).Error)

				preview, err := PreviewModelPricing(fixture.alias, PricingValues{
					"billing_setting.billing_mode": billing_setting.BillingModeTieredExpr,
					"billing_setting.billing_expr": test.mainExpression,
				})
				require.NoError(t, err)
				assert.Equal(t, test.mainExpression, preview["billing_setting.billing_expr"])
			})
		}
	})

	t.Run("canonical target override permits versioned alias update", func(t *testing.T) {
		fixture := setupSharedAliasPricing(t, "update")
		raw, err := common.Marshal(map[string]string{
			billing_setting.PluginBillingExprKey(fixture.betaPlugin, fixture.target): betaExpr,
		})
		require.NoError(t, err)
		require.NoError(t, fixture.database.Create(&Option{
			Key: billing_setting.PluginBillingExprOption, Value: string(raw),
		}).Error)
		initial, err := GetModelPricingSnapshot([]string{fixture.alias})
		require.NoError(t, err)
		require.Len(t, initial.Entries, 1)

		require.NoError(t, UpdateModelPricing([]ModelPricingChange{{
			ModelName:       fixture.alias,
			ExpectedVersion: initial.Entries[0].Version,
			Pricing: PricingValues{
				"billing_setting.billing_mode": billing_setting.BillingModeTieredExpr,
				"billing_setting.billing_expr": mainExpr,
			},
		}}))
	})

	t.Run("invalid canonical target override is rejected", func(t *testing.T) {
		fixture := setupSharedAliasPricing(t, "invalid-target")
		raw, err := common.Marshal(map[string]string{
			billing_setting.PluginBillingExprKey(fixture.alphaPlugin, fixture.target): mainExpr,
			billing_setting.PluginBillingExprKey(fixture.betaPlugin, fixture.target):  mainExpr,
		})
		require.NoError(t, err)
		require.NoError(t, fixture.database.Create(&Option{
			Key: billing_setting.PluginBillingExprOption, Value: string(raw),
		}).Error)

		_, err = PreviewModelPricing(fixture.alias, PricingValues{
			"billing_setting.billing_mode": billing_setting.BillingModeTieredExpr,
			"billing_setting.billing_expr": `tier("request", fixed(0.01))`,
		})
		require.ErrorContains(t, err, "plugin "+fixture.betaPlugin)
		require.ErrorContains(t, err, `usage key "seconds" is not declared`)
	})

	t.Run("different canonical targets remain ambiguous", func(t *testing.T) {
		database := useModelPricingOptionDatabase(t)
		const (
			alias       = "r4-ambiguous-alias"
			firstTarget = "r4-ambiguous-first"
			lastTarget  = "r4-ambiguous-last"
		)
		for index, target := range []string{firstTarget, lastTarget} {
			key := fmt.Sprintf("r4-ambiguous-%d", index)
			source := fmt.Sprintf(`
export const meta = {
  apiVersion: 1, key: %q, name: %q, version: "1.0.0", author: {name: "Test"},
  models: [%q], fetchMode: "per_task"
};
export function buildSubmitRequest() { return {}; }
export function parseSubmitResponse() { return {}; }
export function buildQueryRequest() { return {}; }
export function parseTaskResult() { return {}; }
`, key, key, target)
			_, err := jsplugin.DefaultRegistry.Register(source, jsplugin.Options{})
			require.NoError(t, err)
			t.Cleanup(func() { jsplugin.DefaultRegistry.Unregister(key) })
			mapping := fmt.Sprintf(`{%q:%q}`, alias, target)
			require.NoError(t, database.Create(&Channel{
				Status: common.ChannelStatusEnabled, Name: key, Models: alias, ModelMapping: &mapping,
			}).Error)
		}
		rebuildTaskAliasView()

		_, resolved := ResolveTaskModelAlias(jsplugin.DefaultRegistry.Generation(), alias)
		assert.False(t, resolved)
	})
}

func TestModelPricingUsesAuthoritativeAliasViews(t *testing.T) {
	registerPlugin := func(t *testing.T, key, model, usageField string) {
		t.Helper()
		source := fmt.Sprintf(`
export const meta = {
  apiVersion: 1, key: %q, name: %q, version: "1.0.0", author: {name: "Test"},
  models: [%q], fetchMode: "per_task",
  usageSchema: {%s: {type: "number", unit: "count"}}
};
export function buildSubmitRequest() { return {}; }
export function parseSubmitResponse() { return {}; }
export function buildQueryRequest() { return {}; }
export function parseTaskResult() { return {}; }
`, key, key, model, usageField)
		_, err := jsplugin.DefaultRegistry.Register(source, jsplugin.Options{})
		require.NoError(t, err)
		t.Cleanup(func() { jsplugin.DefaultRegistry.Unregister(key) })
	}

	t.Run("public save rejects alias added after cached miss", func(t *testing.T) {
		_, second := useModelPricingOptionDatabases(t)
		const (
			alias     = "authoritative-new-alias"
			target    = "authoritative-new-target"
			pluginKey = "authoritative-new-plugin"
		)
		registerPlugin(t, pluginKey, target, "seconds")
		taskAliasViewPtr.Store(nil)
		_, resolved := ResolveTaskModelAlias(jsplugin.DefaultRegistry.Generation(), alias)
		require.False(t, resolved)

		mapping := fmt.Sprintf(`{%q:%q}`, alias, target)
		require.NoError(t, second.Create(&Channel{
			Status: common.ChannelStatusEnabled, Name: "authoritative new alias",
			Models: alias, ModelMapping: &mapping,
		}).Error)
		_, resolved = ResolveTaskModelAlias(jsplugin.DefaultRegistry.Generation(), strings.ToUpper(alias))
		require.False(t, resolved, "the process cache remains stale for the regression setup")

		err := UpdateModelPricing([]ModelPricingChange{{
			ModelName:       strings.ToUpper(alias),
			ExpectedVersion: ModelPricingVersion(PricingValues{}),
			Pricing:         PricingValues{"ModelRatio": float64(1)},
		}})
		require.ErrorContains(t, err, "must use canonical alias spelling "+strconv.Quote(alias))
	})

	for _, operation := range []struct {
		name string
		run  func() error
	}{
		{
			name: "preview",
			run: func() error {
				_, err := PreviewModelPricing("authoritative-read-failure", PricingValues{"ModelRatio": float64(1)})
				return err
			},
		},
		{
			name: "write",
			run: func() error {
				return UpdateModelPricing([]ModelPricingChange{{
					ModelName:       "authoritative-read-failure",
					ExpectedVersion: ModelPricingVersion(PricingValues{}),
					Pricing:         PricingValues{"ModelRatio": float64(1)},
				}})
			},
		},
	} {
		t.Run(operation.name+" fails closed when aliases cannot be read", func(t *testing.T) {
			database := useModelPricingOptionDatabase(t)
			taskAliasViewPtr.Store(nil)
			readErr := errors.New("injected alias view read failure")
			callbackName := "fail_authoritative_alias_read_" + operation.name
			require.NoError(t, database.Callback().Query().Before("gorm:query").Register(callbackName, func(tx *gorm.DB) {
				if _, aliases := tx.Statement.Dest.(*[]Channel); aliases {
					tx.AddError(readErr)
				}
			}))
			t.Cleanup(func() { require.NoError(t, database.Callback().Query().Remove(callbackName)) })

			require.ErrorIs(t, operation.run(), readErr)
		})
	}

	t.Run("stale cached remap cannot remove a newly active override", func(t *testing.T) {
		first, second := useModelPricingOptionDatabases(t)
		const (
			alias        = "authoritative-remapped-alias"
			oldTarget    = "authoritative-old-target"
			oldPluginKey = "authoritative-old-plugin"
			newTarget    = "authoritative-new-remap-target"
			newPluginKey = "authoritative-new-remap-plugin"
			mainExpr     = `tier("main", u("credits") * 1)`
			overrideExpr = `tier("provider", u("seconds") * 1)`
		)
		registerPlugin(t, oldPluginKey, oldTarget, "frames")
		registerPlugin(t, newPluginKey, newTarget, "seconds")

		oldMapping := fmt.Sprintf(`{%q:%q}`, alias, oldTarget)
		channel := Channel{
			Status: common.ChannelStatusEnabled, Name: "authoritative remapped alias",
			Models: alias, ModelMapping: &oldMapping,
		}
		require.NoError(t, first.Create(&channel).Error)
		taskAliasViewPtr.Store(nil)
		target, resolved := ResolveTaskModelAlias(jsplugin.DefaultRegistry.Generation(), alias)
		require.True(t, resolved)
		require.Equal(t, oldPluginKey, target.PluginKey)

		for _, row := range []Option{
			{Key: "billing_setting.billing_mode", Value: fmt.Sprintf(`{%q:%q}`, alias, billing_setting.BillingModeTieredExpr)},
			{Key: "billing_setting.billing_expr", Value: fmt.Sprintf(`{%q:%q}`, alias, mainExpr)},
			{Key: billing_setting.PluginBillingExprOption, Value: fmt.Sprintf(`{%q:%q}`,
				billing_setting.PluginBillingExprKey(newPluginKey, alias), overrideExpr)},
		} {
			require.NoError(t, second.Create(&row).Error)
		}
		newMapping := fmt.Sprintf(`{%q:%q}`, alias, newTarget)
		require.NoError(t, second.Model(&Channel{}).Where("id = ?", channel.Id).Update("model_mapping", newMapping).Error)
		target, resolved = ResolveTaskModelAlias(jsplugin.DefaultRegistry.Generation(), alias)
		require.True(t, resolved)
		require.Equal(t, oldPluginKey, target.PluginKey, "the process cache remains stale for the regression setup")

		err := UpdateModelPricingOptions(map[string]string{billing_setting.PluginBillingExprOption: `{}`})
		require.ErrorContains(t, err, `usage key "credits" is not declared`)

		var stored Option
		require.NoError(t, first.Where("key = ?", billing_setting.PluginBillingExprOption).First(&stored).Error)
		var variants map[string]string
		require.NoError(t, common.UnmarshalJsonStr(stored.Value, &variants))
		assert.Equal(t, overrideExpr, variants[billing_setting.PluginBillingExprKey(newPluginKey, alias)])
	})
}

type staleAliasCacheFixture struct {
	first, second               *gorm.DB
	channelID                   int
	alias, oldTarget, newTarget string
	oldPlugin, newPlugin        string
	newExpr                     string
}

func setupStaleAliasCache(t *testing.T, suffix string) staleAliasCacheFixture {
	t.Helper()
	first, second := useModelPricingOptionDatabases(t)
	fixture := staleAliasCacheFixture{
		first:     first,
		second:    second,
		alias:     "r4-cache-alias-" + suffix,
		oldTarget: "r4-cache-old-target-" + suffix,
		newTarget: "r4-cache-new-target-" + suffix,
		oldPlugin: "r4-cache-old-" + suffix,
		newPlugin: "r4-cache-new-" + suffix,
		newExpr:   `tier("new", u("credits") * 2)`,
	}
	for _, spec := range []struct {
		key, model, field, unit string
	}{
		{fixture.oldPlugin, fixture.oldTarget, "frames", "count"},
		{fixture.newPlugin, fixture.newTarget, "credits", "credit"},
	} {
		source := fmt.Sprintf(`
export const meta = {
  apiVersion: 1, key: %q, name: %q, version: "1.0.0", author: {name: "Test"},
  models: [%q], fetchMode: "per_task",
  usageSchema: {%s: {type: "number", unit: %q}}
};
export function buildSubmitRequest() { return {}; }
export function parseSubmitResponse() { return {}; }
export function buildQueryRequest() { return {}; }
export function parseTaskResult() { return {}; }
`, spec.key, spec.key, spec.model, spec.field, spec.unit)
		_, err := jsplugin.DefaultRegistry.Register(source, jsplugin.Options{})
		require.NoError(t, err)
		t.Cleanup(func() { jsplugin.DefaultRegistry.Unregister(spec.key) })
	}

	previousMemoryCache := common.MemoryCacheEnabled
	channelSyncLock.Lock()
	previousGroups := group2model2channels
	previousChannels := channelsIDM
	previousAdvanced := channel2advancedCustomConfig
	channelSyncLock.Unlock()
	t.Cleanup(func() {
		channelSyncLock.Lock()
		group2model2channels = previousGroups
		channelsIDM = previousChannels
		channel2advancedCustomConfig = previousAdvanced
		channelSyncLock.Unlock()
		common.MemoryCacheEnabled = previousMemoryCache
	})
	common.MemoryCacheEnabled = true
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"billing_setting.billing_mode":          `{}`,
		"billing_setting.billing_expr":          `{}`,
		billing_setting.PluginBillingExprOption: `{}`,
	}))

	oldMapping := fmt.Sprintf(`{%q:%q}`, fixture.alias, fixture.oldTarget)
	oldSetting := fmt.Sprintf(`{"task_plugin_key":%q}`, fixture.oldPlugin)
	channel := Channel{
		Type: constant.ChannelTypeTaskPlugin, Status: common.ChannelStatusEnabled,
		Name: "R4 stale cache " + suffix, Models: fixture.alias, Group: "default",
		ModelMapping: &oldMapping, Setting: &oldSetting,
	}
	require.NoError(t, first.Create(&channel).Error)
	fixture.channelID = channel.Id
	require.NoError(t, first.Create(&Ability{
		Group: "default", Model: fixture.alias, ChannelId: channel.Id, Enabled: true,
	}).Error)
	InitChannelCache()

	target, resolved := ResolveTaskModelAlias(jsplugin.DefaultRegistry.Generation(), fixture.alias)
	require.True(t, resolved)
	require.Equal(t, fixture.oldTarget, target.Declared)
	cached, err := CacheGetChannel(channel.Id)
	require.NoError(t, err)
	require.Equal(t, fixture.oldPlugin, cached.GetSetting().TaskPluginKey)

	newMapping := fmt.Sprintf(`{%q:%q}`, fixture.alias, fixture.newTarget)
	newSetting := fmt.Sprintf(`{"task_plugin_key":%q}`, fixture.newPlugin)
	require.NoError(t, second.Model(&Channel{}).Where("id = ?", channel.Id).Updates(map[string]any{
		"model_mapping": newMapping,
		"setting":       newSetting,
	}).Error)
	return fixture
}

func TestAliasAwarePricingSaveRefreshesRoutingCacheBeforeCommit(t *testing.T) {
	fixture := setupStaleAliasCache(t, "success")
	rebuildTaskAliasView()
	target, resolved := ResolveTaskModelAlias(jsplugin.DefaultRegistry.Generation(), fixture.alias)
	require.True(t, resolved)
	require.Equal(t, fixture.newTarget, target.Declared, "the alias-only refresh sees the new database state")
	staleChannel, err := CacheGetChannel(fixture.channelID)
	require.NoError(t, err)
	require.Equal(t, fixture.oldPlugin, staleChannel.GetSetting().TaskPluginKey, "the channel cache remains stale for the regression setup")

	require.NoError(t, UpdateModelPricing([]ModelPricingChange{{
		ModelName:       fixture.alias,
		ExpectedVersion: ModelPricingVersion(PricingValues{}),
		Pricing: PricingValues{
			"billing_setting.billing_mode": billing_setting.BillingModeTieredExpr,
			"billing_setting.billing_expr": fixture.newExpr,
		},
	}}))

	target, resolved = ResolveTaskModelAlias(jsplugin.DefaultRegistry.Generation(), fixture.alias)
	require.True(t, resolved)
	assert.Equal(t, fixture.newTarget, target.Declared)
	selected, err := GetRandomSatisfiedChannel("default", fixture.alias, 0, []dto.ChannelFilter{{
		Kind:          dto.FilterTaskPluginIdentity,
		TaskPluginKey: fixture.newPlugin,
	}})
	require.NoError(t, err)
	require.NotNil(t, selected)
	assert.Equal(t, fixture.channelID, selected.Id)
	assert.Equal(t, fixture.newPlugin, selected.GetSetting().TaskPluginKey)
	expression, exists := billing_setting.GetBillingExpr(fixture.alias)
	assert.True(t, exists)
	assert.Equal(t, fixture.newExpr, expression)
}

func TestAliasAwarePricingSaveRefreshFailureRollsBackBeforeCommit(t *testing.T) {
	fixture := setupStaleAliasCache(t, "failure")
	require.NoError(t, fixture.first.Create(&Option{Key: modelPricingRevisionOptionKey, Value: "7"}).Error)
	refreshErr := errors.New("injected channel cache refresh failure")
	const callbackName = "fail_r4_channel_cache_refresh"
	require.NoError(t, fixture.first.Callback().Query().Before("gorm:query").Register(callbackName, func(tx *gorm.DB) {
		if _, refreshing := tx.Statement.Dest.(*[]*Channel); refreshing {
			tx.AddError(refreshErr)
		}
	}))
	t.Cleanup(func() { require.NoError(t, fixture.first.Callback().Query().Remove(callbackName)) })

	err := UpdateModelPricingWithEvidence([]ModelPricingChange{{
		ModelName:       fixture.alias,
		ExpectedVersion: ModelPricingVersion(PricingValues{}),
		Pricing: PricingValues{
			"billing_setting.billing_mode": billing_setting.BillingModeTieredExpr,
			"billing_setting.billing_expr": fixture.newExpr,
		},
	}}, []UpstreamPriceEvidence{modelPricingCASEvidence(fixture.alias, "f")})
	require.ErrorIs(t, err, refreshErr)

	var revision Option
	require.NoError(t, fixture.first.Where("key = ?", modelPricingRevisionOptionKey).First(&revision).Error)
	assert.Equal(t, "7", revision.Value)
	var evidenceCount int64
	require.NoError(t, fixture.first.Model(&UpstreamPriceEvidence{}).Count(&evidenceCount).Error)
	assert.Zero(t, evidenceCount)
	var pricingRows int64
	require.NoError(t, fixture.first.Model(&Option{}).
		Where("key IN ?", modelPricingOptionKeys).
		Count(&pricingRows).Error)
	assert.Zero(t, pricingRows)
	_, published := billing_setting.GetBillingExpr(fixture.alias)
	assert.False(t, published)
	cached, cacheErr := CacheGetChannel(fixture.channelID)
	require.NoError(t, cacheErr)
	assert.Equal(t, fixture.oldPlugin, cached.GetSetting().TaskPluginKey)
}

func TestUpdateModelPricingBuildsAuthoritativeAliasViewAfterPricingLocksBeforeValidation(t *testing.T) {
	first, second := useModelPricingOptionDatabases(t)
	DB = second
	previousMain, previousLog := common.MainDatabaseType(), common.LogDatabaseType()
	common.SetDatabaseTypes(common.DatabaseTypeMySQL, previousLog)
	t.Cleanup(func() { common.SetDatabaseTypes(previousMain, previousLog) })
	taskAliasViewPtr.Store(nil)

	type channelObservation struct {
		source              string
		locked, orderedByID bool
	}
	var events []string
	var channelQueries []channelObservation
	registerObserver := func(database *gorm.DB, source string) {
		t.Helper()
		callbackName := "observe_authoritative_alias_order_" + source
		require.NoError(t, database.Callback().Query().Before("gorm:query").Register(callbackName, func(tx *gorm.DB) {
			switch tx.Statement.Dest.(type) {
			case *[]Option:
				events = append(events, "pricing")
			case *[]Channel:
				_, locked := tx.Statement.Clauses["FOR"]
				orderClause, ordered := tx.Statement.Clauses["ORDER BY"]
				orderBy, validOrder := orderClause.Expression.(clause.OrderBy)
				orderedByID := ordered && validOrder && len(orderBy.Columns) == 1 &&
					orderBy.Columns[0].Column.Name == "id" && !orderBy.Columns[0].Desc
				channelQueries = append(channelQueries, channelObservation{
					source: source, locked: locked, orderedByID: orderedByID,
				})
				events = append(events, "channels")
			}
			delete(tx.Statement.Clauses, "FOR")
		}))
		t.Cleanup(func() { require.NoError(t, database.Callback().Query().Remove(callbackName)) })
	}
	registerObserver(first, "transaction")
	registerObserver(second, "global")

	_, err := updateModelPricingDatabase(first, []ModelPricingChange{{
		ModelName:       "authoritative-lock-order",
		ExpectedVersion: ModelPricingVersion(PricingValues{}),
		Pricing:         PricingValues{"unsupported": float64(1)},
	}}, nil)
	require.ErrorContains(t, err, "unsupported pricing field")
	assert.Equal(t, []string{"pricing", "channels"}, events)
	assert.Equal(t, []channelObservation{{
		source: "transaction", locked: true, orderedByID: true,
	}}, channelQueries)
}

func TestUpdateModelPricingOptionsRejectsRemovingActiveAliasVariant(t *testing.T) {
	database, _ := openModelPricingInstanceDatabases(t)
	previousDB := DB
	previousOptions := common.OptionMap
	previousConfig := config.GlobalConfig.ExportAllConfigs()
	previousAliasView := taskAliasViewPtr.Load()
	restoreRatios := []struct {
		value   string
		restore func(string) error
	}{
		{ratio_setting.ModelPrice2JSONString(), ratio_setting.UpdateModelPriceByJSONString},
		{ratio_setting.ModelRatio2JSONString(), ratio_setting.UpdateModelRatioByJSONString},
		{ratio_setting.CompletionRatio2JSONString(), ratio_setting.UpdateCompletionRatioByJSONString},
		{ratio_setting.CacheRatio2JSONString(), ratio_setting.UpdateCacheRatioByJSONString},
		{ratio_setting.CreateCacheRatio2JSONString(), ratio_setting.UpdateCreateCacheRatioByJSONString},
		{ratio_setting.ImageRatio2JSONString(), ratio_setting.UpdateImageRatioByJSONString},
		{ratio_setting.AudioRatio2JSONString(), ratio_setting.UpdateAudioRatioByJSONString},
		{ratio_setting.AudioCompletionRatio2JSONString(), ratio_setting.UpdateAudioCompletionRatioByJSONString},
	}
	DB = database
	common.OptionMap = maps.Clone(previousOptions)
	if common.OptionMap == nil {
		common.OptionMap = make(map[string]string)
	}
	t.Cleanup(func() {
		for _, ratio := range restoreRatios {
			require.NoError(t, ratio.restore(ratio.value))
		}
		require.NoError(t, config.GlobalConfig.LoadFromDB(previousConfig))
		taskAliasViewPtr.Store(previousAliasView)
		common.OptionMap = previousOptions
		DB = previousDB
	})

	const (
		alias             = "seedream-alias-variant-test"
		canonical         = "seedream-canonical-variant-test"
		pluginKey         = "seedream-alias-variant-plugin"
		remappedCanonical = "seedream-remapped-canonical-test"
		remappedPluginKey = "seedream-remap-plugin"
		mainExpr          = `tier("request", fixed(0.01))`
		variantExpr       = `tier("task", u("seconds") * 1)`
	)
	source := fmt.Sprintf(`
export const meta = {
  apiVersion: 1, key: %q, name: %q, version: "1.0.0", author: {name: "Test"},
  models: [%q], fetchMode: "per_task",
  usageSchema: {credits: {type: "number", unit: "credit"}},
  usageExamples: [{label: "default credit", facts: {credits: 1}}],
  usageProfiles: [{
    models: [%q],
    schema: {seconds: {type: "number", unit: "second"}},
    examples: [{label: "canonical second", facts: {seconds: 1}}]
  }]
};
export function buildSubmitRequest() { return {}; }
export function parseSubmitResponse() { return {}; }
export function buildQueryRequest() { return {}; }
export function parseTaskResult() { return {}; }
`, pluginKey, pluginKey, canonical, canonical)
	_, err := jsplugin.DefaultRegistry.Register(source, jsplugin.Options{})
	require.NoError(t, err)
	t.Cleanup(func() { jsplugin.DefaultRegistry.Unregister(pluginKey) })
	remappedSource := fmt.Sprintf(`
export const meta = {
  apiVersion: 1, key: %q, name: %q, version: "1.0.0", author: {name: "Test"},
  models: [%q], fetchMode: "per_task",
  usageSchema: {frames: {type: "number", unit: "count"}},
  usageExamples: [{label: "canonical frame", facts: {frames: 1}}]
};
export function buildSubmitRequest() { return {}; }
export function parseSubmitResponse() { return {}; }
export function buildQueryRequest() { return {}; }
export function parseTaskResult() { return {}; }
`, remappedPluginKey, remappedPluginKey, remappedCanonical)
	_, err = jsplugin.DefaultRegistry.Register(remappedSource, jsplugin.Options{})
	require.NoError(t, err)
	t.Cleanup(func() { jsplugin.DefaultRegistry.Unregister(remappedPluginKey) })
	plugin, exists := jsplugin.DefaultRegistry.Generation().Get(pluginKey)
	require.True(t, exists)
	schema, examples := plugin.Meta.UsageForModel(canonical)
	remappedPlugin, exists := jsplugin.DefaultRegistry.Generation().Get(remappedPluginKey)
	require.True(t, exists)
	remappedSchema, remappedExamples := remappedPlugin.Meta.UsageForModel(remappedCanonical)
	require.NoError(t, billing_setting.SmokeTestExpr(mainExpr))
	require.ErrorContains(t, billing_setting.SmokeTestTaskExpr(mainExpr, schema), "fixed pricing is not supported")
	require.NoError(t, billing_setting.SmokeTestTaskExpr(variantExpr, schema))

	mapping := fmt.Sprintf(`{%q:%q}`, alias, canonical)
	channel := Channel{
		Id: 940, Status: common.ChannelStatusEnabled, Name: "seedream alias variant",
		Models: alias, ModelMapping: &mapping,
	}
	require.NoError(t, database.Create(&channel).Error)
	rebuildTaskAliasView()
	target, resolved := ResolveTaskModelAlias(jsplugin.DefaultRegistry.Generation(), alias)
	require.True(t, resolved)
	assert.Equal(t, TaskAliasTarget{Alias: alias, Declared: canonical, PluginKey: pluginKey}, target)

	initial, err := GetModelPricingSnapshot([]string{alias})
	require.NoError(t, err)
	require.Len(t, initial.Entries, 1)
	if assert.Len(t, initial.Entries[0].PluginVariants, 1, "fresh aliases expose their active provider") {
		freshVariant := initial.Entries[0].PluginVariants[0]
		assert.Equal(t, pluginKey, freshVariant.PluginKey)
		assert.False(t, freshVariant.Stale)
		assert.Equal(t, schema, freshVariant.UsageSchema)
		assert.Equal(t, examples, freshVariant.UsageExamples)
	}
	pricing := PricingValues{
		"billing_setting.billing_mode":          billing_setting.BillingModeTieredExpr,
		"billing_setting.billing_expr":          mainExpr,
		billing_setting.PluginBillingExprOption: map[string]any{pluginKey: variantExpr},
	}
	preview, err := PreviewModelPricing(alias, pricing)
	require.NoError(t, err)
	assert.Equal(t, mainExpr, preview["billing_setting.billing_expr"])
	assert.Equal(t, map[string]any{pluginKey: variantExpr}, preview[billing_setting.PluginBillingExprOption])
	require.NoError(t, UpdateModelPricing([]ModelPricingChange{{
		ModelName:       alias,
		ExpectedVersion: initial.Entries[0].Version,
		Pricing:         pricing,
	}}))

	err = UpdateModelPricingOptions(map[string]string{billing_setting.PluginBillingExprOption: `{}`})
	require.ErrorContains(t, err, "plugin "+pluginKey)
	active, err := GetModelPricingSnapshot([]string{alias})
	require.NoError(t, err)
	require.Equal(t, map[string]any{pluginKey: variantExpr}, active.Entries[0].Configured[billing_setting.PluginBillingExprOption])
	require.Len(t, active.Entries[0].PluginVariants, 1)
	activeVariant := active.Entries[0].PluginVariants[0]
	assert.False(t, activeVariant.Stale)
	assert.Equal(t, schema, activeVariant.UsageSchema)
	assert.Equal(t, examples, activeVariant.UsageExamples)
	assert.Equal(t, variantExpr, activeVariant.Configured)
	assert.Equal(t, variantExpr, activeVariant.Effective)
	assert.True(t, activeVariant.Compatible)

	remappedMapping := fmt.Sprintf(`{%q:%q}`, alias, remappedCanonical)
	require.NoError(t, database.Model(&Channel{}).Where("id = ?", channel.Id).Update("model_mapping", remappedMapping).Error)
	rebuildTaskAliasView()
	remapped, err := GetModelPricingSnapshot([]string{alias})
	require.NoError(t, err)
	remappedVariants := make(map[string]ModelPricingPluginVariant)
	for _, variant := range remapped.Entries[0].PluginVariants {
		remappedVariants[variant.PluginKey] = variant
	}
	assert.Len(t, remappedVariants, 2, "remapped aliases retain stale overrides and expose the active provider")
	assert.True(t, remappedVariants[pluginKey].Stale)
	activeRemapped := remappedVariants[remappedPluginKey]
	assert.False(t, activeRemapped.Stale)
	assert.Equal(t, remappedSchema, activeRemapped.UsageSchema)
	assert.Equal(t, remappedExamples, activeRemapped.UsageExamples)

	require.NoError(t, database.Model(&Channel{}).Where("id = ?", channel.Id).Update("model_mapping", mapping).Error)
	rebuildTaskAliasView()
	require.NoError(t, database.Model(&Channel{}).Where("id = ?", channel.Id).Update("status", common.ChannelStatusManuallyDisabled).Error)
	rebuildTaskAliasView()
	stale, err := GetModelPricingSnapshot([]string{alias})
	require.NoError(t, err)
	require.Len(t, stale.Entries[0].PluginVariants, 1)
	staleVariant := stale.Entries[0].PluginVariants[0]
	assert.True(t, staleVariant.Stale)
	assert.Equal(t, variantExpr, staleVariant.Configured)

	require.NoError(t, UpdateModelPricingOptions(map[string]string{billing_setting.PluginBillingExprOption: `{}`}))
	staleRemoved, err := GetModelPricingSnapshot([]string{alias})
	require.NoError(t, err)
	assert.NotContains(t, staleRemoved.Entries[0].Configured, billing_setting.PluginBillingExprOption)
	assert.Equal(t, mainExpr, staleRemoved.Entries[0].Configured["billing_setting.billing_expr"])
}

func TestLegacyWildcardAliasUsesCanonicalConfiguredStateAndRuntimePublication(t *testing.T) {
	database, _ := openModelPricingInstanceDatabases(t)
	previousDB := DB
	previousOptions := common.OptionMap
	previousConfig := config.GlobalConfig.ExportAllConfigs()
	restoreRatios := []struct {
		value   string
		restore func(string) error
	}{
		{ratio_setting.ModelPrice2JSONString(), ratio_setting.UpdateModelPriceByJSONString},
		{ratio_setting.ModelRatio2JSONString(), ratio_setting.UpdateModelRatioByJSONString},
		{ratio_setting.CompletionRatio2JSONString(), ratio_setting.UpdateCompletionRatioByJSONString},
		{ratio_setting.CacheRatio2JSONString(), ratio_setting.UpdateCacheRatioByJSONString},
		{ratio_setting.CreateCacheRatio2JSONString(), ratio_setting.UpdateCreateCacheRatioByJSONString},
		{ratio_setting.ImageRatio2JSONString(), ratio_setting.UpdateImageRatioByJSONString},
		{ratio_setting.AudioRatio2JSONString(), ratio_setting.UpdateAudioRatioByJSONString},
		{ratio_setting.AudioCompletionRatio2JSONString(), ratio_setting.UpdateAudioCompletionRatioByJSONString},
	}
	DB = database
	common.OptionMap = maps.Clone(previousOptions)
	if common.OptionMap == nil {
		common.OptionMap = make(map[string]string)
	}
	t.Cleanup(func() {
		for _, ratio := range restoreRatios {
			require.NoError(t, ratio.restore(ratio.value))
		}
		require.NoError(t, config.GlobalConfig.LoadFromDB(previousConfig))
		common.OptionMap = previousOptions
		DB = previousDB
	})

	const (
		canonical  = "gpt-4-gizmo-*"
		firstName  = "gpt-4-gizmo-alpha"
		secondName = "gpt-4-gizmo-beta"
	)
	initial, err := GetModelPricingSnapshot([]string{firstName, secondName})
	require.NoError(t, err)
	require.Len(t, initial.Entries, 2)
	assert.Equal(t, initial.Entries[0].Version, initial.Entries[1].Version)
	assert.Equal(t, float64(15), initial.Entries[0].Configured["ModelRatio"])
	assert.Equal(t, float64(15), initial.Entries[1].Configured["ModelRatio"])

	staleVersion := initial.Entries[1].Version
	require.NoError(t, UpdateModelPricing([]ModelPricingChange{{
		ModelName:       firstName,
		ExpectedVersion: initial.Entries[0].Version,
		Pricing:         PricingValues{"ModelRatio": float64(21)},
	}}))
	ratio, configured, resolvedName := ratio_setting.GetModelRatio(firstName)
	assert.True(t, configured)
	assert.Equal(t, float64(21), ratio)
	assert.Equal(t, canonical, resolvedName)

	err = UpdateModelPricing([]ModelPricingChange{{
		ModelName:       secondName,
		ExpectedVersion: staleVersion,
		Pricing:         PricingValues{"ModelRatio": float64(22)},
	}})
	require.ErrorIs(t, err, ErrModelPricingConflict)

	updated, err := GetModelPricingSnapshot([]string{firstName})
	require.NoError(t, err)
	require.NoError(t, UpdateModelPricing([]ModelPricingChange{{
		ModelName:       firstName,
		ExpectedVersion: updated.Entries[0].Version,
		Reset:           true,
	}}))

	var option Option
	require.NoError(t, database.Where("key = ?", "ModelRatio").First(&option).Error)
	var ratios map[string]float64
	require.NoError(t, common.UnmarshalJsonStr(option.Value, &ratios))
	assert.Equal(t, float64(15), ratios[canonical])
	assert.NotContains(t, ratios, firstName)
	assert.NotContains(t, ratios, secondName)
	ratio, configured, resolvedName = ratio_setting.GetModelRatio(secondName)
	assert.True(t, configured)
	assert.Equal(t, float64(15), ratio)
	assert.Equal(t, canonical, resolvedName)
}

func TestUpdateModelPricingPreflightsSharedWildcardStorage(t *testing.T) {
	const (
		canonical  = "gpt-4-gizmo-*"
		firstName  = "gpt-4-gizmo-alpha"
		secondName = "gpt-4-gizmo-beta"
	)

	t.Run("identical updates use the immutable initial versions", func(t *testing.T) {
		database := useModelPricingOptionDatabase(t)
		initial, err := GetModelPricingSnapshot([]string{firstName, secondName})
		require.NoError(t, err)
		require.Len(t, initial.Entries, 2)
		require.Equal(t, initial.Entries[0].Version, initial.Entries[1].Version)

		require.NoError(t, UpdateModelPricing([]ModelPricingChange{
			{
				ModelName:       firstName,
				ExpectedVersion: initial.Entries[0].Version,
				Pricing:         PricingValues{"ModelRatio": float64(21)},
			},
			{
				ModelName:       secondName,
				ExpectedVersion: initial.Entries[1].Version,
				Pricing:         PricingValues{"ModelRatio": float64(21)},
			},
		}))

		updated, err := GetModelPricingSnapshot([]string{firstName, secondName})
		require.NoError(t, err)
		assert.Equal(t, float64(21), updated.Entries[0].Configured["ModelRatio"])
		assert.Equal(t, float64(21), updated.Entries[1].Configured["ModelRatio"])
		var option Option
		require.NoError(t, database.Where("key = ?", "ModelRatio").First(&option).Error)
		var ratios map[string]float64
		require.NoError(t, common.UnmarshalJsonStr(option.Value, &ratios))
		assert.Equal(t, float64(21), ratios[canonical])
		assert.NotContains(t, ratios, firstName)
		assert.NotContains(t, ratios, secondName)
		var revision Option
		require.NoError(t, database.Where("key = ?", modelPricingRevisionOptionKey).First(&revision).Error)
		assert.Equal(t, "1", revision.Value)
	})

	t.Run("reset and equivalent explicit defaults are compatible", func(t *testing.T) {
		useModelPricingOptionDatabase(t)
		initial, err := GetModelPricingSnapshot([]string{firstName, secondName})
		require.NoError(t, err)
		require.Len(t, initial.Entries, 2)
		require.Equal(t, initial.Entries[0].Version, initial.Entries[1].Version)

		require.NoError(t, UpdateModelPricing([]ModelPricingChange{
			{
				ModelName:       firstName,
				ExpectedVersion: initial.Entries[0].Version,
				Reset:           true,
			},
			{
				ModelName:       secondName,
				ExpectedVersion: initial.Entries[1].Version,
				Pricing:         maps.Clone(initial.Entries[1].Configured),
			},
		}))
	})

	for _, test := range []struct {
		name          string
		secondPricing PricingValues
	}{
		{name: "conflicting values", secondPricing: PricingValues{"ModelRatio": float64(22)}},
		{name: "presence conflicts with omission", secondPricing: PricingValues{}},
	} {
		t.Run(test.name+" fail atomically as payload conflicts", func(t *testing.T) {
			database := useModelPricingOptionDatabase(t)
			require.NoError(t, database.Create(&[]Option{
				{Key: modelPricingRevisionOptionKey, Value: "7"},
				{Key: "ModelRatio", Value: `{"gpt-4-gizmo-*":15,"unrelated-model":9}`},
			}).Error)
			baselineEvidence := modelPricingCASEvidence("existing-evidence", "a")
			require.NoError(t, database.Create(&baselineEvidence).Error)

			initial, err := GetModelPricingSnapshot([]string{firstName, secondName})
			require.NoError(t, err)
			require.Len(t, initial.Entries, 2)
			require.Equal(t, initial.Entries[0].Version, initial.Entries[1].Version)
			var beforeOptions []Option
			require.NoError(t, database.Order("key").Find(&beforeOptions).Error)

			rejectedEvidence := modelPricingCASEvidence("rejected-evidence", "b")
			err = UpdateModelPricingWithEvidence([]ModelPricingChange{
				{
					ModelName:       firstName,
					ExpectedVersion: initial.Entries[0].Version,
					Pricing:         PricingValues{"ModelRatio": float64(21)},
				},
				{
					ModelName:       secondName,
					ExpectedVersion: initial.Entries[1].Version,
					Pricing:         test.secondPricing,
				},
			}, []UpstreamPriceEvidence{rejectedEvidence})
			require.Error(t, err)
			assert.ErrorIs(t, err, ErrModelPricingPayloadConflict)
			assert.ErrorContains(t, err, "conflicting model pricing payload")
			assert.NotErrorIs(t, err, ErrModelPricingConflict)

			var afterOptions []Option
			require.NoError(t, database.Order("key").Find(&afterOptions).Error)
			assert.Equal(t, beforeOptions, afterOptions)
			var revision Option
			require.NoError(t, database.Where("key = ?", modelPricingRevisionOptionKey).First(&revision).Error)
			assert.Equal(t, "7", revision.Value)
			var evidence []UpstreamPriceEvidence
			require.NoError(t, database.Order("id").Find(&evidence).Error)
			require.Len(t, evidence, 1)
			assert.Equal(t, baselineEvidence.EvidenceHash, evidence[0].EvidenceHash)
		})
	}
}
