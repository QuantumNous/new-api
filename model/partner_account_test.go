package model

import (
	"fmt"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var partnerAccountTestModels = []any{
	&User{}, &UserSession{}, &UserAccessToken{}, &Token{}, &Log{}, &Option{}, &TwoFA{},
	&TopUp{}, &CashbackOrderContext{}, &CashbackCampaign{}, &WalletRefundCreditEvent{},
	&PartnerOAuthClient{}, &PartnerOAuthBinding{}, &PartnerOAuthToken{},
	&PartnerServerConfig{}, &PartnerServerSecret{}, &PartnerServerToken{},
	&PartnerAccount{}, &PartnerAccountPaymentOrder{},
}

// usePartnerAccountTestDB points the package at a fresh database for one test.
// With TEST_POSTGRES_DSN it creates a throwaway PostgreSQL schema (these
// models fix their table names, so a table prefix would not isolate them);
// otherwise it uses an in-memory SQLite database. Migration runs twice to
// prove it is repeatable on the engine under test.
func usePartnerAccountTestDB(t *testing.T) common.DatabaseType {
	t.Helper()
	dsn := os.Getenv("TEST_POSTGRES_DSN")
	dbType := common.DatabaseTypeSQLite
	var db *gorm.DB
	var err error
	if dsn == "" {
		db, err = gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
		require.NoError(t, err)
		sqlDB, err := db.DB()
		require.NoError(t, err)
		sqlDB.SetMaxOpenConns(1)
	} else {
		dbType = common.DatabaseTypePostgreSQL
		admin, err := gorm.Open(postgres.New(postgres.Config{DSN: dsn, PreferSimpleProtocol: true}), &gorm.Config{})
		require.NoError(t, err)
		schema := fmt.Sprintf("pa_%d", time.Now().UnixNano())
		require.NoError(t, admin.Exec("CREATE SCHEMA "+schema).Error)
		t.Cleanup(func() {
			admin.Exec("DROP SCHEMA " + schema + " CASCADE")
			if sqlDB, err := admin.DB(); err == nil {
				_ = sqlDB.Close()
			}
		})
		db, err = gorm.Open(postgres.New(postgres.Config{DSN: dsn + " search_path=" + schema, PreferSimpleProtocol: true}), &gorm.Config{})
		require.NoError(t, err)
		var version string
		require.NoError(t, db.Raw("SHOW server_version").Scan(&version).Error)
		t.Logf("database: postgres %s", version)
	}
	sqlDB, err := db.DB()
	require.NoError(t, err)

	oldDB, oldLogDB := DB, LOG_DB
	oldMain, oldLog := common.MainDatabaseType(), common.LogDatabaseType()
	oldRedis, oldNewUserQuota := common.RedisEnabled, common.QuotaForNewUser
	DB, LOG_DB = db, db
	common.SetDatabaseTypes(dbType, dbType)
	common.RedisEnabled = false
	initCol()
	t.Cleanup(func() {
		_ = sqlDB.Close()
		DB, LOG_DB = oldDB, oldLogDB
		common.SetDatabaseTypes(oldMain, oldLog)
		common.RedisEnabled = oldRedis
		common.QuotaForNewUser = oldNewUserQuota
		initCol()
	})
	require.NoError(t, db.AutoMigrate(partnerAccountTestModels...))
	require.NoError(t, db.AutoMigrate(partnerAccountTestModels...))
	return dbType
}

func seedPartnerServer(t *testing.T, mutate func(*PartnerServerConfig)) *PartnerOAuthClient {
	t.Helper()
	client := &PartnerOAuthClient{
		Name:            "Kede Finance",
		TokenAuthMethod: PartnerOAuthTokenAuthMethodBasic,
		SecretHash:      HashPartnerOAuthSecret("pcs_example"),
		RedirectURIs:    `["https://partner.example.com/oauth/callback"]`,
		Scopes:          "account:read",
		Status:          PartnerOAuthClientStatusEnabled,
	}
	require.NoError(t, CreatePartnerOAuthClient(client))
	config := &PartnerServerConfig{
		ClientId:          client.ClientId,
		Enabled:           true,
		AccountGroup:      "partner_kede",
		MaxAccounts:       PartnerServerDefaultMaxAccounts,
		AccountsPerMinute: PartnerServerDefaultAccountsPerMinute,
	}
	if mutate != nil {
		mutate(config)
	}
	require.NoError(t, SavePartnerServerConfig(config))
	return client
}

func partnerOwner(client *PartnerOAuthClient, externalUserID string) PartnerAccountOwner {
	return PartnerAccountOwner{ClientId: client.ClientId, ExternalUserId: externalUserID, DisplayName: client.Name}
}

func partnerKey(t *testing.T) PartnerAccountKey {
	t.Helper()
	key, err := common.GenerateKey()
	require.NoError(t, err)
	return PartnerAccountKey{Key: key, Name: "partner:Kede Finance"}
}

// issueCredential returns the account, its key and whether the key was created.
func issueCredential(owner PartnerAccountOwner, spec PartnerAccountKey) (*PartnerAccount, *Token, bool, error) {
	result, err := IssuePartnerAccountCredential(owner, spec)
	if err != nil {
		return nil, nil, false, err
	}
	return result.Account, result.Token, result.KeyCreated, nil
}

func partnerHash(value string) string {
	return HashPartnerExternalUserID(value)
}

const partnerTestUserID = "kede-user-0000000000000000000000001"

func TestPartnerAccountFirstUseCreatesBareSubAccountAndOneKey(t *testing.T) {
	usePartnerAccountTestDB(t)
	common.QuotaForNewUser = 500
	client := seedPartnerServer(t, nil)

	_, err := GetPartnerAccount(client.ClientId, partnerTestUserID)
	require.ErrorIs(t, err, ErrPartnerAccountNotFound)
	count, err := CountPartnerAccounts(client.ClientId)
	require.NoError(t, err)
	assert.Zero(t, count, "a lookup must not create an account")

	account, token, created, err := issueCredential(partnerOwner(client, partnerTestUserID), partnerKey(t))
	require.NoError(t, err)
	assert.True(t, created)
	again, sameToken, createdAgain, err := issueCredential(partnerOwner(client, partnerTestUserID), partnerKey(t))
	require.NoError(t, err)
	assert.False(t, createdAgain)
	assert.Equal(t, account.Id, again.Id)
	assert.Equal(t, token.Key, sameToken.Key)

	var user User
	require.NoError(t, DB.First(&user, account.UserId).Error)
	assert.True(t, strings.HasPrefix(user.Username, "pa_"))
	assert.LessOrEqual(t, len(user.Username), 20)
	assert.Empty(t, user.Password)
	assert.Empty(t, user.Email)
	assert.Zero(t, user.Quota, "sub-accounts get no sign-up bonus")
	assert.Zero(t, user.InviterId)
	assert.Equal(t, "partner_kede", user.Group)
	assert.Len(t, user.AffCode, 16)

	var events []WalletRefundCreditEvent
	require.NoError(t, DB.Where("user_id = ?", user.Id).Find(&events).Error)
	require.Len(t, events, 1)
	assert.Equal(t, walletRefundOpening, events[0].Kind)
	assert.Equal(t, "registration", events[0].SourceType)
	assert.Zero(t, events[0].Quota)
	var logs int64
	require.NoError(t, DB.Model(&Log{}).Where("user_id = ?", user.Id).Count(&logs).Error)
	assert.Zero(t, logs, "no sign-up bonus log")

	assert.True(t, token.UnlimitedQuota)
	assert.Equal(t, int64(-1), token.ExpiredTime)
	assert.Equal(t, "auto", token.Group)
	groups, err := token.GetAutoGroups()
	require.NoError(t, err)
	assert.Equal(t, []string{"partner_kede", "default"}, groups)

	other, _, _, err := issueCredential(partnerOwner(client, strings.ToUpper(partnerTestUserID)), partnerKey(t))
	require.NoError(t, err)
	assert.NotEqual(t, account.Id, other.Id, "external IDs are case-sensitive")
}

func TestPartnerAccountCreationGuards(t *testing.T) {
	tests := []struct {
		name   string
		mutate func(*PartnerServerConfig)
		seed   int
		want   error
	}{
		{name: "server access disabled", mutate: func(c *PartnerServerConfig) { c.Enabled = false }, want: ErrPartnerServerUnavailable},
		{name: "account cap reached", mutate: func(c *PartnerServerConfig) { c.MaxAccounts = 1 }, seed: 1, want: ErrPartnerAccountLimit},
		{name: "creation rate reached", mutate: func(c *PartnerServerConfig) { c.AccountsPerMinute = 1 }, seed: 1, want: ErrPartnerAccountRateLimited},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			usePartnerAccountTestDB(t)
			client := seedPartnerServer(t, tt.mutate)
			for i := range tt.seed {
				_, _, _, err := issueCredential(partnerOwner(client, fmt.Sprintf("kede-seed-%030d", i)), partnerKey(t))
				require.NoError(t, err)
			}
			_, _, _, err := issueCredential(partnerOwner(client, partnerTestUserID), partnerKey(t))
			require.ErrorIs(t, err, tt.want)
			count, err := CountPartnerAccounts(client.ClientId)
			require.NoError(t, err)
			assert.Equal(t, int64(tt.seed), count)
			var users int64
			require.NoError(t, DB.Model(&User{}).Count(&users).Error)
			assert.Equal(t, int64(tt.seed), users, "a refused creation leaves no user behind")
		})
	}

	t.Run("suspended partner", func(t *testing.T) {
		usePartnerAccountTestDB(t)
		client := seedPartnerServer(t, nil)
		_, err := SetPartnerOAuthClientStatus(client.ClientId, PartnerOAuthClientStatusDisabled)
		require.NoError(t, err)
		_, _, _, err = issueCredential(partnerOwner(client, partnerTestUserID), partnerKey(t))
		require.ErrorIs(t, err, ErrPartnerServerUnavailable)
	})
}

