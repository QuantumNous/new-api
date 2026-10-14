package billing_setting

import (
	"fmt"
	"maps"
	"runtime"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func rawBillingSettingSnapshot() BillingSetting {
	var snapshot BillingSetting
	config.GlobalConfig.Read("billing_setting", func(value any) {
		setting := value.(*BillingSetting)
		snapshot = BillingSetting{
			BillingMode:       maps.Clone(setting.BillingMode),
			BillingExpr:       maps.Clone(setting.BillingExpr),
			PluginBillingExpr: maps.Clone(setting.PluginBillingExpr),
		}
	})
	return snapshot
}

func TestResolveModelBillingDecisionKeepsPublishedBundleCoherent(t *testing.T) {
	const (
		modelName   = "atomic-model-decision"
		requestExpr = `tier("request", p * 2)`
	)

	previous := config.GlobalConfig.ExportAllConfigs()
	t.Cleanup(func() {
		require.NoError(t, config.GlobalConfig.LoadFromDB(previous))
	})

	transitions := []struct {
		name       string
		mode       string
		expression string
		exists     bool
	}{
		{name: "ratio before publication", mode: BillingModeRatio},
		{name: "tiered publication", mode: BillingModeTieredExpr, expression: requestExpr, exists: true},
		{name: "ratio after publication", mode: BillingModeRatio},
	}
	for _, transition := range transitions {
		t.Run(transition.name, func(t *testing.T) {
			modes := fmt.Sprintf(`{%q:%q}`, modelName, transition.mode)
			expressions := `{}`
			if transition.exists {
				expressions = fmt.Sprintf(`{%q:%q}`, modelName, transition.expression)
			}
			require.NoError(t, UpdateBillingSettingOptions(map[string]string{
				BillingModeOption:       modes,
				BillingExprOption:       expressions,
				PluginBillingExprOption: `{}`,
			}))

			decision := ResolveModelBillingDecision(modelName)

			assert.Equal(t, transition.mode, decision.Mode)
			assert.Equal(t, transition.expression, decision.Expression)
			assert.Equal(t, transition.exists, decision.ExpressionExists)
		})
	}
}

func TestGetBillingOptionSnapshotReturnsEffectiveIndependentCopies(t *testing.T) {
	const (
		modelName    = "option-snapshot-model"
		pluginKey    = "option-snapshot-provider"
		mainExpr     = `tier("main", p * 2 + c * 8)`
		providerExpr = `tier("provider", u("image_count") * 0.03)`
	)

	previous := config.GlobalConfig.ExportAllConfigs()
	t.Cleanup(func() {
		require.NoError(t, config.GlobalConfig.LoadFromDB(previous))
	})
	require.NoError(t, UpdateBillingSettingOptions(map[string]string{
		BillingModeOption:       fmt.Sprintf(`{%q:%q}`, modelName, BillingModeTieredExpr),
		BillingExprOption:       fmt.Sprintf(`{%q:%q}`, modelName, mainExpr),
		PluginBillingExprOption: fmt.Sprintf(`{%q:%q}`, PluginBillingExprKey(pluginKey, modelName), providerExpr),
	}))

	expectedModes := GetBillingModeCopy()
	expectedExpressions := GetBillingExprCopy()
	expectedProviderExpressions := GetPluginBillingExprCopy()
	snapshot := GetBillingOptionSnapshot()

	assert.Equal(t, expectedModes, snapshot.BillingMode)
	assert.Equal(t, expectedExpressions, snapshot.BillingExpr)
	assert.Equal(t, expectedProviderExpressions, snapshot.PluginBillingExpr)

	snapshot.BillingMode[modelName] = BillingModeRatio
	snapshot.BillingExpr[modelName] = "mutated"
	snapshot.PluginBillingExpr[PluginBillingExprKey(pluginKey, modelName)] = "mutated"

	fresh := GetBillingOptionSnapshot()
	assert.Equal(t, BillingModeTieredExpr, fresh.BillingMode[modelName])
	assert.Equal(t, mainExpr, fresh.BillingExpr[modelName])
	assert.Equal(t, providerExpr, fresh.PluginBillingExpr[PluginBillingExprKey(pluginKey, modelName)])
}

func TestUpdateBillingSettingOptionsRejectsInvalidMapsWithoutMutation(t *testing.T) {
	const (
		modelName      = "billing-update-rollback"
		pluginKey      = "billing-update-provider"
		previousExpr   = `tier("previous", p * 2 + c * 8)`
		previousPlugin = `tier("previous-provider", u("image_count") * 0.03)`
		nextExpr       = `tier("next", p * 3 + c * 9)`
		nextPlugin     = `tier("next-provider", u("image_count") * 0.04)`
	)

	previous := config.GlobalConfig.ExportAllConfigs()
	t.Cleanup(func() {
		require.NoError(t, config.GlobalConfig.LoadFromDB(previous))
	})
	priorOptions := map[string]string{
		BillingModeOption:       fmt.Sprintf(`{%q:%q}`, modelName, BillingModeRatio),
		BillingExprOption:       fmt.Sprintf(`{%q:%q}`, modelName, previousExpr),
		PluginBillingExprOption: fmt.Sprintf(`{%q:%q}`, PluginBillingExprKey(pluginKey, modelName), previousPlugin),
	}
	validNext := map[string]string{
		BillingModeOption:       fmt.Sprintf(`{%q:%q}`, modelName, BillingModeTieredExpr),
		BillingExprOption:       fmt.Sprintf(`{%q:%q}`, modelName, nextExpr),
		PluginBillingExprOption: fmt.Sprintf(`{%q:%q}`, PluginBillingExprKey(pluginKey, modelName), nextPlugin),
	}

	tests := []struct {
		name    string
		key     string
		invalid string
	}{
		{name: "malformed provider map after valid mode and main maps", key: PluginBillingExprOption, invalid: `{`},
		{name: "null provider map after valid mode and main maps", key: PluginBillingExprOption, invalid: `null`},
		{name: "malformed main map between valid mode and provider maps", key: BillingExprOption, invalid: `{`},
		{name: "null main map between valid mode and provider maps", key: BillingExprOption, invalid: `null`},
		{name: "malformed mode map before valid main and provider maps", key: BillingModeOption, invalid: `{`},
		{name: "null mode map before valid main and provider maps", key: BillingModeOption, invalid: `null`},
	}
	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			require.NoError(t, UpdateBillingSettingOptions(priorOptions))
			before := rawBillingSettingSnapshot()
			options := maps.Clone(validNext)
			options[testCase.key] = testCase.invalid

			err := UpdateBillingSettingOptions(options)

			assert.Error(t, err)
			assert.Equal(t, before, rawBillingSettingSnapshot())
		})
	}
}

