package service

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
)

const logExportLockTTL = time.Minute

const logExportLockRenewScript = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('PEXPIRE', KEYS[1], ARGV[2])
end
return 0`

const logExportLockReleaseScript = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0`

// logExportLocks holds the running exports when Redis is disabled.
var logExportLocks sync.Map

// AcquireLogExportLock reserves the one log export a user may run at a time.
// With Redis the reservation spans all nodes and lapses within a minute if
// this node dies. ok is false while another export of the user is running;
// otherwise release must be called when the export ends.
func AcquireLogExportLock(userId int) (release func(), ok bool, err error) {
	if !common.RedisEnabled {
		if _, running := logExportLocks.LoadOrStore(userId, struct{}{}); running {
			return nil, false, nil
		}
		return func() { logExportLocks.Delete(userId) }, true, nil
	}

	ctx := context.Background()
	key := fmt.Sprintf("log_export:%d", userId)
	owner := common.GetRandomString(16)
	acquired, err := common.RDB.SetNX(ctx, key, owner, logExportLockTTL).Result()
	if err != nil || !acquired {
		return nil, false, err
	}

	stop := make(chan struct{})
	go func() {
		ticker := time.NewTicker(logExportLockTTL / 3)
		defer ticker.Stop()
		for {
			select {
			case <-stop:
				return
			case <-ticker.C:
				common.RDB.Eval(ctx, logExportLockRenewScript, []string{key}, owner, logExportLockTTL.Milliseconds())
			}
		}
	}()
	return func() {
		close(stop)
		common.RDB.Eval(ctx, logExportLockReleaseScript, []string{key}, owner)
	}, true, nil
}
