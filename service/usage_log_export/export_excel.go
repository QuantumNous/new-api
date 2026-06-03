package usage_log_export

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/xuri/excelize/v2"
)

const (
	exportBatchSize      = 2000
	excelMaxRowsPerSheet = 1048576
	excelHeaderRows      = 1
	excelMaxDataRows     = excelMaxRowsPerSheet - excelHeaderRows
	maxOtherJSONRunes    = 8000
	usageLogSheetName    = "Usage Logs"
	createdAtTimeLayout  = "2006-01-02 15:04:05"
)

type FieldGroup struct {
	Key    string        `json:"key"`
	Label  string        `json:"label"`
	Fields []FieldOption `json:"fields"`
}

type FieldOption struct {
	Key       string `json:"key"`
	Label     string `json:"label"`
	Group     string `json:"group"`
	Default   bool   `json:"default"`
	AdminOnly bool   `json:"admin_only,omitempty"`
}

type ExportInput struct {
	Filter   model.LogExportFilter
	Fields   []string
	Timezone string
}

type fieldDefinition struct {
	Key       string
	Label     string
	Group     string
	Default   bool
	AdminOnly bool
	Value     func(*model.Log, map[string]interface{}) interface{}
}

var fieldDefinitions = []fieldDefinition{
	{Key: "created_at", Label: "Time", Group: "basic", Default: true, Value: func(log *model.Log, _ map[string]interface{}) interface{} {
		if log.CreatedAt == 0 {
			return ""
		}
		return time.Unix(log.CreatedAt, 0).Local().Format(createdAtTimeLayout)
	}},
	{Key: "type", Label: "Type", Group: "basic", Default: true, Value: func(log *model.Log, _ map[string]interface{}) interface{} {
		return logTypeLabel(log.Type)
	}},
	{Key: "channel", Label: "Channel", Group: "basic", Default: true, AdminOnly: true, Value: func(log *model.Log, _ map[string]interface{}) interface{} {
		if log.ChannelId == 0 {
			return ""
		}
		if strings.TrimSpace(log.ChannelName) == "" {
			return fmt.Sprintf("#%d", log.ChannelId)
		}
		return fmt.Sprintf("%s #%d", log.ChannelName, log.ChannelId)
	}},
	{Key: "user", Label: "User", Group: "basic", Default: true, AdminOnly: true, Value: func(log *model.Log, _ map[string]interface{}) interface{} {
		return log.Username
	}},
	{Key: "token_name", Label: "Token", Group: "basic", Default: true, Value: func(log *model.Log, _ map[string]interface{}) interface{} {
		return log.TokenName
	}},
	{Key: "model_name", Label: "Model", Group: "basic", Default: true, Value: func(log *model.Log, _ map[string]interface{}) interface{} {
		return log.ModelName
	}},
	{Key: "group", Label: "Group", Group: "basic", Default: true, Value: func(log *model.Log, other map[string]interface{}) interface{} {
		if log.Group != "" {
			return log.Group
		}
		return stringValue(other["group"])
	}},
	{Key: "use_time", Label: "Timing", Group: "basic", Default: true, Value: func(log *model.Log, _ map[string]interface{}) interface{} {
		return log.UseTime
	}},
	{Key: "prompt_tokens", Label: "Input Tokens", Group: "basic", Default: true, Value: func(log *model.Log, _ map[string]interface{}) interface{} {
		return log.PromptTokens
	}},
	{Key: "completion_tokens", Label: "Output Tokens", Group: "basic", Default: true, Value: func(log *model.Log, _ map[string]interface{}) interface{} {
		return log.CompletionTokens
	}},
	{Key: "quota", Label: "Cost", Group: "basic", Default: true, Value: func(log *model.Log, _ map[string]interface{}) interface{} {
		return log.Quota
	}},
	{Key: "details_summary", Label: "Details", Group: "basic", Default: true, Value: func(log *model.Log, _ map[string]interface{}) interface{} {
		return log.Content
	}},
	{Key: "cache_read_tokens", Label: "Cache Read Tokens", Group: "cache", Default: true, Value: func(_ *model.Log, other map[string]interface{}) interface{} {
		return numberValue(other["cache_tokens"])
	}},
	{Key: "cache_creation_tokens", Label: "Cache Creation Tokens", Group: "cache", Default: true, Value: func(_ *model.Log, other map[string]interface{}) interface{} {
		return numberValue(other["cache_creation_tokens"])
	}},
	{Key: "cache_creation_tokens_5m", Label: "5m Cache Creation Tokens", Group: "cache", Default: true, Value: func(_ *model.Log, other map[string]interface{}) interface{} {
		return numberValue(other["cache_creation_tokens_5m"])
	}},
	{Key: "cache_creation_tokens_1h", Label: "1h Cache Creation Tokens", Group: "cache", Default: true, Value: func(_ *model.Log, other map[string]interface{}) interface{} {
		return numberValue(other["cache_creation_tokens_1h"])
	}},
	{Key: "record_id", Label: "Record ID", Group: "advanced", AdminOnly: true, Value: func(log *model.Log, _ map[string]interface{}) interface{} {
		return log.Id
	}},
	{Key: "request_id", Label: "Request ID", Group: "advanced", Value: func(log *model.Log, _ map[string]interface{}) interface{} {
		return log.RequestId
	}},
	{Key: "upstream_request_id", Label: "Upstream Request ID", Group: "advanced", Value: func(log *model.Log, _ map[string]interface{}) interface{} {
		return log.UpstreamRequestId
	}},
	{Key: "created_at_unix", Label: "Created At (Unix)", Group: "advanced", Value: func(log *model.Log, _ map[string]interface{}) interface{} {
		return log.CreatedAt
	}},
	{Key: "ip", Label: "IP", Group: "advanced", AdminOnly: true, Value: func(log *model.Log, _ map[string]interface{}) interface{} {
		return log.Ip
	}},
	{Key: "other_json", Label: "Other JSON", Group: "advanced", AdminOnly: true, Value: func(log *model.Log, other map[string]interface{}) interface{} {
		return sanitizedOtherJSON(other)
	}},
}