func TestUpdateBillingSettingOptionsPreservesUnsuppliedMaps(t *testing.T) {
	const (
		modelName     = "billing-partial-update"
		pluginKey     = "billing-partial-provider"
		previousExpr  = "previous-main"
		nextExpr      = "next-main"
		providerExpr  = "previous-provider"
		previousMode  = BillingModeRatio
		providerEntry = pluginKey + "::" + modelName
	)

	previous := config.GlobalConfig.ExportAllConfigs()
	t.Cleanup(func() {
		require.NoError(t, config.GlobalConfig.LoadFromDB(previous))
	})
	require.NoError(t, UpdateBillingSettingOptions(map[string]string{
		BillingModeOption:       fmt.Sprintf(`{%q:%q}`, modelName, previousMode),
		BillingExprOption:       fmt.Sprintf(`{%q:%q}`, modelName, previousExpr),
		PluginBillingExprOption: fmt.Sprintf(`{%q:%q}`, providerEntry, providerExpr),
	}))
	before := rawBillingSettingSnapshot()

	require.NoError(t, UpdateBillingSettingOptions(map[string]string{
		BillingExprOption: fmt.Sprintf(`{%q:%q}`, modelName, nextExpr),
	}))

	after := rawBillingSettingSnapshot()
	assert.Equal(t, before.BillingMode, after.BillingMode)
	assert.Equal(t, map[string]string{modelName: nextExpr}, after.BillingExpr)
	assert.Equal(t, before.PluginBillingExpr, after.PluginBillingExpr)
}

