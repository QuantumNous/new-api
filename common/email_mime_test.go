package common

import (
	"io"
	"mime"
	"mime/multipart"
	"mime/quotedprintable"
	"net/mail"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func withTestSender(t *testing.T, from string) {
	t.Helper()
	originalFrom := SMTPFrom
	originalAccount := SMTPAccount
	originalName := SystemName
	t.Cleanup(func() {
		SMTPFrom = originalFrom
		SMTPAccount = originalAccount
		SystemName = originalName
	})
	SMTPFrom = from
	SMTPAccount = from
	SystemName = "Flatkey"
}

func parseTestMessage(t *testing.T, raw []byte) *mail.Message {
	t.Helper()
	message, err := mail.ReadMessage(strings.NewReader(string(raw)))
	require.NoError(t, err)
	return message
}

func TestBulkEmailCarriesOneClickUnsubscribeHeaders(t *testing.T) {
	withTestSender(t, "campaigns@mg.example.com")

	raw, err := buildEmailMessageFromWithOptions(
		"campaigns@mg.example.com",
		"Come back",
		"user@example.com",
		"<!doctype html><html><body><p>Hi</p></body></html>",
		"<recall-7-1@mg.example.com>",
		EmailOptions{
			ListUnsubscribeURL:    "https://console.example.com/api/recall/unsubscribe?token=abc",
			ListUnsubscribeMailto: "mailto:unsubscribe@mg.example.com",
			Multipart:             true,
		},
	)
	require.NoError(t, err)

	message := parseTestMessage(t, raw)
	require.Equal(t,
		"<https://console.example.com/api/recall/unsubscribe?token=abc>, <mailto:unsubscribe@mg.example.com>",
		message.Header.Get("List-Unsubscribe"),
	)
	require.Equal(t, "List-Unsubscribe=One-Click", message.Header.Get("List-Unsubscribe-Post"))
	require.Equal(t, "1.0", message.Header.Get("MIME-Version"))
}

func TestTransactionalEmailOmitsBulkHeadersButDeclaresMIME(t *testing.T) {
	withTestSender(t, "noreply@example.com")

	raw, err := buildEmailMessage("Verify", "user@example.com", "<p>code</p>", "<verify-1@example.com>")
	require.NoError(t, err)

	message := parseTestMessage(t, raw)
	require.Empty(t, message.Header.Get("List-Unsubscribe"))
	require.Empty(t, message.Header.Get("List-Unsubscribe-Post"))
	// MIME-Version is mandatory once Content-Type is declared, including for
	// the single-part transactional shape.
	require.Equal(t, "1.0", message.Header.Get("MIME-Version"))
	require.Equal(t, "quoted-printable", message.Header.Get("Content-Transfer-Encoding"))

	mediaType, _, err := mime.ParseMediaType(message.Header.Get("Content-Type"))
	require.NoError(t, err)
	require.Equal(t, "text/html", mediaType)
}

func TestBulkEmailBuildsMultipartAlternativeWithReadablePlainText(t *testing.T) {
	withTestSender(t, "campaigns@mg.example.com")

	htmlBody := "<!doctype html><html><body>" +
		"<p>你好，Sam！</p>" +
		"<p>Offer code: <code>SAVE20</code></p>" +
		"<p><a href=\"https://console.example.com/console/topup?recall_claim=xyz\">Claim your offer</a></p>" +
		"<p><a href=\"https://console.example.com/api/recall/unsubscribe?token=abc\">Unsubscribe</a></p>" +
		"</body></html>"

	raw, err := buildEmailMessageFromWithOptions(
		"campaigns@mg.example.com",
		"Come back",
		"user@example.com",
		htmlBody,
		"<recall-7-1@mg.example.com>",
		EmailOptions{
			ListUnsubscribeURL: "https://console.example.com/api/recall/unsubscribe?token=abc",
			Multipart:          true,
		},
	)
	require.NoError(t, err)

	message := parseTestMessage(t, raw)
	mediaType, params, err := mime.ParseMediaType(message.Header.Get("Content-Type"))
	require.NoError(t, err)
	require.Equal(t, "multipart/alternative", mediaType)

	// Each part must declare its encoding. multipart.Reader consumes and strips
	// Content-Transfer-Encoding while decoding, so assert on the raw message.
	require.Equal(t, 2, strings.Count(string(raw), "Content-Transfer-Encoding: quoted-printable\r\n"))

	reader := multipart.NewReader(message.Body, params["boundary"])
	parts := make(map[string]string)
	order := make([]string, 0, 2)
	for {
		part, err := reader.NextPart()
		if err != nil {
			break
		}
		partType, _, err := mime.ParseMediaType(part.Header.Get("Content-Type"))
		require.NoError(t, err)
		// NextPart already decoded the quoted-printable body.
		decoded, err := io.ReadAll(part)
		require.NoError(t, err)
		parts[partType] = strings.TrimSpace(string(decoded))
		order = append(order, partType)
	}

	// RFC 2046: clients render the last part they can display, so text/html
	// must come after text/plain.
	require.Equal(t, []string{"text/plain", "text/html"}, order)
	require.Equal(t, htmlBody, parts["text/html"])

	plain := parts["text/plain"]
	require.Contains(t, plain, "你好，Sam！")
	require.Contains(t, plain, "SAVE20")
	require.NotContains(t, plain, "<p>")
	// Links must survive into the plain part, otherwise the alternative is
	// unusable for recipients whose client renders it.
	require.Contains(t, plain, "https://console.example.com/console/topup?recall_claim=xyz")
	require.Contains(t, plain, "https://console.example.com/api/recall/unsubscribe?token=abc")
}

func TestQuotedPrintableKeepsUTF8AndWrapsLongLines(t *testing.T) {
	withTestSender(t, "campaigns@mg.example.com")

	longLine := strings.Repeat("充值优惠 ", 40)
	raw, err := buildEmailMessageFromWithOptions(
		"campaigns@mg.example.com",
		"主题",
		"user@example.com",
		"<p>"+longLine+"</p>",
		"<recall-7-1@mg.example.com>",
		EmailOptions{},
	)
	require.NoError(t, err)

	for _, line := range strings.Split(string(raw), "\r\n") {
		require.LessOrEqual(t, len(line), 78, "line exceeds RFC 5322 limit: %q", line)
	}

	message := parseTestMessage(t, raw)
	decoded, err := io.ReadAll(quotedprintable.NewReader(message.Body))
	require.NoError(t, err)
	require.Contains(t, string(decoded), longLine)
}

func TestMalformedDeliverabilityOptionsDoNotBlockDelivery(t *testing.T) {
	withTestSender(t, "campaigns@mg.example.com")

	tests := []struct {
		name    string
		options EmailOptions
	}{
		{name: "empty origin", options: EmailOptions{ListUnsubscribeURL: "/api/recall/unsubscribe?token=abc"}},
		{name: "header break", options: EmailOptions{ListUnsubscribeURL: "https://a.example.com/u\r\nBcc: victim@example.com"}},
		{name: "angle bracket", options: EmailOptions{ListUnsubscribeURL: "https://a.example.com/<u>"}},
		{name: "bad mailto", options: EmailOptions{ListUnsubscribeMailto: "unsubscribe@example.com"}},
		{name: "bad reply-to", options: EmailOptions{ReplyTo: "not an address"}},
	}
	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			raw, err := buildEmailMessageFromWithOptions(
				"campaigns@mg.example.com",
				"subject",
				"user@example.com",
				"<p>body</p>",
				"<recall-7-1@mg.example.com>",
				testCase.options,
			)
			// A misconfigured optional header degrades the spam score; it must
			// never stop the campaign from sending.
			require.NoError(t, err)
			message := parseTestMessage(t, raw)
			require.Empty(t, message.Header.Get("List-Unsubscribe"))
			require.Empty(t, message.Header.Get("List-Unsubscribe-Post"))
			require.Empty(t, message.Header.Get("Reply-To"))
			require.NotContains(t, string(raw), "victim@example.com")
		})
	}
}

