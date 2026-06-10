# Codex Model Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an independent Codex model governance system that disables clearly unsupported Codex subscription models, alerts DingTalk, and requires manual review before removing models from Codex channel configuration.

**Architecture:** Add a Codex-specific governance table and service layer separate from the generic `model_availability` flow. Detection paths classify strict Codex unsupported errors or official Codex notices, transition records to `unsupported_pending_review`, disable affected `abilities`, and expose admin review APIs plus system settings UI.

**Tech Stack:** Go 1.22, Gin, GORM, existing `setting/config` runtime settings, existing DingTalk sender, React 19, TypeScript, React Hook Form, Zod, TanStack Query, Bun.

---

## File Structure

Backend files:

- Create `setting/operation_setting/codex_model_governance_setting.go`: runtime settings for the governance switch, regex rules, official source URLs, lifecycle terms, schedule, and cooldown.
- Modify `controller/option.go`: validate regex settings before saving through `/api/option/`.
- Create `model/codex_model_governance.go`: GORM entity and DB operations for governance records, affected channels, ability disabling/restoring, and confirmed model removal.
- Modify `model/main.go`: add `CodexModelGovernanceRecord` to AutoMigrate.
- Create `model/codex_model_governance_test.go`: persistence and ability/channel mutation coverage.
- Create `service/codex_model_governance_rules.go`: unsupported-message classifier and official-notice matcher.
- Create `service/codex_model_governance_rules_test.go`: default strict rule, custom regex, generic-error rejection, official-notice matching.
- Create `service/codex_model_governance.go`: transition orchestration and manual review actions.
- Create `service/codex_model_governance_test.go`: pending transition, restore, confirm removal, and DingTalk hook tests.
- Modify `service/dingtalk_alert.go`: add model-governance alert content and sender.
- Modify `service/dingtalk_alert_test.go`: verify alert content sanitization and cooldown keying.
- Create `controller/codex_model_governance.go`: admin list/action endpoints and regex test endpoint.
- Create `controller/codex_model_governance_task.go`: background lightweight probe and official notice monitor entrypoints.
- Create `controller/codex_model_governance_test.go`: API handler and task helper tests.
- Modify `router/api-router.go`: mount `/api/codex_model_governance` admin routes.
- Modify `main.go`: start the background governance task on master node.

Frontend files:

- Create `web/default/src/features/codex-model-governance/types.ts`: record/status/action types.
- Create `web/default/src/features/codex-model-governance/api.ts`: admin API client functions.
- Create `web/default/src/features/codex-model-governance/index.tsx`: governance review page.
- Create `web/default/src/routes/_authenticated/codex-model-governance.tsx`: route entry.
- Modify `web/default/src/features/system-settings/integrations/monitoring-settings-section.tsx`: add settings fields and regex test UI.
- Modify `web/default/src/features/system-settings/operations/section-registry.tsx`: pass new settings defaults.
- Modify `web/default/src/i18n/locales/en.json` and `web/default/src/i18n/locales/zh.json`: add visible strings used by the new settings and page.

Validation files:

- Modify or add focused tests only. Do not run or edit unrelated failing suites unless this feature needs it.

---

### Task 1: Add Codex Governance Settings

**Files:**
- Create: `setting/operation_setting/codex_model_governance_setting.go`
- Modify: `controller/option.go`
- Test: `setting/operation_setting/codex_model_governance_setting_test.go`

- [ ] **Step 1: Write the failing settings tests**

Create `setting/operation_setting/codex_model_governance_setting_test.go`:

```go
package operation_setting

import (
	"regexp"
	"testing"
)

func TestDefaultCodexModelGovernanceSetting(t *testing.T) {
	setting := GetCodexModelGovernanceSetting()
	if setting.Enabled {
		t.Fatal("expected Codex model governance to be disabled by default")
	}
	if len(setting.UnsupportedMessagePatterns) != 1 {
		t.Fatalf("default unsupported patterns = %d, want 1", len(setting.UnsupportedMessagePatterns))
	}
	if _, err := regexp.Compile(setting.UnsupportedMessagePatterns[0]); err != nil {
		t.Fatalf("default unsupported regex does not compile: %v", err)
	}
	if setting.AlertCooldownMinutes != 60 {
		t.Fatalf("alert cooldown = %v, want 60", setting.AlertCooldownMinutes)
	}
}

func TestValidateCodexModelGovernancePatterns(t *testing.T) {
	err := ValidateCodexModelGovernancePatterns([]string{
		`The '([^']+)' model is not supported when using Codex with a ChatGPT account\.`,
	})
	if err != nil {
		t.Fatalf("expected valid pattern, got %v", err)
	}

	err = ValidateCodexModelGovernancePatterns([]string{`(`})
	if err == nil {
		t.Fatal("expected invalid regex error")
	}
}
```

- [ ] **Step 2: Run the settings test and verify it fails**

Run:

```powershell
go test ./setting/operation_setting/... -run CodexModelGovernance -count=1
```

Expected: FAIL because `GetCodexModelGovernanceSetting` and `ValidateCodexModelGovernancePatterns` do not exist.

- [ ] **Step 3: Implement settings**

Create `setting/operation_setting/codex_model_governance_setting.go`:

```go
package operation_setting

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/QuantumNous/new-api/setting/config"
)

const DefaultCodexUnsupportedPattern = `The '([^']+)' model is not supported when using Codex with a ChatGPT account\.`

type CodexModelGovernanceSetting struct {
	Enabled                    bool     `json:"enabled"`
	ProbeEnabled               bool     `json:"probe_enabled"`
	ProbeIntervalMinutes       int      `json:"probe_interval_minutes"`
	UnsupportedMessagePatterns []string `json:"unsupported_message_patterns"`
	OfficialSourceURLs         []string `json:"official_source_urls"`
	OfficialLifecycleTerms     []string `json:"official_lifecycle_terms"`
	AlertCooldownMinutes       int      `json:"alert_cooldown_minutes"`
}

var codexModelGovernanceSetting = CodexModelGovernanceSetting{
	Enabled:              false,
	ProbeEnabled:         false,
	ProbeIntervalMinutes: 1440,
	UnsupportedMessagePatterns: []string{
		DefaultCodexUnsupportedPattern,
	},
	OfficialSourceURLs: []string{},
	OfficialLifecycleTerms: []string{
		"deprecated",
		"retired",
		"sunset",
		"unavailable",
		"not supported",
	},
	AlertCooldownMinutes: 60,
}

func init() {
	config.GlobalConfig.Register("codex_model_governance_setting", &codexModelGovernanceSetting)
}

func GetCodexModelGovernanceSetting() *CodexModelGovernanceSetting {
	return &codexModelGovernanceSetting
}

func ValidateCodexModelGovernancePatterns(patterns []string) error {
	if len(patterns) == 0 {
		return fmt.Errorf("at least one Codex unsupported model pattern is required")
	}
	for index, pattern := range patterns {
		pattern = strings.TrimSpace(pattern)
		if pattern == "" {
			return fmt.Errorf("pattern #%d is empty", index+1)
		}
		if _, err := regexp.Compile(pattern); err != nil {
			return fmt.Errorf("pattern #%d is invalid: %w", index+1, err)
		}
	}
	return nil
}
```

- [ ] **Step 4: Validate settings values in option updates**

Modify `controller/option.go` by adding imports:

```go
	"reflect"
```

Then add a helper near existing option validation helpers:

```go
func parseStringSliceOptionValue(value string) ([]string, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return []string{}, nil
	}
	var values []string
	if strings.HasPrefix(value, "[") {
		if err := common.UnmarshalJsonStr(value, &values); err != nil {
			return nil, err
		}
		return values, nil
	}
	return strings.Split(strings.ReplaceAll(value, "\r\n", "\n"), "\n"), nil
}

