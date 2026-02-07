package common

import (
	"os"
	"time"

	"github.com/getsentry/sentry-go"
)

var SentryEnabled bool

func InitSentry() bool {
	dsn := os.Getenv("SENTRY_DSN")
	if dsn == "" {
		return false
	}

	environment := GetEnvOrDefaultString("SENTRY_ENVIRONMENT", "")
	if environment == "" {
		environment = GetEnvOrDefaultString("ENVIRONMENT", "")
	}
	if environment == "" {
		environment = GetEnvOrDefaultString("GIN_MODE", "production")
	}

	release := GetEnvOrDefaultString("SENTRY_RELEASE", "")
	if release == "" {
		release = Version
	}

	tracesSampleRate := GetEnvOrDefaultFloat64("SENTRY_TRACES_SAMPLE_RATE", 0)
	sampleRate := GetEnvOrDefaultFloat64("SENTRY_SAMPLE_RATE", 1)
	debug := GetEnvOrDefaultBool("SENTRY_DEBUG", DebugEnabled)

	opts := sentry.ClientOptions{
		Dsn:              dsn,
		Environment:      environment,
		Release:          release,
		SampleRate:       sampleRate,
		EnableTracing:    tracesSampleRate > 0,
		TracesSampleRate: tracesSampleRate,
		AttachStacktrace: true,
		Debug:            debug,
	}

	if err := sentry.Init(opts); err != nil {
		SysError("failed to initialize sentry: " + err.Error())
		return false
	}

	SentryEnabled = true
	SysLog("sentry enabled")
	return true
}

func FlushSentry(timeout time.Duration) {
	if !SentryEnabled {
		return
	}
	sentry.Flush(timeout)
}
