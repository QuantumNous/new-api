package model

import (
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm/schema"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func seedPartnerOAuthUser(t *testing.T) *User {
	t.Helper()
	user := &User{
		Username:    "partner-user",
		Password:    "unused",
		Role:        common.RoleCommonUser,
		Status:      common.UserStatusEnabled,
		Group:       "default",
		AuthVersion: 1,
	}
	require.NoError(t, DB.Create(user).Error)
	return user
}

func seedPartnerOAuthClient(t *testing.T) *PartnerOAuthClient {
	t.Helper()
	client := &PartnerOAuthClient{
		Name:            "Example Assistant",
		TokenAuthMethod: PartnerOAuthTokenAuthMethodBasic,
		SecretHash:      HashPartnerOAuthSecret("pcs_example"),
		RedirectURIs:    `["https://assistant.example.com/oauth/callback"]`,
		Scopes:          "account:read credential:read offline_access",
		Status:          PartnerOAuthClientStatusEnabled,
	}
	require.NoError(t, CreatePartnerOAuthClient(client))
	return client
}

func TestPartnerOAuthTablesMigrate(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&PartnerOAuthClient{}, &PartnerOAuthBinding{}, &PartnerOAuthToken{}))
	require.NoError(t, DB.AutoMigrate(&PartnerOAuthClient{}, &PartnerOAuthBinding{}, &PartnerOAuthToken{}))
}

func TestPartnerOAuthAuthorizationLogStoreMigration(t *testing.T) {
	if os.Getenv("PARTNER_OAUTH_AUDIT_DB_ISOLATED") != "1" {
		t.Skip("requires task-owned Docker runner and disposable databases")
	}
	for _, dialect := range []struct {
		name string
		dsn  string
		kind common.DatabaseType
		open func(string) gorm.Dialector
	}{
		{"sqlite", ":memory:", common.DatabaseTypeSQLite, func(dsn string) gorm.Dialector { return sqlite.Open(dsn) }},
		{"mysql", os.Getenv("TEST_MYSQL_DSN"), common.DatabaseTypeMySQL, func(dsn string) gorm.Dialector { return mysql.Open(dsn) }},
		{"postgres", os.Getenv("TEST_POSTGRES_DSN"), common.DatabaseTypePostgreSQL, func(dsn string) gorm.Dialector {
			return postgres.New(postgres.Config{DSN: dsn, PreferSimpleProtocol: true})
		}},
	} {
		t.Run(dialect.name, func(t *testing.T) {
			if strings.TrimSpace(dialect.dsn) == "" {
				t.Skip("task-isolated database DSN not configured")
			}
			for _, scenario := range []string{"fresh", "upgrade"} {
				t.Run(scenario, func(t *testing.T) {
					prefix := "poa_f_"
					if scenario == "upgrade" {
						prefix = "poa_u_"
					}
					logDB, err := gorm.Open(dialect.open(dialect.dsn), &gorm.Config{NamingStrategy: schema.NamingStrategy{TablePrefix: prefix}})
					require.NoError(t, err)
					sqlDB, err := logDB.DB()
					require.NoError(t, err)
					t.Cleanup(func() { _ = sqlDB.Close() })
					// LOG_DB is independent of DB; only the log store receives the new table.
					mainDB, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
					require.NoError(t, err)
					oldDB, oldLog, oldKind := DB, LOG_DB, common.LogDatabaseType()
					DB, LOG_DB = mainDB, logDB
					common.SetLogDatabaseType(dialect.kind)
					t.Cleanup(func() { DB, LOG_DB = oldDB, oldLog; common.SetLogDatabaseType(oldKind) })
					require.NoError(t, logDB.Migrator().DropTable(&PartnerOauthAuthorizationLog{}, &AuditLog{}))
					if scenario == "upgrade" {
						require.NoError(t, MigrateAuditLogs())
						require.NoError(t, logDB.Create(&AuditLog{EventId: "legacy-token", Category: AuditCategorySecurity, Action: "partner_oauth.token.issue"}).Error)
					}
					require.NoError(t, MigratePartnerOAuthAuthorizationLogs())
					require.NoError(t, MigratePartnerOAuthAuthorizationLogs())
					assert.True(t, logDB.Migrator().HasTable(&PartnerOauthAuthorizationLog{}))
					assert.False(t, mainDB.Migrator().HasTable(&PartnerOauthAuthorizationLog{}))
					assert.Equal(t, prefix+"partner_oauth_authorization_logs", logDB.NamingStrategy.TableName("PartnerOauthAuthorizationLog"))
					var before int64
					require.NoError(t, logDB.Model(&PartnerOauthAuthorizationLog{}).Count(&before).Error)
					assert.Zero(t, before) // Old generic events are not backfilled.
					RecordPartnerOAuthAuthorizationLog(nil, PartnerOauthAuthorizationLog{
						Action: "partner_oauth.token.issue", Success: true, Status: 200,
						ClientId: "pc_0123456789abcdef0123456789abcdef", BindingId: "bnd_0123456789abcdef0123456789abcdef", TargetUserId: 7,
					})
					items, total, err := GetPartnerOAuthAuthorizationLogs(PartnerOauthAuthorizationLogFilter{TargetUserId: 7}, 0, 10)
					require.NoError(t, err)
					assert.Equal(t, int64(1), total)
					require.Len(t, items, 1)
					assert.NotEmpty(t, items[0].RequestId)
					RecordPartnerOAuthAuthorizationLogs(nil, []PartnerOauthAuthorizationLog{
						{Action: "partner_oauth.binding.client_delete", Success: true, Status: 200, Reason: "client_deleted", TargetUserId: 8,
							ClientId: "pc_0123456789abcdef0123456789abcdef", BindingId: "bnd_00000000000000000000000000000001"},
						{Action: "partner_oauth.binding.client_delete", Success: true, Status: 200, Reason: "client_deleted", TargetUserId: 8,
							ClientId: "pc_0123456789abcdef0123456789abcdef", BindingId: "bnd_00000000000000000000000000000002"},
					})
					batch, batchTotal, err := GetPartnerOAuthAuthorizationLogs(PartnerOauthAuthorizationLogFilter{TargetUserId: 8}, 0, 10)
					require.NoError(t, err)
					assert.Equal(t, int64(2), batchTotal)
					require.Len(t, batch, 2)
					assert.NotEqual(t, batch[0].EventId, batch[1].EventId)
					if scenario == "upgrade" {
						var legacy AuditLog
						require.NoError(t, logDB.Where("event_id = ?", "legacy-token").First(&legacy).Error)
						assert.Equal(t, "partner_oauth.token.issue", legacy.Action)
					}
					require.Error(t, logDB.Create(&PartnerOauthAuthorizationLog{EventId: items[0].EventId}).Error)
				})
			}
		})
	}
}

