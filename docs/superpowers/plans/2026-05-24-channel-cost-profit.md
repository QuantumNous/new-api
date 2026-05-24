# Channel Cost Profit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build channel cost profile management, scheduled profit snapshots, profit report APIs, and cost-driven dynamic priority/weight adjustment.

**Architecture:** Add a dedicated backend module for channel cost and profit so cost data does not pollute `channels.setting`. Reuse existing `logs`, `abilities`, `channel_dynamic_overrides`, and `channel_dynamic_adjustment_logs`; start cost-driven scheduling in dry-run through the existing dynamic adjustment runner. Frontend work adds admin cost management and reporting surfaces after backend APIs are stable.

**Tech Stack:** Go, Gin, GORM, shopspring/decimal, existing aiapi114 service/model/controller/router structure, React/TypeScript frontend under `web/default`.

---

## Scope and sequencing

This plan is intentionally split into backend-first tasks. Each task can be implemented and tested independently.

The existing worktree already contains unrelated uncommitted changes. During execution, stage and commit only files touched by the current task.

## File map

Backend model and data access:

- Create: `C:\work\aiapi114\model\channel_cost.go`
- Create: `C:\work\aiapi114\model\channel_cost_test.go`
- Modify: `C:\work\aiapi114\model\main.go`

Backend cost and profit service:

- Create: `C:\work\aiapi114\service\channel_cost.go`
- Create: `C:\work\aiapi114\service\channel_cost_test.go`
- Create: `C:\work\aiapi114\service\channel_profit_report.go`
- Create: `C:\work\aiapi114\service\channel_profit_report_test.go`
- Modify: `C:\work\aiapi114\service\channel_dynamic_adjustment.go`
- Modify: `C:\work\aiapi114\service\channel_dynamic_adjustment_runner.go`
- Create: `C:\work\aiapi114\service\channel_cost_dynamic_test.go`

Backend controller and routes:

- Create: `C:\work\aiapi114\controller\channel_profit.go`
- Modify: `C:\work\aiapi114\router\api-router.go`
- Modify: `C:\work\aiapi114\main.go`

Settings:

- Create: `C:\work\aiapi114\setting\operation_setting\channel_profit_setting.go`
- Modify: `C:\work\aiapi114\model\option.go`

Frontend:

- Create: `C:\work\aiapi114\web\default\src\features\channel-profit\api.ts`
- Create: `C:\work\aiapi114\web\default\src\features\channel-profit\types.ts`
- Create: `C:\work\aiapi114\web\default\src\features\channel-profit\index.tsx`
- Create: `C:\work\aiapi114\web\default\src\features\channel-profit\components\cost-profile-dialog.tsx`
- Create: `C:\work\aiapi114\web\default\src\features\channel-profit\components\profit-summary-cards.tsx`
- Create: `C:\work\aiapi114\web\default\src\features\channel-profit\components\profit-table.tsx`
- Modify: `C:\work\aiapi114\web\default\src\features\system-settings\operations\section-registry.tsx`
- Modify: `C:\work\aiapi114\web\default\src\features\system-settings\operations\index.tsx`
- Modify: `C:\work\aiapi114\web\default\src\routeTree.gen.ts` only through the project’s normal route generation command if routing requires it.

Docs:

- Modify: `C:\work\aiapi114\docs\superpowers\specs\2026-05-24-channel-cost-profit-design.md` only if implementation reveals a necessary design correction.

---

## Task 1: Cost profile and profit snapshot models

**Files:**

- Create: `C:\work\aiapi114\model\channel_cost.go`
- Create: `C:\work\aiapi114\model\channel_cost_test.go`
- Modify: `C:\work\aiapi114\model\main.go`

- [ ] **Step 1: Write failing tests for cost profile validation and snapshot query structs**

Create `C:\work\aiapi114\model\channel_cost_test.go`:

```go
package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestChannelCostProfileValidateRejectsInvalidTimeRange(t *testing.T) {
	profile := ChannelCostProfile{
		ChannelID:     1,
		CostMode:      ChannelCostModeToken,
		Currency:      ChannelCostCurrencyUSD,
		EffectiveFrom: 200,
		EffectiveTo:   100,
		Enabled:       true,
	}

	err := profile.Validate()

	require.Error(t, err)
	require.Contains(t, err.Error(), "effective_to")
}

func TestChannelCostProfileValidateRejectsNegativeValues(t *testing.T) {
	profile := ChannelCostProfile{
		ChannelID:       1,
		CostMode:        ChannelCostModeQuotaRatio,
		Currency:        ChannelCostCurrencyUSD,
		QuotaCostRatio:  "-0.1",
		EffectiveFrom:   100,
		Enabled:         true,
	}

	err := profile.Validate()

	require.Error(t, err)
	require.Contains(t, err.Error(), "negative")
}

func TestChannelProfitSnapshotQueryNormalize(t *testing.T) {
	query := ChannelProfitSnapshotQuery{Page: -1, Limit: 999}

	query.Normalize()

	require.Equal(t, 1, query.Page)
	require.Equal(t, 200, query.Limit)
}
```

- [ ] **Step 2: Run the new model test and verify it fails**

Run:

```powershell
go test ./model -run "TestChannelCostProfile|TestChannelProfitSnapshotQuery" -count=1
```

Expected: fail because `ChannelCostProfile`, constants, and `ChannelProfitSnapshotQuery` do not exist.

- [ ] **Step 3: Add model structs, constants, validation, and query normalization**

Create `C:\work\aiapi114\model\channel_cost.go`:

