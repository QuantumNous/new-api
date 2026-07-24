package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
)

// findLedger 按 source 找一条明细的当前 remaining/status（DB 真值）。
func getLedgerById(t *testing.T, id int) FreeQuotaLedger {
	t.Helper()
	var l FreeQuotaLedger
	if err := DB.Where("id = ?", id).First(&l).Error; err != nil {
		t.Fatalf("get ledger %d: %v", id, err)
	}
	return l
}

// TC-C01：三级扣减顺序——会过期免费(升序) → 充值钱包 → 不过期免费。
func TestConsumeQuotaThreeTierOrder(t *testing.T) {
	setupWalletTestDB(t)
	userId := createTestUser(t, "default", "default")
	if err := DB.Model(&User{}).Where("id = ?", userId).Update("quota", 5000).Error; err != nil {
		t.Fatalf("seed recharge: %v", err)
	}
	now := common.GetTimestamp()
	// 会过期：3天(2000)、30天(3000)；不过期(4000)
	if err := AddFreeQuota(nil, userId, 2000, FreeQuotaSourceCheckin, 0, now+3*86400); err != nil {
		t.Fatalf("add free exp3: %v", err)
	}
	if err := AddFreeQuota(nil, userId, 3000, FreeQuotaSourceTopupGift, 0, now+30*86400); err != nil {
		t.Fatalf("add free exp30: %v", err)
	}
	if err := AddFreeQuota(nil, userId, 4000, FreeQuotaSourceAdmin, 0, 0); err != nil {
		t.Fatalf("add free perm: %v", err)
	}
	// 初始总额 5000+9000 = 14000
	assertInvariants(t, userId, 5000, 9000)

	// 扣 2500：应先扣光 3天(2000)，再从 30天扣 500。充值、不过期不动。
	fromFree, fromRecharge, err := ConsumeQuota(userId, 2500)
	if err != nil {
		t.Fatalf("consume 2500: %v", err)
	}
	if fromRecharge != 0 {
		t.Errorf("expected no recharge deduction, got %d", fromRecharge)
	}
	if len(fromFree) != 2 || fromFree[0].Amount != 2000 || fromFree[1].Amount != 500 {
		t.Fatalf("tier-1 order wrong: %+v", fromFree)
	}
	// 3天明细必须先于30天明细（expired_time 升序）
	if !(fromFree[0].ExpiredTime < fromFree[1].ExpiredTime) {
		t.Errorf("expiring order wrong: %d then %d", fromFree[0].ExpiredTime, fromFree[1].ExpiredTime)
	}
	assertInvariants(t, userId, 5000, 6500)

	// 再扣 8000：免费剩 6500（会过期2500 + 不过期4000）；先扣会过期2500，
	// 再扣充值5000 中的 5000? 需求：会过期 → 充值 → 不过期。
	// 剩余需求 8000-2500=5500，充值有5000先扣光，再从不过期扣500。
	fromFree2, fromRecharge2, err := ConsumeQuota(userId, 8000)
	if err != nil {
		t.Fatalf("consume 8000: %v", err)
	}
	if fromRecharge2 != 5000 {
		t.Errorf("expected recharge 5000, got %d", fromRecharge2)
	}
	var freeTaken int
	for _, d := range fromFree2 {
		freeTaken += d.Amount
	}
	if freeTaken != 3000 {
		t.Errorf("expected free taken 3000 (2500 expiring + 500 perm), got %d", freeTaken)
	}
	// 最后一笔命中应为不过期明细
	last := fromFree2[len(fromFree2)-1]
	if last.ExpiredTime != FreeQuotaNeverExpire {
		t.Errorf("expected last deduction from non-expiring ledger, got expired_time=%d", last.ExpiredTime)
	}
	// 剩余：充值0，免费 6500-3000=3500
	assertInvariants(t, userId, 0, 3500)
}

