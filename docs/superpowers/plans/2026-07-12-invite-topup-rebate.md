# Invite Top-up Rebate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When an invitee successfully tops up, credit the inviter a configurable share (default 1%) of credited quota into existing `aff_quota`, with an auditable ledger and dedicated user/admin pages on both frontends.

**Architecture:** New `invite_rebates` ledger + `GrantInviteTopupRebate` helper in isolated files; thin one-line hooks on each successful recharge path; REST under `/api/user/invite_rebate/*` and `/api/invite_rebate/*`; extract reuses `aff_transfer`. Defaults keep the feature off after upstream merges.

**Tech Stack:** Go + Gin + GORM, React (default TanStack Router / classic React Router + Semi UI), existing Option system, testify.

**Spec:** `docs/superpowers/specs/2026-07-12-invite-topup-rebate-design.md`

## Global Constraints

- **Merge-first:** put logic in new files; touch upstream hot paths only with tiny hooks (AutoMigrate line, option cases, router lines, one grant call per recharge path, append-only settings fields).
- **Default off:** `InviteTopupRebateEnabled=false`, `InviteTopupRebateRatioBp=100` (1%).
- **Credit target:** existing `aff_quota` / `aff_history_quota`; transfer only via existing `POST /api/user/aff_transfer`.
- **Base amount:** integer **credited quota** actually added to the invitee on that path.
- **Idempotency:** unique `topup_id` on `invite_rebates`.
- **Never roll back** a successful user top-up if rebate grant fails after credit; log and continue.
- **Themes:** implement both `web/default` and `web/classic`.
- **YAGNI:** no multi-level referral, no CSV export, no separate rebate wallet, no auto-balance credit.

## File map

| Path | Role |
|------|------|
| Create `model/invite_rebate.go` | Struct, grant, queries |
| Create `model/invite_rebate_test.go` | Unit tests for formula/grant/idempotency |
| Modify `common/constants.go` | Option vars |
| Modify `model/option.go` | Init + updateOptionMap cases |
| Modify `model/main.go` | AutoMigrate `&InviteRebate{}` |
| Modify `model/topup.go` | Grant hooks in Recharge* / ManualCompleteTopUp |
| Modify `controller/topup.go` | Epay success grant hook |
| Create `controller/invite_rebate.go` | User/admin HTTP handlers |
| Modify `router/api-router.go` | Routes |
| Create `web/default/src/features/invite-rebate/**` | User + admin UI module |
| Create `web/default/src/routes/_authenticated/invite-rebate/index.tsx` | User route |
| Create `web/default/src/routes/_authenticated/invite-rebate/admin.tsx` (or `admin/index.tsx`) | Admin route |
| Modify sidebar + quota settings + optional wallet link | Navigation/settings |
| Create `web/classic/src/pages/InviteRebate/**` | Classic pages |
| Modify `web/classic/src/App.jsx` | Routes |
| Modify classic settings credit limit | Options UI |

---

### Task 1: Options + ledger model + grant unit tests

**Files:**
- Create: `model/invite_rebate.go`
- Create: `model/invite_rebate_test.go`
- Modify: `common/constants.go` (near `QuotaForInviter`)
- Modify: `model/option.go` (OptionMap init + `updateOptionMap`)
- Modify: `model/main.go` (`AutoMigrate` list)
- Test: `model/invite_rebate_test.go`

**Interfaces:**
- Produces:
  - `common.InviteTopupRebateEnabled bool` (default false)
  - `common.InviteTopupRebateRatioBp int` (default 100)
  - `type InviteRebate struct { ... }`
  - `func CalculateInviteTopupRebate(topupQuota int, ratioBp int) int`
  - `func GrantInviteTopupRebate(tx *gorm.DB, inviteeId int, topupQuota int, topUp *TopUp) error`
  - Query helpers used by Task 3 (implement now):
    - `func GetInviteRebateSummaryForInviter(inviterId int) (inviteeCount int64, topupQuotaSum int64, rebateQuotaSum int64, err error)`
    - `func ListInviteRebatesForInviter(inviterId int, pageInfo *common.PageInfo) (items []*InviteRebate, total int64, err error)`
    - `func ListInviteesWithRebateStats(inviterId int, pageInfo *common.PageInfo) (items []InviteeRebateStat, total int64, err error)`
    - `func ListAllInviteRebates(inviterId, inviteeId int, start, end int64, pageInfo *common.PageInfo) (items []*InviteRebate, total int64, err error)`
    - `func GetInviteRebateAdminSummary(inviterId int) (topupQuotaSum int64, rebateQuotaSum int64, rowCount int64, err error)`
  - `type InviteeRebateStat struct { InviteeId int; Username string; DisplayName string; TopupQuotaSum int64; RebateQuotaSum int64; RebateCount int64 }`

- [ ] **Step 1: Add common option variables**

