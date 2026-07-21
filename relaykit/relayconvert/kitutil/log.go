package kitutil

import (
	"fmt"
	"os"
	"sync/atomic"
)

// Kit packages log rare data-shape anomalies through these hooks. The host
// redirects them into its logging system at startup (new-api points them at
// common.SysLog/SysError); standalone relaykit users get stderr defaults.

type LogFunc func(message string)

var (
	logInfo  atomic.Pointer[LogFunc]
	logError atomic.Pointer[LogFunc]
)

func SetLogging(info LogFunc, errorFn LogFunc) {
	if info != nil {
		logInfo.Store(&info)
	}
	if errorFn != nil {
		logError.Store(&errorFn)
	}
}

func LogInfo(message string) {
	if fn := logInfo.Load(); fn != nil {
		(*fn)(message)
		return
	}
	fmt.Fprintf(os.Stderr, "[relaykit] %s\n", message)
}

func LogError(message string) {
	if fn := logError.Load(); fn != nil {
		(*fn)(message)
		return
	}
	fmt.Fprintf(os.Stderr, "[relaykit] ERROR %s\n", message)
}

// Debug reports whether verbose kit diagnostics are enabled. The host sets
// this once at startup (new-api mirrors common.DebugEnabled into it).
var Debug atomic.Bool
