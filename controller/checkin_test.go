package controller

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

func TestPaidOnlyCheckinDatabaseMatrix(t *testing.T) {
	for _, dialect := range []string{"sqlite", "mysql", "postgres"} {
		t.Run(dialect, func(t *testing.T) {
			var driver gorm.Dialector
			switch dialect {
			case "sqlite":
				driver = sqlite.Open(":memory:")
			case "mysql":
				dsn := os.Getenv("TEST_MYSQL_DSN")
				if dsn == "" {
					t.Skip("TEST_MYSQL_DSN not configured")
				}
				driver = mysql.Open(dsn)
			case "postgres":
				dsn := os.Getenv("TEST_POSTGRES_DSN")
				if dsn == "" {
					t.Skip("TEST_POSTGRES_DSN not configured")
				}
				driver = postgres.Open(dsn)
			}
			db, err := gorm.Open(driver, &gorm.Config{
				NamingStrategy: schema.NamingStrategy{TablePrefix: "paid_checkin_test_"},
			})
			require.NoError(t, err)
			sqlDB, err := db.DB()
			require.NoError(t, err)
			sqlDB.SetMaxOpenConns(1)
			oldDB, oldLogDB := model.DB, model.LOG_DB
			oldType, oldLogType := common.MainDatabaseType(), common.LogDatabaseType()
			oldRedis := common.RedisEnabled
			oldSetting := *operation_setting.GetCheckinSetting()
			model.DB, model.LOG_DB = db, db
			common.SetMainDatabaseType(common.DatabaseType(dialect))
			common.SetLogDatabaseType(common.DatabaseType(dialect))
			common.RedisEnabled = false
			t.Cleanup(func() {
				require.NoError(t, db.Migrator().DropTable(&model.Checkin{}, &model.TopUp{}, &model.Log{}, &model.User{}))
				model.DB, model.LOG_DB = oldDB, oldLogDB
				common.SetMainDatabaseType(oldType)
				common.SetLogDatabaseType(oldLogType)
				common.RedisEnabled = oldRedis
				*operation_setting.GetCheckinSetting() = oldSetting
				require.NoError(t, sqlDB.Close())
			})
			require.NoError(t, db.AutoMigrate(&model.User{}, &model.TopUp{}, &model.Checkin{}, &model.Log{}))
			versionSQL := "SELECT version()"
			if dialect == "sqlite" {
				versionSQL = "SELECT sqlite_version()"
			}
			var version string
			require.NoError(t, db.Raw(versionSQL).Scan(&version).Error)
			t.Logf("database version: %s", version)

			cases := []struct {
				name         string
				payment      *model.TopUp
				legacyNull   bool
				unrestricted bool
				eligible     bool
			}{
				{name: "gift balance without payment is ineligible"},
				{name: "pending payment is ineligible", payment: &model.TopUp{Money: 10, Status: common.TopUpStatusPending}},
				{name: "failed payment is ineligible", payment: &model.TopUp{Money: 10, Status: "failed"}},
				{name: "zero-money successful credit is ineligible", payment: &model.TopUp{Status: common.TopUpStatusSuccess}},
				{name: "negative-money record is ineligible", payment: &model.TopUp{Money: -1, Status: common.TopUpStatusSuccess}},
				{name: "successful paid top-up is eligible", payment: &model.TopUp{Money: 1, Amount: 1, Status: common.TopUpStatusSuccess}, eligible: true},
				{name: "paid subscription top-up with zero credit amount is eligible", payment: &model.TopUp{Money: 5, Amount: 0, Status: common.TopUpStatusSuccess}, eligible: true},
				{name: "legacy paid record with null method and provider is eligible", payment: &model.TopUp{Money: 1, Status: common.TopUpStatusSuccess}, legacyNull: true, eligible: true},
				{name: "balance payment method is ineligible", payment: &model.TopUp{Money: 5, PaymentMethod: model.PaymentMethodBalance, Status: common.TopUpStatusSuccess}},
				{name: "balance payment provider is ineligible", payment: &model.TopUp{Money: 5, PaymentProvider: model.PaymentProviderBalance, Status: common.TopUpStatusSuccess}},
				{name: "restriction disabled preserves unpaid check-in", unrestricted: true, eligible: true},
			}
			for index, tc := range cases {
				t.Run(tc.name, func(t *testing.T) {
					setting := operation_setting.GetCheckinSetting()
					setting.Enabled, setting.PaidUsersOnly = true, !tc.unrestricted
					setting.MinQuota, setting.MaxQuota = 100, 100
					user := model.User{
						Id:       index + 1,
						Username: fmt.Sprintf("checkin_%d", index),
						AffCode:  fmt.Sprintf("checkin_%d", index),
						Quota:    500,
						Status:   common.UserStatusEnabled,
					}
					if tc.eligible && !tc.unrestricted {
						user.Quota = 0 // Eligibility survives spending the paid balance.
					}
					require.NoError(t, db.Create(&user).Error)
					if tc.payment != nil {
						payment := *tc.payment
						payment.UserId, payment.TradeNo = user.Id, fmt.Sprintf("checkin_order_%d", index)
						require.NoError(t, db.Create(&payment).Error)
						if tc.legacyNull {
							require.NoError(t, db.Model(&payment).Updates(map[string]any{"payment_method": nil, "payment_provider": nil}).Error)
						}
					}
					status := performCheckinRequest(t, http.MethodGet, user.Id)
					require.True(t, status.Success)
					assert.Equal(t, tc.eligible, status.Data.Eligible)
					assert.Equal(t, !tc.unrestricted, status.Data.PaidUsersOnly)
					claim := performCheckinRequest(t, http.MethodPost, user.Id)
					assert.Equal(t, tc.eligible, claim.Success)
					var after model.User
					require.NoError(t, db.First(&after, user.Id).Error)
					var checkins int64
					require.NoError(t, db.Model(&model.Checkin{}).Where("user_id = ?", user.Id).Count(&checkins).Error)
					if tc.eligible {
						assert.Equal(t, user.Quota+100, after.Quota)
						assert.EqualValues(t, 1, checkins)
						assert.False(t, performCheckinRequest(t, http.MethodPost, user.Id).Success)
						require.NoError(t, db.First(&after, user.Id).Error)
						assert.Equal(t, user.Quota+100, after.Quota)
					} else {
						assert.Equal(t, user.Quota, after.Quota)
						assert.Zero(t, checkins)
						assert.Contains(t, claim.Message, "successful payment")
					}
				})
			}
			t.Run("payment lookup failure does not grant a reward", func(t *testing.T) {
				setting := operation_setting.GetCheckinSetting()
				setting.Enabled, setting.PaidUsersOnly = true, true
				setting.MinQuota, setting.MaxQuota = 100, 100
				user := model.User{
					Id:       len(cases) + 1,
					Username: "checkin_lookup_failure",
					AffCode:  "lookup_fail",
					Quota:    500,
					Status:   common.UserStatusEnabled,
				}
				require.NoError(t, db.Create(&user).Error)
				require.NoError(t, db.Migrator().DropTable(&model.TopUp{}))
				for _, method := range []string{http.MethodGet, http.MethodPost} {
					response := performCheckinRequest(t, method, user.Id)
					assert.False(t, response.Success)
					assert.Equal(t, "Failed to verify check-in eligibility", response.Message)
				}
				var checkins int64
				require.NoError(t, db.Model(&model.Checkin{}).Where("user_id = ?", user.Id).Count(&checkins).Error)
				assert.Zero(t, checkins)
				var after model.User
				require.NoError(t, db.First(&after, user.Id).Error)
				assert.Equal(t, user.Quota, after.Quota)
			})
		})
	}
}

type checkinTestResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Data    struct {
		Eligible      bool `json:"eligible"`
		PaidUsersOnly bool `json:"paid_users_only"`
	} `json:"data"`
}

func performCheckinRequest(t *testing.T, method string, userID int) checkinTestResponse {
	t.Helper()
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Set("id", userID)
	context.Request = httptest.NewRequest(method, "/api/user/checkin", nil)
	if method == http.MethodGet {
		GetCheckinStatus(context)
	} else {
		DoCheckin(context)
	}
	require.Equal(t, http.StatusOK, recorder.Code)
	var response checkinTestResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	return response
}