func TestCreatePartnerOAuthBindingWithTokens(t *testing.T) {
	truncateTables(t)
	user := seedPartnerOAuthUser(t)
	client := seedPartnerOAuthClient(t)

	var binding *PartnerOAuthBinding
	err := DB.Transaction(func(tx *gorm.DB) error {
		created, createErr := CreatePartnerOAuthBindingWithTx(tx, PartnerOAuthBindingCreate{
			ClientId:            client.ClientId,
			UserId:              user.Id,
			UserAuthVersion:     user.AuthVersion,
			Scope:               "account:read credential:read offline_access",
			AuthorizationFlowId: 11,
			ExpiresAt:           time.Now().Add(30 * 24 * time.Hour).Unix(),
			AccessTokenHash:     HashPartnerOAuthToken("oa_access"),
			AccessExpiresAt:     time.Now().Add(time.Hour).Unix(),
			RefreshTokenHash:    HashPartnerOAuthToken("or_refresh"),
		})
		binding = created
		return createErr
	})
	require.NoError(t, err)
	require.NotNil(t, binding)
	assert.Equal(t, PartnerOAuthBindingStatusActive, binding.Status)

	found, err := FindPartnerOAuthToken(HashPartnerOAuthToken("oa_access"))
	require.NoError(t, err)
	assert.Equal(t, PartnerOAuthTokenKindAccess, found.Kind)
	refresh, err := FindPartnerOAuthToken(HashPartnerOAuthToken("or_refresh"))
	require.NoError(t, err)
	assert.Equal(t, PartnerOAuthTokenKindRefresh, refresh.Kind)
}

