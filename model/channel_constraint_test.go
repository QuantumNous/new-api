package model

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	kitdto "github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

func TestChannelRouteRestriction(t *testing.T) {
	for _, tc := range []struct {
		name, setting, method, path string
		allowed                     bool
	}{
		{"legacy", `{}`, "POST", "/custom/submit", true},
		{"disabled", `{"route_restriction":null}`, "POST", "/v1/chat/completions", true},
		{"responses", `{"route_restriction":{"allowed_paths":["/v1/responses"]}}`, "POST", "/v1/responses", true},
		{"websocket", `{"route_restriction":{"allowed_paths":["/v1/responses"]}}`, "GET", "/v1/responses", true},
		{"chat denied", `{"route_restriction":{"allowed_paths":["/v1/responses"]}}`, "POST", "/v1/chat/completions", false},
		{"compact is separate", `{"route_restriction":{"allowed_paths":["/v1/responses"]}}`, "POST", "/v1/responses/compact", false},
		{"exact path", `{"route_restriction":{"allowed_paths":["/v1/responses"]}}`, "POST", "/v1/responses-extra", false},
		{"playground denied", `{"route_restriction":{"allowed_paths":["/v1/responses"]}}`, "POST", "/pg/chat/completions", false},
		{"playground alias", `{"route_restriction":{"allowed_paths":["/v1/chat/completions"]}}`, "POST", "/pg/chat/completions", true},
		{"gemini alias", `{"route_restriction":{"allowed_paths":["/v1beta/models/{model}:generateContent"]}}`, "POST", "/v1/models/gemini:generateContent", true},
		{"gemini action differs", `{"route_restriction":{"allowed_paths":["/v1beta/models/{model}:generateContent"]}}`, "POST", "/v1beta/models/gemini:streamGenerateContent", false},
		{"legacy embedding", `{"route_restriction":{"allowed_paths":["/v1/embeddings"]}}`, "POST", "/v1/engines/model/embeddings", true},
		{"plugin submission", `{"route_restriction":{"allowed_paths":["/v1/tasks/{plugin}"]}}`, "POST", "/v1/tasks/video", true},
		{"video retrieval", `{"route_restriction":{"allowed_paths":["/v1/responses"]}}`, "GET", "/v1/videos/old-task", true},
		{"task cancellation", `{"route_restriction":{"allowed_paths":["/v1/responses"]}}`, "DELETE", "/v1/tasks/old-task", true},
		{"remix is submission", `{"route_restriction":{"allowed_paths":["/v1/responses"]}}`, "POST", "/v1/videos/old-task/remix", false},
		{"allow remix", `{"route_restriction":{"allowed_paths":["/v1/videos/{video_id}/remix"]}}`, "POST", "/v1/videos/old-task/remix", true},
		{"midjourney alias", `{"route_restriction":{"allowed_paths":["/mj/submit/imagine"]}}`, "POST", "/fast/mj/submit/imagine", true},
		{"midjourney queries", `{"route_restriction":{"allowed_paths":["/v1/responses"]}}`, "POST", "/fast/mj/task/list-by-condition", true},
		{"empty restriction", `{"route_restriction":{}}`, "POST", "/v1/responses", false},
		{"malformed settings", `{"route_restriction":`, "POST", "/v1/responses", false},
		{"invalid list", `{"route_restriction":{"allowed_paths":"/v1/responses"}}`, "POST", "/v1/responses", false},
		{"unknown path in configuration", `{"route_restriction":{"allowed_paths":["/v1/responses","/unknown"]}}`, "POST", "/v1/responses", false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ch := &Channel{Type: constant.ChannelTypeOpenAI, Setting: &tc.setting}
			allowed, _ := ChannelSatisfiesFilters(ch, "model", []dto.ChannelFilter{{Kind: dto.FilterRequestPath, RequestMethod: tc.method, RequestPath: tc.path}})
			assert.Equal(t, tc.allowed, allowed)
			assert.Equal(t, tc.setting, *ch.Setting, "reading a restriction must not erase invalid settings")
		})
	}

	for _, setting := range []string{
		`{"route_restriction":{}}`,
		`{"route_restriction":{"allowed_paths":[]}}`,
		`{"route_restriction":{"allowed_paths":["/v1/*"]}}`,
		`{"route_restriction":{"allowed_paths":["/v1/responses?x=1"]}}`,
		`{"route_restriction":{"allowed_paths":["/v1/responses","/v1/responses"]}}`,
	} {
		t.Run("reject save "+setting, func(t *testing.T) {
			ch := &Channel{Setting: &setting}
			require.ErrorContains(t, ch.ValidateSettings(), "route_restriction")
		})
	}

	t.Run("advanced custom intersects capability with restriction", func(t *testing.T) {
		ch := &Channel{Type: constant.ChannelTypeAdvancedCustom}
		ch.SetSetting(kitdto.ChannelSettings{RouteRestriction: &kitdto.ChannelRouteRestriction{AllowedPaths: []string{"/v1/responses"}}})
		ch.SetOtherSettings(kitdto.ChannelOtherSettings{AdvancedCustom: &kitdto.AdvancedCustomConfig{Routes: []kitdto.AdvancedCustomRoute{{IncomingPath: "/v1/chat/completions", UpstreamPath: "/v1/responses"}}}})
		for _, path := range []string{"/v1/chat/completions", "/v1/responses"} {
			allowed, _ := ChannelSatisfiesFilters(ch, "model", []dto.ChannelFilter{{Kind: dto.FilterRequestPath, RequestPath: path}})
			assert.False(t, allowed, path)
		}
	})
}

