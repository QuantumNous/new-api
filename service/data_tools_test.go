package service

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func writeDataToolMCPResult(t *testing.T, writer http.ResponseWriter, structured any) {
	t.Helper()
	body, err := common.Marshal(map[string]any{
		"jsonrpc": "2.0",
		"id":      1,
		"result": map[string]any{
			"content":           []map[string]any{{"type": "text", "text": "{}"}},
			"structuredContent": structured,
		},
	})
	require.NoError(t, err)
	writer.Header().Set("Content-Type", "application/json")
	_, err = writer.Write(body)
	require.NoError(t, err)
}

func writeDirectDataToolMCPResult(t *testing.T, writer http.ResponseWriter, id int, result any) {
	t.Helper()
	body, err := common.Marshal(map[string]any{
		"jsonrpc": "2.0",
		"id":      id,
		"result":  result,
	})
	require.NoError(t, err)
	writer.Header().Set("Content-Type", "text/event-stream")
	_, err = fmt.Fprintf(writer, "event:message\ndata:%s\n\n", body)
	require.NoError(t, err)
}

func TestDirectDataToolsListInspectAndFilterOpenVOCTenant(t *testing.T) {
	resetDirectDataToolCatalogCacheForTest()
	t.Cleanup(resetDirectDataToolCatalogCacheForTest)
	var requests atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		requests.Add(1)
		require.Equal(t, "tenant-key", request.Header.Get("X-API-Key"))
		require.Empty(t, request.Header.Get("Authorization"))
		var envelope struct {
			ID     int            `json:"id"`
			Method string         `json:"method"`
			Params map[string]any `json:"params"`
		}
		require.NoError(t, common.DecodeJson(request.Body, &envelope))
		switch envelope.Method {
		case "initialize":
			writer.Header().Set("Mcp-Session-Id", "tenant-session")
			writeDirectDataToolMCPResult(t, writer, envelope.ID, map[string]any{
				"protocolVersion": directDataToolMCPProtocolVersion,
				"serverInfo":      map[string]any{"name": "voc-openapi", "version": "1.0.0"},
			})
		case "notifications/initialized":
			require.Equal(t, "tenant-session", request.Header.Get("Mcp-Session-Id"))
			writer.WriteHeader(http.StatusAccepted)
		case "tools/list":
			require.Equal(t, "tenant-session", request.Header.Get("Mcp-Session-Id"))
			writeDirectDataToolMCPResult(t, writer, envelope.ID, map[string]any{
				"tools": []map[string]any{
					{
						"name":        "threads_search_recent",
						"description": "Search recent posts. Platform: Threads Web.",
						"inputSchema": map[string]any{
							"type": "object",
							"properties": map[string]any{
								"query": map[string]any{"type": "string", "description": "Search query"},
								"limit": map[string]any{"type": "integer", "description": "Maximum results"},
								"tags": map[string]any{
									"anyOf": []map[string]any{
										{"type": "array", "items": map[string]any{"type": "string"}},
										{"type": "null"},
									},
								},
							},
							"required": []string{"query"},
						},
					},
					{
						"name":        "reddit_comments",
						"description": "Get comments. Platform: Reddit App.",
						"inputSchema": map[string]any{"type": "object", "properties": map[string]any{}},
					},
				},
			})
		default:
			t.Fatalf("unexpected direct MCP method %q", envelope.Method)
		}
	}))
	defer server.Close()
	t.Setenv("VOC_DATA_MCP_URL", server.URL)
	t.Setenv("VOC_DATA_MCP_SERVICE_KEY", "tenant-key")
	t.Setenv("VOC_DATA_MCP_MODE", "direct")
	t.Setenv("VOC_DATA_MCP_AUTH_HEADER", "X-API-Key")
	t.Setenv("VOC_DATA_MCP_CATALOG_TTL_SECONDS", "300")
	t.Setenv("FLATKEY_DATA_TOOL_VARIABLE_BASE_MICRO_USD", "12500")

	list, err := ListDataTools(t.Context(), "search recent", "Threads Web", 1, 24, "")
	require.NoError(t, err)
	require.Equal(t, 2, list.Total)
	require.Equal(t, 1, list.Matched)
	require.Len(t, list.Tools, 1)
	require.Equal(t, "threads_search_recent", list.Tools[0].ID)
	require.Equal(t, "provider_tokens", list.Tools[0].Pricing.Model)
	require.Equal(t, 0.0125, list.Tools[0].FlatkeyPriceUSD)
	require.Len(t, list.Platforms, 2)

	inspection, err := InspectDataTool(t.Context(), "threads_search_recent")
	require.NoError(t, err)
	require.Equal(t, "number", inspection.Input.Properties["limit"].Type)
	require.Equal(t, "array", inspection.Input.Properties["tags"].Type)
	require.Equal(t, []string{"query"}, inspection.Input.Required)
	require.Equal(t, int32(3), requests.Load(), "inspect should reuse the tenant-scoped catalog cache")
}