func normalizeCodexPatternsOptionValue(value string) (string, error) {
	patterns, err := parseStringSliceOptionValue(value)
	if err != nil {
		return "", err
	}
	if err := operation_setting.ValidateCodexModelGovernancePatterns(patterns); err != nil {
		return "", err
	}
	normalized := make([]string, 0, len(patterns))
	for _, pattern := range patterns {
		pattern = strings.TrimSpace(pattern)
		if pattern != "" {
			normalized = append(normalized, pattern)
		}
	}
	if reflect.DeepEqual(normalized, patterns) {
		return value, nil
	}
	bytes, err := common.Marshal(normalized)
	if err != nil {
		return "", err
	}
	return string(bytes), nil
}
```

In `UpdateOption`, add a switch case before `model.UpdateOption`:

```go
	case "codex_model_governance_setting.unsupported_message_patterns":
		normalized, validateErr := normalizeCodexPatternsOptionValue(option.Value.(string))
		if validateErr != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": validateErr.Error(),
			})
			return
		}
		option.Value = normalized
```

- [ ] **Step 5: Run settings tests**

Run:

```powershell
go test ./setting/operation_setting/... -run CodexModelGovernance -count=1
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add setting\operation_setting\codex_model_governance_setting.go setting\operation_setting\codex_model_governance_setting_test.go controller\option.go
git commit -m "Add Codex model governance settings"
```

---

### Task 2: Add Governance Persistence And Ability Mutations

**Files:**
- Create: `model/codex_model_governance.go`
- Modify: `model/main.go`
- Test: `model/codex_model_governance_test.go`

- [ ] **Step 1: Write failing model tests**

Create `model/codex_model_governance_test.go`:

```go
package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupCodexGovernanceTestDB(t *testing.T) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	DB = db
	common.UsingSQLite = true
	require.NoError(t, db.AutoMigrate(&Channel{}, &Ability{}, &CodexModelGovernanceRecord{}))
}

func seedCodexGovernanceChannel(t *testing.T, id int, models string) {
	t.Helper()
	channel := &Channel{
		Id:     id,
		Type:   constant.ChannelTypeCodex,
		Status: common.ChannelStatusEnabled,
		Name:   "codex",
		Models: models,
		Group:  "default",
		Key:    `{"access_token":"token","account_id":"acct"}`,
	}
	require.NoError(t, DB.Create(channel).Error)
	require.NoError(t, channel.AddAbilities(nil))
}

func TestUpsertCodexGovernanceRecordAndDisableAbilities(t *testing.T) {
	setupCodexGovernanceTestDB(t)
	seedCodexGovernanceChannel(t, 11, "gpt-5.3-codex,gpt-5.5-codex")

	record, err := UpsertCodexModelGovernancePending(CodexModelGovernancePendingInput{
		ModelName:          "gpt-5.3-codex",
		Source:             CodexModelGovernanceSourceProbe,
		MatchedRule:        "default",
		LastError:          "The 'gpt-5.3-codex' model is not supported when using Codex with a ChatGPT account.",
		AffectedChannelIDs: []int{11},
	})
	require.NoError(t, err)
	require.Equal(t, CodexModelGovernanceStatusPendingReview, record.Status)

	require.NoError(t, DisableCodexModelAbilities("gpt-5.3-codex", []int{11}))
	var enabled bool
	require.NoError(t, DB.Model(&Ability{}).
		Select("enabled").
		Where("channel_id = ? AND model = ?", 11, "gpt-5.3-codex").
		Scan(&enabled).Error)
	require.False(t, enabled)
}

func TestConfirmCodexModelRemovalUpdatesChannelModels(t *testing.T) {
	setupCodexGovernanceTestDB(t)
	seedCodexGovernanceChannel(t, 12, "gpt-5.3-codex,gpt-5.5-codex")

	err := RemoveCodexModelFromChannels("gpt-5.3-codex", []int{12})
	require.NoError(t, err)

	channel, err := GetChannelById(12, true)
	require.NoError(t, err)
	require.Equal(t, "gpt-5.5-codex", channel.Models)

	var count int64
	require.NoError(t, DB.Model(&Ability{}).
		Where("channel_id = ? AND model = ?", 12, "gpt-5.3-codex").
		Count(&count).Error)
	require.Zero(t, count)
}
```

- [ ] **Step 2: Run model tests and verify failure**

Run:

```powershell
go test ./model/... -run CodexGovernance -count=1
```

Expected: FAIL because model types/functions do not exist.

- [ ] **Step 3: Implement model entity and operations**

Create `model/codex_model_governance.go`:

```go
package model

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/samber/lo"
	"gorm.io/gorm"
)

const (
	CodexModelGovernanceStatusActive        = "active"
	CodexModelGovernanceStatusPendingReview = "unsupported_pending_review"
	CodexModelGovernanceStatusRemoved       = "removed"
	CodexModelGovernanceStatusIgnored       = "ignored"

	CodexModelGovernanceSourceProbe          = "probe"
	CodexModelGovernanceSourceOfficialNotice = "official_codex_notice"
	CodexModelGovernanceSourceManual         = "manual"
)

type CodexModelGovernanceRecord struct {
	ID                 int    `json:"id" gorm:"primaryKey"`
	ModelName          string `json:"model_name" gorm:"type:varchar(255);index"`
	Status             string `json:"status" gorm:"type:varchar(64);index"`
	Source             string `json:"source" gorm:"type:varchar(64);index"`
	MatchedRule        string `json:"matched_rule" gorm:"type:text"`
	LastError          string `json:"last_error" gorm:"type:text"`
	AffectedChannelIDs string `json:"affected_channel_ids" gorm:"type:text"`
	DetectedAt         int64  `json:"detected_at" gorm:"bigint;index"`
	LastCheckedAt      int64  `json:"last_checked_at" gorm:"bigint;index"`
	ReviewedAt         int64  `json:"reviewed_at" gorm:"bigint;index"`
	ReviewedBy         int    `json:"reviewed_by" gorm:"index"`
	ReviewNote         string `json:"review_note" gorm:"type:text"`
	CreatedTime        int64  `json:"created_time" gorm:"bigint"`
	UpdatedTime        int64  `json:"updated_time" gorm:"bigint"`
}

type CodexModelGovernancePendingInput struct {
	ModelName          string
	Source             string
	MatchedRule        string
	LastError          string
	AffectedChannelIDs []int
}

func encodeCodexGovernanceChannelIDs(ids []int) string {
	ids = lo.Uniq(ids)
	values := make([]string, 0, len(ids))
	for _, id := range ids {
		if id > 0 {
			values = append(values, common.Int2String(id))
		}
	}
	return strings.Join(values, ",")
}

func DecodeCodexGovernanceChannelIDs(raw string) []int {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return []int{}
	}
	parts := strings.Split(raw, ",")
	ids := make([]int, 0, len(parts))
	for _, part := range parts {
		id := common.String2Int(strings.TrimSpace(part))
		if id > 0 {
			ids = append(ids, id)
		}
	}
	return lo.Uniq(ids)
}

func UpsertCodexModelGovernancePending(input CodexModelGovernancePendingInput) (*CodexModelGovernanceRecord, error) {
	now := common.GetTimestamp()
	modelName := strings.TrimSpace(input.ModelName)
	if modelName == "" {
		return nil, nil
	}
	var existing CodexModelGovernanceRecord
	err := DB.Where("model_name = ? AND status <> ?", modelName, CodexModelGovernanceStatusRemoved).
		Order("id DESC").
		First(&existing).Error
	if err != nil && err != gorm.ErrRecordNotFound {
		return nil, err
	}
	record := existing
	if err == gorm.ErrRecordNotFound {
		record = CodexModelGovernanceRecord{
			ModelName:   modelName,
			DetectedAt:  now,
			CreatedTime: now,
		}
	}
	record.Status = CodexModelGovernanceStatusPendingReview
	record.Source = strings.TrimSpace(input.Source)
	record.MatchedRule = strings.TrimSpace(input.MatchedRule)
	record.LastError = strings.TrimSpace(input.LastError)
	record.AffectedChannelIDs = encodeCodexGovernanceChannelIDs(input.AffectedChannelIDs)
	record.LastCheckedAt = now
	record.UpdatedTime = now
	if record.ID == 0 {
		return &record, DB.Create(&record).Error
	}
	return &record, DB.Save(&record).Error
}