// TC-C02：总额不足 → 全额回滚，不产生任何部分扣减。
func TestConsumeQuotaInsufficientRollback(t *testing.T) {
	setupWalletTestDB(t)
	userId := createTestUser(t, "default", "default")
	if err := DB.Model(&User{}).Where("id = ?", userId).Update("quota", 1000).Error; err != nil {
		t.Fatalf("seed recharge: %v", err)
	}
	now := common.GetTimestamp()
	if err := AddFreeQuota(nil, userId, 2000, FreeQuotaSourceCheckin, 0, now+3*86400); err != nil {
		t.Fatalf("add free: %v", err)
	}
	assertInvariants(t, userId, 1000, 2000) // 总额 3000

	_, _, err := ConsumeQuota(userId, 3001)
	if err == nil {
		t.Fatalf("expected insufficient error")
	}
	if err != ErrInsufficientQuota {
		t.Errorf("expected ErrInsufficientQuota, got %v", err)
	}
	// 回滚后余额与明细完全不变
	assertInvariants(t, userId, 1000, 2000)
}

// TC-C03：惰性回收——扣减前把已过期明细回收，free_quota 相应下调，且不参与扣减。
func TestConsumeQuotaRecycleExpired(t *testing.T) {
	setupWalletTestDB(t)
	userId := createTestUser(t, "default", "default")
	if err := DB.Model(&User{}).Where("id = ?", userId).Update("quota", 1000).Error; err != nil {
		t.Fatalf("seed recharge: %v", err)
	}
	now := common.GetTimestamp()
	// 一条已过期（now-100），一条有效
	if err := AddFreeQuota(nil, userId, 3000, FreeQuotaSourceCheckin, 0, now-100); err != nil {
		t.Fatalf("add expired: %v", err)
	}
	if err := AddFreeQuota(nil, userId, 2000, FreeQuotaSourceTopupGift, 0, now+30*86400); err != nil {
		t.Fatalf("add valid: %v", err)
	}
	// 入账时 free_quota=5000（冗余列还没回收）
	recharge, free := readWallet(t, userId)
	if recharge != 1000 || free != 5000 {
		t.Fatalf("pre-recycle wallet: got %d/%d, want 1000/5000", recharge, free)
	}

	// 扣 500：先回收过期3000（free→2000），再从有效2000扣500 → 1500
	fromFree, fromRecharge, err := ConsumeQuota(userId, 500)
	if err != nil {
		t.Fatalf("consume: %v", err)
	}
	if fromRecharge != 0 {
		t.Errorf("expected no recharge, got %d", fromRecharge)
	}
	var taken int
	for _, d := range fromFree {
		taken += d.Amount
	}
	if taken != 500 {
		t.Errorf("expected 500 free taken, got %d", taken)
	}
	// 回收+扣减后：充值1000，免费=2000-500=1500（INV-2 一致）
	assertInvariants(t, userId, 1000, 1500)
}

// TC-C04：仅扣免费——ConsumeFreeQuotaOnly 不溢出充值；免费不足报错。
func TestConsumeFreeQuotaOnly(t *testing.T) {
	setupWalletTestDB(t)
	userId := createTestUser(t, "default", "default")
	if err := DB.Model(&User{}).Where("id = ?", userId).Update("quota", 5000).Error; err != nil {
		t.Fatalf("seed recharge: %v", err)
	}
	now := common.GetTimestamp()
	if err := AddFreeQuota(nil, userId, 2000, FreeQuotaSourceCheckin, 0, now+3*86400); err != nil {
		t.Fatalf("add free: %v", err)
	}

	// 扣免费 1500：充值不动
	if err := ConsumeFreeQuotaOnly(userId, 1500); err != nil {
		t.Fatalf("consume free only: %v", err)
	}
	assertInvariants(t, userId, 5000, 500)

	// 再扣免费 501（超过剩余500）→ 报错，不动
	if err := ConsumeFreeQuotaOnly(userId, 501); err == nil {
		t.Fatalf("expected insufficient free error")
	}
	assertInvariants(t, userId, 5000, 500)
}

