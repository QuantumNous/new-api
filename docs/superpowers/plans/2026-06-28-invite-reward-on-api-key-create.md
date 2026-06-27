# Invite Reward On API Key Create Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delay inviter and invitee invitation rewards until the invited user creates their first user-side API key.

**Architecture:** Registration records a pending invite reward state without granting quota. User-side token creation grants the invite reward after manual token creation or `ensure_initial` token creation succeeds. A DB event table with a unique `invitee_id` constraint provides idempotency; Redis locking is optional duplicate-work reduction only, while DB transactions and unique constraints remain authoritative.

**2026-06-28 amendment:** Add configurable inviter reward cap `QuotaForInviterMaxCount` in quota settings. Default is `5`; `0` means unlimited. The grant transaction locks the inviter row and skips only the inviter-side reward when `aff_count >= QuotaForInviterMaxCount`; the invitee-side reward still grants when otherwise valid.

**Tech Stack:** Go 1.22, Gin, GORM v2, SQLite/MySQL/PostgreSQL-compatible migrations via AutoMigrate, Redis optional lock, existing `common` JSON/cache helpers.

---

## File Structure

- Modify `model/user.go`: add invite reward fields to `User`, set pending/none at user creation, remove registration-time invite reward grants, keep sidebar/default setup intact.
- Create `model/invite_reward.go`: define `InviteRewardEvent`, constants, and idempotent invite reward grant helpers, including a transaction-scoped helper.
- Modify `model/main.go`: add `InviteRewardEvent` to AutoMigrate.
- Modify `model/token.go`: extract transaction-scoped token creation helpers and add user-side wrappers that create the token and grant invite rewards in the same transaction.
- Modify `controller/token.go`: use the user-side wrappers from `AddToken` and `EnsureInitialToken`.
- Modify `web/default/src/features/wallet/components/affiliate-rewards-card.tsx` and all frontend locale files with stricter deterrent copy for the Referral Program description.
- Keep `controller/user.go` registration default-token creation excluded by not calling reward logic there.
- Add tests in `model/invite_reward_test.go`, focused controller token/register tests, and frontend i18n checks where needed.

## Critical Product Semantics

- Backend V1 grants rewards on first eligible user-side API key creation, not on model API call.
- Registration default tokens must never trigger invite rewards.
- Wallet Referral Program copy is intentionally stricter than backend V1 behavior as deterrent/fraud-friction copy. Do not add `/v1` relay reward checks solely to match the copy.
- If reward granting fails on a pending invited user's first user-side token creation, the token creation transaction should roll back and the request should fail instead of silently creating a key and losing the only trigger.

## Pre-Implementation Checks

- [ ] Read `model/AGENTS.md` and `controller/AGENTS.md` before touching those directories.
- [ ] Run GitNexus impact analysis before editing symbols required by this plan:

```bash
npx gitnexus impact --target User.Insert --direction upstream
npx gitnexus impact --target User.InsertWithTx --direction upstream
npx gitnexus impact --target User.FinalizeOAuthUserCreation --direction upstream
npx gitnexus impact --target CreateUserToken --direction upstream
npx gitnexus impact --target EnsureInitialUserToken --direction upstream
npx gitnexus impact --target AddToken --direction upstream
npx gitnexus impact --target EnsureInitialToken --direction upstream
```

If any target returns HIGH or CRITICAL risk, pause and report the blast radius before editing.

## Task 1: Add Invite Reward State To User Creation

**Files:**
- Modify: `model/user.go`
- Test: `model/invite_reward_test.go`

- [ ] **Step 1: Write failing model tests for registration state**

Create `model/invite_reward_test.go` with these tests:

```go
package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupInviteRewardModelTest(t *testing.T) {
	t.Helper()
	originalPaymentSetting := *operation_setting.GetPaymentSetting()
	originalDB := DB
	originalLogDB := LOG_DB
	originalUsingSQLite := common.UsingSQLite
	originalUsingMySQL := common.UsingMySQL
	originalUsingPostgreSQL := common.UsingPostgreSQL
	originalRedisEnabled := common.RedisEnabled

	dbPath := t.TempDir() + "/invite_reward.db"
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	DB = db
	LOG_DB = db
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	common.RedisEnabled = false
	require.NoError(t, db.AutoMigrate(&User{}, &Token{}, &Log{}, &InviteRewardEvent{}))

	t.Cleanup(func() {
		_ = sqlDB.Close()
		DB = originalDB
		LOG_DB = originalLogDB
		common.UsingSQLite = originalUsingSQLite
		common.UsingMySQL = originalUsingMySQL
		common.UsingPostgreSQL = originalUsingPostgreSQL
		common.RedisEnabled = originalRedisEnabled
		common.QuotaForNewUser = 0
		common.QuotaForInviter = 0
		common.QuotaForInvitee = 0
		*operation_setting.GetPaymentSetting() = originalPaymentSetting
	})
	paymentSetting := operation_setting.GetPaymentSetting()
	paymentSetting.ComplianceConfirmed = true
	paymentSetting.ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion
	common.QuotaForNewUser = 0
	common.QuotaForInviter = 100
	common.QuotaForInvitee = 50
}

func TestInvitedUserInsertSetsPendingWithoutGrantingReward(t *testing.T) {
	setupInviteRewardModelTest(t)

	inviter := &User{Username: "inviter", Password: "password123", Role: common.RoleCommonUser}
	require.NoError(t, inviter.Insert(0))
	require.NoError(t, DB.First(inviter, "username = ?", "inviter").Error)

	invitee := &User{Username: "invitee", Password: "password123", Role: common.RoleCommonUser, InviterId: inviter.Id}
	require.NoError(t, invitee.Insert(inviter.Id))
	require.NoError(t, DB.First(invitee, "username = ?", "invitee").Error)

	var refreshedInviter User
	require.NoError(t, DB.First(&refreshedInviter, inviter.Id).Error)
	require.Equal(t, InviteRewardStatusPending, invitee.InviteRewardStatus)
	require.Equal(t, 0, invitee.Quota)
	require.Equal(t, 0, refreshedInviter.AffQuota)
	require.Equal(t, 0, refreshedInviter.AffHistoryQuota)
	require.Equal(t, 0, refreshedInviter.AffCount)
}

func TestNonInvitedUserInsertSetsInviteRewardNone(t *testing.T) {
	setupInviteRewardModelTest(t)

	user := &User{Username: "plain", Password: "password123", Role: common.RoleCommonUser}
	require.NoError(t, user.Insert(0))
	require.NoError(t, DB.First(user, "username = ?", "plain").Error)

	require.Equal(t, InviteRewardStatusNone, user.InviteRewardStatus)
}

func TestOAuthUserInsertWithTxPersistsInviterAndPendingWithoutGrantingReward(t *testing.T) {
	setupInviteRewardModelTest(t)

	inviter := &User{Username: "oauth_inviter", Password: "password123", Role: common.RoleCommonUser}
	require.NoError(t, inviter.Insert(0))
	require.NoError(t, DB.First(inviter, "username = ?", "oauth_inviter").Error)

	invitee := &User{Username: "oauth_invitee", Role: common.RoleCommonUser}
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		return invitee.InsertWithTx(tx, inviter.Id)
	}))
	invitee.FinalizeOAuthUserCreation(inviter.Id)

	var refreshedInvitee User
	require.NoError(t, DB.First(&refreshedInvitee, invitee.Id).Error)
	var refreshedInviter User
	require.NoError(t, DB.First(&refreshedInviter, inviter.Id).Error)
	require.Equal(t, inviter.Id, refreshedInvitee.InviterId)
	require.Equal(t, InviteRewardStatusPending, refreshedInvitee.InviteRewardStatus)
	require.Equal(t, 0, refreshedInvitee.Quota)
	require.Equal(t, 0, refreshedInviter.AffQuota)
	require.Equal(t, 0, refreshedInviter.AffHistoryQuota)
	require.Equal(t, 0, refreshedInviter.AffCount)
}
```

- [ ] **Step 2: Run the failing tests**

Run:

```bash
go test ./model -run 'TestInvitedUserInsertSetsPendingWithoutGrantingReward|TestNonInvitedUserInsertSetsInviteRewardNone' -count=1
```

Expected: FAIL because `InviteRewardEvent`, `InviteRewardStatusPending`, `InviteRewardStatusNone`, and `User.InviteRewardStatus` do not exist yet.

- [ ] **Step 3: Add user fields and constants**

In `model/user.go`, add fields to `User` near `InviterId`:

```go
	InviteRewardStatus      string `json:"invite_reward_status" gorm:"type:varchar(16);default:'none';column:invite_reward_status;index"`
	InviteRewardGrantedAt   int64  `json:"invite_reward_granted_at" gorm:"default:0;column:invite_reward_granted_at"`
	InviteRewardBlockReason string `json:"invite_reward_block_reason" gorm:"type:varchar(64);default:'';column:invite_reward_block_reason"`
```

Create `model/invite_reward.go` with the constants and event type:

```go
package model

const (
	InviteRewardStatusNone    = "none"
	InviteRewardStatusPending = "pending"
	InviteRewardStatusGranted = "granted"
	InviteRewardStatusBlocked = "blocked"

	InviteRewardTriggerManualTokenCreate  = "manual_token_create"
	InviteRewardTriggerInitialTokenCreate = "initial_token_create"

	InviteRewardEventStatusGranted = "granted"
	InviteRewardEventStatusBlocked = "blocked"
)

type InviteRewardEvent struct {
	Id                 int    `json:"id"`
	InviteeId          int    `json:"invitee_id" gorm:"uniqueIndex"`
	InviterId          int    `json:"inviter_id" gorm:"index"`
	TriggerType        string `json:"trigger_type" gorm:"type:varchar(32);index"`
	TriggerTokenId     int    `json:"trigger_token_id" gorm:"index"`
	InviterRewardQuota int    `json:"inviter_reward_quota" gorm:"default:0"`
	InviteeRewardQuota int    `json:"invitee_reward_quota" gorm:"default:0"`
	Status             string `json:"status" gorm:"type:varchar(16);index"`
	Reason             string `json:"reason" gorm:"type:varchar(64);default:''"`
	CreatedAt          int64  `json:"created_at" gorm:"autoCreateTime;index"`
}
```

- [ ] **Step 4: Set state during user insert and stop registration-time rewards**

In both `User.Insert` and `User.InsertWithTx`, set state before create:

```go
	if inviterId > 0 {
		user.InviterId = inviterId
	}
	if user.InviterId > 0 {
		user.InviteRewardStatus = InviteRewardStatusPending
	} else {
		user.InviteRewardStatus = InviteRewardStatusNone
	}
```

The `user.InviterId = inviterId` assignment is required for OAuth registration. The OAuth controller passes `inviterId` into `InsertWithTx`, but the user struct may not already carry it; without persisting `InviterId`, later API key creation cannot find the pending invite reward.