func ListCodexModelGovernanceRecords(status string) ([]CodexModelGovernanceRecord, error) {
	var records []CodexModelGovernanceRecord
	query := DB.Model(&CodexModelGovernanceRecord{})
	if strings.TrimSpace(status) != "" {
		query = query.Where("status = ?", status)
	}
	err := query.Order("updated_time DESC").Find(&records).Error
	return records, err
}

func GetCodexModelGovernanceRecord(id int) (*CodexModelGovernanceRecord, error) {
	var record CodexModelGovernanceRecord
	if err := DB.First(&record, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &record, nil
}

func FindAffectedCodexChannelIDs(modelName string) ([]int, error) {
	var ids []int
	err := DB.Model(&Ability{}).
		Select("DISTINCT abilities.channel_id").
		Joins("JOIN channels ON abilities.channel_id = channels.id").
		Where("abilities.model = ? AND channels.type = ?", modelName, constant.ChannelTypeCodex).
		Pluck("abilities.channel_id", &ids).Error
	return ids, err
}

func DisableCodexModelAbilities(modelName string, channelIDs []int) error {
	if len(channelIDs) == 0 {
		return nil
	}
	err := DB.Model(&Ability{}).
		Where("model = ? AND channel_id IN ?", modelName, channelIDs).
		Update("enabled", false).Error
	if err == nil {
		publishChannelsChanged()
	}
	return err
}

func RestoreCodexModelAbilities(modelName string, channelIDs []int) error {
	if len(channelIDs) == 0 {
		return nil
	}
	err := DB.Model(&Ability{}).
		Where("model = ? AND channel_id IN ?", modelName, channelIDs).
		Update("enabled", true).Error
	if err == nil {
		publishChannelsChanged()
	}
	return err
}

func RemoveCodexModelFromChannels(modelName string, channelIDs []int) error {
	for _, channelID := range channelIDs {
		channel, err := GetChannelById(channelID, true)
		if err != nil {
			return err
		}
		models := make([]string, 0, len(channel.GetModels()))
		for _, current := range channel.GetModels() {
			current = strings.TrimSpace(current)
			if current != "" && current != modelName {
				models = append(models, current)
			}
		}
		channel.Models = strings.Join(models, ",")
		if err := channel.Update(); err != nil {
			return err
		}
	}
	return nil
}

func ReviewCodexModelGovernanceRecord(id int, status string, reviewerID int, note string) error {
	now := common.GetTimestamp()
	return DB.Model(&CodexModelGovernanceRecord{}).
		Where("id = ?", id).
		Updates(map[string]any{
			"status":       status,
			"reviewed_at":  now,
			"reviewed_by":  reviewerID,
			"review_note":  strings.TrimSpace(note),
			"updated_time": now,
		}).Error
}
```

- [ ] **Step 4: Register migration**

Modify `model/main.go` by adding `&CodexModelGovernanceRecord{},` next to other AutoMigrate models in both fast migration and table list sections.

- [ ] **Step 5: Run model tests**

Run:

```powershell
go test ./model/... -run CodexGovernance -count=1
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add model\codex_model_governance.go model\codex_model_governance_test.go model\main.go
git commit -m "Add Codex model governance persistence"
```

---

### Task 3: Add Rule Classification And Official Notice Matching

**Files:**
- Create: `service/codex_model_governance_rules.go`
- Test: `service/codex_model_governance_rules_test.go`

- [ ] **Step 1: Write failing classifier tests**

Create `service/codex_model_governance_rules_test.go`:

```go
package service

import "testing"

func TestClassifyCodexUnsupportedMessageStrictDefault(t *testing.T) {
	result := ClassifyCodexUnsupportedMessage(
		"The 'gpt-5.3-codex' model is not supported when using Codex with a ChatGPT account.",
		[]string{`The '([^']+)' model is not supported when using Codex with a ChatGPT account\.`},
	)
	if !result.Matched {
		t.Fatal("expected default Codex unsupported message to match")
	}
	if result.ModelName != "gpt-5.3-codex" {
		t.Fatalf("model = %q, want gpt-5.3-codex", result.ModelName)
	}
}

func TestClassifyCodexUnsupportedMessageRejectsGenericErrors(t *testing.T) {
	for _, message := range []string{
		"model_not_found",
		"unsupported model",
		"request timeout",
		"rate limit exceeded",
	} {
		result := ClassifyCodexUnsupportedMessage(message, []string{
			`The '([^']+)' model is not supported when using Codex with a ChatGPT account\.`,
		})
		if result.Matched {
			t.Fatalf("message %q unexpectedly matched", message)
		}
	}
}

func TestFindOfficialCodexNoticeMatchesExactConfiguredModel(t *testing.T) {
	match := FindOfficialCodexNoticeMatch(
		"Codex changelog: gpt-5.3-codex is now unavailable for ChatGPT plan users.",
		[]string{"gpt-5.3-codex", "gpt-5.5-codex"},
		[]string{"unavailable", "not supported"},
	)
	if !match.Matched {
		t.Fatal("expected official notice match")
	}
	if match.ModelName != "gpt-5.3-codex" {
		t.Fatalf("model = %q", match.ModelName)
	}
}
```

- [ ] **Step 2: Run classifier tests and verify failure**

Run:

```powershell
go test ./service/... -run 'CodexUnsupported|OfficialCodexNotice' -count=1
```

Expected: FAIL because functions do not exist.

- [ ] **Step 3: Implement classifier**

Create `service/codex_model_governance_rules.go`:

```go
package service

import (
	"regexp"
	"strings"
)

type CodexUnsupportedMatch struct {
	Matched     bool
	ModelName   string
	MatchedRule string
	Message     string
}

func ClassifyCodexUnsupportedMessage(message string, patterns []string) CodexUnsupportedMatch {
	message = strings.TrimSpace(message)
	if message == "" {
		return CodexUnsupportedMatch{}
	}
	for _, pattern := range patterns {
		pattern = strings.TrimSpace(pattern)
		if pattern == "" {
			continue
		}
		re, err := regexp.Compile(pattern)
		if err != nil {
			continue
		}
		matches := re.FindStringSubmatch(message)
		if len(matches) == 0 {
			continue
		}
		modelName := ""
		if len(matches) > 1 {
			modelName = strings.TrimSpace(matches[1])
		}
		return CodexUnsupportedMatch{
			Matched:     true,
			ModelName:   modelName,
			MatchedRule: pattern,
			Message:     message,
		}
	}
	return CodexUnsupportedMatch{}
}

type OfficialCodexNoticeMatch struct {
	Matched   bool
	ModelName string
	Term      string
	Excerpt   string
}

func FindOfficialCodexNoticeMatch(content string, modelNames []string, lifecycleTerms []string) OfficialCodexNoticeMatch {
	lowerContent := strings.ToLower(content)
	for _, modelName := range modelNames {
		modelName = strings.TrimSpace(modelName)
		if modelName == "" || !strings.Contains(content, modelName) {
			continue
		}
		for _, term := range lifecycleTerms {
			term = strings.TrimSpace(term)
			if term == "" {
				continue
			}
			if strings.Contains(lowerContent, strings.ToLower(term)) {
				return OfficialCodexNoticeMatch{
					Matched:   true,
					ModelName: modelName,
					Term:      term,
					Excerpt:   buildCodexNoticeExcerpt(content, modelName),
				}
			}
		}
	}
	return OfficialCodexNoticeMatch{}
}

func buildCodexNoticeExcerpt(content string, modelName string) string {
	index := strings.Index(content, modelName)
	if index < 0 {
		if len(content) > 300 {
			return content[:300]
		}
		return content
	}
	start := index - 120
	if start < 0 {
		start = 0
	}
	end := index + len(modelName) + 180
	if end > len(content) {
		end = len(content)
	}
	return strings.TrimSpace(content[start:end])
}
```

- [ ] **Step 4: Run classifier tests**

Run:

```powershell
go test ./service/... -run 'CodexUnsupported|OfficialCodexNotice' -count=1
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add service\codex_model_governance_rules.go service\codex_model_governance_rules_test.go
git commit -m "Classify Codex model governance signals"
```

---

### Task 4: Add Governance Transition Service

**Files:**
- Create: `service/codex_model_governance.go`
- Test: `service/codex_model_governance_test.go`

- [ ] **Step 1: Write failing service tests**

Create `service/codex_model_governance_test.go`:

```go
package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupCodexGovernanceServiceDB(t *testing.T) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	model.DB = db
	common.UsingSQLite = true
	require.NoError(t, db.AutoMigrate(&model.Channel{}, &model.Ability{}, &model.CodexModelGovernanceRecord{}))
	channel := &model.Channel{
		Id:     21,
		Type:   constant.ChannelTypeCodex,
		Status: common.ChannelStatusEnabled,
		Name:   "codex",
		Models: "gpt-5.3-codex,gpt-5.5-codex",
		Group:  "default",
		Key:    `{"access_token":"token","account_id":"acct"}`,
	}
	require.NoError(t, model.DB.Create(channel).Error)
	require.NoError(t, channel.AddAbilities(nil))
}

