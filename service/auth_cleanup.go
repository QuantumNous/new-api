package service

import (
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

const authArtifactCleanupInterval = time.Hour

// StartAuthArtifactCleanup removes expired dashboard Sessions and old
// one-time authentication flows. Only the master instance performs cleanup.
func StartAuthArtifactCleanup() {
	if !common.IsMasterNode {
		return
	}
	go func() {
		cleanupAuthArtifacts()
		ticker := time.NewTicker(authArtifactCleanupInterval)
		defer ticker.Stop()
		for range ticker.C {
			cleanupAuthArtifacts()
		}
	}()
}

func cleanupAuthArtifacts() {
	now := time.Now()
	if err := model.DeleteExpiredUserSessions(now.Unix()); err != nil {
		common.SysError("failed to delete expired user sessions: " + err.Error())
	}
	if err := model.DeleteExpiredAuthFlows(now); err != nil {
		common.SysError("failed to delete expired authentication flows: " + err.Error())
	}
}
