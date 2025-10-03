package ionet

import (
	"encoding/json"
	"fmt"
	"net/url"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockHTTPClient is a mock implementation of HTTPClient for testing
type MockHTTPClient struct {
	mock.Mock
}

func (m *MockHTTPClient) Do(req *HTTPRequest) (*HTTPResponse, error) {
	args := m.Called(req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*HTTPResponse), args.Error(1)
}

func TestNewClient(t *testing.T) {
	apiKey := "test-api-key"
	client := NewEnterpriseClient(apiKey)

	assert.NotNil(t, client)
	assert.Equal(t, apiKey, client.APIKey)
	assert.Equal(t, DefaultEnterpriseBaseURL, client.BaseURL)
	assert.NotNil(t, client.HTTPClient)
}

func TestNewClientWithConfig(t *testing.T) {
	apiKey := "test-api-key"
	baseURL := "https://custom.api.url"
	mockHTTPClient := &MockHTTPClient{}

	client := NewClientWithConfig(apiKey, baseURL, mockHTTPClient)

	assert.NotNil(t, client)
	assert.Equal(t, apiKey, client.APIKey)
	assert.Equal(t, baseURL, client.BaseURL)
	assert.Equal(t, mockHTTPClient, client.HTTPClient)
}

func TestClientMakeRequest(t *testing.T) {
	mockHTTPClient := &MockHTTPClient{}
	client := NewClientWithConfig("test-key", "https://api.test", mockHTTPClient)

	// Test successful request
	t.Run("Success", func(t *testing.T) {
		expectedResp := &HTTPResponse{
			StatusCode: 200,
			Headers:    map[string]string{"Content-Type": "application/json"},
			Body:       []byte(`{"success": true}`),
		}

		mockHTTPClient.On("Do", mock.AnythingOfType("*ionet.HTTPRequest")).Return(expectedResp, nil).Once()

		resp, err := client.makeRequest("GET", "/test", nil)

		assert.NoError(t, err)
		assert.Equal(t, expectedResp, resp)
		mockHTTPClient.AssertExpectations(t)
	})

	// Test API error response
	t.Run("APIError", func(t *testing.T) {
		errorResp := &HTTPResponse{
			StatusCode: 400,
			Headers:    map[string]string{"Content-Type": "application/json"},
			Body:       []byte(`{"code": 400, "message": "Bad Request", "details": "Invalid parameters"}`),
		}

		mockHTTPClient.On("Do", mock.AnythingOfType("*ionet.HTTPRequest")).Return(errorResp, nil).Once()

		resp, err := client.makeRequest("GET", "/test", nil)

		assert.Nil(t, resp)
		assert.Error(t, err)

		apiErr, ok := err.(*APIError)
		assert.True(t, ok)
		assert.Equal(t, 400, apiErr.Code)
		assert.Equal(t, "Bad Request", apiErr.Message)
		assert.Equal(t, "Invalid parameters", apiErr.Details)

		mockHTTPClient.AssertExpectations(t)
	})

	// Test HTTP client error
	t.Run("HTTPError", func(t *testing.T) {
		mockHTTPClient.On("Do", mock.AnythingOfType("*ionet.HTTPRequest")).Return(nil, fmt.Errorf("network error")).Once()

		resp, err := client.makeRequest("GET", "/test", nil)

		assert.Nil(t, resp)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "request failed")

		mockHTTPClient.AssertExpectations(t)
	})
}

func TestClientMakeRequestWithBody(t *testing.T) {
	mockHTTPClient := &MockHTTPClient{}
	client := NewClientWithConfig("test-key", "https://api.test", mockHTTPClient)

	testBody := map[string]interface{}{
		"name":  "test",
		"value": 123,
	}

	expectedResp := &HTTPResponse{
		StatusCode: 201,
		Headers:    map[string]string{"Content-Type": "application/json"},
		Body:       []byte(`{"id": "12345"}`),
	}

	// Verify that the request contains the correct serialized body
	mockHTTPClient.On("Do", mock.MatchedBy(func(req *HTTPRequest) bool {
		var reqBody map[string]interface{}
		err := json.Unmarshal(req.Body, &reqBody)
		if err != nil {
			return false
		}
		return reqBody["name"] == "test" && reqBody["value"] == float64(123)
	})).Return(expectedResp, nil).Once()

	resp, err := client.makeRequest("POST", "/test", testBody)

	assert.NoError(t, err)
	assert.Equal(t, expectedResp, resp)
	mockHTTPClient.AssertExpectations(t)
}

