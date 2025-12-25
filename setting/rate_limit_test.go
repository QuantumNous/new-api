package setting

import "testing"

func TestParseModelRequestRateLimitExemptUserIDs(t *testing.T) {
	t.Run("empty", func(t *testing.T) {
		ids, err := ParseModelRequestRateLimitExemptUserIDs("")
		if err != nil {
			t.Fatalf("expected nil error, got %v", err)
		}
		if len(ids) != 0 {
			t.Fatalf("expected empty map, got %v", ids)
		}
	})

	t.Run("comma and newline separated", func(t *testing.T) {
		ids, err := ParseModelRequestRateLimitExemptUserIDs("1,2\n3\r\n4\t5")
		if err != nil {
			t.Fatalf("expected nil error, got %v", err)
		}
		for _, want := range []int{1, 2, 3, 4, 5} {
			if _, ok := ids[want]; !ok {
				t.Fatalf("expected id %d to exist, got %v", want, ids)
			}
		}
	})

	t.Run("ignores non-positive", func(t *testing.T) {
		ids, err := ParseModelRequestRateLimitExemptUserIDs("0,-1,2")
		if err != nil {
			t.Fatalf("expected nil error, got %v", err)
		}
		if _, ok := ids[2]; !ok || len(ids) != 1 {
			t.Fatalf("expected only id 2, got %v", ids)
		}
	})

	t.Run("invalid token", func(t *testing.T) {
		_, err := ParseModelRequestRateLimitExemptUserIDs("1,abc")
		if err == nil {
			t.Fatalf("expected error, got nil")
		}
	})
}

func TestIsModelRequestRateLimitExemptUser(t *testing.T) {
	if err := UpdateModelRequestRateLimitExemptUserIDs("10,20"); err != nil {
		t.Fatalf("UpdateModelRequestRateLimitExemptUserIDs error: %v", err)
	}

	if !IsModelRequestRateLimitExemptUser(10) {
		t.Fatalf("expected user 10 to be exempt")
	}
	if IsModelRequestRateLimitExemptUser(11) {
		t.Fatalf("expected user 11 to not be exempt")
	}
}