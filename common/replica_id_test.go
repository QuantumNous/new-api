package common

import "testing"

func TestReplicaID_StableAcrossCalls(t *testing.T) {
	first := GetReplicaID()
	second := GetReplicaID()
	if first == "" {
		t.Fatal("ReplicaID is empty")
	}
	if first != second {
		t.Errorf("ReplicaID not stable: %q vs %q", first, second)
	}
}

func TestReplicaID_LooksLikeUUID(t *testing.T) {
	id := GetReplicaID()
	if len(id) != 36 {
		t.Errorf("ReplicaID length = %d, want 36 (UUID v4 format), id=%q", len(id), id)
	}
}
