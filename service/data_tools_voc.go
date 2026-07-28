package service

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/shopspring/decimal"
)

var (
	ErrDataToolsNotConfigured = errors.New("data tools provider is not configured")
	ErrDataToolCallInProgress = errors.New("this data tool call is still in progress")
	ErrDataToolInsufficient   = errors.New("insufficient credits for this data tool call")
	ErrDataToolAPIKeyRequired = errors.New("a Flatkey API key is required to run data tools")
	ErrDataToolPlanRequired   = errors.New("Data Tools require a Go or higher subscription")
)

const dataToolResponseLimit = 32 << 20

type DataToolPricing struct {
	Model           string  `json:"model"`
	Amount          float64 `json:"amount"`
	Base            float64 `json:"base"`
	PayOnMatch      bool    `json:"payOnMatch"`
	Currency        string  `json:"currency"`
	Unit            string  `json:"unit,omitempty"`
	Label           string  `json:"label,omitempty"`
	QuantityField   string  `json:"quantityField,omitempty"`
	MultiplierField string  `json:"multiplierField,omitempty"`
}

type DataToolSummary struct {
	ID              string          `json:"id"`
	Name            string          `json:"name"`
	Provider        string          `json:"provider"`
	Platform        string          `json:"platform"`
	Categories      []string        `json:"categories"`
	Description     string          `json:"description"`
	Pricing         DataToolPricing `json:"pricing"`
	Quarantined     *string         `json:"quarantined"`
	IsNew           bool            `json:"isNew"`
	FlatkeyPriceUSD float64         `json:"flatkey_price_usd"`
}

type DataToolPlatform struct {
	Platform string `json:"platform"`
	Count    int    `json:"count"`
	IsNew    bool   `json:"isNew"`
}

type DataToolList struct {
	Total      int                `json:"total"`
	Matched    int                `json:"matched"`
	Page       int                `json:"page"`
	PageSize   int                `json:"pageSize"`
	NextCursor *string            `json:"nextCursor"`
	Tools      []DataToolSummary  `json:"tools"`
	Platforms  []DataToolPlatform `json:"platforms"`
}

type DataToolFieldSchema struct {
	Type        string          `json:"type"`
	Description string          `json:"description,omitempty"`
	Enum        []any           `json:"enum,omitempty"`
	Default     json.RawMessage `json:"default,omitempty"`
	Example     json.RawMessage `json:"example,omitempty"`
	Items       map[string]any  `json:"items,omitempty"`
}

type DataToolInputSchema struct {
	Type       string                         `json:"type"`
	Properties map[string]DataToolFieldSchema `json:"properties"`
	Required   []string                       `json:"required,omitempty"`
}

type DataToolInspection struct {
	ID              string              `json:"id"`
	Name            string              `json:"name"`
	Provider        string              `json:"provider"`
	Description     string              `json:"description"`
	Input           DataToolInputSchema `json:"input"`
	Pricing         DataToolPricing     `json:"pricing"`
	Quarantined     *string             `json:"quarantined"`
	FlatkeyPriceUSD float64             `json:"flatkey_price_usd"`
}

type DataToolRunResult struct {
	Tool           string          `json:"tool"`
	Output         json.RawMessage `json:"output"`
	ResultCount    int             `json:"resultCount"`
	ChargedQuota   int             `json:"charged_quota"`
	ChargedUSD     float64         `json:"charged_usd"`
	RemainingQuota int             `json:"remaining_quota"`
	Replayed       bool            `json:"replayed"`
	LatencyMS      int             `json:"latencyMs"`
}

type dataToolMCPRequest struct {
	JSONRPC string                `json:"jsonrpc"`
	ID      int                   `json:"id"`
	Method  string                `json:"method"`
	Params  dataToolMCPCallParams `json:"params"`
}

type dataToolMCPCallParams struct {
	Name      string         `json:"name"`
	Arguments map[string]any `json:"arguments"`
}

type dataToolMCPContent struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

type dataToolMCPResult struct {
	IsError           bool                 `json:"isError"`
	Content           []dataToolMCPContent `json:"content"`
	StructuredContent json.RawMessage      `json:"structuredContent"`
}

