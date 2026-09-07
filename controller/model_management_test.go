package controller

import (
	"bytes"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func modelManagementDB(t *testing.T, kind, dsn string) *gorm.DB {
	t.Helper()
	database, isolatedDSN := newAuditTestDatabase(t, kind, dsn)
	previousDB, previousLogDB := model.DB, model.LOG_DB
	previousMain, previousLog := common.MainDatabaseType(), common.LogDatabaseType()
	previousMaster, previousSQLite := common.IsMasterNode, common.SQLitePath
	previousRedis, previousMemory := common.RedisEnabled, common.MemoryCacheEnabled
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
	common.IsMasterNode = false
	common.RedisEnabled, common.MemoryCacheEnabled = false, false
	common.OptionMap = map[string]string{}
	if kind == "sqlite" {
		common.SQLitePath = isolatedDSN
		isolatedDSN = "local"
	}
	t.Setenv("SQL_DSN", isolatedDSN)
	t.Setenv("LOG_SQL_DSN", "")
	require.NoError(t, model.InitDB())
	database = model.DB
	model.LOG_DB = database
	require.NoError(t, database.AutoMigrate(&model.Model{}, &model.Vendor{}, &model.Channel{}, &model.Ability{}, &model.Option{}, &model.User{}, &model.AuditLog{}))
	for _, value := range restoreRatios {
		require.NoError(t, value.restore("{}"))
	}
	config.UpdateConfigFromMap(config.GlobalConfig.Get("billing_setting"), map[string]string{"billing_mode": "{}", "billing_expr": "{}"})
	var version string
	query := "SELECT version()"
	if kind == "sqlite" {
		query = "SELECT sqlite_version()"
	}
	require.NoError(t, database.Raw(query).Scan(&version).Error)
	t.Logf("database version: %s", version)
	t.Cleanup(func() {
		for _, value := range restoreRatios {
			require.NoError(t, value.restore(value.value))
		}
		config.UpdateConfigFromMap(config.GlobalConfig.Get("billing_setting"), map[string]string{"billing_mode": previousConfig["billing_setting.billing_mode"], "billing_expr": previousConfig["billing_setting.billing_expr"]})
		common.OptionMap = previousOptions
		common.IsMasterNode, common.SQLitePath = previousMaster, previousSQLite
		common.RedisEnabled, common.MemoryCacheEnabled = previousRedis, previousMemory
		common.SetDatabaseTypes(previousMain, previousLog)
		connection, err := database.DB()
		if err == nil {
			require.NoError(t, connection.Close())
		}
		model.DB, model.LOG_DB = previousDB, previousLogDB
	})
	return database
}

func modelManagementRequest(t *testing.T, handler gin.HandlerFunc, method, path string, body any, output any) *httptest.ResponseRecorder {
	t.Helper()
	encoded, err := common.Marshal(body)
	require.NoError(t, err)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(method, path, bytes.NewReader(encoded))
	context.Set("role", common.RoleRootUser)
	handler(context)
	if output != nil {
		require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), output), recorder.Body.String())
	}
	return recorder
}

