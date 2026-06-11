package dto

type CCSwitchImportToken struct {
	Id        int    `json:"id"`
	Name      string `json:"name"`
	MaskedKey string `json:"masked_key"`
	BaseURL   string `json:"base_url"`
}

type CCSwitchImportTarget struct {
	Key            string `json:"key"`
	Label          string `json:"label"`
	Enabled        bool   `json:"enabled"`
	DisabledReason string `json:"disabled_reason,omitempty"`
}

type CCSwitchImportOptionsResponse struct {
	Token         CCSwitchImportToken    `json:"token"`
	DefaultTarget string                 `json:"default_target"`
	DefaultModel  string                 `json:"default_model"`
	Targets       []CCSwitchImportTarget `json:"targets"`
	Models        []CCSwitchModelOption  `json:"models"`
}

type CCSwitchImportLinkRequest struct {
	Target      string `json:"target"`
	Model       string `json:"model"`
	HaikuModel  string `json:"haiku_model,omitempty"`
	SonnetModel string `json:"sonnet_model,omitempty"`
	OpusModel   string `json:"opus_model,omitempty"`
}

type CCSwitchImportLinkResponse struct {
	URL string `json:"url"`
}

type CCSwitchModelOption struct {
	Name        string `json:"name"`
	VendorID    int    `json:"vendor_id"`
	VendorName  string `json:"vendor_name"`
	CreatedTime int64  `json:"created_time"`
}
