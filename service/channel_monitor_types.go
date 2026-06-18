package service

import "time"

type ChannelMonitorCreateParams struct {
	Name             string
	Provider         string
	APIMode          string
	Endpoint         string
	APIKey           string
	PrimaryModel     string
	ExtraModels      []string
	GroupName        string
	Enabled          bool
	UserVisible      *bool
	IntervalSeconds  int
	JitterSeconds    int
	CreatedBy        int64
	TemplateID       *int64
	ExtraHeaders     map[string]string
	BodyOverrideMode string
	BodyOverride     map[string]any
}

type ChannelMonitorUpdateParams struct {
	Name             *string
	Provider         *string
	APIMode          *string
	Endpoint         *string
	APIKey           *string
	PrimaryModel     *string
	ExtraModels      *[]string
	GroupName        *string
	Enabled          *bool
	UserVisible      *bool
	IntervalSeconds  *int
	JitterSeconds    *int
	TemplateID       *int64
	ClearTemplate    bool
	ExtraHeaders     *map[string]string
	BodyOverrideMode *string
	BodyOverride     *map[string]any
}

type ChannelMonitorListParams struct {
	Page     int
	PageSize int
	Provider string
	Enabled  *bool
	Search   string
}

type ChannelMonitorRequestTemplateListParams struct {
	Provider string
	APIMode  string
}

type ChannelMonitorRequestTemplateCreateParams struct {
	Name             string
	Provider         string
	APIMode          string
	Description      string
	ExtraHeaders     map[string]string
	BodyOverrideMode string
	BodyOverride     map[string]any
}

type ChannelMonitorRequestTemplateUpdateParams struct {
	Name             *string
	APIMode          *string
	Description      *string
	ExtraHeaders     *map[string]string
	BodyOverrideMode *string
	BodyOverride     *map[string]any
}

type AssociatedMonitorBrief struct {
	ID       int64
	Name     string
	Provider string
	APIMode  string
	Enabled  bool
}

type CheckResult struct {
	Model         string    `json:"model"`
	Status        string    `json:"status"`
	LatencyMs     *int      `json:"latency_ms"`
	PingLatencyMs *int      `json:"ping_latency_ms"`
	Message       string    `json:"message"`
	CheckedAt     time.Time `json:"checked_at"`
}

type ExtraModelStatus struct {
	Model     string `json:"model"`
	Status    string `json:"status"`
	LatencyMs *int   `json:"latency_ms"`
}

type MonitorStatusSummary struct {
	PrimaryStatus        string
	PrimaryLatencyMs     *int
	PrimaryPingLatencyMs *int
	PrimaryCheckedAt     *time.Time
	Availability7d       float64
	Availability15d      float64
	Availability30d      float64
	ExtraModels          []ExtraModelStatus
}

type UserMonitorView struct {
	ID                   int64
	Name                 string
	Provider             string
	GroupName            string
	AdminOnly            bool
	PrimaryModel         string
	PrimaryStatus        string
	PrimaryLatencyMs     *int
	PrimaryPingLatencyMs *int
	PrimaryCheckedAt     *time.Time
	Availability7d       float64
	Availability15d      float64
	Availability30d      float64
	ExtraModels          []ExtraModelStatus
	Timeline             []UserMonitorTimelinePoint
}

type UserMonitorTimelinePoint struct {
	Status        string
	LatencyMs     *int
	PingLatencyMs *int
	CheckedAt     time.Time
}

type UserMonitorDetail struct {
	ID        int64
	Name      string
	Provider  string
	GroupName string
	AdminOnly bool
	Models    []ModelDetail
}

type ModelDetail struct {
	Model           string
	LatestStatus    string
	LatestLatencyMs *int
	LatestPingMs    *int
	LatestCheckedAt *time.Time
	Availability7d  float64
	Availability15d float64
	Availability30d float64
	AvgLatency7dMs  *int
}