func TestModelManagementDatabaseMatrix(t *testing.T) {
	_, err := jsplugin.DefaultRegistry.Register(`
export const meta = {apiVersion: 1, key: "model-management-task", name: "Management task fixture", version: "1.0.0", author: {name: "Test"}, models: ["matrix-task"], fetchMode: "per_task", usageSchema: {seconds: {type: "number", unit: "second"}}};
export function buildSubmitRequest() { return {}; }
export function parseSubmitResponse() { return {}; }
export function buildQueryRequest() { return {}; }
export function parseTaskResult() { return {}; }
`, jsplugin.Options{})
	require.NoError(t, err)
	t.Cleanup(func() { jsplugin.DefaultRegistry.Unregister("model-management-task") })
	for _, dialect := range []struct{ kind, env string }{{"sqlite", ""}, {"mysql", "TEST_MYSQL_DSN"}, {"postgres", "TEST_POSTGRES_DSN"}} {
		t.Run(dialect.kind, func(t *testing.T) {
			if dialect.env != "" && os.Getenv(dialect.env) == "" {
				t.Skip("set " + dialect.env + " to run this database")
			}
			db := modelManagementDB(t, dialect.kind, os.Getenv(dialect.env))
			t.Run("pricing_saves_zero_switches_modes_and_rejects_stale_batches", func(t *testing.T) {
				before, err := model.GetModelPricingSnapshot([]string{"matrix-priced", "matrix-other"})
				require.NoError(t, err)
				changes := []model.ModelPricingChange{
					{ModelName: "matrix-priced", ExpectedVersion: before.EmptyVersion, Pricing: model.PricingValues{"ModelPrice": float64(0), "billing_setting.billing_mode": "ratio"}},
					{ModelName: "matrix-other", ExpectedVersion: before.EmptyVersion, Pricing: model.PricingValues{"ModelRatio": float64(1), "CreateCacheRatio": 1.25}},
				}
				require.NoError(t, model.UpdateModelPricing(changes))
				loaded, err := model.GetModelPricingSnapshot([]string{"matrix-priced"})
				require.NoError(t, err)
				assert.Equal(t, float64(0), loaded.Entries[0].Effective["ModelPrice"])
				stale := changes[0]
				changes[0].ExpectedVersion = loaded.Entries[0].Version
				changes[0].Pricing = model.PricingValues{"billing_setting.billing_mode": "tiered_expr", "billing_setting.billing_expr": `tier("base", p * 2 + c * 8 + cr * 0 + cc * 2.5)`, "ModelRatio": float64(1)}
				require.NoError(t, model.UpdateModelPricing(changes[:1]))
				loaded, err = model.GetModelPricingSnapshot([]string{"matrix-priced", "matrix-other"})
				require.NoError(t, err)
				assert.Equal(t, 1.25, loaded.Entries[0].Configured["CreateCacheRatio"])
				assert.Equal(t, "tiered_expr", loaded.Entries[1].Effective["billing_setting.billing_mode"])
				_, oldFixed := loaded.Entries[1].Configured["ModelPrice"]
				assert.False(t, oldFixed)
				other := model.ModelPricingChange{ModelName: "matrix-other", ExpectedVersion: loaded.Entries[0].Version, Pricing: model.PricingValues{"ModelRatio": float64(9)}}
				err = model.UpdateModelPricing([]model.ModelPricingChange{other, stale})
				assert.ErrorIs(t, err, model.ErrModelPricingConflict)
				after, err := model.GetModelPricingSnapshot([]string{"matrix-priced", "matrix-other"})
				require.NoError(t, err)
				assert.Equal(t, loaded.Entries, after.Entries)
				invalid := other
				invalid.Pricing = model.PricingValues{"ModelPrice": float64(-1)}
				assert.Error(t, model.UpdateModelPricing([]model.ModelPricingChange{invalid}))
				// A physical failure after earlier option writes must roll back all
				// rows and leave the previously published runtime price intact.
				writes := 0
				require.NoError(t, db.Callback().Update().Before("gorm:update").Register("fail_pricing_matrix", func(tx *gorm.DB) {
					if tx.Statement.Table == "options" {
						writes++
						if writes == 3 {
							tx.AddError(errors.New("injected write failure"))
						}
					}
				}))
				err = model.UpdateModelPricing([]model.ModelPricingChange{other})
				require.Error(t, err)
				require.NoError(t, db.Callback().Update().Remove("fail_pricing_matrix"))
				after, err = model.GetModelPricingSnapshot([]string{"matrix-priced", "matrix-other"})
				require.NoError(t, err)
				assert.Equal(t, loaded.Entries, after.Entries)
				ratio, _, _ := ratio_setting.GetModelRatio("matrix-other")
				assert.Equal(t, float64(1), ratio)
				// Two saves based on the same version cannot both succeed.
				var wg sync.WaitGroup
				results := make(chan error, 2)
				for _, value := range []float64{3, 4} {
					wg.Add(1)
					go func(value float64) {
						defer wg.Done()
						change := other
						change.Pricing = model.PricingValues{"ModelRatio": value}
						results <- model.UpdateModelPricing([]model.ModelPricingChange{change})
					}(value)
				}
				wg.Wait()
				close(results)
				successes, conflicts := 0, 0
				for err := range results {
					if err == nil {
						successes++
					} else if errors.Is(err, model.ErrModelPricingConflict) {
						conflicts++
					} else {
						require.NoError(t, err)
					}
				}
				assert.Equal(t, 1, successes)
				assert.Equal(t, 1, conflicts)
			})
			t.Run("task_usage_and_builtin_reset", func(t *testing.T) {
				snapshot, err := model.GetModelPricingSnapshot([]string{"matrix-task"})
				require.NoError(t, err)
				assert.Contains(t, snapshot.Entries[0].UsageSchema, "seconds")
				expression := `tier("base", u("seconds") * 0.25)`
				change := model.ModelPricingChange{ModelName: "matrix-task", ExpectedVersion: snapshot.Entries[0].Version, Pricing: model.PricingValues{"billing_setting.billing_mode": "tiered_expr", "billing_setting.billing_expr": expression}}
				require.NoError(t, model.UpdateModelPricing([]model.ModelPricingChange{change}))
				snapshot, err = model.GetModelPricingSnapshot([]string{"matrix-task"})
				require.NoError(t, err)
				assert.Equal(t, expression, snapshot.Entries[0].Effective["billing_setting.billing_expr"])
				change.ExpectedVersion = snapshot.Entries[0].Version
				change.Pricing["billing_setting.billing_expr"] = `tier("base", u("undeclared") * 1)`
				assert.Error(t, model.UpdateModelPricing([]model.ModelPricingChange{change}))
				{
					const name = "gpt-6-astra"
					builtin, exists := billing_setting.GetBuiltinBillingExpr(name)
					require.True(t, exists)
					before, err := model.GetModelPricingSnapshot([]string{name})
					require.NoError(t, err)
					require.Empty(t, before.Entries[0].Configured)
					change = model.ModelPricingChange{ModelName: name, ExpectedVersion: before.Entries[0].Version, Pricing: model.PricingValues{"ModelPrice": float64(0)}}
					require.NoError(t, model.UpdateModelPricing([]model.ModelPricingChange{change}))
					custom, err := model.GetModelPricingSnapshot([]string{name})
					require.NoError(t, err)
					assert.Equal(t, float64(0), custom.Entries[0].Effective["ModelPrice"])
					change.ExpectedVersion, change.Pricing, change.Reset = custom.Entries[0].Version, nil, true
					require.NoError(t, model.UpdateModelPricing([]model.ModelPricingChange{change}))
					reset, err := model.GetModelPricingSnapshot([]string{name})
					require.NoError(t, err)
					assert.Empty(t, reset.Entries[0].Configured)
					assert.Equal(t, builtin, reset.Entries[0].Effective["billing_setting.billing_expr"])
				}
			})
			t.Run("concurrent_import_creates_one_record", func(t *testing.T) {
				update := model.MetadataSyncUpdate{MetadataSyncSelection: model.MetadataSyncSelection{ModelName: "matrix-concurrent-import", RecordVersion: model.MetadataRecordVersion(nil, nil, nil), Create: true}, Values: model.MetadataValues{Description: "Imported", Status: 1}}
				var wg sync.WaitGroup
				results := make(chan error, 2)
				for i := 0; i < 2; i++ {
					wg.Add(1)
					go func() {
						defer wg.Done()
						_, err := model.ApplyMetadataSync([]model.MetadataSyncUpdate{update}, nil)
						results <- err
					}()
				}
				wg.Wait()
				close(results)
				successes, conflicts := 0, 0
				for err := range results {
					if err == nil {
						successes++
					} else if errors.Is(err, model.ErrMetadataSyncConflict) {
						conflicts++
					} else {
						require.NoError(t, err)
					}
				}
				assert.Equal(t, 1, successes)
				assert.Equal(t, 1, conflicts)
				var count int64
				require.NoError(t, db.Model(&model.Model{}).Where("model_name = ?", update.ModelName).Count(&count).Error)
				assert.EqualValues(t, 1, count)
			})
			t.Run("metadata_keeps_pricing_and_channel_identity", func(t *testing.T) {
				active := model.Channel{Name: "Active route", Type: 1, Status: common.ChannelStatusEnabled}
				disabled := model.Channel{Name: "Disabled route", Type: 1, Status: common.ChannelStatusManuallyDisabled}
				require.NoError(t, db.Create(&active).Error)
				require.NoError(t, db.Create(&disabled).Error)
				require.NoError(t, db.Create(&[]model.Ability{
					{Model: "matrix-hidden-unpriced", Group: "available", ChannelId: active.Id, Enabled: true},
					{Model: "matrix-hidden-unpriced", Group: "disabled", ChannelId: disabled.Id, Enabled: true},
					{Model: "matrix-hidden-unpriced", Group: "inactive", ChannelId: active.Id, Enabled: false},
				}).Error)
				exact := &model.Model{ModelName: "matrix-hidden-unpriced", Status: 0, SyncOfficial: 0}
				require.NoError(t, exact.Insert())
				rule := &model.Model{ModelName: "matrix-hidden-", NameRule: model.NameRulePrefix}
				enrichModels([]*model.Model{exact, rule})
				assert.Equal(t, []string{"available"}, exact.EnableGroups)
				assert.Equal(t, []model.BoundChannel{{Name: "Active route", Type: 1}}, exact.BoundChannels)
				assert.Equal(t, []string{"matrix-hidden-unpriced"}, rule.MatchedModels)
				assert.Empty(t, exact.Endpoints, "inferred endpoints must not become stored configuration")
				priceBefore, err := model.GetModelPricingSnapshot([]string{"matrix-hidden-unpriced"})
				require.NoError(t, err)
				require.NoError(t, model.UpdateModelPricing([]model.ModelPricingChange{{ModelName: exact.ModelName, ExpectedVersion: priceBefore.Entries[0].Version, Pricing: model.PricingValues{"ModelPrice": float64(0)}}}))
				exact.ModelName = "matrix-renamed"
				exact.Endpoints = `{"openai":{"path":"/v1/chat/completions","method":"POST"}}`
				response := modelManagementRequest(t, UpdateModelMeta, http.MethodPut, "/api/models/", exact, nil)
				assert.Contains(t, response.Body.String(), `"success":true`)
				var reloaded model.Model
				require.NoError(t, db.First(&reloaded, exact.Id).Error)
				enrichModels([]*model.Model{&reloaded})
				assert.Equal(t, exact.Endpoints, reloaded.Endpoints)
				assert.Empty(t, reloaded.BoundChannels)
				prices, err := model.GetModelPricingSnapshot([]string{"matrix-hidden-unpriced", "matrix-renamed"})
				require.NoError(t, err)
				assert.Equal(t, float64(0), prices.Entries[0].Configured["ModelPrice"])
				assert.Empty(t, prices.Entries[1].Configured)
				require.NoError(t, reloaded.Delete())
				require.NoError(t, model.UpdateModelPricing([]model.ModelPricingChange{{ModelName: "matrix-hidden-unpriced", ExpectedVersion: prices.Entries[0].Version, Reset: true}}))
				prices, err = model.GetModelPricingSnapshot([]string{"matrix-hidden-unpriced"})
				require.NoError(t, err)
				assert.Empty(t, prices.Entries[0].Configured)
				var ability model.Ability
				require.NoError(t, db.Where("model = ? AND channel_id = ? AND enabled = ?", "matrix-hidden-unpriced", active.Id, true).First(&ability).Error)
			})
			t.Run("metadata_preview_selection_versions_and_transaction", func(t *testing.T) {
				local := &model.Model{ModelName: "matrix-existing", Description: "Local description", Tags: "keep", Status: 1, SyncOfficial: 1}
				require.NoError(t, local.Insert())
				blocked := &model.Model{ModelName: "matrix-blocked", Status: 1, SyncOfficial: 0}
				require.NoError(t, blocked.Insert())
				require.NoError(t, db.Create(&model.Ability{Model: "matrix-new", Group: "default", ChannelId: 1, Enabled: true}).Error)
				var revision atomic.Int32
				var failVendors atomic.Bool
				upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					assert.Contains(t, r.URL.Path, "/api/i18n/zh/newapi/")
					var payload any
					if strings.HasSuffix(r.URL.Path, "vendors.json") {
						if failVendors.Load() {
							w.WriteHeader(http.StatusServiceUnavailable)
							return
						}
						payload = []upstreamVendor{{Name: "Matrix vendor", Status: 1}}
					} else {
						payload = []upstreamModel{
							{ModelName: "matrix-existing", Description: fmt.Sprintf("Upstream %d", revision.Load()), VendorName: "Matrix vendor", Tags: "changed", Status: 0, Endpoints: []byte(`{"openai":{"path":"/v1/chat/completions","method":"POST"}}`)},
							{ModelName: "matrix-new", Description: "New model", VendorName: "Matrix vendor", Status: 0, Endpoints: []byte(`{"openai":"/v1/chat/completions"}`)},
							{ModelName: "matrix-blocked", Description: "Do not overwrite", Status: 1},
							{ModelName: "matrix-catalog", Description: "Catalog only", Status: 1},
						}
					}
					encoded, err := common.Marshal(payload)
					require.NoError(t, err)
					_, _ = w.Write(encoded)
				}))
				defer upstream.Close()
				t.Setenv("SYNC_UPSTREAM_BASE", upstream.URL)
				t.Setenv("SYNC_HTTP_RETRY", "1")
				var preview struct {
					Success bool
					Data    struct {
						Source     SyncUpstreamSource
						Candidates []metadataSyncCandidate
					}
				}
				response := modelManagementRequest(t, SyncUpstreamPreview, "GET", "/api/models/sync_upstream/preview?locale=zh", nil, &preview)
				require.Equal(t, http.StatusOK, response.Code)
				require.True(t, preview.Success, response.Body.String())
				byName := make(map[string]metadataSyncCandidate)
				for _, candidate := range preview.Data.Candidates {
					byName[candidate.ModelName] = candidate
				}
				assert.Equal(t, "site", byName["matrix-new"].Scope)
				assert.Equal(t, "catalog", byName["matrix-catalog"].Scope)
				assert.Equal(t, "blocked", byName["matrix-blocked"].Kind)
				var count int64
				require.NoError(t, db.Model(&model.Vendor{}).Count(&count).Error)
				assert.Zero(t, count)
				body := map[string]any{"locale": "zh", "source_version": preview.Data.Source.Version, "selections": []model.MetadataSyncSelection{
					{ModelName: "matrix-existing", RecordVersion: byName["matrix-existing"].RecordVersion, Fields: []string{"description", "endpoints"}},
					{ModelName: "matrix-new", RecordVersion: byName["matrix-new"].RecordVersion, Create: true},
				}}
				beforePricing, err := model.GetModelPricingSnapshot([]string{"matrix-priced"})
				require.NoError(t, err)
				// A failed model insert must also undo the earlier metadata update
				// and the newly inserted supplier.
				require.NoError(t, db.Callback().Create().Before("gorm:create").Register("fail_metadata_matrix", func(tx *gorm.DB) {
					if tx.Statement.Table == "models" {
						tx.AddError(errors.New("injected metadata failure"))
					}
				}))
				response = modelManagementRequest(t, SyncUpstreamModels, "POST", "/api/models/sync_upstream", body, nil)
				assert.NotEqual(t, http.StatusOK, response.Code)
				require.NoError(t, db.Callback().Create().Remove("fail_metadata_matrix"))
				var persisted model.Model
				require.NoError(t, db.First(&persisted, local.Id).Error)
				assert.Equal(t, "Local description", persisted.Description)
				require.NoError(t, db.Model(&model.Vendor{}).Count(&count).Error)
				assert.Zero(t, count)
				var result struct {
					Success bool
					Data    model.MetadataSyncResult
				}
				response = modelManagementRequest(t, SyncUpstreamModels, "POST", "/api/models/sync_upstream", body, &result)
				require.Equal(t, http.StatusOK, response.Code, response.Body.String())
				require.True(t, result.Success)
				assert.Equal(t, []string{"matrix-new"}, result.Data.CreatedModels)
				assert.Equal(t, []string{"Matrix vendor"}, result.Data.CreatedVendors)
				require.NoError(t, db.First(&persisted, local.Id).Error)
				assert.Equal(t, "Upstream 0", persisted.Description)
				assert.Equal(t, "keep", persisted.Tags)
				assert.Equal(t, 1, persisted.Status)
				assert.Zero(t, persisted.VendorID)
				assert.JSONEq(t, `{"openai":{"path":"/v1/chat/completions","method":"POST"}}`, persisted.Endpoints)
				var created model.Model
				require.NoError(t, db.Where("model_name = ?", "matrix-new").First(&created).Error)
				assert.Equal(t, 1, created.SyncOfficial)
				assert.Zero(t, created.Status)
				afterPricing, err := model.GetModelPricingSnapshot([]string{"matrix-priced"})
				require.NoError(t, err)
				assert.Equal(t, beforePricing.Entries, afterPricing.Entries)
				response = modelManagementRequest(t, SyncUpstreamModels, "POST", "/api/models/sync_upstream", body, nil)
				assert.Equal(t, http.StatusConflict, response.Code)
				response = modelManagementRequest(t, SyncUpstreamModels, "POST", "/api/models/sync_upstream", map[string]any{}, nil)
				assert.Equal(t, http.StatusBadRequest, response.Code)
				body["selections"] = []model.MetadataSyncSelection{{ModelName: "matrix-blocked", RecordVersion: byName["matrix-blocked"].RecordVersion, Fields: []string{"description"}}}
				response = modelManagementRequest(t, SyncUpstreamModels, "POST", "/api/models/sync_upstream", body, nil)
				assert.Equal(t, http.StatusBadRequest, response.Code)
				revision.Add(1)
				response = modelManagementRequest(t, SyncUpstreamModels, "POST", "/api/models/sync_upstream", body, nil)
				assert.Equal(t, http.StatusConflict, response.Code)
				failVendors.Store(true)
				modelManagementRequest(t, SyncUpstreamPreview, "GET", "/api/models/sync_upstream/preview?locale=zh", nil, &preview)
				assert.False(t, preview.Success)
			})
		})
	}
}

