package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
)

// setupWalletTestDB 复用 setupTestDB，并补充双钱包相关表的迁移与清理。
func setupWalletTestDB(t *testing.T) {
	t.Helper()
	setupTestDB(t) // 未设 TEST_SQL_DSN 时会 t.Skip
	if err := DB.AutoMigrate(&FreeQuotaLedger{}, &RedemptionClaim{}, &Checkin{}, &TopUp{}); err != nil {
		t.Fatalf("failed to migrate wallet tables: %v", err)
	}
	clean := func() {
		DB.Exec("DELETE FROM free_quota_ledgers")
		DB.Exec("DELETE FROM redemption_claims")
		DB.Exec("DELETE FROM checkins")
		DB.Exec("DELETE FROM top_ups")
	}
	clean()
	t.Cleanup(clean)
}

// readWallet 直接从 DB 读取充值/免费钱包（绕过缓存，验证真值）。
func readWallet(t *testing.T, userId int) (recharge int, free int) {
	t.Helper()
	var u User
	if err := DB.Model(&User{}).Where("id = ?", userId).
		Select("quota", "free_quota").First(&u).Error; err != nil {
		t.Fatalf("read wallet: %v", err)
	}
	return u.Quota, u.FreeQuota
}

// assertInvariants 校验核心不变式 INV-1（总额）与 INV-2（免费冗余汇总一致）。
func assertInvariants(t *testing.T, userId int, wantRecharge, wantFree int) {
	t.Helper()
	now := common.GetTimestamp()
	recharge, free := readWallet(t, userId)
	if recharge != wantRecharge {
		t.Errorf("INV recharge: got %d, want %d", recharge, wantRecharge)
	}
	if free != wantFree {
		t.Errorf("INV free: got %d, want %d", free, wantFree)
	}
	// INV-2: free_quota == SUM(active 且未过期 remaining)
	sum, err := SumActiveFreeQuota(DB, userId, now)
	if err != nil {
		t.Fatalf("sum active free: %v", err)
	}
	if sum != free {
		t.Errorf("INV-2 mismatch: free_quota=%d, SUM(active remaining)=%d", free, sum)
	}
}

// TC-A01：存量迁移——仅 quota 有值，free_quota 默认 0，总额不变。
func TestWalletMigrationLegacyBalance(t *testing.T) {
	setupWalletTestDB(t)
	userId := createTestUser(t, "default", "default")
	if err := DB.Model(&User{}).Where("id = ?", userId).Update("quota", 100000).Error; err != nil {
		t.Fatalf("seed quota: %v", err)
	}

	recharge, free := readWallet(t, userId)
	if recharge != 100000 || free != 0 {
		t.Fatalf("legacy migration: got recharge=%d free=%d, want 100000/0", recharge, free)
	}
	total, err := GetUserTotalQuota(userId, true)
	if err != nil {
		t.Fatalf("total: %v", err)
	}
	if total != 100000 {
		t.Errorf("INV-1 total: got %d, want 100000", total)
	}
}

// TC-A02：任意入账后总额一致——AddRechargeQuota + AddFreeQuota 后校验 INV-1/INV-2。
func TestWalletAddAndTotalConsistency(t *testing.T) {
	setupWalletTestDB(t)
	userId := createTestUser(t, "default", "default")
	if err := DB.Model(&User{}).Where("id = ?", userId).Update("quota", 50000).Error; err != nil {
		t.Fatalf("seed quota: %v", err)
	}

	now := common.GetTimestamp()
	if err := AddFreeQuota(nil, userId, 30000, FreeQuotaSourceCheckin, 0, now+7*86400); err != nil {
		t.Fatalf("add free: %v", err)
	}
	assertInvariants(t, userId, 50000, 30000)

	total, err := GetUserTotalQuota(userId, true)
	if err != nil {
		t.Fatalf("total: %v", err)
	}
	if total != 80000 {
		t.Errorf("INV-1 total: got %d, want 80000", total)
	}

	// 再入充值钱包，验证充值不影响免费汇总
	if err := AddRechargeQuota(nil, userId, 5000); err != nil {
		t.Fatalf("add recharge: %v", err)
	}
	assertInvariants(t, userId, 55000, 30000)
}

