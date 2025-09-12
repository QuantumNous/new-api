package ionet

import (
	"encoding/json"
	"fmt"
)

// GetAvailableReplicas retrieves available replicas per location for specified hardware
func (c *Client) GetAvailableReplicas(hardwareID int, gpuCount int) (*AvailableReplicasResponse, error) {
	if hardwareID <= 0 {
		return nil, fmt.Errorf("hardware_id must be greater than 0")
	}
	if gpuCount < 1 {
		return nil, fmt.Errorf("gpu_count must be at least 1")
	}

	params := map[string]interface{}{
		"hardware_id":  hardwareID,
		"hardware_qty": gpuCount,
	}

	endpoint := "/available-replicas" + buildQueryParams(params)

	resp, err := c.makeRequest("GET", endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to get available replicas: %w", err)
	}

	// Parse according to the actual API response format from docs:
	// {
	//   "data": [
	//     {
	//       "id": 0,
	//       "iso2": "string",
	//       "name": "string",
	//       "available_replicas": 0
	//     }
	//   ]
	// }
	var apiResp struct {
		Data []struct {
			ID                int    `json:"id"`
			ISO2              string `json:"iso2"`
			Name              string `json:"name"`
			AvailableReplicas int    `json:"available_replicas"`
		} `json:"data"`
	}

	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse available replicas response: %w", err)
	}

	// Convert to our internal format
	replicas := make([]AvailableReplica, 0, len(apiResp.Data))
	for _, item := range apiResp.Data {
		replicas = append(replicas, AvailableReplica{
			LocationID:     item.ID,
			LocationName:   item.Name,
			HardwareID:     hardwareID,
			HardwareName:   "",
			AvailableCount: item.AvailableReplicas,
			MaxGPUs:        gpuCount,
		})
	}

	return &AvailableReplicasResponse{Replicas: replicas}, nil
}

// GetMaxGPUsPerContainer retrieves the maximum number of GPUs available per hardware type
func (c *Client) GetMaxGPUsPerContainer() (*MaxGPUResponse, error) {
	resp, err := c.makeRequest("GET", "/hardware/max-gpus-per-container", nil)
	if err != nil {
		return nil, fmt.Errorf("failed to get max GPUs per container: %w", err)
	}

	// API returns wrapped shape:
	// {
	//   "data": {
	//     "hardware": [
	//       {
	//         "max_gpus_per_container": 8,
	//         "available": 24,
	//         "hardware_id": 203,
	//         "hardware_name": "H100 PCIe",
	//         "brand_name": "NVIDIA"
	//       }
	//     ],
	//     "total": 32
	//   }
	// }
	var wrapped struct {
		Data MaxGPUResponse `json:"data"`
	}

	if err := json.Unmarshal(resp.Body, &wrapped); err != nil {
		return nil, fmt.Errorf("failed to parse max GPU response: %w", err)
	}

	return &wrapped.Data, nil
}

// ListHardwareTypes retrieves available hardware types (if supported by the API)
func (c *Client) ListHardwareTypes() ([]HardwareType, error) {
	resp, err := c.makeRequest("GET", "/hardware/types", nil)
	if err != nil {
		return nil, fmt.Errorf("failed to list hardware types: %w", err)
	}

	// API returns wrapped structure:
	// { "data": { "hardware": [ { "hardware_id": 203, "hardware_name": "H100 PCIe", "brand_name": "NVIDIA", "max_gpus_per_container": 8, "available": 24 } ], "total": 32 } }
	var wrapped struct {
		Data struct {
			Hardware []struct {
				MaxGPUsPerContainer int    `json:"max_gpus_per_container"`
				Available           int    `json:"available"`
				HardwareID          int    `json:"hardware_id"`
				HardwareName        string `json:"hardware_name"`
				BrandName           string `json:"brand_name"`
			} `json:"hardware"`
			Total int `json:"total"`
		} `json:"data"`
	}

	if err := json.Unmarshal(resp.Body, &wrapped); err != nil {
		return nil, fmt.Errorf("failed to parse hardware types: %w", err)
	}

	// Map to []HardwareType with best-effort field alignment
	mapped := make([]HardwareType, 0, len(wrapped.Data.Hardware))
	for _, hw := range wrapped.Data.Hardware {
		mapped = append(mapped, HardwareType{
			ID:         hw.HardwareID,
			Name:       hw.HardwareName,
			GPUType:    "", // unknown in this response; leave empty
			GPUMemory:  0,  // unknown
			MaxGPUs:    hw.MaxGPUsPerContainer,
			CPU:        "", // unknown
			Memory:     0,  // unknown
			Storage:    0,  // unknown
			HourlyRate: 0,  // unknown
			Available:  hw.Available > 0,
		})
	}

	return mapped, nil
}

// ListLocations retrieves available deployment locations (if supported by the API)
func (c *Client) ListLocations() ([]Location, error) {
	resp, err := c.makeRequest("GET", "/locations", nil)
	if err != nil {
		return nil, fmt.Errorf("failed to list locations: %w", err)
	}

	// API response format not documented, assuming direct format
	var locations []Location
	if err := json.Unmarshal(resp.Body, &locations); err != nil {
		return nil, fmt.Errorf("failed to parse locations: %w", err)
	}

	return locations, nil
}

// GetHardwareType retrieves details about a specific hardware type
func (c *Client) GetHardwareType(hardwareID int) (*HardwareType, error) {
	if hardwareID <= 0 {
		return nil, fmt.Errorf("hardware ID must be greater than 0")
	}

	endpoint := fmt.Sprintf("/hardware/types/%d", hardwareID)

	resp, err := c.makeRequest("GET", endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to get hardware type: %w", err)
	}

	// API response format not documented, assuming direct format
	var hardwareType HardwareType
	if err := json.Unmarshal(resp.Body, &hardwareType); err != nil {
		return nil, fmt.Errorf("failed to parse hardware type: %w", err)
	}

	return &hardwareType, nil
}

// GetLocation retrieves details about a specific location
func (c *Client) GetLocation(locationID int) (*Location, error) {
	if locationID <= 0 {
		return nil, fmt.Errorf("location ID must be greater than 0")
	}

	endpoint := fmt.Sprintf("/locations/%d", locationID)

	resp, err := c.makeRequest("GET", endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to get location: %w", err)
	}

	// API response format not documented, assuming direct format
	var location Location
	if err := json.Unmarshal(resp.Body, &location); err != nil {
		return nil, fmt.Errorf("failed to parse location: %w", err)
	}

	return &location, nil
}

// GetLocationAvailability retrieves real-time availability for a specific location
func (c *Client) GetLocationAvailability(locationID int) (*LocationAvailability, error) {
	if locationID <= 0 {
		return nil, fmt.Errorf("location ID must be greater than 0")
	}

	endpoint := fmt.Sprintf("/locations/%d/availability", locationID)

	resp, err := c.makeRequest("GET", endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to get location availability: %w", err)
	}

	// API response format not documented, assuming direct format
	var availability LocationAvailability
	if err := json.Unmarshal(resp.Body, &availability); err != nil {
		return nil, fmt.Errorf("failed to parse location availability: %w", err)
	}

	return &availability, nil
}