// TC-C05：退款原路返回——充值退回充值，未过期免费恢复对应明细。
func TestRefundQuotaOriginalPath(t *testing.T) {
	setupWalletTestDB(t)
	userId := createTestUser(t, "default", "default")
	if err := DB.Model(&User{}).Where("id = ?", userId).Update("quota", 3000).Error; err != nil {
		t.Fatalf("seed recharge: %v", err)
	}
	now := common.GetTimestamp()
	if err := AddFreeQuota(nil, userId, 2000, FreeQuotaSourceCheckin, 0, now+30*86400); err != nil {
		t.Fatalf("add free: %v", err)
	}
	// 扣 4000：免费2000扣光 + 充值扣2000
	fromFree, fromRecharge, err := ConsumeQuota(userId, 4000)
	if err != nil {
		t.Fatalf("consume: %v", err)
	}
	if fromRecharge != 2000 {
		t.Fatalf("expected recharge 2000, got %d", fromRecharge)
	}
	assertInvariants(t, userId, 1000, 0)
	ledgerId := fromFree[0].LedgerId
	// 扣光后明细应为 exhausted
	if l := getLedgerById(t, ledgerId); l.Status != FreeLedgerStatusExhausted || l.Remaining != 0 {
		t.Fatalf("ledger after consume: status=%d remaining=%d, want exhausted/0", l.Status, l.Remaining)
	}

	// 退款：充值退回2000，免费明细恢复2000且转回 active
	if err := RefundQuota(userId, fromFree, fromRecharge); err != nil {
		t.Fatalf("refund: %v", err)
	}
	assertInvariants(t, userId, 3000, 2000)
	if l := getLedgerById(t, ledgerId); l.Status != FreeLedgerStatusActive || l.Remaining != 2000 {
		t.Errorf("ledger after refund: status=%d remaining=%d, want active/2000", l.Status, l.Remaining)
	}
}

// TC-C06：退款遇明细已过期——不复活死明细，改退到充值钱包。
func TestRefundQuotaExpiredLedgerToRecharge(t *testing.T) {
	setupWalletTestDB(t)
	userId := createTestUser(t, "default", "default")
	now := common.GetTimestamp()
	// 一条即将过期的免费明细（2秒后过期），先扣掉一部分
	if err := AddFreeQuota(nil, userId, 2000, FreeQuotaSourceCheckin, 0, now+2); err != nil {
		t.Fatalf("add free: %v", err)
	}
	fromFree, fromRecharge, err := ConsumeQuota(userId, 800)
	if err != nil {
		t.Fatalf("consume: %v", err)
	}
	if fromRecharge != 0 || len(fromFree) != 1 || fromFree[0].Amount != 800 {
		t.Fatalf("consume result unexpected: recharge=%d free=%+v", fromRecharge, fromFree)
	}
	assertInvariants(t, userId, 0, 1200)

	// 构造"退款时该明细已过期"：把 fromFree 记录的 ExpiredTime 改成过去，模拟退款发生在过期后。
	// （直接改传入退款结构的 ExpiredTime，触发 RefundQuota 的 d.ExpiredTime <= now 分支）
	fromFree[0].ExpiredTime = now - 100

	if err := RefundQuota(userId, fromFree, fromRecharge); err != nil {
		t.Fatalf("refund: %v", err)
	}
	// 800 应改退到充值钱包，免费明细不恢复
	recharge, free := readWallet(t, userId)
	if recharge != 800 {
		t.Errorf("expected 800 refunded to recharge, got %d", recharge)
	}
	// 免费冗余列不变（1200）；明细 remaining 仍为 1200
	if free != 1200 {
		t.Errorf("expected free unchanged 1200, got %d", free)
	}
}

// TC-C07：透支补扣——余额不足时，可扣部分正常扣，差额透支充值钱包（扣成负数）。
func TestConsumeQuotaWithOverdraft(t *testing.T) {
	setupWalletTestDB(t)
	userId := createTestUser(t, "default", "default")
	if err := DB.Model(&User{}).Where("id = ?", userId).Update("quota", 1000).Error; err != nil {
		t.Fatalf("seed recharge: %v", err)
	}
	now := common.GetTimestamp()
	if err := AddFreeQuota(nil, userId, 500, FreeQuotaSourceCheckin, 0, now+3*86400); err != nil {
		t.Fatalf("add free: %v", err)
	}
	// 总可用 1500，扣 2000 → 透支 500
	fromFree, fromRecharge, err := ConsumeQuotaWithOverdraft(userId, 2000)
	if err != nil {
		t.Fatalf("overdraft consume: %v", err)
	}
	// 免费 500 扣光 + 充值 1000 扣光 + 透支 500 → fromRecharge = 1000+500 = 1500
	if sumLedgerDeducts(fromFree) != 500 {
		t.Errorf("expected free taken 500, got %d", sumLedgerDeducts(fromFree))
	}
	if fromRecharge != 1500 {
		t.Errorf("expected recharge taken 1500 (1000 real + 500 overdraft), got %d", fromRecharge)
	}
	// 充值钱包透支为 -500，免费 0
	recharge, free := readWallet(t, userId)
	if recharge != -500 {
		t.Errorf("expected recharge overdrawn to -500, got %d", recharge)
	}
	if free != 0 {
		t.Errorf("expected free 0, got %d", free)
	}
	// INV-2：无有效免费明细
	sum, _ := SumActiveFreeQuota(DB, userId, common.GetTimestamp())
	if sum != 0 {
		t.Errorf("expected active free sum 0, got %d", sum)
	}
}

