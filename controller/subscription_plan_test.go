package controller

import (
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

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

func subscriptionPlanTestDB(t *testing.T, dialect string) *gorm.DB {
	t.Helper()
	var dialector gorm.Dialector
	dbType := common.DatabaseTypeSQLite
	switch dialect {
	case "sqlite":
		dialector = sqlite.Open(filepath.Join(t.TempDir(), "plans.db"))
	case "mysql":
		dsn := os.Getenv("TEST_MYSQL_DSN")
		if dsn == "" {
			t.Skip("TEST_MYSQL_DSN is not configured")
		}
		dialector, dbType = mysql.Open(dsn), common.DatabaseTypeMySQL
	case "postgres":
		dsn := os.Getenv("TEST_POSTGRES_DSN")
		if dsn == "" {
			t.Skip("TEST_POSTGRES_DSN is not configured")
		}
		dialector, dbType = postgres.Open(dsn), common.DatabaseTypePostgreSQL
	}
	db, err := gorm.Open(dialector, &gorm.Config{NamingStrategy: schema.NamingStrategy{TablePrefix: fmt.Sprintf("plan_api_%d_", time.Now().UnixNano())}})
	require.NoError(t, err)
	previousDB, previousPayment, previousType := model.DB, *operation_setting.GetPaymentSetting(), common.MainDatabaseType()
	model.DB = db
	common.SetMainDatabaseType(dbType)
	operation_setting.GetPaymentSetting().ComplianceConfirmed = true
	operation_setting.GetPaymentSetting().ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion
	sqlDB, err := db.DB()
	require.NoError(t, err)
	if dialect == "sqlite" {
		sqlDB.SetMaxOpenConns(1)
	}
	t.Cleanup(func() {
		_ = db.Migrator().DropTable(&model.SubscriptionPlan{}, &model.Option{})
		model.DB = previousDB
		common.SetMainDatabaseType(previousType)
		*operation_setting.GetPaymentSetting() = previousPayment
		_ = sqlDB.Close()
	})
	require.NoError(t, db.AutoMigrate(&model.SubscriptionPlan{}, &model.Option{}))
	return db
}

func TestSubscriptionPlanPeriodLimitAPI(t *testing.T) {
	db := subscriptionPlanTestDB(t, "sqlite")

	router := gin.New()
	router.POST("/plans", AdminCreateSubscriptionPlan)
	router.PUT("/plans/:id", AdminUpdateSubscriptionPlan)
	for _, test := range []struct {
		method, path, payload string
		success               bool
		limits                [3]int64
	}{
		{http.MethodPost, "/plans", `{"plan":{"title":"Original"}}`, true, [3]int64{}},
		{http.MethodPut, "/plans/1", `{"plan":{"title":"Limited","daily_limit":10,"weekly_limit":20,"monthly_limit":30}}`, true, [3]int64{10, 20, 30}},
		{http.MethodPut, "/plans/1", `{"plan":{"title":"Unrelated edit"}}`, true, [3]int64{10, 20, 30}},
		{http.MethodPut, "/plans/1", `{"plan":{"title":"Disable daily","daily_limit":0}}`, true, [3]int64{0, 20, 30}},
		{http.MethodPut, "/plans/1", `{"plan":{"title":"Invalid","weekly_limit":-1}}`, false, [3]int64{0, 20, 30}},
		{http.MethodPut, "/plans/1", `{"plan":{"title":"Invalid","monthly_limit":1.5}}`, false, [3]int64{0, 20, 30}},
		{http.MethodPut, "/plans/1", `{"plan":{"title":"Invalid","monthly_limit":9007199254740992}}`, false, [3]int64{0, 20, 30}},
	} {
		response := httptest.NewRecorder()
		request := httptest.NewRequest(test.method, test.path, strings.NewReader(test.payload))
		request.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(response, request)
		var body struct {
			Success bool `json:"success"`
		}
		require.NoError(t, common.Unmarshal(response.Body.Bytes(), &body))
		assert.Equal(t, test.success, body.Success, test.payload)
		var plan model.SubscriptionPlan
		require.NoError(t, db.First(&plan, 1).Error)
		assert.Equal(t, test.limits, [3]int64{plan.DailyLimit, plan.WeeklyLimit, plan.MonthlyLimit}, test.payload)
	}
}

func TestSubscriptionPlanRecommendationAPI(t *testing.T) {
	for _, dialect := range []string{"sqlite", "mysql", "postgres"} {
		t.Run(dialect, func(t *testing.T) {
			db := subscriptionPlanTestDB(t, dialect)
			var version string
			query := "SELECT version()"
			if dialect == "sqlite" {
				query = "SELECT sqlite_version()"
			}
			require.NoError(t, db.Raw(query).Scan(&version).Error)
			t.Logf("database version: %s", version)
			router := gin.New()
			router.POST("/plans", AdminCreateSubscriptionPlan)
			router.PUT("/plans/:id", AdminUpdateSubscriptionPlan)
			router.PATCH("/plans/:id", AdminUpdateSubscriptionPlanStatus)
			router.GET("/plans", AdminListSubscriptionPlans)
			router.GET("/public", GetSubscriptionPlans)
			for _, step := range []struct {
				method, path, payload string
				success               bool
				recommended           int
			}{
				{"POST", "/plans", `{"plan":{"title":"A","enabled":true,"sort_order":99}}`, true, 0},
				{"POST", "/plans", `{"plan":{"title":"B","enabled":true}}`, true, 0},
				{"PUT", "/plans/1", `{"plan":{"title":"A","enabled":true,"sort_order":99,"recommended":true}}`, true, 1},
				{"PUT", "/plans/2", `{"plan":{"title":"B","enabled":true,"recommended":true}}`, true, 2},
				{"PUT", "/plans/1", `{"plan":{"title":"A","enabled":true,"sort_order":99,"recommended":false}}`, true, 2},
				{"PUT", "/plans/2", `{"plan":{"title":"Renamed B","enabled":true}}`, true, 2},
				{"PUT", "/plans/2", `{"plan":{"title":"B","enabled":true,"recommended":false}}`, true, 0},
				{"POST", "/plans", `{"plan":{"title":"C","enabled":true,"recommended":true}}`, true, 3},
				{"PATCH", "/plans/3", `{"enabled":false}`, true, 0},
				{"PATCH", "/plans/3", `{"enabled":true}`, true, 0},
				{"PUT", "/plans/999", `{"plan":{"title":"Missing","enabled":true,"recommended":true}}`, false, 0},
				{"PUT", "/plans/1", `{"plan":{"title":"A","enabled":true,"recommended":"true"}}`, false, 0},
			} {
				response := httptest.NewRecorder()
				request := httptest.NewRequest(step.method, step.path, strings.NewReader(step.payload))
				request.Header.Set("Content-Type", "application/json")
				router.ServeHTTP(response, request)
				var body struct {
					Success bool `json:"success"`
				}
				require.NoError(t, common.Unmarshal(response.Body.Bytes(), &body))
				require.Equal(t, step.success, body.Success, step.payload)
				for _, endpoint := range []string{"/plans", "/public"} {
					response = httptest.NewRecorder()
					router.ServeHTTP(response, httptest.NewRequest("GET", endpoint, nil))
					var result struct {
						Success bool `json:"success"`
						Data    []struct {
							Plan struct {
								Id          int   `json:"id"`
								Recommended *bool `json:"recommended"`
							} `json:"plan"`
						} `json:"data"`
					}
					require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
					require.True(t, result.Success)
					selected := 0
					for _, row := range result.Data {
						require.NotNil(t, row.Plan.Recommended, "API must explicitly default recommendation to false")
						if *row.Plan.Recommended {
							require.Zero(t, selected, "only one recommendation is allowed")
							selected = row.Plan.Id
						}
					}
					assert.Equal(t, step.recommended, selected, step.payload)
					if endpoint == "/public" && selected != 0 {
						assert.Equal(t, selected, result.Data[0].Plan.Id, "the explicit recommendation is displayed first")
					}
				}
			}
			start := make(chan struct{})
			responses := make([]*httptest.ResponseRecorder, 2)
			var workers sync.WaitGroup
			for i := range 2 {
				workers.Go(func() {
					<-start
					response := httptest.NewRecorder()
					request := httptest.NewRequest("PUT", fmt.Sprintf("/plans/%d", i+1), strings.NewReader(`{"plan":{"title":"Concurrent","enabled":true,"recommended":true}}`))
					request.Header.Set("Content-Type", "application/json")
					router.ServeHTTP(response, request)
					responses[i] = response
				})
			}
			close(start)
			workers.Wait()
			for _, response := range responses {
				var body struct {
					Success bool `json:"success"`
				}
				require.NoError(t, common.Unmarshal(response.Body.Bytes(), &body))
				assert.True(t, body.Success, response.Body.String())
			}
			response := httptest.NewRecorder()
			router.ServeHTTP(response, httptest.NewRequest("GET", "/public", nil))
			var result struct {
				Data []struct {
					Plan struct {
						Recommended bool `json:"recommended"`
					} `json:"plan"`
				} `json:"data"`
			}
			require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
			selected := 0
			for _, row := range result.Data {
				if row.Plan.Recommended {
					selected++
				}
			}
			assert.Equal(t, 1, selected, "concurrent admin edits must retain exactly one recommendation")
			before, err := model.GetRecommendedSubscriptionPlanID()
			require.NoError(t, err)
			aborted := errors.New("abort plan save")
			err = db.Transaction(func(tx *gorm.DB) error {
				if err := model.SetSubscriptionPlanRecommendation(tx, 3-before, true); err != nil {
					return err
				}
				return aborted
			})
			require.ErrorIs(t, err, aborted)
			after, err := model.GetRecommendedSubscriptionPlanID()
			require.NoError(t, err)
			assert.Equal(t, before, after, "an aborted save must not replace the recommendation")
		})
	}
}
