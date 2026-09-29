package model

import (
	"os"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/glebarez/sqlite"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func int64PtrForLimitTest(v int64) *int64 {
	return &v
}

// seedChannelLimitCounters writes absolute window values for one channel using
// the same keys the production limit checks read.
func seedChannelLimitCounters(t *testing.T, channelId int, rpm int64, tpm int64, dayQuota int64, monthQuota int64) {
	t.Helper()
	require.False(t, common.RedisEnabled, "channel limit tests must run against the in-memory counter store")
	for key, value := range map[string]int64{
		channelRpmKey(channelId):        rpm,
		channelTpmKey(channelId):        tpm,
		channelDayQuotaKey(channelId):   dayQuota,
		channelMonthQuotaKey(channelId): monthQuota,
	} {
		_, err := common.CounterIncrBy(key, value, time.Hour)
		require.NoError(t, err)
	}
}

func TestChannelWithinLimitValues(t *testing.T) {
	tests := []struct {
		name  string
		ch    *Channel
		rpm   int64
		tpm   int64
		day   int64
		month int64
		want  bool
	}{
		{
			name:  "channel without limits ignores every counter",
			ch:    &Channel{},
			rpm:   1 << 40,
			tpm:   1 << 40,
			day:   1 << 40,
			month: 1 << 40,
			want:  true,
		},
		{
			name: "rpm below the limit passes",
			ch:   &Channel{RpmLimit: int64PtrForLimitTest(5)},
			rpm:  4,
			want: true,
		},
		{
			name: "rpm at the limit blocks",
			ch:   &Channel{RpmLimit: int64PtrForLimitTest(5)},
			rpm:  5,
			want: false,
		},
		{
			name: "rpm past the limit blocks",
			ch:   &Channel{RpmLimit: int64PtrForLimitTest(5)},
			rpm:  6,
			want: false,
		},
		{
			name: "tpm at the limit blocks",
			ch:   &Channel{TpmLimit: int64PtrForLimitTest(100)},
			tpm:  100,
			want: false,
		},
		{
			name: "daily quota at the limit blocks",
			ch:   &Channel{DailyQuotaLimit: int64PtrForLimitTest(500)},
			day:  500,
			want: false,
		},
		{
			name:  "monthly quota at the limit blocks",
			ch:    &Channel{MonthlyQuotaLimit: int64PtrForLimitTest(500)},
			month: 500,
			want:  false,
		},
		{
			name: "a refund-heavy negative quota window leaves headroom",
			ch:   &Channel{DailyQuotaLimit: int64PtrForLimitTest(100)},
			day:  -50,
			want: true,
		},
		{
			name: "the first violated limit reports blocked",
			ch:   &Channel{RpmLimit: int64PtrForLimitTest(1), TpmLimit: int64PtrForLimitTest(1), DailyQuotaLimit: int64PtrForLimitTest(1)},
			rpm:  1,
			tpm:  1,
			day:  1,
			want: false,
		},
	}
	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			assert.Equal(t, testCase.want,
				channelWithinLimitValues(testCase.ch, testCase.rpm, testCase.tpm, testCase.day, testCase.month))
		})
	}
}

func TestChannelWithinLimitsReadsWindowCounters(t *testing.T) {
	assert.True(t, ChannelWithinLimits(nil), "a nil channel never blocks selection")

	ch := &Channel{Id: 950001, RpmLimit: int64PtrForLimitTest(5), DailyQuotaLimit: int64PtrForLimitTest(1000)}
	seedChannelLimitCounters(t, ch.Id, 4, 0, 999, 0)
	assert.True(t, ChannelWithinLimits(ch), "below both limits the channel stays selectable")

	seedChannelLimitCounters(t, ch.Id, 1, 0, 1, 0)
	assert.False(t, ChannelWithinLimits(ch), "the day window reaching its budget drops the channel")

	unlimited := &Channel{Id: 950002}
	seedChannelLimitCounters(t, unlimited.Id, 1<<40, 1<<40, 1<<40, 1<<40)
	assert.True(t, ChannelWithinLimits(unlimited), "channels without configured limits never consult counters")
}

