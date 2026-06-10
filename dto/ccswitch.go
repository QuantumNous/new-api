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
}

type CCSwitchImportLinkRequest struct {
	Target string `json:"target"`
	Model  string `json:"model"`
}

type CCSwitchImportLinkResponse struct {
	URL string `json:"url"`
}
