package ionet

import (
	"encoding/json"
	"fmt"
	"time"
)

// ListContainers retrieves all containers for a specific deployment
func (c *Client) ListContainers(deploymentID string) (*ContainerList, error) {
	if deploymentID == "" {
		return nil, fmt.Errorf("deployment ID cannot be empty")
	}

	endpoint := fmt.Sprintf("/deployment/%s/containers", deploymentID)

	resp, err := c.makeRequest("GET", endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to list containers: %w", err)
	}

	// Parse according to the actual API response format from docs:
	// {
	//   "data": {
	//     "total": 0,
	//     "workers": [...]
	//   }
	// }
	var apiResp struct {
		Data ContainerList `json:"data"`
	}

	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse containers list: %w", err)
	}

	return &apiResp.Data, nil
}

// GetContainerDetails retrieves detailed information about a specific container
func (c *Client) GetContainerDetails(deploymentID, containerID string) (*Container, error) {
	if deploymentID == "" {
		return nil, fmt.Errorf("deployment ID cannot be empty")
	}
	if containerID == "" {
		return nil, fmt.Errorf("container ID cannot be empty")
	}

	endpoint := fmt.Sprintf("/deployment/%s/container/%s", deploymentID, containerID)

	resp, err := c.makeRequest("GET", endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to get container details: %w", err)
	}

	// API response format not documented, assuming direct format
	var container Container
	if err := json.Unmarshal(resp.Body, &container); err != nil {
		return nil, fmt.Errorf("failed to parse container details: %w", err)
	}

	return &container, nil
}

// GetContainerJobs retrieves containers jobs for a specific container (similar to containers endpoint)
func (c *Client) GetContainerJobs(deploymentID, containerID string) (*ContainerList, error) {
	if deploymentID == "" {
		return nil, fmt.Errorf("deployment ID cannot be empty")
	}
	if containerID == "" {
		return nil, fmt.Errorf("container ID cannot be empty")
	}

	endpoint := fmt.Sprintf("/deployment/%s/containers-jobs/%s", deploymentID, containerID)

	resp, err := c.makeRequest("GET", endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to get container jobs: %w", err)
	}

	// Parse according to the actual API response format from docs (same as containers):
	// {
	//   "data": {
	//     "total": 0,
	//     "workers": [...]
	//   }
	// }
	var apiResp struct {
		Data ContainerList `json:"data"`
	}

	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse container jobs: %w", err)
	}

	return &apiResp.Data, nil
}

// GetContainerLogs retrieves logs for containers in a deployment
func (c *Client) GetContainerLogs(deploymentID, containerID string, opts *GetLogsOptions) (*ContainerLogs, error) {
	if deploymentID == "" {
		return nil, fmt.Errorf("deployment ID cannot be empty")
	}
	// containerID is optional for deployment logs

	params := make(map[string]interface{})

	if containerID != "" {
		params["container_id"] = containerID
	}

	if opts != nil {
		if opts.Level != "" {
			params["level"] = opts.Level
		}
		if opts.Limit > 0 {
			params["limit"] = opts.Limit
		}
		if opts.Cursor != "" {
			params["cursor"] = opts.Cursor
		}
		if opts.Follow {
			params["follow"] = "true"
		}

		if opts.StartTime != nil {
			params["start_time"] = opts.StartTime.Format(time.RFC3339)
		}
		if opts.EndTime != nil {
			params["end_time"] = opts.EndTime.Format(time.RFC3339)
		}
	}

	endpoint := fmt.Sprintf("/deployment/%s/logs", deploymentID) + buildQueryParams(params)

	resp, err := c.makeRequest("GET", endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to get container logs: %w", err)
	}

	// Parse according to the actual API response format from docs:
	// For now, we'll assume the API returns logs directly
	// In production, this might be wrapped in a data object
	var logs ContainerLogs
	if err := json.Unmarshal(resp.Body, &logs); err != nil {
		return nil, fmt.Errorf("failed to parse container logs: %w", err)
	}

	return &logs, nil
}

