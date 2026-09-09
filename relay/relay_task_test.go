package relay

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	pluginruntime "github.com/QuantumNous/new-api/pkg/jsplugin"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTaskModel2DtoNormalizesLegacyAction(t *testing.T) {
	task := &model.Task{Action: "firstTailGenerate"}

	dtoTask := TaskModel2Dto(task)

	assert.Equal(t, constant.TaskActionFirstTailToVideo, dtoTask.Action)
	assert.Equal(t, "firstTailGenerate", task.Action)
}

const mappingOrderSubmitPlugin = `
export const meta = {apiVersion:1,key:"maporder",name:"Map Order",version:"1.0.0",author:{name:"Test"},models:["declared-model"],fetchMode:"per_task"};
export function buildSubmitRequest(ctx) {
  return {url: ctx.baseUrl+"/submit", method:"POST", body:{upstreamModel: ctx.upstreamModel, model: ctx.model}, action:"text_to_video"};
}
export function parseSubmitResponse(){return {taskId:"1"};}
export function buildQueryRequest(){return {url:"https://provider.example"};}
export function parseTaskResult(){return {status:"SUCCESS"};}
`

const mappingOrderRewritePlugin = `
export const meta = {apiVersion:1,key:"maporder-rw",name:"Map Order RW",version:"1.0.0",author:{name:"Test"},models:["declared-model"],fetchMode:"per_task"};
export function buildSubmitRequest(ctx) {
  return {url: ctx.baseUrl+"/submit", method:"POST", body:{upstreamModel: ctx.upstreamModel}, rewriteModel:"rewritten"};
}
export function parseSubmitResponse(){return {taskId:"1"};}
export function buildQueryRequest(){return {url:"https://provider.example"};}
export function parseTaskResult(){return {status:"SUCCESS"};}
`

func pinMappingOrderPlugin(t *testing.T, c *gin.Context, source string) {
	t.Helper()
	plugin, err := pluginruntime.NewRegistry().Register(source, pluginruntime.Options{})
	require.NoError(t, err)
	c.Set(pluginruntime.ContextKeyPinnedPlugin, pluginruntime.PinnedPlugin{Plugin: plugin})
}

func newTaskSubmitContext(t *testing.T, originalModel, mapping string) (*gin.Context, *relaycommon.RelayInfo) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/videos", nil)
	common.SetContextKey(c, constant.ContextKeyOriginalModel, originalModel)
	common.SetContextKey(c, constant.ContextKeyChannelBaseUrl, "https://provider.example")
	if mapping != "" {
		c.Set("model_mapping", mapping)
	}
	c.Set("task_request", map[string]any{"prompt": "p"})
	return c, &relaycommon.RelayInfo{TaskRelayInfo: &relaycommon.TaskRelayInfo{}}
}

func TestRelayTaskSubmitMapsBeforeValidateWhenOriginSet(t *testing.T) {
	const mapping = `{"alias-model":"mid-model","mid-model":"declared-model"}`

	c, info := newTaskSubmitContext(t, "alias-model", mapping)
	pinMappingOrderPlugin(t, c, mappingOrderSubmitPlugin)
	info.OriginModelName = "alias-model"

	_, taskErr := RelayTaskSubmit(c, info)
	require.NotNil(t, taskErr)
	assert.Equal(t, "model_price_error", taskErr.Code)
	assert.Equal(t, "alias-model", info.OriginModelName)
	assert.Equal(t, "declared-model", info.UpstreamModelName)
	assert.True(t, info.IsModelMapped)
}

func TestRelayTaskSubmitDeclaredNameWithoutMappingIsUnchanged(t *testing.T) {
	c, info := newTaskSubmitContext(t, "declared-model", "")
	pinMappingOrderPlugin(t, c, mappingOrderSubmitPlugin)
	info.OriginModelName = "declared-model"

	_, taskErr := RelayTaskSubmit(c, info)
	require.NotNil(t, taskErr)
	assert.Equal(t, "model_price_error", taskErr.Code)
	assert.Equal(t, "declared-model", info.OriginModelName)
	assert.Equal(t, "declared-model", info.UpstreamModelName)
	assert.False(t, info.IsModelMapped)
}

func TestRelayTaskSubmitDoesNotApplyMappingTwice(t *testing.T) {
	c, info := newTaskSubmitContext(t, "alias-model", `{"alias-model":"declared-model"}`)
	pinMappingOrderPlugin(t, c, mappingOrderRewritePlugin)
	info.OriginModelName = "alias-model"

	_, taskErr := RelayTaskSubmit(c, info)
	require.NotNil(t, taskErr)
	assert.Equal(t, "model_price_error", taskErr.Code)
	assert.Equal(t, "rewritten", info.UpstreamModelName, "late mapping would overwrite rewriteModel with the chain tail")
	assert.Equal(t, "alias-model", info.OriginModelName)
}

