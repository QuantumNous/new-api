package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	perfmetrics "github.com/QuantumNous/new-api/pkg/perf_metrics"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestGetPerfMetricsRespectsUsableGroups(t *testing.T) {
	originalDB, originalLogDB := model.DB, model.LOG_DB
	originalRatios := ratio_setting.GroupRatio2JSONString()
	originalUsable := setting.UserUsableGroups2JSONString()
	special := ratio_setting.GetGroupRatioSetting().GroupSpecialUsableGroup
	originalSpecial := special.ReadAll()
	originalGinMode := gin.Mode()
	t.Cleanup(func() {
		model.DB, model.LOG_DB = originalDB, originalLogDB
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(originalRatios))
		require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(originalUsable))
		special.Clear()
		special.AddAll(originalSpecial)
		gin.SetMode(originalGinMode)
	})
	initModelListColumnNames(t)
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, sqlDB.Close()) })
	model.DB = db
	require.NoError(t, db.AutoMigrate(&model.PerfMetric{}))
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1,"staff":1,"vip":1,"internal":1}`))
	for _, group := range []string{"default", "auto", "staff", "vip", "internal", "deleted"} {
		require.NoError(t, db.Create(&model.PerfMetric{
			ModelName: "zz-group-visibility-regression", Group: group,
			BucketTs: time.Now().Unix() - 60, RequestCount: 1,
			SuccessCount: 1, TotalLatencyMs: 123,
		}).Error)
	}

	for _, tc := range []struct {
		name      string
		userGroup string
		query     string
		usable    string
		special   map[string]string
		want      []string
	}{
		{
			name:   "anonymous sees only public active groups",
			usable: `{"default":"Default","auto":"Auto","deleted":"Deleted"}`,
			want:   []string{"auto", "default"},
		},
		{
			name: "query cannot reveal a hidden group", query: "&group=internal",
			usable: `{"default":"Default"}`, want: []string{},
		},
		{
			name: "member retains own group and special grants", userGroup: "staff",
			usable:  `{"default":"Default","auto":"Auto"}`,
			special: map[string]string{"+:vip": "VIP", "-:default": ""},
			want:    []string{"auto", "staff", "vip"},
		},
		{
			name: "special removal also hides auto", userGroup: "staff",
			usable: `{"auto":"Auto"}`, special: map[string]string{"-:auto": ""},
			want: []string{"staff"},
		},
		{
			name: "empty public groups deny all", usable: `{}`, want: []string{},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(tc.usable))
			special.Clear()
			if tc.special != nil {
				special.Set(tc.userGroup, tc.special)
			}
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest(http.MethodGet,
				"/api/perf-metrics?model=zz-group-visibility-regression"+tc.query, nil)
			if tc.userGroup != "" {
				c.Set("group", tc.userGroup)
			}
			GetPerfMetrics(c)
			require.Equal(t, http.StatusOK, w.Code)
			var response struct {
				Success bool                    `json:"success"`
				Data    perfmetrics.QueryResult `json:"data"`
			}
			require.NoError(t, common.Unmarshal(w.Body.Bytes(), &response))
			require.True(t, response.Success)
			got := make([]string, 0, len(response.Data.Groups))
			for _, group := range response.Data.Groups {
				got = append(got, group.Group)
				assert.EqualValues(t, 123, group.AvgLatencyMs)
			}
			assert.ElementsMatch(t, tc.want, got)
			assert.NotNil(t, response.Data.Groups)
		})
	}
}