In `common/constants.go` immediately after `QuotaForInvitee`:

```go
// Invite top-up rebate (invitee top-up → inviter aff_quota). Default off for safe merges.
var InviteTopupRebateEnabled = false
var InviteTopupRebateRatioBp = 100 // 100 basis points = 1.00%
```

- [ ] **Step 2: Wire OptionMap init + update**

In `model/option.go` `InitOptionMap` (near QuotaForInvitee entries):

```go
common.OptionMap["InviteTopupRebateEnabled"] = strconv.FormatBool(common.InviteTopupRebateEnabled)
common.OptionMap["InviteTopupRebateRatioBp"] = strconv.Itoa(common.InviteTopupRebateRatioBp)
```

In `updateOptionMap`, inside the `strings.HasSuffix(key, "Enabled")` switch, add:

```go
case "InviteTopupRebateEnabled":
	common.InviteTopupRebateEnabled = boolValue
```

In the int cases near `QuotaForInvitee`, add:

```go
case "InviteTopupRebateRatioBp":
	if v, err := strconv.Atoi(value); err == nil {
		if v < 0 {
			v = 0
		}
		// hard cap 100% to avoid misconfig disasters
		if v > 10000 {
			v = 10000
		}
		common.InviteTopupRebateRatioBp = v
	}
```

- [ ] **Step 3: Write failing tests first**

Create `model/invite_rebate_test.go`:

```go
package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupInviteRebateTest(t *testing.T) {
	t.Helper()
	require.NotNil(t, DB, "package TestMain must initialize DB")
	require.NoError(t, DB.AutoMigrate(&User{}, &TopUp{}, &InviteRebate{}))
	require.NoError(t, DB.Where("1 = 1").Delete(&InviteRebate{}).Error)
	// clean users/topups created by this test package prefix
	require.NoError(t, DB.Where("username LIKE ?", "ir_%").Delete(&User{}).Error)
	require.NoError(t, DB.Where("trade_no LIKE ?", "IR-%").Delete(&TopUp{}).Error)

	oldEnabled := common.InviteTopupRebateEnabled
	oldRatio := common.InviteTopupRebateRatioBp
	common.InviteTopupRebateEnabled = true
	common.InviteTopupRebateRatioBp = 100
	t.Cleanup(func() {
		common.InviteTopupRebateEnabled = oldEnabled
		common.InviteTopupRebateRatioBp = oldRatio
	})
}

func TestCalculateInviteTopupRebate(t *testing.T) {
	assert.Equal(t, 0, CalculateInviteTopupRebate(0, 100))
	assert.Equal(t, 0, CalculateInviteTopupRebate(50, 100)) // 50*100/10000 = 0
	assert.Equal(t, 5, CalculateInviteTopupRebate(500, 100))
	assert.Equal(t, 50, CalculateInviteTopupRebate(500000, 100))
	assert.Equal(t, 0, CalculateInviteTopupRebate(500000, 0))
	assert.Equal(t, 0, CalculateInviteTopupRebate(-1, 100))
}

func TestGrantInviteTopupRebate_DisabledNoOp(t *testing.T) {
	setupInviteRebateTest(t)
	common.InviteTopupRebateEnabled = false

	inviter := &User{Username: "ir_inviter_off", Status: common.UserStatusEnabled, Quota: 0}
	require.NoError(t, DB.Create(inviter).Error)
	invitee := &User{Username: "ir_invitee_off", Status: common.UserStatusEnabled, InviterId: inviter.Id, Quota: 0}
	require.NoError(t, DB.Create(invitee).Error)
	topUp := &TopUp{UserId: invitee.Id, Amount: 10, Money: 10, TradeNo: "IR-OFF-1", Status: common.TopUpStatusSuccess}
	require.NoError(t, DB.Create(topUp).Error)

	require.NoError(t, GrantInviteTopupRebate(nil, invitee.Id, 500000, topUp))
	var n int64
	require.NoError(t, DB.Model(&InviteRebate{}).Count(&n).Error)
	assert.Equal(t, int64(0), n)
}

func TestGrantInviteTopupRebate_NoInviter(t *testing.T) {
	setupInviteRebateTest(t)
	invitee := &User{Username: "ir_invitee_none", Status: common.UserStatusEnabled, InviterId: 0}
	require.NoError(t, DB.Create(invitee).Error)
	topUp := &TopUp{UserId: invitee.Id, Amount: 10, TradeNo: "IR-NONE-1", Status: common.TopUpStatusSuccess}
	require.NoError(t, DB.Create(topUp).Error)
	require.NoError(t, GrantInviteTopupRebate(nil, invitee.Id, 500000, topUp))
	var n int64
	require.NoError(t, DB.Model(&InviteRebate{}).Count(&n).Error)
	assert.Equal(t, int64(0), n)
}

func TestGrantInviteTopupRebate_SuccessAndIdempotent(t *testing.T) {
	setupInviteRebateTest(t)
	inviter := &User{Username: "ir_inviter_ok", Status: common.UserStatusEnabled, AffQuota: 0, AffHistoryQuota: 0}
	require.NoError(t, DB.Create(inviter).Error)
	invitee := &User{Username: "ir_invitee_ok", Status: common.UserStatusEnabled, InviterId: inviter.Id}
	require.NoError(t, DB.Create(invitee).Error)
	topUp := &TopUp{UserId: invitee.Id, Amount: 10, TradeNo: "IR-OK-1", Status: common.TopUpStatusSuccess}
	require.NoError(t, DB.Create(topUp).Error)

	// 500000 * 1% = 5000
	require.NoError(t, GrantInviteTopupRebate(nil, invitee.Id, 500000, topUp))
	require.NoError(t, GrantInviteTopupRebate(nil, invitee.Id, 500000, topUp)) // retry

	var n int64
	require.NoError(t, DB.Model(&InviteRebate{}).Where("topup_id = ?", topUp.Id).Count(&n).Error)
	assert.Equal(t, int64(1), n)

	var got User
	require.NoError(t, DB.First(&got, inviter.Id).Error)
	assert.Equal(t, 5000, got.AffQuota)
	assert.Equal(t, 5000, got.AffHistoryQuota)
}
```