func TestMetadataSyncLocaleAndEndpointValidation(t *testing.T) {
	for _, locale := range []struct{ input, expected string }{{"zh", "zh"}, {"zh-CN", "zh"}, {"en", "en"}, {"ja", "ja"}} {
		t.Run(locale.input, func(t *testing.T) {
			normalized, ok := normalizeLocale(locale.input)
			assert.True(t, ok)
			assert.Equal(t, locale.expected, normalized)
		})
	}
	_, valid := normalizeLocale("invalid")
	assert.False(t, valid)
	for _, endpoint := range []string{`1`, `null`, `{"openai":false}`, `{"openai":{"path":"invalid"}}`} {
		assert.Error(t, model.ValidateModelEndpoints(endpoint))
	}
}

func TestVendorManagementDatabaseMatrix(t *testing.T) {
	for _, dialect := range []struct{ kind, env string }{{"sqlite", ""}, {"mysql", "TEST_MYSQL_DSN"}, {"postgres", "TEST_POSTGRES_DSN"}} {
		t.Run(dialect.kind, func(t *testing.T) {
			if dialect.env != "" && os.Getenv(dialect.env) == "" {
				t.Skip("set " + dialect.env)
			}
			db := modelManagementDB(t, dialect.kind, os.Getenv(dialect.env))
			t.Run("pricing_reads_keep_default_brands_without_writing_vendors", func(t *testing.T) {
				channel := model.Channel{Name: "Vendor fixture", Type: 1, Status: common.ChannelStatusEnabled}
				require.NoError(t, db.Create(&channel).Error)
				require.NoError(t, db.Create(&model.Ability{Model: "gemini-vendor-fixture", Group: "default", ChannelId: channel.Id, Enabled: true}).Error)
				model.RefreshPricing()
				model.GetPricing()
				vendors := model.GetVendors()
				require.Len(t, vendors, 1)
				assert.Equal(t, "Google", vendors[0].Name)
				assert.Equal(t, "Gemini.Color", vendors[0].Icon)
				assert.Negative(t, vendors[0].ID)
				var count int64
				require.NoError(t, db.Model(&model.Vendor{}).Count(&count).Error)
				assert.Zero(t, count)
				saved := model.Vendor{Name: "Google", Icon: "Gemini.Color"}
				require.NoError(t, saved.Insert())
				assert.Equal(t, saved.Id, model.GetVendors()[0].ID)
				require.NoError(t, saved.Delete())
				assert.Equal(t, vendors[0].ID, model.GetVendors()[0].ID)
				require.NoError(t, db.Model(&model.Vendor{}).Count(&count).Error)
				assert.Zero(t, count, "refresh must not recreate a deleted vendor")
			})
			t.Run("metadata_ownership_preview_merge_delete_and_rollback", func(t *testing.T) {
				source := model.Vendor{Name: "  Vendor Source  ", Icon: "Gemini.Color"}
				target := model.Vendor{Name: "Vendor Target", Description: "Keep target", Icon: "OpenAI"}
				require.NoError(t, source.Insert())
				require.NoError(t, target.Insert())
				assert.Equal(t, "Vendor Source", source.Name)
				assert.Error(t, (&model.Vendor{Name: "vendor source"}).Insert())
				assert.Error(t, (&model.Vendor{Name: " "}).Insert())
				require.NoError(t, db.Model(&model.Vendor{}).Where("id = ?", source.Id).Update("status", 0).Error)
				loaded, err := model.GetVendorByID(source.Id)
				require.NoError(t, err)
				staleVersion := loaded.Version
				edit := model.Vendor{Id: source.Id, Name: source.Name, Description: "Updated source", Icon: source.Icon, Version: loaded.Version}
				require.NoError(t, edit.Update())
				updated, err := model.GetVendorByID(source.Id)
				require.NoError(t, err)
				assert.Equal(t, loaded.CreatedTime, updated.CreatedTime)
				assert.Zero(t, updated.Status)
				edit.Version = staleVersion
				assert.ErrorIs(t, edit.Update(), model.ErrVendorConflict)

				one := model.Model{ModelName: "vendor-model-one", VendorID: source.Id, Icon: "Custom", Description: "Preserve description", Status: 0, SyncOfficial: 0}
				rule := model.Model{ModelName: "vendor-rule-", VendorID: source.Id, NameRule: model.NameRulePrefix, Status: 1, SyncOfficial: 1}
				require.NoError(t, one.Insert())
				require.NoError(t, rule.Insert())
				priceBefore, err := model.GetModelPricingSnapshot([]string{one.ModelName})
				require.NoError(t, err)
				require.NoError(t, model.UpdateModelPricing([]model.ModelPricingChange{{ModelName: one.ModelName, ExpectedVersion: priceBefore.Entries[0].Version, Pricing: model.PricingValues{"ModelPrice": float64(0.25)}}}))
				priceBefore, err = model.GetModelPricingSnapshot([]string{one.ModelName})
				require.NoError(t, err)
				channel := model.Channel{Name: "Unchanged vendor channel", Type: 1, Status: common.ChannelStatusEnabled}
				require.NoError(t, db.Create(&channel).Error)
				ability := model.Ability{Model: one.ModelName, Group: "default", ChannelId: channel.Id, Enabled: true}
				require.NoError(t, db.Create(&ability).Error)
				linked, total, err := model.SearchVendors("", 0, 20, "linked")
				require.NoError(t, err)
				require.Len(t, linked, 1)
				assert.EqualValues(t, 1, total)
				assert.EqualValues(t, 2, linked[0].ModelCount)
				unlinked, _, err := model.SearchVendors("Vendor Target", 0, 20, "unlinked")
				require.NoError(t, err)
				require.Len(t, unlinked, 1)
				var references *model.VendorReferenceError
				err = model.DeleteVendors([]int{source.Id, target.Id})
				require.ErrorAs(t, err, &references)
				assert.EqualValues(t, 2, references.Counts[source.Id])
				_, err = model.GetVendorByID(target.Id)
				require.NoError(t, err, "bulk delete must not partially delete unreferenced vendors")
				var response struct {
					Success         bool
					Code            string
					ReferenceCounts map[int]int64 `json:"reference_counts"`
				}
				recorder := modelManagementRequest(t, PreviewVendorOperation, http.MethodPost, "/api/vendors/operations/preview", model.VendorOperation{Action: "delete", VendorIDs: []int{source.Id}}, &response)
				assert.Equal(t, http.StatusConflict, recorder.Code)
				assert.Equal(t, "VENDOR_REFERENCED", response.Code)
				assert.EqualValues(t, 2, response.ReferenceCounts[source.Id])

				disappearing := model.Vendor{Name: "Preview target"}
				require.NoError(t, disappearing.Insert())
				staleAssignment := model.VendorOperation{Action: "assign", ModelIDs: []int{one.Id}, TargetVendorID: disappearing.Id}
				stalePreview, err := model.PreviewVendorOperation(staleAssignment)
				require.NoError(t, err)
				staleAssignment.ExpectedVersion = stalePreview.Version
				require.NoError(t, disappearing.Delete())
				recorder = modelManagementRequest(t, ApplyVendorOperation, http.MethodPost, "/api/vendors/operations", staleAssignment, &response)
				assert.Equal(t, http.StatusConflict, recorder.Code)
				assert.Equal(t, "VENDOR_CONFLICT", response.Code)

				assign := model.VendorOperation{Action: "assign", ModelIDs: []int{one.Id}, TargetVendorID: target.Id}
				preview, err := model.PreviewVendorOperation(assign)
				require.NoError(t, err)
				require.Len(t, preview.Models, 1)
				assign.ExpectedVersion = preview.Version
				one.Description = "Updated in the same timestamp"
				require.NoError(t, db.Model(&model.Model{}).Where("id = ?", one.Id).Update("description", one.Description).Error)
				_, err = model.ApplyVendorOperation(assign)
				assert.ErrorIs(t, err, model.ErrVendorConflict)
				preview, err = model.PreviewVendorOperation(assign)
				require.NoError(t, err)
				assign.ExpectedVersion = preview.Version
				target.Description = "New target description"
				require.NoError(t, target.Update())
				_, err = model.ApplyVendorOperation(assign)
				assert.ErrorIs(t, err, model.ErrVendorConflict)
				preview, err = model.PreviewVendorOperation(assign)
				require.NoError(t, err)
				assign.ExpectedVersion = preview.Version
				result, err := model.ApplyVendorOperation(assign)
				require.NoError(t, err)
				assert.Equal(t, []int{one.Id}, result.UpdatedModels)
				var after model.Model
				after = model.Model{}
				require.NoError(t, db.First(&after, one.Id).Error)
				assert.Equal(t, target.Id, after.VendorID)
				assert.Equal(t, one.Description, after.Description)
				assert.Equal(t, one.Icon, after.Icon)
				assert.Equal(t, one.Status, after.Status)
				after = model.Model{}
				require.NoError(t, db.First(&after, rule.Id).Error)
				assert.Equal(t, source.Id, after.VendorID)
				assign.TargetVendorID = 0
				preview, err = model.PreviewVendorOperation(assign)
				require.NoError(t, err)
				assign.ExpectedVersion = preview.Version
				_, err = model.ApplyVendorOperation(assign)
				require.NoError(t, err)
				after = model.Model{}
				require.NoError(t, db.First(&after, one.Id).Error)
				assert.Zero(t, after.VendorID)
				after.VendorID = -1001
				assert.Error(t, after.Update(), "display-only vendors cannot become stored references")

				merge := model.VendorOperation{Action: "merge", VendorIDs: []int{source.Id}, TargetVendorID: target.Id}
				preview, err = model.PreviewVendorOperation(merge)
				require.NoError(t, err)
				merge.ExpectedVersion = preview.Version
				require.NoError(t, db.Callback().Delete().Before("gorm:delete").Register("vendor_delete_failure", func(tx *gorm.DB) {
					if tx.Statement.Table == "vendors" {
						tx.AddError(errors.New("injected vendor delete failure"))
					}
				}))
				_, err = model.ApplyVendorOperation(merge)
				require.Error(t, err)
				require.NoError(t, db.Callback().Delete().Remove("vendor_delete_failure"))
				after = model.Model{}
				require.NoError(t, db.First(&after, rule.Id).Error)
				assert.Equal(t, source.Id, after.VendorID, "ownership updates roll back when deletion fails")
				_, err = model.GetVendorByID(source.Id)
				require.NoError(t, err)
				_, err = model.ApplyVendorOperation(merge)
				require.NoError(t, err)
				_, err = model.GetVendorByID(source.Id)
				assert.ErrorIs(t, err, gorm.ErrRecordNotFound)
				retained, err := model.GetVendorByID(target.Id)
				require.NoError(t, err)
				assert.Equal(t, target.Description, retained.Description)
				assert.Equal(t, "OpenAI", retained.Icon)
				assert.EqualValues(t, 1, retained.ModelCount)
				after = one
				after.VendorID = source.Id
				assert.Error(t, after.Update(), "deleted vendors cannot acquire new references")
				priceAfter, err := model.GetModelPricingSnapshot([]string{one.ModelName})
				require.NoError(t, err)
				assert.Equal(t, priceBefore.Entries[0], priceAfter.Entries[0], "assignment and merge preserve model pricing")
				var retainedChannel model.Channel
				require.NoError(t, db.First(&retainedChannel, channel.Id).Error)
				assert.Equal(t, channel.Name, retainedChannel.Name)
				assert.Equal(t, channel.Status, retainedChannel.Status)
				var retainedAbility model.Ability
				require.NoError(t, db.Where("model = ? AND channel_id = ?", one.ModelName, channel.Id).First(&retainedAbility).Error)
				assert.Equal(t, ability.Group, retainedAbility.Group)
				assert.Equal(t, ability.Enabled, retainedAbility.Enabled)
			})
			t.Run("concurrent_create_and_delete_never_orphan_model", func(t *testing.T) {
				vendor := model.Vendor{Name: "Concurrent owner"}
				require.NoError(t, vendor.Insert())
				var createErr, deleteErr error
				var wg sync.WaitGroup
				wg.Add(2)
				go func() {
					defer wg.Done()
					createErr = (&model.Model{ModelName: "concurrent-owned-model", VendorID: vendor.Id}).Insert()
				}()
				go func() { defer wg.Done(); deleteErr = vendor.Delete() }()
				wg.Wait()
				if createErr == nil {
					require.Error(t, deleteErr)
				} else {
					require.NoError(t, deleteErr)
				}
				var models []model.Model
				require.NoError(t, db.Where("model_name = ?", "concurrent-owned-model").Find(&models).Error)
				if len(models) != 0 {
					_, err := model.GetVendorByID(models[0].VendorID)
					require.NoError(t, err)
				}
			})
		})
	}
}

