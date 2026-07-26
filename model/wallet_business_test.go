package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

// ============ 签到 (TC-D01/D02) ============

// TC-D01/D02：签到额度进免费钱包，带 7 天过期明细。
func TestCheckinAwardsFreeWallet(t *testing.T) {
	setupWalletTestDB(t)
	// 启用签到，固定额度，有效期 7 天
	cs := operation_setting.GetCheckinSetting()
	oldEnabled, oldMin, oldMax, oldDays := cs.Enabled, cs.MinQuota, cs.MaxQuota, cs.ValidDays
	cs.Enabled, cs.MinQuota, cs.MaxQuota, cs.ValidDays = true, 5000, 5000, 7
	defer func() { cs.Enabled, cs.MinQuota, cs.MaxQuota, cs.ValidDays = oldEnabled, oldMin, oldMax, oldDays }()

	userId := createTestUser(t, "default", "default")
	before := common.GetTimestamp()

	checkin, _, err := UserCheckin(userId, "")
	if err != nil {
		t.Fatalf("checkin: %v", err)
	}
	if checkin.QuotaAwarded != 5000 {
		t.Fatalf("quota awarded: got %d, want 5000", checkin.QuotaAwarded)
	}

	// 充值钱包不变（0），免费钱包 = 5000
	recharge, free := readWallet(t, userId)
	if recharge != 0 {
		t.Errorf("recharge wallet must stay 0, got %d", recharge)
	}
	if free != 5000 {
		t.Errorf("free wallet: got %d, want 5000", free)
	}

	// 明细：source=checkin，过期时间约 before+7天
	ledgers, err := ListFreeQuotaLedgers(userId)
	if err != nil {
		t.Fatalf("list ledgers: %v", err)
	}
	if len(ledgers) != 1 {
		t.Fatalf("ledger count: got %d, want 1", len(ledgers))
	}
	l := ledgers[0]
	if l.Source != FreeQuotaSourceCheckin {
		t.Errorf("source: got %s, want checkin", l.Source)
	}
	wantExpMin := before + 7*86400
	wantExpMax := common.GetTimestamp() + 7*86400 + 5
	if l.ExpiredTime < wantExpMin || l.ExpiredTime > wantExpMax {
		t.Errorf("expired_time %d not in [%d,%d] (~7 days)", l.ExpiredTime, wantExpMin, wantExpMax)
	}
	if l.ExpiredTime >= FreeQuotaNeverExpire {
		t.Errorf("checkin ledger must be expiring, got sentinel %d", l.ExpiredTime)
	}
}

// ============ 兑换码 (TC-F01~F06) ============

// createRedemptionFull 用完整字段落库（含 tag/max_uses/used_count/valid_days）。
func createRedemptionFull(t *testing.T, r *Redemption) {
	t.Helper()
	r.CreatedTime = common.GetTimestamp()
	if r.Status == 0 {
		r.Status = common.RedemptionCodeStatusEnabled
	}
	if err := DB.Select("user_id", "key", "status", "name", "quota", "created_time",
		"type", "tag", "max_uses", "used_count", "valid_days").Create(r).Error; err != nil {
		t.Fatalf("create redemption: %v", err)
	}
}

// TC-F01：valid_days>0 => 兑换额度进免费钱包（带过期明细）。
func TestRedeem_ValidDaysToFreeWallet(t *testing.T) {
	setupWalletTestDB(t)
	userId := createTestUser(t, "default", "default")
	createRedemptionFull(t, &Redemption{
		UserId: 1, Key: "rc-free-01", Name: "free", Quota: 3000,
		Type: common.RedemptionTypeQuota, MaxUses: 1, ValidDays: 30,
	})

	if _, err := Redeem("rc-free-01", userId); err != nil {
		t.Fatalf("redeem: %v", err)
	}
	recharge, free := readWallet(t, userId)
	if recharge != 0 {
		t.Errorf("valid_days>0 must not touch recharge wallet, got %d", recharge)
	}
	if free != 3000 {
		t.Errorf("free wallet: got %d, want 3000", free)
	}
	ledgers, _ := ListFreeQuotaLedgers(userId)
	if len(ledgers) != 1 || ledgers[0].Source != FreeQuotaSourceRedemption {
		t.Fatalf("expect 1 redemption ledger, got %+v", ledgers)
	}
	if ledgers[0].ExpiredTime >= FreeQuotaNeverExpire {
		t.Errorf("valid_days>0 ledger must be expiring")
	}
}

