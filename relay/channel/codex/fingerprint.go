package codex

import (
	"crypto/sha256"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const fingerprintContextKey = "codex_fingerprint_ids"

func clientSessionID(c *gin.Context) string {
	if c == nil || c.Request == nil {
		return ""
	}
	if value := strings.TrimSpace(c.Request.Header.Get("session-id")); value != "" {
		return value
	}
	return strings.TrimSpace(c.Request.Header.Get("session_id"))
}

func setFingerprintIDs(c *gin.Context, ids *codexFingerprintIDs) {
	if c != nil && ids != nil {
		c.Set(fingerprintContextKey, ids)
	}
}

func fingerprintIDs(c *gin.Context, info *relaycommon.RelayInfo) *codexFingerprintIDs {
	if c != nil {
		if value, ok := c.Get(fingerprintContextKey); ok {
			if ids, ok := value.(*codexFingerprintIDs); ok {
				return ids
			}
		}
	}
	return resolveFingerprintIDs(info, clientSessionID(c))
}

const (
	fingerprintOff     = "off"
	fingerprintDevice  = "device"
	fingerprintSession = "session"
	fingerprintFull    = "full"
)

type codexFingerprintIDs struct {
	mode, installationID, sessionID, threadID, turnID, windowID string
}

func fingerprintMode(info *relaycommon.RelayInfo) string {
	if info.ChannelMeta == nil {
		return fingerprintSession
	}
	mode := strings.ToLower(strings.TrimSpace(info.ChannelSetting.CodexFingerprintMode))
	switch mode {
	case fingerprintOff, fingerprintDevice, fingerprintSession, fingerprintFull:
		return mode
	default:
		return fingerprintSession
	}
}

func stableFingerprintID(seed string) string {
	h := sha256.Sum256([]byte(seed))
	b := h[:16]
	b[6] = b[6]&0x0f | 0x40
	b[8] = b[8]&0x3f | 0x80
	return uuid.UUID(b).String()
}

func resolveFingerprintIDs(info *relaycommon.RelayInfo, clientSession string) *codexFingerprintIDs {
	if info == nil {
		return nil
	}
	mode := fingerprintMode(info)
	if mode == fingerprintOff {
		return nil
	}
	accountSeed := fmt.Sprintf("new-api:codex-fingerprint:v2:%d:user:%d:token:%d", info.ChannelId, info.UserId, info.TokenId)
	ids := &codexFingerprintIDs{mode: mode, installationID: stableFingerprintID(accountSeed + ":device")}
	if mode == fingerprintDevice {
		return ids
	}
	ids.sessionID = stableFingerprintID(accountSeed + ":session")
	if mode == fingerprintFull {
		ids.threadID = ids.sessionID
	} else {
		if strings.TrimSpace(clientSession) == "" {
			clientSession = "default"
		}
		ids.threadID = stableFingerprintID(accountSeed + ":thread:" + clientSession)
	}
	ids.turnID = uuid.New().String()
	ids.windowID = ids.threadID + ":0"
	return ids
}

func rewriteTurnMetadata(raw string, ids *codexFingerprintIDs) string {
	if ids == nil || strings.TrimSpace(raw) == "" {
		return raw
	}
	var metadata map[string]any
	if common.Unmarshal([]byte(raw), &metadata) != nil {
		return raw
	}
	metadata["installation_id"] = ids.installationID
	if ids.mode != fingerprintDevice {
		metadata["session_id"] = ids.sessionID
		metadata["thread_id"] = ids.threadID
		metadata["turn_id"] = ids.turnID
		metadata["window_id"] = ids.windowID
		metadata["turn_started_at_unix_ms"] = time.Now().UnixMilli()
	}
	out, err := common.Marshal(metadata)
	if err != nil {
		return raw
	}
	return string(out)
}

func applyFingerprintHeaders(h http.Header, ids *codexFingerprintIDs) {
	if h == nil || ids == nil {
		return
	}
	h.Set("x-codex-installation-id", ids.installationID)
	if ids.mode == fingerprintDevice {
		if raw := h.Get("x-codex-turn-metadata"); raw != "" {
			h.Set("x-codex-turn-metadata", rewriteTurnMetadata(raw, ids))
		}
		return
	}
	h.Set("x-codex-window-id", ids.windowID)
	h.Set("x-client-request-id", ids.threadID)
	h.Set("session-id", ids.sessionID)
	h.Set("session_id", ids.sessionID)
	h.Set("thread-id", ids.threadID)
	if raw := h.Get("x-codex-turn-metadata"); raw != "" {
		h.Set("x-codex-turn-metadata", rewriteTurnMetadata(raw, ids))
	}
}

func applyFingerprintBody(body map[string]any, ids *codexFingerprintIDs) bool {
	if body == nil || ids == nil {
		return false
	}
	metadata, ok := body["client_metadata"].(map[string]any)
	if body["client_metadata"] != nil && !ok {
		return false
	}
	if metadata == nil {
		metadata = map[string]any{}
	}
	metadata["x-codex-installation-id"] = ids.installationID
	if ids.mode != fingerprintDevice {
		metadata["session_id"] = ids.sessionID
		metadata["thread_id"] = ids.threadID
		metadata["turn_id"] = ids.turnID
		metadata["x-codex-window-id"] = ids.windowID
	}
	if raw, ok := metadata["x-codex-turn-metadata"].(string); ok {
		metadata["x-codex-turn-metadata"] = rewriteTurnMetadata(raw, ids)
	}
	body["client_metadata"] = metadata
	return true
}