func TestChannelRpmTryConsumeStrictAdmissionAndRollback(t *testing.T) {
	ch := &Channel{Id: 950101, RpmLimit: int64PtrForLimitTest(2)}
	assert.True(t, ChannelRpmTryConsume(ch))
	assert.True(t, ChannelRpmTryConsume(ch))
	assert.False(t, ChannelRpmTryConsume(ch), "the third dispatch within one minute must be rejected")
	assert.Equal(t, int64(2), common.CounterGet(channelRpmKey(ch.Id)),
		"the rejected attempt must roll its increment back so the window is not self-saturating")

	unlimited := &Channel{Id: 950102}
	assert.True(t, ChannelRpmTryConsume(unlimited))
	assert.Equal(t, int64(0), common.CounterGet(channelRpmKey(unlimited.Id)),
		"channels without a limit must not consume the counter")
}

func TestChannelWithinLimitsBatchSplitsLimitedAndUnlimited(t *testing.T) {
	limited := &Channel{Id: 950201, RpmLimit: int64PtrForLimitTest(1)}
	unlimited := &Channel{Id: 950202}
	seedChannelLimitCounters(t, limited.Id, 1, 0, 0, 0)

	allowed := ChannelWithinLimitsBatch([]*Channel{limited, unlimited, nil})
	assert.False(t, allowed[limited.Id], "the over-limit channel is rejected")
	assert.True(t, allowed[unlimited.Id], "the unlimited channel stays selectable")
	_, ok := allowed[999999]
	assert.False(t, ok, "nil channels must be skipped, not marked allowed")
}

func TestRecordChannelTokenUsageAccumulatesTpmWindow(t *testing.T) {
	channelId := 950301
	RecordChannelTokenUsage(channelId, 120)
	RecordChannelTokenUsage(channelId, 80)
	assert.Equal(t, int64(200), common.CounterGet(channelTpmKey(channelId)))

	RecordChannelTokenUsage(channelId, 0)
	RecordChannelTokenUsage(channelId, -5)
	RecordChannelTokenUsage(0, 10)
	assert.Equal(t, int64(200), common.CounterGet(channelTpmKey(channelId)),
		"non-positive token counts and missing channels must not change the window")
}

func TestUpdateChannelUsedQuotaMirrorsQuotaWindows(t *testing.T) {
	truncateTables(t)
	channel := Channel{
		Id: 950401, Type: constant.ChannelTypeOpenAI, Status: common.ChannelStatusEnabled,
		Name: "quota-mirror", Models: "mirror-model", Group: "default", Key: "test-key",
	}
	require.NoError(t, channel.Insert())

	UpdateChannelUsedQuota(channel.Id, 500)
	UpdateChannelUsedQuota(channel.Id, -200)

	assert.Equal(t, int64(300), common.CounterGet(channelDayQuotaKey(channel.Id)))
	assert.Equal(t, int64(300), common.CounterGet(channelMonthQuotaKey(channel.Id)))

	updated, err := GetChannelById(channel.Id, true)
	require.NoError(t, err)
	assert.Equal(t, int64(300), updated.UsedQuota, "the lifetime column keeps its own net total")

	UpdateChannelUsedQuota(channel.Id, 0)
	assert.Equal(t, int64(300), common.CounterGet(channelDayQuotaKey(channel.Id)),
		"zero deltas record nothing")
}

func TestFilterCandidateIDsDropsOverLimitChannels(t *testing.T) {
	overRpm := &Channel{Id: 950501, RpmLimit: int64PtrForLimitTest(1)}
	overDaily := &Channel{Id: 950502, DailyQuotaLimit: int64PtrForLimitTest(10)}
	unlimited := &Channel{Id: 950503}
	seedChannelLimitCounters(t, 950501, 1, 0, 0, 0)
	seedChannelLimitCounters(t, 950502, 0, 0, 10, 0)

	channelSyncLock.Lock()
	previous := channelsIDM
	channelsIDM = map[int]*Channel{
		950501: overRpm,
		950502: overDaily,
		950503: unlimited,
	}
	t.Cleanup(func() {
		channelsIDM = previous
		channelSyncLock.Unlock()
	})

	limitsFilter := []dto.ChannelFilter{{Kind: dto.FilterChannelLimits}}

	kept, emptiedBy := filterCandidateIDs([]int{950501, 950502, 950503}, "mirror-model", limitsFilter)
	assert.Equal(t, []int{950503}, kept, "over-limit channels drop out while others stay")
	assert.Empty(t, emptiedBy)

	kept, emptiedBy = filterCandidateIDs([]int{950501, 950502}, "mirror-model", limitsFilter)
	assert.Empty(t, kept)
	assert.Equal(t, dto.FilterChannelLimits, emptiedBy, "an emptied set must attribute the cause to the limits filter")

	kept, emptiedBy = filterCandidateIDs([]int{950503, 999999}, "mirror-model", limitsFilter)
	assert.Equal(t, []int{950503}, kept, "ids missing from the cache are dropped like other non-path filters")
	assert.Empty(t, emptiedBy)
}

