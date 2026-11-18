package controller

import (
	"cmp"
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	"github.com/QuantumNous/new-api/relay"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/service/authz"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/request_plugin_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/samber/lo"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type channelSupplierFixture struct {
	root, admin, supplierA, supplierB        *model.User
	legacy, ownA1, ownA2, otherB, adminOwned *model.Channel
}

// setupChannelSupplierTest builds the users and channels shared by the channel
// supplier tests, with the authorization baseline seeded.
func setupChannelSupplierTest(t *testing.T) channelSupplierFixture {
	t.Helper()
	gin.SetMode(gin.TestMode)
	previousDB, previousLogDB := model.DB, model.LOG_DB
	previousType, previousLogType := common.MainDatabaseType(), common.LogDatabaseType()
	previousMaster, previousCache, previousRedis, previousSQLite := common.IsMasterNode, common.MemoryCacheEnabled, common.RedisEnabled, common.SQLitePath
	t.Cleanup(func() {
		model.DB, model.LOG_DB = previousDB, previousLogDB
		common.SetDatabaseTypes(previousType, previousLogType)
		common.IsMasterNode, common.MemoryCacheEnabled, common.RedisEnabled, common.SQLitePath = previousMaster, previousCache, previousRedis, previousSQLite
	})
	t.Setenv("SQL_DSN", os.Getenv("TEST_CHANNEL_SQL_DSN"))
	t.Setenv("LOG_SQL_DSN", "")
	common.IsMasterNode, common.MemoryCacheEnabled, common.RedisEnabled = false, false, false
	common.SQLitePath = filepath.Join(t.TempDir(), "channel.db")
	require.NoError(t, model.InitDB())
	database := model.DB
	sqlDB, err := database.DB()
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, sqlDB.Close()) })
	model.LOG_DB = database
	common.SetLogDatabaseType(common.MainDatabaseType())
	require.NoError(t, database.AutoMigrate(&model.Channel{}, &model.Ability{}, &model.User{}, &model.Log{}, &model.AuditLog{}, &model.CasbinRule{}, &model.AuthzRole{}))

	// Seeding the built-in roles and default policies needs the master node.
	common.IsMasterNode = true
	require.NoError(t, authz.Init(database))
	common.IsMasterNode = false

	newUser := func(username string, role int) *model.User {
		user := &model.User{Username: username, Role: role, Status: common.UserStatusEnabled, AffCode: username}
		require.NoError(t, database.Create(user).Error)
		t.Cleanup(func() { require.NoError(t, database.Unscoped().Delete(user).Error) })
		return user
	}
	fixture := channelSupplierFixture{
		root:      newUser("fixture-root", common.RoleRootUser),
		admin:     newUser("fixture-admin", common.RoleAdminUser),
		supplierA: newUser("supplier-a", common.RoleChannelSupplierUser),
		supplierB: newUser("supplier-b", common.RoleChannelSupplierUser),
	}

	newChannel := func(name, models, tag string, priority *int64, creator *model.User) *model.Channel {
		channel := &model.Channel{
			Type: 1, Key: "sk-" + name, Name: name, Status: common.ChannelStatusEnabled,
			Models: models, Group: "default", Priority: priority,
		}
		if tag != "" {
			channel.Tag = &tag
		}
		if creator != nil {
			channel.CreatorUserId, channel.CreatorRole = creator.Id, creator.Role
		}
		require.NoError(t, channel.Insert())
		t.Cleanup(func() { deleteChannelWithAbilities(t, channel.Id) })
		return channel
	}
	priority100, priority0 := int64(100), int64(0)
	fixture.legacy = newChannel("legacy", "m-legacy", "shared", nil, nil)
	fixture.ownA1 = newChannel("own-a1", "m-a1,m-shared", "shared", &priority100, fixture.supplierA)
	fixture.ownA2 = newChannel("own-a2", "m-a2", "", nil, fixture.supplierA)
	fixture.otherB = newChannel("other-b", "m-b1,m-b2,m-b3", "shared", nil, fixture.supplierB)
	fixture.adminOwned = newChannel("admin-owned", "m-admin,m-shared", "", &priority0, fixture.admin)
	return fixture
}

func deleteChannelWithAbilities(t *testing.T, id int) {
	t.Helper()
	require.NoError(t, model.DB.Unscoped().Where("channel_id = ?", id).Delete(&model.Ability{}).Error)
	require.NoError(t, model.DB.Unscoped().Delete(&model.Channel{}, id).Error)
}

