package middleware

import "testing"

func TestAuditResponseSuccessUsesBusinessSuccessField(t *testing.T) {
	if auditResponseSuccess(200, []byte(`{"success":false,"message":"validation failed"}`)) {
		t.Fatal("expected HTTP 200 response with success=false to count as a failure")
	}
	if !auditResponseSuccess(200, []byte(`{"success":true,"data":{}}`)) {
		t.Fatal("expected HTTP 200 response with success=true to count as a success")
	}
}