func TestGetRandomSatisfiedChannelReportsOverLimit(t *testing.T) {
	truncateTables(t)
	originalMemoryCache := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true
	t.Cleanup(func() { common.MemoryCacheEnabled = originalMemoryCache; InitChannelCache() })

	rpm := int64(1)
	tpm := int64(10)
	limited := Channel{
		Id: 950601, Type: constant.ChannelTypeOpenAI, Status: common.ChannelStatusEnabled,
		Name: "limited", Models: "limit-model", Group: "default", Key: "limited-key", RpmLimit: &rpm,
	}
	spare := Channel{
		Id: 950602, Type: constant.ChannelTypeOpenAI, Status: common.ChannelStatusEnabled,
		Name: "spare", Models: "limit-model", Group: "default", Key: "spare-key", TpmLimit: &tpm,
	}
	require.NoError(t, limited.Insert())
	require.NoError(t, spare.Insert())
	InitChannelCache()

	limitsFilter := []dto.ChannelFilter{{Kind: dto.FilterChannelLimits}}
	seedChannelLimitCounters(t, limited.Id, 1, 0, 0, 0)
	seedChannelLimitCounters(t, spare.Id, 0, 0, 0, 0)

	selected, err := GetRandomSatisfiedChannel("default", "limit-model", 0, limitsFilter)
	require.NoError(t, err)
	require.NotNil(t, selected)
	assert.Equal(t, "spare", selected.Name, "the over-limit channel drops out and the spare serves")

	seedChannelLimitCounters(t, spare.Id, 0, 10, 0, 0)
	selected, err = GetRandomSatisfiedChannel("default", "limit-model", 0, limitsFilter)
	assert.Nil(t, selected)
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrChannelsOverLimit)

	// Without the filter both channels stay selectable: limiting is opt-in.
	selected, err = GetRandomSatisfiedChannel("default", "limit-model", 0, nil)
	require.NoError(t, err)
	require.NotNil(t, selected)
}

func TestGetChannelAttributesOverLimitInDatabaseMode(t *testing.T) {
	truncateTables(t)
	originalMemoryCache := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = false
	t.Cleanup(func() { common.MemoryCacheEnabled = originalMemoryCache })

	rpm := int64(1)
	channel := Channel{
		Id: 950701, Type: constant.ChannelTypeOpenAI, Status: common.ChannelStatusEnabled,
		Name: "db-limited", Models: "db-model", Group: "default", Key: "db-key", RpmLimit: &rpm,
	}
	require.NoError(t, channel.Insert())
	seedChannelLimitCounters(t, channel.Id, 1, 0, 0, 0)

	limitsFilter := []dto.ChannelFilter{{Kind: dto.FilterChannelLimits}}
	selected, err := GetChannel("default", "db-model", 0, limitsFilter)
	assert.Nil(t, selected)
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrChannelsOverLimit, "DB-mode selection attributes the empty result to channel limits")

	selected, err = GetChannel("default", "db-model", 0, nil)
	require.NoError(t, err)
	require.NotNil(t, selected)
	assert.Equal(t, "db-limited", selected.Name)
}

// Legacy schemas predate the channel rate/quota limit columns and the token
// rpm_limit column; migrating a representative old table must add them with
// defaults, keep existing rows, and issue no DDL on a second run.
type channelBeforeLimitColumns struct {
	ID        int    `gorm:"column:id;primaryKey"`
	Name      string `gorm:"column:name;size:64"`
	Key       string `gorm:"column:key;not null"`
	UsedQuota int64  `gorm:"column:used_quota;bigint;default:0"`
}

type tokenBeforeRpmLimit struct {
	ID   int    `gorm:"column:id;primaryKey"`
	Name string `gorm:"column:name;size:64"`
	Key  string `gorm:"column:key;type:varchar(128)"`
}

