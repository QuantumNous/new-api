package ionet

import (
	"errors"
	"github.com/QuantumNous/new-api/common"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/samber/lo"
)

// ListContainers retrieves all containers for a specific deployment
func (c *Client) ListContainers(deploymentID string) (*ContainerList, error) {
	if deploymentID == "" {
		return nil, errors.New(common.Translate(common.DefaultLang, "pkg.deployment_id_cannot_be_empty"))
	}

	endpoint := fmt.Sprintf("/deployment/%s/containers", deploymentID)

	resp, err := c.makeRequest("GET", endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf(common.Translate(common.DefaultLang, "pkg.failed_to_list_containers"), err)
	}

	var containerList ContainerList
	if err := decodeDataWithFlexibleTimes(resp.Body, &containerList); err != nil {
		return nil, fmt.Errorf(common.Translate(common.DefaultLang, "pkg.failed_to_parse_containers_list"), err)
	}

	return &containerList, nil
}

// GetContainerDetails retrieves detailed information about a specific container
func (c *Client) GetContainerDetails(deploymentID, containerID string) (*Container, error) {
	if deploymentID == "" {
		return nil, errors.New(common.Translate(common.DefaultLang, "pkg.deployment_id_cannot_be_empty"))
	}
	if containerID == "" {
		return nil, errors.New(common.Translate(common.DefaultLang, "pkg.container_id_cannot_be_empty"))
	}

	endpoint := fmt.Sprintf("/deployment/%s/container/%s", deploymentID, containerID)

	resp, err := c.makeRequest("GET", endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf(common.Translate(common.DefaultLang, "pkg.failed_to_get_container_details"), err)
	}

	// API response format not documented, assuming direct format
	var container Container
	if err := decodeWithFlexibleTimes(resp.Body, &container); err != nil {
		return nil, fmt.Errorf(common.Translate(common.DefaultLang, "pkg.failed_to_parse_container_details"), err)
	}

	return &container, nil
}

// GetContainerJobs retrieves containers jobs for a specific container (similar to containers endpoint)
func (c *Client) GetContainerJobs(deploymentID, containerID string) (*ContainerList, error) {
	if deploymentID == "" {
		return nil, errors.New(common.Translate(common.DefaultLang, "pkg.deployment_id_cannot_be_empty"))
	}
	if containerID == "" {
		return nil, errors.New(common.Translate(common.DefaultLang, "pkg.container_id_cannot_be_empty"))
	}

	endpoint := fmt.Sprintf("/deployment/%s/containers-jobs/%s", deploymentID, containerID)

	resp, err := c.makeRequest("GET", endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf(common.Translate(common.DefaultLang, "pkg.failed_to_get_container_jobs"), err)
	}

	var containerList ContainerList
	if err := decodeDataWithFlexibleTimes(resp.Body, &containerList); err != nil {
		return nil, fmt.Errorf(common.Translate(common.DefaultLang, "pkg.failed_to_parse_container_jobs"), err)
	}

	return &containerList, nil
}

// buildLogEndpoint constructs the request path for fetching logs
func buildLogEndpoint(deploymentID, containerID string, opts *GetLogsOptions) (string, error) {
	if deploymentID == "" {
		return "", errors.New(common.Translate(common.DefaultLang, "pkg.deployment_id_cannot_be_empty"))
	}
	if containerID == "" {
		return "", errors.New(common.Translate(common.DefaultLang, "pkg.container_id_cannot_be_empty"))
	}

	params := make(map[string]interface{})

	if opts != nil {
		if opts.Level != "" {
			params["level"] = opts.Level
		}
		if opts.Stream != "" {
			params["stream"] = opts.Stream
		}
		if opts.Limit > 0 {
			params["limit"] = opts.Limit
		}
		if opts.Cursor != "" {
			params["cursor"] = opts.Cursor
		}
		if opts.Follow {
			params["follow"] = true
		}

		if opts.StartTime != nil {
			params["start_time"] = opts.StartTime
		}
		if opts.EndTime != nil {
			params["end_time"] = opts.EndTime
		}
	}

	endpoint := fmt.Sprintf("/deployment/%s/log/%s", deploymentID, containerID)
	endpoint += buildQueryParams(params)

	return endpoint, nil
}

// GetContainerLogs retrieves logs for containers in a deployment and normalizes them
func (c *Client) GetContainerLogs(deploymentID, containerID string, opts *GetLogsOptions) (*ContainerLogs, error) {
	raw, err := c.GetContainerLogsRaw(deploymentID, containerID, opts)
	if err != nil {
		return nil, err
	}

	logs := &ContainerLogs{
		ContainerID: containerID,
	}

	if raw == "" {
		return logs, nil
	}

	normalized := strings.ReplaceAll(raw, "\r\n", "\n")
	lines := strings.Split(normalized, "\n")
	logs.Logs = lo.FilterMap(lines, func(line string, _ int) (LogEntry, bool) {
		if strings.TrimSpace(line) == "" {
			return LogEntry{}, false
		}
		return LogEntry{Message: line}, true
	})

	return logs, nil
}

