package controller

import (
	"net/http"
	"net/http/httptest"
	"slices"
	"strconv"
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupInvitationOptionControllerTest(t *testing.T) (*gorm.DB, *model.User) {
	t.Helper()
	db, admin := setupInvitationControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.Option{}))
	originalSettings := common.GetInvitationCodeSettings()
	common.OptionMapRWMutex.RLock()
	var originalOptionMap map[string]string
	if common.OptionMap != nil {
		originalOptionMap = make(map[string]string, len(common.OptionMap))
		for key, value := range common.OptionMap {
			originalOptionMap[key] = value
		}
	}
	common.OptionMapRWMutex.RUnlock()

	_, err := common.ApplyInvitationCodeSettings(false, []string{common.InvitationRegistrationMethodLinuxDO})
	require.NoError(t, err)
	common.OptionMapRWMutex.Lock()
	common.OptionMap = map[string]string{
		model.InvitationCodeRequiredOptionKey: "false",
		model.InvitationCodeMethodsOptionKey:  `["linuxdo"]`,
	}
	common.OptionMapRWMutex.Unlock()

	t.Cleanup(func() {
		_, err := common.ApplyInvitationCodeSettings(originalSettings.Required, originalSettings.Methods)
		require.NoError(t, err)
		common.OptionMapRWMutex.Lock()
		common.OptionMap = originalOptionMap
		common.OptionMapRWMutex.Unlock()
	})
	return db, admin
}

