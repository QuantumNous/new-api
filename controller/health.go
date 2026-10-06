package controller

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// readyzCheckTimeout bounds the whole readiness evaluation so a probe can never
// hang on a stalled dependency. Orchestrators time out probes anyway; failing
// fast here keeps the probe cheap and the reported status meaningful.
const readyzCheckTimeout = 2 * time.Second

// Healthz is the liveness probe: it answers 200 whenever the process is able to
// serve HTTP, without touching the database, Redis, or console settings.
//
// It is deliberately much lighter than /api/status, which reads option state and
// queries the database and therefore must not be polled at a high frequency by a
// load balancer or an orchestrator.
func Healthz(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "ok",
		"version": common.Version,
		"uptime":  time.Now().Unix() - common.StartTime,
	})
}

// Readyz is the readiness probe: it reports 200 only when the dependencies
// required to serve traffic are reachable, and 503 otherwise, so a half-started
// instance is kept out of the load-balancer rotation instead of failing requests.
//
// The main database is always required. A separately configured log database is
// required as well, because usage logging is part of the request path.
//
// Redis is treated as a soft dependency by default: when it is configured the
// probe always reports its state, but a Redis outage alone does not make the
// instance unready, since it only degrades caching and rate limiting. Set
// READYZ_REQUIRE_REDIS=true to gate readiness on Redis as well.
func Readyz(c *gin.Context) {
	ready, checks := checkReadiness(c.Request.Context())
	status := http.StatusOK
	statusText := "ok"
	if !ready {
		status = http.StatusServiceUnavailable
		statusText = "unavailable"
	}
	c.JSON(status, gin.H{
		"status": statusText,
		"checks": checks,
	})
}

// checkReadiness evaluates every readiness dependency and returns whether the
// instance may receive traffic, together with a per-dependency detail map that
// is safe to expose (it contains no credentials).
func checkReadiness(ctx context.Context) (bool, map[string]string) {
	ctx, cancel := context.WithTimeout(ctx, readyzCheckTimeout)
	defer cancel()

	checks := make(map[string]string, 3)
	ready := true

	if err := pingDatabase(ctx, model.DB); err != nil {
		checks["database"] = "down: " + err.Error()
		ready = false
	} else {
		checks["database"] = "up"
	}

	// The log database may be the same connection as the main database, in which
	// case it has just been pinged and re-checking it would only double the cost.
	if model.LOG_DB != nil && model.LOG_DB != model.DB {
		if err := pingDatabase(ctx, model.LOG_DB); err != nil {
			checks["log_database"] = "down: " + err.Error()
			ready = false
		} else {
			checks["log_database"] = "up"
		}
	}

	if !common.RedisEnabled {
		checks["redis"] = "disabled"
	} else if err := pingRedis(ctx); err != nil {
		checks["redis"] = "down: " + err.Error()
		if common.GetEnvOrDefaultBool("READYZ_REQUIRE_REDIS", false) {
			ready = false
		}
	} else {
		checks["redis"] = "up"
	}

	return ready, checks
}

// pingDatabase reports whether db accepts a connection. A nil handle means the
// database was never initialized, which must count as unavailable rather than
// crashing the probe.
func pingDatabase(ctx context.Context, db *gorm.DB) error {
	if db == nil {
		return errors.New("not initialized")
	}
	sqlDB, err := db.DB()
	if err != nil {
		return err
	}
	return sqlDB.PingContext(ctx)
}

// pingRedis reports whether the configured Redis instance answers. A nil client
// means REDIS_CONN_STRING is set but initialization never completed, which is a
// misconfiguration rather than "Redis not in use".
func pingRedis(ctx context.Context) error {
	if common.RDB == nil {
		return errors.New("client not initialized")
	}
	return common.RDB.Ping(ctx).Err()
}
