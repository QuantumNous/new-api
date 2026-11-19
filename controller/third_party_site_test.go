package controller

import (
	"bytes"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/samber/lo"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var thirdPartySiteActor = &model.User{Id: 1, Username: "site-admin", Role: common.RoleAdminUser}

type thirdPartySiteResult[T any] struct {
	Success    bool   `json:"success"`
	Message    string `json:"message"`
	MessageKey string `json:"message_key"`
	Field      string `json:"field"`
	Data       T      `json:"data"`
}

type thirdPartySitePage struct {
	Page     int                    `json:"page"`
	PageSize int                    `json:"page_size"`
	Total    int                    `json:"total"`
	Items    []model.ThirdPartySite `json:"items"`
}

func setupThirdPartySiteTest(t *testing.T) *gorm.DB {
	t.Helper()
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
	common.SQLitePath = filepath.Join(t.TempDir(), "third_party_site.db")
	require.NoError(t, model.InitDB())
	database := model.DB
	sqlDB, err := database.DB()
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, sqlDB.Close()) })
	model.LOG_DB = database
	common.SetLogDatabaseType(common.MainDatabaseType())
	require.NoError(t, database.AutoMigrate(&model.ThirdPartySite{}))
	clearSites := func() {
		require.NoError(t, database.Session(&gorm.Session{AllowGlobalUpdate: true}).Unscoped().Delete(&model.ThirdPartySite{}).Error)
	}
	clearSites()
	t.Cleanup(clearSites)
	versionQuery := "SELECT VERSION()"
	if common.UsingMainDatabase(common.DatabaseTypeSQLite) {
		versionQuery = "SELECT sqlite_version()"
	}
	var version string
	require.NoError(t, database.Raw(versionQuery).Scan(&version).Error)
	t.Logf("database=%s version=%s", common.MainDatabaseType(), version)
	return database
}

func thirdPartySiteBody(t *testing.T, overrides map[string]any) string {
	t.Helper()
	body := map[string]any{
		"name":                "Alpha",
		"type":                "newapi",
		"base_url":            "https://alpha.example.com",
		"remote_user_id":      7,
		"api_key":             "remote-access-token",
		"receivable_discount": 0.85,
	}
	for key, value := range overrides {
		if value == nil {
			delete(body, key)
			continue
		}
		body[key] = value
	}
	encoded, err := common.Marshal(body)
	require.NoError(t, err)
	return string(encoded)
}

func thirdPartySiteCall[T any](t *testing.T, method, target, body string, params gin.Params, handler gin.HandlerFunc) (string, thirdPartySiteResult[T]) {
	t.Helper()
	response := channelSupplierRequest(t, method, target, body, thirdPartySiteActor, params, handler)
	require.Equal(t, http.StatusOK, response.Code)
	var result thirdPartySiteResult[T]
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
	return response.Body.String(), result
}

func TestThirdPartySiteCreateValidation(t *testing.T) {
	db := setupThirdPartySiteTest(t)
	_, first := thirdPartySiteCall[model.ThirdPartySite](t, http.MethodPost, "/api/third_party_site/",
		thirdPartySiteBody(t, map[string]any{"name": "Alpha Site"}), nil, CreateThirdPartySite)
	require.True(t, first.Success, first.Message)

	const (
		urlKey      = "Base URL must be an http or https address without credentials, query or fragment"
		discountKey = "Receivable discount must be greater than 0 and at most 1, with at most 4 decimal places"
	)
	type validationCase struct {
		name      string
		overrides map[string]any
		rawBody   string
		key       string
		field     string
	}
	cases := []validationCase{
		{name: "blank name", overrides: map[string]any{"name": "  "}, key: "Site name is required", field: "name"},
		{name: "name too long", overrides: map[string]any{"name": strings.Repeat("站", 129)}, key: "Site name must not exceed 128 characters", field: "name"},
		{name: "duplicate name", overrides: map[string]any{"name": " alpha site "}, key: "A site with this name already exists", field: "name"},
		{name: "unsupported type", overrides: map[string]any{"type": "openai"}, key: "Unsupported site type", field: "type"},
		{name: "long base url", overrides: map[string]any{"base_url": "https://example.com/" + strings.Repeat("a", 1005)}, key: "Base URL must not exceed 1024 characters", field: "base_url"},
		{name: "remote user zero", overrides: map[string]any{"remote_user_id": 0}, key: "Remote user ID must be a positive integer", field: "remote_user_id"},
		{name: "remote user negative", overrides: map[string]any{"remote_user_id": -1}, key: "Remote user ID must be a positive integer", field: "remote_user_id"},
		{name: "blank api key", overrides: map[string]any{"api_key": "   "}, key: "ApiKey is required", field: "api_key"},
		{name: "missing api key", overrides: map[string]any{"api_key": nil}, key: "ApiKey is required", field: "api_key"},
		{name: "long api key", overrides: map[string]any{"api_key": strings.Repeat("k", 4097)}, key: "ApiKey must not exceed 4096 characters", field: "api_key"},
		{name: "malformed body", rawBody: "{", key: "Invalid parameters", field: ""},
	}
	for _, baseURL := range []string{"", "example.com", "ftp://example.com", "https://", "https://user:pass@example.com",
		"https://example.com/?", "https://example.com/#", "https://example.com/api?x=1", "https://example.com#top",
		"//example.com", "https://exa mple.com"} {
		cases = append(cases, validationCase{name: "base url " + baseURL, overrides: map[string]any{"base_url": baseURL}, key: urlKey, field: "base_url"})
	}
	for _, discount := range []float64{0, -0.5, 1.0001, 0.00005, 0.12345, 1e-10, 1e-11} {
		cases = append(cases, validationCase{name: fmt.Sprintf("discount %v", discount), overrides: map[string]any{"receivable_discount": discount}, key: discountKey, field: "receivable_discount"})
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			body := tc.rawBody
			if body == "" {
				body = thirdPartySiteBody(t, tc.overrides)
			}
			_, result := thirdPartySiteCall[any](t, http.MethodPost, "/api/third_party_site/", body, nil, CreateThirdPartySite)
			assert.False(t, result.Success)
			assert.Equal(t, tc.key, result.MessageKey)
			assert.Equal(t, tc.field, result.Field)
			var count int64
			require.NoError(t, db.Model(&model.ThirdPartySite{}).Count(&count).Error)
			assert.EqualValues(t, 1, count)
		})
	}
}