func TestPartnerAccountConcurrentFirstUseCreatesOneAccount(t *testing.T) {
	if usePartnerAccountTestDB(t) != common.DatabaseTypePostgreSQL {
		t.Skip("row-lock concurrency needs TEST_POSTGRES_DSN")
	}
	client := seedPartnerServer(t, nil)
	var wg sync.WaitGroup
	keys := make([]string, 8)
	errs := make([]error, 8)
	for i := range 8 {
		wg.Go(func() {
			_, token, _, err := issueCredential(partnerOwner(client, partnerTestUserID), partnerKey(t))
			errs[i] = err
			if token != nil {
				keys[i] = token.Key
			}
		})
	}
	wg.Wait()
	for i := range errs {
		require.NoError(t, errs[i])
		assert.Equal(t, keys[0], keys[i])
	}
	var accounts, users, tokens int64
	require.NoError(t, DB.Model(&PartnerAccount{}).Count(&accounts).Error)
	require.NoError(t, DB.Model(&User{}).Count(&users).Error)
	require.NoError(t, DB.Model(&Token{}).Count(&tokens).Error)
	assert.Equal(t, []int64{1, 1, 1}, []int64{accounts, users, tokens})
}

func rotation(t *testing.T, key string, immediately bool) PartnerAccountRotation {
	t.Helper()
	mode := "after_grace"
	if immediately {
		mode = "immediately"
	}
	return PartnerAccountRotation{KeyHash: partnerHash(key), RequestHash: partnerHash(mode), Immediately: immediately, Key: partnerKey(t)}
}

