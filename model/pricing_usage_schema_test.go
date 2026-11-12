package model

import (
	"fmt"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func pricingUsagePluginSource(version, usageSchema string) string {
	return fmt.Sprintf(`
export const meta = {
  apiVersion: 1, key: "pricing-usage-probe", name: "Pricing Usage Probe", version: %q, author: {name: "Test"},
  models: ["pricing-usage-model"], fetchMode: "per_task", usageSchema: %s
};
export function buildSubmitRequest() { return {}; }
export function parseSubmitResponse() { return {}; }
export function buildQueryRequest() { return {}; }
export function parseTaskResult() { return {}; }
`, version, usageSchema)
}

func TestPricingCarriesTaskUsageSchemaAndRefreshesWithPluginGeneration(t *testing.T) {
	resetPricingEndpointTestTables(t)
	const pluginKey = "pricing-usage-probe"
	initialSource := pricingUsagePluginSource("1.0.0", `{
  seconds: {type: "number", unit: "second", description: "Estimated duration."},
  action: {enum:["video"],enumLabels:{video:{en:"Generate video",zh:"生成视频"}}}
}`)
	_, err := jsplugin.DefaultRegistry.Register(initialSource, jsplugin.Options{})
	require.NoError(t, err)
	t.Cleanup(func() { jsplugin.DefaultRegistry.Unregister(pluginKey) })

	insertPricingEndpointChannel(t, 901, constant.ChannelTypeTaskPlugin, dto.ChannelOtherSettings{})
	insertPricingEndpointAbility(t, 901, "pricing-usage-model")
	insertPricingEndpointAbility(t, 901, "ordinary-model")

	initialPricing := pricingByModel(GetPricing())
	require.Contains(t, initialPricing, "pricing-usage-model")
	require.Contains(t, initialPricing, "ordinary-model")
	assert.Equal(t, "second", initialPricing["pricing-usage-model"].BillingUsageSchema["seconds"].Unit)
	assert.Equal(t, "Estimated duration.", initialPricing["pricing-usage-model"].BillingUsageSchema["seconds"].Description["en"])
	assert.Equal(t, "生成视频", initialPricing["pricing-usage-model"].BillingUsageSchema["action"].EnumLabels["video"]["zh"])
	assert.Nil(t, initialPricing["ordinary-model"].BillingUsageSchema)

	updatedSource := pricingUsagePluginSource("1.1.0", `{
  seconds: {type: "number", unit: "second", description: "Measured duration."},
  clips: {type: "number", unit: "count", description: "Generated clip count."}
}`)
	_, err = jsplugin.DefaultRegistry.Register(updatedSource, jsplugin.Options{})
	require.NoError(t, err)
	lastGetPricingTime = time.Now().Add(-2 * time.Minute)

	refreshedPricing := pricingByModel(GetPricing())
	require.Len(t, refreshedPricing["pricing-usage-model"].BillingUsageSchema, 2)
	assert.Equal(t, "Measured duration.", refreshedPricing["pricing-usage-model"].BillingUsageSchema["seconds"].Description["en"])
	assert.Equal(t, "count", refreshedPricing["pricing-usage-model"].BillingUsageSchema["clips"].Unit)
}

func TestPricingAliasCarriesPluginUsageSchemaAndTailExpr(t *testing.T) {
	resetPricingEndpointTestTables(t)
	const pluginKey = "pricing-usage-probe"
	source := pricingUsagePluginSource("1.0.0", `{
  seconds: {type: "number", unit: "second", description: "Estimated duration."}
}`)
	_, err := jsplugin.DefaultRegistry.Register(source, jsplugin.Options{})
	require.NoError(t, err)
	t.Cleanup(func() { jsplugin.DefaultRegistry.Unregister(pluginKey) })

	mapping := `{"alias-model":"pricing-usage-model"}`
	channel := &Channel{
		Id:           910,
		Type:         constant.ChannelTypeTaskPlugin,
		Key:          "key-910",
		Status:       1,
		Name:         "channel-910",
		Models:       "alias-model,pricing-usage-model",
		ModelMapping: &mapping,
	}
	require.NoError(t, DB.Create(channel).Error)
	insertPricingEndpointAbility(t, 910, "alias-model")
	insertPricingEndpointAbility(t, 910, "pricing-usage-model")
	InitChannelCache()

	saved := map[string]string{}
	require.NoError(t, config.GlobalConfig.SaveToDB(func(key, value string) error {
		saved[key] = value
		return nil
	}))
	t.Cleanup(func() {
		require.NoError(t, config.GlobalConfig.LoadFromDB(saved))
	})
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"billing_setting.billing_mode": `{"pricing-usage-model":"tiered_expr","alias-own-expr":"tiered_expr"}`,
		"billing_setting.billing_expr": `{"pricing-usage-model":"u(\"seconds\")","alias-own-expr":"u(\"seconds\") * 2"}`,
	}))
	InvalidatePricingCache()

	pricing := pricingByModel(GetPricing())
	require.Contains(t, pricing, "alias-model")
	require.Contains(t, pricing, "pricing-usage-model")
	assert.Equal(t, "second", pricing["alias-model"].BillingUsageSchema["seconds"].Unit)
	assert.Equal(t, "Estimated duration.", pricing["alias-model"].BillingUsageSchema["seconds"].Description["en"])
	assert.Equal(t, "tiered_expr", pricing["alias-model"].BillingMode)
	assert.Equal(t, `u("seconds")`, pricing["alias-model"].BillingExpr)
	assert.Equal(t, "tiered_expr", pricing["pricing-usage-model"].BillingMode)
	assert.Equal(t, `u("seconds")`, pricing["pricing-usage-model"].BillingExpr)

	ownMapping := `{"alias-own-expr":"pricing-usage-model"}`
	own := &Channel{
		Id:           911,
		Type:         constant.ChannelTypeTaskPlugin,
		Key:          "key-911",
		Status:       1,
		Name:         "channel-911",
		Models:       "alias-own-expr,pricing-usage-model",
		ModelMapping: &ownMapping,
	}
	require.NoError(t, DB.Create(own).Error)
	insertPricingEndpointAbility(t, 911, "alias-own-expr")
	InitChannelCache()
	InvalidatePricingCache()

	refreshed := pricingByModel(GetPricing())
	assert.Equal(t, `u("seconds") * 2`, refreshed["alias-own-expr"].BillingExpr)
	assert.Equal(t, "second", refreshed["alias-own-expr"].BillingUsageSchema["seconds"].Unit)
}

