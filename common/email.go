package common

import (
	"crypto/tls"
	"encoding/base64"
	"errors"
	"fmt"
	"net"
	"net/mail"
	"net/smtp"
	"regexp"
	"slices"
	"strings"
	"time"
)

var emailMessageIDPattern = regexp.MustCompile(`^<[A-Za-z0-9][A-Za-z0-9._-]*@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?>$`)

var smtpSessionTimeout = 30 * time.Second

type emailSendError struct {
	Uncertain bool
	Err       error
}

type SMTPConfig struct {
	Server         string
	Port           int
	Account        string
	From           string
	Token          string
	SSLEnabled     bool
	ForceAuthLogin bool
}

func (c SMTPConfig) Validate() error {
	if strings.TrimSpace(c.Server) == "" {
		return fmt.Errorf("SMTP server is required")
	}
	if c.Port < 1 || c.Port > 65535 {
		return fmt.Errorf("SMTP port must be between 1 and 65535")
	}
	if strings.TrimSpace(c.Account) == "" {
		return fmt.Errorf("SMTP account is required")
	}
	if strings.TrimSpace(c.Token) == "" {
		return fmt.Errorf("SMTP token is required")
	}
	_, _, err := c.Sender()
	return err
}

func (c SMTPConfig) Sender() (string, string, error) {
	return parsePlainMailbox(strings.TrimSpace(c.From), "invalid SMTP sender")
}

func GlobalSMTPConfig() SMTPConfig {
	from := strings.TrimSpace(SMTPFrom)
	if from == "" {
		from = strings.TrimSpace(SMTPAccount)
	}
	return SMTPConfig{
		Server:         SMTPServer,
		Port:           SMTPPort,
		Account:        SMTPAccount,
		From:           from,
		Token:          SMTPToken,
		SSLEnabled:     SMTPSSLEnabled,
		ForceAuthLogin: SMTPForceAuthLogin,
	}
}

func (e *emailSendError) Error() string {
	if e == nil || e.Err == nil {
		return "email send failed"
	}
	return e.Err.Error()
}

func (e *emailSendError) Unwrap() error {
	if e == nil {
		return nil
	}
	return e.Err
}

func IsEmailSendUncertain(err error) bool {
	var sendErr *emailSendError
	return errors.As(err, &sendErr) && sendErr.Uncertain
}

func EmailMessageIDDomain() (string, error) {
	_, domain, err := GlobalSMTPConfig().Sender()
	return domain, err
}

func effectiveSMTPSender() (string, string, error) {
	return GlobalSMTPConfig().Sender()
}

func validEmailDomain(domain string) bool {
	if len(domain) > 253 || strings.Contains(domain, "..") {
		return false
	}
	for _, label := range strings.Split(domain, ".") {
		if label == "" || len(label) > 63 || label[0] == '-' || label[len(label)-1] == '-' {
			return false
		}
		for _, char := range label {
			if (char < 'a' || char > 'z') && (char < 'A' || char > 'Z') && (char < '0' || char > '9') && char != '-' {
				return false
			}
		}
	}
	return true
}

func generateMessageID() (string, error) {
	domain, err := EmailMessageIDDomain()
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("<%d.%s@%s>", time.Now().UnixNano(), GetRandomString(12), domain), nil
}

func shouldUseSMTPLoginAuth(config SMTPConfig) bool {
	if config.ForceAuthLogin {
		return true
	}
	return isOutlookServer(config.Account) || slices.Contains(EmailLoginAuthServerList, config.Server)
}

func getSMTPAuth(config SMTPConfig) smtp.Auth {
	if shouldUseSMTPLoginAuth(config) {
		return LoginAuth(config.Account, config.Token)
	}
	return smtp.PlainAuth("", config.Account, config.Token, config.Server)
}

func SendEmail(subject string, receiver string, content string) error {
	messageID, err := generateMessageID()
	if err != nil {
		return err
	}
	return SendEmailWithMessageID(subject, receiver, content, messageID)
}

