package common

// TrustQuota controls wallet-trust pre-consume bypass threshold (quota units).
//   - -1: legacy upstream default (10 * QuotaPerUnit)
//   -  0: disable trust bypass (always pre-consume when estimate > 0)
//   - >0: custom threshold
var TrustQuota = -1

func GetTrustQuota() int {
	if TrustQuota >= 0 {
		return TrustQuota
	}
	return int(10 * QuotaPerUnit)
}
