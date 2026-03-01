package dto

type Monitor struct {
	Name   string  `json:"name"`
	Uptime float64 `json:"uptime"`
	Status int     `json:"status"`
	Group  string  `json:"group,omitempty"`
}

type UptimeGroupResult struct {
	CategoryName string    `json:"categoryName"`
	Monitors     []Monitor `json:"monitors"`
}

// UptimeKumaGroupConfig represents a configured Uptime Kuma group for status monitoring.
type UptimeKumaGroupConfig struct {
	URL          string `json:"url"`
	Slug         string `json:"slug"`
	CategoryName string `json:"categoryName"`
	Description  string `json:"description,omitempty"`
}
