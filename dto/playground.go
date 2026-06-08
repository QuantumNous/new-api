package dto

type PlayGroundRequest struct {
	Model string `json:"model,omitempty"`
	Group string `json:"group,omitempty"`
}

type UserModelOption struct {
	Label                  string   `json:"label"`
	Value                  string   `json:"value"`
	SupportedEndpointTypes []string `json:"supported_endpoint_types"`
}