func TestGetPriceEstimationBuildsRequiredQueryParams(t *testing.T) {
	mockHTTPClient := &MockHTTPClient{}
	client := NewClientWithConfig("test-key", "https://api.test", mockHTTPClient)

	req := &PriceEstimationRequest{
		LocationIDs:      []int{1, 2},
		HardwareID:       42,
		GPUsPerContainer: 2,
		DurationHours:    3,
		ReplicaCount:     1,
	}

	responseBody := []byte(`{"data":{"replica_count":1,"gpus_per_container":2,"available_replica_count":[1],"discount":0,"ionet_fee":0.1,"ionet_fee_percent":1.5,"currency_conversion_fee":0.2,"currency_conversion_fee_percent":2.0,"total_cost_usdc":12.0}}`)

	mockHTTPClient.On("Do", mock.MatchedBy(func(r *HTTPRequest) bool {
		if r == nil {
			return false
		}
		parsed, err := url.Parse(r.URL)
		if err != nil {
			return false
		}
		params := parsed.Query()
		return r.Method == "GET" &&
			parsed.Path == "/price" &&
			params.Get("currency") == "usdc" &&
			params.Get("duration_type") == "hourly" &&
			params.Get("duration_qty") == "3" &&
			params.Get("hardware_qty") == "2" &&
			params.Get("gpus_per_container") == "2" &&
			params.Get("duration_hours") == "3" &&
			params.Get("location_ids") == "[1,2]" &&
			params.Get("replica_count") == "1"
	})).Return(&HTTPResponse{StatusCode: 200, Body: responseBody}, nil).Once()

	result, err := client.GetPriceEstimation(req)
	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, 12.0, result.EstimatedCost)
	assert.Equal(t, "USDC", result.Currency)
	assert.InDelta(t, 4.0, result.PriceBreakdown.HourlyRate, 1e-9)
	assert.True(t, result.EstimationValid)

	mockHTTPClient.AssertExpectations(t)
}

func TestGetPriceEstimationNormalizesDurationType(t *testing.T) {
	mockHTTPClient := &MockHTTPClient{}
	client := NewClientWithConfig("test-key", "https://api.test", mockHTTPClient)

	req := &PriceEstimationRequest{
		LocationIDs:      []int{3},
		HardwareID:       99,
		GPUsPerContainer: 1,
		DurationHours:    0,
		DurationQty:      2,
		DurationType:     "Days",
		ReplicaCount:     2,
	}

	responseBody := []byte(`{"data":{"replica_count":2,"gpus_per_container":1,"available_replica_count":[2],"discount":0,"ionet_fee":0,"ionet_fee_percent":0,"currency_conversion_fee":0,"currency_conversion_fee_percent":0,"total_cost_usdc":48.0}}`)

	mockHTTPClient.On("Do", mock.MatchedBy(func(r *HTTPRequest) bool {
		if r == nil {
			return false
		}
		parsed, err := url.Parse(r.URL)
		if err != nil {
			return false
		}
		params := parsed.Query()
		return params.Get("duration_type") == "daily" && params.Get("duration_qty") == "2"
	})).Return(&HTTPResponse{StatusCode: 200, Body: responseBody}, nil).Once()

	result, err := client.GetPriceEstimation(req)
	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, 48.0, result.PriceBreakdown.TotalCost)
	mockHTTPClient.AssertExpectations(t)
}

func TestBuildQueryParams(t *testing.T) {
	t.Run("EmptyParams", func(t *testing.T) {
		result := buildQueryParams(map[string]interface{}{})
		assert.Equal(t, "", result)
	})

	t.Run("SingleParam", func(t *testing.T) {
		result := buildQueryParams(map[string]interface{}{
			"key": "value",
		})
		assert.Equal(t, "?key=value", result)
	})

	t.Run("MultipleParams", func(t *testing.T) {
		result := buildQueryParams(map[string]interface{}{
			"string_param": "test",
			"int_param":    123,
			"bool_param":   true,
		})
		assert.Contains(t, result, "string_param=test")
		assert.Contains(t, result, "int_param=123")
		assert.Contains(t, result, "bool_param=true")
		assert.True(t, len(result) > 1)
		assert.Equal(t, "?", string(result[0]))
	})

	t.Run("TimeParam", func(t *testing.T) {
		testTime := time.Date(2023, 1, 1, 12, 0, 0, 0, time.UTC)
		result := buildQueryParams(map[string]interface{}{
			"time_param": testTime,
		})
		expected := "?time_param=" + testTime.Format(time.RFC3339)
		assert.Equal(t, expected, result)
	})

	t.Run("ZeroValues", func(t *testing.T) {
		result := buildQueryParams(map[string]interface{}{
			"empty_string": "",
			"zero_int":     0,
			"nil_value":    nil,
		})
		// Zero values and nils should be excluded
		assert.Equal(t, "", result)
	})
}

func TestAPIError(t *testing.T) {
	t.Run("WithDetails", func(t *testing.T) {
		err := &APIError{
			Code:    400,
			Message: "Bad Request",
			Details: "Invalid field 'name'",
		}

		expected := "Bad Request: Invalid field 'name'"
		assert.Equal(t, expected, err.Error())
	})

	t.Run("WithoutDetails", func(t *testing.T) {
		err := &APIError{
			Code:    500,
			Message: "Internal Server Error",
		}

		expected := "Internal Server Error"
		assert.Equal(t, expected, err.Error())
	})
}
