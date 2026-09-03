package controller

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sort"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func validMetaproxyProvisionRequest() metaproxyProvisionRequest {
	return metaproxyProvisionRequest{
		Revision: "ba57fd0526c6ce9e9869c225ac9997d96b2bbdea",
		Digest:   "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		Channels: []metaproxyProvisionChannelRequest{
			{
				Type:      1,
				Key:       "secret",
				Name:      "Upstream [one]",
				BaseURL:   "https://upstream.example/v1",
				Models:    "model-one",
				Group:     "standard",
				Priority:  10,
				Weight:    100,
				Status:    1,
				TestModel: "model-one",
			},
		},
		Options: metaproxyProvisionOptionsRequest{
			ModelRatio:       `{"model-one":1}`,
			CompletionRatio:  `{"model-one":2}`,
			CacheRatio:       `{"model-one":0.1}`,
			ModelBillingMode: `{}`,
			ModelBillingExpr: `{}`,
			GroupRatio:       `{"standard":1}`,
			UserUsableGroups: `{"standard":"Standard"}`,
		},
	}
}

func TestValidateMetaproxyProvisionRequestAcceptsExpressionPricedModel(t *testing.T) {
	request := validMetaproxyProvisionRequest()
	request.Options.ModelRatio = `{}`
	request.Options.ModelBillingMode = `{"model-one":"tiered_expr"}`
	request.Options.ModelBillingExpr = `{"model-one":"(param(\"n\") == nil ? 1 : param(\"n\")) * (param(\"resolution\") == \"1k\" ? tier(\"1k\", 200000) : tier(\"2k\", 300000))"}`
	require.NoError(t, validateMetaproxyProvisionRequest(request, request.Digest, "none"))
}

func TestValidateMetaproxyProvisionRequestRejectsInvalidBillingExpression(t *testing.T) {
	request := validMetaproxyProvisionRequest()
	request.Options.ModelRatio = `{}`
	request.Options.ModelBillingMode = `{"model-one":"tiered_expr"}`
	request.Options.ModelBillingExpr = `{"model-one":"tier(\"broken\", -1"}`
	err := validateMetaproxyProvisionRequest(request, request.Digest, "none")
	require.ErrorContains(t, err, "ModelBillingExpr")
}

func TestValidateMetaproxyProvisionRequestRejectsExpressionModeWithoutExpression(t *testing.T) {
	request := validMetaproxyProvisionRequest()
	request.Options.ModelRatio = `{}`
	request.Options.ModelBillingMode = `{"model-one":"tiered_expr"}`
	err := validateMetaproxyProvisionRequest(request, request.Digest, "none")
	require.ErrorContains(t, err, "model-one")
	require.ErrorContains(t, err, "ModelBillingExpr")
}

func TestValidateMetaproxyProvisionRequestAcceptsCompleteConfig(t *testing.T) {
	request := validMetaproxyProvisionRequest()
	require.NoError(t, validateMetaproxyProvisionRequest(request, request.Digest, "none"))
}

func TestValidateMetaproxyProvisionRequestAcceptsLegacyRequestWithoutBillingExpressions(t *testing.T) {
	request := validMetaproxyProvisionRequest()
	request.Options.ModelBillingMode = ""
	request.Options.ModelBillingExpr = ""
	require.NoError(t, validateMetaproxyProvisionRequest(request, request.Digest, "none"))

	config := toMetaproxyProvisionConfig(request)
	require.Equal(t, "{}", config.Options.ModelBillingMode)
	require.Equal(t, "{}", config.Options.ModelBillingExpr)
}

func TestValidateMetaproxyProvisionRequestRejectsMismatchedIdempotencyKey(t *testing.T) {
	request := validMetaproxyProvisionRequest()
	err := validateMetaproxyProvisionRequest(
		request,
		"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
		"none",
	)
	require.ErrorContains(t, err, "Idempotency-Key")
}

func TestValidateMetaproxyProvisionRequestRejectsDuplicateChannelNames(t *testing.T) {
	request := validMetaproxyProvisionRequest()
	request.Channels = append(request.Channels, request.Channels[0])
	err := validateMetaproxyProvisionRequest(request, request.Digest, "none")
	require.ErrorContains(t, err, "duplicate channel name")
}

func TestValidateMetaproxyProvisionRequestRejectsEnabledModelWithoutPrice(t *testing.T) {
	request := validMetaproxyProvisionRequest()
	request.Options.ModelRatio = `{}`
	err := validateMetaproxyProvisionRequest(request, request.Digest, "none")
	require.ErrorContains(t, err, "model-one")
	require.ErrorContains(t, err, "ModelRatio")
}

func TestValidateMetaproxyProvisionRequestAllowsDisabledUnpricedModel(t *testing.T) {
	request := validMetaproxyProvisionRequest()
	request.Channels[0].Status = 2
	request.Options.ModelRatio = `{}`
	require.NoError(t, validateMetaproxyProvisionRequest(request, request.Digest, "none"))
}

func TestValidateMetaproxyProvisionRequestAllowsUnpricedModelInUnpublishedGroup(t *testing.T) {
	request := validMetaproxyProvisionRequest()
	request.Options.ModelRatio = `{}`
	request.Options.GroupRatio = `{}`
	request.Options.UserUsableGroups = `{}`
	require.NoError(t, validateMetaproxyProvisionRequest(request, request.Digest, "none"))
}

func TestValidateMetaproxyProvisionRequestAllowsLegacyZeroRatioOutsideManagedChannels(t *testing.T) {
	request := validMetaproxyProvisionRequest()
	request.Options.ModelRatio = `{"model-one":1,"legacy-disabled-model":0}`
	require.NoError(t, validateMetaproxyProvisionRequest(request, request.Digest, "none"))
}

