package common

import (
	"bufio"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net"
	"net/mail"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestEmailMessageIncludesProvidedStableMessageID(t *testing.T) {
	originalFrom := SMTPFrom
	originalAccount := SMTPAccount
	originalName := SystemName
	t.Cleanup(func() {
		SMTPFrom = originalFrom
		SMTPAccount = originalAccount
		SystemName = originalName
	})
	SMTPFrom = "sender@mail.example.com"
	SMTPAccount = ""
	SystemName = "Flatkey"

	message, err := buildEmailMessage("Welcome back", "user@example.com", "<p>Hello</p>", "<recall-42-1@mail.example.com>")
	require.NoError(t, err)
	require.Contains(t, string(message), "Message-ID: <recall-42-1@mail.example.com>\r\n")
	require.Contains(t, string(message), "To: user@example.com\r\n")
}

func TestEmailMessageRejectsHeaderInjection(t *testing.T) {
	originalFrom := SMTPFrom
	originalAccount := SMTPAccount
	t.Cleanup(func() {
		SMTPFrom = originalFrom
		SMTPAccount = originalAccount
	})
	SMTPFrom = "sender@mail.example.com"
	SMTPAccount = ""

	tests := []struct {
		name      string
		subject   string
		receiver  string
		messageID string
	}{
		{name: "subject", subject: "Welcome\r\nBcc: victim@example.com", receiver: "user@example.com", messageID: "<recall-42-1@mail.example.com>"},
		{name: "receiver", subject: "Welcome", receiver: "user@example.com\nBcc: victim@example.com", messageID: "<recall-42-1@mail.example.com>"},
		{name: "message id", subject: "Welcome", receiver: "user@example.com", messageID: "<recall-42-1@mail.example.com>\r\nBcc: victim@example.com"},
	}
	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			_, err := buildEmailMessage(testCase.subject, testCase.receiver, "body", testCase.messageID)
			require.Error(t, err)
		})
	}
}

func TestEmailMessageDomainUsesEffectiveSenderMailbox(t *testing.T) {
	originalFrom := SMTPFrom
	originalAccount := SMTPAccount
	t.Cleanup(func() {
		SMTPFrom = originalFrom
		SMTPAccount = originalAccount
	})

	SMTPFrom = ""
	SMTPAccount = "sender@Fallback.Example.COM"
	domain, err := EmailMessageIDDomain()
	require.NoError(t, err)
	require.Equal(t, "fallback.example.com", domain)

	for _, sender := range []string{
		"sender@example.com,other@example.com",
		"sender@example.com\r\nBcc: victim@example.com",
		"sender@invalid_domain",
	} {
		SMTPFrom = sender
		_, err := EmailMessageIDDomain()
		require.Error(t, err, sender)
	}
}

func TestEmailMessageCanonicalizesAddressHeadersAndRejectsInvalidMessageIDDomain(t *testing.T) {
	originalFrom := SMTPFrom
	originalAccount := SMTPAccount
	originalName := SystemName
	t.Cleanup(func() {
		SMTPFrom = originalFrom
		SMTPAccount = originalAccount
		SystemName = originalName
	})
	SMTPFrom = "sender@notify.example.com"
	SMTPAccount = "sender@notify.example.com"
	SystemName = `Flatkey "Ops" \ 通知`

	message, err := buildEmailMessage("subject", "one@example.com; two@example.com", "body", "<recall-1-1@notify.example.com>")
	require.NoError(t, err)
	require.Contains(t, string(message), "To: one@example.com, two@example.com\r\n")
	require.Contains(t, string(message), "From: "+(&mail.Address{Name: SystemName, Address: SMTPFrom}).String()+"\r\n")

	for _, messageID := range []string{
		"<recall-1-1@a..example.com>",
		"<recall-1-1@.example.com>",
		"<recall-1-1@example.com.>",
		"<recall-1-1@invalid_domain>",
		"<recall-1-1@Notify.Example.com>",
	} {
		_, err := buildEmailMessage("subject", "one@example.com", "body", messageID)
		require.Error(t, err, messageID)
	}
}

