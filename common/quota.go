package common

func GetTrustQuota() int {
	// 安全加固：返回 0 以彻底关闭“信任额度旁路”。
	// 原值 10*QuotaPerUnit 使高余额/unlimited token 的请求在入口零预留、仅事后结算，
	// 叠加无下限扣减 + 并发突发可超扣/白嫖（运营方买单）。
	// shouldTrust() 在 trustQuota<=0 时直接返回 false，所有请求改走正常预扣预留。
	return 0
}
