package ionet

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

func TestDeployContainer(t *testing.T) {
	mockHTTPClient := &MockHTTPClient{}
	client := NewClientWithConfig("test-key", "https://api.test", mockHTTPClient)

	t.Run("Success", func(t *testing.T) {
		req := &DeploymentRequest{
			LocationID:  "loc-123",
			HardwareID:  "hw-456",
			GPUCount:    2,
			Image:       "nginx:latest",
			Port:        80,
			Duration:    60,
			Replicas:    1,
			Name:        "test-deployment",
			Description: "Test deployment",
			Environment: map[string]string{"ENV": "test"},
		}

		expectedResp := &DeploymentResponse{
			DeploymentID:  "dep-789",
			Status:        "pending",
			Message:       "Deployment created successfully",
			CreatedAt:     time.Now(),
			EstimatedCost: 1.50,
		}

		respBody, _ := json.Marshal(expectedResp)
		httpResp := &HTTPResponse{
			StatusCode: 201,
			Body:       respBody,
		}

		mockHTTPClient.On("Do", mock.AnythingOfType("*ionet.HTTPRequest")).Return(httpResp, nil).Once()

		result, err := client.DeployContainer(req)

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, expectedResp.DeploymentID, result.DeploymentID)
		assert.Equal(t, expectedResp.Status, result.Status)
		mockHTTPClient.AssertExpectations(t)
	})

	t.Run("ValidationErrors", func(t *testing.T) {
		testCases := []struct {
			name string
			req  *DeploymentRequest
		}{
			{"NilRequest", nil},
			{"EmptyLocationID", &DeploymentRequest{HardwareID: "hw-1", Image: "test", GPUCount: 1, Duration: 60, Replicas: 1}},
			{"EmptyHardwareID", &DeploymentRequest{LocationID: "loc-1", Image: "test", GPUCount: 1, Duration: 60, Replicas: 1}},
			{"EmptyImage", &DeploymentRequest{LocationID: "loc-1", HardwareID: "hw-1", GPUCount: 1, Duration: 60, Replicas: 1}},
			{"ZeroGPUCount", &DeploymentRequest{LocationID: "loc-1", HardwareID: "hw-1", Image: "test", Duration: 60, Replicas: 1}},
			{"ZeroDuration", &DeploymentRequest{LocationID: "loc-1", HardwareID: "hw-1", Image: "test", GPUCount: 1, Replicas: 1}},
			{"ZeroReplicas", &DeploymentRequest{LocationID: "loc-1", HardwareID: "hw-1", Image: "test", GPUCount: 1, Duration: 60}},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				result, err := client.DeployContainer(tc.req)
				assert.Error(t, err)
				assert.Nil(t, result)
			})
		}
	})
}

func TestListDeployments(t *testing.T) {
	mockHTTPClient := &MockHTTPClient{}
	client := NewClientWithConfig("test-key", "https://api.test", mockHTTPClient)

	t.Run("Success", func(t *testing.T) {
		opts := &ListDeploymentsOptions{
			Status:     "running",
			LocationID: "loc-123",
			Page:       1,
			PageSize:   10,
		}

		expectedResp := &DeploymentList{
			Deployments: []Deployment{
				{
					ID:         "dep-1",
					Name:       "deployment-1",
					Status:     "running",
					LocationID: "loc-123",
					HardwareID: "hw-456",
					GPUCount:   2,
					Replicas:   1,
					CreatedAt:  time.Now(),
				},
			},
			Total:    1,
			Page:     1,
			PageSize: 10,
		}

		respBody, _ := json.Marshal(expectedResp)
		httpResp := &HTTPResponse{
			StatusCode: 200,
			Body:       respBody,
		}

		mockHTTPClient.On("Do", mock.AnythingOfType("*ionet.HTTPRequest")).Return(httpResp, nil).Once()

		result, err := client.ListDeployments(opts)

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Len(t, result.Deployments, 1)
		assert.Equal(t, "dep-1", result.Deployments[0].ID)
		mockHTTPClient.AssertExpectations(t)
	})

	t.Run("NoOptions", func(t *testing.T) {
		expectedResp := &DeploymentList{
			Deployments: []Deployment{},
			Total:       0,
		}

		respBody, _ := json.Marshal(expectedResp)
		httpResp := &HTTPResponse{
			StatusCode: 200,
			Body:       respBody,
		}

		mockHTTPClient.On("Do", mock.AnythingOfType("*ionet.HTTPRequest")).Return(httpResp, nil).Once()

		result, err := client.ListDeployments(nil)

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Len(t, result.Deployments, 0)
		mockHTTPClient.AssertExpectations(t)
	})
}

