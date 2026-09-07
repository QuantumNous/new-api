package service

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
)

func TestBuildSchedulerCatalogFromChannelsIsCredentialFreeAndExpandsKeys(t *testing.T) {
	priority := int64(7)
	weight := uint(3)
	channel := &model.Channel{
		Id:             42,
		Type:           constant.ChannelTypeOpenAI,
		Key:            "secret-one\nsecret-two",
		Status:         common.ChannelStatusEnabled,
		Models:         "deepseek-v4-flash,alias-model",
		Group:          "default,paid",
		Priority:       &priority,
		Weight:         &weight,
		RPM:            120,
		TPM:            90000,
		MaxConcurrency: 20,
		ChannelInfo: model.ChannelInfo{
			IsMultiKey:         true,
			MultiKeyStatusList: map[int]int{1: common.ChannelStatusManuallyDisabled},
		},
	}

	catalog, err := BuildSchedulerCatalogFromChannels("deepseek-v4-flash", []*model.Channel{channel})
	if err != nil {
		t.Fatal(err)
	}
	if len(catalog.Endpoints) != 2 || catalog.Version == "" {
		t.Fatalf("catalog=%+v", catalog)
	}
	if catalog.Endpoints[0].EndpointID != "new-api-ch-42-k0" || catalog.Endpoints[1].EndpointID != "new-api-ch-42-k1" {
		t.Fatalf("unexpected endpoint ids: %+v", catalog.Endpoints)
	}
	if !catalog.Endpoints[0].Enabled || catalog.Endpoints[1].Enabled {
		t.Fatalf("key status was not projected: %+v", catalog.Endpoints)
	}
	data := string(mustJSON(t, catalog))
	if strings.Contains(data, "secret-one") || strings.Contains(data, "secret-two") || strings.Contains(data, "base_url") {
		t.Fatalf("catalog leaked credential/configuration: %s", data)
	}
	if catalog.Endpoints[0].Provider != constant.GetChannelTypeName(constant.ChannelTypeOpenAI) || catalog.Endpoints[0].Priority != priority || catalog.Endpoints[0].Weight != int64(weight) {
		t.Fatalf("channel metadata mismatch: %+v", catalog.Endpoints[0])
	}
	if catalog.Endpoints[0].Limits.RPM != 120 || catalog.Endpoints[0].Limits.TPM != 90000 || catalog.Endpoints[0].Limits.MaxConcurrency != 20 {
		t.Fatalf("channel capacity mismatch: %+v", catalog.Endpoints[0].Limits)
	}
}

func TestBuildSchedulerCatalogIncludesModelMappingSourceAlias(t *testing.T) {
	mapping := `{"customer-model":"deepseek-v4-flash"}`
	channel := &model.Channel{Id: 9, Type: constant.ChannelTypeOpenAI, Key: "secret", Status: common.ChannelStatusEnabled, Models: "deepseek-v4-flash", ModelMapping: &mapping}
	catalog, err := BuildSchedulerCatalogFromChannels("customer-model", []*model.Channel{channel})
	if err != nil {
		t.Fatal(err)
	}
	if len(catalog.Endpoints) != 1 || catalog.Endpoints[0].Model != "customer-model" {
		t.Fatalf("mapping alias was not exposed: %+v", catalog)
	}
}

func TestBuildSchedulerCatalogRejectsUnknownModel(t *testing.T) {
	channel := &model.Channel{Id: 1, Type: constant.ChannelTypeOpenAI, Key: "secret", Status: common.ChannelStatusEnabled, Models: "other-model"}
	if _, err := BuildSchedulerCatalogFromChannels("missing-model", []*model.Channel{channel}); err == nil {
		t.Fatal("expected unknown model error")
	}
}

func mustJSON(t *testing.T, value any) []byte {
	t.Helper()
	data, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	return data
}
