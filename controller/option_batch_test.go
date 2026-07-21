package controller

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestValidateAtomicOptionUpdatesAcceptsRelatedPricingSettings(t *testing.T) {
	err := validateAtomicOptionUpdates(map[string]string{
		"ModelPrice":                                     `{"image-model":0.25}`,
		"ImageResolutionPrice":                           `{"image-model":{"1K":0.25,"4K":1.2}}`,
		"billing_setting.billing_mode":                   `{"image-model":"tiered_expr"}`,
		"billing_setting.billing_expr":                   `{"image-model":"tier(\"base\", p * 2 + c * 3)"}`,
		"ExposeRatioEnabled":                             "true",
		"GroupGroupRatio":                                `{"vip":{"default":0.9}}`,
		"UserUsableGroups":                               `{"default":"Default"}`,
		"AutoGroups":                                     `["default"]`,
		"DefaultUseAutoGroup":                            "false",
		"group_ratio_setting.group_special_usable_group": `{"vip":{"default":"default"}}`,
	})
	require.NoError(t, err)
}

func TestValidateAtomicOptionUpdatesRejectsBatchBeforePersistence(t *testing.T) {
	testCases := []struct {
		name    string
		values  map[string]string
		message string
	}{
		{
			name:    "unsupported key",
			values:  map[string]string{"SystemName": "changed"},
			message: "does not support atomic batch updates",
		},
		{
			name:    "invalid resolution price",
			values:  map[string]string{"ImageResolutionPrice": `{"image-model":{"4K":-1}}`},
			message: "invalid ImageResolutionPrice",
		},
		{
			name:    "unknown billing mode",
			values:  map[string]string{"billing_setting.billing_mode": `{"image-model":"fixed"}`},
			message: "invalid billing mode",
		},
		{
			name: "tiered mode without expression",
			values: map[string]string{
				"billing_setting.billing_mode": `{"batch-test-model":"tiered_expr"}`,
				"billing_setting.billing_expr": `{}`,
			},
			message: "requires an expression",
		},
		{
			name:    "billing mode without expression batch",
			values:  map[string]string{"billing_setting.billing_mode": `{"batch-test-model":"ratio"}`},
			message: "must be updated together",
		},
		{
			name:    "invalid boolean",
			values:  map[string]string{"ExposeRatioEnabled": "yes"},
			message: "expected true or false",
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			require.ErrorContains(t, validateAtomicOptionUpdates(testCase.values), testCase.message)
		})
	}
}

func TestParseAtomicOptionUpdatesPreservesExpectedValues(t *testing.T) {
	expected := `{"image-model":0.25}`
	values, expectedValues, keys, err := parseAtomicOptionUpdates([]OptionUpdateRequest{{
		Key:           "ModelPrice",
		Value:         `{"image-model":0.3}`,
		ExpectedValue: &expected,
	}}, true)
	require.NoError(t, err)
	assert.Equal(t, `{"image-model":0.3}`, values["ModelPrice"])
	assert.Equal(t, expected, expectedValues["ModelPrice"])
	assert.Equal(t, []string{"ModelPrice"}, keys)
}

func TestCreateModelMetaRequiresRootForOptionUpdates(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(http.MethodPost, "/api/models/", strings.NewReader(`{
		"model_name":"admin-cannot-price-model",
		"option_updates":[{"key":"ModelPrice","value":"{\"admin-cannot-price-model\":1}"}]
	}`))
	context.Request.Header.Set("Content-Type", "application/json")
	context.Set("role", common.RoleAdminUser)

	CreateModelMeta(context)

	assert.Equal(t, http.StatusForbidden, recorder.Code)
	assert.Contains(t, recorder.Body.String(), "无权修改模型计费配置")
}

func TestUpdateModelMetaRejectsNonRootRename(t *testing.T) {
	gin.SetMode(gin.TestMode)
	previousDB := model.DB
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	model.DB = db
	t.Cleanup(func() {
		model.DB = previousDB
		sqlDB, dbErr := db.DB()
		if dbErr == nil {
			_ = sqlDB.Close()
		}
	})
	require.NoError(t, model.DB.AutoMigrate(&model.Model{}))

	const originalName = "controller-admin-rename-policy-test"
	const renamedName = "controller-admin-rename-policy-test-renamed"
	require.NoError(t, model.DB.Unscoped().Where("model_name IN ?", []string{originalName, renamedName}).Delete(&model.Model{}).Error)
	modelMeta := &model.Model{ModelName: originalName, Description: "before", Status: 1, SyncOfficial: 1}
	require.NoError(t, modelMeta.Insert())
	t.Cleanup(func() {
		_ = model.DB.Unscoped().Where("id = ?", modelMeta.Id).Delete(&model.Model{}).Error
	})

	body, err := common.Marshal(modelMetaMutationRequest{
		Model: model.Model{Id: modelMeta.Id, ModelName: renamedName, Description: "must roll back"},
	})
	require.NoError(t, err)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(http.MethodPut, "/api/models/", strings.NewReader(string(body)))
	context.Request.Header.Set("Content-Type", "application/json")
	context.Set("role", common.RoleAdminUser)

	UpdateModelMeta(context)

	assert.Equal(t, http.StatusForbidden, recorder.Code)
	assert.Contains(t, recorder.Body.String(), "只有根管理员可以修改模型名称")
	var stored model.Model
	require.NoError(t, model.DB.First(&stored, modelMeta.Id).Error)
	assert.Equal(t, originalName, stored.ModelName)
	assert.Equal(t, "before", stored.Description)
}