func TestDirectDataToolRunParsesTextJSONAndForwardsIdempotencyKey(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		var envelope struct {
			ID     int            `json:"id"`
			Method string         `json:"method"`
			Params map[string]any `json:"params"`
		}
		require.NoError(t, common.DecodeJson(request.Body, &envelope))
		switch envelope.Method {
		case "initialize":
			writer.Header().Set("Mcp-Session-Id", "run-session")
			writeDirectDataToolMCPResult(t, writer, envelope.ID, map[string]any{
				"protocolVersion": directDataToolMCPProtocolVersion,
			})
		case "notifications/initialized":
			writer.WriteHeader(http.StatusAccepted)
		case "tools/call":
			require.Equal(t, "run-session", request.Header.Get("Mcp-Session-Id"))
			require.Equal(t, "stable-idempotency-key", request.Header.Get("Idempotency-Key"))
			require.Equal(t, "threads_search_recent", envelope.Params["name"])
			writeDirectDataToolMCPResult(t, writer, envelope.ID, map[string]any{
				"isError": false,
				"content": []map[string]any{{
					"type": "text",
					"text": `{"data":[{"id":"one"},{"id":"two"}]}`,
				}},
			})
		default:
			t.Fatalf("unexpected direct MCP method %q", envelope.Method)
		}
	}))
	defer server.Close()
	t.Setenv("VOC_DATA_MCP_URL", server.URL)
	t.Setenv("VOC_DATA_MCP_SERVICE_KEY", "tenant-key")
	t.Setenv("VOC_DATA_MCP_MODE", "direct")

	result, err := runVOCDataTool(
		t.Context(),
		"threads_search_recent",
		map[string]any{"query": "flatkey"},
		"stable-idempotency-key",
	)
	require.NoError(t, err)
	require.Equal(t, "threads_search_recent", result.Tool)
	require.Equal(t, 2, result.ResultCount)
	require.Nil(t, result.MeteredUSD)
	require.True(t, strings.Contains(string(result.Output), `"id":"one"`))
}

func TestListDataToolsUsesPartnerServiceKeyAndAddsFlatkeyPrice(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		require.Equal(t, "Bearer service-key", request.Header.Get("Authorization"))
		var envelope dataToolMCPRequest
		require.NoError(t, common.DecodeJson(request.Body, &envelope))
		require.Equal(t, "list", envelope.Params.Name)
		writeDataToolMCPResult(t, writer, map[string]any{
			"total":      1,
			"matched":    1,
			"page":       1,
			"pageSize":   24,
			"nextCursor": nil,
			"platforms":  []map[string]any{{"platform": "Monid", "count": 1, "isNew": true}},
			"tools": []map[string]any{{
				"id":          "gateway:monid:test",
				"name":        "Test",
				"provider":    "monid",
				"platform":    "Monid",
				"categories":  []string{"research"},
				"description": "Test tool",
				"pricing":     map[string]any{"model": "per_call", "amount": 0.002, "base": 0},
				"quarantined": nil,
				"isNew":       true,
			}},
		})
	}))
	defer server.Close()
	t.Setenv("VOC_DATA_MCP_URL", server.URL)
	t.Setenv("VOC_DATA_MCP_SERVICE_KEY", "service-key")
	t.Setenv("FLATKEY_DATA_TOOL_MARKUP_BPS", "12500")

	result, err := ListDataTools(t.Context(), "", "Monid", 1, 24, "")
	require.NoError(t, err)
	require.Len(t, result.Tools, 1)
	require.Equal(t, 0.0025, result.Tools[0].FlatkeyPriceUSD)
}

