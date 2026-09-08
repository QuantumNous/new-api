package model

import "testing"

func TestDefaultVendorMappingDistinguishesMuseSparkFromIFlytek(t *testing.T) {
	metaMap := make(map[string]*Model)
	vendorMap := map[int]*Vendor{
		1: {Id: 1, Name: "Meta"},
		2: {Id: 2, Name: "讯飞"},
	}
	abilities := []AbilityWithChannel{
		{Ability: Ability{Model: "muse-spark-1.2-contributor"}},
		{Ability: Ability{Model: "sparkdesk-v4.0"}},
		{Ability: Ability{Model: "iflytek-spark-x1"}},
		{Ability: Ability{Model: "custom-spark-model"}},
	}

	initDefaultVendorMapping(metaMap, vendorMap, abilities)

	tests := []struct {
		model    string
		vendorID int
	}{
		{model: "muse-spark-1.2-contributor", vendorID: 1},
		{model: "sparkdesk-v4.0", vendorID: 2},
		{model: "iflytek-spark-x1", vendorID: 2},
		{model: "custom-spark-model", vendorID: 0},
	}
	for _, tt := range tests {
		if got := metaMap[tt.model].VendorID; got != tt.vendorID {
			t.Fatalf("model %q vendor id = %d, want %d", tt.model, got, tt.vendorID)
		}
	}

	if got := getDefaultVendorIcon("Meta"); got != "Meta.Color" {
		t.Fatalf("Meta icon = %q, want %q", got, "Meta.Color")
	}
}