func loadToken(t *testing.T, id int) Token {
	t.Helper()
	var token Token
	require.NoError(t, DB.Unscoped().First(&token, id).Error)
	return token
}

func TestPartnerAccountRotation(t *testing.T) {
	usePartnerAccountTestDB(t)
	client := seedPartnerServer(t, nil)
	_, first, _, err := issueCredential(partnerOwner(client, partnerTestUserID), partnerKey(t))
	require.NoError(t, err)

	before := common.GetTimestamp()
	graced, err := RotatePartnerAccountCredential(client.ClientId, partnerTestUserID, rotation(t, "rotate-1", false))
	require.NoError(t, err)
	assert.NotEqual(t, first.Key, graced.Token.Key)
	old := loadToken(t, first.Id)
	assert.Equal(t, common.TokenStatusEnabled, old.Status, "a graced key keeps working")
	assert.GreaterOrEqual(t, old.ExpiredTime, before+PartnerAccountKeyGraceSeconds)
	assert.Equal(t, old.ExpiredTime, graced.OldKeyExpiresAt)

	replay, err := RotatePartnerAccountCredential(client.ClientId, partnerTestUserID, rotation(t, "rotate-1", false))
	require.NoError(t, err)
	assert.True(t, replay.Replayed)
	assert.Equal(t, graced.Token.Key, replay.Token.Key, "a retried rotation returns the key it issued")

	conflict := rotation(t, "rotate-1", true)
	_, err = RotatePartnerAccountCredential(client.ClientId, partnerTestUserID, conflict)
	require.ErrorIs(t, err, ErrPartnerAccountIdempotencyConflict)

	second, err := RotatePartnerAccountCredential(client.ClientId, partnerTestUserID, rotation(t, "rotate-2", false))
	require.NoError(t, err)
	assert.Equal(t, common.TokenStatusDisabled, loadToken(t, first.Id).Status, "the key still in grace is disabled, so at most two keys work")
	assert.Equal(t, common.TokenStatusEnabled, loadToken(t, graced.Token.Id).Status)

	immediate, err := RotatePartnerAccountCredential(client.ClientId, partnerTestUserID, rotation(t, "rotate-3", true))
	require.NoError(t, err)
	assert.Zero(t, immediate.OldKeyExpiresAt)
	assert.Equal(t, common.TokenStatusDisabled, loadToken(t, second.Token.Id).Status)
	assert.Equal(t, common.TokenStatusDisabled, loadToken(t, graced.Token.Id).Status)
	assert.Equal(t, common.TokenStatusEnabled, loadToken(t, immediate.Token.Id).Status)

	_, err = RotatePartnerAccountCredential(client.ClientId, "kede-unknown-00000000000000000000000", rotation(t, "rotate-4", true))
	require.ErrorIs(t, err, ErrPartnerAccountNotFound, "rotation never creates an account")
}

