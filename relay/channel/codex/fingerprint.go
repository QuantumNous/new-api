package codex

import (
	"bytes"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/tidwall/gjson"
	"github.com/tidwall/sjson"
)

const fingerprintContextKey = "codex_fingerprint_ids"
const maxCodexMetadataBytes = 64 * 1024
const maxCodexMetadataDepth = 10

// Keep the whole-request guard above normal tool-schema nesting while bounding
// recursive duplicate-key scanning for attacker-controlled JSON.
const maxCodexRequestJSONDepth = 100

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
	if c != nil {
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

func resolveFingerprintIDsForRequest(info *relaycommon.RelayInfo, clientSession string, now time.Time) (*codexFingerprintIDs, error) {
	mode := fingerprintMode(info)
	if mode == fingerprintOff {
		return nil, nil
	}
	fingerprint, err := ResolveCodexFingerprint(info, clientSession, now)
	if err != nil {
		return nil, err
	}
	return codexFingerprintFromPublic(mode, fingerprint), nil
}

func fingerprintIDsForRequest(c *gin.Context, info *relaycommon.RelayInfo) (*codexFingerprintIDs, error) {
	if c != nil {
		if value, ok := c.Get(fingerprintContextKey); ok {
			if ids, ok := value.(*codexFingerprintIDs); ok {
				return ids, nil
			}
		}
	}
	return resolveFingerprintIDsForRequest(info, clientSessionID(c), time.Now())
}

const (
	fingerprintOff     = "off"
	fingerprintDevice  = "device"
	fingerprintSession = "session"
	fingerprintFull    = "full"
)

type CodexFingerprint struct {
	InstallationID string
	SessionID      string
	ThreadID       string
	TurnID         string
	WindowID       string
	StartedAtMS    int64
}

type codexFingerprintIDs struct {
	mode, installationID, sessionID, threadID, turnID, windowID string
	startedAtMS                                                 int64
}

func fingerprintMode(info *relaycommon.RelayInfo) string {
	if info == nil || info.ChannelMeta == nil {
		return fingerprintOff
	}
	mode := strings.ToLower(strings.TrimSpace(info.ChannelSetting.CodexFingerprintMode))
	switch mode {
	case fingerprintOff, fingerprintDevice, fingerprintSession, fingerprintFull:
		return mode
	default:
		return fingerprintOff
	}
}

func stableCodexID(seed, deploymentNamespace, label string) string {
	material := fmt.Sprintf("new-api:codex-fingerprint:v3:%s:%s:%s", deploymentNamespace, seed, label)
	h := sha256.Sum256([]byte(material))
	b := h[:16]
	b[6] = b[6]&0x0f | 0x40
	b[8] = b[8]&0x3f | 0x80
	return uuid.UUID(b).String()
}

func ResolveCodexFingerprint(info *relaycommon.RelayInfo, originalSession string, now time.Time) (*CodexFingerprint, error) {
	if info == nil || fingerprintMode(info) == fingerprintOff {
		return nil, nil
	}
	if info.ChannelMeta == nil {
		return nil, errors.New("codex channel: fingerprint seed metadata is missing")
	}
	seed := strings.TrimSpace(info.ChannelMeta.CodexFingerprintSeed)
	if seed == "" {
		return nil, errors.New("codex channel: fingerprint seed is required")
	}
	parsedSeed, err := uuid.Parse(seed)
	if err != nil || parsedSeed == uuid.Nil || seed != parsedSeed.String() {
		return nil, errors.New("codex channel: fingerprint seed must be a canonical uuid")
	}
	deploymentNamespace := strings.TrimSpace(os.Getenv("CODEX_FINGERPRINT_DEPLOYMENT_NAMESPACE"))
	if deploymentNamespace == "" {
		return nil, errors.New("codex channel: CODEX_FINGERPRINT_DEPLOYMENT_NAMESPACE is required")
	}

	mode := fingerprintMode(info)
	sessionID := stableCodexID(seed, deploymentNamespace, "session")
	threadID := sessionID
	if mode == fingerprintSession {
		threadSession := strings.TrimSpace(originalSession)
		if threadSession == "" {
			threadSession = "default"
		}
		threadID = stableCodexID(seed, deploymentNamespace, "thread:"+threadSession)
	}
	turnID, err := uuid.NewV7()
	if err != nil {
		return nil, fmt.Errorf("codex channel: create turn id: %w", err)
	}
	return &CodexFingerprint{
		InstallationID: stableCodexID(seed, deploymentNamespace, "installation"),
		SessionID:      sessionID,
		ThreadID:       threadID,
		TurnID:         turnID.String(),
		WindowID:       stableCodexID(seed, deploymentNamespace, "window:"+threadID),
		StartedAtMS:    now.UnixMilli(),
	}, nil
}

func codexFingerprintFromPublic(mode string, fingerprint *CodexFingerprint) *codexFingerprintIDs {
	if fingerprint == nil {
		return nil
	}
	return &codexFingerprintIDs{
		mode:           mode,
		installationID: fingerprint.InstallationID,
		sessionID:      fingerprint.SessionID,
		threadID:       fingerprint.ThreadID,
		turnID:         fingerprint.TurnID,
		windowID:       fingerprint.WindowID,
		startedAtMS:    fingerprint.StartedAtMS,
	}
}

func resolveFingerprintIDs(info *relaycommon.RelayInfo, clientSession string) *codexFingerprintIDs {
	if info == nil {
		return nil
	}
	mode := fingerprintMode(info)
	if mode == fingerprintOff {
		return nil
	}
	fingerprint, err := ResolveCodexFingerprint(info, clientSession, time.Now())
	if err != nil {
		return nil
	}
	return codexFingerprintFromPublic(mode, fingerprint)
}

func rewriteTurnMetadata(raw string, ids *codexFingerprintIDs) string {
	if ids == nil || strings.TrimSpace(raw) == "" {
		return raw
	}
	var metadata map[string]any
	if err := common.Unmarshal([]byte(raw), &metadata); err != nil || metadata == nil {
		metadata = make(map[string]any)
	}
	metadata["installation_id"] = ids.installationID
	if ids.mode != fingerprintDevice {
		metadata["session_id"] = ids.sessionID
		metadata["thread_id"] = ids.threadID
		metadata["turn_id"] = ids.turnID
		metadata["window_id"] = ids.windowID
		metadata["turn_started_at_unix_ms"] = ids.startedAtMS
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
	if ids.mode == fingerprintFull {
		raw, err := common.Marshal(body)
		if err != nil {
			return false
		}
		fingerprint := &CodexFingerprint{
			InstallationID: ids.installationID,
			SessionID:      ids.sessionID,
			ThreadID:       ids.threadID,
			TurnID:         ids.turnID,
			WindowID:       ids.windowID,
			StartedAtMS:    ids.startedAtMS,
		}
		rewritten, err := SanitizeCodexRequestBody(raw, fingerprint, ids.mode)
		if err != nil {
			return false
		}
		var sanitized map[string]any
		if err := common.Unmarshal(rewritten, &sanitized); err != nil {
			return false
		}
		for key := range body {
			delete(body, key)
		}
		for key, value := range sanitized {
			body[key] = value
		}
		return true
	}
	metadata, _ := body["client_metadata"].(map[string]any)
	if metadata == nil {
		metadata = map[string]any{}
	}
	if !applyFingerprintMetadata(metadata, ids) {
		return false
	}
	body["client_metadata"] = metadata
	return true
}

func applyFingerprintMetadata(metadata map[string]any, ids *codexFingerprintIDs) bool {
	if metadata == nil || ids == nil {
		return false
	}
	for _, field := range fingerprintMetadataFields(ids) {
		metadata[field.name] = field.value
	}
	if raw, ok := metadata["x-codex-turn-metadata"].(string); ok {
		metadata["x-codex-turn-metadata"] = rewriteTurnMetadata(raw, ids)
	}
	return true
}

type fingerprintMetadataField struct {
	name  string
	value any
}

func fingerprintMetadataFields(ids *codexFingerprintIDs) []fingerprintMetadataField {
	if ids == nil {
		return nil
	}
	fields := []fingerprintMetadataField{{name: "x-codex-installation-id", value: ids.installationID}}
	if ids.mode != fingerprintDevice {
		fields = append(fields,
			fingerprintMetadataField{name: "session_id", value: ids.sessionID},
			fingerprintMetadataField{name: "thread_id", value: ids.threadID},
			fingerprintMetadataField{name: "turn_id", value: ids.turnID},
			fingerprintMetadataField{name: "x-codex-window-id", value: ids.windowID},
			fingerprintMetadataField{name: "turn_started_at_unix_ms", value: ids.startedAtMS},
		)
	}
	return fields
}

func fullFingerprintMetadata(ids *codexFingerprintIDs) map[string]any {
	metadata := map[string]any{}
	for _, field := range fingerprintMetadataFields(ids) {
		metadata[field.name] = field.value
	}
	return metadata
}

func SanitizeCodexRequestBody(raw []byte, fingerprint *CodexFingerprint, mode string) ([]byte, error) {
	if fingerprint == nil {
		return raw, nil
	}
	ids := codexFingerprintFromPublic(mode, fingerprint)
	if ids == nil {
		return raw, nil
	}
	if mode != fingerprintFull {
		rewritten, _, err := applyFingerprintBodyRaw(raw, ids)
		return rewritten, err
	}
	if len(raw) == 0 {
		return nil, errors.New("codex channel: full fingerprint request body is empty")
	}
	if err := validateFullFingerprintMetadataRaw(raw, false); err != nil {
		return nil, err
	}
	var body map[string]any
	if err := common.Unmarshal(raw, &body); err != nil {
		return nil, errors.New("codex channel: invalid full fingerprint request json")
	}
	if body == nil {
		return nil, errors.New("codex channel: full fingerprint request body must be an object")
	}

	originalSession := ""
	if rawMetadata, ok := body["client_metadata"]; ok {
		metadata, ok := rawMetadata.(map[string]any)
		if !ok {
			return nil, errors.New("codex channel: full fingerprint client_metadata must be an object")
		}
		if session, ok := metadata["session_id"].(string); ok {
			originalSession = strings.TrimSpace(session)
		}
	}
	if promptCacheKey, ok := body["prompt_cache_key"].(string); ok && originalSession != "" && promptCacheKey == originalSession {
		body["prompt_cache_key"] = ids.sessionID
	}
	body["client_metadata"] = fullFingerprintMetadata(ids)
	out, err := common.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("codex channel: marshal sanitized full fingerprint body: %w", err)
	}
	return out, nil
}

func validateFullFingerprintMetadataRaw(raw []byte, compact bool) error {
	metadata := gjson.GetBytes(raw, "client_metadata")
	if !metadata.Exists() {
		return nil
	}
	prefix := "codex channel: full fingerprint"
	if compact {
		prefix += " compact"
	}
	if !metadata.IsObject() {
		return errors.New(prefix + " client_metadata must be an object")
	}
	if len(metadata.Raw) > maxCodexMetadataBytes {
		return errors.New(prefix + " client_metadata is too large")
	}
	if exceedsJSONRawDepth([]byte(metadata.Raw), maxCodexMetadataDepth) {
		return errors.New(prefix + " client_metadata is too deeply nested")
	}
	if err := rejectDuplicateJSONKeys(raw, maxCodexRequestJSONDepth); err != nil {
		return errors.New(prefix + " request contains duplicate or invalid json keys")
	}
	return nil
}

func rejectDuplicateJSONKeys(raw []byte, maxDepth int) error {
	decoder := json.NewDecoder(bytes.NewReader(raw))
	if err := consumeJSONValue(decoder, 0, maxDepth); err != nil {
		return err
	}
	if _, err := decoder.Token(); err != io.EOF {
		if err == nil {
			return errors.New("multiple json values")
		}
		return err
	}
	return nil
}

func consumeJSONValue(decoder *json.Decoder, depth, maxDepth int) error {
	token, err := decoder.Token()
	if err != nil {
		return err
	}
	delim, ok := token.(json.Delim)
	if !ok {
		return nil
	}
	if depth >= maxDepth {
		return errors.New("json nesting exceeds maximum depth")
	}
	nestedDepth := depth + 1
	switch delim {
	case '{':
		seen := make(map[string]struct{})
		for decoder.More() {
			keyToken, err := decoder.Token()
			if err != nil {
				return err
			}
			key, ok := keyToken.(string)
			if !ok {
				return errors.New("json object key is not a string")
			}
			if _, exists := seen[key]; exists {
				return fmt.Errorf("duplicate json key %q", key)
			}
			seen[key] = struct{}{}
			if err := consumeJSONValue(decoder, nestedDepth, maxDepth); err != nil {
				return err
			}
		}
		closing, err := decoder.Token()
		if err != nil {
			return err
		}
		if closing != json.Delim('}') {
			return errors.New("json object is not closed")
		}
	case '[':
		for decoder.More() {
			if err := consumeJSONValue(decoder, nestedDepth, maxDepth); err != nil {
				return err
			}
		}
		closing, err := decoder.Token()
		if err != nil {
			return err
		}
		if closing != json.Delim(']') {
			return errors.New("json array is not closed")
		}
	case '}', ']':
		return errors.New("unexpected json closing delimiter")
	}
	return nil
}

func exceedsJSONRawDepth(raw []byte, maxDepth int) bool {
	depth := 0
	inString := false
	escaped := false
	for _, b := range raw {
		if inString {
			if escaped {
				escaped = false
				continue
			}
			if b == '\\' {
				escaped = true
				continue
			}
			if b == '"' {
				inString = false
			}
			continue
		}
		switch b {
		case '"':
			inString = true
		case '{', '[':
			depth++
			if depth > maxDepth {
				return true
			}
		case '}', ']':
			depth--
		}
	}
	return false
}

func applyFingerprintBodyRaw(body []byte, ids *codexFingerprintIDs) ([]byte, bool, error) {
	if len(body) == 0 || ids == nil {
		return body, false, nil
	}
	root := gjson.ParseBytes(body)
	if !gjson.ValidBytes(body) || !root.IsObject() {
		return body, false, nil
	}

	rewritten := body
	if existing := gjson.GetBytes(body, "client_metadata"); !existing.IsObject() {
		var err error
		rewritten, err = sjson.SetRawBytes(rewritten, "client_metadata", []byte(`{}`))
		if err != nil {
			return body, false, fmt.Errorf("initialize converged client_metadata: %w", err)
		}
	}
	for _, field := range fingerprintMetadataFields(ids) {
		var err error
		rewritten, err = sjson.SetBytes(rewritten, "client_metadata."+field.name, field.value)
		if err != nil {
			return body, false, fmt.Errorf("splice converged client_metadata: %w", err)
		}
	}
	if raw := gjson.GetBytes(rewritten, "client_metadata.x-codex-turn-metadata"); raw.Type == gjson.String {
		var err error
		rewritten, err = sjson.SetBytes(rewritten, "client_metadata.x-codex-turn-metadata", rewriteTurnMetadata(raw.String(), ids))
		if err != nil {
			return body, false, fmt.Errorf("splice converged turn metadata: %w", err)
		}
	}
	return rewritten, true, nil
}

func stripCompactOriginalMetadataRaw(body []byte) ([]byte, bool, error) {
	if len(body) == 0 {
		return body, false, nil
	}
	root := gjson.ParseBytes(body)
	if !gjson.ValidBytes(body) || !root.IsObject() {
		return body, false, nil
	}
	rewritten := body
	changed := false
	for _, key := range []string{"client_metadata", "metadata"} {
		if !gjson.GetBytes(rewritten, key).Exists() {
			continue
		}
		var err error
		rewritten, err = sjson.DeleteBytes(rewritten, key)
		if err != nil {
			return body, false, fmt.Errorf("strip compact original metadata: %w", err)
		}
		changed = true
	}
	return rewritten, changed, nil
}

func validateCompactPassThroughFullBody(raw []byte) error {
	if len(raw) == 0 {
		return errors.New("codex channel: full fingerprint compact request body is empty")
	}
	if err := validateFullFingerprintMetadataRaw(raw, true); err != nil {
		return err
	}
	var body map[string]any
	if err := common.Unmarshal(raw, &body); err != nil {
		return errors.New("codex channel: invalid full fingerprint compact request json")
	}
	if body == nil {
		return errors.New("codex channel: full fingerprint compact request body must be an object")
	}
	rawMetadata, ok := body["client_metadata"]
	if !ok {
		return nil
	}
	if _, ok := rawMetadata.(map[string]any); !ok {
		return errors.New("codex channel: full fingerprint compact client_metadata must be an object")
	}
	return nil
}