// TC-C08：ConsumeQuotaWithOverdraft 余额充足时行为等同三级扣减（不透支）。
func TestConsumeQuotaWithOverdraftSufficient(t *testing.T) {
	setupWalletTestDB(t)
	userId := createTestUser(t, "default", "default")
	if err := DB.Model(&User{}).Where("id = ?", userId).Update("quota", 3000).Error; err != nil {
		t.Fatalf("seed recharge: %v", err)
	}
	now := common.GetTimestamp()
	if err := AddFreeQuota(nil, userId, 2000, FreeQuotaSourceCheckin, 0, now+3*86400); err != nil {
		t.Fatalf("add free: %v", err)
	}
	// 扣 2500：先免费 2000，再充值 500，不透支
	fromFree, fromRecharge, err := ConsumeQuotaWithOverdraft(userId, 2500)
	if err != nil {
		t.Fatalf("consume: %v", err)
	}
	if sumLedgerDeducts(fromFree) != 2000 || fromRecharge != 500 {
		t.Errorf("expected free 2000/recharge 500, got free=%d recharge=%d", sumLedgerDeducts(fromFree), fromRecharge)
	}
	assertInvariants(t, userId, 2500, 0)
}

// TC-C09：批量过期回收——扫出有过期明细的用户并回收，free_quota 归正。
func TestBatchRecycleExpiredFreeQuota(t *testing.T) {
	setupWalletTestDB(t)
	u1 := createTestUser(t, "default", "default")
	u2 := createTestUser(t, "default", "default")
	now := common.GetTimestamp()
	// u1：一条已过期(3000) + 一条有效(1000)
	if err := AddFreeQuota(nil, u1, 3000, FreeQuotaSourceCheckin, 0, now-100); err != nil {
		t.Fatalf("u1 expired: %v", err)
	}
	if err := AddFreeQuota(nil, u1, 1000, FreeQuotaSourceTopupGift, 0, now+86400); err != nil {
		t.Fatalf("u1 valid: %v", err)
	}
	// u2：仅有效额度，不应被回收
	if err := AddFreeQuota(nil, u2, 2000, FreeQuotaSourceCheckin, 0, now+86400); err != nil {
		t.Fatalf("u2 valid: %v", err)
	}
	// 回收前 free_quota 冗余列虚高（未回收）
	_, f1 := readWallet(t, u1)
	if f1 != 4000 {
		t.Fatalf("u1 pre-recycle free: got %d want 4000", f1)
	}

	userCount, totalRecycled, err := BatchRecycleExpiredFreeQuota(0)
	if err != nil {
		t.Fatalf("batch recycle: %v", err)
	}
	if userCount != 1 {
		t.Errorf("expected 1 user recycled, got %d", userCount)
	}
	if totalRecycled != 3000 {
		t.Errorf("expected 3000 recycled, got %d", totalRecycled)
	}
	// u1 回收后 free=1000，u2 不变 2000
	assertInvariants(t, u1, 0, 1000)
	assertInvariants(t, u2, 0, 2000)

	// 再跑一次应无可回收
	userCount2, _, err := BatchRecycleExpiredFreeQuota(0)
	if err != nil {
		t.Fatalf("batch recycle 2: %v", err)
	}
	if userCount2 != 0 {
		t.Errorf("expected 0 users on second run, got %d", userCount2)
	}
}