func SendEmailWithMessageID(subject string, receiver string, content string, messageID string) error {
	return sendEmailWithSMTPConfigAndLogPolicy(GlobalSMTPConfig(), subject, receiver, content, messageID, true, EmailOptions{})
}

func SendEmailFromWithMessageID(from string, subject string, receiver string, content string, messageID string) error {
	config := GlobalSMTPConfig()
	config.From = from
	return sendEmailWithSMTPConfigAndLogPolicy(config, subject, receiver, content, messageID, true, EmailOptions{})
}

func SendEmailWithSMTPConfig(config SMTPConfig, subject string, receiver string, content string, messageID string) error {
	return SendEmailWithSMTPConfigAndOptions(config, subject, receiver, content, messageID, EmailOptions{})
}

// SendEmailWithSMTPConfigAndOptions sends bulk mail with the deliverability
// headers mailbox providers require. Activity delivery uses this path.
func SendEmailWithSMTPConfigAndOptions(config SMTPConfig, subject string, receiver string, content string, messageID string, options EmailOptions) error {
	if err := config.Validate(); err != nil {
		return err
	}
	return sendEmailWithSMTPConfigAndLogPolicy(config, subject, receiver, content, messageID, false, options)
}

func sendEmailWithSMTPConfig(config SMTPConfig, subject string, receiver string, content string, messageID string) error {
	return sendEmailWithSMTPConfigAndLogPolicy(config, subject, receiver, content, messageID, false, EmailOptions{})
}

func sendEmailWithSMTPConfigAndLogPolicy(config SMTPConfig, subject string, receiver string, content string, messageID string, logTransportFailure bool, options EmailOptions) error {
	if config.Server == "" && config.Account == "" {
		return fmt.Errorf("SMTP 服务器未配置")
	}
	sender, _, err := config.Sender()
	if err != nil {
		return err
	}
	message, err := buildEmailMessageFromWithOptions(sender, subject, receiver, content, messageID, options)
	if err != nil {
		return err
	}
	recipients, err := emailRecipients(receiver)
	if err != nil {
		return err
	}

	auth := getSMTPAuth(config)
	addr := fmt.Sprintf("%s:%d", config.Server, config.Port)
	if config.Port == 465 || config.SSLEnabled {
		return sendEmailTLS(config, addr, sender, recipients, auth, message, logTransportFailure)
	}
	if !logTransportFailure {
		return sendEmailSMTPByPhase(config, addr, sender, recipients, auth, message)
	}
	if err := smtp.SendMail(addr, auth, sender, recipients, message); err != nil {
		wrapped := &emailSendError{Uncertain: true, Err: err}
		if logTransportFailure {
			SysError(fmt.Sprintf("failed to send email to %s: %v", receiver, wrapped))
		}
		return wrapped
	}
	return nil
}

func sendEmailSMTPByPhase(config SMTPConfig, addr string, sender string, recipients []string, auth smtp.Auth, message []byte) error {
	dialer := net.Dialer{Timeout: smtpSessionTimeout}
	conn, err := dialer.Dial("tcp", addr)
	if err != nil {
		return &emailSendError{Err: err}
	}
	_ = conn.SetDeadline(time.Now().Add(smtpSessionTimeout))
	client, err := smtp.NewClient(conn, config.Server)
	if err != nil {
		_ = conn.Close()
		return &emailSendError{Err: err}
	}
	defer client.Close()
	if ok, _ := client.Extension("STARTTLS"); ok {
		tlsConfig := &tls.Config{ServerName: config.Server}
		if err := client.StartTLS(tlsConfig); err != nil {
			return &emailSendError{Err: err}
		}
	} else if auth != nil && !isLocalSMTPHost(config.Server) {
		return &emailSendError{Err: fmt.Errorf("SMTP server %s does not advertise STARTTLS; refusing plaintext SMTP auth", config.Server)}
	}
	if auth != nil {
		if err := client.Auth(auth); err != nil {
			return &emailSendError{Err: err}
		}
	}
	if err := client.Mail(sender); err != nil {
		return &emailSendError{Err: err}
	}
	for _, receiver := range recipients {
		if err := client.Rcpt(receiver); err != nil {
			return &emailSendError{Err: err}
		}
	}
	w, err := client.Data()
	if err != nil {
		return &emailSendError{Err: err}
	}
	if _, err := w.Write(message); err != nil {
		return &emailSendError{Uncertain: true, Err: err}
	}
	if err := w.Close(); err != nil {
		return &emailSendError{Uncertain: true, Err: err}
	}
	return nil
}