func pricingByModel(pricings []Pricing) map[string]Pricing {
	result := make(map[string]Pricing, len(pricings))
	for _, pricing := range pricings {
		result[pricing.ModelName] = pricing
	}
	return result
}

func TestPricingUsageProfilesAndAliases(t *testing.T) {
	resetPricingEndpointTestTables(t)
	require.NoError(t, DB.AutoMigrate(&Option{}))
	const key = "pricing-profiles"
	const source = `
export const meta = {
 apiVersion:1,key:"pricing-profiles",name:"Pricing Profiles",version:"1.0.0",author:{name:"Test"},
 models:["profile-image","profile-video"],fetchMode:"per_task",
 usageSchema:{fallback:{type:"number",unit:"count"}},
 usageExamples:[{label:"default",facts:{fallback:1}}],
 usageProfiles:[
  {models:["profile-image"],schema:{image_count:{type:"number",unit:"count"}}},
  {models:["profile-video"],schema:{seconds:{type:"number",unit:"second"}},examples:[{label:"5 seconds",facts:{seconds:5}}]}
 ]
};
export function buildSubmitRequest(){return {};}
export function parseSubmitResponse(){return {};}
export function buildQueryRequest(){return {};}
export function parseTaskResult(){return {};}
`
	_, err := jsplugin.DefaultRegistry.Register(source, jsplugin.Options{})
	require.NoError(t, err)
	t.Cleanup(func() { jsplugin.DefaultRegistry.Unregister(key) })
	for index, mapping := range []string{
		`{"image-alias":"profile-image","video-alias":"profile-video","ambiguous-alias":"profile-image"}`,
		`{"ambiguous-alias":"profile-video"}`,
	} {
		id := 920 + index
		require.NoError(t, DB.Create(&Channel{
			Id: id, Type: constant.ChannelTypeTaskPlugin, Status: 1, Name: fmt.Sprintf("channel-%d", id),
			Models: "profile-image,profile-video,image-alias,video-alias,ambiguous-alias", ModelMapping: &mapping,
		}).Error)
		for _, name := range []string{"profile-image", "profile-video", "image-alias", "video-alias", "ambiguous-alias"} {
			insertPricingEndpointAbility(t, id, name)
		}
	}
	InitChannelCache()
	pricing := pricingByModel(GetPricing())
	names := []string{"profile-image", "profile-video", "image-alias", "video-alias", "ambiguous-alias"}
	snapshot, err := GetModelPricingSnapshot(names)
	require.NoError(t, err)
	entries := make(map[string]ModelPricingEntry, len(snapshot.Entries))
	for _, entry := range snapshot.Entries {
		entries[entry.ModelName] = entry
	}
	for _, tc := range []struct {
		name, field, unit string
		wantExamples      int
	}{
		{"profile-image", "image_count", "count", 0},
		{"profile-video", "seconds", "second", 1},
		{"image-alias", "image_count", "count", 0},
		{"video-alias", "seconds", "second", 1},
		{"ambiguous-alias", "fallback", "count", 1},
	} {
		t.Run(tc.name, func(t *testing.T) {
			expected := map[string]jsplugin.UsageFieldSchema{tc.field: {Type: "number", Unit: tc.unit}}
			assert.Equal(t, expected, pricing[tc.name].BillingUsageSchema)
			assert.Equal(t, expected, entries[tc.name].UsageSchema)
			assert.Len(t, pricing[tc.name].BillingUsageExamples, tc.wantExamples)
			require.NoError(t, ValidateModelPricing(tc.name, PricingValues{"billing_setting.billing_expr": `u("` + tc.field + `")`}))
			require.ErrorContains(t, ValidateModelPricing(tc.name, PricingValues{"billing_setting.billing_expr": `u("missing")`}), "not declared")
		})
	}
	require.ErrorContains(t, ValidateModelPricing("profile-image", PricingValues{"billing_setting.billing_expr": `u("seconds")`}), "not declared")
	require.ErrorContains(t, ValidateModelPricing("video-alias", PricingValues{"billing_setting.billing_expr": `u("image_count")`}), "not declared")

	saved := config.GlobalConfig.ExportAllConfigs()
	t.Cleanup(func() { require.NoError(t, config.GlobalConfig.LoadFromDB(saved)) })
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"billing_setting.billing_expr":          `{"profile-image":"u(\"image_count\")"}`,
		billing_setting.PluginBillingExprOption: `{"pricing-profiles::profile-image":"u(\"image_count\") * 2"}`,
	}))
	updated := strings.Replace(source, `version:"1.0.0"`, `version:"1.1.0"`, 1)
	updated = strings.Replace(updated, `image_count:{type:"number",unit:"count"}`, `images:{type:"number",unit:"count"}`, 1)
	_, err = jsplugin.DefaultRegistry.Register(updated, jsplugin.Options{})
	require.NoError(t, err)
	// Stored prices that read a fact the narrowed profile dropped stay saveable
	// while unchanged; edited ones must follow the new profile.
	stored := PricingValues{"billing_setting.billing_expr": `u("image_count")`, billing_setting.PluginBillingExprOption: map[string]any{key: `u("image_count") * 2`}}
	require.NoError(t, ValidateModelPricing("profile-image", stored))
	require.ErrorContains(t, ValidateModelPricing("profile-image", PricingValues{"billing_setting.billing_expr": `u("image_count") * 3`}), "not declared")
	stored[billing_setting.PluginBillingExprOption] = map[string]any{key: `u("image_count") * 3`}
	require.ErrorContains(t, ValidateModelPricing("profile-image", stored), "not declared")
	InvalidatePricingCache()
	refreshed := pricingByModel(GetPricing())
	assert.Equal(t, map[string]jsplugin.UsageFieldSchema{"images": {Type: "number", Unit: "count"}}, refreshed["image-alias"].BillingUsageSchema)
	assert.Equal(t, "second", refreshed["profile-video"].BillingUsageSchema["seconds"].Unit)
}