func TestInspectDataToolAcceptsMixedPrimitiveEnums(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		var envelope dataToolMCPRequest
		require.NoError(t, common.DecodeJson(request.Body, &envelope))
		require.Equal(t, "inspect", envelope.Params.Name)
		writeDataToolMCPResult(t, writer, map[string]any{
			"id":          "provider.numeric-enum",
			"name":        "Numeric Enum",
			"provider":    "provider",
			"description": "A tool with a numeric enum",
			"input": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"limit": map[string]any{
						"type": "number",
						"enum": []any{10, 20, "30", true},
					},
				},
			},
			"pricing":     map[string]any{"model": "free", "amount": 0, "base": 0},
			"quarantined": nil,
		})
	}))
	defer server.Close()
	t.Setenv("VOC_DATA_MCP_URL", server.URL)
	t.Setenv("VOC_DATA_MCP_SERVICE_KEY", "service-key")

	inspection, err := InspectDataTool(t.Context(), "provider.numeric-enum")
	require.NoError(t, err)
	require.Equal(t, []any{float64(10), float64(20), "30", true}, inspection.Input.Properties["limit"].Enum)
}

func TestExecuteDataToolChargesFlatkeyOnceAndReplaysStoredResult(t *testing.T) {
	originalDB := model.DB
	originalQuotaPerUnit := common.QuotaPerUnit
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.Token{}, &model.DataToolCall{}))
	model.DB = db
	common.QuotaPerUnit = 500_000
	t.Cleanup(func() {
		model.DB = originalDB
		common.QuotaPerUnit = originalQuotaPerUnit
	})

	user := &model.User{Username: "service-data-tool", Password: "password", Quota: 1000, AffCode: "svdt"}
	require.NoError(t, model.DB.Create(user).Error)
	token := &model.Token{
		UserId:      user.Id,
		Key:         "service-data-tool-key",
		Name:        "test",
		Status:      common.TokenStatusEnabled,
		RemainQuota: 1000,
	}
	require.NoError(t, model.DB.Create(token).Error)
	var runCalls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		var envelope dataToolMCPRequest
		require.NoError(t, common.DecodeJson(request.Body, &envelope))
		switch envelope.Params.Name {
		case "inspect":
			writeDataToolMCPResult(t, writer, map[string]any{
				"id":          "provider.tool",
				"name":        "Provider Tool",
				"provider":    "provider",
				"description": "A test tool",
				"input":       map[string]any{"type": "object", "properties": map[string]any{}},
				"pricing":     map[string]any{"model": "per_call", "amount": 0.001, "base": 0},
				"quarantined": nil,
			})
		case "run":
			runCalls.Add(1)
			require.NotEmpty(t, request.Header.Get("Idempotency-Key"))
			writeDataToolMCPResult(t, writer, map[string]any{
				"tool":        "provider.tool",
				"output":      map[string]any{"value": 42},
				"resultCount": 1,
				"meteredUsd":  0.001,
				"latencyMs":   12,
			})
		default:
			t.Fatalf("unexpected MCP tool %q", envelope.Params.Name)
		}
	}))
	defer server.Close()
	t.Setenv("VOC_DATA_MCP_URL", server.URL)
	t.Setenv("VOC_DATA_MCP_SERVICE_KEY", "service-key")
	t.Setenv("FLATKEY_DATA_TOOL_MARKUP_BPS", "10000")
	t.Setenv("FLATKEY_DATA_TOOL_MIN_PLAN_RANK", "0")

	first, err := ExecuteDataTool(
		t.Context(),
		DataToolBillingContext{UserID: user.Id, TokenID: token.Id, TokenKey: token.Key},
		"client-idem-1",
		"provider.tool",
		map[string]any{"query": "test"},
	)
	require.NoError(t, err)
	require.False(t, first.Replayed)
	require.Equal(t, 500, first.ChargedQuota)
	require.Equal(t, 500, first.RemainingQuota)

	replay, err := ExecuteDataTool(
		t.Context(),
		DataToolBillingContext{UserID: user.Id, TokenID: token.Id, TokenKey: token.Key},
		"client-idem-1",
		"provider.tool",
		map[string]any{"query": "test"},
	)
	require.NoError(t, err)
	require.True(t, replay.Replayed)
	require.Equal(t, int32(1), runCalls.Load())
	var chargedUser model.User
	require.NoError(t, model.DB.First(&chargedUser, user.Id).Error)
	require.Equal(t, 500, chargedUser.Quota)
	require.Equal(t, 500, chargedUser.UsedQuota)
	var chargedToken model.Token
	require.NoError(t, model.DB.First(&chargedToken, token.Id).Error)
	require.Equal(t, 500, chargedToken.RemainQuota)
	require.Equal(t, 500, chargedToken.UsedQuota)
}