// TC-F02：valid_days=0 => 兑换额度进充值钱包（维持现状）。
func TestRedeem_NoValidDaysToRechargeWallet(t *testing.T) {
	setupWalletTestDB(t)
	userId := createTestUser(t, "default", "default")
	createRedemptionFull(t, &Redemption{
		UserId: 1, Key: "rc-recharge-01", Name: "rc", Quota: 2000,
		Type: common.RedemptionTypeQuota, MaxUses: 1, ValidDays: 0,
	})

	if _, err := Redeem("rc-recharge-01", userId); err != nil {
		t.Fatalf("redeem: %v", err)
	}
	recharge, free := readWallet(t, userId)
	if recharge != 2000 {
		t.Errorf("valid_days=0 must go to recharge wallet, got %d", recharge)
	}
	if free != 0 {
		t.Errorf("free wallet must stay 0, got %d", free)
	}
	ledgers, _ := ListFreeQuotaLedgers(userId)
	if len(ledgers) != 0 {
		t.Errorf("valid_days=0 must not create free ledger, got %d", len(ledgers))
	}
}

// TC-F03：max_uses 多次核销 —— 计数模型，第 N 次才置为已用。
func TestRedeem_MultiUseCounting(t *testing.T) {
	setupWalletTestDB(t)
	u1 := createTestUser(t, "default", "default")
	u2 := createTestUser(t, "default", "default")
	u3 := createTestUser(t, "default", "default")
	createRedemptionFull(t, &Redemption{
		UserId: 1, Key: "rc-multi", Name: "multi", Quota: 1000,
		Type: common.RedemptionTypeQuota, MaxUses: 2, ValidDays: 0,
	})

	// 第 1 次：成功，UsedCount=1，仍 enabled
	if _, err := Redeem("rc-multi", u1); err != nil {
		t.Fatalf("redeem #1: %v", err)
	}
	var r Redemption
	DB.Where("name = ?", "multi").First(&r)
	if r.UsedCount != 1 || r.Status != common.RedemptionCodeStatusEnabled {
		t.Fatalf("after #1: used_count=%d status=%d, want 1/enabled", r.UsedCount, r.Status)
	}

	// 第 2 次（不同用户）：成功，UsedCount=2，达到上限 => used
	if _, err := Redeem("rc-multi", u2); err != nil {
		t.Fatalf("redeem #2: %v", err)
	}
	r = Redemption{}
	DB.Where("name = ?", "multi").First(&r)
	if r.UsedCount != 2 || r.Status != common.RedemptionCodeStatusUsed {
		t.Fatalf("after #2: used_count=%d status=%d, want 2/used", r.UsedCount, r.Status)
	}

	// 第 3 次：已用完 => 报错
	if _, err := Redeem("rc-multi", u3); err == nil {
		t.Errorf("redeem #3 should fail (used up)")
	}
}

// TC-F04：同码一人一次 —— 即使 max_uses>1，同一用户不能重复领。
func TestRedeem_SameKeyOnePerUser(t *testing.T) {
	setupWalletTestDB(t)
	u1 := createTestUser(t, "default", "default")
	createRedemptionFull(t, &Redemption{
		UserId: 1, Key: "rc-dup", Name: "dup", Quota: 1000,
		Type: common.RedemptionTypeQuota, MaxUses: 5, ValidDays: 0,
	})
	if _, err := Redeem("rc-dup", u1); err != nil {
		t.Fatalf("redeem #1: %v", err)
	}
	_, err := Redeem("rc-dup", u1)
	if err != ErrRedeemClaimedByKey {
		t.Errorf("second redeem by same user should be ErrRedeemClaimedByKey, got %v", err)
	}
}