func TestMoveCodexModelToPendingReviewDisablesAbilities(t *testing.T) {
	setupCodexGovernanceServiceDB(t)
	record, err := MoveCodexModelToPendingReview(CodexModelUnsupportedFinding{
		ModelName:   "gpt-5.3-codex",
		Source:      model.CodexModelGovernanceSourceProbe,
		MatchedRule: "default",
		Message:     "unsupported",
	})
	require.NoError(t, err)
	require.NotNil(t, record)
	require.Equal(t, model.CodexModelGovernanceStatusPendingReview, record.Status)

	var enabled bool
	require.NoError(t, model.DB.Model(&model.Ability{}).
		Select("enabled").
		Where("channel_id = ? AND model = ?", 21, "gpt-5.3-codex").
		Scan(&enabled).Error)
	require.False(t, enabled)
}

func TestReviewCodexModelRestoreReEnablesAbilities(t *testing.T) {
	setupCodexGovernanceServiceDB(t)
	record, err := MoveCodexModelToPendingReview(CodexModelUnsupportedFinding{
		ModelName:   "gpt-5.3-codex",
		Source:      model.CodexModelGovernanceSourceProbe,
		MatchedRule: "default",
		Message:     "unsupported",
	})
	require.NoError(t, err)

	err = ReviewCodexModelGovernance(record.ID, 7, CodexModelGovernanceReviewActionRestore, "false alarm")
	require.NoError(t, err)

	var enabled bool
	require.NoError(t, model.DB.Model(&model.Ability{}).
		Select("enabled").
		Where("channel_id = ? AND model = ?", 21, "gpt-5.3-codex").
		Scan(&enabled).Error)
	require.True(t, enabled)
}
```

- [ ] **Step 2: Run service tests and verify failure**

Run:

```powershell
go test ./service/... -run CodexModelGovernance -count=1
```

Expected: FAIL because transition service functions do not exist.

- [ ] **Step 3: Implement transition service**

Create `service/codex_model_governance.go`:

```go
package service

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

const (
	CodexModelGovernanceReviewActionConfirmRemove = "confirm_remove"
	CodexModelGovernanceReviewActionRestore       = "restore"
	CodexModelGovernanceReviewActionIgnore        = "ignore"
)

type CodexModelUnsupportedFinding struct {
	ModelName   string
	Source      string
	MatchedRule string
	Message     string
}

func MoveCodexModelToPendingReview(finding CodexModelUnsupportedFinding) (*model.CodexModelGovernanceRecord, error) {
	modelName := strings.TrimSpace(finding.ModelName)
	if modelName == "" {
		return nil, fmt.Errorf("model name is required")
	}
	channelIDs, err := model.FindAffectedCodexChannelIDs(modelName)
	if err != nil {
		return nil, err
	}
	record, err := model.UpsertCodexModelGovernancePending(model.CodexModelGovernancePendingInput{
		ModelName:          modelName,
		Source:             finding.Source,
		MatchedRule:        finding.MatchedRule,
		LastError:          finding.Message,
		AffectedChannelIDs: channelIDs,
	})
	if err != nil {
		return nil, err
	}
	if err := model.DisableCodexModelAbilities(modelName, channelIDs); err != nil {
		common.SysError("failed to disable Codex model abilities: " + err.Error())
		return record, err
	}
	if err := NotifyDingTalkCodexModelGovernance(record); err != nil {
		common.SysError("failed to send Codex model governance DingTalk alert: " + err.Error())
	}
	return record, nil
}

func ReviewCodexModelGovernance(recordID int, reviewerID int, action string, note string) error {
	record, err := model.GetCodexModelGovernanceRecord(recordID)
	if err != nil {
		return err
	}
	channelIDs := model.DecodeCodexGovernanceChannelIDs(record.AffectedChannelIDs)
	switch action {
	case CodexModelGovernanceReviewActionConfirmRemove:
		if err := model.RemoveCodexModelFromChannels(record.ModelName, channelIDs); err != nil {
			return err
		}
		return model.ReviewCodexModelGovernanceRecord(record.ID, model.CodexModelGovernanceStatusRemoved, reviewerID, note)
	case CodexModelGovernanceReviewActionRestore:
		if err := model.RestoreCodexModelAbilities(record.ModelName, channelIDs); err != nil {
			return err
		}
		return model.ReviewCodexModelGovernanceRecord(record.ID, model.CodexModelGovernanceStatusActive, reviewerID, note)
	case CodexModelGovernanceReviewActionIgnore:
		return model.ReviewCodexModelGovernanceRecord(record.ID, model.CodexModelGovernanceStatusIgnored, reviewerID, note)
	default:
		return fmt.Errorf("unsupported Codex model governance review action: %s", action)
	}
}
```

- [ ] **Step 4: Run service tests**

Run:

```powershell
go test ./service/... -run CodexModelGovernance -count=1
```

Expected: PASS after Task 5 provides `NotifyDingTalkCodexModelGovernance`, or temporarily add a no-op stub in this task and replace it in Task 5.

- [ ] **Step 5: Commit**

```powershell
git add service\codex_model_governance.go service\codex_model_governance_test.go
git commit -m "Add Codex model governance transitions"
```

---

### Task 5: Add DingTalk Model Governance Alerts

**Files:**
- Modify: `service/dingtalk_alert.go`
- Modify: `service/dingtalk_alert_test.go`

- [ ] **Step 1: Write failing DingTalk tests**

Append to `service/dingtalk_alert_test.go`:

```go
func TestBuildDingTalkCodexModelGovernanceAlertContentSanitizesError(t *testing.T) {
	record := &model.CodexModelGovernanceRecord{
		ModelName:          "gpt-5.3-codex",
		Source:             model.CodexModelGovernanceSourceProbe,
		MatchedRule:        "default",
		LastError:          `The 'gpt-5.3-codex' model is not supported when using Codex with a ChatGPT account. access_token=secret`,
		AffectedChannelIDs: "1,2",
		UpdatedTime:        1710000000,
	}
	content := BuildDingTalkCodexModelGovernanceAlertContent(record)
	require.Contains(t, content, "Codex model moved to unsupported pending review")
	require.Contains(t, content, "gpt-5.3-codex")
	require.NotContains(t, content, "access_token=secret")
	require.Contains(t, content, "access_token=***")
}
```

- [ ] **Step 2: Run DingTalk tests and verify failure**

Run:

```powershell
go test ./service/... -run DingTalkCodexModelGovernance -count=1
```

Expected: FAIL because alert builder does not exist.

- [ ] **Step 3: Implement alert builder and sender**

Add to `service/dingtalk_alert.go`:

```go
func BuildDingTalkCodexModelGovernanceAlertContent(record *model.CodexModelGovernanceRecord) string {
	if record == nil {
		return ""
	}
	ids := model.DecodeCodexGovernanceChannelIDs(record.AffectedChannelIDs)
	return strings.Join([]string{
		"Codex model moved to unsupported pending review",
		fmt.Sprintf("Model: %s", sanitizeDingTalkAlertText(record.ModelName)),
		fmt.Sprintf("Source: %s", sanitizeDingTalkAlertText(record.Source)),
		fmt.Sprintf("Matched Rule: %s", sanitizeDingTalkAlertText(record.MatchedRule)),
		fmt.Sprintf("Affected Channels: %d (%s)", len(ids), sanitizeDingTalkAlertText(record.AffectedChannelIDs)),
		fmt.Sprintf("Reason: %s", sanitizeDingTalkAlertText(record.LastError)),
		"Next Action: review in Codex model governance",
		fmt.Sprintf("Time: %s", time.Unix(record.UpdatedTime, 0).Format("2006-01-02 15:04:05")),
	}, "\n")
}