// channelSupplierRequest runs handler as actor signed in with a dashboard
// session, the only way a channel supplier reaches the channel routes.
func channelSupplierRequest(t *testing.T, method, target, body string, actor *model.User, params gin.Params, handler gin.HandlerFunc) *httptest.ResponseRecorder {
	t.Helper()
	response := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(response)
	c.Request = httptest.NewRequest(method, target, strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Params = params
	c.Set("id", actor.Id)
	c.Set("role", actor.Role)
	c.Set("username", actor.Username)
	c.Set("session_id", "dashboard-session")
	c.Set("auth_version", int64(1))
	c.Set("session_version", int64(1))
	handler(c)
	return response
}

// storedChannelState is a channel row, key included, and its abilities as the
// database holds them.
type storedChannelState struct {
	Channel   *model.Channel
	Abilities []model.Ability
}

func channelState(t *testing.T, id int) storedChannelState {
	t.Helper()
	channel, err := model.GetChannelById(id, true)
	require.NoError(t, err)
	var abilities []model.Ability
	require.NoError(t, model.DB.Where("channel_id = ?", id).Order("model").Find(&abilities).Error)
	return storedChannelState{Channel: channel, Abilities: abilities}
}

// createdChannelID returns the channel ID a successful create or copy
// response reports, and deletes that channel when the test ends.
func createdChannelID(t *testing.T, response *httptest.ResponseRecorder) int {
	t.Helper()
	var result struct {
		Success bool `json:"success"`
		Data    struct {
			Id int `json:"id"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
	require.True(t, result.Success, response.Body.String())
	t.Cleanup(func() { deleteChannelWithAbilities(t, result.Data.Id) })
	return result.Data.Id
}

func countChannels(t *testing.T) int64 {
	t.Helper()
	var count int64
	require.NoError(t, model.DB.Model(&model.Channel{}).Count(&count).Error)
	return count
}

// channelSupplierData sends a GET request as actor and returns the data of the
// successful response.
func channelSupplierData[T any](t *testing.T, target string, actor *model.User, handler gin.HandlerFunc) T {
	t.Helper()
	response := channelSupplierRequest(t, http.MethodGet, target, "", actor, nil, handler)
	require.Equal(t, http.StatusOK, response.Code)
	var result struct {
		Success bool `json:"success"`
		Data    T    `json:"data"`
	}
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
	require.True(t, result.Success, response.Body.String())
	return result.Data
}

type channelListItem struct {
	Id              int    `json:"id"`
	CreatorUserId   int    `json:"creator_user_id"`
	CreatorUsername string `json:"creator_username"`
}

type channelListData struct {
	Items      []channelListItem `json:"items"`
	Total      int               `json:"total"`
	TypeCounts map[string]int    `json:"type_counts"`
}

func (data channelListData) ids() []int {
	return lo.Map(data.Items, func(item channelListItem, _ int) int { return item.Id })
}

func TestChannelCreatorIsSetByServer(t *testing.T) {
	fixture := setupChannelSupplierTest(t)
	const body = `{"mode":"batch","channel":{"type":1,"name":"batch","key":"k1\nk2","models":"m","group":"default","creator_user_id":999,"creator_role":100}}`

	for _, test := range []struct {
		actor        *model.User
		wantSupplier bool
	}{{fixture.supplierA, true}, {fixture.admin, false}} {
		response := channelSupplierRequest(t, http.MethodPost, "/api/channel", body, test.actor, nil, AddChannel)
		require.Equal(t, http.StatusOK, response.Code)
		var result struct {
			Success bool `json:"success"`
			Data    struct {
				Ids []int `json:"ids"`
			} `json:"data"`
		}
		require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
		require.True(t, result.Success, response.Body.String())
		require.Len(t, result.Data.Ids, 2)
		for _, id := range result.Data.Ids {
			t.Cleanup(func() { deleteChannelWithAbilities(t, id) })
			stored, err := model.GetChannelById(id, false)
			require.NoError(t, err)
			assert.Equal(t, test.actor.Id, stored.CreatorUserId)
			assert.Equal(t, test.actor.Role, stored.CreatorRole)
			assert.Equal(t, test.wantSupplier, stored.IsSupplierChannel())
		}
	}
}

func TestChannelCreatorIsReadOnly(t *testing.T) {
	fixture := setupChannelSupplierTest(t)
	body := `{"id":` + strconv.Itoa(fixture.ownA1.Id) + `,"name":"renamed","creator_user_id":` + strconv.Itoa(fixture.admin.Id) + `,"creator_role":10}`

	response := channelSupplierRequest(t, http.MethodPut, "/api/channel/", body, fixture.admin, nil, UpdateChannel)
	require.Equal(t, http.StatusOK, response.Code)
	assert.Contains(t, response.Body.String(), `"success":true`)

	stored, err := model.GetChannelById(fixture.ownA1.Id, false)
	require.NoError(t, err)
	assert.Equal(t, "renamed", stored.Name)
	assert.Equal(t, fixture.supplierA.Id, stored.CreatorUserId)
	assert.Equal(t, common.RoleChannelSupplierUser, stored.CreatorRole)

	// The handler clears the creator before saving; the update of the model
	// leaves the creator alone by itself.
	require.NoError(t, (&model.Channel{Id: fixture.ownA1.Id, Name: "x", CreatorUserId: fixture.admin.Id, CreatorRole: common.RoleAdminUser}).Update())
	stored, err = model.GetChannelById(fixture.ownA1.Id, false)
	require.NoError(t, err)
	assert.Equal(t, "x", stored.Name)
	assert.Equal(t, fixture.supplierA.Id, stored.CreatorUserId)
	assert.Equal(t, common.RoleChannelSupplierUser, stored.CreatorRole)
}

func TestCopiedChannelBelongsToCopier(t *testing.T) {
	fixture := setupChannelSupplierTest(t)
	params := gin.Params{{Key: "id", Value: strconv.Itoa(fixture.ownA1.Id)}}

	for _, test := range []struct {
		actor *model.User
		role  int
	}{{fixture.admin, common.RoleAdminUser}, {fixture.supplierA, common.RoleChannelSupplierUser}} {
		response := channelSupplierRequest(t, http.MethodPost, "/api/channel/copy/"+params[0].Value, "", test.actor, params, CopyChannel)
		require.Equal(t, http.StatusOK, response.Code)
		var result struct {
			Success bool `json:"success"`
			Data    struct {
				Id int `json:"id"`
			} `json:"data"`
		}
		require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
		require.True(t, result.Success, response.Body.String())
		t.Cleanup(func() { deleteChannelWithAbilities(t, result.Data.Id) })
		stored, err := model.GetChannelById(result.Data.Id, false)
		require.NoError(t, err)
		assert.Equal(t, test.actor.Id, stored.CreatorUserId)
		assert.Equal(t, test.role, stored.CreatorRole)
	}
}

func TestSupplierListSeesOnlyOwnChannels(t *testing.T) {
	fixture := setupChannelSupplierTest(t)
	// supplierA created this channel while still an administrator.
	sharedTag := "shared"
	adminEra := &model.Channel{
		Type: 1, Key: "sk-a-admin-era", Name: "a-admin-era", Status: common.ChannelStatusEnabled,
		Models: "m-a-admin-era", Group: "default", Tag: &sharedTag,
		CreatorUserId: fixture.supplierA.Id, CreatorRole: common.RoleAdminUser,
	}
	require.NoError(t, adminEra.Insert())
	t.Cleanup(func() { deleteChannelWithAbilities(t, adminEra.Id) })
	const target = "/api/channel/?p=1&page_size=50"

	list := channelSupplierData[channelListData](t, target, fixture.supplierA, GetAllChannels)
	assert.ElementsMatch(t, []int{fixture.ownA1.Id, fixture.ownA2.Id}, list.ids())
	assert.Equal(t, 2, list.Total)
	assert.Equal(t, 2, lo.Sum(lo.Values(list.TypeCounts)))

	list = channelSupplierData[channelListData](t, target+"&tag_mode=true", fixture.supplierA, GetAllChannels)
	assert.ElementsMatch(t, []int{fixture.ownA1.Id}, list.ids())

	// A supplier set back to a common user sees no channel.
	demoted := &model.User{Id: fixture.supplierA.Id, Username: fixture.supplierA.Username, Role: common.RoleCommonUser}
	list = channelSupplierData[channelListData](t, target, demoted, GetAllChannels)
	assert.Empty(t, list.Items)
	assert.Zero(t, list.Total)

	list = channelSupplierData[channelListData](t, target, fixture.admin, GetAllChannels)
	assert.ElementsMatch(t, []int{fixture.legacy.Id, fixture.ownA1.Id, fixture.ownA2.Id, fixture.otherB.Id, fixture.adminOwned.Id, adminEra.Id}, list.ids())
	assert.Equal(t, 6, list.Total)
	items := lo.KeyBy(list.Items, func(item channelListItem) int { return item.Id })
	assert.Equal(t, "supplier-a", items[fixture.ownA1.Id].CreatorUsername)
	assert.Zero(t, items[fixture.legacy.Id].CreatorUserId)
	assert.Empty(t, items[fixture.legacy.Id].CreatorUsername)

	// A tag only supplierB uses sorts before shared. supplierA's first page of
	// one tag still holds shared, and the tag count leaves the other tag out.
	bOnlyTag := "b-only"
	bOnly := &model.Channel{
		Type: 1, Key: "sk-b-only", Name: "b-only", Status: common.ChannelStatusEnabled,
		Models: "m-b-only", Group: "default", Tag: &bOnlyTag,
		CreatorUserId: fixture.supplierB.Id, CreatorRole: common.RoleChannelSupplierUser,
	}
	require.NoError(t, bOnly.Insert())
	t.Cleanup(func() { deleteChannelWithAbilities(t, bOnly.Id) })
	list = channelSupplierData[channelListData](t, "/api/channel/?p=1&page_size=1&tag_mode=true", fixture.supplierA, GetAllChannels)
	assert.ElementsMatch(t, []int{fixture.ownA1.Id}, list.ids())
	assert.Equal(t, 1, list.Total)
}

func TestSupplierSearchSeesOnlyOwnChannels(t *testing.T) {
	fixture := setupChannelSupplierTest(t)
	const target = "/api/channel/search?keyword="

	list := channelSupplierData[channelListData](t, target, fixture.supplierA, SearchChannels)
	assert.ElementsMatch(t, []int{fixture.ownA1.Id, fixture.ownA2.Id}, list.ids())

	list = channelSupplierData[channelListData](t, target+fixture.otherB.Name, fixture.supplierA, SearchChannels)
	assert.Empty(t, list.Items)
	assert.Zero(t, list.Total)

	list = channelSupplierData[channelListData](t, target+"&tag_mode=true", fixture.supplierA, SearchChannels)
	assert.ElementsMatch(t, []int{fixture.ownA1.Id}, list.ids())

	list = channelSupplierData[channelListData](t, target, fixture.admin, SearchChannels)
	assert.ElementsMatch(t, []int{fixture.legacy.Id, fixture.ownA1.Id, fixture.ownA2.Id, fixture.otherB.Id, fixture.adminOwned.Id}, list.ids())
}

func TestSupplierTagAndEnabledModelsStayInScope(t *testing.T) {
	fixture := setupChannelSupplierTest(t)
	const tagModels, enabledModels = "/api/channel/tag/models?tag=shared", "/api/channel/models_enabled"

	assert.Equal(t, "m-a1,m-shared", channelSupplierData[string](t, tagModels, fixture.supplierA, GetTagModels))
	assert.Equal(t, "m-b1,m-b2,m-b3", channelSupplierData[string](t, tagModels, fixture.admin, GetTagModels))

	assert.ElementsMatch(t, []string{"m-a1", "m-shared", "m-a2"}, channelSupplierData[[]string](t, enabledModels, fixture.supplierA, EnabledListModels))
	assert.Subset(t, channelSupplierData[[]string](t, enabledModels, fixture.admin, EnabledListModels), []string{"m-legacy", "m-b1", "m-admin"})
}

func TestChannelCreatorNameForDeletedUser(t *testing.T) {
	fixture := setupChannelSupplierTest(t)
	require.NoError(t, model.DB.Delete(fixture.supplierB).Error)

	list := channelSupplierData[channelListData](t, "/api/channel/?p=1&page_size=50", fixture.admin, GetAllChannels)
	items := lo.KeyBy(list.Items, func(item channelListItem) int { return item.Id })
	require.Contains(t, items, fixture.otherB.Id)
	assert.Equal(t, fixture.supplierB.Id, items[fixture.otherB.Id].CreatorUserId)
	assert.Empty(t, items[fixture.otherB.Id].CreatorUsername)
	// A creator who still exists keeps a name in the same list.
	assert.Equal(t, "supplier-a", items[fixture.ownA1.Id].CreatorUsername)
}

// MySQL before 8.0 may give the ID of a hard-deleted user to the next new
// user after a restart, so a hard deletion takes the user's channels from that
// ID. A soft deletion keeps the row, and with it the ID and the creator.
func TestHardDeletedSupplierChannelsLoseTheirCreator(t *testing.T) {
	fixture := setupChannelSupplierTest(t)
	require.NoError(t, model.DB.AutoMigrate(&model.UserAccessToken{}, &model.UserSession{}, &model.AuthFlow{}, &model.TwoFA{}, &model.TwoFABackupCode{},
		&model.PasskeyCredential{}, &model.Token{}, &model.UserOAuthBinding{}, &model.ExternalIdentityClaim{}))
	// A channel test that reached ownA1 would fail at once on this address,
	// with an error it translates.
	require.NoError(t, i18n.Init())
	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", fixture.ownA1.Id).Update("base_url", "http://127.0.0.1:1").Error)
	// The memory cache keeps the channels as they were before the deletion.
	common.MemoryCacheEnabled = true
	t.Cleanup(func() {
		common.MemoryCacheEnabled = false
		model.InitChannelCache()
	})
	model.InitChannelCache()

	_, err := model.HardDeleteUserById(fixture.supplierA.Id)
	require.NoError(t, err)
	for _, channel := range []*model.Channel{fixture.ownA1, fixture.ownA2} {
		stored := channelState(t, channel.Id).Channel
		assert.Zero(t, stored.CreatorUserId, channel.Name)
		// Still a supplier channel, which never serves relay.
		assert.Equal(t, common.RoleChannelSupplierUser, stored.CreatorRole, channel.Name)
	}
	assert.Equal(t, fixture.supplierB.Id, channelState(t, fixture.otherB.Id).Channel.CreatorUserId)

	// A supplier who gets the deleted supplier's ID reaches none of its
	// channels, from the list or by ID through the memory cache.
	reused := &model.User{Id: fixture.supplierA.Id, Username: "reused-id", Role: common.RoleChannelSupplierUser, Status: common.UserStatusEnabled, AffCode: "reused-id"}
	require.NoError(t, model.DB.Create(reused).Error)
	t.Cleanup(func() { require.NoError(t, model.DB.Unscoped().Delete(reused).Error) })
	list := channelSupplierData[channelListData](t, "/api/channel/?p=1&page_size=50", reused, GetAllChannels)
	assert.Empty(t, list.Items)
	assert.Zero(t, list.Total)
	ownA1 := strconv.Itoa(fixture.ownA1.Id)
	response := channelSupplierRequest(t, http.MethodGet, "/api/channel/test/"+ownA1, "", reused, gin.Params{{Key: "id", Value: ownA1}}, TestChannel)
	assert.Contains(t, response.Body.String(), "Channel does not exist")

	// A soft deletion keeps the creator.
	_, err = model.DeleteUserById(fixture.supplierB.Id)
	require.NoError(t, err)
	assert.Equal(t, fixture.supplierB.Id, channelState(t, fixture.otherB.Id).Channel.CreatorUserId)
}

// missingChannelID names no channel in the supplier tests.
const missingChannelID = 999999

func TestSupplierCannotReachOtherChannelsByID(t *testing.T) {
	fixture := setupChannelSupplierTest(t)
	// A handler that reached otherB fails at once on this address instead of
	// calling a real upstream.
	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", fixture.otherB.Id).Update("base_url", "http://127.0.0.1:1").Error)
	otherBBefore, channelsBefore := channelState(t, fixture.otherB.Id), countChannels(t)

	// {id} stands for the channel ID, which is also the id path parameter.
	for _, test := range []struct {
		name, method, target, body string
		handler                    gin.HandlerFunc
		memoryCache                bool
	}{
		{name: "get", method: http.MethodGet, target: "/api/channel/{id}", handler: GetChannel},
		{name: "plugin credentials", method: http.MethodGet, target: "/api/channel/{id}/plugin_credentials", handler: GetPluginCredentials},
		{name: "vllm status", method: http.MethodGet, target: "/api/channel/{id}/vllm/status", handler: GetVLLMChannelStatus},
		{name: "sglang status", method: http.MethodGet, target: "/api/channel/{id}/sglang/status", handler: GetSGLangChannelStatus},
		{name: "codex usage", method: http.MethodGet, target: "/api/channel/{id}/codex/usage", handler: GetCodexChannelUsage},
		{name: "codex reset credits", method: http.MethodGet, target: "/api/channel/{id}/codex/usage/reset-credits", handler: GetCodexChannelRateLimitResetCredits},
		{name: "codex usage reset", method: http.MethodPost, target: "/api/channel/{id}/codex/usage/reset", handler: ResetCodexChannelUsage},
		{name: "ollama version", method: http.MethodGet, target: "/api/channel/ollama/version/{id}", handler: OllamaVersion},
		{name: "test", method: http.MethodGet, target: "/api/channel/test/{id}", handler: TestChannel},
		{name: "test from memory cache", method: http.MethodGet, target: "/api/channel/test/{id}", handler: TestChannel, memoryCache: true},
		{name: "update balance", method: http.MethodGet, target: "/api/channel/update_balance/{id}", handler: UpdateChannelBalance},
		{name: "update balance from memory cache", method: http.MethodGet, target: "/api/channel/update_balance/{id}", handler: UpdateChannelBalance, memoryCache: true},
		{name: "fetch upstream models", method: http.MethodGet, target: "/api/channel/fetch_models/{id}", handler: FetchUpstreamModels},
		{name: "start plugin login", method: http.MethodPost, target: "/api/channel/{id}/plugin_login", body: `{}`, handler: StartPluginLogin},
		{name: "continue plugin login", method: http.MethodPost, target: "/api/channel/{id}/plugin_login/continue", body: `{"flow":"unknown"}`, handler: ContinuePluginLogin},
		{name: "refresh codex credential", method: http.MethodPost, target: "/api/channel/{id}/codex/refresh", handler: RefreshCodexChannelCredential},
		{name: "manage multi keys", method: http.MethodPost, target: "/api/channel/multi_key/manage", body: `{"channel_id":{id},"action":"get_key_status"}`, handler: ManageMultiKeys},
		{name: "ollama pull", method: http.MethodPost, target: "/api/channel/ollama/pull", body: `{"channel_id":{id},"model_name":"m"}`, handler: OllamaPullModel},
		{name: "ollama pull stream", method: http.MethodPost, target: "/api/channel/ollama/pull/stream", body: `{"channel_id":{id},"model_name":"m"}`, handler: OllamaPullModelStream},
		{name: "ollama delete", method: http.MethodDelete, target: "/api/channel/ollama/delete", body: `{"channel_id":{id},"model_name":"m"}`, handler: OllamaDeleteModel},
		{name: "detect upstream updates", method: http.MethodPost, target: "/api/channel/upstream_updates/detect", body: `{"id":{id}}`, handler: DetectChannelUpstreamModelUpdates},
		{name: "apply upstream updates", method: http.MethodPost, target: "/api/channel/upstream_updates/apply", body: `{"id":{id},"add_models":["m-b1"]}`, handler: ApplyChannelUpstreamModelUpdates},
		{name: "fetch models of a saved channel", method: http.MethodPost, target: "/api/channel/fetch_models", body: `{"channel_id":{id}}`, handler: FetchModels},
		{name: "copy", method: http.MethodPost, target: "/api/channel/copy/{id}", handler: CopyChannel},
		{name: "update", method: http.MethodPut, target: "/api/channel/", body: `{"id":{id},"name":"taken-over"}`, handler: UpdateChannel},
		{name: "update status", method: http.MethodPost, target: "/api/channel/{id}/status", body: `{"status":2}`, handler: UpdateChannelStatus},
		{name: "delete", method: http.MethodDelete, target: "/api/channel/{id}", handler: DeleteChannel},
	} {
		t.Run(test.name, func(t *testing.T) {
			common.MemoryCacheEnabled = test.memoryCache
			if test.memoryCache {
				model.InitChannelCache()
			}
			var responses [2]*httptest.ResponseRecorder
			for i, id := range []int{fixture.otherB.Id, missingChannelID} {
				idText := strconv.Itoa(id)
				responses[i] = channelSupplierRequest(t, test.method, strings.ReplaceAll(test.target, "{id}", idText), strings.ReplaceAll(test.body, "{id}", idText),
					fixture.supplierA, gin.Params{{Key: "id", Value: idText}}, test.handler)
			}
			foreign, missing := responses[0], responses[1]
			assert.Equal(t, missing.Code, foreign.Code)
			assert.JSONEq(t, missing.Body.String(), foreign.Body.String())
			assert.Contains(t, foreign.Body.String(), "Channel does not exist")
		})
	}
	assert.Equal(t, otherBBefore, channelState(t, fixture.otherB.Id))
	assert.Equal(t, channelsBefore, countChannels(t))

	params := gin.Params{{Key: "id", Value: strconv.Itoa(fixture.otherB.Id)}}
	response := channelSupplierRequest(t, http.MethodGet, "/api/channel/"+params[0].Value, "", fixture.admin, params, GetChannel)
	var adminView struct {
		Success bool            `json:"success"`
		Data    channelListItem `json:"data"`
	}
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &adminView))
	assert.True(t, adminView.Success, response.Body.String())
	assert.Equal(t, fixture.otherB.Id, adminView.Data.Id)
}

func TestSupplierCreateIgnoresNamedChannelID(t *testing.T) {
	fixture := setupChannelSupplierTest(t)
	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", fixture.otherB.Id).Update("setting", `{"proxy":"","system_prompt":"kept"}`).Error)
	otherBBefore := channelState(t, fixture.otherB.Id)
	otherB := strconv.Itoa(fixture.otherB.Id)

	// AddChannel reads the submitted setting before validating it; reading an
	// invalid one must not clear the setting of the channel the supplier named.
	channelSupplierRequest(t, http.MethodPost, "/api/channel", `{"mode":"single","channel":{"id":`+otherB+`,"type":1,"setting":"{"}}`, fixture.supplierA, nil, AddChannel)
	// The new channel gets an ID of its own, so the insert does not tell
	// whether otherB exists.
	response := channelSupplierRequest(t, http.MethodPost, "/api/channel",
		`{"mode":"single","channel":{"id":`+otherB+`,"type":1,"name":"named-id","key":"sk-named-id","models":"m","group":"default"}}`,
		fixture.supplierA, nil, AddChannel)
	assert.Equal(t, otherBBefore, channelState(t, fixture.otherB.Id))
	assert.NotEqual(t, fixture.otherB.Id, createdChannelID(t, response))
}

func TestSupplierBatchRejectsForeignOrMissingIDs(t *testing.T) {
	fixture := setupChannelSupplierTest(t)
	ownA1, otherB := strconv.Itoa(fixture.ownA1.Id), strconv.Itoa(fixture.otherB.Id)
	ownA1Before, otherBBefore := channelState(t, fixture.ownA1.Id), channelState(t, fixture.otherB.Id)

	// {ids} stands for the channel IDs of the request.
	for _, test := range []struct {
		name, target, body string
		handler            gin.HandlerFunc
	}{
		{name: "set tag", target: "/api/channel/batch/tag", body: `{"ids":[{ids}],"tag":"taken"}`, handler: BatchSetChannelTag},
		{name: "update status", target: "/api/channel/status/batch", body: `{"ids":[{ids}],"status":2}`, handler: BatchUpdateChannelStatus},
		{name: "delete", target: "/api/channel/batch", body: `{"ids":[{ids}]}`, handler: DeleteChannelBatch},
	} {
		t.Run(test.name, func(t *testing.T) {
			foreign := channelSupplierRequest(t, http.MethodPost, test.target, strings.ReplaceAll(test.body, "{ids}", ownA1+","+otherB), fixture.supplierA, nil, test.handler)
			missing := channelSupplierRequest(t, http.MethodPost, test.target, strings.ReplaceAll(test.body, "{ids}", ownA1+","+strconv.Itoa(missingChannelID)), fixture.supplierA, nil, test.handler)
			assert.Equal(t, missing.Code, foreign.Code)
			assert.JSONEq(t, missing.Body.String(), foreign.Body.String())
			assert.Contains(t, foreign.Body.String(), "One or more channels do not exist")
		})
	}
	assert.Equal(t, ownA1Before, channelState(t, fixture.ownA1.Id))
	assert.Equal(t, otherBBefore, channelState(t, fixture.otherB.Id))

	// An empty list names no channel.
	within, err := model.ChannelIDsWithinScope(model.CreatorChannelsScope(fixture.supplierA.Id), nil)
	require.NoError(t, err)
	assert.False(t, within)

	// A repeated ID names one of the supplier's channels, not a missing one.
	response := channelSupplierRequest(t, http.MethodPost, "/api/channel/status/batch", `{"ids":[`+ownA1+`,`+ownA1+`],"status":2}`, fixture.supplierA, nil, BatchUpdateChannelStatus)
	assert.Contains(t, response.Body.String(), `"success":true`)
	assert.Equal(t, common.ChannelStatusManuallyDisabled, channelState(t, fixture.ownA1.Id).Channel.Status)

	response = channelSupplierRequest(t, http.MethodPost, "/api/channel/batch", `{"ids":[`+ownA1+`,`+otherB+`]}`, fixture.admin, nil, DeleteChannelBatch)
	assert.JSONEq(t, `{"success":true,"message":"","data":2}`, response.Body.String())
	for _, id := range []int{fixture.ownA1.Id, fixture.otherB.Id} {
		_, err := model.GetChannelById(id, false)
		assert.ErrorIs(t, err, gorm.ErrRecordNotFound)
	}
}

func TestSupplierTagOperationsStayInScope(t *testing.T) {
	fixture := setupChannelSupplierTest(t)
	// legacy is a multi-key channel disabled because all its keys are, the
	// state a tag disable overrides channel by channel.
	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", fixture.legacy.Id).Updates(map[string]any{
		"status":       common.ChannelStatusAutoDisabled,
		"other_info":   `{"status_reason":"` + model.ChannelStatusReasonAllKeysDisabled + `"}`,
		"channel_info": model.ChannelInfo{IsMultiKey: true, MultiKeySize: 1},
	}).Error)
	require.NoError(t, model.UpdateAbilityStatus(fixture.legacy.Id, false))
	// otherB and legacy share the tag with ownA1; no tag operation of
	// supplierA may change them or their abilities.
	otherBBefore, legacyBefore := channelState(t, fixture.otherB.Id), channelState(t, fixture.legacy.Id)
	abilityEnabled := func(ability model.Ability, _ int) bool { return ability.Enabled }

	response := channelSupplierRequest(t, http.MethodPost, "/api/channel/tag/disabled", `{"tag":"shared"}`, fixture.supplierA, nil, DisableTagChannels)
	require.Contains(t, response.Body.String(), `"success":true`)
	ownA1 := channelState(t, fixture.ownA1.Id)
	assert.Equal(t, common.ChannelStatusManuallyDisabled, ownA1.Channel.Status)
	assert.Equal(t, []bool{false, false}, lo.Map(ownA1.Abilities, abilityEnabled))
	assert.Equal(t, otherBBefore, channelState(t, fixture.otherB.Id))
	assert.Equal(t, legacyBefore, channelState(t, fixture.legacy.Id))

	// An edit that keeps the models updates the abilities in place.
	response = channelSupplierRequest(t, http.MethodPut, "/api/channel/tag", `{"tag":"shared","priority":9}`, fixture.supplierA, nil, EditTagChannels)
	require.Contains(t, response.Body.String(), `"success":true`)
	ownA1 = channelState(t, fixture.ownA1.Id)
	assert.Equal(t, int64(9), ownA1.Channel.GetPriority())
	assert.Equal(t, []int64{9, 9}, lo.Map(ownA1.Abilities, func(ability model.Ability, _ int) int64 { return lo.FromPtr(ability.Priority) }))
	assert.Equal(t, otherBBefore, channelState(t, fixture.otherB.Id))
	assert.Equal(t, legacyBefore, channelState(t, fixture.legacy.Id))

	// An edit of the models rebuilds the abilities. legacy's abilities differ
	// from what its row would rebuild, so a rebuild of legacy shows.
	require.NoError(t, model.DB.Model(&model.Ability{}).Where("channel_id = ?", fixture.legacy.Id).Update("priority", 7).Error)
	legacyBefore = channelState(t, fixture.legacy.Id)
	response = channelSupplierRequest(t, http.MethodPut, "/api/channel/tag", `{"tag":"shared","models":"m-new"}`, fixture.supplierA, nil, EditTagChannels)
	require.Contains(t, response.Body.String(), `"success":true`)
	ownA1 = channelState(t, fixture.ownA1.Id)
	assert.Equal(t, []string{"m-new"}, lo.Map(ownA1.Abilities, func(ability model.Ability, _ int) string { return ability.Model }))
	assert.Equal(t, otherBBefore, channelState(t, fixture.otherB.Id))
	assert.Equal(t, legacyBefore, channelState(t, fixture.legacy.Id))

	// Enabling the tag leaves legacy, disabled and someone else's, disabled.
	response = channelSupplierRequest(t, http.MethodPost, "/api/channel/tag/enabled", `{"tag":"shared"}`, fixture.supplierA, nil, EnableTagChannels)
	require.Contains(t, response.Body.String(), `"success":true`)
	ownA1 = channelState(t, fixture.ownA1.Id)
	assert.Equal(t, common.ChannelStatusEnabled, ownA1.Channel.Status)
	assert.Equal(t, []bool{true}, lo.Map(ownA1.Abilities, abilityEnabled))
	assert.Equal(t, otherBBefore, channelState(t, fixture.otherB.Id))
	assert.Equal(t, legacyBefore, channelState(t, fixture.legacy.Id))

	// An administrator's tag operation still covers every channel under the tag.
	response = channelSupplierRequest(t, http.MethodPost, "/api/channel/tag/disabled", `{"tag":"shared"}`, fixture.admin, nil, DisableTagChannels)
	require.Contains(t, response.Body.String(), `"success":true`)
	for _, channel := range []*model.Channel{fixture.ownA1, fixture.otherB, fixture.legacy} {
		state := channelState(t, channel.Id)
		assert.Equal(t, common.ChannelStatusManuallyDisabled, state.Channel.Status, channel.Name)
		assert.NotContains(t, lo.Map(state.Abilities, abilityEnabled), true, channel.Name)
	}
}

func TestSupplierCannotChangeRequestPlugins(t *testing.T) {
	fixture := setupChannelSupplierTest(t)
	channelsBefore := countChannels(t)
	response := channelSupplierRequest(t, http.MethodPost, "/api/channel",
		`{"mode":"single","channel":{"type":1,"name":"bound","key":"sk-bound","models":"m","group":"default","setting":"{\"request_plugins\":[\"inst-1\"]}"}}`,
		fixture.supplierA, nil, AddChannel)
	assert.Contains(t, response.Body.String(), "Channel suppliers cannot change request plugins")
	assert.Equal(t, channelsBefore, countChannels(t))

	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", fixture.ownA1.Id).Update("setting", `{"request_plugins":["inst-1"]}`).Error)
	ownA1 := strconv.Itoa(fixture.ownA1.Id)
	response = channelSupplierRequest(t, http.MethodPut, "/api/channel/", `{"id":`+ownA1+`,"setting":"{\"request_plugins\":[]}"}`, fixture.supplierA, nil, UpdateChannel)
	assert.Contains(t, response.Body.String(), "Channel suppliers cannot change request plugins")
	assert.Equal(t, []string{"inst-1"}, channelState(t, fixture.ownA1.Id).Channel.GetSetting().RequestPlugins)

	params := gin.Params{{Key: "id", Value: ownA1}}
	response = channelSupplierRequest(t, http.MethodPost, "/api/channel/copy/"+ownA1, "", fixture.supplierA, params, CopyChannel)
	assert.Empty(t, channelState(t, createdChannelID(t, response)).Channel.GetSetting().RequestPlugins)

	// An edit that does not submit the setting leaves the binding alone.
	response = channelSupplierRequest(t, http.MethodPut, "/api/channel/", `{"id":`+ownA1+`,"name":"renamed"}`, fixture.supplierA, nil, UpdateChannel)
	assert.Contains(t, response.Body.String(), `"success":true`)
	assert.Equal(t, "renamed", channelState(t, fixture.ownA1.Id).Channel.Name)
}

func TestSupplierChannelEditTakesOnlyExactFieldNames(t *testing.T) {
	fixture := setupChannelSupplierTest(t)
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{request_plugin_setting.InstancesOption: `[{"id":"inst-1","name":"One","plugin":"rp-one"},{"id":"inst-2","name":"Two","plugin":"rp-two"}]`}))
	t.Cleanup(func() {
		require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{request_plugin_setting.InstancesOption: "[]"}))
	})
	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", fixture.ownA1.Id).Update("setting", `{"request_plugins":["inst-1"]}`).Error)
	ownA1Before := channelState(t, fixture.ownA1.Id)
	ownA1 := strconv.Itoa(fixture.ownA1.Id)

	// The body fills the channel by field names in any letter case, while the
	// setting and status checks read the keys as spelled; a supplier's edit
	// with any other spelling of a field is refused whole.
	for _, fields := range []string{
		`"Setting":"{\"request_plugins\":[\"rp_missing\"]}"`,
		`"Setting":"{\"request_plugins\":[\"inst-1\",\"inst-2\"]}"`,
		`"SETTING":"{\"request_plugins\":[]}"`,
		`"type":60,"base_url":"http://127.0.0.1:1","Setting":"{\"task_extend_plugin_keys\":[\"probe-ext\"]}"`,
		`"Status":2`,
	} {
		response := channelSupplierRequest(t, http.MethodPut, "/api/channel/", `{"id":`+ownA1+`,`+fields+`}`, fixture.supplierA, nil, UpdateChannel)
		assert.JSONEq(t, `{"success":false,"message":"Invalid parameters","message_key":"Invalid parameters"}`, response.Body.String(), fields)
	}
	assert.Equal(t, ownA1Before, channelState(t, fixture.ownA1.Id))

	// A change of the task plugin bindings under the exact name gets the
	// refusal of creating such a channel, before validation can tell whether
	// that plugin exists.
	added := channelSupplierRequest(t, http.MethodPost, "/api/channel",
		`{"mode":"single","channel":{"type":60,"name":"gateway","key":"sk-gateway","models":"m","group":"default","base_url":"http://127.0.0.1:1","setting":"{\"task_extend_plugin_keys\":[\"probe-ext\"]}"}}`,
		fixture.supplierA, nil, AddChannel)
	require.Contains(t, added.Body.String(), "task_plugin.bind")
	updated := channelSupplierRequest(t, http.MethodPut, "/api/channel/",
		`{"id":`+ownA1+`,"type":60,"base_url":"http://127.0.0.1:1","setting":"{\"request_plugins\":[\"inst-1\"],\"task_extend_plugin_keys\":[\"probe-ext\"]}"}`,
		fixture.supplierA, nil, UpdateChannel)
	assert.Equal(t, added.Code, updated.Code)
	assert.JSONEq(t, added.Body.String(), updated.Body.String())
	assert.Equal(t, ownA1Before, channelState(t, fixture.ownA1.Id))

	// Every field the edit form sends, spelled exactly, goes through.
	response := channelSupplierRequest(t, http.MethodPut, "/api/channel/", `{"id":`+ownA1+`,"name":"edited","type":1,"base_url":"","openai_organization":"",`+
		`"models":"m-a1,m-shared","group":"default","model_mapping":"","priority":100,"weight":0,"test_model":"","auto_ban":1,"status_code_mapping":"",`+
		`"tag":"shared","remark":"","setting":"{\"request_plugins\":[\"inst-1\"]}","param_override":"","header_override":"","settings":"{}","other":"",`+
		`"multi_key_mode":"random","key_mode":"append"}`, fixture.supplierA, nil, UpdateChannel)
	assert.Contains(t, response.Body.String(), `"success":true`)
	assert.Equal(t, "edited", channelState(t, fixture.ownA1.Id).Channel.Name)

	// Administrators keep the old handling of another spelling: root's edit
	// goes through, and an administrator without sensitive_write still gets
	// the refusal of the sensitivity check.
	response = channelSupplierRequest(t, http.MethodPut, "/api/channel/", `{"id":`+ownA1+`,"Setting":"{\"request_plugins\":[\"inst-2\"]}"}`, fixture.root, nil, UpdateChannel)
	assert.Contains(t, response.Body.String(), `"success":true`)
	assert.Equal(t, []string{"inst-2"}, channelState(t, fixture.ownA1.Id).Channel.GetSetting().RequestPlugins)
	response = channelSupplierRequest(t, http.MethodPut, "/api/channel/", `{"id":`+ownA1+`,"Name":"renamed-by-admin"}`, fixture.admin, nil, UpdateChannel)
	assert.Contains(t, response.Body.String(), "Unauthorized, insufficient privileges")
}

func TestSupplierCannotPreviewTaskPluginModels(t *testing.T) {
	fixture := setupChannelSupplierTest(t)
	pluginType := strconv.Itoa(constant.ChannelTypeTaskPlugin)
	added := channelSupplierRequest(t, http.MethodPost, "/api/channel",
		`{"mode":"single","channel":{"type":`+pluginType+`,"name":"plugin","key":"sk-plugin","models":"m","group":"default","setting":"{\"task_plugin_key\":\"some-plugin\"}"}}`,
		fixture.supplierA, nil, AddChannel)
	require.Contains(t, added.Body.String(), "task_plugin.bind")

	preview := channelSupplierRequest(t, http.MethodPost, "/api/channel/fetch_models",
		`{"type":`+pluginType+`,"task_plugin_key":"some-plugin","base_url":"http://127.0.0.1:1"}`, fixture.supplierA, nil, FetchModels)
	assert.Equal(t, added.Code, preview.Code)
	assert.JSONEq(t, added.Body.String(), preview.Body.String())
}

func TestSupplierChannelAddressesAreChecked(t *testing.T) {
	fixture := setupChannelSupplierTest(t)
	fetchSetting := system_setting.GetFetchSetting()
	originalFetchSetting := *fetchSetting
	t.Cleanup(func() { *fetchSetting = originalFetchSetting })
	fetchSetting.EnableSSRFProtection, fetchSetting.AllowPrivateIp = true, false
	fetchSetting.DomainFilterMode, fetchSetting.IpFilterMode = false, false
	fetchSetting.DomainList, fetchSetting.IpList = nil, nil
	fetchSetting.AllowedPorts, fetchSetting.ApplyIPFilterForDomain = []string{"80", "443"}, true
	var hits atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits.Add(1)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"object":"list","data":[{"id":"m-upstream"}]}`))
	}))
	t.Cleanup(upstream.Close)

	// A supplier's channel is saved without an address fetch_setting refuses;
	// an administrator's is saved as before.
	channelsBefore := countChannels(t)
	const internalChannel = `{"mode":"single","channel":{"type":1,"name":"internal","key":"sk-internal","models":"m","group":"default","base_url":"http://127.0.0.1:18080"}}`
	response := channelSupplierRequest(t, http.MethodPost, "/api/channel", internalChannel, fixture.supplierA, nil, AddChannel)
	assert.Contains(t, response.Body.String(), "Base URL is not allowed")
	assert.Equal(t, channelsBefore, countChannels(t))
	createdChannelID(t, channelSupplierRequest(t, http.MethodPost, "/api/channel", internalChannel, fixture.admin, nil, AddChannel))

	ownA1, adminOwned := strconv.Itoa(fixture.ownA1.Id), strconv.Itoa(fixture.adminOwned.Id)
	ownA1Before := channelState(t, fixture.ownA1.Id)
	response = channelSupplierRequest(t, http.MethodPut, "/api/channel/", `{"id":`+ownA1+`,"setting":"{\"proxy\":\"http://127.0.0.1:1080\"}"}`, fixture.supplierA, nil, UpdateChannel)
	assert.Contains(t, response.Body.String(), "Proxy is not allowed")
	response = channelSupplierRequest(t, http.MethodPut, "/api/channel/", `{"id":`+ownA1+`,"base_url":"http://127.0.0.1:18080"}`, fixture.supplierA, nil, UpdateChannel)
	assert.Contains(t, response.Body.String(), "Base URL is not allowed")
	assert.Equal(t, ownA1Before, channelState(t, fixture.ownA1.Id))

	// A refusal names neither the address nor the one the server resolved it
	// to: localhost resolves to a loopback address.
	for _, address := range []string{`"base_url":"http://localhost"`, `"setting":"{\"proxy\":\"http://localhost\"}"`} {
		response = channelSupplierRequest(t, http.MethodPost, "/api/channel",
			`{"mode":"single","channel":{"type":1,"name":"named","key":"sk-named","models":"m","group":"default",`+address+`}}`, fixture.supplierA, nil, AddChannel)
		assert.Contains(t, response.Body.String(), "is not allowed: the address is not allowed by the server's fetch policy", address)
		for _, named := range []string{"localhost", "127.0.0.1", "::1"} {
			assert.NotContains(t, response.Body.String(), named, address)
		}
	}

	// A model list preview is sent as a request of the asker's channel.
	advancedCustom := `{"advanced_routes":[{"incoming_path":"/v1/models","upstream_path":"/v1/models","converter":"none"}]}`
	for _, preview := range []fetchModelsRequest{
		{Type: constant.ChannelTypeOpenAI, Key: "sk-preview", BaseURL: &upstream.URL},
		{Type: constant.ChannelTypeAdvancedCustom, Key: "sk-preview", BaseURL: &upstream.URL, AdvancedCustom: &advancedCustom},
	} {
		body, err := common.Marshal(preview)
		require.NoError(t, err)
		response = channelSupplierRequest(t, http.MethodPost, "/api/channel/fetch_models", string(body), fixture.supplierA, nil, FetchModels)
		assert.Contains(t, response.Body.String(), `"success":false`)
		assert.Zero(t, hits.Load(), preview.Type)
		response = channelSupplierRequest(t, http.MethodPost, "/api/channel/fetch_models", string(body), fixture.admin, nil, FetchModels)
		assert.Contains(t, response.Body.String(), `"success":true`)
		assert.Positive(t, hits.Swap(0), preview.Type)
	}

	// Whoever starts it, a request of a supplier's channel is checked, and one
	// of an administrator's channel goes out as before.
	require.NoError(t, model.DB.Model(&model.User{}).Where("id = ?", fixture.admin.Id).Update("setting", `{"accept_unset_model_ratio_model":true}`).Error)
	balanceRoute := `{"advanced_custom":{"advanced_routes":[{"incoming_path":"/v1/dashboard/billing/credit_grants","upstream_path":"/balance","converter":"none"}]}}`
	codexKey := `{"access_token":"at","account_id":"account"}`
	for _, test := range []struct {
		name, method, target, body string
		channelType                int
		key, settings              string
		// supplierResponse is in the response for the supplier's channel,
		// `"success":false` when empty.
		supplierResponse string
		handler          gin.HandlerFunc
	}{
		{name: "fetch upstream models", method: http.MethodGet, target: "/api/channel/fetch_models/{id}", channelType: constant.ChannelTypeOpenAI, handler: FetchUpstreamModels},
		{name: "fetch Gemini models", method: http.MethodGet, target: "/api/channel/fetch_models/{id}", channelType: constant.ChannelTypeGemini, handler: FetchUpstreamModels},
		{name: "fetch Ollama models", method: http.MethodGet, target: "/api/channel/fetch_models/{id}", channelType: constant.ChannelTypeOllama, handler: FetchUpstreamModels},
		{name: "Ollama version", method: http.MethodGet, target: "/api/channel/ollama/version/{id}", channelType: constant.ChannelTypeOllama, handler: OllamaVersion},
		{name: "test", method: http.MethodGet, target: "/api/channel/test/{id}", channelType: constant.ChannelTypeOpenAI, handler: TestChannel},
		{name: "update balance", method: http.MethodGet, target: "/api/channel/update_balance/{id}", channelType: constant.ChannelTypeOpenAI, handler: UpdateChannelBalance},
		{name: "update Advanced Custom balance", method: http.MethodGet, target: "/api/channel/update_balance/{id}", channelType: constant.ChannelTypeAdvancedCustom, settings: balanceRoute, handler: UpdateChannelBalance},
		{name: "detect upstream updates", method: http.MethodPost, target: "/api/channel/upstream_updates/detect", body: `{"id":{id}}`, channelType: constant.ChannelTypeOpenAI, handler: DetectChannelUpstreamModelUpdates},
		{name: "vLLM status", method: http.MethodGet, target: "/api/channel/{id}/vllm/status", channelType: constant.ChannelTypeVLLM, supplierResponse: `"request_failed"`, handler: GetVLLMChannelStatus},
		{name: "Codex usage", method: http.MethodGet, target: "/api/channel/{id}/codex/usage", channelType: constant.ChannelTypeCodex, key: codexKey, handler: GetCodexChannelUsage},
	} {
		t.Run(test.name, func(t *testing.T) {
			send := func(channel *model.Channel) string {
				updates := map[string]any{"type": test.channelType, "base_url": upstream.URL, "key": "sk-" + channel.Name, "setting": "", "settings": test.settings}
				if test.key != "" {
					updates["key"] = test.key
				}
				require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", channel.Id).Updates(updates).Error)
				id := strconv.Itoa(channel.Id)
				return channelSupplierRequest(t, test.method, strings.ReplaceAll(test.target, "{id}", id), strings.ReplaceAll(test.body, "{id}", id),
					fixture.admin, gin.Params{{Key: "id", Value: id}}, test.handler).Body.String()
			}
			hits.Store(0)
			assert.Contains(t, send(fixture.ownA1), cmp.Or(test.supplierResponse, `"success":false`), "supplier channel")
			assert.Zero(t, hits.Load(), "supplier channel")
			send(fixture.adminOwned)
			assert.Positive(t, hits.Load(), "administrator channel")
		})
	}

	// The scheduled upstream model check reads the channels itself.
	checked := map[string]any{"type": constant.ChannelTypeOpenAI, "base_url": upstream.URL, "key": "sk-checked", "setting": "", "settings": `{"upstream_model_update_check_enabled":true}`}
	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", fixture.ownA1.Id).Updates(checked).Error)
	hits.Store(0)
	runChannelUpstreamModelUpdateTaskOnce(context.Background(), true, false, nil)
	assert.Zero(t, hits.Load())
	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", fixture.adminOwned.Id).Updates(checked).Error)
	runChannelUpstreamModelUpdateTaskOnce(context.Background(), true, false, nil)
	assert.Positive(t, hits.Swap(0))

	// So does root's price sync from the channels it names, by ID or, as the
	// web page does, as upstreams; {id} stands for the channel ID.
	for _, body := range []string{
		`{"channel_ids":[{id}]}`,
		`{"upstreams":[{"id":{id},"name":"named","base_url":"` + upstream.URL + `","endpoint":""}]}`,
	} {
		hits.Store(0)
		response = channelSupplierRequest(t, http.MethodPost, "/api/ratio_sync/fetch", strings.ReplaceAll(body, "{id}", ownA1), fixture.root, nil, FetchUpstreamRatios)
		assert.Zero(t, hits.Load(), response.Body.String())
		channelSupplierRequest(t, http.MethodPost, "/api/ratio_sync/fetch", strings.ReplaceAll(body, "{id}", adminOwned), fixture.root, nil, FetchUpstreamRatios)
		assert.Positive(t, hits.Load(), body)
	}

	// With its port allowed, the private address of a supplier's channel is
	// still refused, for a reason that names no address.
	upstreamAddress, err := url.Parse(upstream.URL)
	require.NoError(t, err)
	fetchSetting.AllowedPorts = []string{"80", "443", upstreamAddress.Port()}
	hits.Store(0)
	response = channelSupplierRequest(t, http.MethodGet, "/api/channel/fetch_models/"+ownA1, "", fixture.supplierA, gin.Params{{Key: "id", Value: ownA1}}, FetchUpstreamModels)
	assert.Contains(t, response.Body.String(), "outbound request blocked by the server's fetch policy")
	assert.NotContains(t, response.Body.String(), "private IP address not allowed")
	assert.Zero(t, hits.Load())
}