func TestExecuteDataToolRequiresConfiguredSubscriptionTier(t *testing.T) {
	originalDB := model.DB
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(
		&model.User{},
		&model.Token{},
		&model.DataToolCall{},
		&model.SubscriptionPlan{},
		&model.UserSubscription{},
	))
	model.DB = db
	t.Cleanup(func() {
		model.DB = originalDB
	})

	user := &model.User{
		Username: "service-data-tool-plan-gate",
		Password: "password",
		Quota:    1000,
		AffCode:  "svdtpg",
	}
	require.NoError(t, model.DB.Create(user).Error)
	token := &model.Token{
		UserId:         user.Id,
		Key:            "service-data-tool-plan-gate-key",
		Name:           "test",
		Status:         common.TokenStatusEnabled,
		UnlimitedQuota: true,
	}
	require.NoError(t, model.DB.Create(token).Error)
	t.Setenv("FLATKEY_DATA_TOOL_MIN_PLAN_RANK", "20")

	_, err = ExecuteDataTool(
		t.Context(),
		DataToolBillingContext{
			UserID:         user.Id,
			TokenID:        token.Id,
			TokenKey:       token.Key,
			TokenUnlimited: true,
		},
		"client-plan-gate",
		"provider.tool",
		map[string]any{},
	)
	require.ErrorIs(t, err, ErrDataToolPlanRequired)

	var calls int64
	require.NoError(t, model.DB.Model(&model.DataToolCall{}).Count(&calls).Error)
	require.Zero(t, calls, "plan rejection must happen before reserving quota or calling VOC")
}

func TestDataToolMinPlanRankDefaultsToGo(t *testing.T) {
	t.Setenv("FLATKEY_DATA_TOOL_MIN_PLAN_RANK", "")
	require.Equal(t, 10, dataToolMinPlanRank())

	t.Setenv("FLATKEY_DATA_TOOL_MIN_PLAN_RANK", "20")
	require.Equal(t, 20, dataToolMinPlanRank())
}

func TestDataToolPerSecondPriceUsesInputQuantity(t *testing.T) {
	t.Setenv("FLATKEY_DATA_TOOL_MARKUP_BPS", "10000")
	price := dataToolPriceUSD(DataToolPricing{
		Model:         "per_second",
		Amount:        0.00225,
		QuantityField: "duration",
	}, map[string]any{"duration": float64(20)})
	require.Equal(t, 0.045, price)
}

func TestDataToolProviderTokensUsesFlatkeyVariableBasePrice(t *testing.T) {
	t.Setenv("FLATKEY_DATA_TOOL_MARKUP_BPS", "12500")
	t.Setenv("FLATKEY_DATA_TOOL_VARIABLE_BASE_MICRO_USD", "20000")

	price := dataToolPriceUSD(DataToolPricing{
		Model:  "provider_tokens",
		Amount: 0,
	}, nil)

	require.Equal(t, 0.025, price)
}

func TestDataToolPerResultSettlementUsesVOCMeteredPrice(t *testing.T) {
	t.Setenv("FLATKEY_DATA_TOOL_MARKUP_BPS", "12500")
	meteredUSD := 0.007

	price, err := settledDataToolPriceUSD(
		DataToolPricing{
			Model:      "per_result",
			Amount:     0.002,
			Base:       0.001,
			PayOnMatch: true,
		},
		map[string]any{"limit": float64(10)},
		3,
		&meteredUSD,
	)

	require.NoError(t, err)
	require.Equal(t, 0.00875, price)
}

func TestDataToolPayOnMatchZeroResultSettlesToZero(t *testing.T) {
	t.Setenv("FLATKEY_DATA_TOOL_MARKUP_BPS", "12500")
	meteredUSD := 0.0

	price, err := settledDataToolPriceUSD(
		DataToolPricing{
			Model:      "per_result",
			Amount:     0.04,
			PayOnMatch: true,
		},
		nil,
		0,
		&meteredUSD,
	)

	require.NoError(t, err)
	require.Zero(t, price)
}

func TestDataToolPerResultPreauthorizationUsesRequestedLimit(t *testing.T) {
	t.Setenv("FLATKEY_DATA_TOOL_MARKUP_BPS", "10000")

	price := dataToolPriceUSD(
		DataToolPricing{Model: "per_result", Amount: 0.002, Base: 0.001},
		map[string]any{"limit": float64(25)},
	)

	require.Equal(t, 0.051, price)
}