In `User.Insert`, remove the block that immediately grants `QuotaForInvitee` / inviter invitation quota. Keep the new-user registration log and sidebar setup.

In `FinalizeOAuthUserCreation`, remove the block that immediately grants `QuotaForInvitee` / inviter invitation quota. Keep the new-user registration log and sidebar setup.

- [ ] **Step 5: Run the model tests**

Run:

```bash
go test ./model -run 'TestInvitedUserInsertSetsPendingWithoutGrantingReward|TestNonInvitedUserInsertSetsInviteRewardNone|TestOAuthUserInsertWithTxPersistsInviterAndPendingWithoutGrantingReward' -count=1
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add model/user.go model/invite_reward.go model/invite_reward_test.go
git commit -m "feat: defer invite rewards after registration"
```

## Task 2: Add Migration For Reward Events

**Files:**
- Modify: `model/main.go`
- Test: `model/invite_reward_test.go`

- [ ] **Step 1: Write failing migration test**

Append to `model/invite_reward_test.go`:

```go
func TestInviteRewardEventAutoMigrateCreatesUniqueInviteeIndex(t *testing.T) {
	setupInviteRewardModelTest(t)

	first := InviteRewardEvent{
		InviteeId:      123,
		InviterId:      456,
		TriggerType:    InviteRewardTriggerManualTokenCreate,
		TriggerTokenId: 1,
		Status:         InviteRewardEventStatusGranted,
	}
	require.NoError(t, DB.Create(&first).Error)
	second := first
	second.Id = 0
	second.TriggerTokenId = 2
	err := DB.Create(&second).Error
	require.Error(t, err)
}
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
go test ./model -run TestInviteRewardEventAutoMigrateCreatesUniqueInviteeIndex -count=1
```

Expected: PASS once `InviteRewardEvent` exists with a unique `invitee_id` index and is included in the test migration.

- [ ] **Step 3: AutoMigrate the event table**

In `model/main.go`, add `&InviteRewardEvent{}` to the main `AutoMigrate` list near `&User{}` and `&Token{}`:

```go
		&InviteRewardEvent{},
```

Also add it to any table-name logging/check list if the file maintains one for migrated tables:

```go
		{&InviteRewardEvent{}, "InviteRewardEvent"},
```

Do not add invite reward fields to `UserBase` in V1. `UserBase` is read by high-frequency auth paths, including `/v1` token auth, and the reward grant path can read the full `User` row directly. Keep the `/v1` cache shape unchanged; only invalidate the existing user cache after quota/counter changes.

- [ ] **Step 4: Run the focused test**

Run:

```bash
go test ./model -run TestInviteRewardEventAutoMigrateCreatesUniqueInviteeIndex -count=1
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add model/main.go model/invite_reward_test.go
git commit -m "feat: persist invite reward events"
```

## Task 3: Implement Idempotent Reward Granting

Backend reward granting is triggered by eligible user-side API key creation. The stricter "successfully calls the API" wording is frontend deterrent copy only and must not drive backend relay changes. For user-side token creation, token insert and invite reward grant must happen in one DB transaction.

**Files:**
- Modify: `model/invite_reward.go`
- Modify: `model/token.go`
- Test: `model/invite_reward_test.go`

- [ ] **Step 1: Write failing reward tests**

Append to `model/invite_reward_test.go`:

