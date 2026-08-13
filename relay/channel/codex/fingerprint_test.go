package codex

import (
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/require"
)

func TestFingerprintModes(t *testing.T) {
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ChannelId: 42, ChannelSetting: dto.ChannelSettings{CodexFingerprintMode: "session"}}}
	a := resolveFingerprintIDs(info, "client-a")
	b := resolveFingerprintIDs(info, "client-b")
	require.NotNil(t, a)
	require.Equal(t, a.installationID, b.installationID)
	require.Equal(t, a.sessionID, b.sessionID)
	require.NotEqual(t, a.threadID, b.threadID)

	info.ChannelMeta.ChannelSetting.CodexFingerprintMode = "full"
	c := resolveFingerprintIDs(info, "client-a")
	require.Equal(t, c.sessionID, c.threadID)

	info.ChannelMeta.ChannelSetting.CodexFingerprintMode = "off"
	require.Nil(t, resolveFingerprintIDs(info, "client-a"))
}

func TestFingerprintHeadersAndBodyShareIDs(t *testing.T) {
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ChannelId: 7, ChannelSetting: dto.ChannelSettings{CodexFingerprintMode: "session"}}}
	ids := resolveFingerprintIDs(info, "client")
	h := http.Header{}
	h.Set("x-codex-turn-metadata", `{"installation_id":"old","session_id":"old","thread_id":"old","turn_id":"old"}`)
	applyFingerprintHeaders(h, ids)
	body := map[string]any{"client_metadata": map[string]any{"x-codex-turn-metadata": `{"turn_id":"old"}`}}
	require.True(t, applyFingerprintBody(body, ids))
	require.Contains(t, h.Get("x-codex-turn-metadata"), ids.turnID)
	metadata := body["client_metadata"].(map[string]any)
	require.Equal(t, ids.turnID, metadata["turn_id"])
}

func TestFingerprintBodyPreservesNonObjectMetadata(t *testing.T) {
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ChannelId: 7, ChannelSetting: dto.ChannelSettings{CodexFingerprintMode: "device"}}}
	ids := resolveFingerprintIDs(info, "client")
	body := map[string]any{"client_metadata": "opaque"}
	require.False(t, applyFingerprintBody(body, ids))
	require.Equal(t, "opaque", body["client_metadata"])
}

func TestFingerprintDeviceRewritesTurnMetadata(t *testing.T) {
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ChannelId: 7, ChannelSetting: dto.ChannelSettings{CodexFingerprintMode: "device"}}}
	ids := resolveFingerprintIDs(info, "client")
	body := map[string]any{"client_metadata": map[string]any{"x-codex-turn-metadata": `{"installation_id":"old"}`}}
	require.True(t, applyFingerprintBody(body, ids))
	metadata := body["client_metadata"].(map[string]any)
	require.Contains(t, metadata["x-codex-turn-metadata"], ids.installationID)
}