func TestThirdPartySiteCreateNormalizesAndHidesApiKey(t *testing.T) {
	db := setupThirdPartySiteTest(t)
	raw, result := thirdPartySiteCall[model.ThirdPartySite](t, http.MethodPost, "/api/third_party_site/",
		thirdPartySiteBody(t, map[string]any{
			"name":                "  Alpha  ",
			"base_url":            "  https://Example.com/newapi//  ",
			"api_key":             "  remote-access-token  ",
			"receivable_discount": 0.3,
		}), nil, CreateThirdPartySite)
	require.True(t, result.Success, result.Message)
	assert.Equal(t, "Alpha", result.Data.Name)
	assert.Equal(t, "https://Example.com/newapi", result.Data.BaseURL)
	assert.Equal(t, 0.3, result.Data.ReceivableDiscount)
	assert.Equal(t, 7, result.Data.RemoteUserID)
	assert.Positive(t, result.Data.CreatedTime)
	assert.Equal(t, result.Data.CreatedTime, result.Data.UpdatedTime)
	assert.NotContains(t, raw, "api_key")
	assert.NotContains(t, raw, "remote-access-token")
	var stored model.ThirdPartySite
	require.NoError(t, db.First(&stored, result.Data.Id).Error)
	assert.Equal(t, "remote-access-token", stored.ApiKey)
	assert.Equal(t, 0.3, stored.ReceivableDiscount)

	for _, overrides := range []map[string]any{
		{"name": strings.Repeat("站", 128)},
		{"name": "Beta", "receivable_discount": 0.0001},
		{"name": "Gamma", "receivable_discount": 1},
		{"name": "Zeta", "base_url": "https://example.com/" + strings.Repeat("a", 1004)},
		{"name": "Eta", "api_key": strings.Repeat("k", 4096)},
	} {
		_, r := thirdPartySiteCall[model.ThirdPartySite](t, http.MethodPost, "/api/third_party_site/",
			thirdPartySiteBody(t, overrides), nil, CreateThirdPartySite)
		assert.True(t, r.Success, r.Message)
	}

	_, rounded := thirdPartySiteCall[model.ThirdPartySite](t, http.MethodPost, "/api/third_party_site/",
		thirdPartySiteBody(t, map[string]any{"name": "Delta", "receivable_discount": 0.30000000000000004}), nil, CreateThirdPartySite)
	require.True(t, rounded.Success, rounded.Message)
	assert.Equal(t, 0.3, rounded.Data.ReceivableDiscount)
	var storedRounded model.ThirdPartySite
	require.NoError(t, db.First(&storedRounded, rounded.Data.Id).Error)
	assert.Equal(t, 0.3, storedRounded.ReceivableDiscount)

	_, plainHTTP := thirdPartySiteCall[model.ThirdPartySite](t, http.MethodPost, "/api/third_party_site/",
		thirdPartySiteBody(t, map[string]any{"name": "Epsilon", "base_url": "http://10.0.0.5:3000/"}), nil, CreateThirdPartySite)
	require.True(t, plainHTTP.Success, plainHTTP.Message)
	var storedHTTP model.ThirdPartySite
	require.NoError(t, db.First(&storedHTTP, plainHTTP.Data.Id).Error)
	assert.Equal(t, "http://10.0.0.5:3000", storedHTTP.BaseURL)
}