var groupLabels = map[string]string{
	"basic":    "Basic Fields",
	"cache":    "Cache Fields",
	"advanced": "Advanced Fields",
}

func FieldGroups(isAdmin bool) []FieldGroup {
	groups := []FieldGroup{
		{Key: "basic", Label: groupLabels["basic"]},
		{Key: "cache", Label: groupLabels["cache"]},
		{Key: "advanced", Label: groupLabels["advanced"]},
	}
	indexByKey := map[string]int{"basic": 0, "cache": 1, "advanced": 2}
	for _, def := range fieldDefinitions {
		if def.AdminOnly && !isAdmin {
			continue
		}
		idx, ok := indexByKey[def.Group]
		if !ok {
			continue
		}
		groups[idx].Fields = append(groups[idx].Fields, FieldOption{
			Key:       def.Key,
			Label:     def.Label,
			Group:     def.Group,
			Default:   def.Default,
			AdminOnly: def.AdminOnly,
		})
	}
	out := make([]FieldGroup, 0, len(groups))
	for _, group := range groups {
		if len(group.Fields) > 0 {
			out = append(out, group)
		}
	}
	return out
}

func ExportXLSX(ctx context.Context, input ExportInput) ([]byte, string, int64, error) {
	file, filename, total, err := BuildXLSX(ctx, input)
	if err != nil {
		return nil, "", total, err
	}
	defer func() { _ = file.Close() }()
	var buf bytes.Buffer
	if err := file.Write(&buf); err != nil {
		return nil, "", total, err
	}
	return buf.Bytes(), filename, total, nil
}

func WriteXLSX(ctx context.Context, input ExportInput, writer io.Writer) (string, int64, error) {
	file, filename, total, err := BuildXLSX(ctx, input)
	if err != nil {
		return "", total, err
	}
	defer func() { _ = file.Close() }()
	if err := file.Write(writer); err != nil {
		return "", total, err
	}
	return filename, total, nil
}