func TestRotatePartnerOAuthRefreshTokenSingleWinner(t *testing.T) {
	truncateTables(t)
	user := seedPartnerOAuthUser(t)
	client := seedPartnerOAuthClient(t)
	var current *PartnerOAuthToken
	err := DB.Transaction(func(tx *gorm.DB) error {
		binding, createErr := CreatePartnerOAuthBindingWithTx(tx, PartnerOAuthBindingCreate{
			ClientId:         client.ClientId,
			UserId:           user.Id,
			UserAuthVersion:  user.AuthVersion,
			Scope:            "account:read credential:read offline_access",
			ExpiresAt:        time.Now().Add(30 * 24 * time.Hour).Unix(),
			AccessTokenHash:  HashPartnerOAuthToken("oa_old"),
			AccessExpiresAt:  time.Now().Add(time.Hour).Unix(),
			RefreshTokenHash: HashPartnerOAuthToken("or_old"),
		})
		if createErr != nil {
			return createErr
		}
		token, findErr := FindPartnerOAuthTokenWithTx(tx, HashPartnerOAuthToken("or_old"))
		current = token
		_ = binding
		return findErr
	})
	require.NoError(t, err)

	var winners int
	var mu sync.Mutex
	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			rotateErr := DB.Transaction(func(tx *gorm.DB) error {
				token, findErr := FindPartnerOAuthTokenWithTx(tx, HashPartnerOAuthToken("or_old"))
				if findErr != nil {
					return findErr
				}
				return RotatePartnerOAuthRefreshToken(
					tx,
					token,
					HashPartnerOAuthToken("oa_new_"+string(rune('a'+i))),
					HashPartnerOAuthToken("or_new_"+string(rune('a'+i))),
					time.Now().Add(time.Hour).Unix(),
				)
			})
			if rotateErr == nil {
				mu.Lock()
				winners++
				mu.Unlock()
			}
		}(i)
	}
	wg.Wait()
	assert.Equal(t, 1, winners)
	require.NoError(t, DB.First(current, current.Id).Error)
	assert.Equal(t, PartnerOAuthTokenStatusRotated, current.Status)
}

func TestRevokePartnerOAuthBindingDisablesKeyAndIsIdempotent(t *testing.T) {
	truncateTables(t)
	user := seedPartnerOAuthUser(t)
	client := seedPartnerOAuthClient(t)
	token := Token{
		UserId:         user.Id,
		Name:           "Example Assistant",
		Key:            "partner-key-secret",
		Status:         common.TokenStatusEnabled,
		ExpiredTime:    time.Now().Add(24 * time.Hour).Unix(),
		UnlimitedQuota: true,
	}
	require.NoError(t, token.Insert())

	var bindingID string
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		binding, err := CreatePartnerOAuthBindingWithTx(tx, PartnerOAuthBindingCreate{
			ClientId:        client.ClientId,
			UserId:          user.Id,
			UserAuthVersion: user.AuthVersion,
			Scope:           "account:read",
			ExpiresAt:       time.Now().Add(24 * time.Hour).Unix(),
			AccessTokenHash: HashPartnerOAuthToken("oa_revoke"),
			AccessExpiresAt: time.Now().Add(time.Hour).Unix(),
		})
		if err != nil {
			return err
		}
		bindingID = binding.BindingId
		return tx.Model(binding).Update("token_id", token.Id).Error
	}))

	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		return RevokePartnerOAuthBindingWithTx(tx, bindingID, "user_revoked")
	}))
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		return RevokePartnerOAuthBindingWithTx(tx, bindingID, "user_revoked")
	}))

	stored, err := GetPartnerOAuthBindingByBindingID(bindingID)
	require.NoError(t, err)
	assert.Equal(t, PartnerOAuthBindingStatusRevoked, stored.Status)
	var storedToken Token
	require.NoError(t, DB.First(&storedToken, token.Id).Error)
	assert.Equal(t, common.TokenStatusDisabled, storedToken.Status)
}