func TestValidateMetaproxyProvisionRequestRejectsZeroRatioForOfferedModel(t *testing.T) {
	request := validMetaproxyProvisionRequest()
	request.Options.ModelRatio = `{"model-one":0}`
	err := validateMetaproxyProvisionRequest(request, request.Digest, "none")
	require.ErrorContains(t, err, "model-one")
	require.ErrorContains(t, err, "positive ModelRatio")
}

func TestValidateMetaproxyProvisionRequestRejectsMalformedRatioJson(t *testing.T) {
	request := validMetaproxyProvisionRequest()
	request.Options.GroupRatio = `{"standard":"free"}`
	err := validateMetaproxyProvisionRequest(request, request.Digest, "none")
	require.ErrorContains(t, err, "GroupRatio")
}

func TestCommaValuesNormalizesWhitespace(t *testing.T) {
	values, err := commaValues("model-a, model-b\t")
	require.NoError(t, err)
	require.Equal(t, []string{"model-a", "model-b"}, values)
}

func TestToMetaproxyProvisionConfigStoresNormalizedLists(t *testing.T) {
	request := validMetaproxyProvisionRequest()
	request.Channels[0].Models = "model-one, model-two\t"
	request.Channels[0].Group = "standard, archive\t"

	config := toMetaproxyProvisionConfig(request)
	require.Equal(t, "model-one,model-two", config.Channels[0].Models)
	require.Equal(t, "standard,archive", config.Channels[0].Group)
}

func TestToMetaproxyProvisionConfigNormalizesWhitespaceBillingOptions(t *testing.T) {
	request := validMetaproxyProvisionRequest()
	request.Options.ModelBillingMode = " \t\n"
	request.Options.ModelBillingExpr = "\r\n"

	config := toMetaproxyProvisionConfig(request)

	require.Equal(t, "{}", config.Options.ModelBillingMode)
	require.Equal(t, "{}", config.Options.ModelBillingExpr)
}

func TestApplyMetaproxyProvisionRequiresMemoryCache(t *testing.T) {
	previous := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = false
	t.Cleanup(func() { common.MemoryCacheEnabled = previous })

	body, err := json.Marshal(validMetaproxyProvisionRequest())
	require.NoError(t, err)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(http.MethodPost, "/api/metaproxy/provision", bytes.NewReader(body))
	context.Request.Header.Set(
		"Idempotency-Key",
		"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
	)
	context.Request.Header.Set("If-Match", "none")

	ApplyMetaproxyProvision(context)

	require.Equal(t, http.StatusPreconditionFailed, recorder.Code)
	require.Contains(t, recorder.Body.String(), "MEMORY_CACHE_ENABLED=true")
}

func TestApplyMetaproxyProvisionSuccessResponseShape(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Channel{}, &model.Ability{}, &model.Option{}, &model.Log{}))
	request := validMetaproxyProvisionRequest()
	require.NoError(t, db.Create(&[]model.Option{
		{Key: model.MetaproxyProvisionDigestOption, Value: request.Digest},
		{Key: model.MetaproxyProvisionRevisionOption, Value: request.Revision},
	}).Error)

	previousDB, previousLogDB := model.DB, model.LOG_DB
	previousMemoryCacheEnabled := common.MemoryCacheEnabled
	previousRedisEnabled := common.RedisEnabled
	common.RedisEnabled = false
	// Pre-activate the digest in memory so the apply skips the in-process
	// reload: the reload steps are model-internal and must not run here.
	common.OptionMapRWMutex.Lock()
	previousOptions := common.OptionMap
	common.OptionMap = map[string]string{
		model.MetaproxyProvisionDigestOption:   request.Digest,
		model.MetaproxyProvisionRevisionOption: request.Revision,
	}
	common.OptionMapRWMutex.Unlock()
	model.DB, model.LOG_DB = db, db
	common.MemoryCacheEnabled = true
	t.Cleanup(func() {
		model.DB, model.LOG_DB = previousDB, previousLogDB
		common.MemoryCacheEnabled = previousMemoryCacheEnabled
		common.RedisEnabled = previousRedisEnabled
		common.OptionMapRWMutex.Lock()
		common.OptionMap = previousOptions
		common.OptionMapRWMutex.Unlock()
	})

	body, err := json.Marshal(request)
	require.NoError(t, err)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(http.MethodPost, "/api/metaproxy/provision", bytes.NewReader(body))
	context.Request.Header.Set("Idempotency-Key", request.Digest)
	context.Request.Header.Set("If-Match", request.Digest)

	ApplyMetaproxyProvision(context)

	require.Equal(t, http.StatusOK, recorder.Code)
	var payload struct {
		Success bool `json:"success"`
		Data    struct {
			Revision       string `json:"revision"`
			Digest         string `json:"digest"`
			PreviousDigest string `json:"previous_digest"`
			AlreadyApplied bool   `json:"already_applied"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &payload))
	require.True(t, payload.Success)
	require.Equal(t, request.Revision, payload.Data.Revision)
	require.Equal(t, request.Digest, payload.Data.Digest)
	require.Equal(t, request.Digest, payload.Data.PreviousDigest)
	require.False(t, payload.Data.AlreadyApplied)

	var raw map[string]any
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &raw))
	data, ok := raw["data"].(map[string]any)
	require.True(t, ok)
	keys := make([]string, 0, len(data))
	for key := range data {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	require.Equal(t, []string{"already_applied", "digest", "previous_digest", "revision"}, keys)
}
