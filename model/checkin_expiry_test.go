package model

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

// ===== 签到额度次日清算（P5）测试 =====
// 共享内存 SQLite（TestMain，MaxOpenConns=1），LOG_DB 与 DB 同库。
// 回收基准是 NetCredited 而非 QuotaAwarded：被贷款还款抵扣的部分从未进入余额。

func seedCheckinUser(t *testing.T, quota int) *User {
	t.Helper()
	require.NoError(t, DB.AutoMigrate(&Checkin{}))
	username := "checkin-expiry-" + common.GetRandomString(8)
	user := &User{
		Username:  username,
		Role:      common.RoleCommonUser,
		Status:    common.UserStatusEnabled,
		Group:     "default",
		Quota:     quota,
		AffCode:   username + "-aff",
		CreatedAt: common.GetTimestamp(),
	}
	require.NoError(t, DB.Create(user).Error)
	return user
}

func seedCheckinRow(t *testing.T, userId int, date string, awarded, netCredited int) *Checkin {
	t.Helper()
	row := &Checkin{
		UserId:       userId,
		CheckinDate:  date,
		QuotaAwarded: awarded,
		NetCredited:  netCredited,
		CreatedAt:    common.GetTimestamp(),
	}
	require.NoError(t, DB.Create(row).Error)
	return row
}

func seedConsumeLog(t *testing.T, userId int, ts int64, quota int) {
	t.Helper()
	require.NoError(t, LOG_DB.Create(&Log{
		UserId:    userId,
		Type:      LogTypeConsume,
		Quota:     quota,
		CreatedAt: ts,
		Content:   "test consume",
	}).Error)
}

func checkinUserQuotaValue(t *testing.T, userId int) int {
	t.Helper()
	var u User
	require.NoError(t, DB.Select("quota").First(&u, userId).Error)
	return u.Quota
}

func checkinRowByID(t *testing.T, id int) Checkin {
	t.Helper()
	var row Checkin
	require.NoError(t, DB.First(&row, id).Error)
	return row
}

func dayRange(t *testing.T, date string) (int64, int64) {
	t.Helper()
	start, end, err := checkinDateRange(date)
	require.NoError(t, err)
	return start, end
}

func TestSettleCheckinDateUnusedMode(t *testing.T) {
	yesterday := time.Now().AddDate(0, 0, -1).Format("2006-01-02")
	user := seedCheckinUser(t, 10000)
	row := seedCheckinRow(t, user.Id, yesterday, 5000, 5000)

	// 当天消耗 2000 → 回收 5000-2000=3000，余额 10000-3000=7000
	start, _ := dayRange(t, yesterday)
	seedConsumeLog(t, user.Id, start+3600, 2000)

	settled, reclaimed, err := SettleCheckinDate(yesterday, "unused", 200)
	require.NoError(t, err)
	require.Equal(t, 1, settled)
	require.Equal(t, int64(3000), reclaimed)
	require.Equal(t, 7000, checkinUserQuotaValue(t, user.Id))

	after := checkinRowByID(t, row.Id)
	require.Greater(t, after.SettledAt, int64(0))
	require.Equal(t, 3000, after.ExpiredQuota)
}

func TestSettleCheckinDateAllMode(t *testing.T) {
	yesterday := time.Now().AddDate(0, 0, -1).Format("2006-01-02")
	user := seedCheckinUser(t, 10000)
	row := seedCheckinRow(t, user.Id, yesterday, 5000, 5000)

	// 全额模式无视当天消耗
	start, _ := dayRange(t, yesterday)
	seedConsumeLog(t, user.Id, start+3600, 5000)

	settled, reclaimed, err := SettleCheckinDate(yesterday, "all", 200)
	require.NoError(t, err)
	require.Equal(t, 1, settled)
	require.Equal(t, int64(5000), reclaimed)
	require.Equal(t, 5000, checkinUserQuotaValue(t, user.Id))
	require.Equal(t, 5000, checkinRowByID(t, row.Id).ExpiredQuota)
}

func TestSettleCheckinDateIdempotent(t *testing.T) {
	yesterday := time.Now().AddDate(0, 0, -1).Format("2006-01-02")
	user := seedCheckinUser(t, 10000)
	seedCheckinRow(t, user.Id, yesterday, 5000, 5000)

	settled, reclaimed, err := SettleCheckinDate(yesterday, "all", 200)
	require.NoError(t, err)
	require.Equal(t, 1, settled)
	require.Equal(t, int64(5000), reclaimed)

	// 重复清算：无未清算记录，零回收、余额不再变动
	settled, reclaimed, err = SettleCheckinDate(yesterday, "all", 200)
	require.NoError(t, err)
	require.Equal(t, 0, settled)
	require.Equal(t, int64(0), reclaimed)
	require.Equal(t, 5000, checkinUserQuotaValue(t, user.Id))
}

