package service

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/bytedance/gopkg/util/gopool"
)

const (
	codexVersionSyncInterval = 6 * time.Hour
	codexVersionSyncTimeout  = 20 * time.Second
)

var (
	codexVersionSyncHTTPClient = http.DefaultClient
	codexVersionSyncReleaseURL = codexLatestReleaseURL
	codexVersionSyncOnce       sync.Once
	codexVersionSyncRunning    atomic.Bool
)

func SyncLatestStableCodexVersion(ctx context.Context) error {
	if !IsCodexClientVersionAutoSyncEnabled() {
		return nil
	}

	version, err := fetchLatestCodexClientVersion(ctx, codexVersionSyncHTTPClient, codexVersionSyncReleaseURL)
	if err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("codex client version sync: release lookup skipped: %v", err))
		return nil
	}

	stored := resolveSyncedCodexClientVersion()
	if compareNormalizedCodexClientVersions(version, stored) <= 0 {
		return nil
	}

	now := time.Now().UTC().Format(time.RFC3339)
	return model.UpdateOptionsBulk(map[string]string{
		OptionKeyCodexSyncedClientVersion:   version,
		OptionKeyCodexSyncedClientVersionAt: now,
	})
}

func StartCodexVersionSyncTask() {
	codexVersionSyncOnce.Do(func() {
		if !isMasterOrConsoleTaskLane() {
			return
		}

		gopool.Go(func() {
			logger.LogInfo(context.Background(), fmt.Sprintf("codex client version sync task started: tick=%s", codexVersionSyncInterval))

			ticker := time.NewTicker(codexVersionSyncInterval)
			defer ticker.Stop()

			runCodexVersionSyncOnce()
			for range ticker.C {
				runCodexVersionSyncOnce()
			}
		})
	})
}

func runCodexVersionSyncOnce() {
	if !codexVersionSyncRunning.CompareAndSwap(false, true) {
		return
	}
	defer codexVersionSyncRunning.Store(false)

	ctx, cancel := context.WithTimeout(context.Background(), codexVersionSyncTimeout)
	defer cancel()
	if err := SyncLatestStableCodexVersion(ctx); err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("codex client version sync: persist failed: %v", err))
	}
}

func isMasterOrConsoleTaskLane() bool {
	return common.IsMasterNode
}

func resolveSyncedCodexClientVersion() string {
	if version, ok := NormalizeCodexClientVersion(readCodexIdentityOption(OptionKeyCodexSyncedClientVersion)); ok {
		return version
	}
	return builtInCodexClientVersion
}

func parseStableOfficialCodexReleaseVersion(tagName, name string, draft, prerelease bool) (string, error) {
	if draft || prerelease {
		return "", fmt.Errorf("latest codex release is not stable")
	}
	for _, candidate := range []string{tagName, name} {
		version, ok := normalizeOfficialCodexReleaseVersion(candidate)
		if ok {
			return version, nil
		}
	}
	return "", fmt.Errorf("latest codex release has no stable official version")
}

func normalizeOfficialCodexReleaseVersion(raw string) (string, bool) {
	value := strings.TrimSpace(raw)
	value = strings.TrimPrefix(value, "rust-")
	version, ok := NormalizeCodexClientVersion(value)
	if !ok {
		return "", false
	}
	return version, true
}

func compareNormalizedCodexClientVersions(a, b string) int {
	aParts, aOK := codexClientVersionParts(a)
	bParts, bOK := codexClientVersionParts(b)
	if !aOK && !bOK {
		return 0
	}
	if !aOK {
		return -1
	}
	if !bOK {
		return 1
	}
	return compareCodexVersion(aParts, bParts)
}

func codexClientVersionParts(raw string) ([3]int, bool) {
	version, ok := NormalizeCodexClientVersion(raw)
	if !ok {
		return [3]int{}, false
	}
	parts := strings.Split(version, ".")
	nums := [3]int{}
	for i, part := range parts {
		n := 0
		for _, r := range part {
			n = n*10 + int(r-'0')
		}
		nums[i] = n
	}
	return nums, true
}