```go
func createInvitedUsersForRewardTest(t *testing.T) (*User, *User) {
	t.Helper()
	inviter := &User{Username: "reward_inviter", Password: "password123", Role: common.RoleCommonUser}
	require.NoError(t, inviter.Insert(0))
	require.NoError(t, DB.First(inviter, "username = ?", "reward_inviter").Error)

	invitee := &User{Username: "reward_invitee", Password: "password123", Role: common.RoleCommonUser, InviterId: inviter.Id}
	require.NoError(t, invitee.Insert(inviter.Id))
	require.NoError(t, DB.First(invitee, "username = ?", "reward_invitee").Error)
	return inviter, invitee
}

func TestTryGrantInviteRewardAfterTokenCreatedGrantsBothSidesOnce(t *testing.T) {
	setupInviteRewardModelTest(t)
	inviter, invitee := createInvitedUsersForRewardTest(t)

	require.NoError(t, TryGrantInviteRewardAfterTokenCreated(invitee.Id, 10, InviteRewardTriggerManualTokenCreate))
	require.NoError(t, TryGrantInviteRewardAfterTokenCreated(invitee.Id, 11, InviteRewardTriggerManualTokenCreate))

	var refreshedInviter User
	var refreshedInvitee User
	var events []InviteRewardEvent
	require.NoError(t, DB.First(&refreshedInviter, inviter.Id).Error)
	require.NoError(t, DB.First(&refreshedInvitee, invitee.Id).Error)
	require.NoError(t, DB.Find(&events).Error)

	require.Equal(t, InviteRewardStatusGranted, refreshedInvitee.InviteRewardStatus)
	require.Equal(t, int64(1), int64(len(events)))
	require.Equal(t, 50, refreshedInvitee.Quota)
	require.Equal(t, 100, refreshedInviter.AffQuota)
	require.Equal(t, 100, refreshedInviter.AffHistoryQuota)
	require.Equal(t, 1, refreshedInviter.AffCount)
	require.Equal(t, InviteRewardTriggerManualTokenCreate, events[0].TriggerType)
	require.Equal(t, 10, events[0].TriggerTokenId)
}

func TestTryGrantInviteRewardAfterTokenCreatedMarksGrantedWhenAmountsAreZero(t *testing.T) {
	setupInviteRewardModelTest(t)
	common.QuotaForInviter = 0
	common.QuotaForInvitee = 0
	_, invitee := createInvitedUsersForRewardTest(t)

	require.NoError(t, TryGrantInviteRewardAfterTokenCreated(invitee.Id, 20, InviteRewardTriggerInitialTokenCreate))

	var refreshedInvitee User
	var event InviteRewardEvent
	require.NoError(t, DB.First(&refreshedInvitee, invitee.Id).Error)
	require.NoError(t, DB.First(&event, "invitee_id = ?", invitee.Id).Error)
	require.Equal(t, InviteRewardStatusGranted, refreshedInvitee.InviteRewardStatus)
	require.Equal(t, 0, refreshedInvitee.Quota)
	require.Equal(t, 0, event.InviterRewardQuota)
	require.Equal(t, 0, event.InviteeRewardQuota)
}

func TestTryGrantInviteRewardAfterTokenCreatedSkipsUsersWithoutPendingInvite(t *testing.T) {
	setupInviteRewardModelTest(t)
	user := &User{Username: "not_invited", Password: "password123", Role: common.RoleCommonUser}
	require.NoError(t, user.Insert(0))
	require.NoError(t, DB.First(user, "username = ?", "not_invited").Error)

	require.NoError(t, TryGrantInviteRewardAfterTokenCreated(user.Id, 30, InviteRewardTriggerManualTokenCreate))

	var count int64
	require.NoError(t, DB.Model(&InviteRewardEvent{}).Count(&count).Error)
	require.Equal(t, int64(0), count)
}

func TestTryGrantInviteRewardAfterTokenCreatedConcurrentAttemptsGrantOnce(t *testing.T) {
	setupInviteRewardModelTest(t)

	inviter, invitee := createInvitedUsersForRewardTest(t)

	const attempts = 20
	errCh := make(chan error, attempts)
	start := make(chan struct{})
	for i := 0; i < attempts; i++ {
		go func(i int) {
			<-start
			errCh <- TryGrantInviteRewardAfterTokenCreated(invitee.Id, 100+i, InviteRewardTriggerManualTokenCreate)
		}(i)
	}
	close(start)
	for i := 0; i < attempts; i++ {
		require.NoError(t, <-errCh)
	}

	var events []InviteRewardEvent
	require.NoError(t, DB.Find(&events).Error)
	require.Len(t, events, 1)

	var refreshedInvitee User
	require.NoError(t, DB.First(&refreshedInvitee, invitee.Id).Error)
	var refreshedInviter User
	require.NoError(t, DB.First(&refreshedInviter, inviter.Id).Error)
	require.Equal(t, 50, refreshedInvitee.Quota)
	require.Equal(t, 100, refreshedInviter.AffQuota)
	require.Equal(t, 100, refreshedInviter.AffHistoryQuota)
	require.Equal(t, 1, refreshedInviter.AffCount)
}

func TestTryGrantInviteRewardAfterTokenCreatedBlocksWhenInviterMissing(t *testing.T) {
	setupInviteRewardModelTest(t)

	invitee := &User{Username: "missing_inviter_invitee", Password: "password123", Role: common.RoleCommonUser, InviterId: 99999}
	require.NoError(t, invitee.Insert(99999))
	require.NoError(t, DB.First(invitee, "username = ?", "missing_inviter_invitee").Error)

	require.NoError(t, TryGrantInviteRewardAfterTokenCreated(invitee.Id, 200, InviteRewardTriggerManualTokenCreate))

	var refreshedInvitee User
	var event InviteRewardEvent
	require.NoError(t, DB.First(&refreshedInvitee, invitee.Id).Error)
	require.NoError(t, DB.First(&event, "invitee_id = ?", invitee.Id).Error)
	require.Equal(t, InviteRewardStatusBlocked, refreshedInvitee.InviteRewardStatus)
	require.Equal(t, InviteRewardEventStatusBlocked, event.Status)
	require.NotEmpty(t, refreshedInvitee.InviteRewardBlockReason)
	require.Equal(t, 0, refreshedInvitee.Quota)

	require.NoError(t, TryGrantInviteRewardAfterTokenCreated(invitee.Id, 201, InviteRewardTriggerManualTokenCreate))
	var eventCount int64
	require.NoError(t, DB.Model(&InviteRewardEvent{}).Where("invitee_id = ?", invitee.Id).Count(&eventCount).Error)
	require.Equal(t, int64(1), eventCount)
}

func TestTryGrantInviteRewardAfterTokenCreatedGrantsWhenPaymentComplianceUnconfirmed(t *testing.T) {
	setupInviteRewardModelTest(t)
	operation_setting.GetPaymentSetting().ComplianceConfirmed = false
	inviter, invitee := createInvitedUsersForRewardTest(t)

	require.NoError(t, TryGrantInviteRewardAfterTokenCreated(invitee.Id, 300, InviteRewardTriggerManualTokenCreate))

	var refreshedInvitee User
	var refreshedInviter User
	var count int64
	require.NoError(t, DB.First(&refreshedInvitee, invitee.Id).Error)
	require.NoError(t, DB.First(&refreshedInviter, inviter.Id).Error)
	require.NoError(t, DB.Model(&InviteRewardEvent{}).Count(&count).Error)
	require.Equal(t, InviteRewardStatusGranted, refreshedInvitee.InviteRewardStatus)
	require.Equal(t, int64(1), count)
	require.Equal(t, 1, refreshedInviter.AffCount)
}

func TestCreateUserTokenWithInviteRewardRollsBackTokenWhenRewardErrors(t *testing.T) {
	setupInviteRewardModelTest(t)
	_, invitee := createInvitedUsersForRewardTest(t)
	token := &Token{Name: "bad-trigger", Key: "test-key", UserId: invitee.Id}

	err := CreateUserTokenWithInviteReward(invitee.Id, token, 10, "unsupported_trigger")
	require.Error(t, err)

	var tokenCount int64
	require.NoError(t, DB.Model(&Token{}).Where("user_id = ?", invitee.Id).Count(&tokenCount).Error)
	var refreshedInvitee User
	require.NoError(t, DB.First(&refreshedInvitee, invitee.Id).Error)
	require.Equal(t, int64(0), tokenCount)
	require.Equal(t, InviteRewardStatusPending, refreshedInvitee.InviteRewardStatus)
}
```