// TC-F05：同批次(tag)一人一次 —— 同 tag 下不同码，同一用户只能领一个。
func TestRedeem_SameTagOnePerUser(t *testing.T) {
	setupWalletTestDB(t)
	u1 := createTestUser(t, "default", "default")
	createRedemptionFull(t, &Redemption{
		UserId: 1, Key: "rc-tag-a", Name: "taga", Quota: 1000,
		Type: common.RedemptionTypeQuota, MaxUses: 1, ValidDays: 0, Tag: "batch-x",
	})
	createRedemptionFull(t, &Redemption{
		UserId: 1, Key: "rc-tag-b", Name: "tagb", Quota: 1000,
		Type: common.RedemptionTypeQuota, MaxUses: 1, ValidDays: 0, Tag: "batch-x",
	})
	if _, err := Redeem("rc-tag-a", u1); err != nil {
		t.Fatalf("redeem tag-a: %v", err)
	}
	_, err := Redeem("rc-tag-b", u1)
	if err != ErrRedeemClaimedByTag {
		t.Errorf("redeem another code in same tag should be ErrRedeemClaimedByTag, got %v", err)
	}
}

// TC-F06：删除兑换码级联清理限领记录（同 tag 最后一个码删除时清 tag claim）。
func TestDeleteRedemption_CascadeClaims(t *testing.T) {
	setupWalletTestDB(t)
	u1 := createTestUser(t, "default", "default")
	createRedemptionFull(t, &Redemption{
		UserId: 1, Key: "rc-del", Name: "del", Quota: 1000,
		Type: common.RedemptionTypeQuota, MaxUses: 1, ValidDays: 0, Tag: "batch-del",
	})
	if _, err := Redeem("rc-del", u1); err != nil {
		t.Fatalf("redeem: %v", err)
	}
	// 读回落库后的兑换码（key 为 char(32) 定长，读回会带尾部空格填充，
	// 生产按读回值存 claim；测试须用同一读回值比对，不能用字面量 "rc-del"）。
	var r Redemption
	if err := DB.Where("name = ?", "del").First(&r).Error; err != nil {
		t.Fatalf("load redemption: %v", err)
	}
	// 兑换后有 claim（按 redemption_id 查，规避定长填充干扰）
	var cnt int64
	DB.Model(&RedemptionClaim{}).Where("redemption_id = ?", r.Id).Count(&cnt)
	if cnt != 1 {
		t.Fatalf("expect 1 claim after redeem, got %d", cnt)
	}

	// 删除该码（该 tag 唯一码）=> key claim 与 tag claim 都被清理
	if err := r.Delete(); err != nil {
		t.Fatalf("delete: %v", err)
	}
	DB.Model(&RedemptionClaim{}).Where("redemption_id = ?", r.Id).Count(&cnt)
	if cnt != 0 {
		t.Errorf("key claim should be cleared after delete, got %d", cnt)
	}
	DB.Model(&RedemptionClaim{}).Where("tag = ?", "batch-del").Count(&cnt)
	if cnt != 0 {
		t.Errorf("tag claim should be cleared (last code in tag), got %d", cnt)
	}
}

// ============ 充值赠送 (TC-E-GIFT) ============

// grantTopupGiftTx 通过启用赠送配置验证：本金命中档位 => 免费钱包增加对应赠送额。
func TestGrantTopupGift_ToFreeWallet(t *testing.T) {
	setupWalletTestDB(t)
	ps := operation_setting.GetPaymentSetting()
	old := *ps
	ps.GiftEnabled = true
	ps.GiftRules = []operation_setting.TopupGiftRule{{Threshold: 1000, Gift: 200}}
	ps.GiftValidDays = 30
	defer func() { *ps = old }()

	userId := createTestUser(t, "default", "default")

	// 直接 DB.Create 绕过 Insert() 的 ExpectedGift 自动计算，模拟订单创建时已锁定赠送。
	topUp := &TopUp{
		UserId:          userId,
		Amount:          1500,
		TradeNo:         t.Name() + "_hit",
		Status:          common.TopUpStatusSuccess,
		PaymentProvider: PaymentProviderEpay,
		ExpectedGift:    200,
	}
	if err := DB.Create(topUp).Error; err != nil {
		t.Fatalf("create topup: %v", err)
	}

	gift, err := GrantTopupGift(userId, topUp.Id)
	if err != nil {
		t.Fatalf("grant gift: %v", err)
	}
	if gift != 200 {
		t.Fatalf("gift: got %d, want 200", gift)
	}
	recharge, free := readWallet(t, userId)
	if recharge != 0 {
		t.Errorf("gift must not touch recharge wallet, got %d", recharge)
	}
	if free != 200 {
		t.Errorf("free wallet: got %d, want 200", free)
	}
	ledgers, _ := ListFreeQuotaLedgers(userId)
	if len(ledgers) != 1 || ledgers[0].Source != FreeQuotaSourceTopupGift {
		t.Fatalf("expect 1 topup_gift ledger, got %+v", ledgers)
	}
}

