package controller

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

type readinessProbe func(context.Context) error

func checkReadiness(ctx context.Context, databasePing readinessProbe, redisPing readinessProbe) (string, error) {
	if err := databasePing(ctx); err != nil {
		return "database", err
	}
	if redisPing != nil {
		if err := redisPing(ctx); err != nil {
			return "redis", err
		}
	}
	return "", nil
}

func GetReadiness(c *gin.Context) {
	timeoutSeconds := common.GetEnvOrDefault("READINESS_TIMEOUT_SECONDS", 3)
	if timeoutSeconds <= 0 {
		timeoutSeconds = 3
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), time.Duration(timeoutSeconds)*time.Second)
	defer cancel()

	var redisPing readinessProbe
	if common.RedisEnabled {
		redisPing = func(ctx context.Context) error {
			if common.RDB == nil {
				return errors.New("redis client is not initialized")
			}
			return common.RDB.Ping(ctx).Err()
		}
	}

	component, err := checkReadiness(ctx, model.PingDBContext, redisPing)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"status": "unavailable", "component": component})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}
