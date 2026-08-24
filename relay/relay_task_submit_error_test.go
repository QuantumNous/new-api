package relay

import (
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
)

func TestTaskSubmitStatusErrorScrubsBytePlusNonOKBody(t *testing.T) {
	resp := &http.Response{
		StatusCode: http.StatusBadGateway,
		Body: io.NopCloser(strings.NewReader(
			`{"error":"BytePlus bytepluses.com endpoint ep-test-secret rejected"}`)),
	}

	taskErr := taskSubmitStatusError(constant.TaskPlatform("107"), resp)
	if taskErr == nil {
		t.Fatal("expected task submit status error")
	}
	for _, marker := range []string{"bytepluses.com", "BytePlus", "ep-test-secret"} {
		if strings.Contains(taskErrorText(taskErr), marker) {
			t.Fatalf("non-200 submit error leaked %q in %q", marker, taskErrorText(taskErr))
		}
	}
}

func TestTaskSubmitStatusErrorScrubsBytePlusRawNonOKBodyWithoutBrandMarkers(t *testing.T) {
	const rawSentinel = "upstream-json-shape-sentinel"
	resp := &http.Response{
		StatusCode: http.StatusTooManyRequests,
		Body: io.NopCloser(strings.NewReader(
			`{"error":{"message":"` + rawSentinel + `","retry_after":30}}`)),
	}

	taskErr := taskSubmitStatusError(constant.TaskPlatform("107"), resp)
	if taskErr == nil {
		t.Fatal("expected task submit status error")
	}
	if taskErr.StatusCode != http.StatusTooManyRequests {
		t.Fatalf("status = %d, want %d", taskErr.StatusCode, http.StatusTooManyRequests)
	}
	if strings.Contains(taskErrorText(taskErr), rawSentinel) {
		t.Fatalf("non-200 submit error leaked raw upstream body in %q", taskErrorText(taskErr))
	}
	if taskErr.Message != "task failed at upstream provider" {
		t.Fatalf("message = %q, want fixed generic message", taskErr.Message)
	}
}

func TestTaskSubmitStatusErrorPreservesDoubaoBody(t *testing.T) {
	resp := &http.Response{
		StatusCode: http.StatusBadGateway,
		Body:       io.NopCloser(strings.NewReader(`{"error":"doubao upstream details"}`)),
	}

	taskErr := taskSubmitStatusError(constant.TaskPlatform("52"), resp)
	if taskErr == nil {
		t.Fatal("expected task submit status error")
	}
	if !strings.Contains(taskErr.Message, "doubao upstream details") {
		t.Fatalf("doubao submit error was unexpectedly scrubbed: %q", taskErr.Message)
	}
}

func TestTaskSubmitStatusErrorScrubsModelAPICapacityNonOKBody(t *testing.T) {
	resp := &http.Response{
		StatusCode: http.StatusTooManyRequests,
		Body: io.NopCloser(strings.NewReader(
			`{"error":{"message":"Selected model is at capacity. Please try a different model.","task_id":"upstream-secret-id"}}`)),
	}

	taskErr := taskSubmitStatusError(constant.TaskPlatform("111"), resp)
	if taskErr == nil {
		t.Fatal("expected task submit status error")
	}
	if taskErr.StatusCode != http.StatusTooManyRequests {
		t.Fatalf("status = %d, want %d", taskErr.StatusCode, http.StatusTooManyRequests)
	}
	if taskErr.Message != "task failed at upstream provider" {
		t.Fatalf("message = %q, want fixed generic message", taskErr.Message)
	}
	for _, marker := range []string{"Selected model", "different model", "upstream-secret-id", "ModelAPI"} {
		if strings.Contains(taskErrorText(taskErr), marker) {
			t.Fatalf("non-200 submit error leaked %q in %q", marker, taskErrorText(taskErr))
		}
	}
}