```go
package model

import (
	"errors"
	"fmt"
	"strconv"
	"strings"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	ChannelCostModeToken      = "token"
	ChannelCostModeQuotaRatio = "quota_ratio"
	ChannelCostModeFixed      = "fixed"
	ChannelCostModeHybrid     = "hybrid"

	ChannelCostCurrencyUSD = "USD"
	ChannelCostCurrencyCNY = "CNY"

	ChannelCostMatchExact          = "exact"
	ChannelCostMatchChannelModel   = "channel_model"
	ChannelCostMatchChannelGroup   = "channel_group"
	ChannelCostMatchChannelDefault = "channel_default"
	ChannelCostMatchUnmatched      = "unmatched"
)

type ChannelCostProfile struct {
	ID                  int64  `json:"id" gorm:"primaryKey"`
	ChannelID           int    `json:"channel_id" gorm:"not null;index:idx_cost_profile_lookup,priority:1;index:idx_cost_profile_channel"`
	Group               string `json:"group" gorm:"column:group;type:varchar(64);not null;default:'';index:idx_cost_profile_lookup,priority:2"`
	Model               string `json:"model" gorm:"type:varchar(255);not null;default:'';index:idx_cost_profile_lookup,priority:3;index:idx_cost_profile_model"`
	CostMode            string `json:"cost_mode" gorm:"type:varchar(32);not null;default:'token'"`
	Currency            string `json:"currency" gorm:"type:varchar(16);not null;default:'USD'"`
	InputUnitPrice      string `json:"input_unit_price" gorm:"type:decimal(18,8);not null;default:0"`
	OutputUnitPrice     string `json:"output_unit_price" gorm:"type:decimal(18,8);not null;default:0"`
	CacheReadUnitPrice  string `json:"cache_read_unit_price" gorm:"type:decimal(18,8);not null;default:0"`
	CacheWriteUnitPrice string `json:"cache_write_unit_price" gorm:"type:decimal(18,8);not null;default:0"`
	QuotaCostRatio      string `json:"quota_cost_ratio" gorm:"type:decimal(18,8);not null;default:0"`
	FixedCost           string `json:"fixed_cost" gorm:"type:decimal(18,8);not null;default:0"`
	EffectiveFrom       int64  `json:"effective_from" gorm:"bigint;not null;default:0;index:idx_cost_profile_lookup,priority:5"`
	EffectiveTo         int64  `json:"effective_to" gorm:"bigint;not null;default:0;index:idx_cost_profile_lookup,priority:6"`
	Enabled             bool   `json:"enabled" gorm:"not null;default:true;index:idx_cost_profile_lookup,priority:4"`
	Remark              string `json:"remark" gorm:"type:varchar(255);not null;default:''"`
	CreatedAt           int64  `json:"created_at" gorm:"bigint;not null;default:0"`
	UpdatedAt           int64  `json:"updated_at" gorm:"bigint;not null;default:0"`
}

type ChannelProfitSnapshot struct {
	ID               int64  `json:"id" gorm:"primaryKey"`
	BucketStart      int64  `json:"bucket_start" gorm:"bigint;not null;uniqueIndex:idx_profit_snapshot_bucket,priority:1;index:idx_profit_snapshot_channel,priority:1;index:idx_profit_snapshot_model,priority:1;index:idx_profit_snapshot_group,priority:1"`
	BucketEnd        int64  `json:"bucket_end" gorm:"bigint;not null"`
	ChannelID        int    `json:"channel_id" gorm:"not null;uniqueIndex:idx_profit_snapshot_bucket,priority:2;index:idx_profit_snapshot_channel,priority:2"`
	Group            string `json:"group" gorm:"column:group;type:varchar(64);not null;default:'';uniqueIndex:idx_profit_snapshot_bucket,priority:3;index:idx_profit_snapshot_group,priority:2"`
	Model            string `json:"model" gorm:"type:varchar(255);not null;default:'';uniqueIndex:idx_profit_snapshot_bucket,priority:4;index:idx_profit_snapshot_model,priority:2"`
	RequestCount     int64  `json:"request_count" gorm:"not null;default:0"`
	PromptTokens     int64  `json:"prompt_tokens" gorm:"not null;default:0"`
	CompletionTokens int64  `json:"completion_tokens" gorm:"not null;default:0"`
	Quota            int64  `json:"quota" gorm:"not null;default:0"`
	RevenueUSD       string `json:"revenue_usd" gorm:"type:decimal(18,8);not null;default:0"`
	CostUSD          string `json:"cost_usd" gorm:"type:decimal(18,8);not null;default:0"`
	ProfitUSD        string `json:"profit_usd" gorm:"type:decimal(18,8);not null;default:0"`
	MarginPct        string `json:"margin_pct" gorm:"type:decimal(18,8);not null;default:0"`
	CostProfileID    int64  `json:"cost_profile_id" gorm:"not null;default:0;index"`
	CostMatchLevel   string `json:"cost_match_level" gorm:"type:varchar(32);not null;default:'unmatched';index"`
	CalculatedAt     int64  `json:"calculated_at" gorm:"bigint;not null;default:0;index"`
}

type ChannelCostProfileQuery struct {
	ChannelID int
	Group     string
	Model     string
	Enabled   *bool
	Page      int
	Limit     int
}

type ChannelProfitSnapshotQuery struct {
	ChannelID   int
	Group       string
	Model       string
	MatchLevel  string
	BucketStart int64
	BucketEnd   int64
	Page        int
	Limit       int
}

func (profile ChannelCostProfile) Validate() error {
	if profile.ChannelID <= 0 {
		return errors.New("channel_id is required")
	}
	if !validChannelCostMode(profile.CostMode) {
		return fmt.Errorf("unsupported cost_mode: %s", profile.CostMode)
	}
	if !validChannelCostCurrency(profile.Currency) {
		return fmt.Errorf("unsupported currency: %s", profile.Currency)
	}
	if profile.EffectiveTo > 0 && profile.EffectiveTo <= profile.EffectiveFrom {
		return errors.New("effective_to must be greater than effective_from")
	}
	for name, value := range map[string]string{
		"input_unit_price":       profile.InputUnitPrice,
		"output_unit_price":      profile.OutputUnitPrice,
		"cache_read_unit_price":  profile.CacheReadUnitPrice,
		"cache_write_unit_price": profile.CacheWriteUnitPrice,
		"quota_cost_ratio":       profile.QuotaCostRatio,
		"fixed_cost":             profile.FixedCost,
	} {
		if isNegativeDecimalString(value) {
			return fmt.Errorf("%s cannot be negative", name)
		}
	}
	return nil
}

func validChannelCostMode(mode string) bool {
	switch mode {
	case ChannelCostModeToken, ChannelCostModeQuotaRatio, ChannelCostModeFixed, ChannelCostModeHybrid:
		return true
	default:
		return false
	}
}

func validChannelCostCurrency(currency string) bool {
	switch strings.ToUpper(strings.TrimSpace(currency)) {
	case ChannelCostCurrencyUSD, ChannelCostCurrencyCNY:
		return true
	default:
		return false
	}
}

func isNegativeDecimalString(value string) bool {
	value = strings.TrimSpace(value)
	if value == "" {
		return false
	}
	parsed, err := strconv.ParseFloat(value, 64)
	return err == nil && parsed < 0
}

func (query *ChannelCostProfileQuery) Normalize() {
	query.Page, query.Limit = normalizePageLimit(query.Page, query.Limit)
}

func (query *ChannelProfitSnapshotQuery) Normalize() {
	query.Page, query.Limit = normalizePageLimit(query.Page, query.Limit)
}

func normalizePageLimit(page int, limit int) (int, int) {
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 20
	}
	if limit > 200 {
		limit = 200
	}
	return page, limit
}

func EnsureChannelCostTables() error {
	if DB == nil {
		return errors.New("database is not initialized")
	}
	return DB.AutoMigrate(&ChannelCostProfile{}, &ChannelProfitSnapshot{})
}

func UpsertChannelProfitSnapshot(snapshot ChannelProfitSnapshot) error {
	if err := EnsureChannelCostTables(); err != nil {
		return err
	}
	return DB.Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "bucket_start"},
			{Name: "channel_id"},
			{Name: "group"},
			{Name: "model"},
		},
		DoUpdates: clause.AssignmentColumns([]string{
			"bucket_end",
			"request_count",
			"prompt_tokens",
			"completion_tokens",
			"quota",
			"revenue_usd",
			"cost_usd",
			"profit_usd",
			"margin_pct",
			"cost_profile_id",
			"cost_match_level",
			"calculated_at",
		}),
	}).Create(&snapshot).Error
}

func ListChannelCostProfiles(query ChannelCostProfileQuery) ([]ChannelCostProfile, int64, error) {
	query.Normalize()
	var records []ChannelCostProfile
	db := buildChannelCostProfileQuery(query)
	total, err := countQuery(db)
	if err != nil {
		return records, 0, err
	}
	err = applyPagination(db, query.Page, query.Limit).Order("updated_at desc").Find(&records).Error
	return records, total, err
}

func ListChannelProfitSnapshots(query ChannelProfitSnapshotQuery) ([]ChannelProfitSnapshot, int64, error) {
	query.Normalize()
	var records []ChannelProfitSnapshot
	db := buildChannelProfitSnapshotQuery(query)
	total, err := countQuery(db)
	if err != nil {
		return records, 0, err
	}
	err = applyPagination(db, query.Page, query.Limit).Order("bucket_start desc").Find(&records).Error
	return records, total, err
}

func buildChannelCostProfileQuery(query ChannelCostProfileQuery) *gorm.DB {
	db := DB.Model(&ChannelCostProfile{})
	if query.ChannelID > 0 {
		db = db.Where("channel_id = ?", query.ChannelID)
	}
	if query.Group != "" {
		db = db.Where(commonGroupCol+" = ?", query.Group)
	}
	if query.Model != "" {
		db = db.Where("model = ?", query.Model)
	}
	if query.Enabled != nil {
		db = db.Where("enabled = ?", *query.Enabled)
	}
	return db
}

func buildChannelProfitSnapshotQuery(query ChannelProfitSnapshotQuery) *gorm.DB {
	db := DB.Model(&ChannelProfitSnapshot{})
	if query.ChannelID > 0 {
		db = db.Where("channel_id = ?", query.ChannelID)
	}
	if query.Group != "" {
		db = db.Where(commonGroupCol+" = ?", query.Group)
	}
	if query.Model != "" {
		db = db.Where("model = ?", query.Model)
	}
	if query.MatchLevel != "" {
		db = db.Where("cost_match_level = ?", query.MatchLevel)
	}
	if query.BucketStart > 0 {
		db = db.Where("bucket_start >= ?", query.BucketStart)
	}
	if query.BucketEnd > 0 {
		db = db.Where("bucket_start < ?", query.BucketEnd)
	}
	return db
}
```

- [ ] **Step 4: Register the new tables in regular and fast migrations**

Modify `C:\work\aiapi114\model\main.go`:

```go
err := DB.AutoMigrate(
	&Channel{},
	&Token{},
	&User{},
	&PasskeyCredential{},
	&Option{},
	&Redemption{},
	&Ability{},
	&Log{},
	&Midjourney{},
	&TopUp{},
	&QuotaData{},
	&Task{},
	&Model{},
	&Vendor{},
	&PrefillGroup{},
	&Setup{},
	&TwoFA{},
	&TwoFABackupCode{},
	&Checkin{},
	&SubscriptionOrder{},
	&UserSubscription{},
	&SubscriptionPreConsumeRecord{},
	&CustomOAuthProvider{},
	&UserOAuthBinding{},
	&PerfMetric{},
	&SupplierStatusSync{},
	&ChannelDynamicOverride{},
	&ChannelDynamicAdjustmentLog{},
	&ChannelProbeResult{},
	&ChannelCostProfile{},
	&ChannelProfitSnapshot{},
)
```

Also add these entries in the `migrations` slice in `migrateDBFast()`:

```go
{&ChannelCostProfile{}, "ChannelCostProfile"},
{&ChannelProfitSnapshot{}, "ChannelProfitSnapshot"},
```

- [ ] **Step 5: Run model tests**

Run:

```powershell
go test ./model -run "TestChannelCostProfile|TestChannelProfitSnapshotQuery" -count=1
```

Expected: pass.

- [ ] **Step 6: Run formatting and broader model tests**

Run:

```powershell
gofmt -w "C:\work\aiapi114\model\channel_cost.go" "C:\work\aiapi114\model\channel_cost_test.go" "C:\work\aiapi114\model\main.go"
go test ./model -count=1
```

Expected: pass. If unrelated existing model tests fail, capture the failing test names and continue only after confirming the failures predate this task.

- [ ] **Step 7: Commit Task 1 only**

Run:

```powershell
git add -- "model\channel_cost.go" "model\channel_cost_test.go" "model\main.go"
git commit -m "feat: add channel cost data models"
```

Expected: commit contains only the three files listed above.

---

## Task 2: Cost calculation and matching service

**Files:**

- Create: `C:\work\aiapi114\service\channel_cost.go`
- Create: `C:\work\aiapi114\service\channel_cost_test.go`

- [ ] **Step 1: Write failing unit tests for cost matching and calculation**

Create `C:\work\aiapi114\service\channel_cost_test.go`:

```go
package service

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/require"
)

func TestChooseCostProfilePrefersExactMatch(t *testing.T) {
	profiles := []model.ChannelCostProfile{
		{ID: 1, ChannelID: 7, Group: "", Model: "", Enabled: true},
		{ID: 2, ChannelID: 7, Group: "vip", Model: "", Enabled: true},
		{ID: 3, ChannelID: 7, Group: "", Model: "gpt-5.4", Enabled: true},
		{ID: 4, ChannelID: 7, Group: "vip", Model: "gpt-5.4", Enabled: true},
	}

	match := ChooseChannelCostProfile(profiles, ChannelCostLookup{
		ChannelID: 7,
		Group:     "vip",
		Model:     "gpt-5.4",
		Timestamp: 100,
	})

	require.Equal(t, int64(4), match.Profile.ID)
	require.Equal(t, model.ChannelCostMatchExact, match.MatchLevel)
}

func TestCalculateTokenCostUsesMillionTokenUnit(t *testing.T) {
	result, err := CalculateChannelCost(model.ChannelCostProfile{
		CostMode:        model.ChannelCostModeToken,
		Currency:        model.ChannelCostCurrencyUSD,
		InputUnitPrice:  "2.00000000",
		OutputUnitPrice: "8.00000000",
	}, ChannelCostUsage{
		PromptTokens:     1_500_000,
		CompletionTokens: 500_000,
		RevenueUSD:       decimal.NewFromInt(20),
	})

	require.NoError(t, err)
	require.True(t, decimal.NewFromFloat(7).Equal(result.CostUSD), result.CostUSD.String())
}

func TestCalculateQuotaRatioCost(t *testing.T) {
	result, err := CalculateChannelCost(model.ChannelCostProfile{
		CostMode:       model.ChannelCostModeQuotaRatio,
		Currency:       model.ChannelCostCurrencyUSD,
		QuotaCostRatio: "0.25",
	}, ChannelCostUsage{RevenueUSD: decimal.NewFromInt(12)})

	require.NoError(t, err)
	require.True(t, decimal.NewFromInt(3).Equal(result.CostUSD), result.CostUSD.String())
}
```

- [ ] **Step 2: Run the service tests and verify they fail**

Run:

```powershell
go test ./service -run "TestChooseCostProfile|TestCalculate" -count=1
```

Expected: fail because `ChooseChannelCostProfile`, `ChannelCostLookup`, `ChannelCostUsage`, and `CalculateChannelCost` do not exist.

- [ ] **Step 3: Implement pure matching and cost calculation helpers**

Create `C:\work\aiapi114\service\channel_cost.go`:

```go
package service

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/model"
	"github.com/shopspring/decimal"
)

type ChannelCostLookup struct {
	ChannelID int
	Group     string
	Model     string
	Timestamp int64
}

type ChannelCostUsage struct {
	PromptTokens     int64
	CompletionTokens int64
	RevenueUSD       decimal.Decimal
}

type ChannelCostMatch struct {
	Profile    model.ChannelCostProfile
	MatchLevel string
	Matched    bool
}

type ChannelCostResult struct {
	CostUSD decimal.Decimal
}

func ChooseChannelCostProfile(profiles []model.ChannelCostProfile, lookup ChannelCostLookup) ChannelCostMatch {
	candidates := []struct {
		level string
		match func(model.ChannelCostProfile) bool
	}{
		{model.ChannelCostMatchExact, func(p model.ChannelCostProfile) bool {
			return p.Group == lookup.Group && p.Model == lookup.Model
		}},
		{model.ChannelCostMatchChannelModel, func(p model.ChannelCostProfile) bool {
			return p.Group == "" && p.Model == lookup.Model
		}},
		{model.ChannelCostMatchChannelGroup, func(p model.ChannelCostProfile) bool {
			return p.Group == lookup.Group && p.Model == ""
		}},
		{model.ChannelCostMatchChannelDefault, func(p model.ChannelCostProfile) bool {
			return p.Group == "" && p.Model == ""
		}},
	}
	for _, candidate := range candidates {
		for _, profile := range profiles {
			if profile.ChannelID != lookup.ChannelID || !profile.Enabled {
				continue
			}
			if !costProfileEffective(profile, lookup.Timestamp) {
				continue
			}
			if candidate.match(profile) {
				return ChannelCostMatch{Profile: profile, MatchLevel: candidate.level, Matched: true}
			}
		}
	}
	return ChannelCostMatch{MatchLevel: model.ChannelCostMatchUnmatched}
}

func CalculateChannelCost(profile model.ChannelCostProfile, usage ChannelCostUsage) (ChannelCostResult, error) {
	switch profile.CostMode {
	case model.ChannelCostModeToken:
		return ChannelCostResult{CostUSD: tokenCost(profile, usage)}, nil
	case model.ChannelCostModeQuotaRatio:
		ratio, err := decimalFromString(profile.QuotaCostRatio)
		if err != nil {
			return ChannelCostResult{}, err
		}
		return ChannelCostResult{CostUSD: usage.RevenueUSD.Mul(ratio)}, nil
	case model.ChannelCostModeFixed:
		fixed, err := decimalFromString(profile.FixedCost)
		if err != nil {
			return ChannelCostResult{}, err
		}
		return ChannelCostResult{CostUSD: fixed}, nil
	case model.ChannelCostModeHybrid:
		fixed, err := decimalFromString(profile.FixedCost)
		if err != nil {
			return ChannelCostResult{}, err
		}
		return ChannelCostResult{CostUSD: tokenCost(profile, usage).Add(fixed)}, nil
	default:
		return ChannelCostResult{}, fmt.Errorf("unsupported cost mode: %s", profile.CostMode)
	}
}

func costProfileEffective(profile model.ChannelCostProfile, timestamp int64) bool {
	if timestamp > 0 && profile.EffectiveFrom > 0 && timestamp < profile.EffectiveFrom {
		return false
	}
	return profile.EffectiveTo == 0 || timestamp < profile.EffectiveTo
}

func tokenCost(profile model.ChannelCostProfile, usage ChannelCostUsage) decimal.Decimal {
	inputPrice, _ := decimalFromString(profile.InputUnitPrice)
	outputPrice, _ := decimalFromString(profile.OutputUnitPrice)
	million := decimal.NewFromInt(1_000_000)
	input := decimal.NewFromInt(usage.PromptTokens).Div(million).Mul(inputPrice)
	output := decimal.NewFromInt(usage.CompletionTokens).Div(million).Mul(outputPrice)
	return input.Add(output)
}

func decimalFromString(value string) (decimal.Decimal, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return decimal.Zero, nil
	}
	return decimal.NewFromString(value)
}
```