// forEachChannelCacheMode runs test once with channel reads going to the
// database and once with them going to the memory cache.
func forEachChannelCacheMode(t *testing.T, test func(t *testing.T)) {
	t.Helper()
	for _, memoryCache := range []bool{false, true} {
		t.Run("memory cache "+strconv.FormatBool(memoryCache), func(t *testing.T) {
			common.MemoryCacheEnabled = memoryCache
			t.Cleanup(func() {
				common.MemoryCacheEnabled = false
				model.InitChannelCache()
			})
			model.InitChannelCache()
			test(t)
		})
	}
}

func TestSupplierChannelsNeverServeRelay(t *testing.T) {
	fixture := setupChannelSupplierTest(t)
	affinity := operation_setting.GetChannelAffinitySetting()
	previousAffinity := *affinity
	t.Cleanup(func() { *affinity = previousAffinity })
	// A session keeps its binding to a channel that cannot serve it, so every
	// round of checks meets the binding.
	*affinity = operation_setting.ChannelAffinitySetting{
		Enabled: true, DefaultTTLSeconds: 60, MaxEntries: 100, KeepOnChannelDisabled: true,
		Rules: []operation_setting.ChannelAffinityRule{{
			Name: "session", ModelRegex: []string{"^m-shared$"}, SessionMode: "prefer",
			KeySources: []operation_setting.ChannelAffinityKeySource{{Type: "request_header", Key: "X-Session"}},
		}},
	}

	// ownA1 outranks adminOwned on m-shared, so a path that let it through
	// would pick it.
	assertNeverServed := func(t *testing.T) {
		for range 20 {
			channel, err := model.GetRandomSatisfiedChannel("default", "m-shared", 0, nil)
			require.NoError(t, err)
			require.NotNil(t, channel)
			assert.Equal(t, fixture.adminOwned.Id, channel.Id)
		}
		// Only supplier channels serve m-a2.
		channel, _ := model.GetRandomSatisfiedChannel("default", "m-a2", 0, nil)
		assert.Nil(t, channel)
		assert.False(t, model.IsChannelEnabledForGroupModel("default", "m-shared", fixture.ownA1.Id))

		pinned := newPinRetryContext()
		service.GetChannelConstraints(pinned).AddPin(dto.ChannelPin{ChannelId: fixture.ownA1.Id, Source: dto.PinSourceToken, Rank: dto.PinRankToken, RetryMode: dto.PinRetrySingleAttempt})
		_, _, selectErr := service.SelectChannelForRequest(pinned, "m-shared", &service.RetryParam{Ctx: pinned, TokenGroup: "default", ModelName: "m-shared"})
		require.NotNil(t, selectErr)
		assert.Equal(t, http.StatusForbidden, selectErr.StatusCode)
		assert.Equal(t, i18n.MsgDistributorChannelDisabled, selectErr.MessageID)

		// The session is bound to ownA1.
		session := newPinRetryContext()
		session.Request.Header.Set("X-Session", t.Name())
		selected, _, selectErr := service.SelectChannelForRequest(session, "m-shared", &service.RetryParam{Ctx: session, TokenGroup: "default", ModelName: "m-shared"})
		require.Nil(t, selectErr)
		require.NotNil(t, selected)
		assert.Equal(t, fixture.adminOwned.Id, selected.Id)
	}

	forEachChannelCacheMode(t, func(t *testing.T) {
		seed := newPinRetryContext()
		seed.Request.Header.Set("X-Session", t.Name())
		_, found := service.GetPreferredChannelByAffinity(seed, "m-shared", "default")
		require.False(t, found)
		service.RecordChannelAffinity(seed, fixture.ownA1.Id)
		t.Cleanup(func() { service.ClearCurrentChannelAffinityCache(seed) })
		// A scheduled plugin result rewrites ownA1, which stays enabled; each
		// subtest writes a reason of its own, so the result is never a no-op.
		_, err := model.UpdateScheduledChannelLocked(context.Background(), fixture.ownA1.Id, func(channel *model.Channel) error {
			channel.OtherInfo = `{"status_reason":` + strconv.Quote(t.Name()) + `}`
			return nil
		})
		require.NoError(t, err)
		assertNeverServed(t)

		// The channel stays a supplier channel after its creator is promoted.
		setSupplierARole := func(role int) {
			require.NoError(t, model.DB.Model(&model.User{}).Where("id = ?", fixture.supplierA.Id).Update("role", role).Error)
		}
		setSupplierARole(common.RoleAdminUser)
		t.Cleanup(func() { setSupplierARole(common.RoleChannelSupplierUser) })
		model.InitChannelCache()
		assertNeverServed(t)
	})

	// A channel that serves a model only under its routing name, as with
	// gizmos, is found by a second lookup, which keeps supplier channels out
	// too. The supplier's channel outranks the administrator's.
	t.Run("routing name", func(t *testing.T) {
		priority100, priority0 := int64(100), int64(0)
		supplierGizmo := &model.Channel{
			Type: 1, Key: "sk-supplier-gizmo", Name: "supplier-gizmo", Status: common.ChannelStatusEnabled,
			Models: "gpt-4-gizmo-*", Group: "default", Priority: &priority100,
			CreatorUserId: fixture.supplierA.Id, CreatorRole: common.RoleChannelSupplierUser,
		}
		adminGizmo := &model.Channel{
			Type: 1, Key: "sk-admin-gizmo", Name: "admin-gizmo", Status: common.ChannelStatusEnabled,
			Models: "gpt-4-gizmo-*", Group: "default", Priority: &priority0,
			CreatorUserId: fixture.admin.Id, CreatorRole: common.RoleAdminUser,
		}
		for _, channel := range []*model.Channel{supplierGizmo, adminGizmo} {
			require.NoError(t, channel.Insert())
			t.Cleanup(func() { deleteChannelWithAbilities(t, channel.Id) })
		}
		forEachChannelCacheMode(t, func(t *testing.T) {
			for range 20 {
				channel, err := model.GetRandomSatisfiedChannel("default", "gpt-4-gizmo-x", 0, nil)
				require.NoError(t, err)
				require.NotNil(t, channel)
				assert.Equal(t, adminGizmo.Id, channel.Id)
			}
			assert.False(t, model.IsChannelEnabledForGroupModel("default", "gpt-4-gizmo-x", supplierGizmo.Id))
		})
	})
}