- [ ] **Step 4: Run tests — expect compile/fail**

```bash
go test ./model -run 'TestCalculateInviteTopupRebate|TestGrantInviteTopupRebate' -count=1
```

Expected: FAIL (undefined types/functions).

- [ ] **Step 5: Implement `model/invite_rebate.go`**

```go
package model

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"gorm.io/gorm"
)

const InviteRebateStatusGranted = "granted"

type InviteRebate struct {
	Id          int    `json:"id" gorm:"primaryKey;autoIncrement"`
	InviterId   int    `json:"inviter_id" gorm:"index;not null"`
	InviteeId   int    `json:"invitee_id" gorm:"index;not null"`
	TopupId     int    `json:"topup_id" gorm:"uniqueIndex;not null"`
	TradeNo     string `json:"trade_no" gorm:"type:varchar(255);index"`
	TopupQuota  int    `json:"topup_quota" gorm:"not null"`
	RebateQuota int    `json:"rebate_quota" gorm:"not null"`
	RatioBp     int    `json:"ratio_bp" gorm:"not null"`
	Status      string `json:"status" gorm:"type:varchar(32);not null;default:'granted'"`
	CreatedAt   int64  `json:"created_at" gorm:"bigint"`
}

func (InviteRebate) TableName() string { return "invite_rebates" }

type InviteeRebateStat struct {
	InviteeId      int    `json:"invitee_id"`
	Username       string `json:"username"`
	DisplayName    string `json:"display_name"`
	TopupQuotaSum  int64  `json:"topup_quota_sum"`
	RebateQuotaSum int64  `json:"rebate_quota_sum"`
	RebateCount    int64  `json:"rebate_count"`
}

func CalculateInviteTopupRebate(topupQuota int, ratioBp int) int {
	if topupQuota <= 0 || ratioBp <= 0 {
		return 0
	}
	return topupQuota * ratioBp / 10000
}

func isDuplicateKeyError(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "duplicate") ||
		strings.Contains(msg, "unique constraint") ||
		strings.Contains(msg, "unique_violation") ||
		strings.Contains(msg, "constraint failed")
}

// GrantInviteTopupRebate credits inviter aff_quota for one successful top-up.
// tx may be nil (uses DB). Idempotent on topup_id.
func GrantInviteTopupRebate(tx *gorm.DB, inviteeId int, topupQuota int, topUp *TopUp) error {
	if !common.InviteTopupRebateEnabled {
		return nil
	}
	if topupQuota <= 0 || topUp == nil || topUp.Id == 0 {
		return nil
	}
	db := tx
	if db == nil {
		db = DB
	}

	ratioBp := common.InviteTopupRebateRatioBp
	rebate := CalculateInviteTopupRebate(topupQuota, ratioBp)
	if rebate <= 0 {
		return nil
	}

	var invitee User
	if err := db.Select("id", "inviter_id").First(&invitee, inviteeId).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		return err
	}
	if invitee.InviterId <= 0 || invitee.InviterId == inviteeId {
		return nil
	}

	run := func(tx *gorm.DB) error {
		row := &InviteRebate{
			InviterId:   invitee.InviterId,
			InviteeId:   inviteeId,
			TopupId:     topUp.Id,
			TradeNo:     topUp.TradeNo,
			TopupQuota:  topupQuota,
			RebateQuota: rebate,
			RatioBp:     ratioBp,
			Status:      InviteRebateStatusGranted,
			CreatedAt:   common.GetTimestamp(),
		}
		if err := tx.Create(row).Error; err != nil {
			if isDuplicateKeyError(err) {
				return nil
			}
			return err
		}
		if err := tx.Model(&User{}).Where("id = ?", invitee.InviterId).Updates(map[string]interface{}{
			"aff_quota":   gorm.Expr("aff_quota + ?", rebate),
			"aff_history": gorm.Expr("aff_history + ?", rebate),
		}).Error; err != nil {
			return err
		}
		return nil
	}

	var err error
	if tx != nil {
		err = run(tx)
	} else {
		err = DB.Transaction(run)
	}
	if err != nil {
		return err
	}

	// Log outside caller concerns; ignore log failures
	RecordLog(invitee.InviterId, LogTypeSystem, fmt.Sprintf(
		"邀请充值返佣 %s（被邀请用户 #%d，订单 %s，基数 %s，比例 %d bp）",
		logger.LogQuota(rebate), inviteeId, topUp.TradeNo, logger.LogQuota(topupQuota), ratioBp,
	))
	return nil
}

func GetInviteRebateSummaryForInviter(inviterId int) (inviteeCount int64, topupQuotaSum int64, rebateQuotaSum int64, err error) {
	err = DB.Model(&User{}).Where("inviter_id = ?", inviterId).Count(&inviteeCount).Error
	if err != nil {
		return
	}
	type sumRow struct {
		TopupQuotaSum  int64
		RebateQuotaSum int64
	}
	var s sumRow
	err = DB.Model(&InviteRebate{}).
		Select("COALESCE(SUM(topup_quota),0) as topup_quota_sum, COALESCE(SUM(rebate_quota),0) as rebate_quota_sum").
		Where("inviter_id = ?", inviterId).
		Scan(&s).Error
	topupQuotaSum = s.TopupQuotaSum
	rebateQuotaSum = s.RebateQuotaSum
	return
}

func ListInviteRebatesForInviter(inviterId int, pageInfo *common.PageInfo) (items []*InviteRebate, total int64, err error) {
	q := DB.Model(&InviteRebate{}).Where("inviter_id = ?", inviterId)
	if err = q.Count(&total).Error; err != nil {
		return
	}
	err = q.Order("id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&items).Error
	return
}

func ListInviteesWithRebateStats(inviterId int, pageInfo *common.PageInfo) (items []InviteeRebateStat, total int64, err error) {
	if err = DB.Model(&User{}).Where("inviter_id = ?", inviterId).Count(&total).Error; err != nil {
		return
	}
	// Page invitees, then attach aggregates
	var users []User
	err = DB.Select("id", "username", "display_name").
		Where("inviter_id = ?", inviterId).
		Order("id desc").
		Limit(pageInfo.GetPageSize()).
		Offset(pageInfo.GetStartIdx()).
		Find(&users).Error
	if err != nil {
		return
	}
	items = make([]InviteeRebateStat, 0, len(users))
	for _, u := range users {
		stat := InviteeRebateStat{InviteeId: u.Id, Username: u.Username, DisplayName: u.DisplayName}
		type sumRow struct {
			TopupQuotaSum  int64
			RebateQuotaSum int64
			RebateCount    int64
		}
		var s sumRow
		_ = DB.Model(&InviteRebate{}).
			Select("COALESCE(SUM(topup_quota),0) as topup_quota_sum, COALESCE(SUM(rebate_quota),0) as rebate_quota_sum, COUNT(*) as rebate_count").
			Where("inviter_id = ? AND invitee_id = ?", inviterId, u.Id).
			Scan(&s).Error
		stat.TopupQuotaSum = s.TopupQuotaSum
		stat.RebateQuotaSum = s.RebateQuotaSum
		stat.RebateCount = s.RebateCount
		items = append(items, stat)
	}
	return
}

func ListAllInviteRebates(inviterId, inviteeId int, start, end int64, pageInfo *common.PageInfo) (items []*InviteRebate, total int64, err error) {
	q := DB.Model(&InviteRebate{})
	if inviterId > 0 {
		q = q.Where("inviter_id = ?", inviterId)
	}
	if inviteeId > 0 {
		q = q.Where("invitee_id = ?", inviteeId)
	}
	if start > 0 {
		q = q.Where("created_at >= ?", start)
	}
	if end > 0 {
		q = q.Where("created_at <= ?", end)
	}
	if err = q.Count(&total).Error; err != nil {
		return
	}
	err = q.Order("id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&items).Error
	return
}

func GetInviteRebateAdminSummary(inviterId int) (topupQuotaSum int64, rebateQuotaSum int64, rowCount int64, err error) {
	q := DB.Model(&InviteRebate{})
	if inviterId > 0 {
		q = q.Where("inviter_id = ?", inviterId)
	}
	if err = q.Count(&rowCount).Error; err != nil {
		return
	}
	type sumRow struct {
		TopupQuotaSum  int64
		RebateQuotaSum int64
	}
	var s sumRow
	sq := DB.Model(&InviteRebate{}).
		Select("COALESCE(SUM(topup_quota),0) as topup_quota_sum, COALESCE(SUM(rebate_quota),0) as rebate_quota_sum")
	if inviterId > 0 {
		sq = sq.Where("inviter_id = ?", inviterId)
	}
	err = sq.Scan(&s).Error
	topupQuotaSum = s.TopupQuotaSum
	rebateQuotaSum = s.RebateQuotaSum
	return
}
```