func TestRelayTaskSubmitEmptyOriginKeepsLateMapping(t *testing.T) {
	plugin, err := pluginruntime.NewRegistry().Register(mappingOrderSubmitPlugin, pluginruntime.Options{})
	require.NoError(t, err)
	synthesized := service.CoverTaskActionToModelName(constant.TaskPlatform(plugin.Meta.Key), "text_to_video")
	c, info := newTaskSubmitContext(t, "pre-validate-upstream",
		`{"pre-validate-upstream":"should-not-apply-early","`+synthesized+`":"legacy-tail"}`)
	c.Set(pluginruntime.ContextKeyPinnedPlugin, pluginruntime.PinnedPlugin{Plugin: plugin})
	info.OriginModelName = ""

	_, taskErr := RelayTaskSubmit(c, info)
	require.NotNil(t, taskErr)
	assert.Equal(t, "model_price_error", taskErr.Code)
	assert.Equal(t, synthesized, info.OriginModelName)
	assert.Equal(t, "legacy-tail", info.UpstreamModelName)
	assert.True(t, info.IsModelMapped)
}

const billingFallbackPlugin = `
export const meta = {apiVersion:1,key:"bill-fallback",name:"Bill Fallback",version:"1.0.0",author:{name:"Test"},models:["declared-model"],fetchMode:"per_task"};
export function buildSubmitRequest(ctx) {
  return {url: ctx.baseUrl+"/submit", method:"POST", body:{upstreamModel: ctx.upstreamModel, model: ctx.model}, action:"text_to_video"};
}
export function parseSubmitResponse(){return {taskId:"1"};}
export function buildQueryRequest(){return {url:"https://provider.example"};}
export function parseTaskResult(){return {status:"SUCCESS"};}
`

func saveBillingConfig(t *testing.T) {
	t.Helper()
	saved := map[string]string{}
	require.NoError(t, config.GlobalConfig.SaveToDB(func(key, value string) error {
		saved[key] = value
		return nil
	}))
	t.Cleanup(func() {
		require.NoError(t, config.GlobalConfig.LoadFromDB(saved))
	})
}

func TestRelayTaskSubmitAliasBillingIdentityAndExprFallback(t *testing.T) {
	const mapping = `{"alias-model":"declared-model"}`
	const aliasExpr = `tier("alias", 2)`
	const tailExpr = `tier("tail", 3)`

	tests := []struct {
		name       string
		modes      map[string]string
		exprs      map[string]string
		wantTiered bool
		wantExpr   string
	}{
		{
			name:       "alias own tiered wins",
			modes:      map[string]string{"alias-model": "tiered_expr", "declared-model": "tiered_expr"},
			exprs:      map[string]string{"alias-model": aliasExpr, "declared-model": tailExpr},
			wantTiered: true,
			wantExpr:   aliasExpr,
		},
		{
			name:       "fallback uses tail expr",
			modes:      map[string]string{"declared-model": "tiered_expr"},
			exprs:      map[string]string{"declared-model": tailExpr},
			wantTiered: true,
			wantExpr:   tailExpr,
		},
		{
			name:       "neither tiered uses ordinary pricing",
			wantTiered: false,
		},
	}
	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			saveBillingConfig(t)
			if len(testCase.modes) > 0 {
				modeJSON, marshalErr := common.Marshal(testCase.modes)
				require.NoError(t, marshalErr)
				exprJSON, marshalErr := common.Marshal(testCase.exprs)
				require.NoError(t, marshalErr)
				require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
					"billing_setting.billing_mode": string(modeJSON),
					"billing_setting.billing_expr": string(exprJSON),
				}))
				if testCase.wantExpr == aliasExpr {
					require.Equal(t, billing_setting.BillingModeTieredExpr, billing_setting.GetBillingMode("alias-model"))
				} else {
					require.Equal(t, billing_setting.BillingModeRatio, billing_setting.GetBillingMode("alias-model"))
					require.Equal(t, billing_setting.BillingModeTieredExpr, billing_setting.GetBillingMode("declared-model"))
				}
			}

			c, info := newTaskSubmitContext(t, "alias-model", mapping)
			c.Set("group", "default")
			info.UserGroup = "default"
			info.UsingGroup = "default"
			pinMappingOrderPlugin(t, c, billingFallbackPlugin)
			info.OriginModelName = "alias-model"

			_, taskErr := RelayTaskSubmit(c, info)
			require.NotNil(t, taskErr)
			assert.Equal(t, "alias-model", info.OriginModelName)
			assert.Equal(t, "declared-model", info.UpstreamModelName)
			assert.True(t, info.IsModelMapped)

			task := model.InitTask(constant.TaskPlatform("bill-fallback"), info)
			assert.Equal(t, "alias-model", task.Properties.OriginModelName)
			assert.Equal(t, "declared-model", task.Properties.UpstreamModelName)

			if testCase.wantTiered {
				require.NotNil(t, info.TieredBillingSnapshot)
				assert.Equal(t, "alias-model", info.TieredBillingSnapshot.ModelName)
				assert.Equal(t, testCase.wantExpr, info.TieredBillingSnapshot.ExprString)
				assert.Equal(t, billingexpr.ExprHashString(testCase.wantExpr), info.TieredBillingSnapshot.ExprHash)
				assert.NotEqual(t, "model_price_error", taskErr.Code)
			} else {
				assert.Nil(t, info.TieredBillingSnapshot)
				assert.Equal(t, "model_price_error", taskErr.Code)
			}
		})
	}
}
