package service

import "time"

const (
	UpstreamStatusProviderKindIkun       = "ikun"
	UpstreamStatusProviderKindUptimeKuma = "uptime_kuma"

	upstreamStatusPublicCacheKey = "upstream_status:public:v1"
	upstreamStatusHistoryWindow  = 5 * time.Hour
	upstreamStatusCacheTTL       = 60 * time.Second
)

type UpstreamStatusProvider struct {
	Name         string
	DisplayName  string
	Kind         string
	StatusURL    string
	HeartbeatURL string
}

type UpstreamStatusSyncResult struct {
	Provider string
	Upserted int
	Error    error
}

type PublicUpstreamStatusPayload struct {
	Success bool                        `json:"success"`
	Message string                      `json:"message"`
	Data    []PublicUpstreamStatusGroup `json:"data"`
}

type PublicUpstreamStatusGroup struct {
	CategoryName string                        `json:"categoryName"`
	Monitors     []PublicUpstreamStatusMonitor `json:"monitors"`
}

type PublicUpstreamStatusMonitor struct {
	Name         string                         `json:"name"`
	Model        string                         `json:"model"`
	Uptime       float64                        `json:"uptime"`
	Availability float64                        `json:"availability"`
	Status       int                            `json:"status"`
	Latency      int                            `json:"latency"`
	Group        string                         `json:"group,omitempty"`
	UpdatedAt    int64                          `json:"updated_at"`
	History      []PublicUpstreamStatusTimeline `json:"history"`
}

type PublicUpstreamStatusTimeline struct {
	Timestamp    int64   `json:"timestamp"`
	Status       int     `json:"status"`
	Availability float64 `json:"availability"`
	Latency      int     `json:"latency"`
}

type foxcodeStatusPage struct {
	PublicGroupList []struct {
		Name        string `json:"name"`
		MonitorList []struct {
			ID   int    `json:"id"`
			Name string `json:"name"`
		} `json:"monitorList"`
	} `json:"publicGroupList"`
}

type foxcodeHeartbeatPage struct {
	HeartbeatList map[string][]struct {
		Status int    `json:"status"`
		Time   string `json:"time"`
		Msg    string `json:"msg"`
		Ping   *int   `json:"ping"`
	} `json:"heartbeatList"`
	UptimeList map[string]float64 `json:"uptimeList"`
}

type ikunStatusPage struct {
	Groups []struct {
		Provider      string `json:"provider"`
		ProviderSlug  string `json:"provider_slug"`
		CurrentStatus int    `json:"current_status"`
		Layers        []struct {
			Model         string `json:"model"`
			RequestModel  string `json:"request_model"`
			CurrentStatus struct {
				Status    int   `json:"status"`
				Latency   int   `json:"latency"`
				Timestamp int64 `json:"timestamp"`
			} `json:"current_status"`
			Timeline []struct {
				Timestamp    int64   `json:"timestamp"`
				Status       int     `json:"status"`
				Latency      int     `json:"latency"`
				Availability float64 `json:"availability"`
				StatusCounts any     `json:"status_counts"`
			} `json:"timeline"`
		} `json:"layers"`
	} `json:"groups"`
}