func TestChannelRouteRestrictionDatabase(t *testing.T) {
	for _, dialect := range []string{"sqlite", "mysql", "postgres"} {
		t.Run(dialect, func(t *testing.T) {
			var driver gorm.Dialector
			dbType := common.DatabaseTypeSQLite
			switch dialect {
			case "sqlite":
				driver = sqlite.Open(filepath.Join(t.TempDir(), "routes.db"))
			case "mysql":
				if os.Getenv("TEST_MYSQL_DSN") == "" {
					t.Skip("TEST_MYSQL_DSN is not configured")
				}
				driver = mysql.Open(os.Getenv("TEST_MYSQL_DSN"))
				dbType = common.DatabaseTypeMySQL
			case "postgres":
				if os.Getenv("TEST_POSTGRES_DSN") == "" {
					t.Skip("TEST_POSTGRES_DSN is not configured")
				}
				driver = postgres.Open(os.Getenv("TEST_POSTGRES_DSN"))
				dbType = common.DatabaseTypePostgreSQL
			}
			db, err := gorm.Open(driver, &gorm.Config{NamingStrategy: schema.NamingStrategy{TablePrefix: "route_restriction_"}})
			require.NoError(t, err)
			sqlDB, err := db.DB()
			require.NoError(t, err)
			t.Cleanup(func() { require.NoError(t, sqlDB.Close()) })
			require.NoError(t, db.AutoMigrate(&Channel{}, &Ability{}))
			t.Cleanup(func() { require.NoError(t, db.Migrator().DropTable(&Ability{}, &Channel{})) })
			var version string
			if dialect == "sqlite" {
				require.NoError(t, db.Raw("SELECT sqlite_version()").Scan(&version).Error)
			} else {
				require.NoError(t, db.Raw("SELECT version()").Scan(&version).Error)
			}
			t.Logf("%s version: %s", dialect, version)
			oldDB, oldMemory := DB, common.MemoryCacheEnabled
			oldMain, oldLog := common.MainDatabaseType(), common.LogDatabaseType()
			DB = db
			common.SetDatabaseTypes(dbType, dbType)
			initCol()
			t.Cleanup(func() {
				DB, common.MemoryCacheEnabled = oldDB, oldMemory
				common.SetDatabaseTypes(oldMain, oldLog)
				initCol()
				if oldMemory {
					InitChannelCache()
				}
			})
			channels := []Channel{
				{Type: constant.ChannelTypeOpenAI, Name: "responses", Priority: common.GetPointer(int64(100))},
				{Type: constant.ChannelTypeOpenAI, Name: "chat", Priority: common.GetPointer(int64(50))},
				{Type: constant.ChannelTypeOpenAI, Name: "fallback", Priority: common.GetPointer(int64(10))},
			}
			for i := range channels {
				ch := &channels[i]
				ch.Key, ch.Models, ch.Group, ch.Status = "test-key", "model", "default", common.ChannelStatusEnabled
				path := "/v1/chat/completions"
				if i == 0 {
					path = "/v1/responses"
				}
				ch.SetSetting(kitdto.ChannelSettings{RouteRestriction: &kitdto.ChannelRouteRestriction{AllowedPaths: []string{path}}})
				require.NoError(t, ch.ValidateSettings())
				require.NoError(t, db.Create(ch).Error)
				require.NoError(t, db.Create(&Ability{ChannelId: ch.Id, Model: ch.Models, Group: ch.Group, Enabled: true, Priority: ch.Priority, Weight: 1}).Error)
				var loaded Channel
				require.NoError(t, db.First(&loaded, ch.Id).Error)
				assert.Equal(t, ch.GetSetting().RouteRestriction, loaded.GetSetting().RouteRestriction)
			}
			for _, memory := range []bool{false, true} {
				t.Run(fmt.Sprintf("memory=%t", memory), func(t *testing.T) {
					common.MemoryCacheEnabled = memory
					InitChannelCache()
					for _, tc := range []struct {
						path           string
						retry, channel int
					}{
						{"/v1/chat/completions", 0, channels[1].Id},
						{"/v1/chat/completions", 1, channels[2].Id},
						{"/v1/responses", 0, channels[0].Id},
						{"/v1/messages", 0, 0},
					} {
						selected, err := GetRandomSatisfiedChannel("default", "model", tc.retry, []dto.ChannelFilter{{Kind: dto.FilterRequestPath, RequestMethod: http.MethodPost, RequestPath: tc.path}})
						require.NoError(t, err)
						if tc.channel == 0 {
							assert.Nil(t, selected)
							continue
						}
						require.NotNil(t, selected)
						assert.Equal(t, tc.channel, selected.Id)
					}
				})
			}
			// Editing an existing channel refreshes its cached restriction, and
			// disabling it persists without changing any other setting.
			channels[0].SetSetting(kitdto.ChannelSettings{Proxy: "http://localhost:8080"})
			require.NoError(t, db.Save(&channels[0]).Error)
			CacheUpdateChannel(&channels[0])
			selected, err := GetRandomSatisfiedChannel("default", "model", 0, []dto.ChannelFilter{{Kind: dto.FilterRequestPath, RequestPath: "/v1/chat/completions"}})
			require.NoError(t, err)
			require.NotNil(t, selected)
			assert.Equal(t, channels[0].Id, selected.Id)
			var loaded Channel
			require.NoError(t, db.First(&loaded, channels[0].Id).Error)
			assert.Nil(t, loaded.GetSetting().RouteRestriction)
			assert.Equal(t, "http://localhost:8080", loaded.GetSetting().Proxy)
			for _, tc := range []struct {
				name, setting                            string
				preserved, responsesAllowed, chatAllowed bool
			}{
				{"unrelated field keeps legacy recovery", `{"force_format":"invalid"}`, false, true, true},
				{"disabled restriction keeps legacy recovery", `{"force_format":"invalid","route_restriction":null}`, false, true, true},
				{"valid restriction survives unrelated field error", `{"force_format":"invalid","route_restriction":{"allowed_paths":["/v1/responses"]}}`, true, true, false},
				{"invalid route configuration stays restricted", `{"route_restriction":{"allowed_paths":"/v1/responses"}}`, true, false, false},
				{"undecodable route configuration is preserved", `{"route_restriction":`, true, false, false},
			} {
				t.Run(tc.name, func(t *testing.T) {
					channel := &Channel{Type: constant.ChannelTypeOpenAI, Key: "test", Name: tc.name, Setting: &tc.setting}
					require.NoError(t, db.Create(channel).Error)
					setting := channel.GetSetting()
					assert.Equal(t, tc.responsesAllowed, setting.RouteRestriction.AllowsRequest(http.MethodPost, "/v1/responses"))
					assert.Equal(t, tc.chatAllowed, setting.RouteRestriction.AllowsRequest(http.MethodPost, "/v1/chat/completions"))
					var reloaded Channel
					require.NoError(t, db.First(&reloaded, channel.Id).Error)
					if tc.preserved {
						require.NotNil(t, reloaded.Setting)
						assert.Equal(t, tc.setting, *reloaded.Setting)
					} else {
						assert.Nil(t, reloaded.Setting)
					}
				})
			}
		})
	}
}