func TestSupplierOnlyModelsStayOffCallerLists(t *testing.T) {
	fixture := setupChannelSupplierTest(t)
	require.NoError(t, model.DB.AutoMigrate(&model.Model{}, &model.Vendor{}))
	t.Cleanup(model.InvalidatePricingCache)
	// ownA1 outranks adminOwned on m-shared; a type of its own shows whether it
	// names the owner of m-shared.
	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", fixture.ownA1.Id).Update("type", constant.ChannelTypeAnthropic).Error)
	supplierOnly := []string{"m-a1", "m-a2", "m-b1"}

	forEachChannelCacheMode(t, func(t *testing.T) {
		callerModels := service.GetGroupsEnabledModels([]string{"default"})
		assert.Subset(t, callerModels, []string{"m-shared", "m-legacy", "m-admin"})
		for _, name := range supplierOnly {
			assert.NotContains(t, callerModels, name)
		}

		model.InvalidatePricingCache()
		pricedModels := lo.Map(model.GetPricing(), func(pricing model.Pricing, _ int) string { return pricing.ModelName })
		assert.Subset(t, pricedModels, []string{"m-shared", "m-legacy", "m-admin"})
		for _, name := range supplierOnly {
			assert.NotContains(t, pricedModels, name)
		}

		owners, err := model.GetPreferredModelOwnerChannelTypes([]string{"m-shared"}, []string{"default"})
		require.NoError(t, err)
		assert.Equal(t, map[string]int{"m-shared": fixture.adminOwned.Type}, owners)

		// The administrators' list keeps every enabled model.
		assert.Subset(t, model.GetEnabledModels(), supplierOnly)
	})
}