func BuildXLSX(ctx context.Context, input ExportInput) (*excelize.File, string, int64, error) {
	total, err := model.CountLogsForExport(ctx, input.Filter)
	if err != nil {
		return nil, "", total, err
	}
	select {
	case <-ctx.Done():
		return nil, "", total, ctx.Err()
	default:
	}

	fields, err := resolveFields(input.Fields, input.Filter.IsAdmin)
	if err != nil {
		return nil, "", total, err
	}
	if len(fields) == 0 {
		return nil, "", total, fmt.Errorf("no export fields selected")
	}
	loc := exportLocation(input.Timezone)

	file := excelize.NewFile()
	success := false
	defer func() {
		if !success {
			_ = file.Close()
		}
	}()
	defaultSheet := file.GetSheetName(0)
	if defaultSheet == "" {
		defaultSheet = "Sheet1"
	}

	sheetIndex := 1
	sheetName := usageLogSheetNameForIndex(sheetIndex)
	if err := file.SetSheetName(defaultSheet, sheetName); err != nil {
		return nil, "", total, err
	}
	writer, err := newLogSheetWriter(file, sheetName, fields)
	if err != nil {
		return nil, "", total, err
	}

	var lastCreatedAt int64
	var lastID int
	written := 0
	dataRowsInSheet := 0

	for {
		select {
		case <-ctx.Done():
			return nil, "", total, ctx.Err()
		default:
		}

		logs, err := model.GetLogsForExportBatch(ctx, input.Filter, lastCreatedAt, lastID, exportBatchSize, written)
		if err != nil {
			return nil, "", total, err
		}
		if len(logs) == 0 {
			break
		}

		for _, log := range logs {
			if dataRowsInSheet >= excelMaxDataRows {
				if err := writer.Flush(); err != nil {
					return nil, "", total, err
				}
				sheetIndex++
				sheetName = usageLogSheetNameForIndex(sheetIndex)
				if _, err := file.NewSheet(sheetName); err != nil {
					return nil, "", total, err
				}
				writer, err = newLogSheetWriter(file, sheetName, fields)
				if err != nil {
					return nil, "", total, err
				}
				dataRowsInSheet = 0
			}

			row, err := exportRowValues(log, fields, loc)
			if err != nil {
				return nil, "", total, err
			}
			cell, _ := excelize.CoordinatesToCellName(1, dataRowsInSheet+excelHeaderRows+1)
			if err := writer.SetRow(cell, row); err != nil {
				return nil, "", total, err
			}
			dataRowsInSheet++
			written++
		}

		lastLog := logs[len(logs)-1]
		lastCreatedAt = lastLog.CreatedAt
		lastID = lastLog.Id
		if len(logs) < exportBatchSize {
			break
		}
	}

	if err := writer.Flush(); err != nil {
		return nil, "", total, err
	}

	filename := fmt.Sprintf("usage-logs-%s.xlsx", time.Now().Format("20060102-150405"))
	success = true
	return file, filename, total, nil
}

func usageLogSheetNameForIndex(index int) string {
	if index <= 1 {
		return usageLogSheetName
	}
	return fmt.Sprintf("%s %d", usageLogSheetName, index)
}

func newLogSheetWriter(file *excelize.File, sheetName string, fields []fieldDefinition) (*excelize.StreamWriter, error) {
	writer, err := file.NewStreamWriter(sheetName)
	if err != nil {
		return nil, err
	}
	if len(fields) > 0 {
		if err := writer.SetColWidth(1, len(fields), 16); err != nil {
			return nil, err
		}
	}
	if err := writer.SetPanes(&excelize.Panes{
		Freeze:      true,
		YSplit:      1,
		TopLeftCell: "A2",
		ActivePane:  "bottomLeft",
		Selection: []excelize.Selection{{
			Pane:       "bottomLeft",
			ActiveCell: "A2",
			SQRef:      "A2",
		}},
	}); err != nil {
		return nil, err
	}
	headers := make([]interface{}, 0, len(fields))
	for _, field := range fields {
		headers = append(headers, field.Label)
	}
	if err := writer.SetRow("A1", headers); err != nil {
		return nil, err
	}
	return writer, nil
}

func exportRowValues(log *model.Log, fields []fieldDefinition, loc *time.Location) ([]interface{}, error) {
	other := parseOther(log.Other)
	row := make([]interface{}, 0, len(fields))
	for _, field := range fields {
		value := field.Value(log, other)
		if field.Key == "created_at" && log.CreatedAt != 0 {
			value = time.Unix(log.CreatedAt, 0).In(loc).Format(createdAtTimeLayout)
		}
		row = append(row, value)
	}
	return row, nil
}

func resolveFields(keys []string, isAdmin bool) ([]fieldDefinition, error) {
	byKey := make(map[string]fieldDefinition, len(fieldDefinitions))
	allKeys := make(map[string]fieldDefinition, len(fieldDefinitions))
	for _, def := range fieldDefinitions {
		allKeys[def.Key] = def
		if def.AdminOnly && !isAdmin {
			continue
		}
		byKey[def.Key] = def
	}
	if len(keys) == 0 {
		fields := make([]fieldDefinition, 0, len(fieldDefinitions))
		for _, def := range fieldDefinitions {
			if def.Default && (!def.AdminOnly || isAdmin) {
				fields = append(fields, def)
			}
		}
		return fields, nil
	}
	fields := make([]fieldDefinition, 0, len(keys))
	seen := make(map[string]bool, len(keys))
	for _, key := range keys {
		key = strings.TrimSpace(key)
		if key == "" || seen[key] {
			continue
		}
		seen[key] = true
		def, ok := byKey[key]
		if !ok {
			if blocked, exists := allKeys[key]; exists && blocked.AdminOnly && !isAdmin {
				return nil, fmt.Errorf("field %s is not available for self export", key)
			}
			return nil, fmt.Errorf("unknown export field: %s", key)
		}
		fields = append(fields, def)
	}
	return fields, nil
}

