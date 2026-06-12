package common

import (
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestCustomEvent_RenderSetsCharset(t *testing.T) {
	rec := httptest.NewRecorder()
	ev := CustomEvent{Data: "data: {}\n\n"}
	err := ev.Render(rec)
	assert.NoError(t, err)
	assert.Equal(t, "text/event-stream; charset=utf-8", rec.Header().Get("Content-Type"))
}
