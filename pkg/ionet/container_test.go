package ionet

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

func TestListContainers(t *testing.T) {
	mockHTTPClient := &MockHTTPClient{}
	client := NewClientWithConfig("test-key", "https://api.test", mockHTTPClient)

	t.Run("Success", func(t *testing.T) {
		deploymentID := "dep-123"

		expectedContainers := []Container{
			{
				ID:     "cont-1",
				Status: "running",
				IP:     "10.0.0.1",
				Port:   80,
			},
			{
				ID:     "cont-2",
				Status: "running",
				IP:     "10.0.0.2",
				Port:   80,
			},
		}

		respBody, _ := json.Marshal(expectedContainers)
		httpResp := &HTTPResponse{
			StatusCode: 200,
			Body:       respBody,
		}

		mockHTTPClient.On("Do", mock.AnythingOfType("*ionet.HTTPRequest")).Return(httpResp, nil).Once()

		result, err := client.ListContainers(deploymentID)

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Len(t, result, 2)
		assert.Equal(t, "cont-1", result[0].ID)
		assert.Equal(t, "cont-2", result[1].ID)
		mockHTTPClient.AssertExpectations(t)
	})

	t.Run("EmptyDeploymentID", func(t *testing.T) {
		result, err := client.ListContainers("")
		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "deployment ID cannot be empty")
	})
}

func TestGetContainerDetails(t *testing.T) {
	mockHTTPClient := &MockHTTPClient{}
	client := NewClientWithConfig("test-key", "https://api.test", mockHTTPClient)

	t.Run("Success", func(t *testing.T) {
		deploymentID := "dep-123"
		containerID := "cont-456"

		now := time.Now()
		expectedContainer := &Container{
			ID:        containerID,
			Status:    "running",
			HostName:  "host1.io.net",
			IP:        "10.0.0.1",
			Port:      80,
			StartedAt: &now,
		}

		respBody, _ := json.Marshal(expectedContainer)
		httpResp := &HTTPResponse{
			StatusCode: 200,
			Body:       respBody,
		}

		mockHTTPClient.On("Do", mock.AnythingOfType("*ionet.HTTPRequest")).Return(httpResp, nil).Once()

		result, err := client.GetContainerDetails(deploymentID, containerID)

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, containerID, result.ID)
		assert.Equal(t, "running", result.Status)
		assert.Equal(t, "host1.io.net", result.HostName)
		mockHTTPClient.AssertExpectations(t)
	})

	t.Run("ValidationErrors", func(t *testing.T) {
		testCases := []struct {
			name         string
			deploymentID string
			containerID  string
		}{
			{"EmptyDeploymentID", "", "cont-123"},
			{"EmptyContainerID", "dep-123", ""},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				result, err := client.GetContainerDetails(tc.deploymentID, tc.containerID)
				assert.Error(t, err)
				assert.Nil(t, result)
			})
		}
	})
}

