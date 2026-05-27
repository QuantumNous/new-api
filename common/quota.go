package common

func GetTrustQuota() int64 {
	return int64(10 * QuotaPerUnit)
}
