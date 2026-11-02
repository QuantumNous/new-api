package common

import (
	"crypto/tls"
	"fmt"
	"net"
	"net/smtp"
	"slices"
	"strings"
	"time"
)

// SMTPOperationTimeout bounds one outbound submission: TCP connect, TLS
// handshake, auth, envelope and message body, via one absolute connection
// deadline. Mail is a background convenience, not a request-critical path: a
// stalled relay must surface an error instead of pinning the calling handler
// inside the kernel's TCP retransmit ladder.
var SMTPOperationTimeout = 60 * time.Second

// smtpQuitTimeout bounds the post-acceptance QUIT. The relay has already
// taken responsibility for the message at that point: hanging up early costs
// nothing, while waiting on a lost 221 wastes handler time.
var smtpQuitTimeout = 5 * time.Second

// SMTPAccountConfig is one upstream SMTP identity new-api can send through.
// Several can be configured at once so that a provider-side rate limit or a
// single rejected account never stops outbound mail.
type SMTPAccountConfig struct {
	Server     string `json:"server"`
	Port       int    `json:"port"`
	Account    string `json:"account"`
	Token      string `json:"token"`
	From       string `json:"from"`
	SSLEnabled bool   `json:"ssl"`
	StartTLS   bool   `json:"starttls"`
	// DailyLimit caps the sends one account may make per calendar day (UTC+8).
	// Zero means unlimited.
	DailyLimit int `json:"dailyLimit"`
	// Priority tiers the accounts: the lowest value is used first and the
	// higher tiers only take over once the lower ones run out of quota.
	Priority int `json:"priority"`
}

// SMTPAccountPool holds every configured upstream SMTP identity. An empty pool
// means the deployment only set the legacy single-account options.
var SMTPAccountPool []SMTPAccountConfig

// ParseSMTPAccountPoolJSON decodes the SMTPAccountPool option value. An empty
// value means "no pool configured" and is not an error.
func ParseSMTPAccountPoolJSON(value string) ([]SMTPAccountConfig, error) {
	if strings.TrimSpace(value) == "" {
		return nil, nil
	}
	var pool []SMTPAccountConfig
	if err := UnmarshalJsonStr(value, &pool); err != nil {
		return nil, fmt.Errorf("SMTPAccountPool must be a JSON array of accounts")
	}
	for i, account := range pool {
		if account.Server == "" || account.Account == "" || account.Port <= 0 {
			return nil, fmt.Errorf("SMTPAccountPool entry %d requires server, account and a positive port", i)
		}
		if account.DailyLimit < 0 || account.Priority < 0 {
			return nil, fmt.Errorf("SMTPAccountPool entry %d needs non-negative dailyLimit and priority", i)
		}
	}
	return pool, nil
}

// legacySMTPAccountConfig maps the pre-pool single-account settings onto the
// same shape the pool uses, so both configuration styles share one code path.
func legacySMTPAccountConfig() SMTPAccountConfig {
	return SMTPAccountConfig{
		Server:     SMTPServer,
		Port:       SMTPPort,
		Account:    SMTPAccount,
		Token:      SMTPToken,
		From:       SMTPFrom,
		SSLEnabled: SMTPSSLEnabled,
		StartTLS:   SMTPStartTLSEnabled,
	}
}

func generateMessageID(from string) (string, error) {
	parts := strings.Split(from, "@")
	if len(parts) < 2 {
		return "", fmt.Errorf("invalid SMTP account")
	}
	return fmt.Sprintf("<%d.%s@%s>", time.Now().UnixNano(), GetRandomString(12), parts[1]), nil
}

func shouldUseSMTPLoginAuth(account SMTPAccountConfig) bool {
	if SMTPForceAuthLogin {
		return true
	}
	return isOutlookServer(account.Account) || slices.Contains(EmailLoginAuthServerList, account.Server)
}

func getSMTPAuth(account SMTPAccountConfig) smtp.Auth {
	return AutoSMTPAuth(account.Account, account.Token, account.Server)
}

func smtpTLSConfig(server string) *tls.Config {
	return &tls.Config{
		ServerName:         server,
		InsecureSkipVerify: SMTPInsecureSkipVerify, // #nosec G402 -- admin-controlled SMTP compatibility option.
	}
}

// newSMTPClient opens one SMTP submission. timeout bounds the whole
// exchange - TCP connect, TLS handshake and every command - through a single
// absolute connection deadline. Left unbounded, a stall on a lossy network
// waits on the kernel's TCP retransmit ladder (tens of minutes) inside
// whatever HTTP handler asked for the mail. The underlying connection comes
// back with the client so a caller can re-cut the deadline after the relay
// accepts the message.
func newSMTPClient(addr string, account SMTPAccountConfig, timeout time.Duration) (*smtp.Client, net.Conn, error) {
	deadline := time.Now().Add(timeout)
	dialer := &net.Dialer{Deadline: deadline}

	conn, err := dialer.Dial("tcp", addr)
	if err != nil {
		return nil, nil, err
	}
	// The connection deadline is inherited by the TLS wrapper and by every
	// command that follows, so one value bounds the entire exchange.
	if err := conn.SetDeadline(deadline); err != nil {
		_ = conn.Close()
		return nil, nil, err
	}

	implicitTLS := account.SSLEnabled || (account.Port == 465 && !account.StartTLS)
	var client *smtp.Client
	if implicitTLS {
		tlsConn := tls.Client(conn, smtpTLSConfig(account.Server))
		if err := tlsConn.Handshake(); err != nil {
			_ = conn.Close()
			return nil, nil, err
		}
		client, err = smtp.NewClient(tlsConn, account.Server)
	} else {
		client, err = smtp.NewClient(conn, account.Server)
	}
	if err != nil {
		_ = conn.Close()
		return nil, nil, err
	}

	if !implicitTLS && account.StartTLS {
		startTLSSupported, _ := client.Extension("STARTTLS")
		if !startTLSSupported {
			_ = client.Close()
			return nil, nil, fmt.Errorf("SMTP server does not support STARTTLS")
		}
		if err := client.StartTLS(smtpTLSConfig(account.Server)); err != nil {
			return nil, nil, err
		}
	}
	return client, conn, nil
}

// SendEmail delivers one message. Callers stay unaware of which upstream
// identity ends up sending it: the pool applies quota, priority and failover.
func SendEmail(subject string, receiver string, content string) error {
	msg := OutgoingMessage{Subject: subject, Receiver: receiver, Content: content}

	if len(SMTPAccountPool) == 0 {
		if SMTPServer == "" && SMTPAccount == "" {
			return fmt.Errorf("SMTP 服务器未配置")
		}
		return newSMTPSender(legacySMTPAccountConfig()).Send(msg)
	}
	return DefaultSenderPool().Send(msg)
}
