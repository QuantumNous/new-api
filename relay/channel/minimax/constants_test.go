package minimax

import (
	"testing"
)

func TestModelListContainsM27(t *testing.T) {
	found := false
	for _, model := range ModelList {
		if model == "MiniMax-M2.7" {
			found = true
			break
		}
	}
	if !found {
		t.Error("ModelList should contain MiniMax-M2.7")
	}
}

func TestModelListContainsM27Highspeed(t *testing.T) {
	found := false
	for _, model := range ModelList {
		if model == "MiniMax-M2.7-highspeed" {
			found = true
			break
		}
	}
	if !found {
		t.Error("ModelList should contain MiniMax-M2.7-highspeed")
	}
}

func TestModelListM27BeforeOlderModels(t *testing.T) {
	m27Idx := -1
	m25Idx := -1
	m21Idx := -1
	for i, model := range ModelList {
		switch model {
		case "MiniMax-M2.7":
			m27Idx = i
		case "MiniMax-M2.5":
			m25Idx = i
		case "MiniMax-M2.1":
			m21Idx = i
		}
	}

	if m27Idx == -1 {
		t.Fatal("MiniMax-M2.7 not found in ModelList")
	}
	if m25Idx == -1 {
		t.Fatal("MiniMax-M2.5 not found in ModelList")
	}
	if m21Idx == -1 {
		t.Fatal("MiniMax-M2.1 not found in ModelList")
	}
	if m27Idx >= m25Idx {
		t.Errorf("MiniMax-M2.7 (index %d) should come before MiniMax-M2.5 (index %d)", m27Idx, m25Idx)
	}
	if m27Idx >= m21Idx {
		t.Errorf("MiniMax-M2.7 (index %d) should come before MiniMax-M2.1 (index %d)", m27Idx, m21Idx)
	}
}

func TestModelListPreservesOlderModels(t *testing.T) {
	requiredModels := []string{
		"MiniMax-M2.5",
		"MiniMax-M2.5-highspeed",
		"MiniMax-M2.1",
		"MiniMax-M2.1-highspeed",
		"MiniMax-M2",
	}

	modelSet := make(map[string]bool)
	for _, model := range ModelList {
		modelSet[model] = true
	}

	for _, required := range requiredModels {
		if !modelSet[required] {
			t.Errorf("ModelList should still contain %s", required)
		}
	}
}