func TestUpdateBillingSettingOptionsPublishesOnlyCompleteGenerations(t *testing.T) {
	const (
		modelName = "billing-generation-model"
		pluginKey = "billing-generation-provider"
	)
	type generation [3]string

	previous := config.GlobalConfig.ExportAllConfigs()
	t.Cleanup(func() {
		require.NoError(t, config.GlobalConfig.LoadFromDB(previous))
	})
	oldGeneration := generation{BillingModeRatio, "old-main", "old-provider"}
	newGeneration := generation{BillingModeTieredExpr, "new-main", "new-provider"}
	optionsFor := func(values generation) map[string]string {
		return map[string]string{
			BillingModeOption:       fmt.Sprintf(`{%q:%q}`, modelName, values[0]),
			BillingExprOption:       fmt.Sprintf(`{%q:%q}`, modelName, values[1]),
			PluginBillingExprOption: fmt.Sprintf(`{%q:%q}`, PluginBillingExprKey(pluginKey, modelName), values[2]),
		}
	}
	observe := func() generation {
		snapshot := rawBillingSettingSnapshot()
		return generation{
			snapshot.BillingMode[modelName],
			snapshot.BillingExpr[modelName],
			snapshot.PluginBillingExpr[PluginBillingExprKey(pluginKey, modelName)],
		}
	}
	require.NoError(t, UpdateBillingSettingOptions(optionsFor(oldGeneration)))
	require.Equal(t, oldGeneration, observe(), "published initial generation")

	const readerCount = 8
	start := make(chan struct{})
	ready := make(chan struct{}, readerCount)
	stop := make(chan struct{})
	mixed := make(chan generation, 1)
	var readers sync.WaitGroup
	readers.Add(readerCount)
	for range readerCount {
		go func() {
			defer readers.Done()
			<-start
			reportedReady := false
			for {
				observed := observe()
				if !reportedReady {
					ready <- struct{}{}
					reportedReady = true
				}
				if observed != oldGeneration && observed != newGeneration {
					select {
					case mixed <- observed:
					default:
					}
					return
				}
				select {
				case <-stop:
					return
				default:
					runtime.Gosched()
				}
			}
		}()
	}
	close(start)
	timer := time.NewTimer(5 * time.Second)
	defer timer.Stop()
	for range readerCount {
		select {
		case <-ready:
		case <-timer.C:
			close(stop)
			readers.Wait()
			require.FailNow(t, "timed out waiting for generation readers")
		}
	}

	var updateErr error
	for index := range 200 {
		next := newGeneration
		if index%2 == 1 {
			next = oldGeneration
		}
		if updateErr = UpdateBillingSettingOptions(optionsFor(next)); updateErr != nil {
			break
		}
		if !assert.Equal(t, next, observe(), "published generation after update %d", index) {
			break
		}
		runtime.Gosched()
	}
	close(stop)
	readers.Wait()
	require.NoError(t, updateErr)
	select {
	case observed := <-mixed:
		t.Fatalf("observed mixed billing generation: mode=%q main=%q provider=%q", observed[0], observed[1], observed[2])
	default:
	}
}