Note: User column for history is `aff_history` per `AffHistoryQuota` gorm tag `column:aff_history`.

- [ ] **Step 6: Register AutoMigrate**

In `model/main.go` AutoMigrate list, after `&TopUp{},`:

```go
&InviteRebate{},
```

Also add `&InviteRebate{}` to any parallel migrate list in the same file if present (`migrateDBFast`).

- [ ] **Step 7: Run tests — expect pass**

```bash
go test ./model -run 'TestCalculateInviteTopupRebate|TestGrantInviteTopupRebate' -count=1
```

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add common/constants.go model/option.go model/main.go model/invite_rebate.go model/invite_rebate_test.go
git commit -m "feat: add invite top-up rebate ledger and grant helper"
```

---

### Task 2: Thin recharge hooks

**Files:**
- Modify: `model/topup.go` (`Recharge`, `RechargeCreem`, `ManualCompleteTopUp`, `RechargeWaffo`, `RechargeWaffoPancake`)
- Modify: `controller/topup.go` (epay success branch)

**Interfaces:**
- Consumes: `GrantInviteTopupRebate(tx *gorm.DB, inviteeId int, topupQuota int, topUp *TopUp) error`
- Produces: rebate attempted on every successful paid top-up path listed in the spec

**Rule for each path:** after user quota is increased and `topUp` is success with known integer credited amount, call grant. Prefer **inside** the same transaction when the path already has `tx`. On grant error inside tx, return err so the whole top-up rolls back only if still in tx **before** commit — **except** for paths that already committed user credit outside a shared transaction (epay): call after credit and only log on error.

- [ ] **Step 1: Stripe `Recharge` (transaction)**

Inside the transaction, after quota update succeeds, before `return nil`:

```go
quotaToAdd := int(quota)
if err := GrantInviteTopupRebate(tx, topUp.UserId, quotaToAdd, topUp); err != nil {
	return err
}
```

(Keep existing `quota` float64 variable; cast to int for grant base.)

- [ ] **Step 2: `RechargeCreem`**

After user quota update in tx, before return nil:

```go
if err := GrantInviteTopupRebate(tx, topUp.UserId, int(quota), topUp); err != nil {
	return err
}
```

- [ ] **Step 3: `ManualCompleteTopUp`**

Inside tx after quota update, capture `topUp` pointer still in scope:

```go
if err := GrantInviteTopupRebate(tx, topUp.UserId, quotaToAdd, topUp); err != nil {
	return err
}
```

Note: early success idempotent return (already success) must **not** re-grant (unique would no-op anyway; skip is fine).

- [ ] **Step 4: `RechargeWaffo` / `RechargeWaffoPancake`**

Inside each tx after quota update:

```go
if err := GrantInviteTopupRebate(tx, topUp.UserId, quotaToAdd, topUp); err != nil {
	return err
}
```

- [ ] **Step 5: Epay in `controller/topup.go`**

After successful `IncreaseUserQuota` and before/after `RecordTopupLog`, **outside** multi-table tx:

```go
if grantErr := model.GrantInviteTopupRebate(nil, topUp.UserId, quotaToAdd, topUp); grantErr != nil {
	logger.LogError(c.Request.Context(), fmt.Sprintf(
		"邀请充值返佣失败 trade_no=%s user_id=%d quota_to_add=%d error=%q",
		topUp.TradeNo, topUp.UserId, quotaToAdd, grantErr.Error(),
	))
}
```

Do not return/fail the epay callback solely for rebate failure.

- [ ] **Step 6: Compile**

```bash
go test ./model ./controller -count=0
```

Expected: build success (or package compile clean).

- [ ] **Step 7: Commit**

```bash
git add model/topup.go controller/topup.go
git commit -m "feat: grant invite top-up rebate on successful recharge paths"
```

---

### Task 3: HTTP API + routes

**Files:**
- Create: `controller/invite_rebate.go`
- Modify: `router/api-router.go`

**Interfaces:**
- Consumes: model query helpers from Task 1; `c.GetInt("id")` user id; `common.GetPageQuery`
- Produces endpoints in spec §7

- [ ] **Step 1: Implement controller**

Create `controller/invite_rebate.go`:

```go
package controller