func testChannelLimitColumnsMigration(t *testing.T, db *gorm.DB, recorder *migrationSQLRecorder) {
	t.Helper()
	channelTable := "channel_limit_columns_migration_test"
	tokenTable := "token_rpm_limit_migration_test"
	t.Cleanup(func() {
		_ = db.Migrator().DropTable(channelTable)
		_ = db.Migrator().DropTable(tokenTable)
	})

	require.NoError(t, db.Table(channelTable).AutoMigrate(&channelBeforeLimitColumns{}))
	require.NoError(t, db.Table(channelTable).Create(&channelBeforeLimitColumns{
		ID: 1, Name: "kept-channel", Key: "sk-legacy", UsedQuota: 77,
	}).Error)
	require.NoError(t, db.Table(tokenTable).AutoMigrate(&tokenBeforeRpmLimit{}))
	require.NoError(t, db.Table(tokenTable).Create(&tokenBeforeRpmLimit{
		ID: 1, Name: "kept-token", Key: "sk-legacy-token",
	}).Error)

	require.NoError(t, db.Table(channelTable).AutoMigrate(&Channel{}))
	require.NoError(t, db.Table(tokenTable).AutoMigrate(&Token{}))

	channelColumns := map[string]bool{}
	columnTypes, err := db.Table(channelTable).Migrator().ColumnTypes(&Channel{})
	require.NoError(t, err)
	for _, columnType := range columnTypes {
		channelColumns[strings.ToLower(columnType.Name())] = true
	}
	for _, column := range []string{"rpm_limit", "tpm_limit", "daily_quota_limit", "monthly_quota_limit"} {
		assert.True(t, channelColumns[column], "the upgraded channels table must gain %s", column)
	}

	tokenColumns := map[string]bool{}
	columnTypes, err = db.Table(tokenTable).Migrator().ColumnTypes(&Token{})
	require.NoError(t, err)
	for _, columnType := range columnTypes {
		tokenColumns[strings.ToLower(columnType.Name())] = true
	}
	assert.True(t, tokenColumns["rpm_limit"], "the upgraded tokens table must gain rpm_limit")

	var channelRow channelBeforeLimitColumns
	require.NoError(t, db.Table(channelTable).First(&channelRow, 1).Error)
	assert.Equal(t, "kept-channel", channelRow.Name)
	assert.Equal(t, int64(77), channelRow.UsedQuota, "existing channel rows must survive the migration")

	var tokenRow tokenBeforeRpmLimit
	require.NoError(t, db.Table(tokenTable).First(&tokenRow, 1).Error)
	assert.Equal(t, "kept-token", tokenRow.Name, "existing token rows must survive the migration")

	recorder.reset()
	require.NoError(t, db.Table(channelTable).AutoMigrate(&Channel{}))
	require.NoError(t, db.Table(tokenTable).AutoMigrate(&Token{}))
	assert.Empty(t, recorder.schemaMutations(), "a second migration must be a no-op")
}

func TestChannelAndTokenLimitColumnsMigrationSQLite(t *testing.T) {
	recorder := &migrationSQLRecorder{}
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{Logger: recorder})
	require.NoError(t, err)
	testChannelLimitColumnsMigration(t, db, recorder)
}

func TestChannelAndTokenLimitColumnsMigrationConfiguredDatabases(t *testing.T) {
	tests := []struct {
		name      string
		env       string
		dialector func(string) gorm.Dialector
	}{
		{name: "mysql", env: "TEST_MYSQL_DSN", dialector: func(dsn string) gorm.Dialector { return mysql.Open(dsn) }},
		{name: "postgres", env: "TEST_POSTGRES_DSN", dialector: func(dsn string) gorm.Dialector {
			return postgres.New(postgres.Config{DSN: dsn, PreferSimpleProtocol: true})
		}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			dsn := strings.TrimSpace(os.Getenv(test.env))
			if dsn == "" {
				t.Skip(test.env + " is not configured")
			}
			recorder := &migrationSQLRecorder{}
			db, err := gorm.Open(test.dialector(dsn), &gorm.Config{Logger: recorder})
			require.NoError(t, err)
			sqlDB, err := db.DB()
			require.NoError(t, err)
			t.Cleanup(func() { _ = sqlDB.Close() })
			testChannelLimitColumnsMigration(t, db, recorder)
		})
	}
}
