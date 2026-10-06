package helper

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestResponseModelRewriterRewritesBody(t *testing.T) {
	c, recorder := newResponseModelTestContext()
	common.SetResponseModelRewriteTarget(c, "deepseek-chat")
	installResponseModelRewriter(c)

	payload := `{"id":"chatcmpl-1","model":"deepseek-v4"}`
	written, err := c.Writer.Write([]byte(payload))
	require.NoError(t, err)
	assert.Equal(t, len(payload), written, "callers must observe a full write")
	assert.Equal(t, `{"id":"chatcmpl-1","model":"deepseek-chat"}`, recorder.Body.String())
}

func TestResponseModelRewriterRewritesStreamEvents(t *testing.T) {
	c, recorder := newResponseModelTestContext()
	common.SetResponseModelRewriteTarget(c, "deepseek-chat")
	installResponseModelRewriter(c)

	event := "data: {\"model\":\"deepseek-v4\",\"choices\":[]}\n\n"
	_, err := c.Writer.WriteString(event)
	require.NoError(t, err)

	written := recorder.Body.String()
	require.True(t, strings.HasPrefix(written, "data: ") && strings.HasSuffix(written, "\n\n"), "sse framing lost: %q", written)
	payload := strings.TrimSuffix(strings.TrimPrefix(written, "data: "), "\n\n")
	var decoded struct {
		Model string `json:"model"`
	}
	require.NoError(t, common.Unmarshal([]byte(payload), &decoded))
	assert.Equal(t, "deepseek-chat", decoded.Model)
}

func TestResponseModelRewriterKeepsPayloadWithoutTarget(t *testing.T) {
	c, recorder := newResponseModelTestContext()
	installResponseModelRewriter(c)

	payload := `{"model":"deepseek-v4"}`
	_, err := c.Writer.Write([]byte(payload))
	require.NoError(t, err)
	assert.Equal(t, payload, recorder.Body.String())
}

func TestResponseModelRewriterKeepsCopyContract(t *testing.T) {
	c, recorder := newResponseModelTestContext()
	common.SetResponseModelRewriteTarget(c, "deepseek-chat")
	installResponseModelRewriter(c)

	payload := `{"model":"deepseek-v4"}`
	copied, err := io.Copy(c.Writer, strings.NewReader(payload))
	require.NoError(t, err)
	assert.Equal(t, int64(len(payload)), copied)
	assert.Equal(t, `{"model":"deepseek-chat"}`, recorder.Body.String())
}

func TestResponseModelRewriterInstallsOnce(t *testing.T) {
	c, _ := newResponseModelTestContext()
	installResponseModelRewriter(c)
	first := c.Writer
	installResponseModelRewriter(c)
	assert.Same(t, first, c.Writer)
}

func TestResponseModelRewriterCarriesBoundaryFragments(t *testing.T) {
	body := "data: {\"id\":\"x\",\"error\":{\"model\":\"deepseek-v4\"},\"message\":{\"model\":\"deepseek-v4\"}}\n\n"
	want := strings.Replace(body, `"message":{"model":"deepseek-v4"}`, `"message":{"model":"deepseek-chat"}`, 1)

	for offset := 1; offset < len(body)-1; offset++ {
		c, recorder := newResponseModelTestContext()
		common.SetResponseModelRewriteTarget(c, "deepseek-chat")
		installResponseModelRewriter(c)

		for _, chunk := range []string{body[:offset], body[offset:]} {
			written, err := c.Writer.WriteString(chunk)
			require.NoError(t, err)
			assert.Equal(t, len(chunk), written, "offset %d must report a full write", offset)
		}
		c.Writer.Flush()
		assert.Equal(t, want, recorder.Body.String(), "split at offset %d", offset)
	}
}

func TestResponseModelRewriterFlushesPendingFragment(t *testing.T) {
	c, recorder := newResponseModelTestContext()
	common.SetResponseModelRewriteTarget(c, "deepseek-chat")
	installResponseModelRewriter(c)

	payload := `{"model":"deepseek-v4","note":"unterminated`
	written, err := c.Writer.WriteString(payload)
	require.NoError(t, err)
	assert.Equal(t, len(payload), written)

	c.Writer.Flush()
	assert.Equal(t, `{"model":"deepseek-chat","note":"unterminated`, recorder.Body.String())
	assert.True(t, strings.HasSuffix(recorder.Body.String(), `"note":"unterminated`), "pending fragment must not be dropped")
}

func TestResponseModelRewriterKeepsModelAcrossCopyChunks(t *testing.T) {
	c, recorder := newResponseModelTestContext()
	common.SetResponseModelRewriteTarget(c, "deepseek-chat")
	installResponseModelRewriter(c)

	const ioCopyBuffer = 32 * 1024
	head := `{"id":"x","note":"`
	padding := strings.Repeat("a", ioCopyBuffer-len(head)-3)
	body := head + padding + `","model":"deepseek-v4"}`
	modelStart := strings.Index(body, `"model"`)
	require.Less(t, modelStart, ioCopyBuffer, "the model key must straddle the copy chunk")

	reader := strings.NewReader(body)
	buffer := make([]byte, ioCopyBuffer)
	for {
		read, readErr := reader.Read(buffer)
		if read > 0 {
			written, writeErr := c.Writer.Write(buffer[:read])
			require.NoError(t, writeErr)
			require.Equal(t, read, written)
		}
		if readErr == io.EOF {
			break
		}
		require.NoError(t, readErr)
	}
	c.Writer.Flush()

	assert.Equal(t, strings.Replace(body, `"model":"deepseek-v4"`, `"model":"deepseek-chat"`, 1), recorder.Body.String())
}

func TestResponseModelRewriterKeepsWriteDeadlineSupport(t *testing.T) {
	gin.SetMode(gin.TestMode)
	var deadlineErr error
	router := gin.New()
	router.GET("/stream", func(c *gin.Context) {
		common.SetResponseModelRewriteTarget(c, "deepseek-chat")
		installResponseModelRewriter(c)
		deadlineErr = http.NewResponseController(c.Writer).SetWriteDeadline(time.Now().Add(time.Minute))
		c.String(http.StatusOK, "data: {\"model\":\"deepseek-v4\"}")
	})
	server := httptest.NewServer(router)
	defer server.Close()

	resp, err := server.Client().Get(server.URL + "/stream")
	require.NoError(t, err)
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	assert.Equal(t, "data: {\"model\":\"deepseek-chat\"}", string(body))
	assert.NoError(t, deadlineErr, "the rewriter must not block write deadlines")
}
