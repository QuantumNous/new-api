package controller

import "testing"

func TestIncludeAdminDetectHistoryStatusKeepsNotcomplete(t *testing.T) {
	if !includeAdminDetectHistoryStatus("notcomplete") {
		t.Fatal("admin channel-data should keep notcomplete history points")
	}
}

func TestIncludePublicDetectHistoryStatusHidesNotcomplete(t *testing.T) {
	if includePublicDetectHistoryStatus("notcomplete") {
		t.Fatal("public marketplace should still hide notcomplete history points")
	}
	if !includePublicDetectHistoryStatus("pass") {
		t.Fatal("public marketplace should keep pass history points")
	}
}