func TestGetContainerLogs(t *testing.T) {
	mockHTTPClient := &MockHTTPClient{}
	client := NewClientWithConfig("test-key", "https://api.test", mockHTTPClient)

	t.Run("Success", func(t *testing.T) {
		deploymentID := "dep-123"
		containerID := "cont-456"
		opts := &GetLogsOptions{
			Level: "info",
			Limit: 100,
		}

		expectedLogs := &ContainerLogs{
			ContainerID: containerID,
			Logs: []LogEntry{
				{
					Timestamp: time.Now(),
					Level:     "info",
					Message:   "Application started",
					Source:    "app",
				},
				{
					Timestamp: time.Now(),
					Level:     "error",
					Message:   "Connection failed",
					Source:    "network",
				},
			},
			HasMore:    false,
			NextCursor: "",
		}

		respBody, _ := json.Marshal(expectedLogs)
		httpResp := &HTTPResponse{
			StatusCode: 200,
			Body:       respBody,
		}

		mockHTTPClient.On("Do", mock.AnythingOfType("*ionet.HTTPRequest")).Return(httpResp, nil).Once()

		result, err := client.GetContainerLogs(deploymentID, containerID, opts)

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, containerID, result.ContainerID)
		assert.Len(t, result.Logs, 2)
		assert.Equal(t, "Application started", result.Logs[0].Message)
		assert.False(t, result.HasMore)
		mockHTTPClient.AssertExpectations(t)
	})

	t.Run("WithTimeRange", func(t *testing.T) {
		deploymentID := "dep-123"
		containerID := "cont-456"
		startTime := time.Now().Add(-1 * time.Hour)
		endTime := time.Now()

		opts := &GetLogsOptions{
			StartTime: &startTime,
			EndTime:   &endTime,
			Level:     "error",
			Limit:     50,
		}

		expectedLogs := &ContainerLogs{
			ContainerID: containerID,
			Logs:        []LogEntry{},
			HasMore:     false,
		}

		respBody, _ := json.Marshal(expectedLogs)
		httpResp := &HTTPResponse{
			StatusCode: 200,
			Body:       respBody,
		}

		mockHTTPClient.On("Do", mock.AnythingOfType("*ionet.HTTPRequest")).Return(httpResp, nil).Once()

		result, err := client.GetContainerLogs(deploymentID, containerID, opts)

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, containerID, result.ContainerID)
		mockHTTPClient.AssertExpectations(t)
	})

	t.Run("ValidationErrors", func(t *testing.T) {
		testCases := []struct {
			name         string
			deploymentID string
			containerID  string
		}{
			{"EmptyDeploymentID", "", "cont-123"},
			{"EmptyContainerID", "dep-123", ""},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				result, err := client.GetContainerLogs(tc.deploymentID, tc.containerID, nil)
				assert.Error(t, err)
				assert.Nil(t, result)
			})
		}
	})
}

func TestRestartContainer(t *testing.T) {
	mockHTTPClient := &MockHTTPClient{}
	client := NewClientWithConfig("test-key", "https://api.test", mockHTTPClient)

	t.Run("Success", func(t *testing.T) {
		deploymentID := "dep-123"
		containerID := "cont-456"

		httpResp := &HTTPResponse{
			StatusCode: 200,
			Body:       []byte(`{"message": "Container restarted successfully"}`),
		}

		mockHTTPClient.On("Do", mock.AnythingOfType("*ionet.HTTPRequest")).Return(httpResp, nil).Once()

		err := client.RestartContainer(deploymentID, containerID)

		assert.NoError(t, err)
		mockHTTPClient.AssertExpectations(t)
	})

	t.Run("ValidationErrors", func(t *testing.T) {
		testCases := []struct {
			name         string
			deploymentID string
			containerID  string
		}{
			{"EmptyDeploymentID", "", "cont-123"},
			{"EmptyContainerID", "dep-123", ""},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				err := client.RestartContainer(tc.deploymentID, tc.containerID)
				assert.Error(t, err)
			})
		}
	})
}

func TestStopContainer(t *testing.T) {
	mockHTTPClient := &MockHTTPClient{}
	client := NewClientWithConfig("test-key", "https://api.test", mockHTTPClient)

	t.Run("Success", func(t *testing.T) {
		deploymentID := "dep-123"
		containerID := "cont-456"

		httpResp := &HTTPResponse{
			StatusCode: 200,
			Body:       []byte(`{"message": "Container stopped successfully"}`),
		}

		mockHTTPClient.On("Do", mock.AnythingOfType("*ionet.HTTPRequest")).Return(httpResp, nil).Once()

		err := client.StopContainer(deploymentID, containerID)

		assert.NoError(t, err)
		mockHTTPClient.AssertExpectations(t)
	})

	t.Run("ValidationErrors", func(t *testing.T) {
		testCases := []struct {
			name         string
			deploymentID string
			containerID  string
		}{
			{"EmptyDeploymentID", "", "cont-123"},
			{"EmptyContainerID", "dep-123", ""},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				err := client.StopContainer(tc.deploymentID, tc.containerID)
				assert.Error(t, err)
			})
		}
	})
}