- [ ] **Step 4: Run tests**

Run:

```powershell
gofmt -w "C:\work\aiapi114\service\channel_cost.go" "C:\work\aiapi114\service\channel_cost_test.go"
go test ./service -run "TestChooseCostProfile|TestCalculate" -count=1
```

Expected: pass.

- [ ] **Step 5: Commit Task 2 only**

Run:

```powershell
git add -- "service\channel_cost.go" "service\channel_cost_test.go"
git commit -m "feat: calculate channel costs"
```

Expected: commit contains only the two files listed above.

---

## Task 3: Hourly profit snapshot aggregation

**Files:**

- Create: `C:\work\aiapi114\service\channel_profit_report.go`
- Create: `C:\work\aiapi114\service\channel_profit_report_test.go`
- Modify: `C:\work\aiapi114\main.go`

- [ ] **Step 1: Write failing pure tests for snapshot row calculation**

Create `C:\work\aiapi114\service\channel_profit_report_test.go`:

```go
package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestBuildProfitSnapshotFromAggregate(t *testing.T) {
	common.QuotaPerUnit = 500000
	row := ChannelProfitAggregateRow{
		BucketStart:      3600,
		BucketEnd:        7200,
		ChannelID:        7,
		Group:            "vip",
		Model:            "gpt-5.4",
		RequestCount:     2,
		PromptTokens:     1_000_000,
		CompletionTokens: 500_000,
		Quota:            5_000_000,
	}
	profile := model.ChannelCostProfile{
		ID:              11,
		ChannelID:       7,
		Group:           "vip",
		Model:           "gpt-5.4",
		CostMode:        model.ChannelCostModeToken,
		Currency:        model.ChannelCostCurrencyUSD,
		InputUnitPrice:  "1",
		OutputUnitPrice: "4",
		Enabled:         true,
	}

	snapshot, err := BuildProfitSnapshot(row, ChannelCostMatch{
		Profile:    profile,
		MatchLevel: model.ChannelCostMatchExact,
		Matched:    true,
	})

	require.NoError(t, err)
	require.Equal(t, int64(11), snapshot.CostProfileID)
	require.Equal(t, model.ChannelCostMatchExact, snapshot.CostMatchLevel)
	require.Equal(t, "10", snapshot.RevenueUSD)
	require.Equal(t, "3", snapshot.CostUSD)
	require.Equal(t, "7", snapshot.ProfitUSD)
	require.Equal(t, "70", snapshot.MarginPct)
}
```

- [ ] **Step 2: Run the new test and verify it fails**

Run:

```powershell
go test ./service -run TestBuildProfitSnapshotFromAggregate -count=1
```

Expected: fail because `ChannelProfitAggregateRow` and `BuildProfitSnapshot` do not exist.

- [ ] **Step 3: Add profit snapshot calculation and hourly job skeleton**

Create `C:\work\aiapi114\service\channel_profit_report.go`:

```go
package service

import (
	"context"
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/shopspring/decimal"
)

type ChannelProfitAggregateRow struct {
	BucketStart      int64
	BucketEnd        int64
	ChannelID        int
	Group            string
	Model            string
	RequestCount     int64
	PromptTokens     int64
	CompletionTokens int64
	Quota            int64
}

type ChannelProfitRunResult struct {
	BucketStart int64 `json:"bucket_start"`
	BucketEnd   int64 `json:"bucket_end"`
	Scanned     int   `json:"scanned"`
	Saved       int   `json:"saved"`
}

func StartChannelProfitReportTask() {
	go channelProfitReportLoop()
}

func channelProfitReportLoop() {
	for {
		wait := time.Until(time.Now().Truncate(time.Hour).Add(time.Hour).Add(5 * time.Minute))
		if wait < time.Minute {
			wait = time.Minute
		}
		timer := time.NewTimer(wait)
		<-timer.C
		runChannelProfitReportSafely()
	}
}

func runChannelProfitReportSafely() {
	defer func() {
		if r := recover(); r != nil {
			logger.LogError(context.Background(), fmt.Sprintf("channel profit report panic: %v", r))
		}
	}()
	now := time.Now().Unix()
	end := now - now%3600
	start := end - 3600
	if _, err := RunChannelProfitReportOnce(context.Background(), start, end); err != nil {
		logger.LogError(context.Background(), fmt.Sprintf("channel profit report failed: %v", err))
	}
}

func RunChannelProfitReportOnce(ctx context.Context, bucketStart int64, bucketEnd int64) (ChannelProfitRunResult, error) {
	_ = ctx
	if bucketStart <= 0 || bucketEnd <= bucketStart {
		return ChannelProfitRunResult{}, fmt.Errorf("invalid report window: %d-%d", bucketStart, bucketEnd)
	}
	if err := model.EnsureChannelCostTables(); err != nil {
		return ChannelProfitRunResult{}, err
	}
	rows, err := loadChannelProfitAggregateRows(bucketStart, bucketEnd)
	if err != nil {
		return ChannelProfitRunResult{}, err
	}
	profiles, err := loadEnabledChannelCostProfiles(bucketEnd)
	if err != nil {
		return ChannelProfitRunResult{}, err
	}
	result := ChannelProfitRunResult{BucketStart: bucketStart, BucketEnd: bucketEnd, Scanned: len(rows)}
	for _, row := range rows {
		match := ChooseChannelCostProfile(profiles, ChannelCostLookup{
			ChannelID: row.ChannelID,
			Group:     row.Group,
			Model:     row.Model,
			Timestamp: row.BucketStart,
		})
		snapshot, err := BuildProfitSnapshot(row, match)
		if err != nil {
			return result, err
		}
		if err := model.UpsertChannelProfitSnapshot(snapshot); err != nil {
			return result, err
		}
		result.Saved++
	}
	return result, nil
}

func BuildProfitSnapshot(row ChannelProfitAggregateRow, match ChannelCostMatch) (model.ChannelProfitSnapshot, error) {
	revenue := decimal.NewFromInt(row.Quota).Div(decimal.NewFromFloat(common.QuotaPerUnit))
	cost := decimal.Zero
	costProfileID := int64(0)
	matchLevel := model.ChannelCostMatchUnmatched
	if match.Matched {
		result, err := CalculateChannelCost(match.Profile, ChannelCostUsage{
			PromptTokens:     row.PromptTokens,
			CompletionTokens: row.CompletionTokens,
			RevenueUSD:       revenue,
		})
		if err != nil {
			return model.ChannelProfitSnapshot{}, err
		}
		cost = result.CostUSD
		costProfileID = match.Profile.ID
		matchLevel = match.MatchLevel
	}
	profit := revenue.Sub(cost)
	margin := decimal.Zero
	if !revenue.IsZero() {
		margin = profit.Div(revenue).Mul(decimal.NewFromInt(100))
	}
	return model.ChannelProfitSnapshot{
		BucketStart:      row.BucketStart,
		BucketEnd:        row.BucketEnd,
		ChannelID:        row.ChannelID,
		Group:            row.Group,
		Model:            row.Model,
		RequestCount:     row.RequestCount,
		PromptTokens:     row.PromptTokens,
		CompletionTokens: row.CompletionTokens,
		Quota:            row.Quota,
		RevenueUSD:       revenue.String(),
		CostUSD:          cost.String(),
		ProfitUSD:        profit.String(),
		MarginPct:        margin.String(),
		CostProfileID:    costProfileID,
		CostMatchLevel:   matchLevel,
		CalculatedAt:     common.GetTimestamp(),
	}, nil
}

func loadChannelProfitAggregateRows(bucketStart int64, bucketEnd int64) ([]ChannelProfitAggregateRow, error) {
	var rows []ChannelProfitAggregateRow
	err := model.LOG_DB.Table("logs").
		Select("MIN(?) as bucket_start, MIN(?) as bucket_end, channel_id, "+logGroupColumnForService()+" as `group`, model_name as model, COUNT(*) as request_count, SUM(prompt_tokens) as prompt_tokens, SUM(completion_tokens) as completion_tokens, SUM(quota) as quota", bucketStart, bucketEnd).
		Where("type = ? AND quota > 0 AND created_at >= ? AND created_at < ?", model.LogTypeConsume, bucketStart, bucketEnd).
		Group("channel_id, " + logGroupColumnForService() + ", model_name").
		Scan(&rows).Error
	return rows, err
}

func loadEnabledChannelCostProfiles(timestamp int64) ([]model.ChannelCostProfile, error) {
	var profiles []model.ChannelCostProfile
	err := model.DB.
		Where("enabled = ? AND effective_from <= ? AND (effective_to = 0 OR effective_to > ?)", true, timestamp, timestamp).
		Find(&profiles).Error
	return profiles, err
}

func logGroupColumnForService() string {
	if common.LogSqlType == common.DatabaseTypePostgreSQL {
		return `"group"`
	}
	return "`group`"
}
```

