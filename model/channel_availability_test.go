package model

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
)

func availabilitySetting(t *testing.T, windows ...dto.ChannelAvailabilityWindow) *string {
	t.Helper()
	raw, err := common.Marshal(dto.ChannelSettings{AvailabilityWindows: windows})
	require.NoError(t, err)
	text := string(raw)
	return &text
}

func shanghai(t *testing.T, year int, month time.Month, day, hour, minute int) time.Time {
	t.Helper()
	location, err := time.LoadLocation("Asia/Shanghai")
	require.NoError(t, err)
	return time.Date(year, month, day, hour, minute, 0, 0, location)
}

func TestParseChannelAvailabilityWindowsRejectsInvalidWindows(t *testing.T) {
	cases := []struct {
		name    string
		windows []dto.ChannelAvailabilityWindow
		want    string
	}{
		{
			name:    "unknown timezone",
			windows: []dto.ChannelAvailabilityWindow{{Timezone: "Mars/Base", Start: "09:00", End: "18:00"}},
			want:    "timezone is not an IANA timezone",
		},
		{
			name:    "malformed start",
			windows: []dto.ChannelAvailabilityWindow{{Start: "9:00", End: "18:00"}},
			want:    "start",
		},
		{
			name:    "hour out of range",
			windows: []dto.ChannelAvailabilityWindow{{Start: "24:00", End: "18:00"}},
			want:    "start",
		},
		{
			name:    "equal bounds",
			windows: []dto.ChannelAvailabilityWindow{{Start: "09:00", End: "09:00"}},
			want:    "starts and ends at the same minute",
		},
		{
			name:    "weekday out of range",
			windows: []dto.ChannelAvailabilityWindow{{Weekdays: []int{7}, Start: "09:00", End: "18:00"}},
			want:    "weekdays entry 7 is outside 0-6",
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := ParseChannelAvailabilityWindows(tc.windows)
			require.Error(t, err)
			assert.Contains(t, err.Error(), tc.want)
		})
	}
}

func TestChannelIsAvailableAtMatchesWindows(t *testing.T) {
	cases := []struct {
		name    string
		windows []dto.ChannelAvailabilityWindow
		now     time.Time
		want    bool
	}{
		{
			name: "no window is always available",
			now:  shanghai(t, 2026, time.March, 2, 3, 0),
			want: true,
		},
		{
			name:    "inside a same-day window",
			windows: []dto.ChannelAvailabilityWindow{{Timezone: "Asia/Shanghai", Start: "09:00", End: "12:00"}},
			now:     shanghai(t, 2026, time.March, 2, 9, 0),
			want:    true,
		},
		{
			name:    "the end minute is exclusive",
			windows: []dto.ChannelAvailabilityWindow{{Timezone: "Asia/Shanghai", Start: "09:00", End: "12:00"}},
			now:     shanghai(t, 2026, time.March, 2, 12, 0),
			want:    false,
		},
		{
			name:    "outside a same-day window",
			windows: []dto.ChannelAvailabilityWindow{{Timezone: "Asia/Shanghai", Start: "09:00", End: "12:00"}},
			now:     shanghai(t, 2026, time.March, 2, 20, 30),
			want:    false,
		},
		{
			name:    "the configured timezone decides the wall clock",
			windows: []dto.ChannelAvailabilityWindow{{Timezone: "Asia/Shanghai", Start: "09:00", End: "12:00"}},
			now:     time.Date(2026, time.March, 2, 2, 0, 0, 0, time.UTC),
			want:    true,
		},
		{
			name:    "a weekday window rejects the weekend",
			windows: []dto.ChannelAvailabilityWindow{{Timezone: "Asia/Shanghai", Weekdays: []int{1, 2, 3, 4, 5}, Start: "09:00", End: "18:00"}},
			now:     shanghai(t, 2026, time.March, 1, 10, 0),
			want:    false,
		},
		{
			name:    "a window crossing midnight covers the late evening",
			windows: []dto.ChannelAvailabilityWindow{{Timezone: "Asia/Shanghai", Start: "22:00", End: "02:00"}},
			now:     shanghai(t, 2026, time.March, 2, 23, 30),
			want:    true,
		},
		{
			name:    "a window crossing midnight covers the early morning",
			windows: []dto.ChannelAvailabilityWindow{{Timezone: "Asia/Shanghai", Start: "22:00", End: "02:00"}},
			now:     shanghai(t, 2026, time.March, 2, 1, 30),
			want:    true,
		},
		{
			name:    "a window crossing midnight excludes midday",
			windows: []dto.ChannelAvailabilityWindow{{Timezone: "Asia/Shanghai", Start: "22:00", End: "02:00"}},
			now:     shanghai(t, 2026, time.March, 2, 12, 0),
			want:    false,
		},
		{
			name: "any matching window makes the channel available",
			windows: []dto.ChannelAvailabilityWindow{
				{Timezone: "Asia/Shanghai", Start: "09:00", End: "12:00"},
				{Timezone: "Asia/Shanghai", Start: "14:00", End: "18:00"},
			},
			now:  shanghai(t, 2026, time.March, 2, 15, 0),
			want: true,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			channel := &Channel{Id: 1, Setting: availabilitySetting(t, tc.windows...)}
			assert.Equal(t, tc.want, channel.IsAvailableAt(tc.now))
		})
	}
}