func userStatus(t *testing.T, id int) int {
	t.Helper()
	var user User
	require.NoError(t, DB.Unscoped().Select("status").First(&user, id).Error)
	return user.Status
}

func TestPartnerAccountStatusChanges(t *testing.T) {
	usePartnerAccountTestDB(t)
	client := seedPartnerServer(t, nil)
	account, _, _, err := issueCredential(partnerOwner(client, partnerTestUserID), partnerKey(t))
	require.NoError(t, err)

	_, changed, err := SetPartnerAccountEnabledByPartner(client.ClientId, partnerTestUserID, false)
	require.NoError(t, err)
	assert.Equal(t, []int{account.UserId}, changed)
	assert.Equal(t, common.UserStatusDisabled, userStatus(t, account.UserId))
	_, _, _, err = issueCredential(partnerOwner(client, partnerTestUserID), partnerKey(t))
	require.ErrorIs(t, err, ErrPartnerAccountInactive)

	_, changed, err = SetPartnerAccountEnabledByPartner(client.ClientId, partnerTestUserID, true)
	require.NoError(t, err)
	assert.Equal(t, []int{account.UserId}, changed)
	assert.Equal(t, common.UserStatusEnabled, userStatus(t, account.UserId))

	isSubAccount, changed, err := SetPartnerAccountAdminDisabled(account.UserId, true)
	require.NoError(t, err)
	assert.True(t, isSubAccount)
	assert.Equal(t, []int{account.UserId}, changed)
	_, _, err = SetPartnerAccountEnabledByPartner(client.ClientId, partnerTestUserID, true)
	require.ErrorIs(t, err, ErrPartnerAccountAdminDisabled, "a partner cannot undo an administrator's disable")
	isSubAccount, _, err = SetPartnerAccountAdminDisabled(-1, true)
	require.NoError(t, err)
	assert.False(t, isSubAccount, "other users are left alone")

	// Each switch only clears itself: the partner's disable survives an
	// administrator's re-enable, and the reverse.
	_, _, err = SetPartnerAccountEnabledByPartner(client.ClientId, partnerTestUserID, false)
	require.NoError(t, err)
	_, _, err = SetPartnerAccountAdminDisabled(account.UserId, false)
	require.NoError(t, err)
	assert.Equal(t, common.UserStatusDisabled, userStatus(t, account.UserId), "the partner still has it disabled")
	_, _, err = SetPartnerAccountEnabledByPartner(client.ClientId, partnerTestUserID, true)
	require.NoError(t, err)
	assert.Equal(t, common.UserStatusEnabled, userStatus(t, account.UserId))
}

func runSuspension(t *testing.T, clientID string) {
	t.Helper()
	var after int64
	for {
		batch, err := ReconcilePartnerAccountSuspensionBatch(clientID, after, 2)
		require.NoError(t, err)
		after = batch.LastId
		if batch.Done {
			return
		}
	}
}

func TestPartnerAccountSuspensionRestoresOnlyWhatItDisabled(t *testing.T) {
	usePartnerAccountTestDB(t)
	client := seedPartnerServer(t, nil)
	ids := map[string]int{}
	for _, name := range []string{"active", "partner-off", "admin-off"} {
		eid := "kede-" + name + strings.Repeat("0", 32-len(name))
		account, _, _, err := issueCredential(partnerOwner(client, eid), partnerKey(t))
		require.NoError(t, err)
		ids[name] = account.UserId
		switch name {
		case "partner-off":
			_, _, err = SetPartnerAccountEnabledByPartner(client.ClientId, eid, false)
			require.NoError(t, err)
		case "admin-off":
			_, _, err = SetPartnerAccountAdminDisabled(account.UserId, true)
			require.NoError(t, err)
		}
	}

	_, err := SetPartnerOAuthClientStatus(client.ClientId, PartnerOAuthClientStatusDisabled)
	require.NoError(t, err)
	runSuspension(t, client.ClientId)
	for name, id := range ids {
		assert.Equal(t, common.UserStatusDisabled, userStatus(t, id), name)
	}
	// Enabling an account while suspended keeps its user disabled until resume.
	_, changed, err := SetPartnerAccountEnabledByPartner(client.ClientId, "kede-partner-off"+strings.Repeat("0", 21), true)
	require.NoError(t, err)
	assert.Empty(t, changed)
	assert.Equal(t, common.UserStatusDisabled, userStatus(t, ids["partner-off"]))

	_, err = SetPartnerOAuthClientStatus(client.ClientId, PartnerOAuthClientStatusEnabled)
	require.NoError(t, err)
	runSuspension(t, client.ClientId)
	assert.Equal(t, common.UserStatusEnabled, userStatus(t, ids["active"]))
	assert.Equal(t, common.UserStatusEnabled, userStatus(t, ids["partner-off"]), "enabled during suspension")
	assert.Equal(t, common.UserStatusDisabled, userStatus(t, ids["admin-off"]), "an administrator's disable survives resume")
}