- [ ] **Step 4: Start the report task on master nodes**

Modify `C:\work\aiapi114\main.go` inside the existing `if common.IsMasterNode` block:

```go
if common.IsMasterNode {
	service.StartUpstreamStatusSyncTask()
	service.StartChannelDynamicAdjustmentTask()
	service.StartChannelProfitReportTask()
}
```

- [ ] **Step 5: Run tests and formatting**

Run:

```powershell
gofmt -w "C:\work\aiapi114\service\channel_profit_report.go" "C:\work\aiapi114\service\channel_profit_report_test.go" "C:\work\aiapi114\main.go"
go test ./service -run TestBuildProfitSnapshotFromAggregate -count=1
go test ./service -count=1
```

Expected: pass.

- [ ] **Step 6: Commit Task 3 only**

Run:

```powershell
git add -- "service\channel_profit_report.go" "service\channel_profit_report_test.go" "main.go"
git commit -m "feat: generate channel profit snapshots"
```

Expected: commit contains only the three files listed above.

---

## Task 4: Cost profile CRUD and report APIs

**Files:**

- Create: `C:\work\aiapi114\controller\channel_profit.go`
- Modify: `C:\work\aiapi114\router\api-router.go`

- [ ] **Step 1: Write controller-level request validation tests if controller tests already use Gin fixtures**

Inspect existing controller tests. If they use Gin test routers, create `C:\work\aiapi114\controller\channel_profit_test.go` with this test:

```go
package controller

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestCreateChannelCostProfileRejectsInvalidJSON(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.POST("/api/channel-profit/cost-profiles", CreateChannelCostProfile)

	req := httptest.NewRequest(http.MethodPost, "/api/channel-profit/cost-profiles", strings.NewReader("{"))
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	require.Equal(t, http.StatusOK, resp.Code)
	require.Contains(t, resp.Body.String(), "success")
}
```

If controller test fixtures require full database setup, skip this file and rely on service/model tests in Tasks 1-3 plus route smoke tests in Task 8.

- [ ] **Step 2: Add controller handlers**

Create `C:\work\aiapi114\controller\channel_profit.go`:

```go
package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

func ListChannelCostProfiles(c *gin.Context) {
	records, total, err := model.ListChannelCostProfiles(model.ChannelCostProfileQuery{
		ChannelID: parseQueryInt(c, "channel_id"),
		Group:     c.Query("group"),
		Model:     c.Query("model"),
		Enabled:   parseOptionalBool(c, "enabled"),
		Page:      parseQueryIntDefault(c, "page", 1),
		Limit:     parseQueryIntDefault(c, "limit", 20),
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": records, "total": total})
}

func CreateChannelCostProfile(c *gin.Context) {
	var profile model.ChannelCostProfile
	if err := common.DecodeJson(c.Request.Body, &profile); err != nil {
		common.ApiErrorMsg(c, "无效的渠道成本配置")
		return
	}
	if err := profile.Validate(); err != nil {
		common.ApiError(c, err)
		return
	}
	now := common.GetTimestamp()
	profile.ID = 0
	profile.CreatedAt = now
	profile.UpdatedAt = now
	if err := model.EnsureChannelCostTables(); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.DB.Create(&profile).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": profile})
}

func UpdateChannelCostProfile(c *gin.Context) {
	var profile model.ChannelCostProfile
	if err := common.DecodeJson(c.Request.Body, &profile); err != nil {
		common.ApiErrorMsg(c, "无效的渠道成本配置")
		return
	}
	if profile.ID <= 0 {
		common.ApiErrorMsg(c, "成本配置 ID 不能为空")
		return
	}
	if err := profile.Validate(); err != nil {
		common.ApiError(c, err)
		return
	}
	profile.UpdatedAt = common.GetTimestamp()
	if err := model.DB.Model(&model.ChannelCostProfile{}).Where("id = ?", profile.ID).Updates(profile).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": profile})
}

func DeleteChannelCostProfile(c *gin.Context) {
	id := parseQueryInt(c, "id")
	if id <= 0 {
		common.ApiErrorMsg(c, "成本配置 ID 不能为空")
		return
	}
	if err := model.DB.Delete(&model.ChannelCostProfile{}, id).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": ""})
}

func ListChannelProfitSnapshots(c *gin.Context) {
	records, total, err := model.ListChannelProfitSnapshots(model.ChannelProfitSnapshotQuery{
		ChannelID:   parseQueryInt(c, "channel_id"),
		Group:       c.Query("group"),
		Model:       c.Query("model"),
		MatchLevel:  c.Query("cost_match_level"),
		BucketStart: int64(parseQueryInt(c, "bucket_start")),
		BucketEnd:   int64(parseQueryInt(c, "bucket_end")),
		Page:        parseQueryIntDefault(c, "page", 1),
		Limit:       parseQueryIntDefault(c, "limit", 20),
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": records, "total": total})
}

func RecalculateChannelProfit(c *gin.Context) {
	start := int64(parseQueryInt(c, "bucket_start"))
	end := int64(parseQueryInt(c, "bucket_end"))
	result, err := service.RunChannelProfitReportOnce(c.Request.Context(), start, end)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": result})
}
```

- [ ] **Step 3: Register admin routes**

Modify `C:\work\aiapi114\router\api-router.go` near other admin-only route groups:

```go
channelProfitRoute := apiRouter.Group("/channel-profit")
channelProfitRoute.Use(middleware.AdminAuth())
{
	channelProfitRoute.GET("/cost-profiles", controller.ListChannelCostProfiles)
	channelProfitRoute.POST("/cost-profiles", controller.CreateChannelCostProfile)
	channelProfitRoute.PUT("/cost-profiles", controller.UpdateChannelCostProfile)
	channelProfitRoute.DELETE("/cost-profiles", controller.DeleteChannelCostProfile)
	channelProfitRoute.GET("/snapshots", controller.ListChannelProfitSnapshots)
	channelProfitRoute.GET("/summary", controller.ListChannelProfitSnapshots)
	channelProfitRoute.GET("/channels", controller.ListChannelProfitSnapshots)
	channelProfitRoute.GET("/models", controller.ListChannelProfitSnapshots)
	channelProfitRoute.GET("/groups", controller.ListChannelProfitSnapshots)
	channelProfitRoute.GET("/unmatched-costs", controller.ListChannelProfitSnapshots)
	channelProfitRoute.POST("/recalculate", controller.RecalculateChannelProfit)
}
```

Use snapshot list as the first version for all report endpoints. Task 7 can refine frontend presentation without blocking backend availability.

- [ ] **Step 4: Run formatting and build tests**

Run:

```powershell
gofmt -w "C:\work\aiapi114\controller\channel_profit.go" "C:\work\aiapi114\router\api-router.go"
go test ./controller -run "TestCreateChannelCostProfile|^$" -count=1
go test ./router ./controller -count=1
```

Expected: pass, or skip the controller-specific test if the project lacks isolated controller fixtures.

- [ ] **Step 5: Commit Task 4 only**

Run:

```powershell
git add -- "controller\channel_profit.go" "router\api-router.go"
git commit -m "feat: expose channel profit APIs"
```

Expected: commit contains only controller and router changes.

---

## Task 5: Cost signal and dynamic adjustment integration

**Files:**

