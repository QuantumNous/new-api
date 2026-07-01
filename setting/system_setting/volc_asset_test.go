package system_setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestVolcAssetSettingsActionPrice(t *testing.T) {
	cfg := VolcAssetSettings{ActionPrices: map[string]int{
		"CreateAsset": 1000,
		"GetAsset":    0,
		"DeleteAsset": -5,
	}}

	assert.Equal(t, 1000, cfg.ActionPrice("CreateAsset"))
	// Unconfigured, zero, and negative values are all treated as free.
	assert.Equal(t, 0, cfg.ActionPrice("GetAsset"))
	assert.Equal(t, 0, cfg.ActionPrice("DeleteAsset"))
	assert.Equal(t, 0, cfg.ActionPrice("ListAssets"))

	empty := VolcAssetSettings{}
	assert.Equal(t, 0, empty.ActionPrice("CreateAsset"))
}

func TestVolcAssetSettingsIsConfigured(t *testing.T) {
	tests := []struct {
		name string
		cfg  VolcAssetSettings
		want bool
	}{
		{"no outbounds", VolcAssetSettings{}, false},
		{
			"volcengine complete",
			VolcAssetSettings{Outbounds: []AssetOutbound{{Format: AssetFormatVolcengine, AccessKey: "ak", SecretKey: "sk"}}},
			true,
		},
		{
			"volcengine missing secret",
			VolcAssetSettings{Outbounds: []AssetOutbound{{Format: AssetFormatVolcengine, AccessKey: "ak"}}},
			false,
		},
		{
			"newapi complete",
			VolcAssetSettings{Outbounds: []AssetOutbound{{Format: AssetFormatNewAPI, BaseURL: "https://x", AccessToken: "t"}}},
			true,
		},
		{
			"only disabled outbound",
			VolcAssetSettings{Outbounds: []AssetOutbound{{Format: AssetFormatVolcengine, AccessKey: "ak", SecretKey: "sk", Disabled: true}}},
			false,
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, tc.cfg.IsConfigured())
		})
	}
}

func TestEffectiveOutboundsSkipsDisabled(t *testing.T) {
	cfg := VolcAssetSettings{Outbounds: []AssetOutbound{
		{Id: "a", Format: AssetFormatVolcengine, AccessKey: "ak", SecretKey: "sk"},
		{Id: "b", Format: AssetFormatVolcengine, AccessKey: "ak", SecretKey: "sk", Disabled: true},
	}}
	obs := cfg.EffectiveOutbounds()
	require.Len(t, obs, 1)
	assert.Equal(t, "a", obs[0].Id)
}

func TestAssetOutboundEffectiveDefaults(t *testing.T) {
	ob := AssetOutbound{}
	assert.Equal(t, AssetFormatVolcengine, ob.EffectiveFormat())
	assert.Equal(t, defaultOutboundId, ob.EffectiveId())
	assert.Equal(t, "cn-beijing", ob.GetRegion())
	assert.Equal(t, "AIGC", ob.GetGroupType())
	assert.Equal(t, "https://ark.cn-beijing.volcengineapi.com", ob.ResolvedBaseURL())

	tok := AssetOutbound{Format: AssetFormatNewAPI, BaseURL: "https://gw/api"}
	assert.Equal(t, "https://gw/api", tok.ResolvedBaseURL())
}

func TestOutboundConfigured(t *testing.T) {
	cfg := VolcAssetSettings{CustomFormats: []AssetCustomFormat{{Id: "myfmt"}}}
	tests := []struct {
		name string
		ob   AssetOutbound
		want bool
	}{
		{"volcengine ok", AssetOutbound{Format: AssetFormatVolcengine, AccessKey: "ak", SecretKey: "sk"}, true},
		{"volcengine missing sk", AssetOutbound{Format: AssetFormatVolcengine, AccessKey: "ak"}, false},
		{"newapi ok", AssetOutbound{Format: AssetFormatNewAPI, BaseURL: "https://x", AccessToken: "t"}, true},
		{"custom ok", AssetOutbound{Format: "myfmt", BaseURL: "https://x"}, true},
		{"custom missing base", AssetOutbound{Format: "myfmt"}, false},
		{"custom unknown format", AssetOutbound{Format: "nope", BaseURL: "https://x"}, false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, cfg.OutboundConfigured(tc.ob))
		})
	}
}

func TestResolveOutboundCandidates(t *testing.T) {
	base := func() VolcAssetSettings {
		return VolcAssetSettings{Outbounds: []AssetOutbound{
			{Id: "a", Format: AssetFormatVolcengine, AccessKey: "ak", SecretKey: "sk"},
			{Id: "b", Format: AssetFormatNewAPI, BaseURL: "https://b", AccessToken: "t"},
			{Id: "c", Format: AssetFormatVolcengine}, // unconfigured (missing sk), should be filtered out
		}}
	}

	// Client-specified takes priority.
	cfg := base()
	got := cfg.ResolveOutboundCandidates("b")
	require.Len(t, got, 1)
	assert.Equal(t, "b", got[0].Id)

	// Specified but nonexistent -> fall back to default.
	cfg = base()
	cfg.DefaultOutbound = "b"
	got = cfg.ResolveOutboundCandidates("zzz")
	require.Len(t, got, 1)
	assert.Equal(t, "b", got[0].Id)

	// Neither specified nor default -> the first one.
	cfg = base()
	got = cfg.ResolveOutboundCandidates("")
	require.Len(t, got, 1)
	assert.Equal(t, "a", got[0].Id)

	// failover enabled -> primary candidate + other configured outbounds (the unconfigured c is filtered out).
	cfg = base()
	cfg.Failover = true
	got = cfg.ResolveOutboundCandidates("a")
	require.Len(t, got, 2)
	assert.Equal(t, "a", got[0].Id)
	assert.Equal(t, "b", got[1].Id)

	// Empty config -> no candidates.
	assert.Empty(t, (&VolcAssetSettings{}).ResolveOutboundCandidates(""))
}

func TestRedactedClearsOutboundSecrets(t *testing.T) {
	cfg := VolcAssetSettings{
		Outbounds: []AssetOutbound{
			{Id: "a", Format: AssetFormatVolcengine, AccessKey: "ak", SecretKey: "sk-a"},
			{Id: "b", Format: AssetFormatNewAPI, AccessToken: "tok-b"},
		},
	}
	got := cfg.Redacted()
	assert.Empty(t, got.Outbounds[0].SecretKey)
	assert.Empty(t, got.Outbounds[1].AccessToken)
	// Non-secret fields are preserved.
	assert.Equal(t, "ak", got.Outbounds[0].AccessKey)
	// Value-receiver semantics: the original object is not modified.
	assert.Equal(t, "sk-a", cfg.Outbounds[0].SecretKey)
}

func TestMergeSecretsRestoresOutboundSecrets(t *testing.T) {
	prev := VolcAssetSettings{Outbounds: []AssetOutbound{
		{Id: "a", SecretKey: "old-sk", AccessToken: "old-tok"},
	}}
	incoming := VolcAssetSettings{Outbounds: []AssetOutbound{
		{Id: "a", SecretKey: "", AccessToken: "new-tok"}, // empty sk should be backfilled from old; new tok overrides
		{Id: "new", SecretKey: ""},                       // prev has no such outbound, stays empty
	}}
	got := incoming.MergeSecretsFromExisting(prev)
	assert.Equal(t, "old-sk", got.Outbounds[0].SecretKey)
	assert.Equal(t, "new-tok", got.Outbounds[0].AccessToken)
	assert.Empty(t, got.Outbounds[1].SecretKey)
}