func TestIssuePartnerOAuthCredentialSingleKeyUnderConcurrency(t *testing.T) {
	truncateTables(t)
	user := seedPartnerOAuthUser(t)
	client := seedPartnerOAuthClient(t)
	var bindingID string
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		binding, err := CreatePartnerOAuthBindingWithTx(tx, PartnerOAuthBindingCreate{
			ClientId:        client.ClientId,
			UserId:          user.Id,
			UserAuthVersion: user.AuthVersion,
			Scope:           "credential:read",
			ExpiresAt:       time.Now().Add(24 * time.Hour).Unix(),
			AccessTokenHash: HashPartnerOAuthToken("oa_cred"),
			AccessExpiresAt: time.Now().Add(time.Hour).Unix(),
		})
		bindingID = binding.BindingId
		return err
	}))

	var wg sync.WaitGroup
	ids := make(chan int, 8)
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			issued, _, err := IssuePartnerOAuthCredential(bindingID, PartnerOAuthCredentialIssue{
				UserId:      user.Id,
				Name:        client.Name,
				ExpiredTime: time.Now().Add(24 * time.Hour).Unix(),
				Key:         "concurrent-key-" + string(rune('a'+i)),
			})
			require.NoError(t, err)
			ids <- issued.Id
		}(i)
	}
	wg.Wait()
	close(ids)
	seen := map[int]struct{}{}
	for id := range ids {
		seen[id] = struct{}{}
	}
	assert.Len(t, seen, 1)
	var count int64
	require.NoError(t, DB.Model(&Token{}).Where("user_id = ?", user.Id).Count(&count).Error)
	assert.Equal(t, int64(1), count)
}

func TestIssuePartnerOAuthCredentialRejectsRevokedBinding(t *testing.T) {
	truncateTables(t)
	user := seedPartnerOAuthUser(t)
	client := seedPartnerOAuthClient(t)
	var bindingID string
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		binding, err := CreatePartnerOAuthBindingWithTx(tx, PartnerOAuthBindingCreate{
			ClientId:        client.ClientId,
			UserId:          user.Id,
			UserAuthVersion: user.AuthVersion,
			Scope:           "credential:read",
			ExpiresAt:       time.Now().Add(24 * time.Hour).Unix(),
			AccessTokenHash: HashPartnerOAuthToken("oa_revoked"),
			AccessExpiresAt: time.Now().Add(time.Hour).Unix(),
		})
		bindingID = binding.BindingId
		return err
	}))
	// The revoke lands after the caller authenticated but before it issues.
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		return RevokePartnerOAuthBindingWithTx(tx, bindingID, "user_revoked")
	}))

	_, _, err := IssuePartnerOAuthCredential(bindingID, PartnerOAuthCredentialIssue{
		UserId:      user.Id,
		Name:        client.Name,
		ExpiredTime: time.Now().Add(24 * time.Hour).Unix(),
		Key:         "key-after-revoke",
	})
	require.ErrorIs(t, err, ErrPartnerOAuthBindingNotFound)
	var count int64
	require.NoError(t, DB.Model(&Token{}).Where("user_id = ?", user.Id).Count(&count).Error)
	assert.Zero(t, count)
}

func TestDeleteExpiredPartnerOAuthTokens(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.Create(&PartnerOAuthToken{
		TokenHash: HashPartnerOAuthToken("oa_old_expired"),
		Kind:      PartnerOAuthTokenKindAccess,
		BindingId: "bnd_old",
		Status:    PartnerOAuthTokenStatusActive,
		ExpiresAt: time.Now().Add(-48 * time.Hour).Unix(),
		CreatedAt: time.Now().Add(-72 * time.Hour).Unix(),
	}).Error)
	require.NoError(t, DB.Create(&PartnerOAuthToken{
		TokenHash: HashPartnerOAuthToken("oa_live"),
		Kind:      PartnerOAuthTokenKindAccess,
		BindingId: "bnd_live",
		Status:    PartnerOAuthTokenStatusActive,
		ExpiresAt: time.Now().Add(time.Hour).Unix(),
		CreatedAt: time.Now().Unix(),
	}).Error)
	require.NoError(t, DeleteExpiredPartnerOAuthTokens(time.Now().Unix()))
	_, err := FindPartnerOAuthToken(HashPartnerOAuthToken("oa_old_expired"))
	assert.ErrorIs(t, err, ErrPartnerOAuthTokenNotFound)
	_, err = FindPartnerOAuthToken(HashPartnerOAuthToken("oa_live"))
	require.NoError(t, err)
}