func TestChannelAvailabilitySelectsOnlyAvailableChannels(t *testing.T) {
	previousCache := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true
	t.Cleanup(func() { common.MemoryCacheEnabled = previousCache })

	winning := int64(10)
	deepSeek := &Channel{Id: 1, Priority: &winning}
	volcengine := &Channel{Id: 2}
	volcengineWindows, err := ParseChannelAvailabilityWindows([]dto.ChannelAvailabilityWindow{
		{Timezone: "Asia/Shanghai", Start: "22:00", End: "02:00"},
	})
	require.NoError(t, err)

	previousChannels := channelsIDM
	previousCandidates := group2model2channels
	previousAvailability := channel2availability
	t.Cleanup(func() {
		channelsIDM = previousChannels
		group2model2channels = previousCandidates
		channel2availability = previousAvailability
	})

	channelsIDM = map[int]*Channel{1: deepSeek, 2: volcengine}
	group2model2channels = map[string]map[string][]int{"default": {"deepseek-flash": {1, 2}}}

	t.Run("an unavailable channel outside its window is skipped even at a higher priority", func(t *testing.T) {
		channel2availability = map[int][]channelAvailabilityWindow{2: volcengineWindows}
		if volcengineWindows[0].matches(time.Now()) {
			t.Skip("the wall clock is inside the test window")
		}
		for range 5 {
			channel, err := GetRandomSatisfiedChannel("default", "deepseek-flash", 0, nil)
			require.NoError(t, err)
			require.NotNil(t, channel)
			assert.Equal(t, deepSeek.Id, channel.Id)
		}
	})

	t.Run("no available channel yields nil instead of a disabled pick", func(t *testing.T) {
		channel2availability = map[int][]channelAvailabilityWindow{1: volcengineWindows, 2: volcengineWindows}
		if volcengineWindows[0].matches(time.Now()) {
			t.Skip("the wall clock is inside the test window")
		}
		channel, err := GetRandomSatisfiedChannel("default", "deepseek-flash", 0, nil)
		require.NoError(t, err)
		assert.Nil(t, channel)
	})

	t.Run("a channel without windows stays selectable", func(t *testing.T) {
		channel2availability = map[int][]channelAvailabilityWindow{}
		seen := map[int]bool{}
		for range 40 {
			channel, err := GetRandomSatisfiedChannel("default", "deepseek-flash", 0, nil)
			require.NoError(t, err)
			require.NotNil(t, channel)
			seen[channel.Id] = true
		}
		assert.True(t, seen[deepSeek.Id] || seen[volcengine.Id])
	})
}

