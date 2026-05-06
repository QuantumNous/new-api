package service

import (
	"time"

	"github.com/bytedance/gopkg/util/gopool"
)

// DirectPaymentExpiryScanHook is set by controller in init() to break the
// service→controller import cycle. It must close expired pending orders for all
// direct payment channels (TopUp + Subscription × Alipay + WeChat Pay).
var DirectPaymentExpiryScanHook func()

const directPaymentExpiryScanInterval = 5 * time.Minute

// StartDirectPaymentExpiryScan kicks off a goroutine that periodically expires
// stale pending direct-payment orders. Safe to call when the hook is unset
// (e.g. running tests or builds without the controller wired in) — it becomes
// a no-op.
func StartDirectPaymentExpiryScan() {
	if DirectPaymentExpiryScanHook == nil {
		return
	}
	gopool.Go(func() {
		ticker := time.NewTicker(directPaymentExpiryScanInterval)
		defer ticker.Stop()
		for range ticker.C {
			DirectPaymentExpiryScanHook()
		}
	})
}