func TestThirdPartySiteListPagesNewestFirstWithoutApiKey(t *testing.T) {
	setupThirdPartySiteTest(t)
	for _, name := range []string{"S1", "S2", "S3"} {
		_, created := thirdPartySiteCall[model.ThirdPartySite](t, http.MethodPost, "/api/third_party_site/",
			thirdPartySiteBody(t, map[string]any{"name": name}), nil, CreateThirdPartySite)
		require.True(t, created.Success, created.Message)
	}
	raw, page := thirdPartySiteCall[thirdPartySitePage](t, http.MethodGet, "/api/third_party_site/?p=1&page_size=2", "", nil, GetThirdPartySites)
	require.True(t, page.Success, page.Message)
	assert.Equal(t, 3, page.Data.Total)
	assert.Equal(t, 1, page.Data.Page)
	assert.Equal(t, 2, page.Data.PageSize)
	assert.Equal(t, []string{"S3", "S2"}, lo.Map(page.Data.Items, func(s model.ThirdPartySite, _ int) string { return s.Name }))
	assert.NotContains(t, raw, "api_key")
	assert.NotContains(t, raw, "remote-access-token")

	_, second := thirdPartySiteCall[thirdPartySitePage](t, http.MethodGet, "/api/third_party_site/?p=2&page_size=2", "", nil, GetThirdPartySites)
	require.True(t, second.Success, second.Message)
	assert.Equal(t, []string{"S1"}, lo.Map(second.Data.Items, func(s model.ThirdPartySite, _ int) string { return s.Name }))
}

func TestThirdPartySiteWritesKeepApiKeyOutOfDebugSQLLog(t *testing.T) {
	setupThirdPartySiteTest(t)
	var sqlLog bytes.Buffer
	previous := model.DB
	model.DB = model.DB.Session(&gorm.Session{Logger: logger.New(log.New(&sqlLog, "", 0),
		logger.Config{LogLevel: logger.Info, ParameterizedQueries: false})})
	t.Cleanup(func() { model.DB = previous })
	require.NoError(t, model.DB.Create(&model.ThirdPartySite{Name: "Control", Type: model.ThirdPartySiteTypeNewAPI,
		BaseURL: "https://control.example.com", RemoteUserID: 1, ApiKey: "control-probe-key", ReceivableDiscount: 1}).Error)
	require.Contains(t, sqlLog.String(), "control-probe-key") // 对照组：证明日志器确实会打印参数值
	_, created := thirdPartySiteCall[model.ThirdPartySite](t, http.MethodPost, "/api/third_party_site/",
		thirdPartySiteBody(t, map[string]any{"api_key": "create-probe-key"}), nil, CreateThirdPartySite)
	require.True(t, created.Success, created.Message)
	assert.NotContains(t, sqlLog.String(), "create-probe-key")

	_, updated := thirdPartySiteCall[model.ThirdPartySite](t, http.MethodPut, fmt.Sprintf("/api/third_party_site/%d", created.Data.Id),
		thirdPartySiteBody(t, map[string]any{"api_key": "update-probe-key"}),
		gin.Params{{Key: "id", Value: strconv.Itoa(created.Data.Id)}}, UpdateThirdPartySite)
	require.True(t, updated.Success, updated.Message)
	assert.NotContains(t, sqlLog.String(), "update-probe-key")
}

