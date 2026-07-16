package dto

import "github.com/QuantumNous/new-api/pkg/ionet"

// Fork-owned response DTOs for /api/deployments/* admin endpoints
// (controller/deployment.go). The handlers proxy the io.net API and remap
// most payloads into gin.H — these structs mirror those remapped shapes for
// the OpenAPI generator. Pure pass-through endpoints (available-replicas,
// price-estimation) reference pkg/ionet DTOs directly from the manifest.

// DeploymentResourceConfig — nested resource_config of a deployment item.
type DeploymentResourceConfig struct {
	CPU    string `json:"cpu"`
	Memory string `json:"memory"`
	GPU    string `json:"gpu"`
}

// DeploymentSummary mirrors controller.mapIoNetDeployment — the list/search
// item shape and the POST /api/deployments/{id}/extend response.
type DeploymentSummary struct {
	Id                      string                   `json:"id"`
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

// DeploymentListResponse — GET /api/deployments/.
type DeploymentListResponse struct {
	Page         int                 `json:"page"`
	PageSize     int                 `json:"page_size"`
	Total        int                 `json:"total"`
	Items        []DeploymentSummary `json:"items"`
	StatusCounts map[string]int64    `json:"status_counts"`
}

// DeploymentSearchResponse — GET /api/deployments/search.
type DeploymentSearchResponse struct {
	Page     int                 `json:"page"`
	PageSize int                 `json:"page_size"`
	Total    int                 `json:"total"`
	Items    []DeploymentSummary `json:"items"`
}

// DeploymentCreateResponse — POST /api/deployments/.
type DeploymentCreateResponse struct {
	DeploymentId string `json:"deployment_id"`
	Status       string `json:"status"`
	Message      string `json:"message"`
}

// ClusterNameAvailabilityResponse — GET /api/deployments/check-name.
type ClusterNameAvailabilityResponse struct {
	Available bool   `json:"available"`
	Name      string `json:"name"`
}

// DeploymentHardwareTypesResponse — GET /api/deployments/hardware-types.
type DeploymentHardwareTypesResponse struct {
	HardwareTypes  []ionet.HardwareType `json:"hardware_types"`
	Total          int                  `json:"total"`
	TotalAvailable int                  `json:"total_available"`
}

// DeploymentLocationsResponse — GET /api/deployments/locations.
type DeploymentLocationsResponse struct {
	Locations []ionet.Location `json:"locations"`
	Total     int              `json:"total"`
}

// DeploymentDetailResponse — GET /api/deployments/{id}.
type DeploymentDetailResponse struct {
	Id                      string                          `json:"id"`
	DeploymentName          string                          `json:"deployment_name"`
	ModelName               string                          `json:"model_name"`
	ModelVersion            string                          `json:"model_version"`
	Status                  string                          `json:"status"`
	InstanceCount           int                             `json:"instance_count"`
	HardwareId              int                             `json:"hardware_id"`
	ResourceConfig          DeploymentResourceConfig        `json:"resource_config"`
	CreatedAt               int64                           `json:"created_at"`
	UpdatedAt               int64                           `json:"updated_at"`
	Description             string                          `json:"description"`
	AmountPaid              float64                         `json:"amount_paid"`
	CompletedPercent        float64                         `json:"completed_percent"`
	GpusPerContainer        int                             `json:"gpus_per_container"`
	TotalGpus               int                             `json:"total_gpus"`
	TotalContainers         int                             `json:"total_containers"`
	HardwareName            string                          `json:"hardware_name"`
	BrandName               string                          `json:"brand_name"`
	ComputeMinutesServed    int                             `json:"compute_minutes_served"`
	ComputeMinutesRemaining int                             `json:"compute_minutes_remaining"`
	Locations               []ionet.DeploymentLocation      `json:"locations"`
	ContainerConfig         ionet.DeploymentContainerConfig `json:"container_config"`
}

// DeploymentContainerEvent — event entry in container payloads.
type DeploymentContainerEvent struct {
	Time    int64  `json:"time"`
	Message string `json:"message"`
}

// DeploymentContainer — item of GET /api/deployments/{id}/containers.
type DeploymentContainer struct {
	ContainerId      string                     `json:"container_id"`
	DeviceId         string                     `json:"device_id"`
	Status           string                     `json:"status"`
	Hardware         string                     `json:"hardware"`
	BrandName        string                     `json:"brand_name"`
	CreatedAt        int64                      `json:"created_at"`
	UptimePercent    int                        `json:"uptime_percent"`
	GpusPerContainer int                        `json:"gpus_per_container"`
	PublicUrl        string                     `json:"public_url"`
	Events           []DeploymentContainerEvent `json:"events"`
}

// DeploymentContainersResponse — GET /api/deployments/{id}/containers.
type DeploymentContainersResponse struct {
	Total      int                   `json:"total"`
	Containers []DeploymentContainer `json:"containers"`
}

// ContainerDetailsResponse — GET /api/deployments/{id}/containers/{container_id}.
type ContainerDetailsResponse struct {
	DeploymentId     string                     `json:"deployment_id"`
	ContainerId      string                     `json:"container_id"`
	DeviceId         string                     `json:"device_id"`
	Status           string                     `json:"status"`
	Hardware         string                     `json:"hardware"`
	BrandName        string                     `json:"brand_name"`
	CreatedAt        int64                      `json:"created_at"`
	UptimePercent    int                        `json:"uptime_percent"`
	GpusPerContainer int                        `json:"gpus_per_container"`
	PublicUrl        string                     `json:"public_url"`
	Events           []DeploymentContainerEvent `json:"events"`
}