- Modify: `C:\work\aiapi114\service\channel_dynamic_adjustment.go`
- Modify: `C:\work\aiapi114\service\channel_dynamic_adjustment_runner.go`
- Create: `C:\work\aiapi114\service\channel_cost_dynamic_test.go`
- Create: `C:\work\aiapi114\setting\operation_setting\channel_profit_setting.go`
- Modify: `C:\work\aiapi114\model\option.go`

- [ ] **Step 1: Write failing tests for cost-driven dynamic planning**

Create `C:\work\aiapi114\service\channel_cost_dynamic_test.go`:

```go
package service

import (
	"testing"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/require"
)

func TestClassifyChannelCostSignalNegativeMargin(t *testing.T) {
	signal := ClassifyChannelCostSignal(ChannelCostSignalInput{
		RevenueUSD:        decimal.NewFromInt(10),
		CostUSD:           decimal.NewFromInt(12),
		RequestCount:      40,
		MinimumSampleSize: 20,
		TargetMarginPct:   decimal.NewFromInt(20),
	})

	require.Equal(t, DynamicCostStateNegativeMargin, signal.State)
	require.Contains(t, signal.Reason, "profit=-2")
}

func TestPlanCostDynamicAdjustmentLowersPriorityAndWeight(t *testing.T) {
	basePriority := int64(5)
	plan := PlanCostDynamicAdjustment(DynamicAbilitySnapshot{
		ChannelID: 8,
		Group:     "vip",
		Model:     "gpt-5.4",
		Enabled:   true,
		Priority:  &basePriority,
		Weight:    100,
	}, ChannelCostSignal{State: DynamicCostStateNegativeMargin, Reason: "negative margin"})

	require.Equal(t, DynamicActionAdjustWeight, plan.Action)
	require.Equal(t, DynamicCostStateNegativeMargin, plan.State)
	require.Equal(t, uint(20), plan.AppliedWeight)
	require.NotNil(t, plan.AppliedPriority)
	require.Equal(t, int64(4), *plan.AppliedPriority)
}
```

- [ ] **Step 2: Run the new tests and verify they fail**

Run:

```powershell
go test ./service -run "TestClassifyChannelCostSignal|TestPlanCostDynamicAdjustment" -count=1
```

Expected: fail because cost signal types and functions do not exist.

- [ ] **Step 3: Add cost signal types and pure planning helpers**

Modify `C:\work\aiapi114\service\channel_dynamic_adjustment.go`:

```go
const (
	DynamicSourceCost = "cost"

	DynamicCostStateProfitable         = "profitable"
	DynamicCostStateLowMargin          = "low_margin"
	DynamicCostStateNegativeMargin     = "negative_margin"
	DynamicCostStateUnknownCost        = "unknown_cost"
	DynamicCostStateInsufficientSample = "insufficient_sample"
)

type ChannelCostSignalInput struct {
	RevenueUSD        decimal.Decimal
	CostUSD           decimal.Decimal
	RequestCount      int64
	MinimumSampleSize int64
	TargetMarginPct   decimal.Decimal
}

type ChannelCostSignal struct {
	RevenueUSD    decimal.Decimal
	CostUSD       decimal.Decimal
	ProfitUSD     decimal.Decimal
	MarginPct     *decimal.Decimal
	RequestCount  int64
	WindowMinutes int
	State         string
	Reason        string
}

func ClassifyChannelCostSignal(input ChannelCostSignalInput) ChannelCostSignal {
	profit := input.RevenueUSD.Sub(input.CostUSD)
	if input.RequestCount < input.MinimumSampleSize {
		return ChannelCostSignal{RevenueUSD: input.RevenueUSD, CostUSD: input.CostUSD, ProfitUSD: profit, RequestCount: input.RequestCount, State: DynamicCostStateInsufficientSample, Reason: "insufficient sample"}
	}
	if input.RevenueUSD.IsZero() {
		return ChannelCostSignal{RevenueUSD: input.RevenueUSD, CostUSD: input.CostUSD, ProfitUSD: profit, RequestCount: input.RequestCount, State: DynamicCostStateUnknownCost, Reason: "zero revenue"}
	}
	margin := profit.Div(input.RevenueUSD).Mul(decimal.NewFromInt(100))
	if profit.IsNegative() {
		return ChannelCostSignal{RevenueUSD: input.RevenueUSD, CostUSD: input.CostUSD, ProfitUSD: profit, MarginPct: &margin, RequestCount: input.RequestCount, State: DynamicCostStateNegativeMargin, Reason: fmt.Sprintf("profit=%s margin=%s", profit.String(), margin.String())}
	}
	if margin.LessThan(input.TargetMarginPct) {
		return ChannelCostSignal{RevenueUSD: input.RevenueUSD, CostUSD: input.CostUSD, ProfitUSD: profit, MarginPct: &margin, RequestCount: input.RequestCount, State: DynamicCostStateLowMargin, Reason: fmt.Sprintf("margin=%s below target=%s", margin.String(), input.TargetMarginPct.String())}
	}
	return ChannelCostSignal{RevenueUSD: input.RevenueUSD, CostUSD: input.CostUSD, ProfitUSD: profit, MarginPct: &margin, RequestCount: input.RequestCount, State: DynamicCostStateProfitable, Reason: "profit target met"}
}

func PlanCostDynamicAdjustment(ability DynamicAbilitySnapshot, signal ChannelCostSignal) DynamicAdjustmentPlan {
	plan := DynamicAdjustmentPlan{
		Action:          DynamicActionNone,
		State:           signal.State,
		Source:          DynamicSourceCost,
		AppliedEnabled:  ability.Enabled,
		AppliedPriority: cloneInt64Ptr(ability.Priority),
		AppliedWeight:   ability.Weight,
		Reason:          signal.Reason,
	}
	switch signal.State {
	case DynamicCostStateLowMargin:
		plan.Action = DynamicActionAdjustWeight
		plan.AppliedWeight = scaledWeight(ability.Weight, 0.5, 1)
	case DynamicCostStateNegativeMargin:
		plan.Action = DynamicActionAdjustWeight
		plan.AppliedWeight = scaledWeight(ability.Weight, 0.2, 1)
		if ability.Priority != nil {
			next := *ability.Priority - 1
			plan.AppliedPriority = &next
		}
	case DynamicCostStateProfitable:
		plan.Action = DynamicActionRestoreBaseline
	case DynamicCostStateUnknownCost, DynamicCostStateInsufficientSample:
		plan.Action = DynamicActionNone
	}
	return plan
}
```

Also add this import to the file:

```go
import (
	"fmt"

	"github.com/shopspring/decimal"
)
```

- [ ] **Step 4: Add cost strategy settings**

Create `C:\work\aiapi114\setting\operation_setting\channel_profit_setting.go`:

```go
package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

type ChannelProfitSetting struct {
	CostAdjustmentEnabled bool    `json:"cost_adjustment_enabled"`
	MinimumSampleSize     int64   `json:"minimum_sample_size"`
	TargetMarginPct       float64 `json:"target_margin_pct"`
	WindowMinutes         int     `json:"window_minutes"`
}

var channelProfitSetting = ChannelProfitSetting{
	CostAdjustmentEnabled: false,
	MinimumSampleSize:     20,
	TargetMarginPct:       20,
	WindowMinutes:         60,
}

func init() {
	config.GlobalConfig.Register("channel_profit", &channelProfitSetting)
}

func GetChannelProfitSetting() *ChannelProfitSetting {
	return &channelProfitSetting
}
```

Modify `C:\work\aiapi114\model\option.go` so option initialization and updates include the new setting through the existing config registration system. Follow the pattern used for `channel_dynamic_adjustment` settings in the same file.

- [ ] **Step 5: Load recent cost snapshots in the dynamic runner**

Modify `C:\work\aiapi114\service\channel_dynamic_adjustment_runner.go`:

```go
costSignals, err := loadRecentChannelCostSignals(setting)
if err != nil {
	return ChannelDynamicAdjustmentRunResult{}, err
}
```

Then, inside the ability loop after health-based planning is calculated, merge cost planning conservatively:

```go
if costSignal, ok := costSignals[dynamicTargetKey(ability.ChannelID, ability.Group, ability.Model)]; ok {
	costPlan := PlanCostDynamicAdjustment(DynamicAbilitySnapshot{
		ChannelID: ability.ChannelID,
		Group:     ability.Group,
		Model:     ability.Model,
		Enabled:   ability.Enabled,
		Priority:  ability.Priority,
		Weight:    ability.Weight,
	}, costSignal)
	plan = moreConservativeDynamicPlan(plan, costPlan)
}
```