func NotifyDingTalkCodexModelGovernance(record *model.CodexModelGovernanceRecord) error {
	setting := operation_setting.GetMonitorSetting()
	if setting == nil || !setting.DingTalkAlertEnabled {
		return nil
	}
	if strings.TrimSpace(setting.DingTalkAlertWebhookURL) == "" {
		return fmt.Errorf("dingtalk alert webhook url is empty")
	}
	content := BuildDingTalkCodexModelGovernanceAlertContent(record)
	if content == "" {
		return nil
	}
	return SendDingTalkText(setting.DingTalkAlertWebhookURL, setting.DingTalkAlertSecret, content)
}
```

- [ ] **Step 4: Run DingTalk and transition tests**

Run:

```powershell
go test ./service/... -run 'DingTalkCodexModelGovernance|CodexModelGovernance' -count=1
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add service\dingtalk_alert.go service\dingtalk_alert_test.go
git commit -m "Alert DingTalk for Codex model governance"
```

---

### Task 6: Add Admin Governance APIs

**Files:**
- Create: `controller/codex_model_governance.go`
- Modify: `router/api-router.go`
- Test: `controller/codex_model_governance_test.go`

- [ ] **Step 1: Write failing controller tests**

Create `controller/codex_model_governance_test.go`:

```go
package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestTestCodexModelGovernanceRule(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.POST("/test", TestCodexModelGovernanceRule)

	body := `{"message":"The 'gpt-5.3-codex' model is not supported when using Codex with a ChatGPT account.","patterns":["The '([^']+)' model is not supported when using Codex with a ChatGPT account\\."]}`
	req := httptest.NewRequest(http.MethodPost, "/test", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	require.Contains(t, rec.Body.String(), `"matched":true`)
	require.Contains(t, rec.Body.String(), `"model_name":"gpt-5.3-codex"`)
}

func TestBuildCodexGovernanceResponseIncludesDecodedChannels(t *testing.T) {
	response := buildCodexGovernanceRecordResponse(model.CodexModelGovernanceRecord{
		ID:                 1,
		ModelName:          "gpt-5.3-codex",
		Status:             model.CodexModelGovernanceStatusPendingReview,
		AffectedChannelIDs: "1,2",
	})
	require.Equal(t, []int{1, 2}, response.AffectedChannelIDs)
}
```

Add missing `strings` import in the test.

- [ ] **Step 2: Run controller tests and verify failure**

Run:

```powershell
go test ./controller/... -run CodexGovernance -count=1
```

Expected: FAIL because handlers do not exist.

- [ ] **Step 3: Implement controller**

Create `controller/codex_model_governance.go`:

```go
package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

type codexGovernanceRecordResponse struct {
	ID                 int    `json:"id"`
	ModelName          string `json:"model_name"`
	Status             string `json:"status"`
	Source             string `json:"source"`
	MatchedRule        string `json:"matched_rule"`
	LastError          string `json:"last_error"`
	AffectedChannelIDs []int  `json:"affected_channel_ids"`
	DetectedAt         int64  `json:"detected_at"`
	LastCheckedAt      int64  `json:"last_checked_at"`
	ReviewedAt         int64  `json:"reviewed_at"`
	ReviewedBy         int    `json:"reviewed_by"`
	ReviewNote         string `json:"review_note"`
}

func buildCodexGovernanceRecordResponse(record model.CodexModelGovernanceRecord) codexGovernanceRecordResponse {
	return codexGovernanceRecordResponse{
		ID:                 record.ID,
		ModelName:          record.ModelName,
		Status:             record.Status,
		Source:             record.Source,
		MatchedRule:        record.MatchedRule,
		LastError:          record.LastError,
		AffectedChannelIDs: model.DecodeCodexGovernanceChannelIDs(record.AffectedChannelIDs),
		DetectedAt:         record.DetectedAt,
		LastCheckedAt:      record.LastCheckedAt,
		ReviewedAt:         record.ReviewedAt,
		ReviewedBy:         record.ReviewedBy,
		ReviewNote:         record.ReviewNote,
	}
}

func ListCodexModelGovernanceRecords(c *gin.Context) {
	records, err := model.ListCodexModelGovernanceRecords(c.Query("status"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	response := make([]codexGovernanceRecordResponse, 0, len(records))
	for _, record := range records {
		response = append(response, buildCodexGovernanceRecordResponse(record))
	}
	common.ApiSuccess(c, response)
}

type codexGovernanceReviewRequest struct {
	Action string `json:"action"`
	Note   string `json:"note"`
}

func ReviewCodexModelGovernanceRecord(c *gin.Context) {
	id := common.String2Int(c.Param("id"))
	req := codexGovernanceReviewRequest{}
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := service.ReviewCodexModelGovernance(id, c.GetInt("id"), req.Action, req.Note); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"id": id})
}

type codexGovernanceRuleTestRequest struct {
	Message  string   `json:"message"`
	Patterns []string `json:"patterns"`
}

func TestCodexModelGovernanceRule(c *gin.Context) {
	req := codexGovernanceRuleTestRequest{}
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiError(c, err)
		return
	}
	result := service.ClassifyCodexUnsupportedMessage(req.Message, req.Patterns)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"matched":      result.Matched,
			"model_name":   result.ModelName,
			"matched_rule": result.MatchedRule,
		},
	})
}
```

- [ ] **Step 4: Mount routes**

Modify `router/api-router.go` inside `SetApiRouter`:

```go
		codexGovernanceRoute := apiRouter.Group("/codex_model_governance")
		codexGovernanceRoute.Use(middleware.AdminAuth())
		{
			codexGovernanceRoute.GET("/", controller.ListCodexModelGovernanceRecords)
			codexGovernanceRoute.POST("/rules/test", controller.TestCodexModelGovernanceRule)
			codexGovernanceRoute.POST("/:id/review", controller.ReviewCodexModelGovernanceRecord)
		}
```

Place this near the existing `/data/codex/limits` or `/models` admin routes.

- [ ] **Step 5: Run controller tests**

Run:

```powershell
go test ./controller/... -run CodexGovernance -count=1
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add controller\codex_model_governance.go controller\codex_model_governance_test.go router\api-router.go
git commit -m "Expose Codex model governance review APIs"
```

---

### Task 7: Add Lightweight Probe Task

**Files:**
- Create: `controller/codex_model_governance_task.go`
- Modify: `main.go`
- Test: `controller/codex_model_governance_task_test.go`

- [ ] **Step 1: Write failing task tests**

Create `controller/codex_model_governance_task_test.go`:

```go
package controller

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/setting/operation_setting"
)

func TestNextCodexGovernanceRunIntervalUsesMinimum(t *testing.T) {
	setting := &operation_setting.CodexModelGovernanceSetting{ProbeIntervalMinutes: 0}
	got := codexGovernanceProbeInterval(setting)
	if got != time.Hour {
		t.Fatalf("interval = %s, want 1h", got)
	}
}

func TestClassifyCodexGovernanceProbeErrorOnlyMatchesRules(t *testing.T) {
	result := classifyCodexGovernanceProbeError(
		"model_not_found",
		[]string{`The '([^']+)' model is not supported when using Codex with a ChatGPT account\.`},
	)
	if result.Matched {
		t.Fatal("generic model_not_found must not match")
	}
}
```

- [ ] **Step 2: Run task tests and verify failure**

Run:

```powershell
go test ./controller/... -run CodexGovernanceProbe -count=1
```

Expected: FAIL because task helpers do not exist.

- [ ] **Step 3: Implement task skeleton and probe classification**

Create `controller/codex_model_governance_task.go`:

```go
package controller

import (
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/bytedance/gopkg/util/gopool"
)

func codexGovernanceProbeInterval(setting *operation_setting.CodexModelGovernanceSetting) time.Duration {
	if setting == nil || setting.ProbeIntervalMinutes < 60 {
		return time.Hour
	}
	return time.Duration(setting.ProbeIntervalMinutes) * time.Minute
}

