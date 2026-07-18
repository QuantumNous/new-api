package common

import "os"

// GetTrustQuota returns the balance threshold above which pre-consume may be
// skipped. Disabled by default — concurrent settle can overdraft without a
// floor on the trust path. Opt in with TRUST_PRECONSUME_ENABLED=true|1.
func GetTrustQuota() int {
	switch os.Getenv("TRUST_PRECONSUME_ENABLED") {
	case "1", "true", "TRUE", "yes", "on":
		return int(10 * QuotaPerUnit)
	default:
		return 0
	}
}