func TestSupplierChannelMappingsMakeNoTaskModelAliases(t *testing.T) {
	fixture := setupChannelSupplierTest(t)
	// Like Sora, each plugin serves its model through the OpenAI video protocol
	// and runs on OpenAI channels such as adminOwned.
	const pluginSource = `
export const meta = {
  apiVersion: 1, key: %[1]q, name: %[1]q, version: "1.0.0", author: {name: "Test"},
  channelTypes: [1], models: [%[2]q], fetchMode: "per_task", protocols: ["openai_video"]
};
export function buildSubmitRequest() { return {}; }
export function parseSubmitResponse() { return {}; }
export function buildQueryRequest() { return {}; }
export function parseTaskResult() { return {}; }
export function listArtifacts() { return []; }
export function buildContentRequest() { return {}; }
export const protocols = {openai_video: {decodeRequest: function() { return {}; }, render: function() { return {}; }}};
`
	for _, key := range []string{"alias-target-a", "alias-target-b"} {
		_, err := jsplugin.DefaultRegistry.Register(fmt.Sprintf(pluginSource, key, key+"-model"), jsplugin.Options{})
		require.NoError(t, err)
		t.Cleanup(func() { require.NoError(t, jsplugin.DefaultRegistry.Unregister(key)) })
	}
	mapModels := func(channel *model.Channel, mapping string) {
		require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", channel.Id).Update("model_mapping", mapping).Error)
		model.InitChannelCache()
	}
	alias := func(name string) (model.TaskAliasTarget, bool) {
		return model.ResolveTaskModelAlias(jsplugin.DefaultRegistry.Generation(), name)
	}
	// claimant names the plugin that claims a caller's video request for
	// modelName, or is empty when the request goes on as ordinary relay.
	claimant := func(modelName string) string {
		var claimedBy string
		router := gin.New()
		router.POST("/v1/videos", func(c *gin.Context) {
			common.SetContextKey(c, constant.ContextKeyUsingGroup, "default")
		}, middleware.RouteTaskPluginEndpoint(), func(c *gin.Context) {
			if endpoint, claimed := c.Get(jsplugin.ContextKeyPinnedEndpoint); claimed {
				claimedBy = endpoint.(jsplugin.PinnedEndpoint).Plugin.Meta.Key
			}
		})
		request := httptest.NewRequest(http.MethodPost, "/v1/videos", strings.NewReader(`{"model":"`+modelName+`"}`))
		request.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(httptest.NewRecorder(), request)
		return claimedBy
	}

	// A supplier's mapping makes no alias, so a caller's request for m-shared,
	// which adminOwned serves, stays ordinary relay.
	mapModels(fixture.ownA1, `{"m-shared":"alias-target-a-model"}`)
	_, found := alias("m-shared")
	assert.False(t, found)
	assert.Empty(t, claimant("m-shared"))

	// The same mapping on an administrator's channel makes the alias, as one on
	// a channel without a creator does.
	mapModels(fixture.adminOwned, `{"m-shared":"alias-target-a-model"}`)
	mapModels(fixture.legacy, `{"m-legacy":"alias-target-b-model"}`)
	adminAlias := model.TaskAliasTarget{Alias: "m-shared", Declared: "alias-target-a-model", PluginKey: "alias-target-a"}
	got, found := alias("m-shared")
	assert.True(t, found)
	assert.Equal(t, adminAlias, got)
	assert.Equal(t, "alias-target-a", claimant("m-shared"))
	got, found = alias("m-legacy")
	assert.True(t, found)
	assert.Equal(t, model.TaskAliasTarget{Alias: "m-legacy", Declared: "alias-target-b-model", PluginKey: "alias-target-b"}, got)

	// A supplier mapping the administrator's alias to another plugin leaves it
	// as it is.
	mapModels(fixture.ownA1, `{"m-shared":"alias-target-b-model"}`)
	got, found = alias("m-shared")
	assert.True(t, found)
	assert.Equal(t, adminAlias, got)
	assert.Equal(t, "alias-target-a", claimant("m-shared"))
}