func classifyCodexGovernanceProbeError(message string, patterns []string) service.CodexUnsupportedMatch {
	return service.ClassifyCodexUnsupportedMessage(message, patterns)
}

func runCodexModelGovernanceProbeOnce() {
	setting := operation_setting.GetCodexModelGovernanceSetting()
	if setting == nil || !setting.Enabled || !setting.ProbeEnabled {
		return
	}
	testUserID, err := resolveChannelTestUserID(nil)
	if err != nil {
		common.SysError("Codex model governance probe cannot resolve test user: " + err.Error())
		return
	}
	channels, err := model.GetAllChannelsByType(constant.ChannelTypeCodex, true)
	if err != nil {
		common.SysError("Codex model governance probe cannot load Codex channels: " + err.Error())
		return
	}
	for _, channel := range channels {
		if channel.Status != common.ChannelStatusEnabled {
			continue
		}
		for _, modelName := range channel.GetModels() {
			modelName = strings.TrimSpace(modelName)
			if modelName == "" {
				continue
			}
			result := testChannelWithOptions(channel, testUserID, modelName, "", false, channelTestOptions{
				Prompt:     "ping",
				ExpectPong: false,
				TokenName:  "Codex model governance probe",
				LogContent: "Codex model governance probe",
				MaxTokens:  8,
				SkipLog:    true,
			})
			message := ""
			if result.localErr != nil {
				message = result.localErr.Error()
			} else if result.newAPIError != nil {
				message = result.newAPIError.Error()
			}
			match := classifyCodexGovernanceProbeError(message, setting.UnsupportedMessagePatterns)
			if match.Matched {
				if match.ModelName == "" {
					match.ModelName = modelName
				}
				_, err := service.MoveCodexModelToPendingReview(service.CodexModelUnsupportedFinding{
					ModelName:   match.ModelName,
					Source:      model.CodexModelGovernanceSourceProbe,
					MatchedRule: match.MatchedRule,
					Message:     message,
				})
				if err != nil {
					common.SysError(fmt.Sprintf("Codex model governance probe failed to mark %s pending: %v", match.ModelName, err))
				}
			}
		}
	}
}

func StartCodexModelGovernanceTask() {
	if !common.IsMasterNode {
		return
	}
	gopool.Go(func() {
		for {
			setting := operation_setting.GetCodexModelGovernanceSetting()
			interval := codexGovernanceProbeInterval(setting)
			if setting != nil && setting.Enabled && setting.ProbeEnabled {
				runCodexModelGovernanceProbeOnce()
			}
			time.Sleep(interval)
		}
	})
}
```

Add missing `strings` import in this file.

- [ ] **Step 4: Start task in main**

Modify `main.go` after `controller.StartModelAvailabilityDetectionTask()`:

```go
	controller.StartCodexModelGovernanceTask()
```

- [ ] **Step 5: Run task tests**

Run:

```powershell
go test ./controller/... -run CodexGovernanceProbe -count=1
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add controller\codex_model_governance_task.go controller\codex_model_governance_task_test.go main.go
git commit -m "Probe Codex models for governance signals"
```

---

### Task 8: Add Official Codex Source Monitor

**Files:**
- Create: `service/codex_model_governance_notice.go`
- Modify: `controller/codex_model_governance_task.go`
- Test: `service/codex_model_governance_notice_test.go`

- [ ] **Step 1: Write failing official monitor tests**

Create `service/codex_model_governance_notice_test.go`:

```go
package service

import "testing"

func TestExtractCodexNoticeSourceMatchesConfiguredModelsOnly(t *testing.T) {
	matches := ExtractCodexOfficialNoticeFindings(
		"gpt-5.3-codex is unavailable. gpt-4.1 is deprecated.",
		[]string{"gpt-5.3-codex"},
		[]string{"unavailable", "deprecated"},
	)
	if len(matches) != 1 {
		t.Fatalf("matches = %d, want 1", len(matches))
	}
	if matches[0].ModelName != "gpt-5.3-codex" {
		t.Fatalf("model = %s", matches[0].ModelName)
	}
}
```

- [ ] **Step 2: Run official monitor tests and verify failure**

Run:

```powershell
go test ./service/... -run CodexOfficialNotice -count=1
```

Expected: FAIL because extractor does not exist.

- [ ] **Step 3: Implement official notice extractor**

Create `service/codex_model_governance_notice.go`:

```go
package service

func ExtractCodexOfficialNoticeFindings(content string, modelNames []string, terms []string) []CodexModelUnsupportedFinding {
	findings := make([]CodexModelUnsupportedFinding, 0)
	seen := map[string]struct{}{}
	for _, modelName := range modelNames {
		match := FindOfficialCodexNoticeMatch(content, []string{modelName}, terms)
		if !match.Matched {
			continue
		}
		if _, ok := seen[match.ModelName]; ok {
			continue
		}
		seen[match.ModelName] = struct{}{}
		findings = append(findings, CodexModelUnsupportedFinding{
			ModelName:   match.ModelName,
			Source:      model.CodexModelGovernanceSourceOfficialNotice,
			MatchedRule: match.Term,
			Message:     match.Excerpt,
		})
	}
	return findings
}
```

- [ ] **Step 4: Add official source fetcher**

Extend `service/codex_model_governance_notice.go` imports:

```go
import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"
)
```

Add the fetch helper below `ExtractCodexOfficialNoticeFindings`:

```go
const (
	codexOfficialSourceTimeout      = 10 * time.Second
	codexOfficialSourceMaxBodyBytes = int64(2 * 1024 * 1024)
)

func FetchCodexOfficialSource(sourceURL string) (string, error) {
	sourceURL = strings.TrimSpace(sourceURL)
	if sourceURL == "" {
		return "", fmt.Errorf("official Codex source URL is empty")
	}
	fetchSetting := system_setting.GetFetchSetting()
	if err := common.ValidateURLWithFetchSetting(sourceURL, fetchSetting.EnableSSRFProtection, fetchSetting.AllowPrivateIp, fetchSetting.DomainFilterMode, fetchSetting.IpFilterMode, fetchSetting.DomainList, fetchSetting.IpList, fetchSetting.AllowedPorts, fetchSetting.ApplyIPFilterForDomain); err != nil {
		return "", fmt.Errorf("request reject: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), codexOfficialSourceTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, sourceURL, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", "NewAPI-Codex-Model-Governance/1.0")

	client := GetHttpClient()
	if client == nil {
		client = http.DefaultClient
	}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("official Codex source returned status code %d", resp.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, codexOfficialSourceMaxBodyBytes+1))
	if err != nil {
		return "", err
	}
	if int64(len(body)) > codexOfficialSourceMaxBodyBytes {
		return "", fmt.Errorf("official Codex source response exceeds %d bytes", codexOfficialSourceMaxBodyBytes)
	}
	return string(bytes.TrimSpace(body)), nil
}
```

- [ ] **Step 5: Wire monitor into task**

In `controller/codex_model_governance_task.go`, add these helpers:

```go
func collectConfiguredCodexModelNames() ([]string, error) {
	channels, err := model.GetAllChannelsByType(constant.ChannelTypeCodex, true)
	if err != nil {
		return nil, err
	}
	seen := map[string]struct{}{}
	modelNames := make([]string, 0)
	for _, channel := range channels {
		for _, modelName := range channel.GetModels() {
			modelName = strings.TrimSpace(modelName)
			if modelName == "" {
				continue
			}
			if _, ok := seen[modelName]; ok {
				continue
			}
			seen[modelName] = struct{}{}
			modelNames = append(modelNames, modelName)
		}
	}
	return modelNames, nil
}

