package main

import (
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	codexchannel "github.com/QuantumNous/new-api/relay/channel/codex"
	"github.com/joho/godotenv"
)

type exportFile struct {
	ExportedAt string          `json:"exported_at"`
	Proxies    []exportProxy   `json:"proxies"`
	Accounts   []exportAccount `json:"accounts"`
}

type exportProxy struct {
	ProxyKey string `json:"proxy_key"`
	Protocol string `json:"protocol"`
	Host     string `json:"host"`
	Port     int    `json:"port"`
}

type exportAccount struct {
	Name       string            `json:"name"`
	Platform   string            `json:"platform"`
	Type       string            `json:"type"`
	Creds      exportCredentials `json:"credentials"`
	ProxyKey   string            `json:"proxy_key"`
	Priority   int64             `json:"priority"`
	Extra      map[string]any    `json:"extra"`
	AutoPause  bool              `json:"auto_pause_on_expired"`
	RateFactor float64           `json:"rate_multiplier"`
}

type exportCredentials struct {
	AccessToken      string `json:"access_token"`
	RefreshToken     string `json:"refresh_token"`
	IDToken          string `json:"id_token"`
	AccountID        string `json:"chatgpt_account_id"`
	OrganizationID   string `json:"organization_id"`
	PlanType         string `json:"plan_type"`
	Email            string `json:"email"`
	ExpiresAtRaw     any    `json:"expires_at"`
	SubscriptionEnds any    `json:"subscription_expires_at"`
}

type convertedKey struct {
	IDToken      string `json:"id_token,omitempty"`
	AccessToken  string `json:"access_token,omitempty"`
	RefreshToken string `json:"refresh_token,omitempty"`
	AccountID    string `json:"account_id,omitempty"`
	LastRefresh  string `json:"last_refresh,omitempty"`
	Email        string `json:"email,omitempty"`
	Type         string `json:"type,omitempty"`
	Expired      string `json:"expired,omitempty"`
}

type summaryItem struct {
	Name   string `json:"name"`
	Email  string `json:"email,omitempty"`
	Plan   string `json:"plan,omitempty"`
	Proxy  string `json:"proxy,omitempty"`
	Status string `json:"status"`
}

var invalidTagChars = regexp.MustCompile(`[^a-zA-Z0-9._-]+`)