func parseOther(raw string) map[string]interface{} {
	if strings.TrimSpace(raw) == "" {
		return map[string]interface{}{}
	}
	var other map[string]interface{}
	if err := common.UnmarshalJsonStr(raw, &other); err != nil || other == nil {
		return map[string]interface{}{}
	}
	return other
}

func numberValue(value interface{}) interface{} {
	switch v := value.(type) {
	case nil:
		return 0
	case int:
		return v
	case int64:
		return v
	case float64:
		if v == float64(int64(v)) {
			return int64(v)
		}
		return v
	case float32:
		return float64(v)
	case string:
		if strings.TrimSpace(v) == "" {
			return 0
		}
		if i, err := strconv.ParseInt(v, 10, 64); err == nil {
			return i
		}
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			return f
		}
		return v
	default:
		return v
	}
}

func stringValue(value interface{}) string {
	if value == nil {
		return ""
	}
	switch v := value.(type) {
	case string:
		return v
	case fmt.Stringer:
		return v.String()
	default:
		return fmt.Sprint(v)
	}
}

func sanitizedOtherJSON(other map[string]interface{}) string {
	if len(other) == 0 {
		return ""
	}
	clone := cloneMap(other)
	redactOtherMap(clone)
	payload, err := common.Marshal(clone)
	if err != nil {
		return ""
	}
	text := string(payload)
	if len([]rune(text)) <= maxOtherJSONRunes {
		return text
	}
	runes := []rune(text)
	return string(runes[:maxOtherJSONRunes]) + "…"
}

func cloneMap(in map[string]interface{}) map[string]interface{} {
	out := make(map[string]interface{}, len(in))
	for k, v := range in {
		if child, ok := v.(map[string]interface{}); ok {
			out[k] = cloneMap(child)
			continue
		}
		if child, ok := v.(map[interface{}]interface{}); ok {
			mapped := make(map[string]interface{}, len(child))
			for ck, cv := range child {
				mapped[fmt.Sprint(ck)] = cv
			}
			out[k] = cloneMap(mapped)
			continue
		}
		if arr, ok := v.([]interface{}); ok {
			out[k] = cloneSlice(arr)
			continue
		}
		out[k] = v
	}
	return out
}

func cloneSlice(in []interface{}) []interface{} {
	out := make([]interface{}, len(in))
	for i, v := range in {
		if child, ok := v.(map[string]interface{}); ok {
			out[i] = cloneMap(child)
			continue
		}
		if arr, ok := v.([]interface{}); ok {
			out[i] = cloneSlice(arr)
			continue
		}
		out[i] = v
	}
	return out
}

func redactOtherMap(values map[string]interface{}) {
	for key := range values {
		if shouldRedactOtherKey(key) {
			values[key] = "[redacted]"
		}
	}
	for _, value := range values {
		switch child := value.(type) {
		case map[string]interface{}:
			redactOtherMap(child)
		case []interface{}:
			for _, item := range child {
				if itemMap, ok := item.(map[string]interface{}); ok {
					redactOtherMap(itemMap)
				}
			}
		}
	}
}

func shouldRedactOtherKey(key string) bool {
	normalized := strings.ToLower(strings.ReplaceAll(strings.ReplaceAll(key, "-", "_"), " ", "_"))
	if normalized == "token" || normalized == "key" || normalized == "secret" || normalized == "password" {
		return true
	}
	redactParts := []string{
		"api_key",
		"apikey",
		"access_token",
		"refresh_token",
		"authorization",
		"auth_header",
		"bearer",
		"secret",
		"password",
		"key_key",
		"key_path",
	}
	for _, part := range redactParts {
		if strings.Contains(normalized, part) {
			return true
		}
	}
	return false
}

func exportLocation(timezone string) *time.Location {
	if strings.TrimSpace(timezone) != "" {
		if loc, err := time.LoadLocation(timezone); err == nil {
			return loc
		}
	}
	return time.Local
}

func logTypeLabel(logType int) string {
	switch logType {
	case model.LogTypeTopup:
		return "Top-up"
	case model.LogTypeConsume:
		return "Consume"
	case model.LogTypeManage:
		return "Manage"
	case model.LogTypeSystem:
		return "System"
	case model.LogTypeError:
		return "Error"
	case model.LogTypeRefund:
		return "Refund"
	default:
		return "Unknown"
	}
}