// TestPartnerOAuthPaymentOrderStore covers the dialect-sensitive parts of
// partner payment orders: the new cashback context column on an existing
// table, rollback of the whole order on an idempotency conflict, and the
// pending-order join. MySQL and PostgreSQL run when their task-isolated DSNs
// are set.
func TestPartnerOAuthPaymentOrderStore(t *testing.T) {
	for _, dialect := range []struct {
		name string
		dsn  string
		kind common.DatabaseType
		open func(string) gorm.Dialector
	}{
		{"sqlite", ":memory:", common.DatabaseTypeSQLite, func(dsn string) gorm.Dialector { return sqlite.Open(dsn) }},
		{"mysql", os.Getenv("TEST_MYSQL_DSN"), common.DatabaseTypeMySQL, func(dsn string) gorm.Dialector { return mysql.Open(dsn) }},
		{"postgres", os.Getenv("TEST_POSTGRES_DSN"), common.DatabaseTypePostgreSQL, func(dsn string) gorm.Dialector {
			return postgres.New(postgres.Config{DSN: dsn, PreferSimpleProtocol: true})
		}},
	} {
		t.Run(dialect.name, func(t *testing.T) {
			if strings.TrimSpace(dialect.dsn) == "" {
				t.Skip("task-isolated database DSN not configured")
			}
			db, err := gorm.Open(dialect.open(dialect.dsn), &gorm.Config{NamingStrategy: schema.NamingStrategy{TablePrefix: "poap_"}})
			require.NoError(t, err)
			sqlDB, err := db.DB()
			require.NoError(t, err)
			sqlDB.SetMaxOpenConns(1)
			models := []any{&User{}, &Option{}, &TopUp{}, &CashbackOrderContext{}, &PartnerOAuthPaymentOrder{}}
			oldDB, oldLog, oldMain, oldLogKind := DB, LOG_DB, common.MainDatabaseType(), common.LogDatabaseType()
			DB, LOG_DB = db, db
			common.SetDatabaseTypes(dialect.kind, dialect.kind)
			t.Cleanup(func() {
				require.NoError(t, db.Migrator().DropTable(models...))
				_ = sqlDB.Close()
				DB, LOG_DB = oldDB, oldLog
				common.SetDatabaseTypes(oldMain, oldLogKind)
			})
			require.NoError(t, db.Migrator().DropTable(models...))

			// A released schema has cashback contexts without ineligible_reason.
			require.NoError(t, db.AutoMigrate(models...))
			require.NoError(t, db.Migrator().DropColumn(&CashbackOrderContext{}, "ineligible_reason"))
			user := &User{Username: "payment-store", Password: "unused", Status: common.UserStatusEnabled, Group: "default", AffCode: "payment-store-aff"}
			require.NoError(t, db.Create(user).Error)
			legacyTopUp := &TopUp{UserId: user.Id, Amount: 1, Money: 7, TradeNo: "legacy-order", PaymentProvider: PaymentProviderEpay, PaymentMethod: "alipay", Status: common.TopUpStatusSuccess}
			require.NoError(t, db.Create(legacyTopUp).Error)
			require.NoError(t, db.Omit("ineligible_reason").Create(&CashbackOrderContext{
				TopUpID: legacyTopUp.Id, TradeNo: legacyTopUp.TradeNo, UserID: user.Id, PaymentProvider: PaymentProviderEpay,
				BaseQuota: 500_000, FaceAmount: 1, QuotaPerFaceUnit: "500000", DeviceSignalStatus: CashbackDeviceSignalMissing,
			}).Error)
			require.NoError(t, db.AutoMigrate(models...))
			require.NoError(t, db.AutoMigrate(models...))
			require.True(t, db.Migrator().HasColumn(&CashbackOrderContext{}, "ineligible_reason"))
			var legacy CashbackOrderContext
			require.NoError(t, db.Where("top_up_id = ?", legacyTopUp.Id).First(&legacy).Error)
			assert.Empty(t, legacy.IneligibleReason)
			assert.Equal(t, 500_000, legacy.BaseQuota)

			newOrder := func(tradeNo, keyHash string) (*PartnerOAuthPaymentOrder, *TopUp, error) {
				topUp := &TopUp{UserId: user.Id, Amount: 10, Money: 70, TradeNo: tradeNo, PaymentProvider: PaymentProviderEpay,
					PaymentMethod: "alipay", CreateTime: time.Now().Unix(), Status: common.TopUpStatusPending}
				order := &PartnerOAuthPaymentOrder{BindingId: "bnd_store", IdempotencyKeyHash: keyHash, RequestHash: strings.Repeat("b", 64),
					ClientId: "pc_store", RequestedAmount: 10, ReturnURL: "https://assistant.example.com/done"}
				return order, topUp, CreatePartnerOAuthPaymentOrder(order, topUp, 5_000_000, CashbackRequestMetadata{
					FaceAmount: 10, QuotaPerFaceUnit: "500000", RequestIP: "203.0.113.9", UserAgent: "partner-server"})
			}
			order, topUp, err := newOrder("partner-order-1", strings.Repeat("a", 64))
			require.NoError(t, err)
			var context CashbackOrderContext
			require.NoError(t, db.Where("top_up_id = ?", topUp.Id).First(&context).Error)
			assert.Equal(t, CashbackIneligiblePartnerOAuth, context.IneligibleReason)
			assert.Empty(t, context.RequestIP)
			assert.Empty(t, strings.TrimSpace(context.RequestUserAgentHash)) // PostgreSQL pads empty char(64).

			_, _, err = newOrder("partner-order-2", strings.Repeat("a", 64))
			require.ErrorIs(t, err, ErrPartnerOAuthPaymentIdempotencyRace)
			var topUps, contexts int64
			require.NoError(t, db.Model(&TopUp{}).Where("trade_no = ?", "partner-order-2").Count(&topUps).Error)
			require.NoError(t, db.Model(&CashbackOrderContext{}).Where("trade_no = ?", "partner-order-2").Count(&contexts).Error)
			assert.Zero(t, topUps, "the conflicting order must not leave a top-up behind")
			assert.Zero(t, contexts)

			found, foundTopUp, err := FindPartnerOAuthPaymentOrderByIdempotency("bnd_store", strings.Repeat("a", 64))
			require.NoError(t, err)
			assert.Equal(t, order.Id, found.Id)
			assert.Equal(t, int64(10), found.RequestedAmount)
			assert.Equal(t, "partner-order-1", foundTopUp.TradeNo)
			_, _, err = GetPartnerOAuthPaymentOrder("bnd_other", "partner-order-1")
			assert.ErrorIs(t, err, ErrPartnerOAuthPaymentOrderNotFound)
			_, _, err = GetPartnerOAuthPaymentOrder("bnd_store", "legacy-order")
			assert.ErrorIs(t, err, ErrPartnerOAuthPaymentOrderNotFound)
			assert.Equal(t, "https://assistant.example.com/done", GetPartnerOAuthPaymentReturnURL(topUp.Id))
			assert.Empty(t, GetPartnerOAuthPaymentReturnURL(legacyTopUp.Id))

			since := time.Now().Add(-time.Hour).Unix()
			pending, err := CountPartnerOAuthPaymentOrders("bnd_store", since, true)
			require.NoError(t, err)
			assert.Equal(t, int64(1), pending)
			require.NoError(t, db.Model(&TopUp{}).Where("id = ?", topUp.Id).Update("status", common.TopUpStatusSuccess).Error)
			pending, err = CountPartnerOAuthPaymentOrders("bnd_store", since, true)
			require.NoError(t, err)
			assert.Zero(t, pending)
			total, err := CountPartnerOAuthPaymentOrders("bnd_store", since, false)
			require.NoError(t, err)
			assert.Equal(t, int64(1), total)
		})
	}
}