func TestModelDeletionDatabaseMatrix(t *testing.T) {
	for _, dialect := range []struct{ kind, env string }{{"sqlite", ""}, {"mysql", "TEST_MYSQL_DSN"}, {"postgres", "TEST_POSTGRES_DSN"}} {
		t.Run(dialect.kind, func(t *testing.T) {
			if dialect.env != "" && os.Getenv(dialect.env) == "" {
				t.Skip("set " + dialect.env + " to run this database")
			}
			db := modelManagementDB(t, dialect.kind, os.Getenv(dialect.env))
			var response struct {
				Success bool
				Data    model.ModelDeleteResult
			}
			metadataOnly := model.Model{ModelName: "metadata-only", Status: 1}
			require.NoError(t, metadataOnly.Insert())
			channel := model.Channel{Name: "Retained channel", Type: 1, Key: "fixture-key", Models: metadataOnly.ModelName, Group: "default", Status: common.ChannelStatusEnabled}
			require.NoError(t, db.Create(&channel).Error)
			require.NoError(t, channel.UpdateAbilities(db))
			recorder := modelManagementRequest(t, func(c *gin.Context) {
				c.Params = gin.Params{{Key: "id", Value: strconv.Itoa(metadataOnly.Id)}}
				DeleteModelMeta(c)
			}, http.MethodDelete, "/api/models/"+strconv.Itoa(metadataOnly.Id), nil, &response)
			require.True(t, response.Success, recorder.Body.String())
			assert.Equal(t, model.ModelDeleteResult{DeletedCount: 1}, response.Data)
			var retained model.Channel
			require.NoError(t, db.First(&retained, channel.Id).Error)
			assert.Equal(t, channel.Models, retained.Models)
			var count int64
			require.NoError(t, db.Model(&model.Ability{}).Where("channel_id = ?", channel.Id).Count(&count).Error)
			assert.EqualValues(t, 1, count)

			for _, rule := range []int{model.NameRuleExact, model.NameRulePrefix, model.NameRuleContains, model.NameRuleSuffix} {
				t.Run(fmt.Sprintf("rule_%d_exact_names_only_atomic_and_cached", rule), func(t *testing.T) {
					name := fmt.Sprintf("delete-rule-%d", rule)
					first := model.Model{ModelName: name, NameRule: rule, Status: 1}
					second := model.Model{ModelName: name + "-second", Status: 1}
					require.NoError(t, first.Insert())
					require.NoError(t, second.Insert())
					mapping := `{"` + name + `":"upstream-name"}`
					priority, weight := int64(7), uint(9)
					channels := []model.Channel{
						{Name: "Enabled", Type: 1, Key: "fixture-key", Models: name + "," + name + "-keep," + second.ModelName, Group: "default,vip", Status: common.ChannelStatusEnabled, ModelMapping: &mapping, Priority: &priority, Weight: &weight},
						{Name: "Disabled", Type: 1, Models: name + ",prefix-" + name, Group: "disabled-group", Status: common.ChannelStatusManuallyDisabled},
						{Name: "Last model", Type: 1, Models: name, Group: "last-model-group", Status: common.ChannelStatusEnabled},
						{Name: "Case-sensitive name", Type: 1, Models: strings.ToUpper(name), Group: "case-group", Status: common.ChannelStatusEnabled},
					}
					for i := range channels {
						require.NoError(t, db.Create(&channels[i]).Error)
						require.NoError(t, channels[i].UpdateAbilities(db))
					}
					common.MemoryCacheEnabled = true
					model.InitChannelCache()
					cached, err := model.GetRandomSatisfiedChannel("default", name, 0, nil)
					require.NoError(t, err)
					require.NotNil(t, cached)
					baseline, err := model.GetModelPricingSnapshot([]string{name})
					require.NoError(t, err)
					require.NoError(t, model.UpdateModelPricing([]model.ModelPricingChange{{ModelName: name, ExpectedVersion: baseline.EmptyVersion, Pricing: model.PricingValues{"ModelPrice": float64(2)}}}))
					pricingBefore, err := model.GetModelPricingSnapshot([]string{name, second.ModelName})
					require.NoError(t, err)
					if rule != model.NameRuleExact {
						_, err := model.DeleteModelMetadata([]int{first.Id, second.Id}, true, true)
						require.EqualError(t, err, "only exact-match models can be removed from channels")
						after, err := model.GetModelPricingSnapshot([]string{name, second.ModelName})
						require.NoError(t, err)
						assert.Equal(t, pricingBefore, after)
						require.NoError(t, db.Model(&model.Model{}).Where("id IN ?", []int{first.Id, second.Id}).Count(&count).Error)
						assert.EqualValues(t, 2, count)
						for _, original := range channels {
							var after model.Channel
							require.NoError(t, db.First(&after, original.Id).Error)
							assert.Equal(t, original, after)
						}
						return
					}
					body := map[string]any{"model_ids": []int{first.Id, second.Id, first.Id}, "remove_from_channels": true}
					// A failure at the final metadata delete must undo every earlier
					// channel/ability write and keep the published cache intact.
					require.NoError(t, db.Callback().Delete().Before("gorm:delete").Register("fail_model_deletion", func(tx *gorm.DB) {
						if tx.Statement.Table == "models" {
							tx.AddError(errors.New("injected model deletion failure"))
						}
					}))
					result, err := model.DeleteModelMetadata([]int{first.Id, second.Id}, true, false)
					require.Error(t, err)
					assert.Zero(t, result)
					require.NoError(t, db.Callback().Delete().Remove("fail_model_deletion"))
					for _, original := range channels {
						var after model.Channel
						require.NoError(t, db.First(&after, original.Id).Error)
						assert.Equal(t, original, after)
					}
					cached, err = model.GetRandomSatisfiedChannel("default", name, 0, nil)
					require.NoError(t, err)
					require.NotNil(t, cached)
					recorder := modelManagementRequest(t, BatchDeleteModelMeta, http.MethodPost, "/api/models/delete", body, &response)
					require.True(t, response.Success, recorder.Body.String())
					assert.Equal(t, model.ModelDeleteResult{DeletedCount: 2, UpdatedChannels: 3}, response.Data)
					for i, original := range channels {
						var after model.Channel
						require.NoError(t, db.First(&after, original.Id).Error)
						original.Models = []string{name + "-keep", "prefix-" + name, "", strings.ToUpper(name)}[i]
						assert.Equal(t, original, after, "only the model list changes")
					}
					var abilities []model.Ability
					require.NoError(t, db.Where("channel_id IN ?", []int{channels[0].Id, channels[1].Id, channels[2].Id, channels[3].Id}).Find(&abilities).Error)
					assert.Len(t, abilities, 4)
					for _, ability := range abilities {
						assert.NotEqual(t, name, ability.Model)
						assert.NotEqual(t, second.ModelName, ability.Model)
						assert.NotEmpty(t, ability.Model)
						if ability.ChannelId == channels[0].Id {
							assert.Equal(t, &priority, ability.Priority)
							assert.Equal(t, weight, ability.Weight)
							assert.True(t, ability.Enabled)
						}
						if ability.ChannelId == channels[1].Id {
							assert.False(t, ability.Enabled)
						}
					}
					for _, group := range []string{"default", "vip", "last-model-group"} {
						cached, _ = model.GetRandomSatisfiedChannel(group, name, 0, nil)
						assert.Nil(t, cached)
					}
					cached, err = model.GetRandomSatisfiedChannel("default", name+"-keep", 0, nil)
					require.NoError(t, err)
					require.NotNil(t, cached)
					pricingAfter, err := model.GetModelPricingSnapshot([]string{name, second.ModelName})
					require.NoError(t, err)
					assert.Equal(t, pricingBefore, pricingAfter)
					require.NoError(t, db.Model(&model.Model{}).Where("id IN ?", []int{first.Id, second.Id}).Count(&count).Error)
					assert.Zero(t, count)
					_, err = model.DeleteModelMetadata([]int{first.Id}, true, false)
					assert.Error(t, err, "stale selections cannot delete newly created records")
				})
			}
			for _, removeChannels := range []bool{false, true} {
				t.Run(fmt.Sprintf("pricing_removal_channels_%t", removeChannels), func(t *testing.T) {
					name := fmt.Sprintf("remove-pricing-%t", removeChannels)
					metadata := model.Model{ModelName: name, NameRule: model.NameRuleExact, Status: 1}
					require.NoError(t, metadata.Insert())
					keep := name + "-keep"
					channel := model.Channel{Name: "Independent pricing removal", Type: 1, Models: name + "," + keep, Group: "pricing-removal", Status: common.ChannelStatusEnabled}
					require.NoError(t, db.Create(&channel).Error)
					require.NoError(t, channel.UpdateAbilities(db))
					model.InitChannelCache()
					baseline, err := model.GetModelPricingSnapshot([]string{name, keep})
					require.NoError(t, err)
					pricing := model.PricingValues{"ModelRatio": float64(1), "ModelPrice": float64(0), "CompletionRatio": float64(2), "CacheRatio": float64(0.1), "CreateCacheRatio": float64(1.25), "ImageRatio": float64(3), "AudioRatio": float64(4), "AudioCompletionRatio": float64(5), "billing_setting.billing_mode": "tiered_expr", "billing_setting.billing_expr": `tier("base", p * 2 + c * 4)`}
					require.NoError(t, model.UpdateModelPricing([]model.ModelPricingChange{
						{ModelName: name, ExpectedVersion: baseline.EmptyVersion, Pricing: pricing},
						{ModelName: keep, ExpectedVersion: baseline.EmptyVersion, Pricing: model.PricingValues{"ModelPrice": float64(9)}},
					}))
					before, err := model.GetModelPricingSnapshot([]string{name, keep})
					require.NoError(t, err)
					body := map[string]any{"model_ids": []int{metadata.Id}, "remove_from_channels": removeChannels, "remove_pricing": true}
					for _, single := range []bool{false, true} {
						recorder := modelManagementRequest(t, func(c *gin.Context) {
							c.Set("role", common.RoleAdminUser)
							if single {
								c.Params = gin.Params{{Key: "id", Value: strconv.Itoa(metadata.Id)}}
								DeleteModelMeta(c)
							} else {
								BatchDeleteModelMeta(c)
							}
						}, http.MethodPost, "/api/models/delete?remove_pricing=true", body, nil)
						assert.Equal(t, http.StatusForbidden, recorder.Code, "pricing permissions cannot be bypassed through deletion")
					}
					updates := 0
					require.NoError(t, db.Callback().Update().Before("gorm:update").Register("fail_deleted_pricing", func(tx *gorm.DB) {
						if tx.Statement.Table == "options" {
							updates++
							if updates == 3 {
								tx.AddError(errors.New("injected pricing deletion failure"))
							}
						}
					}))
					_, err = model.DeleteModelMetadata([]int{metadata.Id}, removeChannels, true)
					require.Error(t, err)
					require.NoError(t, db.Callback().Update().Remove("fail_deleted_pricing"))
					after, err := model.GetModelPricingSnapshot([]string{name, keep})
					require.NoError(t, err)
					assert.Equal(t, before, after, "partial option writes roll back")
					assert.Equal(t, billing_setting.BillingModeTieredExpr, billing_setting.GetBillingMode(name), "failed deletion must not publish new runtime pricing")
					var retained model.Model
					require.NoError(t, db.First(&retained, metadata.Id).Error)
					var channelAfter model.Channel
					require.NoError(t, db.First(&channelAfter, channel.Id).Error)
					assert.Equal(t, channel.Models, channelAfter.Models)
					_, err = model.DeleteModelMetadata([]int{metadata.Id, 999999}, removeChannels, true)
					assert.Error(t, err, "a missing model aborts the whole batch")
					recorder := modelManagementRequest(t, BatchDeleteModelMeta, http.MethodPost, "/api/models/delete", body, &response)
					require.True(t, response.Success, recorder.Body.String())
					after, err = model.GetModelPricingSnapshot([]string{name, keep})
					require.NoError(t, err)
					assert.Empty(t, after.Entries[0].Configured)
					assert.Equal(t, before.Entries[1], after.Entries[1], "name rules do not expand pricing deletion")
					assert.Equal(t, billing_setting.BillingModeRatio, billing_setting.GetBillingMode(name))
					_, hasExpr := billing_setting.GetBillingExpr(name)
					assert.False(t, hasExpr)
					require.NoError(t, db.First(&channelAfter, channel.Id).Error)
					expectedModels := channel.Models
					if removeChannels {
						expectedModels = keep
					}
					assert.Equal(t, expectedModels, channelAfter.Models)
					require.NoError(t, db.Model(&model.Model{}).Where("id = ?", metadata.Id).Count(&count).Error)
					assert.Zero(t, count)
				})
			}
			for _, ids := range [][]int{nil, {0}, {-1}, make([]int, 1001)} {
				_, err := model.DeleteModelMetadata(ids, true, false)
				assert.Error(t, err)
			}
		})
	}
}