func runCodexOfficialNoticeMonitorOnce() {
	setting := operation_setting.GetCodexModelGovernanceSetting()
	if setting == nil || !setting.Enabled || len(setting.OfficialSourceURLs) == 0 {
		return
	}
	modelNames, err := collectConfiguredCodexModelNames()
	if err != nil {
		common.SysError("Codex official notice monitor cannot load Codex channel models: " + err.Error())
		return
	}
	if len(modelNames) == 0 {
		return
	}
	for _, sourceURL := range setting.OfficialSourceURLs {
		body, err := service.FetchCodexOfficialSource(sourceURL)
		if err != nil {
			common.SysError("Codex official notice monitor cannot fetch source: " + err.Error())
			continue
		}
		findings := service.ExtractCodexOfficialNoticeFindings(body, modelNames, setting.OfficialLifecycleTerms)
		for _, finding := range findings {
			_, err := service.MoveCodexModelToPendingReview(finding)
			if err != nil {
				common.SysError(fmt.Sprintf("Codex official notice monitor failed to mark %s pending: %v", finding.ModelName, err))
			}
		}
	}
}
```

Call it after `runCodexModelGovernanceProbeOnce()` inside the task loop.

- [ ] **Step 6: Run official monitor tests**

Run:

```powershell
go test ./service/... -run CodexOfficialNotice -count=1
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add service\codex_model_governance_notice.go service\codex_model_governance_notice_test.go controller\codex_model_governance_task.go
git commit -m "Monitor official Codex model notices"
```

---

### Task 9: Add Settings UI For Rules And Sources

**Files:**
- Modify: `web/default/src/features/system-settings/integrations/monitoring-settings-section.tsx`
- Modify: `web/default/src/features/system-settings/operations/section-registry.tsx`
- Modify: `web/default/src/features/system-settings/api.ts`
- Modify: `web/default/src/features/system-settings/types.ts`
- Modify: `web/default/src/i18n/locales/en.json`
- Modify: `web/default/src/i18n/locales/zh.json`

- [ ] **Step 1: Add frontend API helper**

In `web/default/src/features/system-settings/api.ts`, add:

```ts
export async function testCodexModelGovernanceRule(request: {
  message: string
  patterns: string[]
}): Promise<{
  matched: boolean
  model_name: string
  matched_rule: string
}> {
  const res = await api.post('/api/codex_model_governance/rules/test', request)
  return res.data.data
}
```

- [ ] **Step 2: Extend monitoring settings props and schema**

In `monitoring-settings-section.tsx`, add fields under `monitor_setting`:

```ts
codex_model_governance_setting: z.object({
  enabled: z.boolean(),
  probe_enabled: z.boolean(),
  probe_interval_minutes: z.coerce.number().int().min(60),
  unsupported_message_patterns: z.string(),
  official_source_urls: z.string(),
  official_lifecycle_terms: z.string(),
  alert_cooldown_minutes: z.coerce.number().int().min(1),
}),
```

Use textarea newline values in the form and serialize them as JSON arrays for option keys:

```ts
function linesToJsonArray(value: string) {
  return JSON.stringify(
    normalizeLineEndings(value)
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
  )
}
```

- [ ] **Step 3: Add regex test UI**

Add local state:

```ts
const [codexRuleTestMessage, setCodexRuleTestMessage] = useState('')
const [codexRuleTestResult, setCodexRuleTestResult] = useState<{
  matched: boolean
  model_name: string
  matched_rule: string
} | null>(null)
```

Add a button that calls `testCodexModelGovernanceRule` with the current patterns. Show `matched`, extracted model, and matched rule in a small text block.

- [ ] **Step 4: Pass defaults from section registry**

Modify `web/default/src/features/system-settings/operations/section-registry.tsx` to pass:

```tsx
'codex_model_governance_setting.enabled': getBooleanOption(options, 'codex_model_governance_setting.enabled', false),
'codex_model_governance_setting.probe_enabled': getBooleanOption(options, 'codex_model_governance_setting.probe_enabled', false),
'codex_model_governance_setting.probe_interval_minutes': getNumberOption(options, 'codex_model_governance_setting.probe_interval_minutes', 1440),
'codex_model_governance_setting.unsupported_message_patterns': getStringArrayOption(options, 'codex_model_governance_setting.unsupported_message_patterns').join('\n'),
'codex_model_governance_setting.official_source_urls': getStringArrayOption(options, 'codex_model_governance_setting.official_source_urls').join('\n'),
'codex_model_governance_setting.official_lifecycle_terms': getStringArrayOption(options, 'codex_model_governance_setting.official_lifecycle_terms').join('\n'),
'codex_model_governance_setting.alert_cooldown_minutes': getNumberOption(options, 'codex_model_governance_setting.alert_cooldown_minutes', 60),
```

If helpers do not exist, add small local helpers in the registry file that parse option strings using `JSON.parse` and fall back to defaults.

- [ ] **Step 5: Add translations**

Add English and Chinese keys for visible labels:

```json
"Codex model governance": "Codex model governance",
"Enable Codex model governance": "Enable Codex model governance",
"Probe Codex models": "Probe Codex models",
"Codex unsupported message patterns": "Codex unsupported message patterns",
"Official Codex source URLs": "Official Codex source URLs",
"Official lifecycle terms": "Official lifecycle terms",
"Test Codex rule": "Test Codex rule",
"Extracted model": "Extracted model"
```

- [ ] **Step 6: Run frontend typecheck**

Run:

```powershell
Set-Location web\default
bun run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add web\default\src\features\system-settings web\default\src\i18n\locales\en.json web\default\src\i18n\locales\zh.json
git commit -m "Configure Codex model governance in settings"
```

---

### Task 10: Add Admin Review Page

**Files:**
- Create: `web/default/src/features/codex-model-governance/types.ts`
- Create: `web/default/src/features/codex-model-governance/api.ts`
- Create: `web/default/src/features/codex-model-governance/index.tsx`
- Create: `web/default/src/routes/_authenticated/codex-model-governance.tsx`
- Modify: `web/default/src/hooks/use-sidebar-data.ts`
- Modify: `web/default/src/hooks/use-sidebar-config.ts`
- Modify: `web/default/src/features/system-settings/maintenance/config.ts`
- Modify: `web/default/src/features/system-settings/maintenance/sidebar-modules-section.tsx`
- Modify: `web/default/src/i18n/locales/en.json`
- Modify: `web/default/src/i18n/locales/zh.json`

- [ ] **Step 1: Add frontend types**

Create `web/default/src/features/codex-model-governance/types.ts`:

```ts
export type CodexModelGovernanceStatus =
  | 'active'
  | 'unsupported_pending_review'
  | 'removed'
  | 'ignored'

export type CodexModelGovernanceRecord = {
  id: number
  model_name: string
  status: CodexModelGovernanceStatus
  source: string
  matched_rule: string
  last_error: string
  affected_channel_ids: number[]
  detected_at: number
  last_checked_at: number
  reviewed_at: number
  reviewed_by: number
  review_note: string
}

export type CodexModelGovernanceReviewAction =
  | 'confirm_remove'
  | 'restore'
  | 'ignore'
```

- [ ] **Step 2: Add frontend API**

Create `web/default/src/features/codex-model-governance/api.ts`:

```ts
import { api } from '@/lib/api'
import type {
  CodexModelGovernanceRecord,
  CodexModelGovernanceReviewAction,
} from './types'

export async function listCodexModelGovernanceRecords(status?: string) {
  const res = await api.get<{
    success: boolean
    data: CodexModelGovernanceRecord[]
  }>('/api/codex_model_governance/', {
    params: status ? { status } : undefined,
  })
  return res.data.data
}

export async function reviewCodexModelGovernanceRecord(request: {
  id: number
  action: CodexModelGovernanceReviewAction
  note: string
}) {
  const res = await api.post(`/api/codex_model_governance/${request.id}/review`, {
    action: request.action,
    note: request.note,
  })
  return res.data
}
```

- [ ] **Step 3: Add review page**

Create `web/default/src/features/codex-model-governance/index.tsx`:

```tsx
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, Check, RefreshCw, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { SectionPageLayout } from '@/components/layout'
import {
  listCodexModelGovernanceRecords,
  reviewCodexModelGovernanceRecord,
} from './api'
import type {
  CodexModelGovernanceRecord,
  CodexModelGovernanceReviewAction,
} from './types'

const codexGovernanceRecordsQueryKey = [
  'codex-model-governance',
  'records',
  'unsupported_pending_review',
] as const

function statusVariant(status: string) {
  if (status === 'unsupported_pending_review') return 'destructive' as const
  if (status === 'removed') return 'secondary' as const
  if (status === 'ignored') return 'outline' as const
  return 'default' as const
}

