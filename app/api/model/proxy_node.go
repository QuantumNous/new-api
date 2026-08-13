package model

import (
	"fmt"
	"strconv"
	"strings"
	"time"
)

const (
	ProxyNodeScopeAll     = "all"
	ProxyNodeScopeChannel = "channel"
	ProxyNodeScopeGroup   = "group"
)

type ProxyNode struct {
	ID                   uint       `json:"id" gorm:"primaryKey"`
	Name                 string     `json:"name" gorm:"not null;index"`
	Enabled              bool       `json:"enabled"`
	EncryptedProxyConfig string     `json:"-" gorm:"type:text;not null"`
	Protocol             string     `json:"protocol" gorm:"size:32;index"`
	ScopeType            string     `json:"scope_type" gorm:"size:16;not null;index:idx_proxy_node_scope,priority:1"`
	ScopeValue           string     `json:"scope_value" gorm:"size:128;index:idx_proxy_node_scope,priority:2"`
	Health               float64    `json:"health"`
	FailureCount         int        `json:"failure_count"`
	CooldownUntil        *time.Time `json:"cooldown_until,omitempty"`
	LastError            string     `json:"last_error,omitempty" gorm:"type:text"`
	LastProbeAt          *time.Time `json:"last_probe_at,omitempty"`
	CreatedAt            time.Time  `json:"created_at"`
	UpdatedAt            time.Time  `json:"updated_at"`
}

type ProxyNodePublic struct {
	ID              uint       `json:"id"`
	Name            string     `json:"name"`
	Enabled         bool       `json:"enabled"`
	ProxyConfigured bool       `json:"proxy_configured"`
	Protocol        string     `json:"protocol"`
	ScopeType       string     `json:"scope_type"`
	ScopeValue      string     `json:"scope_value,omitempty"`
	ScopeName       string     `json:"scope_name,omitempty"`
	Health          float64    `json:"health"`
	FailureCount    int        `json:"failure_count"`
	CooldownUntil   *time.Time `json:"cooldown_until,omitempty"`
	LastError       string     `json:"last_error,omitempty"`
	LastProbeAt     *time.Time `json:"last_probe_at,omitempty"`
	ProbeTotal      int64      `json:"probe_total"`
	ProbeSuccess    int64      `json:"probe_success"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

func NormalizeProxyNodeScope(scopeType, scopeValue string) (string, string, error) {
	scopeType = strings.ToLower(strings.TrimSpace(scopeType))
	scopeValue = strings.TrimSpace(scopeValue)
	switch scopeType {
	case ProxyNodeScopeAll:
		if scopeValue != "" {
			return "", "", fmt.Errorf("scope value must be empty for all scope")
		}
	case ProxyNodeScopeChannel:
		id, err := strconv.Atoi(scopeValue)
		if err != nil || id <= 0 {
			return "", "", fmt.Errorf("channel scope value must be a positive channel ID")
		}
		scopeValue = strconv.Itoa(id)
	case ProxyNodeScopeGroup:
		if scopeValue == "" {
			return "", "", fmt.Errorf("group scope value must not be empty")
		}
	default:
		return "", "", fmt.Errorf("unsupported proxy node scope type %q", scopeType)
	}
	return scopeType, scopeValue, nil
}

func (node ProxyNode) Public() ProxyNodePublic {
	return ProxyNodePublic{
		ID:              node.ID,
		Name:            node.Name,
		Enabled:         node.Enabled,
		ProxyConfigured: strings.TrimSpace(node.EncryptedProxyConfig) != "",
		Protocol:        node.Protocol,
		ScopeType:       node.ScopeType,
		ScopeValue:      node.ScopeValue,
		Health:          node.Health,
		FailureCount:    node.FailureCount,
		CooldownUntil:   node.CooldownUntil,
		LastError:       node.LastError,
		LastProbeAt:     node.LastProbeAt,
		CreatedAt:       node.CreatedAt,
		UpdatedAt:       node.UpdatedAt,
	}
}

func GetProxyNodesForChannel(channel *Channel) ([]*ProxyNode, error) {
	if channel == nil {
		return nil, fmt.Errorf("channel is nil")
	}
	findScope := func(scopeType, scopeValue string) ([]*ProxyNode, error) {
		var nodes []*ProxyNode
		err := DB.Where("enabled = ?", true).
			Where("scope_type = ? AND scope_value = ?", scopeType, scopeValue).
			Find(&nodes).Error
		return nodes, err
	}
	nodes, err := findScope(ProxyNodeScopeChannel, strconv.Itoa(channel.Id))
	if err != nil {
		return nil, err
	}
	if len(nodes) > 0 {
		return nodes, nil
	}
	for _, group := range strings.Split(channel.Group, ",") {
		group = strings.TrimSpace(group)
		if group == "" {
			continue
		}
		groupNodes, err := findScope(ProxyNodeScopeGroup, group)
		if err != nil {
			return nil, err
		}
		if len(groupNodes) > 0 {
			return groupNodes, nil
		}
	}
	return findScope(ProxyNodeScopeAll, "")
}