// openAvailabilityTestDB points the package DB at a fresh schema for one
// dialect. mysql and postgres need their DSN environment variables.
func openAvailabilityTestDB(t *testing.T, dialect string) *gorm.DB {
	t.Helper()
	var driver gorm.Dialector
	switch dialect {
	case "sqlite":
		driver = sqlite.Open(filepath.Join(t.TempDir(), "channel-availability.db"))
	case "mysql":
		dsn := os.Getenv("TEST_MYSQL_DSN")
		if dsn == "" {
			t.Skip("TEST_MYSQL_DSN is not configured")
		}
		driver = mysql.Open(dsn)
	case "postgres":
		dsn := os.Getenv("TEST_POSTGRES_DSN")
		if dsn == "" {
			t.Skip("TEST_POSTGRES_DSN is not configured")
		}
		driver = postgres.Open(dsn)
	}
	db, err := gorm.Open(driver, &gorm.Config{NamingStrategy: schema.NamingStrategy{TablePrefix: "channel_availability_test_"}})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(2)

	previousDB, previousType := DB, common.MainDatabaseType()
	DB = db
	common.SetMainDatabaseType(common.DatabaseType(dialect))
	initCol()
	t.Cleanup(func() {
		DB = previousDB
		common.SetMainDatabaseType(previousType)
		initCol()
		assert.NoError(t, db.Migrator().DropTable(&Ability{}, &Channel{}))
		assert.NoError(t, sqlDB.Close())
	})
	require.NoError(t, db.AutoMigrate(&Channel{}, &Ability{}))
	return db
}

// outsideTodayWindows excludes the current weekday, so the channel is never
// available whenever the test runs.
func outsideTodayWindows(t *testing.T) *string {
	t.Helper()
	weekdays := make([]int, 0, 6)
	for weekday := range 7 {
		if weekday != int(time.Now().Weekday()) {
			weekdays = append(weekdays, weekday)
		}
	}
	return availabilitySetting(t, dto.ChannelAvailabilityWindow{
		Timezone: "UTC",
		Weekdays: weekdays,
		Start:    "00:00",
		End:      "23:59",
	})
}

func TestGetChannelSkipsChannelsOutsideAvailabilityWindows(t *testing.T) {
	for _, dialect := range []string{"sqlite", "mysql", "postgres"} {
		t.Run(dialect, func(t *testing.T) {
			db := openAvailabilityTestDB(t, dialect)
			previousCache := common.MemoryCacheEnabled
			common.MemoryCacheEnabled = false
			t.Cleanup(func() { common.MemoryCacheEnabled = previousCache })

			winning := int64(10)
			daytime := &Channel{Name: "daytime", Status: common.ChannelStatusEnabled, Models: "deepseek-flash", Group: "default", Priority: &winning, Setting: outsideTodayWindows(t)}
			nighttime := &Channel{Name: "nighttime", Status: common.ChannelStatusEnabled, Models: "deepseek-flash", Group: "default"}
			for _, channel := range []*Channel{daytime, nighttime} {
				require.NoError(t, db.Create(channel).Error)
				require.NoError(t, channel.AddAbilities(db))
			}

			// The higher priority channel is outside its window, so the lower
			// priority one serves the request instead.
			for range 5 {
				channel, err := GetChannel("default", "deepseek-flash", 0, nil)
				require.NoError(t, err)
				require.NotNil(t, channel)
				assert.Equal(t, nighttime.Id, channel.Id)
			}

			// When every candidate is outside its window the database path
			// reports no channel instead of returning one that cannot serve.
			nighttime.Setting = outsideTodayWindows(t)
			require.NoError(t, db.Model(nighttime).Update("setting", *nighttime.Setting).Error)
			channel, err := GetChannel("default", "deepseek-flash", 0, nil)
			require.NoError(t, err)
			assert.Nil(t, channel)
		})
	}
}