func TestUpdateInvitationCodeOptionReturnsEffectiveAtomicPair(t *testing.T) {
	db, admin := setupInvitationOptionControllerTest(t)
	ctx, recorder := invitationControllerContext(t, http.MethodPut, "/api/option/invitation-code", map[string]interface{}{
		"required": true,
		"methods":  []string{" Password ", "LINUXDO", "password"},
	}, admin.Id)

	UpdateInvitationCodeOption(ctx)

	var response struct {
		Success bool                          `json:"success"`
		Data    common.InvitationCodeSettings `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.True(t, response.Success)
	assert.Equal(t, common.InvitationCodeSettings{
		Required: true,
		Methods:  []string{"linuxdo", "password"},
	}, response.Data)
	assert.Equal(t, response.Data, common.GetInvitationCodeSettings())

	var options []model.Option
	require.NoError(t, db.Order("key").Find(&options).Error)
	values := make(map[string]string, len(options))
	for _, option := range options {
		values[option.Key] = option.Value
	}
	assert.Equal(t, map[string]string{
		model.InvitationCodeRequiredOptionKey: "true",
		model.InvitationCodeMethodsOptionKey:  `["linuxdo","password"]`,
	}, values)
}

func TestUpdateInvitationCodeOptionRejectsRequiredWithoutMethodsWithoutMutation(t *testing.T) {
	db, admin := setupInvitationOptionControllerTest(t)
	before := common.GetInvitationCodeSettings()
	ctx, recorder := invitationControllerContext(t, http.MethodPut, "/api/option/invitation-code", map[string]interface{}{
		"required": true,
		"methods":  []string{},
	}, admin.Id)

	UpdateInvitationCodeOption(ctx)

	var response struct {
		Success bool `json:"success"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.False(t, response.Success)
	assert.Equal(t, before, common.GetInvitationCodeSettings())
	var count int64
	require.NoError(t, db.Model(&model.Option{}).Count(&count).Error)
	assert.Zero(t, count)
}

func TestUpdateInvitationCodeOptionAllowsDisabledWithEmptyMethods(t *testing.T) {
	db, admin := setupInvitationOptionControllerTest(t)
	ctx, recorder := invitationControllerContext(t, http.MethodPut, "/api/option/invitation-code", map[string]interface{}{
		"required": false,
		"methods":  []string{},
	}, admin.Id)

	UpdateInvitationCodeOption(ctx)

	var response struct {
		Success bool                          `json:"success"`
		Data    common.InvitationCodeSettings `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response.Success)
	assert.False(t, response.Data.Required)
	assert.Empty(t, response.Data.Methods)
	assert.Equal(t, response.Data, common.GetInvitationCodeSettings())
	assert.Equal(t, map[string]string{
		model.InvitationCodeRequiredOptionKey: "false",
		model.InvitationCodeMethodsOptionKey:  `[]`,
	}, func() map[string]string {
		var options []model.Option
		require.NoError(t, db.Find(&options).Error)
		values := make(map[string]string, len(options))
		for _, option := range options {
			values[option.Key] = option.Value
		}
		return values
	}())
}

func TestUpdateInvitationCodeOptionRequiresBothNonNullFields(t *testing.T) {
	db, admin := setupInvitationOptionControllerTest(t)
	before := common.GetInvitationCodeSettings()
	testCases := []struct {
		name string
		body map[string]interface{}
	}{
		{name: "empty object", body: map[string]interface{}{}},
		{name: "missing required", body: map[string]interface{}{"methods": []string{"linuxdo"}}},
		{name: "missing methods", body: map[string]interface{}{"required": false}},
		{name: "null required", body: map[string]interface{}{"required": nil, "methods": []string{"linuxdo"}}},
		{name: "null methods", body: map[string]interface{}{"required": false, "methods": nil}},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			ctx, recorder := invitationControllerContext(t, http.MethodPut, "/api/option/invitation-code", testCase.body, admin.Id)

			UpdateInvitationCodeOption(ctx)

			assert.Equal(t, http.StatusBadRequest, recorder.Code)
			var response struct {
				Success bool `json:"success"`
			}
			require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
			assert.False(t, response.Success)
			assert.Equal(t, before, common.GetInvitationCodeSettings())
		})
	}
	var count int64
	require.NoError(t, db.Model(&model.Option{}).Count(&count).Error)
	assert.Zero(t, count)
}

func TestGenericUpdateOptionRejectsInvitationCodeKeys(t *testing.T) {
	db, admin := setupInvitationOptionControllerTest(t)
	require.NoError(t, i18n.Init())

	testCases := []struct {
		key      string
		language string
	}{
		{key: model.InvitationCodeRequiredOptionKey, language: i18n.LangEn},
		{key: model.InvitationCodeMethodsOptionKey, language: i18n.LangZhCN},
		{key: "invitationcoderequired", language: i18n.LangZhTW},
		{key: "INVITATIONCODEMETHODS", language: i18n.LangEn},
		{key: " InvitationCodeRequired ", language: i18n.LangZhCN},
		{key: "InvitationCodeMethods   ", language: i18n.LangZhTW},
		{key: "Invitation.Code.Required", language: i18n.LangEn},
		{key: "Invitation_Code_Methods", language: i18n.LangZhCN},
		{key: "InvítationCodeRequired", language: i18n.LangZhTW},
	}
	for _, testCase := range testCases {
		t.Run(testCase.language+"/"+testCase.key, func(t *testing.T) {
			ctx, recorder := invitationControllerContext(t, http.MethodPut, "/api/option/", map[string]interface{}{
				"key":   testCase.key,
				"value": true,
			}, admin.Id)
			ctx.Request.Header.Set("Accept-Language", testCase.language)

			UpdateOption(ctx)

			var response struct {
				Success bool   `json:"success"`
				Message string `json:"message"`
			}
			require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
			assert.False(t, response.Success)
			assert.NotEqual(t, model.ErrInvitationCodeOptionRequiresAtomicUpdate.Error(), response.Message)
			if model.IsInvitationCodeOptionKey(testCase.key) {
				assert.Equal(t, i18n.Translate(testCase.language, i18n.MsgInvitationSettingsAtomicUpdateRequired), response.Message)
			}
		})
	}
	var count int64
	require.NoError(t, db.Model(&model.Option{}).Count(&count).Error)
	assert.Zero(t, count)
}

func TestInvitationCodeTwoConcurrentAdministratorsCanOnlyCommitCompleteConfigurationPairs(t *testing.T) {
	db, firstAdmin := setupInvitationOptionControllerTest(t)
	secondAdmin := &model.User{
		Username: "second-invitation-admin",
		Password: "password",
		Role:     common.RoleAdminUser,
		Status:   common.UserStatusEnabled,
		AffCode:  "ADM2",
	}
	require.NoError(t, db.Create(secondAdmin).Error)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)

	type submission struct {
		adminID int
		body    map[string]interface{}
	}
	submissions := []submission{
		{
			adminID: firstAdmin.Id,
			body: map[string]interface{}{
				"required": true,
				"methods":  []string{"password"},
			},
		},
		{
			adminID: secondAdmin.Id,
			body: map[string]interface{}{
				"required": false,
				"methods":  []string{"github", "linuxdo"},
			},
		},
	}

	start := make(chan struct{})
	responses := make(chan bool, len(submissions))
	var waitGroup sync.WaitGroup
	waitGroup.Add(len(submissions))
	for _, submission := range submissions {
		submission := submission
		go func() {
			defer waitGroup.Done()
			ctx, recorder := invitationControllerContext(t, http.MethodPut, "/api/option/invitation-code", submission.body, submission.adminID)
			<-start
			UpdateInvitationCodeOption(ctx)
			var response struct {
				Success bool `json:"success"`
			}
			if err := common.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
				responses <- false
				return
			}
			responses <- response.Success
		}()
	}
	close(start)
	waitGroup.Wait()
	close(responses)
	for success := range responses {
		assert.True(t, success)
	}

	settings := common.GetInvitationCodeSettings()
	isFirst := settings.Required && slices.Equal(settings.Methods, []string{"password"})
	isSecond := !settings.Required && slices.Equal(settings.Methods, []string{"github", "linuxdo"})
	require.True(t, isFirst || isSecond, "runtime must equal one complete submitted pair: %#v", settings)

	var options []model.Option
	require.NoError(t, db.Where(map[string]any{"key": []string{
		model.InvitationCodeRequiredOptionKey,
		model.InvitationCodeMethodsOptionKey,
	}}).Find(&options).Error)
	values := make(map[string]string, len(options))
	for _, option := range options {
		values[option.Key] = option.Value
	}
	if isFirst {
		assert.Equal(t, map[string]string{
			model.InvitationCodeRequiredOptionKey: "true",
			model.InvitationCodeMethodsOptionKey:  `["password"]`,
		}, values)
	} else {
		assert.Equal(t, map[string]string{
			model.InvitationCodeRequiredOptionKey: "false",
			model.InvitationCodeMethodsOptionKey:  `["github","linuxdo"]`,
		}, values)
	}
}

func TestStatusAndOptionsReturnSameInvitationConfiguration(t *testing.T) {
	_, _ = setupInvitationOptionControllerTest(t)
	expected, err := model.UpdateInvitationCodeSettings(true, []string{"password", "linuxdo", "password"})
	require.NoError(t, err)

	statusRecorder := httptest.NewRecorder()
	statusContext, _ := gin.CreateTestContext(statusRecorder)
	statusContext.Request = httptest.NewRequest(http.MethodGet, "/api/status", nil)
	GetStatus(statusContext)
	var statusResponse struct {
		Success bool `json:"success"`
		Data    struct {
			Required bool     `json:"invitation_code_required"`
			Methods  []string `json:"invitation_code_methods"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(statusRecorder.Body.Bytes(), &statusResponse))
	require.True(t, statusResponse.Success)
	assert.Equal(t, expected.Required, statusResponse.Data.Required)
	assert.Equal(t, expected.Methods, statusResponse.Data.Methods)

	optionsRecorder := httptest.NewRecorder()
	optionsContext, _ := gin.CreateTestContext(optionsRecorder)
	optionsContext.Request = httptest.NewRequest(http.MethodGet, "/api/option/", nil)
	GetOptions(optionsContext)
	var optionsResponse struct {
		Success bool            `json:"success"`
		Data    []*model.Option `json:"data"`
	}
	require.NoError(t, common.Unmarshal(optionsRecorder.Body.Bytes(), &optionsResponse))
	require.True(t, optionsResponse.Success)
	values := make(map[string]string, len(optionsResponse.Data))
	for _, option := range optionsResponse.Data {
		values[option.Key] = option.Value
	}
	methodsJSON, err := common.Marshal(expected.Methods)
	require.NoError(t, err)
	assert.Equal(t, strconv.FormatBool(expected.Required), values[model.InvitationCodeRequiredOptionKey])
	assert.Equal(t, string(methodsJSON), values[model.InvitationCodeMethodsOptionKey])
}