function formatTime(timestamp: number) {
  if (!timestamp) return '-'
  return new Date(timestamp * 1000).toLocaleString()
}

export function CodexModelGovernancePage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [notes, setNotes] = useState<Record<number, string>>({})

  const recordsQuery = useQuery({
    queryKey: codexGovernanceRecordsQueryKey,
    queryFn: () =>
      listCodexModelGovernanceRecords('unsupported_pending_review'),
  })

  const reviewMutation = useMutation({
    mutationFn: reviewCodexModelGovernanceRecord,
    onSuccess: async () => {
      toast.success(t('Review saved'))
      await queryClient.invalidateQueries({
        queryKey: codexGovernanceRecordsQueryKey,
      })
    },
  })

  const updateNote = (recordID: number, value: string) => {
    setNotes((current) => ({ ...current, [recordID]: value }))
  }

  const submitReview = (
    record: CodexModelGovernanceRecord,
    action: CodexModelGovernanceReviewAction
  ) => {
    reviewMutation.mutate({
      id: record.id,
      action,
      note: notes[record.id] ?? '',
    })
  }

  const records = recordsQuery.data ?? []

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        {t('Codex model governance')}
      </SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <Button
          variant='outline'
          size='sm'
          onClick={() => void recordsQuery.refetch()}
          disabled={recordsQuery.isFetching}
        >
          <RefreshCw />
          {t('Refresh')}
        </Button>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div className='space-y-3'>
          {recordsQuery.isLoading ? (
            <div className='text-muted-foreground text-sm'>
              {t('Loading...')}
            </div>
          ) : null}

          {!recordsQuery.isLoading && records.length === 0 ? (
            <div className='border-border bg-muted/20 rounded-lg border px-4 py-8 text-center text-sm text-muted-foreground'>
              {t('No Codex model governance findings')}
            </div>
          ) : null}

          {records.map((record) => (
            <div
              key={record.id}
              className='border-border rounded-lg border bg-background p-4'
            >
              <div className='flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between'>
                <div className='min-w-0 space-y-2'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <h2 className='text-base font-semibold break-all'>
                      {record.model_name}
                    </h2>
                    <Badge variant={statusVariant(record.status)}>
                      {t(record.status)}
                    </Badge>
                  </div>
                  <div className='grid gap-2 text-sm text-muted-foreground md:grid-cols-2'>
                    <div>
                      <span className='font-medium text-foreground'>
                        {t('Source')}:
                      </span>{' '}
                      {record.source || '-'}
                    </div>
                    <div>
                      <span className='font-medium text-foreground'>
                        {t('Matched rule')}:
                      </span>{' '}
                      {record.matched_rule || '-'}
                    </div>
                    <div>
                      <span className='font-medium text-foreground'>
                        {t('Affected channels')}:
                      </span>{' '}
                      {record.affected_channel_ids.length > 0
                        ? record.affected_channel_ids.join(', ')
                        : '-'}
                    </div>
                    <div>
                      <span className='font-medium text-foreground'>
                        {t('Detected at')}:
                      </span>{' '}
                      {formatTime(record.detected_at)}
                    </div>
                  </div>
                  {record.last_error ? (
                    <pre className='bg-muted/40 max-h-32 overflow-auto rounded-md p-2 text-xs whitespace-pre-wrap'>
                      {record.last_error}
                    </pre>
                  ) : null}
                </div>

                <div className='flex w-full flex-col gap-2 lg:w-80'>
                  <Textarea
                    value={notes[record.id] ?? ''}
                    onChange={(event) =>
                      updateNote(record.id, event.currentTarget.value)
                    }
                    placeholder={t('Review note')}
                    className='min-h-20'
                  />
                  <div className='flex flex-wrap justify-end gap-2'>
                    <Button
                      variant='destructive'
                      size='sm'
                      onClick={() => submitReview(record, 'confirm_remove')}
                      disabled={reviewMutation.isPending}
                    >
                      <Check />
                      {t('Confirm removal')}
                    </Button>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => submitReview(record, 'restore')}
                      disabled={reviewMutation.isPending}
                    >
                      <RotateCcw />
                      {t('Restore model')}
                    </Button>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => submitReview(record, 'ignore')}
                      disabled={reviewMutation.isPending}
                    >
                      <Ban />
                      {t('Ignore finding')}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
```

- [ ] **Step 4: Add route**

Create `web/default/src/routes/_authenticated/codex-model-governance.tsx`:

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { CodexModelGovernancePage } from '@/features/codex-model-governance'

export const Route = createFileRoute('/_authenticated/codex-model-governance')({
  component: CodexModelGovernancePage,
})
```

- [ ] **Step 5: Add navigation link and sidebar module switch**

Modify `web/default/src/hooks/use-sidebar-data.ts` imports:

```ts
  ShieldQuestion,
```

Add the admin item after `Models`:

```tsx
          {
            title: t('Codex model governance'),
            url: '/codex-model-governance',
            icon: ShieldQuestion,
          },
```

Modify `web/default/src/hooks/use-sidebar-config.ts`:

```ts
  admin: {
    enabled: true,
    channel: true,
    models: true,
    codex_governance: true,
    redemption: true,
    user: true,
    setting: true,
    subscription: true,
  },
```

Add the route mapping:

```ts
  '/codex-model-governance': {
    section: 'admin',
    module: 'codex_governance',
  },
```

Modify `web/default/src/features/system-settings/maintenance/config.ts` with the same `codex_governance: true` default under `SIDEBAR_MODULES_DEFAULT.admin`.

Modify `web/default/src/features/system-settings/maintenance/sidebar-modules-section.tsx` by adding module metadata under `moduleMeta.admin`:

```ts
      codex_governance: {
        title: t('Codex model governance'),
        description: t('Review Codex subscription models that were marked unsupported.'),
      },
```

- [ ] **Step 6: Add translations**

Add English and Chinese keys:

```json
"Codex model governance": "Codex model governance",
"Unsupported pending review": "Unsupported pending review",
"Confirm removal": "Confirm removal",
"Restore model": "Restore model",
"Ignore finding": "Ignore finding",
"Affected channels": "Affected channels",
"Matched rule": "Matched rule",
"Review note": "Review note"
```

- [ ] **Step 7: Run frontend typecheck**

Run:

```powershell
Set-Location web\default
bun run typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add web\default\src\features\codex-model-governance web\default\src\routes\_authenticated\codex-model-governance.tsx web\default\src\i18n\locales\en.json web\default\src\i18n\locales\zh.json
git commit -m "Review Codex model governance findings"
```

---

### Task 11: Full Verification And Cleanup

**Files:**
- Verify changed backend/frontend files.
- Update docs only if implementation differs from `docs/superpowers/specs/2026-06-10-codex-model-governance-design.md`.

- [ ] **Step 1: Run targeted backend tests**

Run:

```powershell
go test ./setting/operation_setting/... ./model/... ./service/... ./controller/... -run 'Codex|DingTalk' -count=1
```

Expected: PASS for all Codex/DingTalk targeted tests.

- [ ] **Step 2: Run broader stable backend tests**

Run:

```powershell
go test ./common ./dto ./model ./service ./setting/operation_setting
```

Expected: PASS. If unrelated existing failures appear, record the exact package and failure text in the final report and keep targeted Codex tests green.

- [ ] **Step 3: Run frontend checks**

Run:

```powershell
Set-Location web\default
bun run typecheck
```

Expected: PASS.

- [ ] **Step 4: Inspect route generation**

If TanStack route generation changes `web/default/src/routeTree.gen.ts`, include it in the commit. If the project generates routes during typecheck, verify the generated route contains `/codex-model-governance`.

- [ ] **Step 5: Review git diff**

Run:

```powershell
git diff --stat
git diff --check
git status --short
```

Expected: no whitespace errors; only files related to Codex model governance, settings, DingTalk alerting, routing, i18n, and route generation are changed.

- [ ] **Step 6: Final commit**

If Task 11 produced verification-only fixes, commit them:

```powershell
git add .
git commit -m "Verify Codex model governance flow"
```

If no files changed, do not create an empty commit.