func buildEmailMessage(subject string, receiver string, content string, messageID string) ([]byte, error) {
	sender, _, err := effectiveSMTPSender()
	if err != nil {
		return nil, err
	}
	return buildEmailMessageFrom(sender, subject, receiver, content, messageID)
}

func buildEmailMessageFrom(fromAddress string, subject string, receiver string, content string, messageID string) ([]byte, error) {
	return buildEmailMessageFromWithOptions(fromAddress, subject, receiver, content, messageID, EmailOptions{})
}

func buildEmailMessageFromWithOptions(fromAddress string, subject string, receiver string, content string, messageID string, options EmailOptions) ([]byte, error) {
	if containsEmailHeaderBreak(subject) || containsEmailHeaderBreak(receiver) || containsEmailHeaderBreak(messageID) {
		return nil, fmt.Errorf("email headers must not contain CR or LF")
	}
	if err := ValidateEmailMessageID(messageID); err != nil {
		return nil, err
	}
	sender, _, err := parsePlainMailbox(fromAddress, "invalid SMTP sender")
	if err != nil {
		return nil, err
	}
	if containsEmailHeaderBreak(SystemName) {
		return nil, fmt.Errorf("invalid email sender name")
	}
	recipients, err := emailRecipients(receiver)
	if err != nil {
		return nil, err
	}
	from := (&mail.Address{Name: SystemName, Address: sender}).String()
	encodedSubject := fmt.Sprintf("=?UTF-8?B?%s?=", base64.StdEncoding.EncodeToString([]byte(subject)))

	var headers strings.Builder
	headers.WriteString("To: " + strings.Join(recipients, ", ") + "\r\n")
	headers.WriteString("From: " + from + "\r\n")
	// An unusable Reply-To is dropped rather than failing the send; it is a
	// scoring nicety, not a delivery requirement.
	if replyTo := strings.TrimSpace(options.ReplyTo); replyTo != "" {
		if address, _, replyErr := parsePlainMailbox(replyTo, "invalid Reply-To address"); replyErr == nil {
			headers.WriteString("Reply-To: " + address + "\r\n")
		}
	}
	headers.WriteString("Subject: " + encodedSubject + "\r\n")
	headers.WriteString("Date: " + time.Now().Format(time.RFC1123Z) + "\r\n")
	headers.WriteString("Message-ID: " + messageID + "\r\n")
	if value, oneClick := options.listUnsubscribeHeaderValue(); value != "" {
		headers.WriteString("List-Unsubscribe: " + value + "\r\n")
		// RFC 8058 one-click.
		if oneClick {
			headers.WriteString("List-Unsubscribe-Post: List-Unsubscribe=One-Click\r\n")
		}
	}
	// MIME-Version is required by RFC 2045 whenever Content-Type is declared.
	headers.WriteString("MIME-Version: 1.0\r\n")

	if !options.Multipart {
		headers.WriteString("Content-Type: text/html; charset=UTF-8\r\n")
		headers.WriteString("Content-Transfer-Encoding: quoted-printable\r\n\r\n")
		headers.WriteString(quotedPrintableEncode(content) + "\r\n")
		return []byte(headers.String()), nil
	}

	textBody := strings.TrimSpace(options.TextBody)
	if textBody == "" {
		textBody = htmlToPlainText(content)
	}
	boundary := mimeBoundary(messageID)
	headers.WriteString("Content-Type: multipart/alternative; boundary=\"" + boundary + "\"\r\n\r\n")
	// Least-preferred alternative first, per RFC 2046: clients render the last
	// part they can display, so text/html must come second.
	headers.WriteString("--" + boundary + "\r\n")
	headers.WriteString("Content-Type: text/plain; charset=UTF-8\r\n")
	headers.WriteString("Content-Transfer-Encoding: quoted-printable\r\n\r\n")
	headers.WriteString(quotedPrintableEncode(textBody) + "\r\n")
	headers.WriteString("--" + boundary + "\r\n")
	headers.WriteString("Content-Type: text/html; charset=UTF-8\r\n")
	headers.WriteString("Content-Transfer-Encoding: quoted-printable\r\n\r\n")
	headers.WriteString(quotedPrintableEncode(content) + "\r\n")
	headers.WriteString("--" + boundary + "--\r\n")
	return []byte(headers.String()), nil
}