func TestSettleCheckinDateNetCreditedZeroSkips(t *testing.T) {
	yesterday := time.Now().AddDate(0, 0, -1).Format("2006-01-02")
	user := seedCheckinUser(t, 10000)
	// 老数据 NetCredited=0：标记已清算但不回收任何额度
	row := seedCheckinRow(t, user.Id, yesterday, 5000, 0)

	settled, reclaimed, err := SettleCheckinDate(yesterday, "all", 200)
	require.NoError(t, err)
	require.Equal(t, 1, settled)
	require.Equal(t, int64(0), reclaimed)
	require.Equal(t, 10000, checkinUserQuotaValue(t, user.Id))
	require.Greater(t, checkinRowByID(t, row.Id).SettledAt, int64(0))
}

func TestSettleCheckinDateNeverNegativeBalance(t *testing.T) {
	yesterday := time.Now().AddDate(0, 0, -1).Format("2006-01-02")
	// 余额只有 1000，要回收 5000：只扣到 0，不扣成负数
	user := seedCheckinUser(t, 1000)
	row := seedCheckinRow(t, user.Id, yesterday, 5000, 5000)

	settled, reclaimed, err := SettleCheckinDate(yesterday, "all", 200)
	require.NoError(t, err)
	require.Equal(t, 1, settled)
	require.Equal(t, int64(1000), reclaimed)
	require.Equal(t, 0, checkinUserQuotaValue(t, user.Id))
	require.Equal(t, 1000, checkinRowByID(t, row.Id).ExpiredQuota)
}

func TestSettleCheckinDateRepayOffsetNotReclaimed(t *testing.T) {
	yesterday := time.Now().AddDate(0, 0, -1).Format("2006-01-02")
	user := seedCheckinUser(t, 10000)
	// 奖励 5000，其中 4000 被贷款还款抵扣，净入账 1000：回收基准是 1000
	seedCheckinRow(t, user.Id, yesterday, 5000, 1000)

	settled, reclaimed, err := SettleCheckinDate(yesterday, "all", 200)
	require.NoError(t, err)
	require.Equal(t, 1, settled)
	require.Equal(t, int64(1000), reclaimed)
	require.Equal(t, 9000, checkinUserQuotaValue(t, user.Id))
}

func TestOldestUnsettledCheckinDate(t *testing.T) {
	user := seedCheckinUser(t, 1000)
	today := time.Now().Format("2006-01-02")
	d1 := time.Now().AddDate(0, 0, -3).Format("2006-01-02")
	d2 := time.Now().AddDate(0, 0, -2).Format("2006-01-02")

	seedCheckinRow(t, user.Id, d1, 100, 100)
	seedCheckinRow(t, user.Id, d2, 100, 100)
	// 今天的记录不参与清算
	seedCheckinRow(t, user.Id, today, 100, 100)

	oldest, err := OldestUnsettledCheckinDate(today)
	require.NoError(t, err)
	require.Equal(t, d1, oldest)

	// 清算 d1 后推进到 d2
	_, _, err = SettleCheckinDate(d1, "all", 200)
	require.NoError(t, err)
	oldest, err = OldestUnsettledCheckinDate(today)
	require.NoError(t, err)
	require.Equal(t, d2, oldest)
}

func TestSettleSkipsMakeupRows(t *testing.T) {
	// 用远离其他测试用例的独特日期，保证共享库内不串扰
	normalDate := time.Now().AddDate(0, 0, -300).Format("2006-01-02")
	makeupDate := time.Now().AddDate(0, 0, -301).Format("2006-01-02")
	user := seedCheckinUser(t, 10000)
	seedCheckinRow(t, user.Id, normalDate, 5000, 5000)
	// 补签只出现在没有正常签到的日期（user_id+checkin_date 唯一）
	makeup := seedCheckinRow(t, user.Id, makeupDate, 3000, 3000)
	require.NoError(t, DB.Model(&Checkin{}).Where("id = ?", makeup.Id).Update("is_makeup", true).Error)

	settled, reclaimed, err := SettleCheckinDate(normalDate, "all", 200)
	require.NoError(t, err)
	require.Equal(t, 1, settled, "只清算正常签到行")
	require.Equal(t, int64(5000), reclaimed)
	require.Equal(t, 5000, checkinUserQuotaValue(t, user.Id), "补签额度不被回收")

	afterMakeup := checkinRowByID(t, makeup.Id)
	require.Equal(t, int64(0), afterMakeup.SettledAt, "补签行保持未清算，被管线跳过")
	require.Zero(t, afterMakeup.ExpiredQuota)

	// 只有补签行的日期不会被当作待清算日期，避免任务空转
	n, reclaimed2, err := SettleCheckinDate(makeupDate, "all", 200)
	require.NoError(t, err)
	require.Zero(t, n)
	require.Zero(t, reclaimed2)

	oldest, err := OldestUnsettledCheckinDate(time.Now().Format("2006-01-02"))
	require.NoError(t, err)
	require.NotEqual(t, makeupDate, oldest, "补签行不能让 OldestUnsettled 返回其日期")
}