func TestPartnerAccountRevokeAllKeys(t *testing.T) {
	usePartnerAccountTestDB(t)
	client := seedPartnerServer(t, nil)
	_, first, _, err := issueCredential(partnerOwner(client, partnerTestUserID), partnerKey(t))
	require.NoError(t, err)
	graced, err := RotatePartnerAccountCredential(client.ClientId, partnerTestUserID, rotation(t, "rotate-1", false))
	require.NoError(t, err)

	batch, err := RevokePartnerAccountKeysBatch(client.ClientId, 0, 100)
	require.NoError(t, err)
	assert.True(t, batch.Done)
	assert.Equal(t, common.TokenStatusDisabled, loadToken(t, first.Id).Status)
	assert.Equal(t, common.TokenStatusDisabled, loadToken(t, graced.Token.Id).Status)

	_, _, _, err = issueCredential(partnerOwner(client, partnerTestUserID), partnerKey(t))
	require.ErrorIs(t, err, ErrPartnerAccountCredentialDisabled, "a revoked key is never silently replaced")
	fresh, err := RotatePartnerAccountCredential(client.ClientId, partnerTestUserID, rotation(t, "rotate-2", true))
	require.NoError(t, err)
	assert.Equal(t, common.TokenStatusEnabled, loadToken(t, fresh.Token.Id).Status)
	_, current, _, err := issueCredential(partnerOwner(client, partnerTestUserID), partnerKey(t))
	require.NoError(t, err)
	assert.Equal(t, fresh.Token.Key, current.Key)
}

func partnerOrderInput(client *PartnerOAuthClient, externalUserID, key string) PartnerAccountPaymentOrderInput {
	return PartnerAccountPaymentOrderInput{
		Owner:              partnerOwner(client, externalUserID),
		IdempotencyKeyHash: partnerHash(key),
		RequestHash:        partnerHash("10|alipay"),
		RequestedAmount:    10,
		StoredAmount:       10,
		Price:              func(string) (float64, error) { return 70, nil },
		PaymentMethod:      "alipay",
		PaymentProvider:    PaymentProviderEpay,
		CreditedQuota:      5_000_000,
		BaseQuota:          5_000_000,
		Metadata:           CashbackRequestMetadata{FaceAmount: 10, QuotaPerFaceUnit: "500000", RequestIP: "203.0.113.9"},
	}
}

func partnerOrderLimits(maxPending int64) PartnerAccountPaymentLimits {
	now := common.GetTimestamp()
	return PartnerAccountPaymentLimits{
		AccountRecentSince: now - 3600, AccountMaxRecent: 20,
		AccountPendingSince: now - 1800, AccountMaxPending: maxPending,
		ClientRecentSince: now - 3600, ClientMaxRecent: 2000,
	}
}

