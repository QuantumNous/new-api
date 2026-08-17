package model

import (
	"fmt"
	"math"
	"strings"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

// setupLogDBForProfitTest 创建独立的 sqlite 内存库作为 LOG_DB，
// 并在测试结束后恢复原 LOG_DB，避免依赖其他测试文件的 TestMain。
func setupLogDBForProfitTest(t *testing.T) {
	t.Helper()
	previousLogDB := LOG_DB
	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open log test db: %v", err)
	}
	LOG_DB = db
	t.Cleanup(func() {
		LOG_DB = previousLogDB
		sqlDB, err := db.DB()
		if err == nil && sqlDB != nil {
			_ = sqlDB.Close()
		}
	})
	if err := LOG_DB.AutoMigrate(&Log{}); err != nil {
		t.Fatalf("migrate log db: %v", err)
	}
}

func insertProfitLog(t *testing.T, createdAt int64, quota int, costQuota float64, channelID int, modelName string) {
	t.Helper()
	log := &Log{
		UserId:    1,
		Username:  "test",
		CreatedAt: createdAt,
		Type:      LogTypeConsume,
		ModelName: modelName,
		Quota:     quota,
		CostQuota: costQuota,
		ChannelId: channelID,
	}
	if err := LOG_DB.Create(log).Error; err != nil {
		t.Fatalf("insert log: %v", err)
	}
}

// insertTopupProfitLog 插入一笔充值日志：Quota 恒 0，CostQuota 为折扣让利。
func insertTopupProfitLog(t *testing.T, createdAt int64, concession float64) {
	t.Helper()
	log := &Log{
		UserId:    1,
		Username:  "test",
		CreatedAt: createdAt,
		Type:      LogTypeTopup,
		Quota:     0,
		CostQuota: concession,
	}
	if err := LOG_DB.Create(log).Error; err != nil {
		t.Fatalf("insert topup log: %v", err)
	}
}

func TestSumChannelProfit(t *testing.T) {
	setupLogDBForProfitTest(t)

	// 主库准备渠道：渠道 10、11 启用成本核算，渠道 12 未启用。
	if err := DB.AutoMigrate(&Channel{}); err != nil {
		t.Fatalf("migrate channel db: %v", err)
	}
	for _, ch := range []*Channel{
		{Id: 10, Name: "ch10", CostConfig: `{"enabled":true,"mode":"discount","discount":1}`},
		{Id: 11, Name: "ch11", CostConfig: `{"enabled":true,"mode":"discount","discount":1}`},
		{Id: 12, Name: "ch12"},
	} {
		if err := DB.Save(ch).Error; err != nil {
			t.Fatalf("save channel: %v", err)
		}
	}

	insertProfitLog(t, 1000, 100, 60, 10, "gpt-4o")
	insertProfitLog(t, 1001, 200, 150, 10, "gpt-4o")
	insertProfitLog(t, 1002, 300, 100, 11, "claude")
	insertProfitLog(t, 1003, 999, 0, 12, "uncosted") // 未启用成本渠道：收入直接丢弃
	insertProfitLog(t, 2000, 500, 0, 11, "claude")   // 时间范围外
	insertTopupProfitLog(t, 1100, 5000000)           // 充值让利：计入总成本与 TopupConcession

	summary, byChannel, byModel, trend, err := SumChannelProfit(900, 1500, 0, "", 3600)
	if err != nil {
		t.Fatalf("SumChannelProfit: %v", err)
	}
	if summary.Revenue != 600 || summary.Cost != 5000310 || summary.Count != 4 {
		t.Fatalf("summary = %+v, want revenue=600 cost=5000310 count=4", summary)
	}
	if summary.TopupConcession != 5000000 || summary.TopupCount != 1 {
		t.Fatalf("topup = concession=%v count=%d, want 5000000/1", summary.TopupConcession, summary.TopupCount)
	}
	if len(byChannel) != 2 {
		t.Fatalf("byChannel len = %d, want 2", len(byChannel))
	}
	var channel1 *ChannelProfitRow
	for i := range byChannel {
		if byChannel[i].ChannelID == 10 {
			channel1 = &byChannel[i]
		}
	}
	if channel1 == nil || channel1.Revenue != 300 {
		t.Fatalf("channel10 row = %+v, want revenue=300", byChannel)
	}
	// 按模型聚合仅统计调用日志（不再包含充值的空模型行）。
	if len(byModel) != 2 {
		t.Fatalf("byModel len = %d, want 2", len(byModel))
	}
	// 趋势按小时桶：三条启用成本渠道的调用都落在同一桶。
	if len(trend) != 1 || trend[0].Revenue != 600 || trend[0].Count != 3 {
		t.Fatalf("trend = %+v, want single bucket revenue=600 count=3", trend)
	}
}

func TestCalculateTopupConcession(t *testing.T) {
	const quotaPerUnit = 500000
	// 充 100 美元、9 折实付 657（Price=7.3），应给额 50,000,000，让利 5,000,000。
	got := CalculateTopupConcession(657, 7.3, quotaPerUnit, 50000000)
	if math.Abs(got-5000000) > 1e-6 {
		t.Fatalf("discount concession = %v, want 5000000", got)
	}
	// 无折扣：充值本身不产生利润，让利为 0。
	if got := CalculateTopupConcession(730, 7.3, quotaPerUnit, 50000000); got != 0 {
		t.Fatalf("no discount concession = %v, want 0", got)
	}
	// 加价（实付多于应得）：充值环节不记录正利润，让利钳制为 0。
	if got := CalculateTopupConcession(876, 7.3, quotaPerUnit, 50000000); got != 0 {
		t.Fatalf("overcharge concession = %v, want 0", got)
	}
	// 订阅让利：套餐 $10 送 500 万额度，应给 = 10/7.3×500000 ≈ 684931.51，让利 ≈ 4315068.49。
	subGot := CalculateTopupConcession(10, 7.3, quotaPerUnit, 5000000)
	if math.Abs(subGot-4315068.493150685) > 1e-6 {
		t.Fatalf("subscription concession = %v, want ≈4315068.493150685", subGot)
	}
	// 无限配额（TotalAmount=0）无法量化，让利为 0。
	if got := CalculateTopupConcession(10, 7.3, quotaPerUnit, 0); got != 0 {
		t.Fatalf("unlimited quota concession = %v, want 0", got)
	}
	// 非法入参保护。
	if got := CalculateTopupConcession(0, 7.3, quotaPerUnit, 50000000); got != 0 {
		t.Fatalf("zero money concession = %v, want 0", got)
	}
}