func TestGetDeployment(t *testing.T) {
	mockHTTPClient := &MockHTTPClient{}
	client := NewClientWithConfig("test-key", "https://api.test", mockHTTPClient)

	t.Run("Success", func(t *testing.T) {
		deploymentID := "dep-123"

		expectedResp := &DeploymentDetail{
			ID:          deploymentID,
			Name:        "test-deployment",
			Status:      "running",
			LocationID:  "loc-456",
			HardwareID:  "hw-789",
			GPUCount:    2,
			Image:       "nginx:latest",
			Port:        80,
			Environment: map[string]string{"ENV": "production"},
			Duration:    120,
			Replicas:    2,
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
			Containers: []Container{
				{
					ID:     "cont-1",
					Status: "running",
					IP:     "10.0.0.1",
					Port:   80,
				},
			},
		}

		respBody, _ := json.Marshal(expectedResp)
		httpResp := &HTTPResponse{
			StatusCode: 200,
			Body:       respBody,
		}

		mockHTTPClient.On("Do", mock.AnythingOfType("*ionet.HTTPRequest")).Return(httpResp, nil).Once()

		result, err := client.GetDeployment(deploymentID)

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, deploymentID, result.ID)
		assert.Equal(t, "test-deployment", result.Name)
		assert.Len(t, result.Containers, 1)
		mockHTTPClient.AssertExpectations(t)
	})

	t.Run("EmptyID", func(t *testing.T) {
		result, err := client.GetDeployment("")
		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "deployment ID cannot be empty")
	})
}

func TestUpdateDeployment(t *testing.T) {
	mockHTTPClient := &MockHTTPClient{}
	client := NewClientWithConfig("test-key", "https://api.test", mockHTTPClient)

	t.Run("Success", func(t *testing.T) {
		deploymentID := "dep-123"
		duration := 180
		replicas := 3
		updateReq := &UpdateDeploymentRequest{
			Duration: &duration,
			Replicas: &replicas,
		}

		expectedResp := &DeploymentDetail{
			ID:       deploymentID,
			Duration: 180,
			Replicas: 3,
			Status:   "running",
		}

		respBody, _ := json.Marshal(expectedResp)
		httpResp := &HTTPResponse{
			StatusCode: 200,
			Body:       respBody,
		}

		mockHTTPClient.On("Do", mock.AnythingOfType("*ionet.HTTPRequest")).Return(httpResp, nil).Once()

		result, err := client.UpdateDeployment(deploymentID, updateReq)

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, deploymentID, result.ID)
		assert.Equal(t, 180, result.Duration)
		assert.Equal(t, 3, result.Replicas)
		mockHTTPClient.AssertExpectations(t)
	})

	t.Run("ValidationErrors", func(t *testing.T) {
		testCases := []struct {
			name         string
			deploymentID string
			req          *UpdateDeploymentRequest
		}{
			{"EmptyID", "", &UpdateDeploymentRequest{}},
			{"NilRequest", "dep-123", nil},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				result, err := client.UpdateDeployment(tc.deploymentID, tc.req)
				assert.Error(t, err)
				assert.Nil(t, result)
			})
		}
	})
}