func TestEmailMessageFallbackDoesNotMutateSMTPFrom(t *testing.T) {
	originalFrom := SMTPFrom
	originalAccount := SMTPAccount
	originalServer := SMTPServer
	originalPort := SMTPPort
	originalSSL := SMTPSSLEnabled
	t.Cleanup(func() {
		SMTPFrom = originalFrom
		SMTPAccount = originalAccount
		SMTPServer = originalServer
		SMTPPort = originalPort
		SMTPSSLEnabled = originalSSL
	})
	SMTPFrom = ""
	SMTPAccount = "sender@fallback.example.com"
	SMTPServer = "127.0.0.1"
	SMTPPort = 1
	SMTPSSLEnabled = false

	err := SendEmailWithMessageID("subject", "one@example.com", "body", "<recall-1-1@fallback.example.com>")
	require.Error(t, err)
	require.Empty(t, SMTPFrom)
}

func TestEmailMessageUncertainClassificationPreservesErrorChain(t *testing.T) {
	cause := errors.New("connection reset after DATA")
	err := &emailSendError{Uncertain: true, Err: cause}
	require.True(t, IsEmailSendUncertain(err))
	require.ErrorIs(t, err, cause)
	require.Equal(t, cause.Error(), err.Error())

	definite := &emailSendError{Uncertain: false, Err: cause}
	require.False(t, IsEmailSendUncertain(definite))
	require.True(t, strings.Contains(definite.Error(), "connection reset"))
}

func TestEmailMessageManualTLSClassifiesRealSMTPPhases(t *testing.T) {
	tests := []struct {
		name          string
		script        smtpTestScript
		wantUncertain bool
		wantError     bool
	}{
		{name: "final 250 accepted", script: smtpTestScript{useTLS: true}},
		{name: "RCPT rejection is definite", script: smtpTestScript{useTLS: true, failAt: "RCPT"}, wantError: true},
		{name: "connection loss after DATA is uncertain", script: smtpTestScript{useTLS: true, closeBeforeDataResponse: true}, wantError: true, wantUncertain: true},
		{name: "cleanup reset after final 250 stays accepted", script: smtpTestScript{useTLS: true, resetAfterFinalResponse: true}},
	}
	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			port, wait := startSMTPTestServer(t, testCase.script)
			configureSMTPTestClient(t, port, true)

			err := SendEmailWithMessageID("subject", "user@example.com", "body", "<recall-1-1@example.com>")
			result := wait()
			if testCase.wantError {
				require.Error(t, err)
				require.Equal(t, testCase.wantUncertain, IsEmailSendUncertain(err))
			} else {
				require.NoError(t, err)
			}
			require.Equal(t, []string{"EHLO", "AUTH", "MAIL", "RCPT", "DATA"}[:len(result.commands)], smtpCommandNames(result.commands))
			if testCase.script.failAt == "" {
				require.Contains(t, result.data, "Message-ID: <recall-1-1@example.com>")
			}
		})
	}
}

func TestEmailMessageNonTLSReturnedErrorIsConservativelyUncertain(t *testing.T) {
	port, wait := startSMTPTestServer(t, smtpTestScript{failAt: "MAIL"})
	configureSMTPTestClient(t, port, false)

	err := SendEmailWithMessageID("subject", "user@example.com", "body", "<recall-1-1@example.com>")
	result := wait()
	require.Error(t, err)
	require.True(t, IsEmailSendUncertain(err))
	require.Equal(t, []string{"EHLO", "AUTH", "MAIL"}, smtpCommandNames(result.commands))
}

type smtpTestScript struct {
	useTLS                  bool
	failAt                  string
	closeBeforeDataResponse bool
	resetAfterFinalResponse bool
}

type smtpTestResult struct {
	commands []string
	data     string
	err      error
}

func startSMTPTestServer(t *testing.T, script smtpTestScript) (int, func() smtpTestResult) {
	t.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	t.Cleanup(func() { _ = listener.Close() })
	certificate := smtpTestCertificate(t)
	results := make(chan smtpTestResult, 1)
	go func() {
		result := smtpTestResult{}
		rawConn, acceptErr := listener.Accept()
		if acceptErr != nil {
			result.err = acceptErr
			results <- result
			return
		}
		_ = listener.Close()
		defer rawConn.Close()
		_ = rawConn.SetDeadline(time.Now().Add(5 * time.Second))
		var conn net.Conn = rawConn
		if script.useTLS {
			tlsConn := tls.Server(rawConn, &tls.Config{Certificates: []tls.Certificate{certificate}})
			if handshakeErr := tlsConn.Handshake(); handshakeErr != nil {
				result.err = handshakeErr
				results <- result
				return
			}
			conn = tlsConn
		}
		result.err = runSMTPTestScript(conn, rawConn, script, &result)
		results <- result
	}()
	port := listener.Addr().(*net.TCPAddr).Port
	return port, func() smtpTestResult {
		t.Helper()
		select {
		case result := <-results:
			require.NoError(t, result.err)
			return result
		case <-time.After(6 * time.Second):
			require.FailNow(t, "scripted SMTP server timed out")
			return smtpTestResult{}
		}
	}
}