- [ ] **Step 2: Run the failing reward tests**

Run:

```bash
go test ./model -run 'TestTryGrantInviteRewardAfterTokenCreated|TestCreateUserTokenWithInviteRewardRollsBackTokenWhenRewardErrors' -count=1
```

Expected: FAIL because `TryGrantInviteRewardAfterTokenCreated` is not implemented.

- [ ] **Step 3: Implement grant function**

In `model/invite_reward.go`, add imports and implementation:

```go
import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type inviteRewardGrantResult struct {
	Granted   bool
	InviteeId int
	InviterId int
}

func tryGrantInviteRewardInTx(tx *gorm.DB, inviteeId int, triggerTokenId int, triggerType string) (inviteRewardGrantResult, error) {
	result := inviteRewardGrantResult{InviteeId: inviteeId}
	if inviteeId <= 0 || triggerTokenId <= 0 {
		return result, nil
	}
	if triggerType != InviteRewardTriggerManualTokenCreate && triggerType != InviteRewardTriggerInitialTokenCreate {
		return result, fmt.Errorf("unsupported invite reward trigger type: %s", triggerType)
	}
	var invitee User
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("id = ?", inviteeId).
		First(&invitee).Error; err != nil {
		return result, err
	}
	if invitee.InviterId <= 0 || invitee.InviteRewardStatus != InviteRewardStatusPending {
		return result, nil
	}
	result.InviterId = invitee.InviterId

	var inviter User
	if err := tx.Where("id = ?", invitee.InviterId).First(&inviter).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return result, blockInviteRewardInTx(tx, invitee.Id, invitee.InviterId, triggerTokenId, triggerType, "inviter_missing")
		}
		return result, err
	}

	event := InviteRewardEvent{
		InviteeId:          invitee.Id,
		InviterId:          invitee.InviterId,
		TriggerType:        triggerType,
		TriggerTokenId:     triggerTokenId,
		InviterRewardQuota: common.QuotaForInviter,
		InviteeRewardQuota: common.QuotaForInvitee,
		Status:             InviteRewardEventStatusGranted,
		Reason:             "",
	}
	insertResult := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&event)
	if insertResult.Error != nil {
		return result, insertResult.Error
	}
	if insertResult.RowsAffected == 0 {
		return result, nil
	}

	if common.QuotaForInvitee > 0 {
		if err := tx.Model(&User{}).
			Where("id = ?", invitee.Id).
			Update("quota", gorm.Expr("quota + ?", common.QuotaForInvitee)).Error; err != nil {
			return result, err
		}
	}
	if common.QuotaForInviter > 0 {
		if err := tx.Model(&User{}).
			Where("id = ?", invitee.InviterId).
			Updates(map[string]interface{}{
				"aff_count":   gorm.Expr("aff_count + ?", 1),
				"aff_quota":   gorm.Expr("aff_quota + ?", common.QuotaForInviter),
				"aff_history": gorm.Expr("aff_history + ?", common.QuotaForInviter),
			}).Error; err != nil {
			return result, err
		}
	}

	statusResult := tx.Model(&User{}).
		Where("id = ? AND invite_reward_status = ?", invitee.Id, InviteRewardStatusPending).
		Updates(map[string]interface{}{
			"invite_reward_status":       InviteRewardStatusGranted,
			"invite_reward_granted_at":   time.Now().Unix(),
			"invite_reward_block_reason": "",
		})
	if statusResult.Error != nil {
		return result, statusResult.Error
	}
	if statusResult.RowsAffected == 0 {
		return result, nil
	}
	result.Granted = true
	return result, nil
}

func TryGrantInviteRewardAfterTokenCreated(inviteeId int, triggerTokenId int, triggerType string) error {
	releaseLock := tryAcquireInviteRewardRedisLock(inviteeId)
	if releaseLock != nil {
		defer releaseLock()
	}

	var result inviteRewardGrantResult
	err := DB.Transaction(func(tx *gorm.DB) error {
		var txErr error
		result, txErr = tryGrantInviteRewardInTx(tx, inviteeId, triggerTokenId, triggerType)
		return txErr
	})
	if err == nil {
		runInviteRewardPostCommitHooks(result)
	}
	return err
}

func blockInviteRewardInTx(tx *gorm.DB, inviteeId int, inviterId int, triggerTokenId int, triggerType string, reason string) error {
	event := InviteRewardEvent{
		InviteeId:      inviteeId,
		InviterId:      inviterId,
		TriggerType:    triggerType,
		TriggerTokenId: triggerTokenId,
		Status:         InviteRewardEventStatusBlocked,
		Reason:         reason,
	}
	insertResult := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&event)
	if insertResult.Error != nil {
		return insertResult.Error
	}
	return tx.Model(&User{}).
		Where("id = ? AND invite_reward_status = ?", inviteeId, InviteRewardStatusPending).
		Updates(map[string]interface{}{
			"invite_reward_status":       InviteRewardStatusBlocked,
			"invite_reward_block_reason": reason,
		}).Error
}

func recordInviteRewardLogs(inviteeId int, inviterId int) {
	if common.QuotaForInvitee > 0 {
		RecordLog(inviteeId, LogTypeSystem, fmt.Sprintf("使用邀请码赠送 %s", logger.LogQuota(common.QuotaForInvitee)))
	}
	if common.QuotaForInviter > 0 {
		RecordLog(inviterId, LogTypeSystem, fmt.Sprintf("邀请用户赠送 %s", logger.LogQuota(common.QuotaForInviter)))
	}
}

func runInviteRewardPostCommitHooks(result inviteRewardGrantResult) {
	if !result.Granted {
		return
	}
	recordInviteRewardLogs(result.InviteeId, result.InviterId)
	if cacheErr := InvalidateUserCache(result.InviteeId); cacheErr != nil {
		common.SysLog("failed to invalidate invitee cache after invite reward: " + cacheErr.Error())
	}
	if cacheErr := InvalidateUserCache(result.InviterId); cacheErr != nil {
		common.SysLog("failed to invalidate inviter cache after invite reward: " + cacheErr.Error())
	}
}
```