func TestPartnerAccountPaymentOrders(t *testing.T) {
	usePartnerAccountTestDB(t)
	client := seedPartnerServer(t, nil)

	created, err := CreatePartnerAccountPaymentOrder(partnerOrderInput(client, partnerTestUserID, "order-key-1"), partnerOrderLimits(5))
	require.NoError(t, err)
	assert.True(t, created.AccountCreated)
	order, topUp := created.Order, created.TopUp
	account, err := GetPartnerAccount(client.ClientId, partnerTestUserID)
	require.NoError(t, err, "the order created the sub-account")
	assert.Equal(t, account.UserId, topUp.UserId)
	assert.Equal(t, common.TopUpStatusPending, topUp.Status)
	assert.Equal(t, topUp.Id, order.TopUpId)

	var context CashbackOrderContext
	require.NoError(t, DB.Where("top_up_id = ?", topUp.Id).First(&context).Error)
	assert.Equal(t, CashbackIneligiblePartnerOAuth, context.IneligibleReason)
	assert.Empty(t, context.RequestIP, "the partner server's address is not payer evidence")

	_, err = CreatePartnerAccountPaymentOrder(partnerOrderInput(client, partnerTestUserID, "order-key-1"), partnerOrderLimits(5))
	require.ErrorIs(t, err, ErrPartnerAccountPaymentIdempotencyRace)
	_, err = CreatePartnerAccountPaymentOrder(partnerOrderInput(client, "kede-other-00000000000000000000000000", "order-key-1"), partnerOrderLimits(5))
	require.ErrorIs(t, err, ErrPartnerAccountPaymentIdempotencyRace, "keys are scoped to the partner, not the account")

	_, err = CreatePartnerAccountPaymentOrder(partnerOrderInput(client, partnerTestUserID, "order-key-2"), partnerOrderLimits(1))
	require.ErrorIs(t, err, ErrPartnerAccountPaymentRateLimited)

	require.NoError(t, SetPartnerAccountPaymentCheckout(order.Id, "https://qr.example/abc", ""))
	stored, _, err := FindPartnerAccountPaymentOrderByIdempotency(client.ClientId, partnerHash("order-key-1"))
	require.NoError(t, err)
	assert.Equal(t, "https://qr.example/abc", stored.QRCode)

	_, _, err = GetPartnerAccountPaymentOrder(client.ClientId, topUp.TradeNo)
	require.NoError(t, err)
	other := seedPartnerServer(t, nil)
	_, _, err = GetPartnerAccountPaymentOrder(other.ClientId, topUp.TradeNo)
	require.ErrorIs(t, err, ErrPartnerAccountPaymentOrderNotFound)

	_, _, err = SetPartnerAccountEnabledByPartner(client.ClientId, partnerTestUserID, false)
	require.NoError(t, err)
	_, err = CreatePartnerAccountPaymentOrder(partnerOrderInput(client, partnerTestUserID, "order-key-3"), partnerOrderLimits(5))
	require.ErrorIs(t, err, ErrPartnerAccountInactive)
}

func TestPartnerServerSecretsAndTokens(t *testing.T) {
	usePartnerAccountTestDB(t)
	client := seedPartnerServer(t, nil)
	first, err := CreatePartnerServerSecret(client.ClientId, partnerHash("pss_one"))
	require.NoError(t, err)
	_, err = CreatePartnerServerSecret(client.ClientId, partnerHash("pss_two"))
	require.NoError(t, err)
	_, err = CreatePartnerServerSecret(client.ClientId, partnerHash("pss_three"))
	require.ErrorIs(t, err, ErrPartnerServerSecretLimit)

	token := &PartnerServerToken{TokenHash: partnerHash("pst_one"), ClientId: client.ClientId, SecretId: first.Id, ExpiresAt: common.GetTimestamp() + 3600}
	require.NoError(t, CreatePartnerServerToken(token))
	require.NoError(t, RevokePartnerServerSecret(client.ClientId, first.Id))
	_, err = FindPartnerServerToken(partnerHash("pst_one"))
	require.ErrorIs(t, err, ErrPartnerServerTokenNotFound, "revoking a secret deletes its tokens")
	err = CreatePartnerServerToken(&PartnerServerToken{TokenHash: partnerHash("pst_two"), ClientId: client.ClientId, SecretId: first.Id, ExpiresAt: common.GetTimestamp() + 3600})
	require.ErrorIs(t, err, ErrPartnerServerSecretNotFound)
	_, err = CreatePartnerServerSecret(client.ClientId, partnerHash("pss_three"))
	require.NoError(t, err, "a revoked secret frees its slot")

	require.NoError(t, RevokePartnerServerSecret(client.ClientId, first.Id), "revoking twice is a no-op")
}

func TestDeletePartnerClientRefusedWhileItOwnsAccounts(t *testing.T) {
	usePartnerAccountTestDB(t)
	client := seedPartnerServer(t, nil)
	_, _, _, err := issueCredential(partnerOwner(client, partnerTestUserID), partnerKey(t))
	require.NoError(t, err)
	_, err = DeletePartnerOAuthClient(client.ClientId)
	require.ErrorIs(t, err, ErrPartnerOAuthClientHasAccounts)
	_, err = GetPartnerOAuthClientByClientID(client.ClientId)
	require.NoError(t, err)
}

func TestTwoFAStatsLeaveOutPartnerSubAccounts(t *testing.T) {
	usePartnerAccountTestDB(t)
	client := seedPartnerServer(t, nil)
	require.NoError(t, DB.Create(&User{Username: "regular-user", Password: "x", Status: common.UserStatusEnabled, AffCode: "regular", AuthVersion: 1}).Error)
	_, _, _, err := issueCredential(partnerOwner(client, partnerTestUserID), partnerKey(t))
	require.NoError(t, err)
	stats, err := GetTwoFAStats()
	require.NoError(t, err)
	assert.EqualValues(t, 1, stats["total_users"], "sub-accounts can never enable 2FA")
}