func TestThirdPartySiteUpdate(t *testing.T) {
	db := setupThirdPartySiteTest(t)
	_, alpha := thirdPartySiteCall[model.ThirdPartySite](t, http.MethodPost, "/api/third_party_site/",
		thirdPartySiteBody(t, nil), nil, CreateThirdPartySite)
	require.True(t, alpha.Success, alpha.Message)
	_, beta := thirdPartySiteCall[model.ThirdPartySite](t, http.MethodPost, "/api/third_party_site/",
		thirdPartySiteBody(t, map[string]any{"name": "Beta"}), nil, CreateThirdPartySite)
	require.True(t, beta.Success, beta.Message)

	id := alpha.Data.Id
	target := fmt.Sprintf("/api/third_party_site/%d", id)
	params := gin.Params{{Key: "id", Value: strconv.Itoa(id)}}
	update := func(overrides map[string]any) (string, thirdPartySiteResult[model.ThirdPartySite]) {
		return thirdPartySiteCall[model.ThirdPartySite](t, http.MethodPut, target, thirdPartySiteBody(t, overrides), params, UpdateThirdPartySite)
	}
	stored := func() model.ThirdPartySite {
		var site model.ThirdPartySite
		require.NoError(t, db.First(&site, id).Error)
		return site
	}

	for _, tc := range []struct {
		apiKey   any
		discount float64
	}{{nil, 0.5}, {"", 0.6}, {"   ", 0.7}} {
		raw, r := update(map[string]any{"api_key": tc.apiKey, "receivable_discount": tc.discount})
		require.True(t, r.Success, r.Message)
		assert.NotContains(t, raw, "api_key")
		site := stored()
		assert.Equal(t, "remote-access-token", site.ApiKey)
		assert.Equal(t, tc.discount, site.ReceivableDiscount)
	}

	for range 2 {
		_, r := update(map[string]any{"api_key": " new-key "})
		require.True(t, r.Success, r.Message)
		assert.Equal(t, "new-key", stored().ApiKey)
	}

	_, renamed := update(map[string]any{"name": "ALPHA"})
	require.True(t, renamed.Success, renamed.Message)
	assert.Equal(t, "ALPHA", stored().Name)

	_, moved := update(map[string]any{"base_url": "https://alpha2.example.com/v1/", "remote_user_id": 8})
	require.True(t, moved.Success, moved.Message)
	movedSite := stored()
	assert.Equal(t, "https://alpha2.example.com/v1", movedSite.BaseURL)
	assert.Equal(t, 8, movedSite.RemoteUserID)

	_, duplicate := update(map[string]any{"name": " beta "})
	assert.False(t, duplicate.Success)
	assert.Equal(t, "A site with this name already exists", duplicate.MessageKey)
	assert.Equal(t, "name", duplicate.Field)

	_, badURL := update(map[string]any{"base_url": "ftp://example.com"})
	assert.False(t, badURL.Success)
	assert.Equal(t, "base_url", badURL.Field)

	_, missing := thirdPartySiteCall[any](t, http.MethodPut, "/api/third_party_site/999999", thirdPartySiteBody(t, nil),
		gin.Params{{Key: "id", Value: "999999"}}, UpdateThirdPartySite)
	assert.False(t, missing.Success)
	assert.Equal(t, "Site does not exist", missing.MessageKey)

	for _, badID := range []string{"abc", "0"} {
		_, r := thirdPartySiteCall[any](t, http.MethodPut, "/api/third_party_site/"+badID, thirdPartySiteBody(t, nil),
			gin.Params{{Key: "id", Value: badID}}, UpdateThirdPartySite)
		assert.False(t, r.Success)
		assert.Equal(t, "Invalid ID", r.MessageKey)
	}
}

func TestThirdPartySiteDelete(t *testing.T) {
	db := setupThirdPartySiteTest(t)
	_, created := thirdPartySiteCall[model.ThirdPartySite](t, http.MethodPost, "/api/third_party_site/",
		thirdPartySiteBody(t, nil), nil, CreateThirdPartySite)
	require.True(t, created.Success, created.Message)
	id := created.Data.Id
	target := fmt.Sprintf("/api/third_party_site/%d", id)
	params := gin.Params{{Key: "id", Value: strconv.Itoa(id)}}

	_, deleted := thirdPartySiteCall[any](t, http.MethodDelete, target, "", params, DeleteThirdPartySite)
	require.True(t, deleted.Success, deleted.Message)
	_, page := thirdPartySiteCall[thirdPartySitePage](t, http.MethodGet, "/api/third_party_site/", "", nil, GetThirdPartySites)
	require.True(t, page.Success, page.Message)
	assert.Equal(t, 0, page.Data.Total)

	var stored model.ThirdPartySite
	require.NoError(t, db.Unscoped().First(&stored, id).Error)
	assert.True(t, stored.DeletedAt.Valid)
	assert.Empty(t, stored.ApiKey)
	assert.Equal(t, "Alpha", stored.Name)

	_, again := thirdPartySiteCall[model.ThirdPartySite](t, http.MethodPost, "/api/third_party_site/",
		thirdPartySiteBody(t, nil), nil, CreateThirdPartySite)
	assert.True(t, again.Success, again.Message)

	_, deletedTwice := thirdPartySiteCall[any](t, http.MethodDelete, target, "", params, DeleteThirdPartySite)
	assert.False(t, deletedTwice.Success)
	assert.Equal(t, "Site does not exist", deletedTwice.MessageKey)
	_, edited := thirdPartySiteCall[any](t, http.MethodPut, target, thirdPartySiteBody(t, nil), params, UpdateThirdPartySite)
	assert.False(t, edited.Success)
	assert.Equal(t, "Site does not exist", edited.MessageKey)

	for _, badID := range []string{"abc", "0"} {
		_, r := thirdPartySiteCall[any](t, http.MethodDelete, "/api/third_party_site/"+badID, "", gin.Params{{Key: "id", Value: badID}}, DeleteThirdPartySite)
		assert.False(t, r.Success)
		assert.Equal(t, "Invalid ID", r.MessageKey)
	}
}