func TestSupplierChannelsRefuseOriginTaskFollowUps(t *testing.T) {
	fixture := setupChannelSupplierTest(t)
	require.NoError(t, model.DB.AutoMigrate(&model.Task{}, &model.Midjourney{}))
	require.NoError(t, i18n.Init())
	service.InitHttpClient()
	var hits atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits.Add(1)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"code":1,"description":"ok","result":"seed"}`))
	}))
	t.Cleanup(upstream.Close)
	// Each channel has a task and a Midjourney task the follow-ups name.
	for _, channel := range []*model.Channel{fixture.ownA1, fixture.adminOwned} {
		require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", channel.Id).Update("base_url", upstream.URL).Error)
		task := &model.Task{TaskID: "task-" + channel.Name, UserId: fixture.admin.Id, ChannelId: channel.Id, Status: model.TaskStatusSuccess}
		midjourneyTask := &model.Midjourney{MjId: "mj-" + channel.Name, UserId: fixture.admin.Id, ChannelId: channel.Id, Status: "SUCCESS"}
		require.NoError(t, model.DB.Create(task).Error)
		require.NoError(t, model.DB.Create(midjourneyTask).Error)
		t.Cleanup(func() {
			require.NoError(t, model.DB.Delete(task).Error)
			require.NoError(t, model.DB.Delete(midjourneyTask).Error)
		})
	}
	originTaskPin := func(channel *model.Channel) dto.ChannelPin {
		return dto.ChannelPin{ChannelId: channel.Id, Source: dto.PinSourceOriginTask, Rank: dto.PinRankOriginTask, RetryMode: dto.PinRetrySameChannel}
	}

	// refused reports whether the follow-up of a task on channel was refused
	// the way a follow-up on a disabled channel is.
	for _, test := range []struct {
		name    string
		refused func(t *testing.T, channel *model.Channel) bool
	}{
		{name: "origin task pin", refused: func(t *testing.T, channel *model.Channel) bool {
			c := newPinRetryContext()
			service.GetChannelConstraints(c).AddPin(originTaskPin(channel))
			selected, _, selectErr := service.SelectChannelForRequest(c, "m-shared", &service.RetryParam{Ctx: c, TokenGroup: "default", ModelName: "m-shared"})
			if selectErr != nil {
				return selectErr.Code == "origin_task_channel_disabled"
			}
			assert.Equal(t, channel.Id, selected.Id)
			return false
		}},
		{name: "same channel retry", refused: func(t *testing.T, channel *model.Channel) bool {
			c := newPinRetryContext()
			service.GetChannelConstraints(c).AddPin(originTaskPin(channel))
			info := &relaycommon.RelayInfo{}
			if taskErr := relay.ApplyChannelPin(c, info); taskErr != nil {
				return taskErr.Code == "origin_task_channel_disabled"
			}
			assert.Equal(t, channel.Id, info.LockedChannel.(*model.Channel).Id)
			return false
		}},
		{name: "task continuation", refused: func(t *testing.T, channel *model.Channel) bool {
			info := &relaycommon.RelayInfo{
				UserId: fixture.admin.Id, OriginModelName: "m-shared",
				ChannelMeta: &relaycommon.ChannelMeta{}, TaskRelayInfo: &relaycommon.TaskRelayInfo{OriginTaskID: "task-" + channel.Name},
			}
			if taskErr := relay.ResolveOriginTask(newPinRetryContext(), info); taskErr != nil {
				return taskErr.Code == "task_channel_disable"
			}
			assert.Equal(t, channel.Id, info.LockedChannel.(*model.Channel).Id)
			return false
		}},
		{name: "Midjourney image seed", refused: func(t *testing.T, channel *model.Channel) bool {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest(http.MethodGet, "/mj/task/mj-"+channel.Name+"/image-seed", nil)
			c.Params = gin.Params{{Key: "id", Value: "mj-" + channel.Name}}
			c.Set("id", fixture.admin.Id)
			response := relay.RelayMidjourneyTaskImageSeed(c)
			if response != nil && response.Description == i18n.T(c, i18n.MsgRelayTaskChannelDisabled) {
				return true
			}
			// The seed is fetched from the task's channel.
			assert.EqualValues(t, 1, hits.Load())
			return false
		}},
		{name: "Midjourney action", refused: func(t *testing.T, channel *model.Channel) bool {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest(http.MethodPost, "/mj/submit/change", strings.NewReader(`{"taskId":"mj-`+channel.Name+`","action":"UPSCALE","index":1}`))
			c.Request.Header.Set("Content-Type", "application/json")
			response := relay.RelayMidjourneySubmit(c, &relaycommon.RelayInfo{UserId: fixture.admin.Id, RelayMode: relayconstant.RelayModeMidjourneyChange})
			if response != nil && response.Description == i18n.T(c, i18n.MsgRelayTaskChannelDisabled) {
				return true
			}
			// The action goes on with the task's channel and stops at the price
			// check, as no Midjourney price is set here.
			assert.Equal(t, channel.Id, c.GetInt("channel_id"))
			assert.Equal(t, upstream.URL, c.GetString("base_url"))
			return false
		}},
	} {
		t.Run(test.name, func(t *testing.T) {
			hits.Store(0)
			assert.True(t, test.refused(t, fixture.ownA1), "supplier channel")
			assert.Zero(t, hits.Load(), "supplier channel")
			assert.False(t, test.refused(t, fixture.adminOwned), "administrator channel")
		})
	}
}