func TestPricingSharedPluginVariantsUseEachSchemaAndExpression(t *testing.T) {
	resetPricingEndpointTestTables(t)
	saved := config.GlobalConfig.ExportAllConfigs()
	t.Cleanup(func() { require.NoError(t, config.GlobalConfig.LoadFromDB(saved)) })
	for _, spec := range []struct{ key, field, unit string }{{"pricing-alpha", "seconds", "second"}, {"pricing-beta", "credits", "credit"}} {
		source := strings.ReplaceAll(pricingUsagePluginSource("1.0.0", `{`+spec.field+`:{type:"number",unit:"`+spec.unit+`"}}`), "pricing-usage-probe", spec.key)
		_, err := jsplugin.DefaultRegistry.Register(source, jsplugin.Options{})
		require.NoError(t, err)
		t.Cleanup(func() { jsplugin.DefaultRegistry.Unregister(spec.key) })
	}
	insertPricingEndpointChannel(t, 930, constant.ChannelTypeTaskPlugin, dto.ChannelOtherSettings{})
	insertPricingEndpointAbility(t, 930, "pricing-usage-model")
	const expression = `tier("base", u("seconds") * 0.4)`
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"billing_setting.billing_mode":          `{"pricing-usage-model":"tiered_expr"}`,
		"billing_setting.billing_expr":          `{"pricing-usage-model":"tier(\"base\", u(\"seconds\") * 0.4)"}`,
		billing_setting.PluginBillingExprOption: `{}`,
	}))
	prices := pricingByModel(GetPricing())
	variants := prices["pricing-usage-model"].BillingPluginVariants
	require.Len(t, variants, 2)
	assert.Equal(t, "pricing-alpha", variants[0].PluginKey)
	assert.Equal(t, "pricing-beta", variants[1].PluginKey)
	assert.Equal(t, expression, variants[0].BillingExpr)
	assert.Empty(t, variants[1].BillingExpr)
	assert.Equal(t, "credit", variants[1].BillingUsageSchema["credits"].Unit)
	assert.Equal(t, expression, prices["pricing-usage-model"].BillingExpr)
	assert.Contains(t, prices["pricing-usage-model"].BillingUsageSchema, "seconds")
	draft := PricingValues{"billing_setting.billing_expr": expression}
	require.ErrorContains(t, ValidateModelPricing("pricing-usage-model", draft), "plugin pricing-beta")
	draft[billing_setting.PluginBillingExprOption] = map[string]any{"pricing-beta": `tier("beta", u("credits") * 2)`}
	require.NoError(t, ValidateModelPricing("pricing-usage-model", draft))
	for _, invalid := range []any{map[string]any{"missing": "1"}, map[string]any{"pricing-beta": float64(1)}, map[string]any{"pricing-beta": `u("seconds")`}, map[string]any(nil), []any{}, "invalid"} {
		draft[billing_setting.PluginBillingExprOption] = invalid
		assert.Error(t, ValidateModelPricing("pricing-usage-model", draft))
	}
	draft = PricingValues{
		"billing_setting.billing_expr":          "invalid expression(",
		billing_setting.PluginBillingExprOption: map[string]any{"pricing-alpha": expression, "pricing-beta": `u("credits")`},
	}
	require.ErrorContains(t, ValidateModelPricing("pricing-usage-model", draft), "compile")
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		billing_setting.PluginBillingExprOption: `{"pricing-beta::pricing-usage-model":"tier(\"beta\", u(\"credits\") * 2)"}`,
	}))
	InvalidatePricingCache()
	priced := pricingByModel(GetPricing())["pricing-usage-model"].BillingPluginVariants
	require.Len(t, priced, 2)
	assert.Equal(t, `tier("beta", u("credits") * 2)`, priced[1].BillingExpr)
	previousPrice := ratio_setting.ModelPrice2JSONString()
	t.Cleanup(func() { require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(previousPrice)) })
	require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(`{"pricing-usage-model":0.25}`))
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{"billing_setting.billing_mode": `{"pricing-usage-model":"ratio"}`}))
	InvalidatePricingCache()
	mixed := pricingByModel(GetPricing())["pricing-usage-model"].BillingPluginVariants
	require.Len(t, mixed, 2)
	assert.Equal(t, billing_setting.BillingModeRatio, mixed[0].BillingMode)
	assert.Equal(t, billing_setting.BillingModeTieredExpr, mixed[1].BillingMode)
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{billing_setting.PluginBillingExprOption: `{}`}))
	InvalidatePricingCache()
	perCall := pricingByModel(GetPricing())["pricing-usage-model"]
	assert.Empty(t, perCall.BillingPluginVariants)
	assert.Equal(t, 1, perCall.QuotaType)
	assert.Equal(t, 0.25, perCall.ModelPrice)
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		billing_setting.PluginBillingExprOption: `{"pricing-beta::pricing-usage-model":"tier(\"beta\", u(\"credits\") * 2)"}`,
	}))
	require.NoError(t, jsplugin.DefaultRegistry.Unregister("pricing-alpha"))
	InvalidatePricingCache()
	single := pricingByModel(GetPricing())["pricing-usage-model"]
	require.Len(t, single.BillingPluginVariants, 1)
	assert.Equal(t, "pricing-beta", single.BillingPluginVariants[0].PluginKey)
	assert.Equal(t, `tier("beta", u("credits") * 2)`, single.BillingPluginVariants[0].BillingExpr)
	encoded, err := common.Marshal(single)
	require.NoError(t, err)
	assert.Contains(t, string(encoded), "billing_plugin_variants")
}