// AddFreeQuota 多条明细：INV-2 汇总 = 各明细 remaining 之和；不过期项写哨兵值。
func TestAddFreeQuotaMultipleLedgers(t *testing.T) {
	setupWalletTestDB(t)
	userId := createTestUser(t, "default", "default")

	now := common.GetTimestamp()
	if err := AddFreeQuota(nil, userId, 2000, FreeQuotaSourceCheckin, 0, now+3*86400); err != nil {
		t.Fatalf("add free 1: %v", err)
	}
	if err := AddFreeQuota(nil, userId, 3000, FreeQuotaSourceTopupGift, 0, now+30*86400); err != nil {
		t.Fatalf("add free 2: %v", err)
	}
	// 不过期免费（expiredTime<=0 => 哨兵值）
	if err := AddFreeQuota(nil, userId, 4000, FreeQuotaSourceAdmin, 0, 0); err != nil {
		t.Fatalf("add free perm: %v", err)
	}

	assertInvariants(t, userId, 0, 9000)

	ledgers, err := ListFreeQuotaLedgers(userId)
	if err != nil {
		t.Fatalf("list ledgers: %v", err)
	}
	if len(ledgers) != 3 {
		t.Fatalf("ledger count: got %d, want 3", len(ledgers))
	}
	// 校验哨兵值写入
	var permFound bool
	for _, l := range ledgers {
		if l.Source == FreeQuotaSourceAdmin {
			permFound = true
			if l.ExpiredTime != FreeQuotaNeverExpire {
				t.Errorf("perm ledger expired_time: got %d, want sentinel %d", l.ExpiredTime, FreeQuotaNeverExpire)
			}
			if l.IsExpiring() {
				t.Errorf("perm ledger should not be expiring")
			}
		}
	}
	if !permFound {
		t.Errorf("perm ledger not found")
	}

	// GetActiveFreeQuotaLedgers 排序：会过期(3天) < 会过期(30天) < 不过期(哨兵)
	active, err := GetActiveFreeQuotaLedgers(DB, userId, now)
	if err != nil {
		t.Fatalf("active ledgers: %v", err)
	}
	if len(active) != 3 {
		t.Fatalf("active count: got %d, want 3", len(active))
	}
	if !(active[0].ExpiredTime <= active[1].ExpiredTime && active[1].ExpiredTime <= active[2].ExpiredTime) {
		t.Errorf("active ledgers not sorted by expired_time asc: %d,%d,%d",
			active[0].ExpiredTime, active[1].ExpiredTime, active[2].ExpiredTime)
	}
	if active[2].ExpiredTime != FreeQuotaNeverExpire {
		t.Errorf("last active ledger should be the non-expiring one")
	}
}

// 负数/零金额入账保护。
func TestAddQuotaGuards(t *testing.T) {
	setupWalletTestDB(t)
	userId := createTestUser(t, "default", "default")

	if err := AddRechargeQuota(nil, userId, -1); err == nil {
		t.Errorf("expected error for negative recharge")
	}
	if err := AddFreeQuota(nil, userId, -1, FreeQuotaSourceCheckin, 0, 0); err == nil {
		t.Errorf("expected error for negative free quota")
	}
	// 零金额为 no-op，不报错、不产生明细
	if err := AddFreeQuota(nil, userId, 0, FreeQuotaSourceCheckin, 0, 0); err != nil {
		t.Errorf("zero free quota should be no-op, got %v", err)
	}
	ledgers, _ := ListFreeQuotaLedgers(userId)
	if len(ledgers) != 0 {
		t.Errorf("zero amount should not create ledger, got %d", len(ledgers))
	}
}

// TC-A03：门禁口径回归——纯免费钱包用户（充值钱包=0，免费钱包>0）的
// 总可用额度必须计入免费钱包。守卫"扣费前余额门禁"（PreWssConsumeQuota /
// MJ 预扣 / billing 展示）不再仅看充值钱包而误拦有免费额度的用户。
func TestGetUserTotalQuotaFreeOnlyGate(t *testing.T) {
	setupWalletTestDB(t)
	userId := createTestUser(t, "default", "default")
	// 充值钱包保持 0，仅有免费钱包
	now := common.GetTimestamp()
	if err := AddFreeQuota(nil, userId, 1000, FreeQuotaSourceCheckin, 0, now+3*86400); err != nil {
		t.Fatalf("add free: %v", err)
	}

	recharge, free := readWallet(t, userId)
	if recharge != 0 || free != 1000 {
		t.Fatalf("precondition: got recharge=%d free=%d, want 0/1000", recharge, free)
	}

	// 旧门禁口径 GetUserQuota 只看充值钱包 => 0，会误判"余额不足"
	rechargeOnly, err := GetUserQuota(userId, true)
	if err != nil {
		t.Fatalf("recharge-only quota: %v", err)
	}
	if rechargeOnly != 0 {
		t.Errorf("recharge-only quota should be 0, got %d", rechargeOnly)
	}

	// 修复后门禁口径 GetUserTotalQuota 计入免费钱包 => 1000，请求应放行
	total, err := GetUserTotalQuota(userId, true)
	if err != nil {
		t.Fatalf("total quota: %v", err)
	}
	if total != 1000 {
		t.Errorf("total quota must include free wallet: got %d, want 1000", total)
	}
	// 一次典型请求扣费 500：总额 1000 >= 500，门禁必须放行（total-need >= 0）
	if total-500 < 0 {
		t.Errorf("free-only user with 1000 total wrongly gated for a 500 request")
	}
}
