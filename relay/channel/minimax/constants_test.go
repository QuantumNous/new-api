package minimax

import "testing"

func TestModelListContainsM3(t *testing.T) {
	found := false
	for _, model := range ModelList {
		if model == "MiniMax-M3" {
			found = true
			break
		}
	}
	if !found {
		t.Error("ModelList should contain MiniMax-M3")
	}
}

func TestModelListKeepsM27Variants(t *testing.T) {
	required := []string{
		"MiniMax-M2.7",
		"MiniMax-M2.7-highspeed",
	}

	set := make(map[string]bool, len(ModelList))
	for _, model := range ModelList {
		set[model] = true
	}

	for _, name := range required {
		if !set[name] {
			t.Errorf("ModelList should still contain %s", name)
		}
	}
}

func TestModelListM3IsDefault(t *testing.T) {
	if len(ModelList) == 0 {
		t.Fatal("ModelList is empty")
	}

	m3Idx := -1
	m27Idx := -1
	for i, model := range ModelList {
		switch model {
		case "MiniMax-M3":
			m3Idx = i
		case "MiniMax-M2.7":
			m27Idx = i
		}
	}

	if m3Idx == -1 {
		t.Fatal("MiniMax-M3 not found in ModelList")
	}
	if m27Idx == -1 {
		t.Fatal("MiniMax-M2.7 not found in ModelList")
	}
	if m3Idx >= m27Idx {
		t.Errorf("MiniMax-M3 (index %d) should come before MiniMax-M2.7 (index %d)", m3Idx, m27Idx)
	}
}

func TestModelListRemovesLegacyModels(t *testing.T) {
	removed := []string{
		"MiniMax-M2.5",
		"MiniMax-M2.5-highspeed",
		"MiniMax-M2.1",
		"MiniMax-M2.1-highspeed",
		"MiniMax-M2",
		"MiniMax-M1",
	}

	for _, model := range ModelList {
		for _, legacy := range removed {
			if model == legacy {
				t.Errorf("ModelList should not contain legacy model %s", legacy)
			}
		}
	}
}
