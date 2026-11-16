package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupGroupAdminNotesTest(t *testing.T) *model.User {
	t.Helper()
	db := setupTokenControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(
		&model.User{}, &model.Option{}, &model.Ability{}, &model.Channel{},
		&model.Model{}, &model.Vendor{}, &model.SystemTask{},
	))

	originalUsableGroups := setting.UserUsableGroups2JSONString()
	originalRatios := ratio_setting.GroupRatio2JSONString()
	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"default":"Default group"}`))
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1,"internal":1}`))
	common.OptionMapRWMutex.Lock()
	originalOptionMap := common.OptionMap
	common.OptionMap = map[string]string{"GroupAdminNotes": "{}"}
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(originalUsableGroups))
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(originalRatios))
		common.OptionMapRWMutex.Lock()
		common.OptionMap = originalOptionMap
		common.OptionMapRWMutex.Unlock()
	})

	user := &model.User{
		Id:       201,
		Username: "group-note-user",
		Password: "password",
		Group:    "default",
		Status:   common.UserStatusEnabled,
	}
	require.NoError(t, db.Create(user).Error)
	return user
}

func TestGroupAdminNotesOptionRoundTripsThroughOptionAPI(t *testing.T) {
	setupGroupAdminNotesTest(t)
	const notes = `{"internal":"Staff only, do not expose"}`

	ctx, recorder := newAuthenticatedContext(t, http.MethodPut, "/api/option/", map[string]any{
		"key":   "GroupAdminNotes",
		"value": notes,
	}, 1)
	UpdateOption(ctx)
	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Body.String(), `"success":true`)

	var stored model.Option
	require.NoError(t, model.DB.First(&stored, "key = ?", "GroupAdminNotes").Error)
	assert.Equal(t, notes, stored.Value)

	ctx, recorder = newAuthenticatedContext(t, http.MethodGet, "/api/option/", nil, 1)
	GetOptions(ctx)
	var response struct {
		Data []model.Option `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	values := make(map[string]string, len(response.Data))
	for _, option := range response.Data {
		values[option.Key] = option.Value
	}
	assert.Equal(t, notes, values["GroupAdminNotes"])

	for _, invalid := range []string{"", "null", "[]", `"note"`, `{"internal":1}`, `{"internal":`} {
		t.Run("rejects "+invalid, func(t *testing.T) {
			ctx, recorder := newAuthenticatedContext(t, http.MethodPut, "/api/option/", map[string]any{
				"key":   "GroupAdminNotes",
				"value": invalid,
			}, 1)
			UpdateOption(ctx)
			assert.Contains(t, recorder.Body.String(), `"success":false`)
			require.NoError(t, model.DB.First(&stored, "key = ?", "GroupAdminNotes").Error)
			assert.Equal(t, notes, stored.Value)
		})
	}
}

func TestGroupAdminNotesStayOutOfNonAdminResponses(t *testing.T) {
	user := setupGroupAdminNotesTest(t)
	const note = "Staff only, do not expose"
	require.NoError(t, model.UpdateOption("GroupAdminNotes", `{"internal":"`+note+`","default":"`+note+`"}`))

	handlers := map[string]gin.HandlerFunc{
		"/api/user/self/groups": GetUserGroups,
		"/api/pricing":          GetPricing,
		"/api/status":           GetStatus,
	}
	for path, handler := range handlers {
		t.Run(path, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)
			ctx.Request = httptest.NewRequest(http.MethodGet, path, nil)
			ctx.Set("id", user.Id)
			handler(ctx)
			require.Equal(t, http.StatusOK, recorder.Code)
			assert.Contains(t, recorder.Body.String(), `"success":true`)
			assert.NotContains(t, recorder.Body.String(), note)
			assert.NotContains(t, recorder.Body.String(), "GroupAdminNotes")
		})
	}
}
