package types

// AgentImageQuote is created by the server, never trusted from request JSON.
// Currency and quota conversion are frozen along with the agent's price version.
type AgentImageQuote struct {
	CustomerID int    `json:"customer_id"`
	AgentID    int    `json:"agent_id"`
	Model      string `json:"model"`
	PriceCents int    `json:"price_cents"`
	UnitQuota  int    `json:"unit_quota"`
	Version    int64  `json:"version"`
}
