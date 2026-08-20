package dto

import "time"

type IntelligentRoutingDraftRequest struct {
	Config string `json:"config"`
}

type IntelligentRoutingDraftUpdateRequest struct {
	Config    string    `json:"config"`
	UpdatedAt time.Time `json:"updated_at"`
}

type IntelligentRoutingPublishRequest struct {
	ChangeNote string `json:"change_note"`
}

type IntelligentRoutingRolloutUpdateRequest struct {
	Revision       int64    `json:"revision"`
	PolicyVersion  int      `json:"policy_version"`
	Enabled        bool     `json:"enabled"`
	Mode           string   `json:"mode"`
	TrafficPercent int      `json:"traffic_percent"`
	UserGroups     []string `json:"user_groups"`
	TokenGroups    []string `json:"token_groups"`
}
