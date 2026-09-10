package model

import (
	"fmt"
	"os"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func TestResolveChannelPriorityKeepsRequestPlanStable(t *testing.T) {
	tests := []struct {
		name     string
		current  []int64
		retry    int
		plan     []int64
		want     int64
		wantOK   bool
		wantPlan []int64
	}{
		{name: "capture initial plan", current: []int64{30, 28, 27}, want: 30, wantOK: true, wantPlan: []int64{30, 28, 27}},
		{name: "removed first priority keeps retry position", current: []int64{28, 27}, retry: 1, plan: []int64{30, 28, 27}, want: 28, wantOK: true, wantPlan: []int64{30, 28, 27}},
		{name: "removed target advances to lower live priority", current: []int64{30, 27}, retry: 1, plan: []int64{30, 28, 27}, want: 27, wantOK: true, wantPlan: []int64{30, 28, 27}},
		{name: "exhausted plan preserves lowest live fallback", current: []int64{30, 28}, retry: 3, plan: []int64{30, 28, 27}, want: 28, wantOK: true, wantPlan: []int64{30, 28, 27}},
		{name: "new priority is ignored by existing request", current: []int64{40, 28, 27}, retry: 1, plan: []int64{30, 28, 27}, want: 28, wantOK: true, wantPlan: []int64{30, 28, 27}},
		{name: "new candidate source preserves availability", current: []int64{40}, retry: 1, plan: []int64{30, 28, 27}, want: 40, wantOK: true, wantPlan: []int64{30, 28, 27}},
		{name: "new candidate source uses original retry rank", current: []int64{60, 50, 40, 30}, retry: 3, plan: []int64{20, 10}, want: 30, wantOK: true, wantPlan: []int64{20, 10}},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			priority, plan, ok := resolveChannelPriority(test.current, test.retry, test.plan)
			assert.Equal(t, test.want, priority)
			assert.Equal(t, test.wantOK, ok)
			require.Equal(t, test.wantPlan, plan)
		})
	}
}

func TestDatabaseChannelPriorityPlanDoesNotShiftAfterRemoval(t *testing.T) {
	tests := []struct {
		name      string
		dsn       string
		dialector func(string) gorm.Dialector
		groupCol  string
		dbType    common.DatabaseType
	}{
		{
			name: "sqlite", dsn: fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_")),
			dialector: func(dsn string) gorm.Dialector { return sqlite.Open(dsn) }, groupCol: "`group`", dbType: common.DatabaseTypeSQLite,
		},
		{
			name: "mysql", dsn: strings.TrimSpace(os.Getenv("TEST_MYSQL_DSN")),
			dialector: func(dsn string) gorm.Dialector { return mysql.Open(dsn) }, groupCol: "`group`", dbType: common.DatabaseTypeMySQL,
		},
		{
			name: "postgres", dsn: strings.TrimSpace(os.Getenv("TEST_POSTGRES_DSN")),
			dialector: func(dsn string) gorm.Dialector {
				return postgres.New(postgres.Config{DSN: dsn, PreferSimpleProtocol: true})
			}, groupCol: `"group"`, dbType: common.DatabaseTypePostgreSQL,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if test.dsn == "" {
				t.Skip("test database DSN is not configured")
			}
			db, err := gorm.Open(test.dialector(test.dsn), &gorm.Config{})
			require.NoError(t, err)
			testDatabaseChannelPriorityPlan(t, db, test.groupCol, test.dbType)
		})
	}
}

func testDatabaseChannelPriorityPlan(t *testing.T, db *gorm.DB, groupCol string, dbType common.DatabaseType) {
	oldDB := DB
	oldMemoryCacheEnabled := common.MemoryCacheEnabled
	oldGroupCol := commonGroupCol
	oldMainDatabaseType := common.MainDatabaseType()
	DB = db
	common.MemoryCacheEnabled = false
	commonGroupCol = groupCol
	common.SetMainDatabaseType(dbType)
	t.Cleanup(func() {
		DB = oldDB
		common.MemoryCacheEnabled = oldMemoryCacheEnabled
		commonGroupCol = oldGroupCol
		common.SetMainDatabaseType(oldMainDatabaseType)
		sqlDB, dbErr := db.DB()
		if dbErr == nil {
			require.NoError(t, sqlDB.Close())
		}
	})

	require.NoError(t, db.AutoMigrate(&Channel{}, &Ability{}))

	const modelName = "priority-plan-database-model"
	channelIDs := []int{2301, 2302, 2303}
	require.NoError(t, db.Where("model = ?", modelName).Delete(&Ability{}).Error)
	require.NoError(t, db.Where("id IN ?", channelIDs).Delete(&Channel{}).Error)
	t.Cleanup(func() {
		_ = db.Where("model = ?", modelName).Delete(&Ability{}).Error
		_ = db.Where("id IN ?", channelIDs).Delete(&Channel{}).Error
	})
	for i, priority := range []int64{30, 28, 27} {
		id := channelIDs[i]
		weight := uint(100)
		require.NoError(t, db.Create(&Channel{
			Id: id, Type: constant.ChannelTypeOpenAI, Key: fmt.Sprintf("key-%d", id),
			Status: common.ChannelStatusEnabled, Name: fmt.Sprintf("channel-%d", id),
			Weight: &weight, Models: modelName, Group: "default", Priority: &priority,
		}).Error)
		require.NoError(t, db.Create(&Ability{
			Group: "default", Model: modelName, ChannelId: id, Enabled: true,
			Priority: &priority, Weight: weight,
		}).Error)
	}

	first, plan, err := GetRandomSatisfiedChannelWithPriorityPlan("default", modelName, 0, nil, nil)
	require.NoError(t, err)
	require.NotNil(t, first)
	assert.Equal(t, 2301, first.Id)
	require.Equal(t, []int64{30, 28, 27}, plan)

	require.NoError(t, db.Model(&Ability{}).Where("channel_id = ?", first.Id).Update("enabled", false).Error)
	second, _, err := GetRandomSatisfiedChannelWithPriorityPlan("default", modelName, 1, nil, plan)
	require.NoError(t, err)
	require.NotNil(t, second)
	assert.Equal(t, 2302, second.Id)
}