func TestFilterCandidateIDs(t *testing.T) {
	alphaSetting := `{"task_plugin_key":"alpha"}`
	betaSetting := `{"task_plugin_key":"beta"}`
	alpha := &Channel{Id: 900001, Type: constant.ChannelTypeTaskPlugin, Status: common.ChannelStatusEnabled, Setting: &alphaSetting}
	beta := &Channel{Id: 900002, Type: constant.ChannelTypeTaskPlugin, Status: common.ChannelStatusEnabled, Setting: &betaSetting}
	ordinary := &Channel{Id: 900003, Type: constant.ChannelTypeOpenAI, Status: common.ChannelStatusEnabled}
	kling := &Channel{Id: 900004, Type: constant.ChannelTypeKling, Status: common.ChannelStatusEnabled}
	jimeng := &Channel{Id: 900005, Type: constant.ChannelTypeJimeng, Status: common.ChannelStatusEnabled}
	matchingCustom := &Channel{Id: 900010, Type: constant.ChannelTypeAdvancedCustom, Status: common.ChannelStatusEnabled}
	matchingCustom.SetOtherSettings(kitdto.ChannelOtherSettings{
		AdvancedCustom: &kitdto.AdvancedCustomConfig{
			Routes: []kitdto.AdvancedCustomRoute{{
				IncomingPath: "/v1/chat/completions",
				Models:       []string{"gpt-4"},
			}},
		},
	})
	otherCustom := &Channel{Id: 900011, Type: constant.ChannelTypeAdvancedCustom, Status: common.ChannelStatusEnabled}
	otherCustom.SetOtherSettings(kitdto.ChannelOtherSettings{
		AdvancedCustom: &kitdto.AdvancedCustomConfig{
			Routes: []kitdto.AdvancedCustomRoute{{
				IncomingPath: "/v1/responses",
				Models:       []string{"gpt-4"},
			}},
		},
	})

	pathFilter := dto.ChannelFilter{Kind: dto.FilterRequestPath, RequestPath: "/v1/chat/completions"}
	emptyPathFilter := dto.ChannelFilter{Kind: dto.FilterRequestPath, RequestPath: ""}

	tests := []struct {
		name      string
		ids       []int
		modelName string
		filters   []dto.ChannelFilter
		wantKept  []int
		wantEmpty dto.ChannelFilterKind
	}{
		{
			name:      "identity keeps matching type-59 key",
			ids:       []int{900001, 900002},
			modelName: "shared",
			filters:   identityFilters("alpha", nil),
			wantKept:  []int{900001},
		},
		{
			name:      "identity empty key drops all type-59",
			ids:       []int{900001, 900002},
			modelName: "shared",
			filters:   identityFilters("", nil),
			wantKept:  []int{},
			wantEmpty: dto.FilterTaskPluginIdentity,
		},
		{
			name:      "identity empty key keeps ordinary channel",
			ids:       []int{900003},
			modelName: "ordinary",
			filters:   identityFilters("", nil),
			wantKept:  []int{900003},
		},
		{
			name:      "identity keeps matching legacy type",
			ids:       []int{900004, 900005},
			modelName: "legacy",
			filters:   identityFilters("legacy-alpha", []int{constant.ChannelTypeKling}),
			wantKept:  []int{900004},
		},
		{
			name:      "identity keeps all listed legacy types",
			ids:       []int{900004, 900005},
			modelName: "legacy",
			filters:   identityFilters("legacy-alpha", []int{constant.ChannelTypeKling, constant.ChannelTypeJimeng}),
			wantKept:  []int{900004, 900005},
		},
		{
			name:      "identity keyed with no types drops legacy",
			ids:       []int{900004, 900005},
			modelName: "legacy",
			filters:   identityFilters("legacy-alpha", nil),
			wantKept:  []int{},
			wantEmpty: dto.FilterTaskPluginIdentity,
		},
		{
			name:      "identity drops missing cache entry",
			ids:       []int{900004, 999999},
			modelName: "legacy",
			filters:   identityFilters("legacy-alpha", []int{constant.ChannelTypeKling}),
			wantKept:  []int{900004},
		},
		{
			name:      "empty request path is a passthrough including missing ids",
			ids:       []int{900003, 900010, 999999},
			modelName: "gpt-4",
			filters:   []dto.ChannelFilter{emptyPathFilter},
			wantKept:  []int{900003, 900010, 999999},
		},
		{
			name:      "request path keeps missing cache entry for consistency",
			ids:       []int{900003, 999999},
			modelName: "gpt-4",
			filters:   []dto.ChannelFilter{pathFilter},
			wantKept:  []int{900003, 999999},
		},
		{
			name:      "request path keeps matching type-58 and ordinary",
			ids:       []int{900003, 900010, 900011},
			modelName: "gpt-4",
			filters:   []dto.ChannelFilter{pathFilter},
			wantKept:  []int{900003, 900010},
		},
		{
			name:      "request path empties when only unmatched type-58 remains",
			ids:       []int{900011},
			modelName: "gpt-4",
			filters:   []dto.ChannelFilter{pathFilter},
			wantKept:  []int{},
			wantEmpty: dto.FilterRequestPath,
		},
		{
			name:      "intersection attributes empty set to identity after path keeps candidates",
			ids:       []int{900001, 900010},
			modelName: "gpt-4",
			filters:   []dto.ChannelFilter{pathFilter, identityFilters("missing", nil)[0]},
			wantKept:  []int{},
			wantEmpty: dto.FilterTaskPluginIdentity,
		},
		{
			name:      "intersection attributes empty set to path when path runs first",
			ids:       []int{900011},
			modelName: "gpt-4",
			filters:   []dto.ChannelFilter{identityFilters("", nil)[0], pathFilter},
			wantKept:  []int{},
			wantEmpty: dto.FilterRequestPath,
		},
	}

	channelSyncLock.Lock()
	previous := channelsIDM
	channelsIDM = map[int]*Channel{
		900001: alpha,
		900002: beta,
		900003: ordinary,
		900004: kling,
		900005: jimeng,
		900010: matchingCustom,
		900011: otherCustom,
	}
	t.Cleanup(func() {
		channelsIDM = previous
		channelSyncLock.Unlock()
	})

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			kept, emptiedBy := filterCandidateIDs(testCase.ids, testCase.modelName, testCase.filters)
			if testCase.wantKept == nil {
				assert.Nil(t, kept)
			} else {
				assert.Equal(t, testCase.wantKept, kept)
			}
			assert.Equal(t, testCase.wantEmpty, emptiedBy)
		})
	}
}