// 未命中档位 => 不赠送、不产生明细。
func TestGrantTopupGift_NoHit(t *testing.T) {
	setupWalletTestDB(t)
	ps := operation_setting.GetPaymentSetting()
	old := *ps
	ps.GiftEnabled = true
	ps.GiftRules = []operation_setting.TopupGiftRule{{Threshold: 1000, Gift: 200}}
	defer func() { *ps = old }()

	userId := createTestUser(t, "default", "default")

	// ExpectedGift=0 模拟未命中赠送档位
	topUp := &TopUp{
		UserId:          userId,
		Amount:          500,
		TradeNo:         t.Name() + "_nohit",
		Status:          common.TopUpStatusSuccess,
		PaymentProvider: PaymentProviderEpay,
		ExpectedGift:    0,
	}
	if err := DB.Create(topUp).Error; err != nil {
		t.Fatalf("create topup: %v", err)
	}

	gift, err := GrantTopupGift(userId, topUp.Id)
	if err != nil {
		t.Fatalf("grant gift: %v", err)
	}
	if gift != 0 {
		t.Errorf("gift should be 0, got %d", gift)
	}
	_, free := readWallet(t, userId)
	if free != 0 {
		t.Errorf("free wallet must stay 0, got %d", free)
	}
}

// ============ 管理员调额免费钱包 (TC-F07/F08) ============

// TC-F07：管理员 override 免费钱包 —— 作废旧明细，重置为指定值。
func TestOverrideFreeQuota(t *testing.T) {
	setupWalletTestDB(t)
	userId := createTestUser(t, "default", "default")
	now := common.GetTimestamp()
	// 先有两条免费明细
	if err := AddFreeQuota(nil, userId, 1000, FreeQuotaSourceCheckin, 0, now+3*86400); err != nil {
		t.Fatalf("seed free 1: %v", err)
	}
	if err := AddFreeQuota(nil, userId, 2000, FreeQuotaSourceAdmin, 0, 0); err != nil {
		t.Fatalf("seed free 2: %v", err)
	}
	_, free := readWallet(t, userId)
	if free != 3000 {
		t.Fatalf("precondition free=%d, want 3000", free)
	}

	// override 为 500
	if err := OverrideFreeQuota(userId, 500, FreeQuotaSourceAdmin, userId, now+7*86400); err != nil {
		t.Fatalf("override: %v", err)
	}
	_, free = readWallet(t, userId)
	if free != 500 {
		t.Errorf("after override free=%d, want 500", free)
	}
	// 有效明细汇总也应为 500（旧的两条被作废）
	sum, _ := SumActiveFreeQuota(DB, userId, common.GetTimestamp())
	if sum != 500 {
		t.Errorf("active sum after override=%d, want 500", sum)
	}
}

// TC-F08：管理员 subtract 免费钱包（按过期升序扣减）。
func TestConsumeFreeQuotaOnly_AdminSubtract(t *testing.T) {
	setupWalletTestDB(t)
	userId := createTestUser(t, "default", "default")
	now := common.GetTimestamp()
	if err := AddFreeQuota(nil, userId, 1000, FreeQuotaSourceCheckin, 0, now+3*86400); err != nil {
		t.Fatalf("seed: %v", err)
	}
	if err := ConsumeFreeQuotaOnly(userId, 400); err != nil {
		t.Fatalf("subtract: %v", err)
	}
	_, free := readWallet(t, userId)
	if free != 600 {
		t.Errorf("after subtract free=%d, want 600", free)
	}
	// 超额扣减应失败
	if err := ConsumeFreeQuotaOnly(userId, 10000); err == nil {
		t.Errorf("over-subtract should fail")
	}
}