func runSMTPTestScript(conn net.Conn, rawConn net.Conn, script smtpTestScript, result *smtpTestResult) error {
	reader := bufio.NewReader(conn)
	writer := bufio.NewWriter(conn)
	writeReply := func(reply string) error {
		if _, err := writer.WriteString(reply); err != nil {
			return err
		}
		return writer.Flush()
	}
	readCommand := func(name string) error {
		line, err := reader.ReadString('\n')
		if err != nil {
			return err
		}
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(strings.ToUpper(line), name) {
			return fmt.Errorf("expected SMTP %s command, got %q", name, line)
		}
		result.commands = append(result.commands, line)
		return nil
	}
	if err := writeReply("220 localhost ESMTP ready\r\n"); err != nil {
		return err
	}
	if err := readCommand("EHLO"); err != nil {
		return err
	}
	if err := writeReply("250-localhost\r\n250 AUTH PLAIN\r\n"); err != nil {
		return err
	}
	if err := readCommand("AUTH"); err != nil {
		return err
	}
	if err := writeReply("235 2.7.0 authenticated\r\n"); err != nil {
		return err
	}
	for _, command := range []string{"MAIL", "RCPT", "DATA"} {
		if err := readCommand(command); err != nil {
			return err
		}
		if script.failAt == command {
			return writeReply("550 5.1.0 scripted rejection\r\n")
		}
		if command == "DATA" {
			if err := writeReply("354 send message, end with dot\r\n"); err != nil {
				return err
			}
			break
		}
		if err := writeReply("250 2.1.0 ok\r\n"); err != nil {
			return err
		}
	}
	var data strings.Builder
	for {
		line, err := reader.ReadString('\n')
		if err != nil {
			return err
		}
		if line == ".\r\n" {
			break
		}
		data.WriteString(line)
	}
	result.data = data.String()
	if script.closeBeforeDataResponse {
		return nil
	}
	if err := writeReply("250 2.0.0 queued\r\n"); err != nil {
		return err
	}
	if script.resetAfterFinalResponse {
		if tcpConn, ok := rawConn.(*net.TCPConn); ok {
			_ = tcpConn.SetLinger(0)
		}
		return nil
	}
	_, err := reader.ReadByte()
	if errors.Is(err, io.EOF) || errors.Is(err, net.ErrClosed) {
		return nil
	}
	return err
}

func smtpTestCertificate(t *testing.T) tls.Certificate {
	t.Helper()
	privateKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	require.NoError(t, err)
	template := x509.Certificate{
		SerialNumber: big.NewInt(1),
		NotBefore:    time.Now().Add(-time.Minute),
		NotAfter:     time.Now().Add(time.Hour),
		KeyUsage:     x509.KeyUsageDigitalSignature,
		ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		DNSNames:     []string{"localhost"},
	}
	der, err := x509.CreateCertificate(rand.Reader, &template, &template, &privateKey.PublicKey, privateKey)
	require.NoError(t, err)
	return tls.Certificate{Certificate: [][]byte{der}, PrivateKey: privateKey}
}

func configureSMTPTestClient(t *testing.T, port int, useTLS bool) {
	t.Helper()
	originalServer := SMTPServer
	originalPort := SMTPPort
	originalSSL := SMTPSSLEnabled
	originalForceLogin := SMTPForceAuthLogin
	originalAccount := SMTPAccount
	originalFrom := SMTPFrom
	originalToken := SMTPToken
	SMTPServer = "localhost"
	SMTPPort = port
	SMTPSSLEnabled = useTLS
	SMTPForceAuthLogin = false
	SMTPAccount = "sender@example.com"
	SMTPFrom = "sender@example.com"
	SMTPToken = "test-password"
	t.Cleanup(func() {
		SMTPServer = originalServer
		SMTPPort = originalPort
		SMTPSSLEnabled = originalSSL
		SMTPForceAuthLogin = originalForceLogin
		SMTPAccount = originalAccount
		SMTPFrom = originalFrom
		SMTPToken = originalToken
	})
}

func smtpCommandNames(commands []string) []string {
	names := make([]string, 0, len(commands))
	for _, command := range commands {
		name, _, _ := strings.Cut(command, " ")
		names = append(names, strings.ToUpper(name))
	}
	return names
}