func TestChannelSatisfiesFilters(t *testing.T) {
	alphaSetting := `{"task_plugin_key":"alpha"}`
	alpha := &Channel{Id: 1, Type: constant.ChannelTypeTaskPlugin, Setting: &alphaSetting}
	ordinary := &Channel{Id: 2, Type: constant.ChannelTypeOpenAI}
	custom := &Channel{Id: 3, Type: constant.ChannelTypeAdvancedCustom}
	custom.SetOtherSettings(kitdto.ChannelOtherSettings{
		AdvancedCustom: &kitdto.AdvancedCustomConfig{
			Routes: []kitdto.AdvancedCustomRoute{{
				IncomingPath: "/v1/chat/completions",
				Models:       []string{"gpt-4"},
			}},
		},
	})

	ok, kind := ChannelSatisfiesFilters(nil, "gpt-4", nil)
	assert.False(t, ok)
	assert.Equal(t, dto.ChannelFilterKind(""), kind)

	ok, kind = ChannelSatisfiesFilters(alpha, "shared", identityFilters("alpha", nil))
	require.True(t, ok)
	assert.Equal(t, dto.ChannelFilterKind(""), kind)

	ok, kind = ChannelSatisfiesFilters(alpha, "shared", identityFilters("beta", nil))
	assert.False(t, ok)
	assert.Equal(t, dto.FilterTaskPluginIdentity, kind)

	ok, kind = ChannelSatisfiesFilters(ordinary, "gpt-4", []dto.ChannelFilter{{
		Kind:        dto.FilterRequestPath,
		RequestPath: "/v1/chat/completions",
	}})
	require.True(t, ok)
	assert.Equal(t, dto.ChannelFilterKind(""), kind)

	ok, kind = ChannelSatisfiesFilters(custom, "gpt-4", []dto.ChannelFilter{{
		Kind:        dto.FilterRequestPath,
		RequestPath: "/v1/responses",
	}})
	assert.False(t, ok)
	assert.Equal(t, dto.FilterRequestPath, kind)
}