Add helpers:

```go
func moreConservativeDynamicPlan(a DynamicAdjustmentPlan, b DynamicAdjustmentPlan) DynamicAdjustmentPlan {
	if b.Action == DynamicActionNone {
		return a
	}
	if a.Action == DynamicActionNone {
		return b
	}
	if !b.AppliedEnabled && a.AppliedEnabled {
		return b
	}
	if b.AppliedWeight < a.AppliedWeight {
		return b
	}
	if b.AppliedPriority != nil && (a.AppliedPriority == nil || *b.AppliedPriority < *a.AppliedPriority) {
		return b
	}
	return a
}
```

Implement `loadRecentChannelCostSignals` by reading `channel_profit_snapshots` for the configured window and grouping by `channel_id + group + model`.

- [ ] **Step 6: Run tests**

Run:

```powershell
gofmt -w "C:\work\aiapi114\service\channel_dynamic_adjustment.go" "C:\work\aiapi114\service\channel_dynamic_adjustment_runner.go" "C:\work\aiapi114\service\channel_cost_dynamic_test.go" "C:\work\aiapi114\setting\operation_setting\channel_profit_setting.go" "C:\work\aiapi114\model\option.go"
go test ./service -run "TestClassifyChannelCostSignal|TestPlanCostDynamicAdjustment" -count=1
go test ./service -count=1
```

Expected: pass. Verify default `CostAdjustmentEnabled=false`, so production behavior is unchanged until explicitly enabled.

- [ ] **Step 7: Commit Task 5 only**

Run:

```powershell
git add -- "service\channel_dynamic_adjustment.go" "service\channel_dynamic_adjustment_runner.go" "service\channel_cost_dynamic_test.go" "setting\operation_setting\channel_profit_setting.go" "model\option.go"
git commit -m "feat: add cost-driven dynamic adjustment"
```

Expected: commit contains only the five files listed above.

---

## Task 6: Backend verification and API smoke testing

**Files:**

- No production file changes expected unless tests expose a defect.

- [ ] **Step 1: Run focused backend tests**

Run:

```powershell
go test ./model ./service ./controller ./router -count=1
```

Expected: pass.

- [ ] **Step 2: Run full backend test suite**

Run:

```powershell
go test ./... -count=1
```

Expected: pass. If frontend-generated files or unrelated existing tests fail, capture the exact failure and determine whether the failure predates these commits.

- [ ] **Step 3: Run a local API smoke test if the app can start with SQLite**

Run:

```powershell
$env:SQL_DSN="local"
$env:GIN_MODE="debug"
go run .
```

Expected: app starts without migration panic and logs that channel cost tables are migrated. Stop the process after startup verification.

- [ ] **Step 4: Commit only fixes caused by this task**

If fixes were required:

```powershell
git add -- "<fixed-file-1>" "<fixed-file-2>"
git commit -m "fix: stabilize channel profit backend"
```

If no fixes were required, do not create a commit.

---

## Task 7: Admin frontend for cost profiles and reports

**Files:**

- Create: `C:\work\aiapi114\web\default\src\features\channel-profit\api.ts`
- Create: `C:\work\aiapi114\web\default\src\features\channel-profit\types.ts`
- Create: `C:\work\aiapi114\web\default\src\features\channel-profit\index.tsx`
- Create: `C:\work\aiapi114\web\default\src\features\channel-profit\components\cost-profile-dialog.tsx`
- Create: `C:\work\aiapi114\web\default\src\features\channel-profit\components\profit-summary-cards.tsx`
- Create: `C:\work\aiapi114\web\default\src\features\channel-profit\components\profit-table.tsx`
- Modify: `C:\work\aiapi114\web\default\src\features\system-settings\operations\section-registry.tsx`
- Modify: `C:\work\aiapi114\web\default\src\features\system-settings\operations\index.tsx`

- [ ] **Step 1: Add TypeScript types**

Create `C:\work\aiapi114\web\default\src\features\channel-profit\types.ts`:

```ts
export type CostMode = 'token' | 'quota_ratio' | 'fixed' | 'hybrid'
export type Currency = 'USD' | 'CNY'

export interface ChannelCostProfile {
  id: number
  channel_id: number
  group: string
  model: string
  cost_mode: CostMode
  currency: Currency
  input_unit_price: string
  output_unit_price: string
  cache_read_unit_price: string
  cache_write_unit_price: string
  quota_cost_ratio: string
  fixed_cost: string
  effective_from: number
  effective_to: number
  enabled: boolean
  remark: string
  created_at: number
  updated_at: number
}

export interface ChannelProfitSnapshot {
  id: number
  bucket_start: number
  bucket_end: number
  channel_id: number
  group: string
  model: string
  request_count: number
  prompt_tokens: number
  completion_tokens: number
  quota: number
  revenue_usd: string
  cost_usd: string
  profit_usd: string
  margin_pct: string
  cost_profile_id: number
  cost_match_level: string
  calculated_at: number
}

export interface ListResponse<T> {
  success: boolean
  message: string
  data: T[]
  total: number
}
```

- [ ] **Step 2: Add API wrapper**

Create `C:\work\aiapi114\web\default\src\features\channel-profit\api.ts`:

```ts
import { API } from '@/utils/api'
import type { ChannelCostProfile, ChannelProfitSnapshot, ListResponse } from './types'

export async function listCostProfiles(params = {}) {
  const { data } = await API.get<ListResponse<ChannelCostProfile>>('/api/channel-profit/cost-profiles', { params })
  return data
}

export async function createCostProfile(payload: Partial<ChannelCostProfile>) {
  const { data } = await API.post('/api/channel-profit/cost-profiles', payload)
  return data
}

export async function updateCostProfile(payload: Partial<ChannelCostProfile>) {
  const { data } = await API.put('/api/channel-profit/cost-profiles', payload)
  return data
}

export async function deleteCostProfile(id: number) {
  const { data } = await API.delete('/api/channel-profit/cost-profiles', { params: { id } })
  return data
}

export async function listProfitSnapshots(params = {}) {
  const { data } = await API.get<ListResponse<ChannelProfitSnapshot>>('/api/channel-profit/snapshots', { params })
  return data
}
```

If the project uses a different shared API helper, match the pattern in `C:\work\aiapi114\web\default\src\features\channels\api.ts`.

- [ ] **Step 3: Add summary cards**

Create `C:\work\aiapi114\web\default\src\features\channel-profit\components\profit-summary-cards.tsx`:

```tsx
import type { ChannelProfitSnapshot } from '../types'

function sumDecimal(rows: ChannelProfitSnapshot[], key: 'revenue_usd' | 'cost_usd' | 'profit_usd') {
  return rows.reduce((total, row) => total + Number(row[key] || 0), 0)
}

export function ProfitSummaryCards({ rows }: { rows: ChannelProfitSnapshot[] }) {
  const revenue = sumDecimal(rows, 'revenue_usd')
  const cost = sumDecimal(rows, 'cost_usd')
  const profit = sumDecimal(rows, 'profit_usd')
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0

  return (
    <div className='grid gap-4 md:grid-cols-4'>
      <div className='rounded-lg border p-4'>
        <div className='text-sm text-muted-foreground'>收入</div>
        <div className='text-2xl font-semibold'>${revenue.toFixed(2)}</div>
      </div>
      <div className='rounded-lg border p-4'>
        <div className='text-sm text-muted-foreground'>成本</div>
        <div className='text-2xl font-semibold'>${cost.toFixed(2)}</div>
      </div>
      <div className='rounded-lg border p-4'>
        <div className='text-sm text-muted-foreground'>利润</div>
        <div className='text-2xl font-semibold'>${profit.toFixed(2)}</div>
      </div>
      <div className='rounded-lg border p-4'>
        <div className='text-sm text-muted-foreground'>利润率</div>
        <div className='text-2xl font-semibold'>{margin.toFixed(1)}%</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Add snapshot table**

Create `C:\work\aiapi114\web\default\src\features\channel-profit\components\profit-table.tsx`:

```tsx
import type { ChannelProfitSnapshot } from '../types'