// A model-level price that is only a chat price leaves plugin tasks unpriced:
// an expression reading chat request quantities (token counts, bare
// image_count) for any task model, and for a model the plugin also relays, a
// token ratio or an expression without u(). Pricing shows those providers as
// unconfigured while the chat price stays saveable, and shows the model-level
// price beside them while ordinary requests still pay it.
func TestPluginTaskPricesBesideAChatPrice(t *testing.T) {
	resetPricingEndpointTestTables(t)
	require.NoError(t, DB.AutoMigrate(&Option{}))
	saved := config.GlobalConfig.ExportAllConfigs()
	savedPrices, savedRatios := ratio_setting.ModelPrice2JSONString(), ratio_setting.ModelRatio2JSONString()
	t.Cleanup(func() {
		require.NoError(t, DB.Where(commonKeyCol+" IN ?", modelPricingOptionKeys).Delete(&Option{}).Error)
		require.NoError(t, config.GlobalConfig.LoadFromDB(saved))
		require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(savedPrices))
		require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(savedRatios))
	})
	const tokenExpr = `tier("tokens", p * 2 + c * 8)`
	const usageExpr = `tier("seconds", u("seconds") * 0.3)`
	const seconds = `{seconds:{type:"number",unit:"second"}}`
	for key, models := range map[string]string{
		"pricing-dual": `["dual-ratio","dual-per-call","dual-tokens","dual-usage","dual-split"], relay: [{incoming_path: "/v1/chat/completions", upstream_path: "/v1/chat/completions"}]`,
		"pricing-task": `["task-tokens","task-images","task-flat"], channelTypes: [9400]`,
	} {
		source := strings.ReplaceAll(pricingUsagePluginSource("1.0.0", seconds), "pricing-usage-probe", key)
		_, err := jsplugin.DefaultRegistry.Register(strings.Replace(source, `["pricing-usage-model"]`, models, 1), jsplugin.Options{})
		require.NoError(t, err)
		t.Cleanup(func() { jsplugin.DefaultRegistry.Unregister(key) })
	}
	insertPricingEndpointChannel(t, 940, constant.ChannelTypeTaskPlugin, dto.ChannelOtherSettings{})
	// A legacy channel type pricing-task claims, and an ordinary channel.
	insertPricingEndpointChannel(t, 941, 9400, dto.ChannelOtherSettings{})
	insertPricingEndpointChannel(t, 942, constant.ChannelTypeOpenAI, dto.ChannelOtherSettings{})
	options := map[string]string{
		"ModelPrice":                            `{"dual-per-call":0.04}`,
		"ModelRatio":                            `{"dual-ratio":10}`,
		"billing_setting.billing_mode":          `{"dual-tokens":"tiered_expr","dual-usage":"tiered_expr","dual-split":"tiered_expr","task-tokens":"tiered_expr","task-images":"tiered_expr","task-flat":"tiered_expr"}`,
		"billing_setting.billing_expr":          `{"dual-tokens":"tier(\"tokens\", p * 2 + c * 8)","dual-usage":"tier(\"seconds\", u(\"seconds\") * 0.3)","dual-split":"tier(\"tokens\", p * 2 + c * 8)","task-tokens":"tier(\"tokens\", p * 2 + c * 8)","task-images":"tier(\"images\", image_count * 0.04)","task-flat":"tier(\"flat\", 0.04)"}`,
		billing_setting.PluginBillingExprOption: `{"pricing-dual::dual-split":"tier(\"seconds\", u(\"seconds\") * 0.3)"}`,
	}
	for key, value := range options {
		require.NoError(t, DB.Save(&Option{Key: key, Value: value}).Error)
	}
	require.NoError(t, config.GlobalConfig.LoadFromDB(options))
	require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(options["ModelPrice"]))
	require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(options["ModelRatio"]))

	tests := []struct {
		model, plugin string
		// variantMode is empty when public pricing lists no provider.
		variantMode, variantExpr string
		compatible, relay        bool
		issue                    string
		// channels serving the model besides the task plugin channel.
		channels []int
		// ordinary: public pricing shows the model-level price beside the
		// variants.
		ordinary bool
	}{
		{model: "dual-ratio", plugin: "pricing-dual", variantMode: billing_setting.BillingModeTieredExpr, relay: true, issue: ModelPricingIssueUnconfigured, ordinary: true},
		{model: "dual-per-call", plugin: "pricing-dual", variantMode: billing_setting.BillingModeRatio, relay: true, ordinary: true},
		{model: "dual-tokens", plugin: "pricing-dual", variantMode: billing_setting.BillingModeTieredExpr, relay: true, issue: ModelPricingIssueUnconfigured, ordinary: true},
		// Ordinary requests reject a usage expression.
		{model: "dual-usage", plugin: "pricing-dual", variantMode: billing_setting.BillingModeTieredExpr, variantExpr: usageExpr, compatible: true, relay: true, channels: []int{942}},
		{model: "dual-split", plugin: "pricing-dual", variantMode: billing_setting.BillingModeTieredExpr, variantExpr: usageExpr, compatible: true, relay: true, ordinary: true},
		{model: "task-tokens", plugin: "pricing-task", variantMode: billing_setting.BillingModeTieredExpr, issue: ModelPricingIssueUnconfigured, channels: []int{941}},
		{model: "task-images", plugin: "pricing-task", variantMode: billing_setting.BillingModeTieredExpr, issue: ModelPricingIssueUnconfigured, channels: []int{942}, ordinary: true},
		{model: "task-flat", plugin: "pricing-task", compatible: true},
	}
	for _, tc := range tests {
		for _, channelID := range append([]int{940}, tc.channels...) {
			insertPricingEndpointAbility(t, channelID, tc.model)
		}
	}
	// Issues cover only the models an enabled channel serves.
	issues := map[string]string{}
	for _, key := range []string{"pricing-dual", "pricing-task"} {
		found, err := GetModelPricingIssues(key)
		require.NoError(t, err)
		for _, issue := range found {
			issues[issue.ModelName] = issue.Reason
		}
	}
	InvalidatePricingCache()
	prices := pricingByModel(GetPricing())
	snapshot, err := GetModelPricingSnapshot([]string{"dual-ratio", "dual-per-call", "dual-tokens", "dual-usage", "dual-split", "task-tokens", "task-images", "task-flat"})
	require.NoError(t, err)
	for _, tc := range tests {
		t.Run(tc.model, func(t *testing.T) {
			require.Contains(t, prices, tc.model)
			variants := prices[tc.model].BillingPluginVariants
			if tc.variantMode == "" {
				assert.Empty(t, variants)
			} else {
				require.Len(t, variants, 1)
				assert.Equal(t, tc.plugin, variants[0].PluginKey)
				assert.Equal(t, tc.variantMode, variants[0].BillingMode)
				assert.Equal(t, tc.variantExpr, variants[0].BillingExpr)
			}
			assert.Equal(t, tc.ordinary, prices[tc.model].OrdinaryPricing)
			index := slices.IndexFunc(snapshot.Entries, func(entry ModelPricingEntry) bool { return entry.ModelName == tc.model })
			require.GreaterOrEqual(t, index, 0)
			entry := snapshot.Entries[index]
			require.Len(t, entry.PluginVariants, 1)
			assert.Equal(t, tc.compatible, entry.PluginVariants[0].Compatible)
			assert.Equal(t, tc.relay, entry.PluginVariants[0].Relay)
			assert.Equal(t, tc.issue, issues[tc.model])
		})
	}

	for _, tc := range []struct {
		name, model string
		pricing     PricingValues
		wantErr     string
	}{
		{name: "plugin price reading token counts", model: "dual-split", pricing: PricingValues{billing_setting.PluginBillingExprOption: map[string]any{"pricing-dual": `tier("tokens", p * 3)`}}, wantErr: "cannot read chat request quantities"},
		{name: "plugin price reading image count", model: "task-images", pricing: PricingValues{billing_setting.PluginBillingExprOption: map[string]any{"pricing-task": `tier("images", image_count * 0.05)`}}, wantErr: "cannot read chat request quantities"},
		{name: "chat token price of a relayed model", model: "dual-tokens", pricing: PricingValues{"billing_setting.billing_expr": `tier("tokens", p * 3 + c * 9)`}},
		{name: "chat constant price of a relayed model", model: "dual-tokens", pricing: PricingValues{"billing_setting.billing_expr": `tier("flat", 0.05)`}},
		{name: "usage price of a relayed model is a task price", model: "dual-usage", pricing: PricingValues{"billing_setting.billing_expr": `tier("credits", u("credits") * 2)`}, wantErr: `usage key "credits" is not declared`},
		{name: "token price of a task model", model: "task-tokens", pricing: PricingValues{"billing_setting.billing_expr": `tier("tokens", p * 3)`}},
		{name: "image count price of a task model", model: "task-images", pricing: PricingValues{"billing_setting.billing_expr": `tier("images", image_count * 0.05)`}},
		{name: "usage facts mixed with token counts", model: "task-tokens", pricing: PricingValues{"billing_setting.billing_expr": `tier("mixed", u("seconds") * 0.3 + p * 2)`}, wantErr: "cannot read both"},
		{name: "usage facts mixed with image count", model: "task-images", pricing: PricingValues{"billing_setting.billing_expr": `tier("mixed", u("seconds") * 0.3 * image_count)`}, wantErr: "cannot read both"},
	} {
		t.Run("save "+tc.name, func(t *testing.T) {
			err := ValidateModelPricing(tc.model, tc.pricing)
			if tc.wantErr == "" {
				require.NoError(t, err)
				return
			}
			require.ErrorContains(t, err, tc.wantErr)
		})
	}
}

