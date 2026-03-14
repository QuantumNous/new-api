package dto

import "github.com/QuantumNous/new-api/pkg/ionet"

type DeploymentSettingsResponse struct {
	Provider   string `json:"provider"`
	Enabled    bool   `json:"enabled"`
	Configured bool   `json:"configured"`
	CanConnect bool   `json:"can_connect"`
}

type TestConnectionResponse struct {
	HardwareCount  int `json:"hardware_count"`
	TotalAvailable int `json:"total_available"`
}

type DeploymentResourceConfig struct {
	CPU    string `json:"cpu"`
	Memory string `json:"memory"`
	GPU    string `json:"gpu"`
}

type DeploymentItem struct {
	ID                      string                   `json:"id"`
	DeploymentName          string                   `json:"deployment_name"`
	ContainerName           string                   `json:"container_name"`
	Status                  string                   `json:"status"`
	Type                    string                   `json:"type"`
	TimeRemaining           string                   `json:"time_remaining"`
	TimeRemainingMinutes    int                      `json:"time_remaining_minutes"`
	HardwareInfo            string                   `json:"hardware_info"`
	HardwareName            string                   `json:"hardware_name"`
	BrandName               string                   `json:"brand_name"`
	HardwareQuantity        int                      `json:"hardware_quantity"`
	CompletedPercent        float64                  `json:"completed_percent"`
	ComputeMinutesServed    int                      `json:"compute_minutes_served"`
	ComputeMinutesRemaining int                      `json:"compute_minutes_remaining"`
	CreatedAt               int64                    `json:"created_at"`
	UpdatedAt               int64                    `json:"updated_at"`
	ModelName               string                   `json:"model_name"`
	ModelVersion            string                   `json:"model_version"`
	InstanceCount           int                      `json:"instance_count"`
	ResourceConfig          DeploymentResourceConfig `json:"resource_config"`
	Description             string                   `json:"description"`
	Provider                string                   `json:"provider"`
}

type DeploymentListResponse struct {
	Page         int              `json:"page"`
	PageSize     int              `json:"page_size"`
	Total        int              `json:"total"`
	Items        []DeploymentItem `json:"items"`
	StatusCounts map[string]int64 `json:"status_counts"`
}

type DeploymentSearchResponse struct {
	Page     int              `json:"page"`
	PageSize int              `json:"page_size"`
	Total    int              `json:"total"`
	Items    []DeploymentItem `json:"items"`
}

type DeploymentDetailResponse struct {
	ID                      string                          `json:"id"`
	DeploymentName          string                          `json:"deployment_name"`
	ModelName               string                          `json:"model_name"`
	ModelVersion            string                          `json:"model_version"`
	Status                  string                          `json:"status"`
	InstanceCount           int                             `json:"instance_count"`
	HardwareID              int                             `json:"hardware_id"`
	ResourceConfig          DeploymentResourceConfig        `json:"resource_config"`
	CreatedAt               int64                           `json:"created_at"`
	UpdatedAt               int64                           `json:"updated_at"`
	Description             string                          `json:"description"`
	AmountPaid              float64                         `json:"amount_paid"`
	CompletedPercent        float64                         `json:"completed_percent"`
	GPUsPerContainer        int                             `json:"gpus_per_container"`
	TotalGPUs               int                             `json:"total_gpus"`
	TotalContainers         int                             `json:"total_containers"`
	HardwareName            string                          `json:"hardware_name"`
	BrandName               string                          `json:"brand_name"`
	ComputeMinutesServed    int                             `json:"compute_minutes_served"`
	ComputeMinutesRemaining int                             `json:"compute_minutes_remaining"`
	Locations               []ionet.DeploymentLocation      `json:"locations"`
	ContainerConfig         ionet.DeploymentContainerConfig `json:"container_config"`
}

type UpdateNameResponse struct {
	Status  string `json:"status"`
	Message string `json:"message"`
	ID      string `json:"id"`
	Name    string `json:"name"`
}

type DeploymentStatusResponse struct {
	Status       string `json:"status"`
	DeploymentID string `json:"deployment_id"`
}

type DeleteDeploymentResponse struct {
	Status       string `json:"status"`
	DeploymentID string `json:"deployment_id"`
	Message      string `json:"message"`
}

type CreateDeploymentResponse struct {
	DeploymentID string `json:"deployment_id"`
	Status       string `json:"status"`
	Message      string `json:"message"`
}

type HardwareTypesResponse struct {
	HardwareTypes  []ionet.HardwareType `json:"hardware_types"`
	Total          int                  `json:"total"`
	TotalAvailable int                  `json:"total_available"`
}

type LocationsListResponse struct {
	Locations []ionet.Location `json:"locations"`
	Total     int              `json:"total"`
}

type ClusterNameAvailabilityResponse struct {
	Available bool   `json:"available"`
	Name      string `json:"name"`
}

type ContainerEventItem struct {
	Time    int64  `json:"time"`
	Message string `json:"message"`
}

type ContainerItem struct {
	ContainerID      string               `json:"container_id"`
	DeviceID         string               `json:"device_id"`
	Status           string               `json:"status"`
	Hardware         string               `json:"hardware"`
	BrandName        string               `json:"brand_name"`
	CreatedAt        int64                `json:"created_at"`
	UptimePercent    int                  `json:"uptime_percent"`
	GPUsPerContainer int                  `json:"gpus_per_container"`
	PublicURL        string               `json:"public_url"`
	Events           []ContainerEventItem `json:"events"`
}

type ContainerListResponse struct {
	Total      int             `json:"total"`
	Containers []ContainerItem `json:"containers"`
}

type ContainerDetailResponse struct {
	DeploymentID     string               `json:"deployment_id"`
	ContainerID      string               `json:"container_id"`
	DeviceID         string               `json:"device_id"`
	Status           string               `json:"status"`
	Hardware         string               `json:"hardware"`
	BrandName        string               `json:"brand_name"`
	CreatedAt        int64                `json:"created_at"`
	UptimePercent    int                  `json:"uptime_percent"`
	GPUsPerContainer int                  `json:"gpus_per_container"`
	PublicURL        string               `json:"public_url"`
	Events           []ContainerEventItem `json:"events"`
}