func ValidateEmailMessageID(messageID string) error {
	if containsEmailHeaderBreak(messageID) || !validEmailMessageID(messageID) {
		return fmt.Errorf("invalid email Message-ID")
	}
	return nil
}

func validEmailMessageID(messageID string) bool {
	if !emailMessageIDPattern.MatchString(messageID) {
		return false
	}
	inner := messageID[1 : len(messageID)-1]
	at := strings.LastIndexByte(inner, '@')
	if at <= 0 || at >= len(inner)-1 {
		return false
	}
	domain := inner[at+1:]
	return domain == strings.ToLower(domain) && validEmailDomain(domain)
}

func emailRecipients(receiver string) ([]string, error) {
	if containsEmailHeaderBreak(receiver) {
		return nil, fmt.Errorf("email receiver must not contain CR or LF")
	}
	parts := strings.Split(receiver, ";")
	recipients := make([]string, 0, len(parts))
	for _, part := range parts {
		address := strings.TrimSpace(part)
		parsed, err := mail.ParseAddress(address)
		if err != nil || parsed.Address != address {
			return nil, fmt.Errorf("invalid email receiver")
		}
		recipients = append(recipients, address)
	}
	if len(recipients) == 0 {
		return nil, fmt.Errorf("email receiver is required")
	}
	return recipients, nil
}

func containsEmailHeaderBreak(value string) bool {
	return strings.ContainsAny(value, "\r\n")
}

func sendEmailTLS(config SMTPConfig, addr string, sender string, recipients []string, auth smtp.Auth, message []byte, allowInsecureCertificate bool) error {
	tlsConfig := &tls.Config{
		InsecureSkipVerify: allowInsecureCertificate,
		ServerName:         config.Server,
	}
	dialer := net.Dialer{Timeout: smtpSessionTimeout}
	conn, err := tls.DialWithDialer(&dialer, "tcp", addr, tlsConfig)
	if err != nil {
		return &emailSendError{Err: err}
	}
	_ = conn.SetDeadline(time.Now().Add(smtpSessionTimeout))
	client, err := smtp.NewClient(conn, config.Server)
	if err != nil {
		_ = conn.Close()
		return &emailSendError{Err: err}
	}
	defer client.Close()
	if err := client.Auth(auth); err != nil {
		return &emailSendError{Err: err}
	}
	if err := client.Mail(sender); err != nil {
		return &emailSendError{Err: err}
	}
	for _, receiver := range recipients {
		if err := client.Rcpt(receiver); err != nil {
			return &emailSendError{Err: err}
		}
	}
	w, err := client.Data()
	if err != nil {
		return &emailSendError{Err: err}
	}
	// Once DATA starts, conservatively treat every write/final-response error as uncertain.
	// Some SMTP replies are definite rejects, but duplicate suppression is safer here.
	if _, err := w.Write(message); err != nil {
		return &emailSendError{Uncertain: true, Err: err}
	}
	if err := w.Close(); err != nil {
		return &emailSendError{Uncertain: true, Err: err}
	}
	return nil
}

func isLocalSMTPHost(host string) bool {
	normalized := strings.Trim(strings.ToLower(strings.TrimSpace(host)), "[]")
	if normalized == "localhost" {
		return true
	}
	ip := net.ParseIP(normalized)
	return ip != nil && ip.IsLoopback()
}