func TestPartnerAccountUsageIsScopedBoundedAndPaged(t *testing.T) {
	usePartnerAccountTestDB(t)
	client := seedPartnerServer(t, nil)
	account, _, _, err := issueCredential(partnerOwner(client, partnerTestUserID), partnerKey(t))
	require.NoError(t, err)
	now := common.GetTimestamp()
	logs := []Log{
		{UserId: account.UserId, Type: LogTypeConsume, CreatedAt: now - 30, ModelName: "gpt-a", PromptTokens: 10, CompletionTokens: 5, Quota: 100, Ip: "203.0.113.9", Content: "secret prompt", Other: `{"admin_info":{}}`, ChannelId: 7, RequestId: "req-1"},
		{UserId: account.UserId, Type: LogTypeConsume, CreatedAt: now - 20, ModelName: "gpt-b", Quota: 200, RequestId: "req-2"},
		{UserId: account.UserId, Type: LogTypeConsume, CreatedAt: now - 10, ModelName: "gpt-c", Quota: 300, RequestId: "req-3"},
		{UserId: account.UserId, Type: LogTypeTopup, CreatedAt: now - 5, Quota: 999},
		{UserId: account.UserId, Type: LogTypeConsume, CreatedAt: now - 100000, ModelName: "too-old", Quota: 1},
		{UserId: account.UserId + 1000, Type: LogTypeConsume, CreatedAt: now - 15, ModelName: "someone-else", Quota: 1},
	}
	require.NoError(t, LOG_DB.Create(&logs).Error)

	page, more, err := ListPartnerAccountUsage(account.UserId, now-3600, now, 0, 2)
	require.NoError(t, err)
	assert.True(t, more)
	require.Len(t, page, 2)
	assert.Equal(t, "gpt-c", page[0].ModelName, "newest first")
	assert.Equal(t, "gpt-b", page[1].ModelName)
	last, more, err := ListPartnerAccountUsage(account.UserId, now-3600, now, 2, 2)
	require.NoError(t, err)
	assert.False(t, more)
	require.Len(t, last, 1)
	assert.Equal(t, PartnerAccountUsage{CreatedAt: now - 30, ModelName: "gpt-a", PromptTokens: 10, CompletionTokens: 5, Quota: 100, RequestId: "req-1"}, last[0],
		"only allowlisted columns, no top-ups, other users or out-of-range rows")
}

func TestUserListShowsAndFiltersPartnerOwners(t *testing.T) {
	usePartnerAccountTestDB(t)
	client := seedPartnerServer(t, nil)
	regular := &User{Username: "regular-user", Password: "x", Status: common.UserStatusEnabled, AffCode: "regular", AuthVersion: 1}
	require.NoError(t, DB.Create(regular).Error)
	account, _, _, err := issueCredential(partnerOwner(client, partnerTestUserID), partnerKey(t))
	require.NoError(t, err)

	owners, err := PartnerAccountOwners([]int{regular.Id, account.UserId})
	require.NoError(t, err)
	assert.NotContains(t, owners, regular.Id)
	assert.Equal(t, client.ClientId, owners[account.UserId].ClientId)
	assert.Equal(t, client.Name, owners[account.UserId].Name)

	users, total, err := SearchUsers("", "", nil, nil, client.ClientId, 0, 10)
	require.NoError(t, err)
	require.EqualValues(t, 1, total)
	assert.Equal(t, account.UserId, users[0].Id)
	_, all, err := SearchUsers("", "", nil, nil, "", 0, 10)
	require.NoError(t, err)
	assert.EqualValues(t, 2, all)
}

func TestPartnerSuspensionCannotBeBypassedByAdminEnable(t *testing.T) {
	usePartnerAccountTestDB(t)
	client := seedPartnerServer(t, nil)
	account, _, _, err := issueCredential(partnerOwner(client, partnerTestUserID), partnerKey(t))
	require.NoError(t, err)

	changed, err := SetPartnerOAuthClientStatus(client.ClientId, PartnerOAuthClientStatusDisabled)
	require.NoError(t, err)
	assert.True(t, changed)
	stored, err := GetPartnerOAuthClientByClientID(client.ClientId)
	require.NoError(t, err)
	assert.Equal(t, PartnerOAuthClientStatusDisabled, stored.Status, "client status and suspension change together")
	runSuspension(t, client.ClientId)
	assert.Equal(t, common.UserStatusDisabled, userStatus(t, account.UserId))

	_, _, err = SetPartnerAccountAdminDisabled(account.UserId, false)
	require.NoError(t, err)
	assert.Equal(t, common.UserStatusDisabled, userStatus(t, account.UserId), "an administrator's enable does not lift a partner suspension")

	_, err = SetPartnerOAuthClientStatus(client.ClientId, PartnerOAuthClientStatusEnabled)
	require.NoError(t, err)
	runSuspension(t, client.ClientId)
	assert.Equal(t, common.UserStatusEnabled, userStatus(t, account.UserId))
}

