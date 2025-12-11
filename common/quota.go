package common

func GetTrustQuota() int {
	return int(10 * QuotaPerUnit)
}
