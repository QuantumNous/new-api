package openai

import (
	"encoding/json"
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
)

func addBillingToUsageJSON(data []byte, billing *dto.ResponseBilling) ([]byte, error) {
	if billing == nil {
		return data, nil
	}

	var response map[string]json.RawMessage
	if err := common.Unmarshal(data, &response); err != nil {
		return nil, err
	}

	rawUsage, ok := response["usage"]
	if !ok || string(rawUsage) == "null" {
		rawUsage = []byte(`{}`)
	}
	var usage map[string]json.RawMessage
	if err := common.Unmarshal(rawUsage, &usage); err != nil {
		return nil, fmt.Errorf("decode response usage: %w", err)
	}

	rawBilling, err := common.Marshal(billing)
	if err != nil {
		return nil, err
	}
	usage["billing"] = rawBilling

	rawUsage, err = common.Marshal(usage)
	if err != nil {
		return nil, err
	}
	response["usage"] = rawUsage
	return common.Marshal(response)
}

func addBillingToResponsesEventJSON(data []byte, billing *dto.ResponseBilling) ([]byte, error) {
	if billing == nil {
		return data, nil
	}

	var event map[string]json.RawMessage
	if err := common.Unmarshal(data, &event); err != nil {
		return nil, err
	}
	rawResponse, ok := event["response"]
	if !ok || string(rawResponse) == "null" {
		return data, nil
	}

	enrichedResponse, err := addBillingToUsageJSON(rawResponse, billing)
	if err != nil {
		return nil, err
	}
	event["response"] = enrichedResponse
	return common.Marshal(event)
}
