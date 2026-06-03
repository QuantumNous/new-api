package model

import "testing"

func TestSearchModelsFiltersByModelType(t *testing.T) {
	setupModelTypeTestDB(t)

	models := []*Model{
		{ModelName: "chat-model", ModelType: ModelTypeText, Status: 1},
		{ModelName: "image-model", ModelType: ModelTypeImage, Status: 1},
	}
	for _, m := range models {
		if err := m.Insert(); err != nil {
			t.Fatalf("insert %s: %v", m.ModelName, err)
		}
	}

	got, total, err := SearchModels("", "", ModelTypeImage, 0, 10)
	if err != nil {
		t.Fatalf("SearchModels returned error: %v", err)
	}
	if total != 1 || len(got) != 1 || got[0].ModelName != "image-model" {
		t.Fatalf("SearchModels image filter got total=%d models=%+v", total, got)
	}
}
