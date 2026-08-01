package common

import "testing"

func TestGetEnvOrDefaultTrimsWhitespace(t *testing.T) {
	t.Setenv("NEW_API_TEST_INT", " 42 \n")

	if got := GetEnvOrDefault("NEW_API_TEST_INT", 7); got != 42 {
		t.Fatalf("GetEnvOrDefault() = %d, want 42", got)
	}
}

func TestGetEnvOrDefaultWhitespaceUsesDefault(t *testing.T) {
	t.Setenv("NEW_API_TEST_INT_EMPTY", " \t\n")

	if got := GetEnvOrDefault("NEW_API_TEST_INT_EMPTY", 7); got != 7 {
		t.Fatalf("GetEnvOrDefault() = %d, want default 7", got)
	}
}

func TestGetEnvOrDefaultBoolTrimsWhitespace(t *testing.T) {
	t.Setenv("NEW_API_TEST_BOOL", " true \n")

	if got := GetEnvOrDefaultBool("NEW_API_TEST_BOOL", false); !got {
		t.Fatalf("GetEnvOrDefaultBool() = false, want true")
	}
}