func TestPartnerKeyRevocationMarkerSurvivesUntilItsOwnRunFinishes(t *testing.T) {
	usePartnerAccountTestDB(t)
	client := seedPartnerServer(t, nil)
	first, err := RequestPartnerKeyRevocation(client.ClientId)
	require.NoError(t, err)
	_, pending, err := PartnerServerJobsToResume()
	require.NoError(t, err)
	assert.Equal(t, []string{client.ClientId}, pending, "a restart resumes the pending revocation")

	require.NoError(t, DB.Model(&PartnerServerConfig{}).Where("client_id = ?", client.ClientId).Update("key_revocation_requested_at", first+10).Error)
	require.NoError(t, FinishPartnerKeyRevocation(client.ClientId, first))
	requestedAt, err := PartnerKeyRevocationRequestedAt(client.ClientId)
	require.NoError(t, err)
	assert.Equal(t, first+10, requestedAt, "an older run does not clear a newer request")

	require.NoError(t, FinishPartnerKeyRevocation(client.ClientId, first+10))
	requestedAt, err = PartnerKeyRevocationRequestedAt(client.ClientId)
	require.NoError(t, err)
	assert.Zero(t, requestedAt)
}

func TestPartnerPaymentCheckoutIsClaimedOnce(t *testing.T) {
	usePartnerAccountTestDB(t)
	client := seedPartnerServer(t, nil)
	created, err := CreatePartnerAccountPaymentOrder(partnerOrderInput(client, partnerTestUserID, "order-claim-1"), partnerOrderLimits(5))
	require.NoError(t, err)
	now := common.GetTimestamp()

	claimed, err := ClaimPartnerAccountPaymentCheckout(created.Order.Id, now, now-15)
	require.NoError(t, err)
	assert.False(t, claimed, "the creating request holds the claim")

	later := now + 20
	claimed, err = ClaimPartnerAccountPaymentCheckout(created.Order.Id, later, later-15)
	require.NoError(t, err)
	assert.True(t, claimed, "a stale claim can be taken over")
	claimed, err = ClaimPartnerAccountPaymentCheckout(created.Order.Id, later, later-15)
	require.NoError(t, err)
	assert.False(t, claimed, "but only by one caller")

	require.NoError(t, SetPartnerAccountPaymentCheckout(created.Order.Id, "qr", ""))
	claimed, err = ClaimPartnerAccountPaymentCheckout(created.Order.Id, later+100, later+85)
	require.NoError(t, err)
	assert.False(t, claimed, "an order with a checkout is never claimed again")
}

func TestPartnerAccountPricingAndKeysFollowTheUsersGroup(t *testing.T) {
	usePartnerAccountTestDB(t)
	client := seedPartnerServer(t, nil)
	_, _, _, err := issueCredential(partnerOwner(client, partnerTestUserID), partnerKey(t))
	require.NoError(t, err)
	require.NoError(t, SavePartnerServerConfig(&PartnerServerConfig{ClientId: client.ClientId, Enabled: true, AccountGroup: "vip",
		MaxAccounts: PartnerServerDefaultMaxAccounts, AccountsPerMinute: PartnerServerDefaultAccountsPerMinute}))

	var pricedFor string
	input := partnerOrderInput(client, partnerTestUserID, "order-group-1")
	input.Price = func(group string) (float64, error) {
		pricedFor = group
		return 70, nil
	}
	_, err = CreatePartnerAccountPaymentOrder(input, partnerOrderLimits(5))
	require.NoError(t, err)
	assert.Equal(t, "partner_kede", pricedFor, "existing sub-accounts keep their own group's price")

	rotated, err := RotatePartnerAccountCredential(client.ClientId, partnerTestUserID, rotation(t, "rotate-group", true))
	require.NoError(t, err)
	groups, err := rotated.Token.GetAutoGroups()
	require.NoError(t, err)
	assert.Equal(t, []string{"partner_kede", "default"}, groups)

	newcomer, _, _, err := issueCredential(partnerOwner(client, "kede-newcomer-0000000000000000000000"), partnerKey(t))
	require.NoError(t, err)
	var user User
	require.NoError(t, DB.First(&user, newcomer.UserId).Error)
	assert.Equal(t, "vip", user.Group, "new sub-accounts join the partner's current group")
}