func main() {
	var inputPath string
	var tag string
	var group string
	var outputDir string
	var dryRun bool

	flag.StringVar(&inputPath, "input", "", "Path to sub2api export JSON")
	flag.StringVar(&tag, "tag", "", "Tag to apply to imported channels")
	flag.StringVar(&group, "group", "default", "Channel group")
	flag.StringVar(&outputDir, "output-dir", ".runtime", "Directory to write converted files")
	flag.BoolVar(&dryRun, "dry-run", false, "Only convert and preview; do not create channels")
	flag.Parse()

	if strings.TrimSpace(inputPath) == "" {
		fail("missing --input")
	}

	if err := godotenv.Load(".env"); err != nil && !errors.Is(err, os.ErrNotExist) {
		fail("failed to load .env: %v", err)
	}
	if sqlitePath := strings.TrimSpace(os.Getenv("SQLITE_PATH")); sqlitePath != "" {
		common.SQLitePath = sqlitePath
	}

	raw, err := os.ReadFile(inputPath)
	if err != nil {
		fail("failed to read input: %v", err)
	}

	var data exportFile
	if err := json.Unmarshal(raw, &data); err != nil {
		fail("failed to parse input JSON: %v", err)
	}

	if tag == "" {
		tag = deriveTag(inputPath, data.ExportedAt)
	}

	if err := os.MkdirAll(outputDir, 0o755); err != nil {
		fail("failed to create output directory: %v", err)
	}

	proxyMap := make(map[string]string, len(data.Proxies))
	for _, p := range data.Proxies {
		proxyURL := buildProxyURL(p)
		if proxyURL != "" {
			proxyMap[p.ProxyKey] = proxyURL
		}
	}

	modelList := strings.Join(codexchannel.ModelList, ",")
	channels := make([]model.Channel, 0, len(data.Accounts))
	keysJSONL := make([]string, 0, len(data.Accounts))
	summaries := make([]summaryItem, 0, len(data.Accounts))

	nowUnix := time.Now().Unix()
	lastRefresh := time.Now().Format(time.RFC3339)
	statusEnabled := 1
	autoBan := 1
	weight := uint(0)

	for _, account := range data.Accounts {
		if !strings.EqualFold(strings.TrimSpace(account.Platform), "openai") {
			continue
		}
		if !strings.EqualFold(strings.TrimSpace(account.Type), "oauth") {
			continue
		}

		key, err := buildConvertedKey(account, lastRefresh)
		if err != nil {
			summaries = append(summaries, summaryItem{
				Name:   account.Name,
				Email:  strings.TrimSpace(account.Creds.Email),
				Plan:   strings.TrimSpace(account.Creds.PlanType),
				Proxy:  proxyMap[account.ProxyKey],
				Status: "skipped: " + err.Error(),
			})
			continue
		}

		keyBytes, err := json.Marshal(key)
		if err != nil {
			summaries = append(summaries, summaryItem{
				Name:   account.Name,
				Email:  strings.TrimSpace(account.Creds.Email),
				Plan:   strings.TrimSpace(account.Creds.PlanType),
				Proxy:  proxyMap[account.ProxyKey],
				Status: "skipped: failed to encode key",
			})
			continue
		}

		channelName := buildChannelName(account)
		remark := buildRemark(inputPath, data.ExportedAt, account, proxyMap[account.ProxyKey])

		ch := model.Channel{
			Type:          constant.ChannelTypeCodex,
			Key:           string(keyBytes),
			Status:        statusEnabled,
			Name:          channelName,
			Weight:        &weight,
			CreatedTime:   nowUnix,
			Models:        modelList,
			Group:         group,
			Priority:      &account.Priority,
			AutoBan:       &autoBan,
			OtherSettings: "{}",
			ChannelInfo: model.ChannelInfo{
				IsMultiKey:           false,
				MultiKeySize:         0,
				MultiKeyPollingIndex: 0,
				MultiKeyMode:         constant.MultiKeyModeRandom,
			},
		}

		if org := strings.TrimSpace(account.Creds.OrganizationID); org != "" {
			ch.OpenAIOrganization = &org
		}

		testModel := "gpt-5-codex"
		ch.TestModel = &testModel

		if proxyURL := proxyMap[account.ProxyKey]; proxyURL != "" {
			ch.SetSetting(dto.ChannelSettings{Proxy: proxyURL})
		}

		ch.SetTag(tag)
		ch.Remark = &remark
		keysJSONL = append(keysJSONL, string(keyBytes))
		channels = append(channels, ch)
		summaries = append(summaries, summaryItem{
			Name:   channelName,
			Email:  key.Email,
			Plan:   strings.TrimSpace(account.Creds.PlanType),
			Proxy:  proxyMap[account.ProxyKey],
			Status: "ready",
		})
	}

	baseName := strings.TrimSuffix(filepath.Base(inputPath), filepath.Ext(inputPath))
	keysPath := filepath.Join(outputDir, baseName+".new-api-codex-keys.jsonl")
	summaryPath := filepath.Join(outputDir, baseName+".new-api-channel-summary.json")

	if err := os.WriteFile(keysPath, []byte(strings.Join(keysJSONL, "\n")), 0o644); err != nil {
		fail("failed to write keys output: %v", err)
	}
	summaryBytes, err := json.MarshalIndent(map[string]any{
		"source_file": inputPath,
		"tag":         tag,
		"group":       group,
		"total":       len(summaries),
		"items":       summaries,
	}, "", "  ")
	if err != nil {
		fail("failed to encode summary: %v", err)
	}
	if err := os.WriteFile(summaryPath, summaryBytes, 0o644); err != nil {
		fail("failed to write summary output: %v", err)
	}

	if dryRun {
		fmt.Printf("Dry run complete.\nConverted keys: %s\nSummary: %s\nPrepared channels: %d\n", keysPath, summaryPath, len(channels))
		return
	}

	if err := model.InitDB(); err != nil {
		fail("failed to init DB: %v", err)
	}
	defer func() {
		if model.DB != nil {
			if sqlDB, err := model.DB.DB(); err == nil {
				_ = sqlDB.Close()
			}
		}
	}()

	existing, err := loadExistingCodexNamesByTag(tag)
	if err != nil {
		fail("failed to query existing channels: %v", err)
	}

	toInsert := make([]model.Channel, 0, len(channels))
	insertedNames := make([]string, 0, len(channels))
	skippedCount := 0
	for _, ch := range channels {
		if _, ok := existing[ch.Name]; ok {
			skippedCount++
			continue
		}
		if err := ch.ValidateSettings(); err != nil {
			fail("invalid channel settings for %s: %v", ch.Name, err)
		}
		toInsert = append(toInsert, ch)
		insertedNames = append(insertedNames, ch.Name)
	}

	if err := model.BatchInsertChannels(toInsert); err != nil {
		fail("failed to insert channels: %v", err)
	}

	fmt.Printf("Created %d channels, skipped %d existing channels.\nTag: %s\nConverted keys: %s\nSummary: %s\n", len(toInsert), skippedCount, tag, keysPath, summaryPath)
	if len(insertedNames) > 0 {
		fmt.Println("Inserted channel names:")
		for _, name := range insertedNames {
			fmt.Printf("- %s\n", name)
		}
	}
}