// StreamContainerLogs streams real-time logs for a specific container
// This method uses a callback function to handle incoming log entries
func (c *Client) StreamContainerLogs(deploymentID, containerID string, opts *GetLogsOptions, callback func(*LogEntry) error) error {
	if deploymentID == "" {
		return fmt.Errorf("deployment ID cannot be empty")
	}
	if containerID == "" {
		return fmt.Errorf("container ID cannot be empty")
	}
	if callback == nil {
		return fmt.Errorf("callback function cannot be nil")
	}

	// Set follow to true for streaming
	if opts == nil {
		opts = &GetLogsOptions{}
	}
	opts.Follow = true

	params := map[string]interface{}{
		"follow": true,
		"level":  opts.Level,
		"limit":  opts.Limit,
		"cursor": opts.Cursor,
	}

	if opts.StartTime != nil {
		params["start_time"] = *opts.StartTime
	}
	if opts.EndTime != nil {
		params["end_time"] = *opts.EndTime
	}

	endpoint := fmt.Sprintf("/deployment/%s/log/%s", deploymentID, containerID) + buildQueryParams(params)

	// Note: This is a simplified implementation. In a real scenario, you might want to use
	// Server-Sent Events (SSE) or WebSocket for streaming logs
	for {
		resp, err := c.makeRequest("GET", endpoint, nil)
		if err != nil {
			return fmt.Errorf("failed to stream container logs: %w", err)
		}

		var logs ContainerLogs
		if err := json.Unmarshal(resp.Body, &logs); err != nil {
			return fmt.Errorf("failed to parse container logs: %w", err)
		}

		// Call the callback for each log entry
		for _, logEntry := range logs.Logs {
			if err := callback(&logEntry); err != nil {
				return fmt.Errorf("callback error: %w", err)
			}
		}

		// If there are no more logs or we have a cursor, continue polling
		if !logs.HasMore && logs.NextCursor == "" {
			break
		}

		// Update cursor for next request
		if logs.NextCursor != "" {
			opts.Cursor = logs.NextCursor
			params["cursor"] = logs.NextCursor
			endpoint = fmt.Sprintf("/deployment/%s/log/%s", deploymentID, containerID) + buildQueryParams(params)
		}

		// Wait a bit before next poll to avoid overwhelming the API
		time.Sleep(2 * time.Second)
	}

	return nil
}

// RestartContainer restarts a specific container (if supported by the API)
func (c *Client) RestartContainer(deploymentID, containerID string) error {
	if deploymentID == "" {
		return fmt.Errorf("deployment ID cannot be empty")
	}
	if containerID == "" {
		return fmt.Errorf("container ID cannot be empty")
	}

	endpoint := fmt.Sprintf("/deployment/%s/container/%s/restart", deploymentID, containerID)

	_, err := c.makeRequest("POST", endpoint, nil)
	if err != nil {
		return fmt.Errorf("failed to restart container: %w", err)
	}

	return nil
}

// StopContainer stops a specific container (if supported by the API)
func (c *Client) StopContainer(deploymentID, containerID string) error {
	if deploymentID == "" {
		return fmt.Errorf("deployment ID cannot be empty")
	}
	if containerID == "" {
		return fmt.Errorf("container ID cannot be empty")
	}

	endpoint := fmt.Sprintf("/deployment/%s/container/%s/stop", deploymentID, containerID)

	_, err := c.makeRequest("POST", endpoint, nil)
	if err != nil {
		return fmt.Errorf("failed to stop container: %w", err)
	}

	return nil
}

// ExecuteInContainer executes a command in a specific container (if supported by the API)
func (c *Client) ExecuteInContainer(deploymentID, containerID string, command []string) (string, error) {
	if deploymentID == "" {
		return "", fmt.Errorf("deployment ID cannot be empty")
	}
	if containerID == "" {
		return "", fmt.Errorf("container ID cannot be empty")
	}
	if len(command) == 0 {
		return "", fmt.Errorf("command cannot be empty")
	}

	reqBody := map[string]interface{}{
		"command": command,
	}

	endpoint := fmt.Sprintf("/deployment/%s/container/%s/exec", deploymentID, containerID)

	resp, err := c.makeRequest("POST", endpoint, reqBody)
	if err != nil {
		return "", fmt.Errorf("failed to execute command in container: %w", err)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(resp.Body, &result); err != nil {
		return "", fmt.Errorf("failed to parse execution result: %w", err)
	}

	if output, ok := result["output"].(string); ok {
		return output, nil
	}

	return string(resp.Body), nil
}