Add the optional Redis lock helper below the main function. This helper must degrade open when Redis is disabled or `common.RDB` is nil because the DB unique constraint is the source of truth:

```go
func tryAcquireInviteRewardRedisLock(inviteeId int) func() {
	if !common.RedisEnabled || common.RDB == nil {
		return nil
	}
	key := fmt.Sprintf("invite_reward:%d", inviteeId)
	ok, err := common.RDB.SetNX(context.Background(), key, "1", 10*time.Second).Result()
	if err != nil || !ok {
		if err != nil {
			common.SysLog("failed to acquire invite reward redis lock: " + err.Error())
		}
		return nil
	}
	return func() {
		if err := common.RDB.Del(context.Background(), key).Err(); err != nil {
			common.SysLog("failed to release invite reward redis lock: " + err.Error())
		}
	}
}
```

The important correctness requirements are:

- Structure the implementation as:
  - `TryGrantInviteRewardAfterTokenCreated(inviteeId, triggerTokenId, triggerType)`: public wrapper for direct retry/tests; it may open its own transaction.
  - `tryGrantInviteRewardInTx(tx, inviteeId, triggerTokenId, triggerType)`: transaction-scoped helper used by token creation wrappers.
  - a small post-commit hook result, so logs/cache invalidation run only after commit.
- Add `CreateUserTokenWithInviteReward` and `EnsureInitialUserTokenWithInviteReward` wrappers in `model/token.go`. These wrappers should create the token and call `tryGrantInviteRewardInTx` in the same DB transaction, then run logs/cache invalidation after commit. Do not call the public `TryGrantInviteRewardAfterTokenCreated` wrapper from inside these token transactions.
- Keep existing `CreateUserToken` and `EnsureInitialUserToken` wrappers for callers that must not trigger rewards, especially registration default-token creation.
- Use `clause.OnConflict{DoNothing: true}` for the unique event insert. Do not rely on `errors.Is(err, gorm.ErrDuplicatedKey)` because duplicate-key translation is driver/config dependent.
- Do not depend on `operation_setting.IsPaymentComplianceConfirmed()` for invite rewards. Product policy intentionally moved this control away from card/top-up/payment-compliance gating.
- Enforce `QuotaForInviterMaxCount` inside the reward transaction before granting inviter quota. When the inviter has reached the cap, write a granted event with `inviter_reward_quota = 0` and `reason = inviter_limit_reached`; still grant the invitee-side quota and set invitee `invite_reward_status = granted`.
- If the inviter row is missing, write a `blocked` event, set invitee `invite_reward_status = blocked`, and set `invite_reward_block_reason`.
- Use atomic DB expressions for inviter counters. Do not call the existing `inviteUser` helper from this path because it performs read-modify-save outside the reward transaction.
- Set logs and invalidate caches after commit only when `granted == true`.
- `clause.Locking{Strength: "UPDATE"}` is useful on MySQL/PostgreSQL but not sufficient on SQLite; the unique event row and guarded status update are the cross-DB safeguards.

- [ ] **Step 4: Run reward tests**

Run:

```bash
go test ./model -run 'TestTryGrantInviteRewardAfterTokenCreated|TestCreateUserTokenWithInviteRewardRollsBackTokenWhenRewardErrors' -count=1
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add model/invite_reward.go model/token.go model/invite_reward_test.go
git commit -m "feat: grant invite rewards on token creation"
```

## Task 4: Trigger Rewards From User-Side Token Creation

**Files:**
- Modify: `controller/token.go`
- Test: `controller/token_test.go`

- [ ] **Step 1: Write failing controller tests**

Add tests to `controller/token_test.go` that call `AddToken` and `EnsureInitialToken` with invited users. Use the existing `newAuthenticatedContext` helper in that file. The tests should assert:

```go
func TestAddTokenTriggersInviteRewardForPendingInvitee(t *testing.T) {
	// setup DB with User, Token, Log, InviteRewardEvent
	// create inviter and invitee with pending invite state
	// call AddToken with authenticated context for invitee
	// assert response success
	// assert invitee quota == common.QuotaForInvitee
	// assert inviter aff_quota == common.QuotaForInviter
	// assert one InviteRewardEvent with trigger_type manual_token_create
}

func TestEnsureInitialTokenCreatedTriggersInviteReward(t *testing.T) {
	// setup DB with pending invited user and no existing token
	// call EnsureInitialToken
	// assert response data.created == true
	// assert one InviteRewardEvent with trigger_type initial_token_create
}

func TestEnsureInitialTokenExistingDoesNotTriggerInviteReward(t *testing.T) {
	// setup DB with pending invited user and one existing token
	// call EnsureInitialToken
	// assert response data.created == false
	// assert no InviteRewardEvent
	// assert invitee invite_reward_status is still pending
	// assert inviter aff_quota, aff_history_quota, and aff_count are still 0
}

func TestAddTokenTriggersInviteRewardWhenPaymentComplianceUnconfirmed(t *testing.T) {
	// setup DB with pending invited user
	// set operation_setting.GetPaymentSetting().ComplianceConfirmed = false
	// call AddToken with authenticated context for invitee
	// assert response success and one token exists for invitee
	// assert one InviteRewardEvent
	// assert invitee invite_reward_status is granted
	// assert inviter counters are incremented
}
```

- [ ] **Step 2: Run controller token tests**

Run:

```bash
go test ./controller -run 'TestAddTokenTriggersInviteRewardForPendingInvitee|TestEnsureInitialTokenCreatedTriggersInviteReward|TestEnsureInitialTokenExistingDoesNotTriggerInviteReward' -count=1
```

Expected: FAIL because token controllers do not call invite reward granting yet.

- [ ] **Step 3: Use atomic manual token creation wrapper**

In `controller.AddToken`, replace the `model.CreateUserToken` call with `model.CreateUserTokenWithInviteReward`:

```go
	err = model.CreateUserTokenWithInviteReward(
		c.GetInt("id"),
		&cleanToken,
		maxTokens,
		model.InviteRewardTriggerManualTokenCreate,
	)
```

This wrapper must insert the token and grant the invite reward in the same DB transaction. If the reward grant fails, token creation rolls back and the existing controller error handling returns an API error. Non-pending users should take the normal fast no-op reward path inside the wrapper.

- [ ] **Step 4: Use atomic onboarding initial token wrapper**

In `controller.EnsureInitialToken`, replace `model.EnsureInitialUserToken(...)` with:

```go
	createdToken, created, err := model.EnsureInitialUserTokenWithInviteReward(
		c.GetInt("id"),
		cleanToken,
		maxTokens,
		model.InviteRewardTriggerInitialTokenCreate,
	)
```

Only this user-facing `ensure_initial` endpoint should use the reward wrapper. Do not call the reward wrapper from registration default-token creation in `controller.Register`.

- [ ] **Step 5: Run controller token tests**

Run:

```bash
go test ./controller -run 'TestAddTokenTriggersInviteRewardForPendingInvitee|TestEnsureInitialTokenCreatedTriggersInviteReward|TestEnsureInitialTokenExistingDoesNotTriggerInviteReward' -count=1
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add controller/token.go controller/token_test.go
git commit -m "feat: trigger invite rewards from API key creation"
```

## Task 5: Preserve Registration Default Token Exclusion

**Files:**
- Modify: `controller/user_register_test.go`
- No production file change expected unless the test reveals a leak.

- [ ] **Step 1: Write regression test**

Add or extend a registration test in `controller/user_register_test.go`:

```go
func TestRegisterDefaultTokenDoesNotTriggerInviteReward(t *testing.T) {
	// setup DB with User, Token, Log, InviteRewardEvent
	// set constant.GenerateDefaultToken = true
	// set common.QuotaForInviter and common.QuotaForInvitee positive
	// create inviter with aff_code
	// register invitee using inviter aff_code
	// assert default token exists
	// assert invitee invite_reward_status == pending
	// assert invitee quota does not include QuotaForInvitee
	// assert inviter aff_quota == 0
	// assert no InviteRewardEvent exists
	// then call AddToken for the invitee
	// assert the manual user-side token triggers exactly one InviteRewardEvent
	// assert invitee receives QuotaForInvitee and inviter receives QuotaForInviter
}
```

- [ ] **Step 2: Run the regression test**

Run:

```bash
go test ./controller -run TestRegisterDefaultTokenDoesNotTriggerInviteReward -count=1
```

Expected: PASS if Task 4 only hooked `AddToken` and `EnsureInitialToken`. FAIL if reward logic was accidentally placed in `model.CreateUserToken`.

- [ ] **Step 3: Fix only if needed**

If the test fails, remove any reward call from lower-level token model functions and keep reward triggering only in:

```text
controller.AddToken
controller.EnsureInitialToken when created == true
```

- [ ] **Step 4: Commit**

```bash
git add controller/user_register_test.go controller/token.go model/token.go
git commit -m "test: exclude registration default token from invite rewards"
```

If no production files changed, omit `controller/token.go model/token.go` from `git add`.

## Task 6: Update Wallet Referral Program Copy

**Files:**
- Modify: `web/default/src/features/wallet/components/affiliate-rewards-card.tsx`
- Modify: `web/default/src/i18n/locales/{en,zh,fr,ja,ru,vi,es,pt}.json`

- [ ] **Step 1: Replace the Referral Program description**

In `AffiliateRewardsCard`, replace the old top-up-based description:

```text
Earn rewards when your referrals add funds. Transfer accumulated rewards to your balance anytime.
```

with:

```text
Rewards are issued after your referral creates their first API key and successfully calls the API.
```

Chinese copy:

```text
被邀请用户首次创建 API 令牌并成功调用接口后，奖励才会发放。
```

This is the text shown under `推荐计划` in `https://console.flatkey.ai/wallet?show_history=false&card_bound=false`.

- [ ] **Step 2: Add all locale translations**

Add the new key to all eight locale files and remove the old key if it is no longer used:

```text
en: Rewards are issued after your referral creates their first API key and successfully calls the API.
zh: 被邀请用户首次创建 API 令牌并成功调用接口后，奖励才会发放。
fr: Les récompenses sont émises après que votre filleul a créé sa première clé API et appelé l’API avec succès.
ja: 紹介されたユーザーが初めて API キーを作成し、API 呼び出しに成功した後に報酬が付与されます。
ru: Вознаграждения начисляются после того, как приглашенный пользователь создаст первый API-ключ и успешно вызовет API.
vi: Phần thưởng được phát sau khi người được giới thiệu tạo khóa API đầu tiên và gọi API thành công.
es: Las recompensas se emiten después de que tu referido cree su primera clave API y llame correctamente a la API.
pt: As recompensas são emitidas depois que a pessoa indicada cria a primeira chave de API e chama a API com sucesso.
```

- [ ] **Step 3: Verify frontend i18n and types**

Run from `web/default/`:

```bash
bun run i18n:sync
bun run typecheck
```

Expected: PASS. If `node_modules` is missing, install dependencies with Bun before typecheck.

- [ ] **Step 4: Commit**

```bash
git add web/default/src/features/wallet/components/affiliate-rewards-card.tsx web/default/src/i18n/locales/*.json
git commit -m "feat: clarify referral reward eligibility copy"
```

## Task 7: Verification And Release Notes

**Files:**
- Modify only if needed based on test failures.

- [ ] **Step 1: Run focused model tests**

Run:

```bash
go test ./model -run 'InviteReward|InvitedUser|NonInvitedUser' -count=1
```

Expected: PASS.

- [ ] **Step 2: Run focused controller tests**

Run:

```bash
go test ./controller -run 'InviteReward|RegisterDefaultToken|AddToken|EnsureInitialToken' -count=1
```

Expected: PASS.

- [ ] **Step 3: Run broader package tests**

Run:

```bash
go test ./model ./controller -count=1
```

Expected: PASS.

- [ ] **Step 4: Run MySQL-backed invite reward smoke**

Production uses MySQL, so run an opt-in MySQL validation before release. Use the repository's existing test DB wiring if available; otherwise add a gated test that runs only when `INVITE_REWARD_MYSQL_DSN` is set and skips otherwise. It must cover:

```text
1. AutoMigrate creates invite_reward_events with unique invitee_id.
2. Duplicate reward attempts create one event and grant quota once.
3. Missing inviter marks blocked and does not grant quota.
4. Unsupported trigger in CreateUserTokenWithInviteReward rolls back token insert.
```

Run:

```bash
INVITE_REWARD_MYSQL_DSN='user:pass@tcp(127.0.0.1:3306)/newapi_test?parseTime=true' go test ./model -run 'InviteReward.*MySQL|TestCreateUserTokenWithInviteRewardRollsBackTokenWhenRewardErrors' -count=1
```

Expected: PASS in MySQL-backed validation. If no MySQL test DB is available locally, record this as a release validation gap and run it in staging before production.

- [ ] **Step 5: Run build**

Run:

```bash
go build ./...
```

Expected: PASS.

- [ ] **Step 6: Manual staging smoke**

On staging:

```text
1. Register through an invite link.
2. Confirm invitee has pending reward and no invitation reward quota.
3. Visit /keys?create=1.
4. Confirm initial key is created and revealed.
5. Confirm invitee receives QuotaForInvitee immediately.
6. Confirm inviter receives QuotaForInviter in invitation quota counters immediately.
7. Revisit /keys?create=1 and confirm no duplicate reward.
8. Register with GENERATE_DEFAULT_TOKEN enabled in a staging-like env if available, and confirm registration default token does not grant invite rewards.
```

- [ ] **Step 7: Production deployment recommendation**

Include this in PR/release notes:

```text
Router deploy: required.
Reason: changes registration reward timing, API key creation side effects, user quota, invitation quota counters, and DB schema used by console/API paths.
Other deploy targets: deploy newapi-console. newapi-web is not required unless frontend copy changes are added. No Terraform or Cloudflare changes.
Risk / validation: production DB is MySQL; verify MySQL-backed unique event idempotency, token-create rollback on reward error, registration with invite, /keys?create=1 initial key creation, manual key creation, duplicate prevention, and default-token exclusion in staging.
```

- [ ] **Step 8: Commit final verification notes if docs changed**

```bash
git add docs/superpowers/specs/2026-06-28-invite-reward-on-api-key-create-design.md docs/superpowers/plans/2026-06-28-invite-reward-on-api-key-create.md
git commit -m "docs: plan invite rewards on API key creation"
```

## Self-Review

- Spec coverage: The plan covers pending state at registration, manual token creation, `/keys?create=1` via `ensure_initial`, registration default-token exclusion, idempotency, event table, cache shape, tests, and deployment guidance.
- Placeholder scan: No `TBD`, `TODO`, or unbounded "handle edge cases" steps remain.
- Type consistency: Status constants, trigger constants, event fields, and controller hook names match across tasks.