func loadExistingCodexNamesByTag(tag string) (map[string]struct{}, error) {
	var channels []model.Channel
	if err := model.DB.Where("type = ? AND tag = ?", constant.ChannelTypeCodex, tag).Find(&channels).Error; err != nil {
		return nil, err
	}
	result := make(map[string]struct{}, len(channels))
	for _, ch := range channels {
		result[ch.Name] = struct{}{}
	}
	return result, nil
}

func buildConvertedKey(account exportAccount, lastRefresh string) (convertedKey, error) {
	accountID := strings.TrimSpace(account.Creds.AccountID)
	accessToken := strings.TrimSpace(account.Creds.AccessToken)
	if accessToken == "" {
		return convertedKey{}, errors.New("missing access_token")
	}
	if accountID == "" {
		return convertedKey{}, errors.New("missing chatgpt_account_id")
	}

	return convertedKey{
		IDToken:      strings.TrimSpace(account.Creds.IDToken),
		AccessToken:  accessToken,
		RefreshToken: strings.TrimSpace(account.Creds.RefreshToken),
		AccountID:    accountID,
		LastRefresh:  lastRefresh,
		Email:        firstNonEmpty(strings.TrimSpace(account.Creds.Email), extractExtraString(account.Extra, "email")),
		Type:         "codex",
		Expired:      normalizeTimeValue(account.Creds.ExpiresAtRaw),
	}, nil
}

func buildChannelName(account exportAccount) string {
	email := strings.TrimSpace(account.Creds.Email)
	nameSource := email
	if nameSource == "" {
		nameSource = strings.TrimSpace(account.Name)
	}
	plan := strings.TrimSpace(account.Creds.PlanType)
	if plan == "" {
		plan = "unknown"
	}
	return fmt.Sprintf("codex-%s-%s", nameSource, plan)
}

func buildRemark(inputPath string, exportedAt string, account exportAccount, proxyURL string) string {
	parts := []string{
		"Imported from sub2api export",
		"source=" + filepath.Base(inputPath),
	}
	if exportedAt != "" {
		parts = append(parts, "exported_at="+exportedAt)
	}
	if account.Name != "" {
		parts = append(parts, "account_name="+account.Name)
	}
	if plan := strings.TrimSpace(account.Creds.PlanType); plan != "" {
		parts = append(parts, "plan="+plan)
	}
	if proxyURL != "" {
		parts = append(parts, "proxy="+proxyURL)
	}
	if account.AutoPause {
		parts = append(parts, "auto_pause_on_expired=true")
	}
	return strings.Join(parts, "; ")
}

func buildProxyURL(p exportProxy) string {
	protocol := strings.TrimSpace(p.Protocol)
	host := strings.TrimSpace(p.Host)
	if protocol == "" || host == "" || p.Port == 0 {
		return ""
	}
	return fmt.Sprintf("%s://%s:%d", protocol, host, p.Port)
}

func deriveTag(inputPath string, exportedAt string) string {
	base := strings.TrimSuffix(filepath.Base(inputPath), filepath.Ext(inputPath))
	if base == "" {
		base = "sub2api-import"
	}
	tag := "sub2api-" + base
	if exportedAt != "" {
		if t, err := time.Parse(time.RFC3339, exportedAt); err == nil {
			tag = fmt.Sprintf("sub2api-%s", t.Format("20060102150405"))
		}
	}
	tag = invalidTagChars.ReplaceAllString(tag, "-")
	tag = strings.Trim(tag, "-")
	if tag == "" {
		tag = "sub2api-import"
	}
	return tag
}

func normalizeTimeValue(v any) string {
	switch raw := v.(type) {
	case string:
		s := strings.TrimSpace(raw)
		if s == "" {
			return ""
		}
		if _, err := time.Parse(time.RFC3339, s); err == nil {
			return s
		}
		if _, err := time.Parse(time.RFC3339Nano, s); err == nil {
			return s
		}
		return s
	case float64:
		return time.Unix(int64(raw), 0).Format(time.RFC3339)
	case int64:
		return time.Unix(raw, 0).Format(time.RFC3339)
	case int:
		return time.Unix(int64(raw), 0).Format(time.RFC3339)
	case json.Number:
		if i, err := raw.Int64(); err == nil {
			return time.Unix(i, 0).Format(time.RFC3339)
		}
		if f, err := raw.Float64(); err == nil {
			return time.Unix(int64(f), 0).Format(time.RFC3339)
		}
		return raw.String()
	default:
		return ""
	}
}

func extractExtraString(m map[string]any, key string) string {
	if m == nil {
		return ""
	}
	if value, ok := m[key]; ok && value != nil {
		return strings.TrimSpace(fmt.Sprintf("%v", value))
	}
	return ""
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}

func fail(format string, args ...any) {
	fmt.Fprintf(os.Stderr, format+"\n", args...)
	os.Exit(1)
}