// Prices saved while a plugin fit stop fitting when it changes: a dropped model
// leaves its provider price stale, and a new provider without the usage the
// model expression reads cannot charge it. Unpriced models are listed too,
// including those whose only expression prices ordinary channels. Only stale
// prices count for a model no enabled channel serves under any spelling.
func TestModelPricingIssuesFollowPluginChanges(t *testing.T) {
	resetPricingEndpointTestTables(t)
	require.NoError(t, DB.AutoMigrate(&Option{}))
	saved := config.GlobalConfig.ExportAllConfigs()
	t.Cleanup(func() {
		require.NoError(t, DB.Where(commonKeyCol+" IN ?", modelPricingOptionKeys).Delete(&Option{}).Error)
		require.NoError(t, config.GlobalConfig.LoadFromDB(saved))
	})
	pluginSource := func(key, name, version, models, usageSchema string) string {
		source := strings.ReplaceAll(pricingUsagePluginSource(version, usageSchema), "pricing-usage-probe", key)
		source = strings.Replace(source, "Pricing Usage Probe", name, 1)
		return strings.Replace(source, `["pricing-usage-model"]`, models, 1)
	}
	savePricing := func(options map[string]string) {
		for key, value := range options {
			require.NoError(t, DB.Save(&Option{Key: key, Value: value}).Error)
		}
		require.NoError(t, config.GlobalConfig.LoadFromDB(options))
	}
	const seconds = `{seconds:{type:"number",unit:"second"}}`
	_, err := jsplugin.DefaultRegistry.Register(pluginSource("issue-alpha", "Alpha", "1.0.0", `["issue-priced","issue-per-call","issue-unpriced","issue-ordinary","issue-shared","issue-dropped","issue-idle"]`, seconds), jsplugin.Options{})
	require.NoError(t, err)
	t.Cleanup(func() { jsplugin.DefaultRegistry.Unregister("issue-alpha") })
	savePricing(map[string]string{
		"ModelPrice":                            `{"issue-per-call":0.3}`,
		"billing_setting.billing_mode":          `{"issue-priced":"tiered_expr","issue-ordinary":"tiered_expr","issue-shared":"tiered_expr"}`,
		"billing_setting.billing_expr":          `{"issue-priced":"u(\"seconds\") * 0.1","issue-ordinary":"tier(\"image\", fixed(0.02)) * image_count","issue-shared":"u(\"seconds\") * 0.2"}`,
		billing_setting.PluginBillingExprOption: `{"issue-alpha::issue-dropped":"u(\"seconds\") * 0.5"}`,
	})
	unpriced := ModelPricingIssue{ModelName: "issue-unpriced", PluginKey: "issue-alpha", PluginName: "Alpha", Reason: ModelPricingIssueUnconfigured}
	ordinary := ModelPricingIssue{ModelName: "issue-ordinary", PluginKey: "issue-alpha", PluginName: "Alpha", Reason: ModelPricingIssueUnconfigured}
	// Other tests leave their plugins in the shared registry.
	ownIssues := func() []ModelPricingIssue {
		issues, err := GetModelPricingIssues("")
		require.NoError(t, err)
		return slices.DeleteFunc(issues, func(issue ModelPricingIssue) bool { return !strings.HasPrefix(issue.PluginKey, "issue-") })
	}

	assert.Empty(t, ownIssues(), "no channel serves the models yet")

	// Channels serve declared models under their own spelling, a case variant
	// or a channel alias; a disabled ability serves nothing.
	mapping := `{"ordinary-alias":"issue-ordinary"}`
	require.NoError(t, DB.Create(&Channel{
		Id: 940, Type: constant.ChannelTypeTaskPlugin, Key: "key-940", Status: common.ChannelStatusEnabled, Name: "channel-940",
		Models: "ordinary-alias", ModelMapping: &mapping,
	}).Error)
	for _, name := range []string{"issue-priced", "issue-per-call", "Issue-Unpriced", "ordinary-alias", "issue-shared"} {
		insertPricingEndpointAbility(t, 940, name)
	}
	require.NoError(t, DB.Create(&Ability{Group: "default", Model: "issue-idle", ChannelId: 940, Enabled: false}).Error)
	InitChannelCache()

	assert.Equal(t, []ModelPricingIssue{ordinary, unpriced}, ownIssues())

	// Beta also declares the dropped model, which no channel serves: its
	// unpriced variant is not an issue, while Alpha's stale price still is.
	_, err = jsplugin.DefaultRegistry.Register(pluginSource("issue-alpha", "Alpha", "1.1.0", `["issue-priced","issue-per-call","issue-unpriced","issue-ordinary","issue-shared","issue-idle"]`, seconds), jsplugin.Options{})
	require.NoError(t, err)
	_, err = jsplugin.DefaultRegistry.Register(pluginSource("issue-beta", "Beta", "1.0.0", `["issue-shared","issue-dropped"]`, `{credits:{type:"number",unit:"credit"}}`), jsplugin.Options{})
	require.NoError(t, err)
	t.Cleanup(func() { jsplugin.DefaultRegistry.Unregister("issue-beta") })
	incompatible := ModelPricingIssue{ModelName: "issue-shared", PluginKey: "issue-beta", PluginName: "Beta", Reason: ModelPricingIssueIncompatible}

	assert.Equal(t, []ModelPricingIssue{
		{ModelName: "issue-dropped", PluginKey: "issue-alpha", PluginName: "Alpha", Reason: ModelPricingIssueStale},
		ordinary,
		incompatible,
		unpriced,
	}, ownIssues())
	issues, err := GetModelPricingIssues("issue-beta")
	require.NoError(t, err)
	assert.Equal(t, []ModelPricingIssue{incompatible}, issues)

	// A provider price that reads the provider's own usage replaces the model
	// expression for that provider only.
	savePricing(map[string]string{
		billing_setting.PluginBillingExprOption: `{"issue-alpha::issue-dropped":"u(\"seconds\") * 0.5","issue-beta::issue-shared":"u(\"credits\") * 2"}`,
	})
	issues, err = GetModelPricingIssues("issue-beta")
	require.NoError(t, err)
	assert.Empty(t, issues)
}