func TestResolveTaskBillingDecisionKeepsModeAndSelectedExpressionCoherent(t *testing.T) {
	const (
		pluginKey          = "atomic-provider"
		modelName          = "atomic-task-alias"
		mappedModel        = "atomic-task-target"
		mainExpr           = `tier("main", u("image_count") * 0.01)`
		mappedExpr         = `tier("mapped", u("image_count") * 0.02)`
		providerExpr       = `tier("provider", u("image_count") * 0.03)`
		mappedProviderExpr = `tier("mapped-provider", u("image_count") * 0.04)`
	)

	previous := config.GlobalConfig.ExportAllConfigs()
	t.Cleanup(func() {
		require.NoError(t, config.GlobalConfig.LoadFromDB(previous))
	})

	transitions := []struct {
		name              string
		modes             string
		expressions       string
		pluginExpressions string
		expected          BillingDecision
	}{
		{
			name:              "ratio before publication",
			modes:             fmt.Sprintf(`{%q:%q}`, modelName, BillingModeRatio),
			expressions:       `{}`,
			pluginExpressions: `{}`,
			expected:          BillingDecision{Mode: BillingModeRatio},
		},
		{
			name:              "model tiered publication",
			modes:             fmt.Sprintf(`{%q:%q}`, modelName, BillingModeTieredExpr),
			expressions:       fmt.Sprintf(`{%q:%q}`, modelName, mainExpr),
			pluginExpressions: `{}`,
			expected:          BillingDecision{Mode: BillingModeTieredExpr, Expression: mainExpr, ExpressionExists: true},
		},
		{
			name:        "provider override ignores ratio mode",
			modes:       fmt.Sprintf(`{%q:%q}`, modelName, BillingModeRatio),
			expressions: `{}`,
			pluginExpressions: fmt.Sprintf(`{%q:%q}`,
				PluginBillingExprKey(pluginKey, modelName), providerExpr),
			expected: BillingDecision{Mode: BillingModeTieredExpr, Expression: providerExpr, ExpressionExists: true},
		},
		{
			name:  "alias provider override precedes mapped override",
			modes: fmt.Sprintf(`{%q:%q,%q:%q}`, modelName, BillingModeTieredExpr, mappedModel, BillingModeTieredExpr),
			expressions: fmt.Sprintf(`{%q:%q,%q:%q}`,
				modelName, mainExpr, mappedModel, mappedExpr),
			pluginExpressions: fmt.Sprintf(`{%q:%q,%q:%q}`,
				PluginBillingExprKey(pluginKey, modelName), providerExpr,
				PluginBillingExprKey(pluginKey, mappedModel), mappedProviderExpr),
			expected: BillingDecision{Mode: BillingModeTieredExpr, Expression: providerExpr, ExpressionExists: true},
		},
		{
			name:  "mapped provider override precedes alias main expression",
			modes: fmt.Sprintf(`{%q:%q,%q:%q}`, modelName, BillingModeTieredExpr, mappedModel, BillingModeTieredExpr),
			expressions: fmt.Sprintf(`{%q:%q,%q:%q}`,
				modelName, mainExpr, mappedModel, mappedExpr),
			pluginExpressions: fmt.Sprintf(`{%q:%q}`,
				PluginBillingExprKey(pluginKey, mappedModel), mappedProviderExpr),
			expected: BillingDecision{Mode: BillingModeTieredExpr, Expression: mappedProviderExpr, ExpressionExists: true},
		},
		{
			name:  "alias main expression precedes mapped main expression",
			modes: fmt.Sprintf(`{%q:%q,%q:%q}`, modelName, BillingModeTieredExpr, mappedModel, BillingModeTieredExpr),
			expressions: fmt.Sprintf(`{%q:%q,%q:%q}`,
				modelName, mainExpr, mappedModel, mappedExpr),
			pluginExpressions: `{}`,
			expected:          BillingDecision{Mode: BillingModeTieredExpr, Expression: mainExpr, ExpressionExists: true},
		},
		{
			name:              "tiered alias with missing expression fails closed",
			modes:             fmt.Sprintf(`{%q:%q,%q:%q}`, modelName, BillingModeTieredExpr, mappedModel, BillingModeTieredExpr),
			expressions:       fmt.Sprintf(`{%q:%q}`, mappedModel, mappedExpr),
			pluginExpressions: `{}`,
			expected:          BillingDecision{Mode: BillingModeTieredExpr},
		},
		{
			name:              "mapped provider override forces tiered mode",
			modes:             fmt.Sprintf(`{%q:%q,%q:%q}`, modelName, BillingModeRatio, mappedModel, BillingModeRatio),
			expressions:       `{}`,
			pluginExpressions: fmt.Sprintf(`{%q:%q}`, PluginBillingExprKey(pluginKey, mappedModel), mappedProviderExpr),
			expected:          BillingDecision{Mode: BillingModeTieredExpr, Expression: mappedProviderExpr, ExpressionExists: true},
		},
		{
			name:              "mapped target fallback",
			modes:             fmt.Sprintf(`{%q:%q,%q:%q}`, modelName, BillingModeRatio, mappedModel, BillingModeTieredExpr),
			expressions:       fmt.Sprintf(`{%q:%q}`, mappedModel, mappedExpr),
			pluginExpressions: `{}`,
			expected:          BillingDecision{Mode: BillingModeTieredExpr, Expression: mappedExpr, ExpressionExists: true},
		},
		{
			name:              "tiered mapped target with missing expression fails closed",
			modes:             fmt.Sprintf(`{%q:%q,%q:%q}`, modelName, BillingModeRatio, mappedModel, BillingModeTieredExpr),
			expressions:       `{}`,
			pluginExpressions: `{}`,
			expected:          BillingDecision{Mode: BillingModeTieredExpr},
		},
		{
			name:              "ratio after publication",
			modes:             fmt.Sprintf(`{%q:%q,%q:%q}`, modelName, BillingModeRatio, mappedModel, BillingModeRatio),
			expressions:       `{}`,
			pluginExpressions: `{}`,
			expected:          BillingDecision{Mode: BillingModeRatio},
		},
	}
	for _, transition := range transitions {
		t.Run(transition.name, func(t *testing.T) {
			require.NoError(t, UpdateBillingSettingOptions(map[string]string{
				BillingModeOption:       transition.modes,
				BillingExprOption:       transition.expressions,
				PluginBillingExprOption: transition.pluginExpressions,
			}))

			assert.Equal(t, transition.expected, ResolveTaskBillingDecision(pluginKey, modelName, mappedModel))
		})
	}
}

