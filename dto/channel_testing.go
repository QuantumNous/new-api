package dto

// TestChannelResponse is the response for channel test endpoints.
type TestChannelResponse struct {
	Success bool    `json:"success"`
	Message string  `json:"message"`
	Time    float64 `json:"time"`
}

// ChannelBalanceResponse is the response for channel balance endpoints.
type ChannelBalanceResponse struct {
	Success bool    `json:"success"`
	Message string  `json:"message"`
	Balance float64 `json:"balance,omitempty"`
}