// The full snapshot lists a built-in price, with its expression as the editor
// default, once the price is saved or an enabled channel serves the model. A
// request for named models keeps every built-in default.
func TestModelPricingSnapshotListsUsedBuiltinPrices(t *testing.T) {
	resetPricingEndpointTestTables(t)
	require.NoError(t, DB.AutoMigrate(&Option{}))
	clearPricing := func() {
		require.NoError(t, DB.Where(commonKeyCol+" IN ?", modelPricingOptionKeys).Delete(&Option{}).Error)
	}
	clearPricing()
	t.Cleanup(clearPricing)
	require.NoError(t, DB.Create(&Option{Key: "billing_setting.billing_mode", Value: `{"deepseek-v4-pro":"tiered_expr"}`}).Error)
	insertPricingEndpointAbility(t, 950, "gpt-image-2")
	require.NoError(t, DB.Create(&Ability{Group: "default", Model: "gpt-image-2.5-flare", ChannelId: 950, Enabled: false}).Error)

	full, err := GetModelPricingSnapshot(nil)
	require.NoError(t, err)
	listed := make(map[string]bool, len(full.Entries))
	for _, entry := range full.Entries {
		listed[entry.ModelName] = true
	}
	var modes, expressions, namedExpressions map[string]string
	require.NoError(t, common.UnmarshalJsonStr(full.Options["billing_setting.billing_mode"], &modes))
	require.NoError(t, common.UnmarshalJsonStr(full.Options["billing_setting.billing_expr"], &expressions))
	named, err := GetModelPricingSnapshot([]string{"deepseek-v4-pro"})
	require.NoError(t, err)
	require.NoError(t, common.UnmarshalJsonStr(named.Options["billing_setting.billing_expr"], &namedExpressions))
	for _, tc := range []struct {
		name   string
		listed bool
	}{
		{"deepseek-v4-pro", true},
		{"gpt-image-2", true},
		{"gpt-image-2.5-flare", false},
		{"gpt-6-astra", false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			builtin, ok := billing_setting.GetBuiltinBillingExpr(tc.name)
			require.True(t, ok)
			assert.Equal(t, tc.listed, listed[tc.name])
			if tc.listed {
				assert.Equal(t, billing_setting.BillingModeTieredExpr, modes[tc.name])
				assert.Equal(t, builtin, expressions[tc.name])
			} else {
				assert.NotContains(t, modes, tc.name)
				assert.NotContains(t, expressions, tc.name)
			}
			assert.Equal(t, builtin, namedExpressions[tc.name])
		})
	}
}