func TestMailtoOnlyUnsubscribeOmitsOneClickPost(t *testing.T) {
	withTestSender(t, "campaigns@mg.example.com")

	raw, err := buildEmailMessageFromWithOptions(
		"campaigns@mg.example.com",
		"subject",
		"user@example.com",
		"<p>body</p>",
		"<recall-7-1@mg.example.com>",
		EmailOptions{ListUnsubscribeMailto: "mailto:unsubscribe@mg.example.com"},
	)
	require.NoError(t, err)

	message := parseTestMessage(t, raw)
	require.Equal(t, "<mailto:unsubscribe@mg.example.com>", message.Header.Get("List-Unsubscribe"))
	// Without an HTTP endpoint there is nothing to POST to, so advertising
	// one-click would make providers request a dead URL.
	require.Empty(t, message.Header.Get("List-Unsubscribe-Post"))
}

func TestReplyToIsEmittedWhenValid(t *testing.T) {
	withTestSender(t, "campaigns@mg.example.com")

	raw, err := buildEmailMessageFromWithOptions(
		"campaigns@mg.example.com",
		"subject",
		"user@example.com",
		"<p>body</p>",
		"<recall-7-1@mg.example.com>",
		EmailOptions{ReplyTo: "support@example.com"},
	)
	require.NoError(t, err)

	message := parseTestMessage(t, raw)
	require.Equal(t, "support@example.com", message.Header.Get("Reply-To"))
}

func TestMIMEBoundaryIsStableForSameMessageID(t *testing.T) {
	// Retries after an uncertain send reuse the Message-ID, so the boundary
	// must not drift and produce a second distinct body.
	require.Equal(t, mimeBoundary("<recall-7-1@mg.example.com>"), mimeBoundary("<recall-7-1@mg.example.com>"))
	require.NotEqual(t, mimeBoundary("<recall-7-1@mg.example.com>"), mimeBoundary("<recall-7-2@mg.example.com>"))
	require.NotContains(t, mimeBoundary("<recall-7-1@mg.example.com>"), "@")
}

func TestHTMLToPlainTextSkipsStyleAndScript(t *testing.T) {
	plain := htmlToPlainText("<html><head><style>p{color:red}</style></head><body><script>alert(1)</script><p>Hello</p></body></html>")
	require.Equal(t, "Hello", plain)
}