// GetContainerLogsRaw retrieves the raw text logs for a specific container
func (c *Client) GetContainerLogsRaw(deploymentID, containerID string, opts *GetLogsOptions) (string, error) {
	endpoint, err := buildLogEndpoint(deploymentID, containerID, opts)
	if err != nil {
		return "", err
	}

	resp, err := c.makeRequest("GET", endpoint, nil)
	if err != nil {
		return "", fmt.Errorf(common.Translate(common.DefaultLang, "pkg.failed_to_get_container_logs"), err)
	}

	return string(resp.Body), nil
}

// StreamContainerLogs streams real-time logs for a specific container
// This method uses a callback function to handle incoming log entries
func (c *Client) StreamContainerLogs(deploymentID, containerID string, opts *GetLogsOptions, callback func(*LogEntry) error) error {
	if deploymentID == "" {
		return errors.New(common.Translate(common.DefaultLang, "pkg.deployment_id_cannot_be_empty"))
	}
	if containerID == "" {
		return errors.New(common.Translate(common.DefaultLang, "pkg.container_id_cannot_be_empty"))
	}
	if callback == nil {
		return errors.New(common.Translate(common.DefaultLang, "pkg.callback_function_cannot_be_nil"))
	}

	// Set follow to true for streaming
	if opts == nil {
		opts = &GetLogsOptions{}
	}
	opts.Follow = true

	endpoint, err := buildLogEndpoint(deploymentID, containerID, opts)
	if err != nil {
		return err
	}

	// Note: This is a simplified implementation. In a real scenario, you might want to use
	// Server-Sent Events (SSE) or WebSocket for streaming logs
	for {
		resp, err := c.makeRequest("GET", endpoint, nil)
		if err != nil {
			return fmt.Errorf(common.Translate(common.DefaultLang, "pkg.failed_to_stream_container_logs"), err)
		}

		var logs ContainerLogs
		if err := decodeWithFlexibleTimes(resp.Body, &logs); err != nil {
			return fmt.Errorf(common.Translate(common.DefaultLang, "pkg.failed_to_parse_container_logs"), err)
		}

		// Call the callback for each log entry
		for _, logEntry := range logs.Logs {
			if err := callback(&logEntry); err != nil {
				return fmt.Errorf(common.Translate(common.DefaultLang, "pkg.callback_error"), err)
			}
		}

		// If there are no more logs or we have a cursor, continue polling
		if !logs.HasMore && logs.NextCursor == "" {
			break
		}

		// Update cursor for next request
		if logs.NextCursor != "" {
			opts.Cursor = logs.NextCursor
			endpoint, err = buildLogEndpoint(deploymentID, containerID, opts)
			if err != nil {
				return err
			}
		}

		// Wait a bit before next poll to avoid overwhelming the API
		time.Sleep(2 * time.Second)
	}

	return nil
}

// RestartContainer restarts a specific container (if supported by the API)
func (c *Client) RestartContainer(deploymentID, containerID string) error {
	if deploymentID == "" {
		return errors.New(common.Translate(common.DefaultLang, "pkg.deployment_id_cannot_be_empty"))
	}
	if containerID == "" {
		return errors.New(common.Translate(common.DefaultLang, "pkg.container_id_cannot_be_empty"))
	}

	endpoint := fmt.Sprintf("/deployment/%s/container/%s/restart", deploymentID, containerID)

	_, err := c.makeRequest("POST", endpoint, nil)
	if err != nil {
		return fmt.Errorf(common.Translate(common.DefaultLang, "pkg.failed_to_restart_container"), err)
	}

	return nil
}

// StopContainer stops a specific container (if supported by the API)
func (c *Client) StopContainer(deploymentID, containerID string) error {
	if deploymentID == "" {
		return errors.New(common.Translate(common.DefaultLang, "pkg.deployment_id_cannot_be_empty"))
	}
	if containerID == "" {
		return errors.New(common.Translate(common.DefaultLang, "pkg.container_id_cannot_be_empty"))
	}

	endpoint := fmt.Sprintf("/deployment/%s/container/%s/stop", deploymentID, containerID)

	_, err := c.makeRequest("POST", endpoint, nil)
	if err != nil {
		return fmt.Errorf(common.Translate(common.DefaultLang, "pkg.failed_to_stop_container"), err)
	}

	return nil
}

// ExecuteInContainer executes a command in a specific container (if supported by the API)
func (c *Client) ExecuteInContainer(deploymentID, containerID string, command []string) (string, error) {
	if deploymentID == "" {
		return "", errors.New(common.Translate(common.DefaultLang, "pkg.deployment_id_cannot_be_empty"))
	}
	if containerID == "" {
		return "", errors.New(common.Translate(common.DefaultLang, "pkg.container_id_cannot_be_empty"))
	}
	if len(command) == 0 {
		return "", errors.New(common.Translate(common.DefaultLang, "pkg.command_cannot_be_empty"))
	}

	reqBody := map[string]interface{}{
		"command": command,
	}

	endpoint := fmt.Sprintf("/deployment/%s/container/%s/exec", deploymentID, containerID)

	resp, err := c.makeRequest("POST", endpoint, reqBody)
	if err != nil {
		return "", fmt.Errorf(common.Translate(common.DefaultLang, "pkg.failed_to_execute_command_in_container"), err)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(resp.Body, &result); err != nil {
		return "", fmt.Errorf(common.Translate(common.DefaultLang, "pkg.failed_to_parse_execution_result"), err)
	}

	if output, ok := result["output"].(string); ok {
		return output, nil
	}

	return string(resp.Body), nil
}