type dataToolMCPEnvelope struct {
	Result *dataToolMCPResult `json:"result"`
	Error  *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

func dataToolsMCPConfig() (string, string, error) {
	url := strings.TrimSpace(common.GetEnvOrDefaultString("VOC_DATA_MCP_URL", ""))
	key := strings.TrimSpace(common.GetEnvOrDefaultString("VOC_DATA_MCP_SERVICE_KEY", ""))
	if url == "" || key == "" {
		return "", "", ErrDataToolsNotConfigured
	}
	return url, key, nil
}

func callDataToolsMCP(
	ctx context.Context,
	name string,
	arguments map[string]any,
	idempotencyKey string,
	out any,
) error {
	url, key, err := dataToolsMCPConfig()
	if err != nil {
		return err
	}
	payload, err := common.Marshal(dataToolMCPRequest{
		JSONRPC: "2.0",
		ID:      1,
		Method:  "tools/call",
		Params: dataToolMCPCallParams{
			Name:      name,
			Arguments: arguments,
		},
	})
	if err != nil {
		return err
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return err
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Accept", "application/json, text/event-stream")
	request.Header.Set("Authorization", "Bearer "+key)
	if idempotencyKey != "" {
		request.Header.Set("Idempotency-Key", idempotencyKey)
	}

	timeout := time.Duration(common.GetEnvOrDefault("VOC_DATA_MCP_TIMEOUT_SECONDS", 180)) * time.Second
	client := &http.Client{Timeout: timeout}
	response, err := client.Do(request)
	if err != nil {
		return fmt.Errorf("data tools provider request failed: %w", err)
	}
	defer response.Body.Close()

	body, err := io.ReadAll(io.LimitReader(response.Body, dataToolResponseLimit+1))
	if err != nil {
		return fmt.Errorf("failed to read data tools provider response: %w", err)
	}
	if len(body) > dataToolResponseLimit {
		return errors.New("data tools provider response exceeds 32 MiB")
	}
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return fmt.Errorf("data tools provider returned HTTP %d: %s", response.StatusCode, truncateDataToolError(string(body)))
	}

	body = unwrapDataToolSSE(body)
	var envelope dataToolMCPEnvelope
	if err := common.Unmarshal(body, &envelope); err != nil {
		return fmt.Errorf("data tools provider returned invalid JSON: %w", err)
	}
	if envelope.Error != nil {
		return fmt.Errorf("data tools provider protocol error %d: %s", envelope.Error.Code, envelope.Error.Message)
	}
	if envelope.Result == nil {
		return errors.New("data tools provider returned no result")
	}
	if envelope.Result.IsError {
		message := "data tool call failed"
		for _, content := range envelope.Result.Content {
			if content.Type == "text" && strings.TrimSpace(content.Text) != "" {
				message = content.Text
				break
			}
		}
		return errors.New(message)
	}
	if len(envelope.Result.StructuredContent) == 0 {
		return errors.New("data tools provider returned no structured content")
	}
	if err := common.Unmarshal(envelope.Result.StructuredContent, out); err != nil {
		return fmt.Errorf("failed to decode data tools provider result: %w", err)
	}
	return nil
}

func unwrapDataToolSSE(body []byte) []byte {
	text := string(body)
	if !strings.Contains(text, "\ndata:") && !strings.HasPrefix(text, "data:") {
		return body
	}
	var parts []string
	for _, line := range strings.Split(text, "\n") {
		if strings.HasPrefix(line, "data:") {
			parts = append(parts, strings.TrimSpace(strings.TrimPrefix(line, "data:")))
		}
	}
	if len(parts) == 0 {
		return body
	}
	return []byte(strings.Join(parts, ""))
}

func truncateDataToolError(message string) string {
	message = strings.TrimSpace(message)
	if len(message) <= 500 {
		return message
	}
	return message[:500]
}

func ListDataTools(
	ctx context.Context,
	query string,
	platform string,
	page int,
	pageSize int,
	cursor string,
) (*DataToolList, error) {
	url, _, err := dataToolsMCPConfig()
	if err != nil {
		return nil, err
	}
	if directDataToolsEnabled(url) {
		return listDirectDataTools(ctx, query, platform, page, pageSize)
	}
	arguments := map[string]any{
		"page":     page,
		"pageSize": pageSize,
	}
	if query != "" {
		arguments["query"] = query
	}
	if platform != "" {
		arguments["platform"] = platform
	}
	if cursor != "" {
		arguments["cursor"] = cursor
	}

	var result DataToolList
	if err := callDataToolsMCP(ctx, "list", arguments, "", &result); err != nil {
		return nil, err
	}
	for index := range result.Tools {
		result.Tools[index].FlatkeyPriceUSD = DataToolCatalogPriceUSD(result.Tools[index].Pricing)
	}
	return &result, nil
}

func InspectDataTool(ctx context.Context, toolID string) (*DataToolInspection, error) {
	url, _, err := dataToolsMCPConfig()
	if err != nil {
		return nil, err
	}
	if directDataToolsEnabled(url) {
		return inspectDirectDataTool(ctx, toolID)
	}
	var result DataToolInspection
	if err := callDataToolsMCP(ctx, "inspect", map[string]any{"id": toolID}, "", &result); err != nil {
		return nil, err
	}
	result.FlatkeyPriceUSD = DataToolCatalogPriceUSD(result.Pricing)
	return &result, nil
}

type vocDataToolRunResult struct {
	Tool        string          `json:"tool"`
	Output      json.RawMessage `json:"output"`
	ResultCount int             `json:"resultCount"`
	MeteredUSD  *float64        `json:"meteredUsd"`
	LatencyMS   int             `json:"latencyMs"`
}

func runVOCDataTool(
	ctx context.Context,
	toolID string,
	input map[string]any,
	idempotencyKey string,
) (*vocDataToolRunResult, error) {
	url, _, err := dataToolsMCPConfig()
	if err != nil {
		return nil, err
	}
	if directDataToolsEnabled(url) {
		return runDirectVOCDataTool(ctx, toolID, input, idempotencyKey)
	}
	var result vocDataToolRunResult
	err = callDataToolsMCP(
		ctx,
		"run",
		map[string]any{"id": toolID, "input": input},
		idempotencyKey,
		&result,
	)
	if err != nil {
		return nil, err
	}
	return &result, nil
}

func dataToolMarkupBPS() int {
	return common.GetEnvOrDefault("FLATKEY_DATA_TOOL_MARKUP_BPS", 10000)
}

func dataToolVariableBasePriceUSD() float64 {
	priceMicroUSD := common.GetEnvOrDefault("FLATKEY_DATA_TOOL_VARIABLE_BASE_MICRO_USD", 12500)
	if priceMicroUSD < 0 {
		common.SysError("FLATKEY_DATA_TOOL_VARIABLE_BASE_MICRO_USD cannot be negative; using 12500")
		priceMicroUSD = 12500
	}
	return float64(priceMicroUSD) / 1_000_000.0
}

func DataToolCatalogPriceUSD(pricing DataToolPricing) float64 {
	return dataToolPriceUSD(pricing, nil)
}

func applyDataToolMarkup(basePrice float64) float64 {
	if basePrice <= 0 || math.IsNaN(basePrice) || math.IsInf(basePrice, 0) {
		return 0
	}
	markupBPS := dataToolMarkupBPS()
	if markupBPS < 0 {
		markupBPS = 0
	}
	priceMicroUSD := decimal.NewFromFloat(basePrice).
		Mul(decimal.NewFromInt(int64(markupBPS))).
		Div(decimal.NewFromInt(10_000)).
		Mul(decimal.NewFromInt(1_000_000)).
		Ceil()
	return priceMicroUSD.Div(decimal.NewFromInt(1_000_000)).InexactFloat64()
}

func dataToolPriceUSD(pricing DataToolPricing, input map[string]any) float64 {
	if pricing.Model == "free" {
		return 0
	}
	basePrice := pricing.Amount
	if pricing.Model == "provider_tokens" {
		basePrice = dataToolVariableBasePriceUSD()
	}
	if pricing.Model == "per_result" {
		basePrice = pricing.Base + pricing.Amount*estimatedDataToolResultCount(input)
	}
	if pricing.Model == "per_second" && input != nil {
		quantity := numberFromDataToolInput(input[pricing.QuantityField])
		if quantity > 0 {
			basePrice = pricing.Amount * quantity
			if values, ok := input[pricing.MultiplierField].([]any); ok && len(values) > 1 {
				basePrice *= float64(len(values))
			}
		}
	}
	return applyDataToolMarkup(basePrice)
}

func settledDataToolPriceUSD(
	pricing DataToolPricing,
	input map[string]any,
	resultCount int,
	meteredUSD *float64,
) (float64, error) {
	if pricing.Model == "free" {
		return 0, nil
	}
	// Provider-token tools intentionally use Flatkey's configured fixed price;
	// VOC reports zero for them because Flatkey owns terminal-user pricing.
	if pricing.Model == "provider_tokens" {
		return dataToolPriceUSD(pricing, input), nil
	}
	if meteredUSD != nil {
		if *meteredUSD < 0 || math.IsNaN(*meteredUSD) || math.IsInf(*meteredUSD, 0) {
			return 0, errors.New("data tools provider returned invalid metered price")
		}
		return applyDataToolMarkup(*meteredUSD), nil
	}
	// Backward-compatible fallback during rolling deploys where an older VOC
	// instance does not yet return meteredUsd.
	if pricing.Model == "per_result" {
		if resultCount < 0 {
			resultCount = 0
		}
		if pricing.PayOnMatch && resultCount == 0 {
			return 0, nil
		}
		return applyDataToolMarkup(pricing.Base + pricing.Amount*float64(resultCount)), nil
	}
	return dataToolPriceUSD(pricing, input), nil
}

func estimatedDataToolResultCount(input map[string]any) float64 {
	if input == nil {
		return 1
	}
	for _, field := range []string{
		"limit", "size", "count", "pageSize", "page_size", "per_page",
		"max_results", "maxResults", "max_jobs", "maxJobs",
	} {
		if quantity := numberFromDataToolInput(input[field]); quantity > 0 {
			return quantity
		}
	}
	for _, value := range input {
		switch typed := value.(type) {
		case []any:
			if len(typed) > 1 {
				return float64(len(typed))
			}
		case []string:
			if len(typed) > 1 {
				return float64(len(typed))
			}
		}
	}
	return 1
}

func numberFromDataToolInput(value any) float64 {
	switch typed := value.(type) {
	case float64:
		return typed
	case float32:
		return float64(typed)
	case int:
		return float64(typed)
	case int64:
		return float64(typed)
	case string:
		var parsed float64
		if _, err := fmt.Sscanf(typed, "%f", &parsed); err == nil {
			return parsed
		}
	}
	return 0
}