func TestExtendDeployment(t *testing.T) {
	mockHTTPClient := &MockHTTPClient{}
	client := NewClientWithConfig("test-key", "https://api.test", mockHTTPClient)

	t.Run("Success", func(t *testing.T) {
		deploymentID := "dep-123"
		extendReq := &ExtendDurationRequest{
			AdditionalMinutes: 60,
		}

		expectedResp := &DeploymentDetail{
			ID:       deploymentID,
			Duration: 180, // original + extended
			Status:   "running",
		}

		respBody, _ := json.Marshal(expectedResp)
		httpResp := &HTTPResponse{
			StatusCode: 200,
			Body:       respBody,
		}

		mockHTTPClient.On("Do", mock.AnythingOfType("*ionet.HTTPRequest")).Return(httpResp, nil).Once()

		result, err := client.ExtendDeployment(deploymentID, extendReq)

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, deploymentID, result.ID)
		mockHTTPClient.AssertExpectations(t)
	})

	t.Run("ValidationErrors", func(t *testing.T) {
		testCases := []struct {
			name         string
			deploymentID string
			req          *ExtendDurationRequest
		}{
			{"EmptyID", "", &ExtendDurationRequest{AdditionalMinutes: 60}},
			{"NilRequest", "dep-123", nil},
			{"ZeroMinutes", "dep-123", &ExtendDurationRequest{AdditionalMinutes: 0}},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				result, err := client.ExtendDeployment(tc.deploymentID, tc.req)
				assert.Error(t, err)
				assert.Nil(t, result)
			})
		}
	})
}

func TestTerminateDeployment(t *testing.T) {
	mockHTTPClient := &MockHTTPClient{}
	client := NewClientWithConfig("test-key", "https://api.test", mockHTTPClient)

	t.Run("Success", func(t *testing.T) {
		deploymentID := "dep-123"

		httpResp := &HTTPResponse{
			StatusCode: 200,
			Body:       []byte(`{"message": "Deployment terminated successfully"}`),
		}

		mockHTTPClient.On("Do", mock.AnythingOfType("*ionet.HTTPRequest")).Return(httpResp, nil).Once()

		err := client.TerminateDeployment(deploymentID)

		assert.NoError(t, err)
		mockHTTPClient.AssertExpectations(t)
	})

	t.Run("EmptyID", func(t *testing.T) {
		err := client.TerminateDeployment("")
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "deployment ID cannot be empty")
	})
}

func TestGetPriceEstimation(t *testing.T) {
	mockHTTPClient := &MockHTTPClient{}
	client := NewClientWithConfig("test-key", "https://api.test", mockHTTPClient)

	t.Run("Success", func(t *testing.T) {
		req := &PriceEstimationRequest{
			LocationID: "loc-123",
			HardwareID: "hw-456",
			GPUCount:   2,
			Duration:   60,
			Replicas:   1,
		}

		expectedResp := &PriceEstimationResponse{
			EstimatedCost: 2.50,
			Currency:      "USD",
			PriceBreakdown: PriceBreakdown{
				ComputeCost: 2.00,
				NetworkCost: 0.30,
				StorageCost: 0.20,
				TotalCost:   2.50,
				HourlyRate:  2.50,
			},
			EstimationValid: true,
		}

		respBody, _ := json.Marshal(expectedResp)
		httpResp := &HTTPResponse{
			StatusCode: 200,
			Body:       respBody,
		}

		mockHTTPClient.On("Do", mock.AnythingOfType("*ionet.HTTPRequest")).Return(httpResp, nil).Once()

		result, err := client.GetPriceEstimation(req)

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, 2.50, result.EstimatedCost)
		assert.Equal(t, "USD", result.Currency)
		assert.True(t, result.EstimationValid)
		mockHTTPClient.AssertExpectations(t)
	})

	t.Run("ValidationErrors", func(t *testing.T) {
		testCases := []struct {
			name string
			req  *PriceEstimationRequest
		}{
			{"NilRequest", nil},
			{"EmptyLocationID", &PriceEstimationRequest{HardwareID: "hw-1", GPUCount: 1, Duration: 60, Replicas: 1}},
			{"EmptyHardwareID", &PriceEstimationRequest{LocationID: "loc-1", GPUCount: 1, Duration: 60, Replicas: 1}},
			{"ZeroGPUCount", &PriceEstimationRequest{LocationID: "loc-1", HardwareID: "hw-1", Duration: 60, Replicas: 1}},
			{"ZeroDuration", &PriceEstimationRequest{LocationID: "loc-1", HardwareID: "hw-1", GPUCount: 1, Replicas: 1}},
			{"ZeroReplicas", &PriceEstimationRequest{LocationID: "loc-1", HardwareID: "hw-1", GPUCount: 1, Duration: 60}},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				result, err := client.GetPriceEstimation(tc.req)
				assert.Error(t, err)
				assert.Nil(t, result)
			})
		}
	})
}
