package setting

import "testing"

func TestValidateCustomNavItemsAcceptsEmptyValue(t *testing.T) {
	if err := ValidateCustomNavItems("  "); err != nil {
		t.Fatalf("expected empty value to be valid, got %v", err)
	}
}

func TestValidateCustomNavItemsAcceptsValidItem(t *testing.T) {
	raw := `[{"id":"docs","labels":{"en":"Docs"},"icon":"FiBook","placement":"both","sidebarSection":"general","contentType":"url","content":"https://example.com","enabled":true}]`
	if err := ValidateCustomNavItems(raw); err != nil {
		t.Fatalf("expected valid item, got %v", err)
	}
}

func TestValidateCustomNavItemsRejectsInvalidID(t *testing.T) {
	raw := `[{"id":"Docs Page","labels":{"en":"Docs"},"placement":"sidebar","sidebarSection":"general","contentType":"markdown","content":"hi"}]`
	if err := ValidateCustomNavItems(raw); err == nil {
		t.Fatal("expected invalid identifier to be rejected")
	}
}

func TestValidateCustomNavItemsRejectsDuplicateID(t *testing.T) {
	raw := `[{"id":"docs","labels":{"en":"A"},"placement":"sidebar","sidebarSection":"general","contentType":"markdown","content":"a"},` +
		`{"id":"docs","labels":{"en":"B"},"placement":"sidebar","sidebarSection":"general","contentType":"markdown","content":"b"}]`
	if err := ValidateCustomNavItems(raw); err == nil {
		t.Fatal("expected duplicate identifier to be rejected")
	}
}

func TestValidateCustomNavItemsRejectsMissingLabels(t *testing.T) {
	raw := `[{"id":"docs","labels":{"en":"   "},"placement":"sidebar","sidebarSection":"general","contentType":"markdown","content":"hi"}]`
	if err := ValidateCustomNavItems(raw); err == nil {
		t.Fatal("expected item without labels to be rejected")
	}
}

func TestValidateCustomNavItemsRejectsUnknownSection(t *testing.T) {
	raw := `[{"id":"docs","labels":{"en":"Docs"},"placement":"sidebar","sidebarSection":"secret","contentType":"markdown","content":"hi"}]`
	if err := ValidateCustomNavItems(raw); err == nil {
		t.Fatal("expected unknown sidebar category to be rejected")
	}
}

func TestValidateCustomNavItemsRejectsNonHttpURL(t *testing.T) {
	raw := `[{"id":"docs","labels":{"en":"Docs"},"placement":"sidebar","sidebarSection":"general","contentType":"url","content":"javascript:alert(1)"}]`
	if err := ValidateCustomNavItems(raw); err == nil {
		t.Fatal("expected non-http url to be rejected")
	}
}

func TestValidateCustomNavItemsRejectsEmptyContent(t *testing.T) {
	raw := `[{"id":"docs","labels":{"en":"Docs"},"placement":"sidebar","sidebarSection":"general","contentType":"markdown","content":"   "}]`
	if err := ValidateCustomNavItems(raw); err == nil {
		t.Fatal("expected empty content to be rejected")
	}
}