func TestSmokeTestTaskExprValidatesDeclaredUsageVectors(t *testing.T) {
	videoSchema := map[string]jsplugin.UsageFieldSchema{
		"seconds": {Type: "number", Unit: "second"},
		"mode":    {Enum: []string{"std", "pro"}},
		"quality": {Enum: []string{"sd", "hd"}},
	}

	tests := []struct {
		name          string
		schema        map[string]jsplugin.UsageFieldSchema
		expression    string
		expectedError string
	}{
		{
			name:          "fixed prices are not task usage prices",
			schema:        videoSchema,
			expression:    `true ? tier("normal", u("seconds") * 0.4) : tier("fixed", fixed(0.01))`,
			expectedError: "fixed pricing is not supported for task usage expressions",
		},
		{
			name:       "declared numeric and enum facts",
			schema:     videoSchema,
			expression: `u("mode") == "pro" ? tier("pro", u("seconds") * 0.8) : tier("std", u("seconds") * 0.4)`,
		},
		{
			name:          "undeclared literal key",
			schema:        videoSchema,
			expression:    `tier("base", u("clips") * 0.1)`,
			expectedError: `usage key "clips" is not declared`,
		},
		{
			name:          "negative duration boundary",
			schema:        videoSchema,
			expression:    fmt.Sprintf(`u("seconds") == %d ? -1 : 0`, relaycommon.MaxTaskDurationSeconds),
			expectedError: "result must be finite and non-negative",
		},
		{
			name:          "negative count boundary",
			schema:        map[string]jsplugin.UsageFieldSchema{"clips": {Type: "number", Unit: "count"}},
			expression:    fmt.Sprintf(`u("clips") == %d ? -1 : 0`, dto.MaxImageN),
			expectedError: "result must be finite and non-negative",
		},
		{
			name:          "negative token boundary",
			schema:        map[string]jsplugin.UsageFieldSchema{"tokens": {Type: "number", Unit: "token"}},
			expression:    fmt.Sprintf(`u("tokens") == %d ? -1 : 0`, common.MaxQuota),
			expectedError: "result must be finite and non-negative",
		},
		{
			name:          "negative credit boundary",
			schema:        map[string]jsplugin.UsageFieldSchema{"units": {Type: "number", Unit: "credit"}},
			expression:    fmt.Sprintf(`u("units") == %d ? -1 : 0`, common.MaxQuota),
			expectedError: "result must be finite and non-negative",
		},
		{
			name:          "negative enum combination",
			schema:        videoSchema,
			expression:    `u("mode") == "pro" && u("quality") == "hd" ? -1 : 0`,
			expectedError: "result must be finite and non-negative",
		},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			err := SmokeTestTaskExpr(testCase.expression, testCase.schema)
			if testCase.expectedError == "" {
				require.NoError(t, err)
				return
			}
			require.ErrorContains(t, err, testCase.expectedError)
		})
	}
}

func TestSmokeTestTaskExprCapsOversizedEnumProductsAtLastCombination(t *testing.T) {
	schema := make(map[string]jsplugin.UsageFieldSchema, 7)
	condition := ""
	for index := range 7 {
		schema[fmt.Sprintf("enum_%d", index)] = jsplugin.UsageFieldSchema{Enum: []string{"first", "middle", "last"}}
		if condition != "" {
			condition += " && "
		}
		condition += fmt.Sprintf(`u("enum_%d") == "last"`, index)
	}

	err := SmokeTestTaskExpr(condition+" ? -1 : 0", schema)
	require.ErrorContains(t, err, "result must be finite and non-negative")
}

func TestSmokeTestExprRejectsTaskUsageWithoutSchema(t *testing.T) {
	err := SmokeTestExpr(`u("mode") == "std" ? 1 : 2`)
	require.Error(t, err)
	assert.ErrorContains(t, err, "mode")
	assert.ErrorContains(t, err, "no task plugin usage schema")

	require.NoError(t, SmokeTestExpr(`tier("base", p * 2 + c * 8)`))
}