import (
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

func GetSelfInviteRebateSummary(c *gin.Context) {
	userId := c.GetInt("id")
	inviteeCount, topupSum, rebateSum, err := model.GetInviteRebateSummaryForInviter(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	user, err := model.GetUserById(userId, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"invitee_count":     inviteeCount,
		"topup_quota_sum":   topupSum,
		"rebate_quota_sum":  rebateSum,
		"aff_quota":         user.AffQuota,
		"aff_history_quota": user.AffHistoryQuota,
		"enabled":           common.InviteTopupRebateEnabled,
		"ratio_bp":          common.InviteTopupRebateRatioBp,
	})
}

func GetSelfInviteRebateLogs(c *gin.Context) {
	userId := c.GetInt("id")
	pageInfo := common.GetPageQuery(c)
	items, total, err := model.ListInviteRebatesForInviter(userId, pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

func GetSelfInviteRebateInvitees(c *gin.Context) {
	userId := c.GetInt("id")
	pageInfo := common.GetPageQuery(c)
	items, total, err := model.ListInviteesWithRebateStats(userId, pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

func GetAdminInviteRebates(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	inviterId, _ := strconv.Atoi(c.Query("inviter_id"))
	inviteeId, _ := strconv.Atoi(c.Query("invitee_id"))
	start, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	end, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	items, total, err := model.ListAllInviteRebates(inviterId, inviteeId, start, end, pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

func GetAdminInviteRebateSummary(c *gin.Context) {
	inviterId, _ := strconv.Atoi(c.Query("inviter_id"))
	topupSum, rebateSum, rowCount, err := model.GetInviteRebateAdminSummary(inviterId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"topup_quota_sum":  topupSum,
		"rebate_quota_sum": rebateSum,
		"row_count":        rowCount,
		"enabled":          common.InviteTopupRebateEnabled,
		"ratio_bp":         common.InviteTopupRebateRatioBp,
	})
}
```

- [ ] **Step 2: Register routes**

In `router/api-router.go` inside `selfRoute` (near aff routes):

```go
selfRoute.GET("/invite_rebate/summary", controller.GetSelfInviteRebateSummary)
selfRoute.GET("/invite_rebate/logs", controller.GetSelfInviteRebateLogs)
selfRoute.GET("/invite_rebate/invitees", controller.GetSelfInviteRebateInvitees)
```

Add admin group (near other admin routes, e.g. after user admin block or standalone):

```go
inviteRebateAdminRoute := apiRouter.Group("/invite_rebate")
inviteRebateAdminRoute.Use(middleware.AdminAuth())
{
	inviteRebateAdminRoute.GET("/", controller.GetAdminInviteRebates)
	inviteRebateAdminRoute.GET("/summary", controller.GetAdminInviteRebateSummary)
}
```

- [ ] **Step 3: Build**

```bash
go build -o /tmp/new-api-test .
```

Expected: success.

- [ ] **Step 4: Commit**

```bash
git add controller/invite_rebate.go router/api-router.go
git commit -m "feat: add invite rebate user and admin APIs"
```

---

### Task 4: Default theme — user page + nav + wallet link

**Files:**
- Create: `web/default/src/features/invite-rebate/api.ts`
- Create: `web/default/src/features/invite-rebate/types.ts`
- Create: `web/default/src/features/invite-rebate/hooks/use-invite-rebate.ts`
- Create: `web/default/src/features/invite-rebate/index.tsx` (user page)
- Create: `web/default/src/routes/_authenticated/invite-rebate/index.tsx`
- Modify: `web/default/src/hooks/use-sidebar-data.ts` (Personal items)
- Modify: `web/default/src/hooks/use-sidebar-config.ts` (route→module map; reuse `personal/topup` or add `invite_rebate` under personal defaulting enabled)
- Modify: `web/default/src/features/wallet/components/affiliate-rewards-card.tsx` (optional one-line link)
- After route file add, run route codegen if project uses generated tree (`bun run` script in `web/default` — check `package.json` for `tsr` / `generate`)

**Interfaces:**
- Consumes:  
  - `GET /api/user/invite_rebate/summary|logs|invitees`  
  - existing transfer: `transferAffiliateQuota` from wallet api or re-export  
- Produces: page at `/invite-rebate`

- [ ] **Step 1: API + types**

`types.ts` — mirror backend fields (`invitee_count`, `topup_quota_sum`, `rebate_quota_sum`, `aff_quota`, log rows, invitee stats).

`api.ts`:

```ts
import { api } from '@/lib/api' // use the same axios/fetch helper other features use

export async function fetchInviteRebateSummary() {
  const res = await api.get('/api/user/invite_rebate/summary')
  return res.data
}
// similarly logs? p=&page_size=, invitees
```

Follow exact import style from `web/default/src/features/wallet/api.ts`.

- [ ] **Step 2: User page UI**

`index.tsx` page contents:
1. Four summary stats (invitees, topup sum, rebate sum, pending aff_quota) using existing Card/Skeleton patterns from wallet.
2. Button “Transfer to Balance” that opens a copy of wallet `TransferDialog` **or** navigates to `/wallet` if reusing dialog across features is awkward — prefer importing `TransferDialog` + `transferAffiliateQuota` from wallet to avoid duplicating transfer logic.
3. Tabs/tables: rebate logs + invitees (use existing DataTable or simple table components in the design system).
4. Show ratio/enabled from summary for transparency.

- [ ] **Step 3: Route file**

```tsx
// web/default/src/routes/_authenticated/invite-rebate/index.tsx
import { createFileRoute } from '@tanstack/react-router'
import { InviteRebatePage } from '@/features/invite-rebate'

export const Route = createFileRoute('/_authenticated/invite-rebate/')({
  component: InviteRebatePage,
})
```

Run the project’s route generation command if required (inspect `web/default/package.json` scripts; common: `bun run generate-routes` or build step). Update `routeTree.gen.ts` only via generator.

- [ ] **Step 4: Sidebar**

In `use-sidebar-data.ts` Personal items, after Wallet:

```ts
{
  title: t('Invite Rebate'),
  url: '/invite-rebate',
  icon: Share2, // or Gift — match lucide imports already used
},
```

In `use-sidebar-config.ts` ROUTE_MODULE_MAP:

```ts
'/invite-rebate': { section: 'personal', module: 'topup' },
```

(Reuse topup module so existing sidebar toggles keep working without new config schema.)

- [ ] **Step 5: Wallet card link (minimal)**

In `affiliate-rewards-card.tsx`, under description, add a `Link` to `/invite-rebate` with text `t('View top-up rebate details')`. Keep layout change minimal.

- [ ] **Step 6: Smoke typecheck**

```bash
cd web/default && bun run build
```

(or the package’s `tsc`/lint script if build is heavy). Expected: success or only pre-existing unrelated errors.

- [ ] **Step 7: Commit**

```bash
git add web/default/src/features/invite-rebate web/default/src/routes/_authenticated/invite-rebate \
  web/default/src/hooks/use-sidebar-data.ts web/default/src/hooks/use-sidebar-config.ts \
  web/default/src/features/wallet/components/affiliate-rewards-card.tsx \
  web/default/src/routeTree.gen.ts
git commit -m "feat(web-default): invite top-up rebate user page"
```

---

### Task 5: Default theme — admin page + settings options

**Files:**
- Create: `web/default/src/features/invite-rebate/admin.tsx` (or `admin-page.tsx`)
- Create: `web/default/src/routes/_authenticated/invite-rebate/admin.tsx` → path `/invite-rebate/admin` **or** under admin section `/users/invite-rebate` — prefer `/invite-rebate/admin` with Admin-only guard consistent with other admin pages
- Modify: `web/default/src/hooks/use-sidebar-data.ts` Admin items
- Modify: `web/default/src/hooks/use-sidebar-config.ts` map admin route to an admin module (e.g. `user` / `users`)
- Modify: `web/default/src/features/system-settings/general/quota-settings-section.tsx`
- Modify: `web/default/src/features/system-settings/types.ts` (+ billing defaults if required)
- Modify: `web/default/src/features/system-settings/billing/index.tsx` / `section-registry.tsx` if options must be listed for load/save

**Interfaces:**
- Consumes: `GET /api/invite_rebate/`, `GET /api/invite_rebate/summary`
- Settings keys: `InviteTopupRebateEnabled`, `InviteTopupRebateRatioBp`

- [ ] **Step 1: Admin API helpers** in `features/invite-rebate/api.ts`

```ts
export async function fetchAdminInviteRebates(params: Record<string, string | number>) { ... }
export async function fetchAdminInviteRebateSummary(inviterId?: number) { ... }
```

- [ ] **Step 2: Admin page**

- Filters: inviter_id, invitee_id (number inputs), optional time if cheap
- Summary strip: row_count, topup sum, rebate sum, current ratio/enabled
- Paginated table of ledger rows
- Guard: only render if user role is admin (same pattern as `/users`)

- [ ] **Step 3: Route + sidebar**

Admin nav item: `t('Invite Rebates')` → `/invite-rebate/admin`.

- [ ] **Step 4: Settings fields**

In `quota-settings-section.tsx` schema + form, after invitee reward fields:

- Switch: `InviteTopupRebateEnabled`
- Number input: `InviteTopupRebateRatioBp` (description: “Basis points, 100 = 1%”)

Ensure types + default values objects include:

```ts
InviteTopupRebateEnabled: false,
InviteTopupRebateRatioBp: 100,
```

Wire save through existing option PUT pipeline (same as other quota fields).

- [ ] **Step 5: Build + commit**

```bash
cd web/default && bun run build
git add web/default/src/features/invite-rebate web/default/src/routes/_authenticated/invite-rebate \
  web/default/src/hooks/use-sidebar-data.ts web/default/src/hooks/use-sidebar-config.ts \
  web/default/src/features/system-settings
git commit -m "feat(web-default): invite rebate admin page and settings"
```

---

### Task 6: Classic theme — pages, routes, settings

**Files:**
- Create: `web/classic/src/pages/InviteRebate/index.jsx` (user)
- Create: `web/classic/src/pages/InviteRebate/Admin.jsx` (admin)
- Modify: `web/classic/src/App.jsx` (PrivateRoute + AdminRoute)
- Modify: `web/classic/src/pages/Setting/Operation/SettingsCreditLimit.jsx`
- Modify: classic sidebar/menu component if TopUp is listed there (search `console/topup` in `web/classic/src/components` and add sibling entry)

**Interfaces:** same APIs as Tasks 3–5; classic uses `API` helper from `helpers`.

- [ ] **Step 1: User page**

Semi UI layout: statistic cards + Table for logs + Table for invitees + transfer button calling `API.post('/api/user/aff_transfer', { quota })` with min validation like existing TopUp affiliate UI if any.

- [ ] **Step 2: Admin page**

Filters + Table + summary; `API.get('/api/invite_rebate/', { params })`.

- [ ] **Step 3: Routes in `App.jsx`**

Near `/console/topup`:

```jsx
<Route
  path='/console/invite-rebate'
  element={
    <PrivateRoute>
      <Suspense fallback={<Loading />}>
        <InviteRebate />
      </Suspense>
    </PrivateRoute>
  }
/>
<Route
  path='/console/invite-rebate/admin'
  element={
    <AdminRoute>
      <Suspense fallback={<Loading />}>
        <InviteRebateAdmin />
      </Suspense>
    </AdminRoute>
  }
/>
```

- [ ] **Step 4: SettingsCreditLimit**

Extend `inputs` state:

```js
InviteTopupRebateEnabled: false,
InviteTopupRebateRatioBp: '100',
```

Add Form.Switch + Form.InputNumber (or Input) bound like other fields; ensure `props.options` hydration in `useEffect` copies these keys when present (follow existing pattern for `QuotaForInviter`).

- [ ] **Step 5: Nav entry**

Find sidebar config (often `components/layout` or Sider) listing TopUp; add Invite Rebate links for user and admin.

- [ ] **Step 6: Commit**

```bash
git add web/classic/src/pages/InviteRebate web/classic/src/App.jsx \
  web/classic/src/pages/Setting/Operation/SettingsCreditLimit.jsx \
  # plus any sider file touched
git commit -m "feat(web-classic): invite top-up rebate pages and settings"
```

---

### Task 7: End-to-end verification checklist

**Files:** none new (manual / automated verification)

- [ ] **Step 1: Backend unit tests**

```bash
go test ./model -run 'InviteTopupRebate|InviteRebate|GrantInvite' -count=1
```

Expected: PASS

- [ ] **Step 2: Full compile**

```bash
go build -o /tmp/new-api-test .
```

Expected: success

- [ ] **Step 3: Manual API path (if local DB available)**

1. Enable options via admin: `InviteTopupRebateEnabled=true`, ratio 100  
2. User A has aff code; User B registers with aff  
3. Complete a top-up for B (or use admin complete on pending order)  
4. `GET /api/user/invite_rebate/summary` as A → rebate_quota_sum > 0  
5. Second complete/webhook retry → row count still 1  
6. `aff_transfer` moves pending to balance  

- [ ] **Step 4: UI smoke**

- default: `/invite-rebate`, `/invite-rebate/admin`, settings fields  
- classic: `/console/invite-rebate`, admin path, settings  

- [ ] **Step 5: Final commit only if verification fixes needed**; otherwise done.

---

## Spec coverage self-check

| Spec requirement | Task |
|------------------|------|
| Ledger table + unique topup_id | Task 1 |
| Options enabled + ratio_bp | Task 1, 5, 6 |
| Grant on Stripe/Creem/Waffo/Pancake/Manual/Epay | Task 2 |
| User summary/logs/invitees APIs | Task 3 |
| Admin list/summary APIs | Task 3 |
| aff_transfer reuse | Tasks 4, 6 |
| default user page + nav | Task 4 |
| default admin + settings | Task 5 |
| classic user/admin + settings | Task 6 |
| Default off / merge isolation | Tasks 1–6 (new files + thin hooks) |
| Unit tests formula/idempotent | Task 1 |
| No CSV / multi-level / topups schema change | Explicitly omitted |

## Placeholder / consistency review

- No TBD steps; signatures use `GrantInviteTopupRebate(tx, inviteeId, topupQuota, topUp)`.
- User history column uses gorm `aff_history` in SQL updates (matches `AffHistoryQuota`).
- Epay grant is best-effort log-on-error; transactional paths include grant in tx.
- Frontend transfer reuses existing wallet transfer, not a new endpoint.