export function ProfitTable({ rows }: { rows: ChannelProfitSnapshot[] }) {
  return (
    <div className='overflow-x-auto rounded-lg border'>
      <table className='w-full text-sm'>
        <thead className='bg-muted/50 text-left'>
          <tr>
            <th className='p-3'>渠道</th>
            <th className='p-3'>分组</th>
            <th className='p-3'>模型</th>
            <th className='p-3 text-right'>请求</th>
            <th className='p-3 text-right'>收入</th>
            <th className='p-3 text-right'>成本</th>
            <th className='p-3 text-right'>利润</th>
            <th className='p-3 text-right'>利润率</th>
            <th className='p-3'>成本匹配</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className='border-t'>
              <td className='p-3'>{row.channel_id}</td>
              <td className='p-3'>{row.group || '默认'}</td>
              <td className='p-3'>{row.model}</td>
              <td className='p-3 text-right'>{row.request_count}</td>
              <td className='p-3 text-right'>${Number(row.revenue_usd).toFixed(2)}</td>
              <td className='p-3 text-right'>${Number(row.cost_usd).toFixed(2)}</td>
              <td className='p-3 text-right'>${Number(row.profit_usd).toFixed(2)}</td>
              <td className='p-3 text-right'>{Number(row.margin_pct).toFixed(1)}%</td>
              <td className='p-3'>{row.cost_match_level}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 5: Add cost profile dialog**

Create `C:\work\aiapi114\web\default\src\features\channel-profit\components\cost-profile-dialog.tsx` with a minimal controlled form:

```tsx
import { useState } from 'react'
import type { ChannelCostProfile } from '../types'

const emptyProfile: Partial<ChannelCostProfile> = {
  channel_id: 0,
  group: '',
  model: '',
  cost_mode: 'token',
  currency: 'USD',
  input_unit_price: '0',
  output_unit_price: '0',
  quota_cost_ratio: '0',
  fixed_cost: '0',
  effective_from: 0,
  effective_to: 0,
  enabled: true,
  remark: '',
}

export function CostProfileDialog({ onSubmit }: { onSubmit: (profile: Partial<ChannelCostProfile>) => Promise<void> }) {
  const [profile, setProfile] = useState<Partial<ChannelCostProfile>>(emptyProfile)

  return (
    <form
      className='grid gap-3 rounded-lg border p-4'
      onSubmit={(event) => {
        event.preventDefault()
        void onSubmit(profile)
      }}
    >
      <div className='grid gap-2 md:grid-cols-3'>
        <input className='rounded border px-3 py-2' placeholder='渠道 ID' type='number' value={profile.channel_id || ''} onChange={(event) => setProfile({ ...profile, channel_id: Number(event.target.value) })} />
        <input className='rounded border px-3 py-2' placeholder='分组，空为默认' value={profile.group || ''} onChange={(event) => setProfile({ ...profile, group: event.target.value })} />
        <input className='rounded border px-3 py-2' placeholder='模型，空为渠道默认' value={profile.model || ''} onChange={(event) => setProfile({ ...profile, model: event.target.value })} />
        <input className='rounded border px-3 py-2' placeholder='输入单价' value={profile.input_unit_price || '0'} onChange={(event) => setProfile({ ...profile, input_unit_price: event.target.value })} />
        <input className='rounded border px-3 py-2' placeholder='输出单价' value={profile.output_unit_price || '0'} onChange={(event) => setProfile({ ...profile, output_unit_price: event.target.value })} />
        <input className='rounded border px-3 py-2' placeholder='成本比例' value={profile.quota_cost_ratio || '0'} onChange={(event) => setProfile({ ...profile, quota_cost_ratio: event.target.value })} />
      </div>
      <button className='w-fit rounded bg-primary px-4 py-2 text-primary-foreground' type='submit'>保存成本配置</button>
    </form>
  )
}
```

Replace plain controls with project UI components if existing channel forms already expose shared inputs.

- [ ] **Step 6: Add page composition**

Create `C:\work\aiapi114\web\default\src\features\channel-profit\index.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { createCostProfile, listProfitSnapshots } from './api'
import { CostProfileDialog } from './components/cost-profile-dialog'
import { ProfitSummaryCards } from './components/profit-summary-cards'
import { ProfitTable } from './components/profit-table'
import type { ChannelProfitSnapshot } from './types'

export function ChannelProfitPage() {
  const [rows, setRows] = useState<ChannelProfitSnapshot[]>([])

  async function reload() {
    const result = await listProfitSnapshots({ limit: 100 })
    setRows(result.data)
  }

  useEffect(() => {
    void reload()
  }, [])

  return (
    <div className='space-y-6'>
      <div>
        <h2 className='text-2xl font-semibold tracking-tight'>渠道成本与盈利</h2>
        <p className='text-sm text-muted-foreground'>录入渠道成本，查看收入、成本、利润，并为动态调度提供成本信号。</p>
      </div>
      <CostProfileDialog
        onSubmit={async (profile) => {
          await createCostProfile(profile)
          await reload()
        }}
      />
      <ProfitSummaryCards rows={rows} />
      <ProfitTable rows={rows} />
    </div>
  )
}
```

- [ ] **Step 7: Wire the page into operations settings**

Modify `C:\work\aiapi114\web\default\src\features\system-settings\operations\section-registry.tsx` and `index.tsx` following the pattern used by `dynamic-adjustment-section.tsx`. Add a section entry named “渠道成本与盈利” that renders `ChannelProfitPage`.

- [ ] **Step 8: Run frontend checks**

Run:

```powershell
Set-Location "C:\work\aiapi114\web\default"
npm run lint
npm run typecheck
npm run build
```

Expected: all pass.

- [ ] **Step 9: Commit Task 7 only**

Run:

```powershell
git add -- "web\default\src\features\channel-profit" "web\default\src\features\system-settings\operations\section-registry.tsx" "web\default\src\features\system-settings\operations\index.tsx"
git commit -m "feat: add channel profit admin UI"
```

Expected: commit contains only frontend files listed above.

---

## Task 8: End-to-end verification

**Files:**

- No production file changes expected unless verification exposes a defect.

- [ ] **Step 1: Run backend tests**

Run:

```powershell
go test ./... -count=1
```

Expected: pass.

- [ ] **Step 2: Run frontend checks**

Run:

```powershell
Set-Location "C:\work\aiapi114\web\default"
npm run lint
npm run typecheck
npm run build
```

Expected: pass.

- [ ] **Step 3: Start local app**

Run:

```powershell
Set-Location "C:\work\aiapi114"
$env:SQL_DSN="local"
$env:GIN_MODE="debug"
go run .
```

Expected: app starts and migrations complete. Keep it running for browser verification.

- [ ] **Step 4: Verify in browser**

Open the local app in the Codex in-app browser at the configured port. Verify:

- Admin can open the operations settings page.
- “渠道成本与盈利” section renders.
- Empty report state is readable.
- Cost profile form rejects invalid input through the backend.
- After inserting a valid cost profile, the profile appears through the API.

- [ ] **Step 5: Record final verification**

Create a short verification note in the final response with:

- backend test command result,
- frontend lint/typecheck/build result,
- browser verification result,
- any known limitations.

- [ ] **Step 6: Commit verification fixes only**

If fixes were required:

```powershell
git add -- "<fixed-file-1>" "<fixed-file-2>"
git commit -m "fix: complete channel profit verification"
```

If no fixes were required, do not create a commit.

---

## Rollout notes

Default runtime behavior must remain conservative:

- Cost adjustment is disabled by default.
- Dynamic adjustment remains dry-run unless an administrator explicitly disables dry-run.
- Unknown cost never increases priority or weight.
- Report generation failures do not affect request handling.
- Cost profile CRUD requires admin authentication.

## Final acceptance checklist

- [ ] `channel_cost_profiles` migrates successfully.
- [ ] `channel_profit_snapshots` migrates successfully.
- [ ] Cost profile validation rejects invalid time ranges and negative values.
- [ ] Cost matching uses exact, channel-model, channel-group, channel-default, unmatched order.
- [ ] Profit snapshots calculate revenue, cost, profit, and margin correctly.
- [ ] Report APIs return paginated data.
- [ ] Cost signal can reduce weight and priority.
- [ ] Cost signal is disabled by default.
- [ ] Existing health-based dynamic adjustment tests still pass.
- [ ] Frontend admin page can create cost profiles and display profit rows.
- [ ] Full backend and frontend verification passes before reporting completion.
