package model

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestProxyNodeScopeNormalization(t *testing.T) {
	tests := []struct {
		name, scopeType, scopeValue, wantValue string
		wantErr                                bool
	}{
		{name: "all", scopeType: ProxyNodeScopeAll, wantValue: ""},
		{name: "channel", scopeType: ProxyNodeScopeChannel, scopeValue: " 42 ", wantValue: "42"},
		{name: "group", scopeType: ProxyNodeScopeGroup, scopeValue: "  premium ", wantValue: "premium"},
		{name: "all rejects value", scopeType: ProxyNodeScopeAll, scopeValue: "x", wantErr: true},
		{name: "channel rejects zero", scopeType: ProxyNodeScopeChannel, scopeValue: "0", wantErr: true},
		{name: "channel rejects non-number", scopeType: ProxyNodeScopeChannel, scopeValue: "abc", wantErr: true},
		{name: "group rejects empty", scopeType: ProxyNodeScopeGroup, scopeValue: " ", wantErr: true},
		{name: "unknown type", scopeType: "tag", scopeValue: "x", wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotType, gotValue, err := NormalizeProxyNodeScope(tt.scopeType, tt.scopeValue)
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tt.scopeType, gotType)
			assert.Equal(t, tt.wantValue, gotValue)
		})
	}
}

func TestProxyNodePublicConversionDoesNotExposeConfiguration(t *testing.T) {
	lastProbe := time.Date(2026, time.August, 11, 12, 0, 0, 0, time.UTC)
	node := ProxyNode{
		ID:                   7,
		Name:                 "edge",
		Enabled:              true,
		EncryptedProxyConfig: "ciphertext-with-secret",
		Protocol:             "vless",
		ScopeType:            ProxyNodeScopeChannel,
		ScopeValue:           "42",
		Health:               0.8,
		FailureCount:         2,
		LastError:            "timeout",
		LastProbeAt:          &lastProbe,
	}

	public := node.Public()
	assert.Equal(t, uint(7), public.ID)
	assert.Equal(t, "edge", public.Name)
	assert.True(t, public.ProxyConfigured)
	assert.Equal(t, "vless", public.Protocol)
	assert.Equal(t, ProxyNodeScopeChannel, public.ScopeType)
	assert.Equal(t, "42", public.ScopeValue)
	assert.Equal(t, 0.8, public.Health)
	assert.Equal(t, 2, public.FailureCount)
	assert.Equal(t, "timeout", public.LastError)
	encoded, err := json.Marshal(public)
	require.NoError(t, err)
	assert.NotContains(t, string(encoded), "ciphertext-with-secret")
}

func TestProxyNodePersistenceFields(t *testing.T) {
	lastProbe := time.Now().UTC()
	node := ProxyNode{LastProbeAt: &lastProbe, CooldownUntil: &lastProbe}
	assert.Equal(t, &lastProbe, node.LastProbeAt)
	assert.Equal(t, &lastProbe, node.CooldownUntil)
}

func TestGetProxyNodesForChannelUsesChannelGroupAllPriority(t *testing.T) {
	previousDB := DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&ProxyNode{}))
	DB = db
	t.Cleanup(func() { DB = previousDB })

	require.NoError(t, db.Create(&ProxyNode{Name: "all", Enabled: true, ScopeType: ProxyNodeScopeAll}).Error)
	require.NoError(t, db.Create(&ProxyNode{Name: "group", Enabled: true, ScopeType: ProxyNodeScopeGroup, ScopeValue: "premium"}).Error)
	require.NoError(t, db.Create(&ProxyNode{Name: "channel", Enabled: true, ScopeType: ProxyNodeScopeChannel, ScopeValue: "42"}).Error)

	channel := &Channel{Id: 42, Group: "premium,beta"}
	nodes, err := GetProxyNodesForChannel(channel)
	require.NoError(t, err)
	require.Len(t, nodes, 1)
	assert.Equal(t, "channel", nodes[0].Name)

	require.NoError(t, db.Where("name = ?", "channel").Delete(&ProxyNode{}).Error)
	nodes, err = GetProxyNodesForChannel(channel)
	require.NoError(t, err)
	require.Len(t, nodes, 1)
	assert.Equal(t, "group", nodes[0].Name)

	require.NoError(t, db.Where("name = ?", "group").Delete(&ProxyNode{}).Error)
	nodes, err = GetProxyNodesForChannel(channel)
	require.NoError(t, err)
	require.Len(t, nodes, 1)
	assert.Equal(t, "all", nodes[0].Name)
}
