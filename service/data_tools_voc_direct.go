package service

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
)

const directDataToolMCPProtocolVersion = "2025-03-26"

type directDataToolDefinition struct {
	Name        string                    `json:"name"`
	Description string                    `json:"description"`
	InputSchema directDataToolInputSchema `json:"inputSchema"`
}

type directDataToolInputSchema struct {
	Type       string                    `json:"type"`
	Properties map[string]map[string]any `json:"properties"`
	Required   []string                  `json:"required"`
}

type directDataToolListResult struct {
	Tools      []directDataToolDefinition `json:"tools"`
	NextCursor *string                    `json:"nextCursor"`
}

type directDataToolEnvelope struct {
	Result json.RawMessage `json:"result"`
	Error  *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

type directDataToolCatalogCache struct {
	sync.RWMutex
	Fingerprint [32]byte
	ExpiresAt   time.Time
	Tools       []directDataToolDefinition
}

var directDataToolCatalog directDataToolCatalogCache

func directDataToolsEnabled(providerURL string) bool {
	mode := strings.ToLower(strings.TrimSpace(common.GetEnvOrDefaultString("VOC_DATA_MCP_MODE", "")))
	switch mode {
	case "direct":
		return true
	case "gateway":
		return false
	}
	parsed, err := url.Parse(providerURL)
	return err == nil && strings.EqualFold(parsed.Hostname(), "open.voc.ai")
}

func directDataToolAuthHeader() string {
	header := strings.TrimSpace(common.GetEnvOrDefaultString("VOC_DATA_MCP_AUTH_HEADER", "X-API-Key"))
	if header == "" || strings.ContainsAny(header, "\r\n:") {
		return "X-API-Key"
	}
	return header
}

func directDataToolCatalogTTL() time.Duration {
	seconds := common.GetEnvOrDefault("VOC_DATA_MCP_CATALOG_TTL_SECONDS", 300)
	if seconds < 0 {
		seconds = 0
	}
	return time.Duration(seconds) * time.Second
}

func directDataToolHTTPClient() *http.Client {
	timeout := time.Duration(common.GetEnvOrDefault("VOC_DATA_MCP_TIMEOUT_SECONDS", 180)) * time.Second
	return &http.Client{Timeout: timeout}
}

func postDirectDataToolMCP(
	ctx context.Context,
	providerURL string,
	key string,
	sessionID string,
	idempotencyKey string,
	payload any,
) ([]byte, http.Header, error) {
	body, err := common.Marshal(payload)
	if err != nil {
		return nil, nil, err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, providerURL, bytes.NewReader(body))
	if err != nil {
		return nil, nil, err
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Accept", "application/json, text/event-stream")
	request.Header.Set(directDataToolAuthHeader(), key)
	request.Header.Set("MCP-Protocol-Version", directDataToolMCPProtocolVersion)
	if sessionID != "" {
		request.Header.Set("Mcp-Session-Id", sessionID)
	}
	if idempotencyKey != "" {
		request.Header.Set("Idempotency-Key", idempotencyKey)
	}

	response, err := directDataToolHTTPClient().Do(request)
	if err != nil {
		return nil, nil, fmt.Errorf("VOC OpenAPI MCP request failed: %w", err)
	}
	defer response.Body.Close()
	responseBody, err := io.ReadAll(io.LimitReader(response.Body, dataToolResponseLimit+1))
	if err != nil {
		return nil, nil, fmt.Errorf("failed to read VOC OpenAPI MCP response: %w", err)
	}
	if len(responseBody) > dataToolResponseLimit {
		return nil, nil, errors.New("VOC OpenAPI MCP response exceeds 32 MiB")
	}
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return nil, response.Header, fmt.Errorf(
			"VOC OpenAPI MCP returned HTTP %d: %s",
			response.StatusCode,
			truncateDataToolError(string(responseBody)),
		)
	}
	return unwrapDataToolSSE(responseBody), response.Header, nil
}

func callDirectDataToolMCP(
	ctx context.Context,
	method string,
	params any,
	idempotencyKey string,
	out any,
) error {
	providerURL, key, err := dataToolsMCPConfig()
	if err != nil {
		return err
	}
	initializeBody, headers, err := postDirectDataToolMCP(
		ctx,
		providerURL,
		key,
		"",
		"",
		map[string]any{
			"jsonrpc": "2.0",
			"id":      1,
			"method":  "initialize",
			"params": map[string]any{
				"protocolVersion": directDataToolMCPProtocolVersion,
				"capabilities":    map[string]any{},
				"clientInfo": map[string]any{
					"name":    "flatkey-data-tools",
					"version": "1.0.0",
				},
			},
		},
	)
	if err != nil {
		return err
	}
	var initializeEnvelope directDataToolEnvelope
	if err := common.Unmarshal(initializeBody, &initializeEnvelope); err != nil {
		return fmt.Errorf("VOC OpenAPI MCP returned invalid initialize response: %w", err)
	}
	if initializeEnvelope.Error != nil {
		return fmt.Errorf(
			"VOC OpenAPI MCP initialize error %d: %s",
			initializeEnvelope.Error.Code,
			initializeEnvelope.Error.Message,
		)
	}
	sessionID := strings.TrimSpace(headers.Get("Mcp-Session-Id"))
	if sessionID == "" {
		return errors.New("VOC OpenAPI MCP did not return a session id")
	}

	if _, _, err := postDirectDataToolMCP(
		ctx,
		providerURL,
		key,
		sessionID,
		"",
		map[string]any{
			"jsonrpc": "2.0",
			"method":  "notifications/initialized",
		},
	); err != nil {
		return err
	}

	responseBody, _, err := postDirectDataToolMCP(
		ctx,
		providerURL,
		key,
		sessionID,
		idempotencyKey,
		map[string]any{
			"jsonrpc": "2.0",
			"id":      2,
			"method":  method,
			"params":  params,
		},
	)
	if err != nil {
		return err
	}
	var envelope directDataToolEnvelope
	if err := common.Unmarshal(responseBody, &envelope); err != nil {
		return fmt.Errorf("VOC OpenAPI MCP returned invalid JSON: %w", err)
	}
	if envelope.Error != nil {
		return fmt.Errorf(
			"VOC OpenAPI MCP protocol error %d: %s",
			envelope.Error.Code,
			envelope.Error.Message,
		)
	}
	if len(envelope.Result) == 0 {
		return errors.New("VOC OpenAPI MCP returned no result")
	}
	if err := common.Unmarshal(envelope.Result, out); err != nil {
		return fmt.Errorf("failed to decode VOC OpenAPI MCP result: %w", err)
	}
	return nil
}

func loadDirectDataToolCatalog(ctx context.Context) ([]directDataToolDefinition, error) {
	providerURL, key, err := dataToolsMCPConfig()
	if err != nil {
		return nil, err
	}
	fingerprint := sha256.Sum256([]byte(providerURL + "\x00" + key))
	now := time.Now()
	directDataToolCatalog.RLock()
	if directDataToolCatalog.Fingerprint == fingerprint &&
		now.Before(directDataToolCatalog.ExpiresAt) &&
		directDataToolCatalog.Tools != nil {
		cached := append([]directDataToolDefinition(nil), directDataToolCatalog.Tools...)
		directDataToolCatalog.RUnlock()
		return cached, nil
	}
	directDataToolCatalog.RUnlock()

	var result directDataToolListResult
	if err := callDirectDataToolMCP(ctx, "tools/list", map[string]any{}, "", &result); err != nil {
		return nil, err
	}
	if result.NextCursor != nil && strings.TrimSpace(*result.NextCursor) != "" {
		return nil, errors.New("VOC OpenAPI MCP returned a paginated catalog that Flatkey cannot fully load")
	}
	sort.SliceStable(result.Tools, func(i, j int) bool {
		return result.Tools[i].Name < result.Tools[j].Name
	})
	ttl := directDataToolCatalogTTL()
	directDataToolCatalog.Lock()
	directDataToolCatalog.Fingerprint = fingerprint
	directDataToolCatalog.ExpiresAt = now.Add(ttl)
	directDataToolCatalog.Tools = append([]directDataToolDefinition(nil), result.Tools...)
	directDataToolCatalog.Unlock()
	return result.Tools, nil
}

func resetDirectDataToolCatalogCacheForTest() {
	directDataToolCatalog.Lock()
	directDataToolCatalog.Fingerprint = [32]byte{}
	directDataToolCatalog.ExpiresAt = time.Time{}
	directDataToolCatalog.Tools = nil
	directDataToolCatalog.Unlock()
}

func directDataToolPlatform(description string) string {
	const marker = "Platform:"
	index := strings.LastIndex(description, marker)
	if index < 0 {
		return "VOC OpenAPI"
	}
	platform := strings.TrimSpace(description[index+len(marker):])
	platform = strings.TrimSpace(strings.TrimSuffix(platform, "."))
	if platform == "" {
		return "VOC OpenAPI"
	}
	return platform
}

func directDataToolDisplayName(name string) string {
	words := strings.Fields(strings.ReplaceAll(name, "_", " "))
	for index := range words {
		if words[index] == "" {
			continue
		}
		words[index] = strings.ToUpper(words[index][:1]) + words[index][1:]
	}
	if len(words) == 0 {
		return name
	}
	return strings.Join(words, " ")
}

func directDataToolPricing() DataToolPricing {
	return DataToolPricing{
		Model:    "provider_tokens",
		Amount:   0,
		Base:     0,
		Currency: "USD",
		Unit:     "Open VOC API call",
		Label:    "Flatkey Credits",
	}
}

func rawDataToolValue(value any) json.RawMessage {
	if value == nil {
		return nil
	}
	body, err := common.Marshal(value)
	if err != nil {
		return nil
	}
	return body
}

func directDataToolSchemaType(raw map[string]any) string {
	if value, ok := raw["type"].(string); ok && value != "" && value != "null" {
		if value == "integer" {
			return "number"
		}
		return value
	}
	for _, unionKey := range []string{"anyOf", "oneOf"} {
		values, ok := raw[unionKey].([]any)
		if !ok {
			continue
		}
		for _, value := range values {
			option, ok := value.(map[string]any)
			if !ok {
				continue
			}
			if optionType := directDataToolSchemaType(option); optionType != "" {
				return optionType
			}
		}
	}
	if _, ok := raw["properties"]; ok {
		return "object"
	}
	if _, ok := raw["items"]; ok {
		return "array"
	}
	return "string"
}

func directDataToolField(raw map[string]any) DataToolFieldSchema {
	field := DataToolFieldSchema{Type: directDataToolSchemaType(raw)}
	if description, ok := raw["description"].(string); ok {
		field.Description = description
	}
	if values, ok := raw["enum"].([]any); ok {
		field.Enum = values
	}
	field.Default = rawDataToolValue(raw["default"])
	field.Example = rawDataToolValue(raw["example"])
	if items, ok := raw["items"].(map[string]any); ok {
		field.Items = items
	}
	return field
}

func directDataToolInput(input directDataToolInputSchema) DataToolInputSchema {
	properties := make(map[string]DataToolFieldSchema, len(input.Properties))
	for name, field := range input.Properties {
		properties[name] = directDataToolField(field)
	}
	return DataToolInputSchema{
		Type:       "object",
		Properties: properties,
		Required:   input.Required,
	}
}

func directDataToolSummary(tool directDataToolDefinition) DataToolSummary {
	platform := directDataToolPlatform(tool.Description)
	pricing := directDataToolPricing()
	return DataToolSummary{
		ID:              tool.Name,
		Name:            directDataToolDisplayName(tool.Name),
		Provider:        "voc-openapi",
		Platform:        platform,
		Categories:      []string{platform},
		Description:     tool.Description,
		Pricing:         pricing,
		Quarantined:     nil,
		IsNew:           true,
		FlatkeyPriceUSD: DataToolCatalogPriceUSD(pricing),
	}
}

func directDataToolInspection(tool directDataToolDefinition) DataToolInspection {
	pricing := directDataToolPricing()
	return DataToolInspection{
		ID:              tool.Name,
		Name:            directDataToolDisplayName(tool.Name),
		Provider:        "voc-openapi",
		Description:     tool.Description,
		Input:           directDataToolInput(tool.InputSchema),
		Pricing:         pricing,
		Quarantined:     nil,
		FlatkeyPriceUSD: DataToolCatalogPriceUSD(pricing),
	}
}

func listDirectDataTools(
	ctx context.Context,
	query string,
	platform string,
	page int,
	pageSize int,
) (*DataToolList, error) {
	catalog, err := loadDirectDataToolCatalog(ctx)
	if err != nil {
		return nil, err
	}
	terms := strings.Fields(strings.ToLower(query))
	filtered := make([]directDataToolDefinition, 0, len(catalog))
	platformCounts := make(map[string]int)
	for _, tool := range catalog {
		toolPlatform := directDataToolPlatform(tool.Description)
		platformCounts[toolPlatform]++
		if platform != "" && !strings.EqualFold(platform, toolPlatform) {
			continue
		}
		searchText := strings.ToLower(tool.Name + " " + directDataToolDisplayName(tool.Name) + " " + tool.Description)
		matches := true
		for _, term := range terms {
			if !strings.Contains(searchText, term) {
				matches = false
				break
			}
		}
		if matches {
			filtered = append(filtered, tool)
		}
	}
	start := (page - 1) * pageSize
	if start > len(filtered) {
		start = len(filtered)
	}
	end := start + pageSize
	if end > len(filtered) {
		end = len(filtered)
	}
	tools := make([]DataToolSummary, 0, end-start)
	for _, tool := range filtered[start:end] {
		tools = append(tools, directDataToolSummary(tool))
	}
	platforms := make([]DataToolPlatform, 0, len(platformCounts))
	for name, count := range platformCounts {
		platforms = append(platforms, DataToolPlatform{Platform: name, Count: count, IsNew: true})
	}
	sort.SliceStable(platforms, func(i, j int) bool {
		if platforms[i].Count == platforms[j].Count {
			return platforms[i].Platform < platforms[j].Platform
		}
		return platforms[i].Count > platforms[j].Count
	})
	return &DataToolList{
		Total:      len(catalog),
		Matched:    len(filtered),
		Page:       page,
		PageSize:   pageSize,
		NextCursor: nil,
		Tools:      tools,
		Platforms:  platforms,
	}, nil
}

func inspectDirectDataTool(ctx context.Context, toolID string) (*DataToolInspection, error) {
	catalog, err := loadDirectDataToolCatalog(ctx)
	if err != nil {
		return nil, err
	}
	for _, tool := range catalog {
		if tool.Name == toolID {
			inspection := directDataToolInspection(tool)
			return &inspection, nil
		}
	}
	return nil, fmt.Errorf("VOC OpenAPI tool %q was not found", toolID)
}

func directDataToolOutput(result dataToolMCPResult) (json.RawMessage, error) {
	if len(result.StructuredContent) > 0 {
		return result.StructuredContent, nil
	}
	for _, content := range result.Content {
		if content.Type != "text" {
			continue
		}
		text := strings.TrimSpace(content.Text)
		if text == "" {
			continue
		}
		var value any
		if err := common.Unmarshal([]byte(text), &value); err == nil {
			return json.RawMessage(text), nil
		}
		body, err := common.Marshal(text)
		return body, err
	}
	return nil, errors.New("VOC OpenAPI MCP returned no text or structured output")
}

func directDataToolResultCount(output json.RawMessage) int {
	var value any
	if err := common.Unmarshal(output, &value); err != nil {
		return 1
	}
	switch typed := value.(type) {
	case []any:
		return len(typed)
	case map[string]any:
		for _, key := range []string{"data", "items", "results", "records", "list"} {
			if items, ok := typed[key].([]any); ok {
				return len(items)
			}
		}
	}
	if value == nil {
		return 0
	}
	return 1
}

func runDirectVOCDataTool(
	ctx context.Context,
	toolID string,
	input map[string]any,
	idempotencyKey string,
) (*vocDataToolRunResult, error) {
	startedAt := time.Now()
	var result dataToolMCPResult
	err := callDirectDataToolMCP(
		ctx,
		"tools/call",
		map[string]any{
			"name":      toolID,
			"arguments": input,
		},
		idempotencyKey,
		&result,
	)
	if err != nil {
		return nil, err
	}
	if result.IsError {
		message := "VOC OpenAPI tool call failed"
		for _, content := range result.Content {
			if content.Type == "text" && strings.TrimSpace(content.Text) != "" {
				message = strings.TrimSpace(content.Text)
				break
			}
		}
		return nil, errors.New(message)
	}
	output, err := directDataToolOutput(result)
	if err != nil {
		return nil, err
	}
	return &vocDataToolRunResult{
		Tool:        toolID,
		Output:      output,
		ResultCount: directDataToolResultCount(output),
		MeteredUSD:  nil,
		LatencyMS:   int(time.Since(startedAt).Milliseconds()),
	}, nil
}
