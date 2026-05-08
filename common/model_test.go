package common

import "testing"

func TestGPTImage2ModelsAreImageGenerationModels(t *testing.T) {
	for _, model := range []string{"gpt-image-2", "codex-gpt-image-2"} {
		if !IsImageGenerationModel(model) {
			t.Fatalf("IsImageGenerationModel(%q) = false, want true", model)
		}
	}
}

func TestTextGPTModelsAreNotImageGenerationModels(t *testing.T) {
	for _, model := range []string{"gpt-5", "gpt-5.5"} {
		if IsImageGenerationModel(model) {
			t.Fatalf("IsImageGenerationModel(%q) = true, want false", model)
		}
	}
}
