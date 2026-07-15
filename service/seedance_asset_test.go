package service

import (
	"net/http"
	"testing"
)

func TestAssertGroupUsableEmptyGroup(t *testing.T) {
	if err := AssertGroupUsable(1, ""); err != nil {
		t.Fatalf("empty group should be allowed: %v", err)
	}
	if err := AssertGroupUsable(1, "   "); err != nil {
		t.Fatalf("blank group should be allowed: %v", err)
	}
}

func TestSeedanceAssetError(t *testing.T) {
	err := newSeedanceErr(http.StatusForbidden, "group_forbidden", "素材组不存在或无权使用")
	if err.Error() != "素材组不存在或无权使用" {
		t.Fatalf("unexpected message: %s", err.Error())
	}
	if err.Code != "group_forbidden" || err.Status != 403 {
		t.Fatalf("unexpected code/status: %+v", err)
	}
}

func TestMaybeChargeSeedanceAssetOpNoop(t *testing.T) {
	if err := MaybeChargeSeedanceAssetOp(1, "create_asset"); err != nil {
		t.Fatalf("billing hook should be noop: %v", err)
	}
}