func TestExecuteInContainer(t *testing.T) {
	mockHTTPClient := &MockHTTPClient{}
	client := NewClientWithConfig("test-key", "https://api.test", mockHTTPClient)

	t.Run("Success", func(t *testing.T) {
		deploymentID := "dep-123"
		containerID := "cont-456"
		command := []string{"ls", "-la", "/app"}

		expectedOutput := "total 4\ndrwxr-xr-x 1 root root 4096 Jan  1 12:00 .\ndrwxr-xr-x 1 root root 4096 Jan  1 12:00 .."
		respBody := map[string]interface{}{
			"output":    expectedOutput,
			"exit_code": 0,
		}

		body, _ := json.Marshal(respBody)
		httpResp := &HTTPResponse{
			StatusCode: 200,
			Body:       body,
		}

		mockHTTPClient.On("Do", mock.AnythingOfType("*ionet.HTTPRequest")).Return(httpResp, nil).Once()

		result, err := client.ExecuteInContainer(deploymentID, containerID, command)

		assert.NoError(t, err)
		assert.Equal(t, expectedOutput, result)
		mockHTTPClient.AssertExpectations(t)
	})

	t.Run("ValidationErrors", func(t *testing.T) {
		testCases := []struct {
			name         string
			deploymentID string
			containerID  string
			command      []string
		}{
			{"EmptyDeploymentID", "", "cont-123", []string{"ls"}},
			{"EmptyContainerID", "dep-123", "", []string{"ls"}},
			{"EmptyCommand", "dep-123", "cont-123", []string{}},
			{"NilCommand", "dep-123", "cont-123", nil},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				result, err := client.ExecuteInContainer(tc.deploymentID, tc.containerID, tc.command)
				assert.Error(t, err)
				assert.Equal(t, "", result)
			})
		}
	})
}

func TestStreamContainerLogs(t *testing.T) {
	mockHTTPClient := &MockHTTPClient{}
	client := NewClientWithConfig("test-key", "https://api.test", mockHTTPClient)

	t.Run("Success", func(t *testing.T) {
		deploymentID := "dep-123"
		containerID := "cont-456"

		var receivedLogs []LogEntry
		callback := func(entry *LogEntry) error {
			receivedLogs = append(receivedLogs, *entry)
			return nil
		}

		// Mock response with no more logs to avoid infinite loop
		logs := &ContainerLogs{
			ContainerID: containerID,
			Logs: []LogEntry{
				{
					Timestamp: time.Now(),
					Level:     "info",
					Message:   "Streaming log entry",
					Source:    "app",
				},
			},
			HasMore:    false,
			NextCursor: "",
		}

		respBody, _ := json.Marshal(logs)
		httpResp := &HTTPResponse{
			StatusCode: 200,
			Body:       respBody,
		}

		mockHTTPClient.On("Do", mock.AnythingOfType("*ionet.HTTPRequest")).Return(httpResp, nil).Once()

		err := client.StreamContainerLogs(deploymentID, containerID, nil, callback)

		assert.NoError(t, err)
		assert.Len(t, receivedLogs, 1)
		assert.Equal(t, "Streaming log entry", receivedLogs[0].Message)
		mockHTTPClient.AssertExpectations(t)
	})

	t.Run("ValidationErrors", func(t *testing.T) {
		testCases := []struct {
			name         string
			deploymentID string
			containerID  string
			callback     func(*LogEntry) error
		}{
			{"EmptyDeploymentID", "", "cont-123", func(*LogEntry) error { return nil }},
			{"EmptyContainerID", "dep-123", "", func(*LogEntry) error { return nil }},
			{"NilCallback", "dep-123", "cont-123", nil},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				err := client.StreamContainerLogs(tc.deploymentID, tc.containerID, nil, tc.callback)
				assert.Error(t, err)
			})
		}
	})
}