func TestTaskSubmitStatusErrorClosesAndBoundsNonOKBody(t *testing.T) {
	body := &countingSubmitErrorBody{Reader: strings.NewReader(strings.Repeat("x", (1<<20)+128) + " upstream-secret-id")}
	resp := &http.Response{
		StatusCode: http.StatusBadGateway,
		Body:       body,
	}

	taskErr := taskSubmitStatusError(constant.TaskPlatform("111"), resp)
	if taskErr == nil {
		t.Fatal("expected task submit status error")
	}
	if !body.closed {
		t.Fatal("taskSubmitStatusError did not close non-200 response body")
	}
	if body.n > (1<<20)+1 {
		t.Fatalf("taskSubmitStatusError read %d bytes, want at most max+1", body.n)
	}
	if taskErr.Message != "task failed at upstream provider" {
		t.Fatalf("message = %q, want fixed generic message", taskErr.Message)
	}
	if strings.Contains(taskErrorText(taskErr), "upstream-secret-id") {
		t.Fatalf("oversized submit error leaked raw body in %q", taskErrorText(taskErr))
	}
}

func TestTaskSubmitStatusErrorPreservesBoundedDoubaoOversizedBody(t *testing.T) {
	const prefix = "doubao bounded prefix"
	const tail = "doubao oversized tail"
	bodyText := prefix + strings.Repeat("x", taskSubmitErrorResponseMaxBytes) + tail
	body := &countingSubmitErrorBody{Reader: strings.NewReader(bodyText)}
	resp := &http.Response{
		StatusCode: http.StatusBadGateway,
		Body:       body,
	}

	taskErr := taskSubmitStatusError(constant.TaskPlatform("52"), resp)
	if taskErr == nil {
		t.Fatal("expected task submit status error")
	}
	if !body.closed {
		t.Fatal("taskSubmitStatusError did not close non-200 response body")
	}
	if body.n > taskSubmitErrorResponseMaxBytes+1 {
		t.Fatalf("taskSubmitStatusError read %d bytes, want at most max+1", body.n)
	}
	if !strings.Contains(taskErr.Message, prefix) {
		t.Fatalf("doubao submit error did not preserve bounded prefix: %q", taskErr.Message)
	}
	if strings.Contains(taskErr.Message, tail) {
		t.Fatalf("doubao submit error leaked oversized tail in %q", taskErr.Message)
	}
}

func TestTaskSubmitStatusErrorUsesFallbackForEmptyBody(t *testing.T) {
	resp := &http.Response{
		StatusCode: http.StatusBadGateway,
		Body:       io.NopCloser(strings.NewReader("")),
	}

	taskErr := taskSubmitStatusError(constant.TaskPlatform("52"), resp)
	if taskErr == nil {
		t.Fatal("expected task submit status error")
	}
	if strings.TrimSpace(taskErr.Message) == "" {
		t.Fatal("expected non-empty fallback message for empty submit error body")
	}
}

func TestTaskSubmitStatusErrorUsesFallbackForReadError(t *testing.T) {
	resp := &http.Response{
		StatusCode: http.StatusBadGateway,
		Body:       &readErrorSubmitErrorBody{},
	}

	taskErr := taskSubmitStatusError(constant.TaskPlatform("52"), resp)
	if taskErr == nil {
		t.Fatal("expected task submit status error")
	}
	if strings.TrimSpace(taskErr.Message) == "" {
		t.Fatal("expected non-empty fallback message for unreadable submit error body")
	}
}

type countingSubmitErrorBody struct {
	*strings.Reader
	n      int
	closed bool
}

func (b *countingSubmitErrorBody) Read(p []byte) (int, error) {
	n, err := b.Reader.Read(p)
	b.n += n
	return n, err
}

func (b *countingSubmitErrorBody) Close() error {
	b.closed = true
	return nil
}

type readErrorSubmitErrorBody struct {
	closed bool
}

func (b *readErrorSubmitErrorBody) Read(_ []byte) (int, error) {
	return 0, errors.New("read failed")
}

func (b *readErrorSubmitErrorBody) Close() error {
	b.closed = true
	return nil
}

func taskErrorText(taskErr *dto.TaskError) string {
	if taskErr == nil {
		return ""
	}
	text := taskErr.Message
	if taskErr.Error != nil {
		text += " " + taskErr.Error.Error()
	}
	return text
}
