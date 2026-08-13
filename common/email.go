package common

import (
	"crypto/tls"
	"encoding/base64"
	"fmt"
	"net/mail"
	"net/smtp"
	"slices"
	"strings"
	"time"
)

func generateMessageID() (string, error) {
	address, err := effectiveSMTPFromAddress()
	if err != nil {
		return "", fmt.Errorf("invalid SMTP account")
	}
	split := strings.Split(address, "@")
	if len(split) != 2 {
		return "", fmt.Errorf("invalid SMTP account")
	}
	domain := split[1]
	return fmt.Sprintf("<%d.%s@%s>", time.Now().UnixNano(), GetRandomString(12), domain), nil
}

func effectiveSMTPFrom() string {
	from := strings.TrimSpace(SMTPFrom)
	if from == "" {
		from = strings.TrimSpace(SMTPAccount)
	}
	return from
}

func effectiveSMTPFromAddress() (string, error) {
	address, err := ParseSMTPFromAddress(effectiveSMTPFrom())
	if err != nil {
		return "", err
	}
	return address.Address, nil
}

func ParseSMTPFromAddress(from string) (*mail.Address, error) {
	from = strings.TrimSpace(from)
	if from == "" {
		return nil, fmt.Errorf("invalid SMTP account")
	}
	address, err := mail.ParseAddress(from)
	if err != nil {
		return nil, err
	}
	return address, nil
}

func formattedSMTPFrom() (string, error) {
	address, err := ParseSMTPFromAddress(effectiveSMTPFrom())
	if err != nil {
		return "", err
	}
	if address.Name != "" {
		return address.String(), nil
	}
	return (&mail.Address{
		Name:    SystemName,
		Address: address.Address,
	}).String(), nil
}

func validSMTPFrom(from string) bool {
	_, err := ParseSMTPFromAddress(from)
	return err == nil
}

func shouldUseSMTPLoginAuth() bool {
	if SMTPForceAuthLogin {
		return true
	}
	return isOutlookServer(SMTPAccount) || slices.Contains(EmailLoginAuthServerList, SMTPServer)
}

func getSMTPAuth() smtp.Auth {
	return AutoSMTPAuth(SMTPAccount, SMTPToken)
}

func shouldAuthenticateSMTP() bool {
	return SMTPAccount != "" && SMTPToken != ""
}

// SMTPConfigured reports whether the minimum static SMTP configuration needed
// by email-dependent authentication flows is present. It deliberately does
// not perform network I/O; runtime delivery still reports provider failures.
func SMTPConfigured() bool {
	return strings.TrimSpace(SMTPServer) != "" &&
		SMTPPort > 0 && SMTPPort <= 65535 &&
		strings.TrimSpace(SMTPAccount) != "" &&
		strings.TrimSpace(SMTPToken) != "" &&
		validSMTPFrom(effectiveSMTPFrom()) &&
		!(SMTPSSLEnabled && SMTPStartTLSEnabled)
}

func smtpTLSConfig() *tls.Config {
	return &tls.Config{
		ServerName:         SMTPServer,
		InsecureSkipVerify: SMTPInsecureSkipVerify, // #nosec G402 -- admin-controlled SMTP compatibility option.
	}
}

func newSMTPClient(addr string) (*smtp.Client, error) {
	if SMTPSSLEnabled || (SMTPPort == 465 && !SMTPStartTLSEnabled) {
		conn, err := tls.Dial("tcp", addr, smtpTLSConfig())
		if err != nil {
			return nil, err
		}
		client, err := smtp.NewClient(conn, SMTPServer)
		if err != nil {
			_ = conn.Close()
			return nil, err
		}
		return client, nil
	}

	client, err := smtp.Dial(addr)
	if err != nil {
		return nil, err
	}

	if SMTPStartTLSEnabled {
		startTLSSupported, _ := client.Extension("STARTTLS")
		if !startTLSSupported {
			_ = client.Close()
			return nil, fmt.Errorf("SMTP server does not support STARTTLS")
		}
		if err := client.StartTLS(smtpTLSConfig()); err != nil {
			_ = client.Close()
			return nil, err
		}
	}

	return client, nil
}

func SendEmail(subject string, receiver string, content string) error {
	fromHeader, err := formattedSMTPFrom()
	if err != nil {
		return err
	}
	fromAddress, err := effectiveSMTPFromAddress()
	if err != nil {
		return err
	}
	id, err := generateMessageID()
	if err != nil {
		return err
	}
	if SMTPServer == "" && SMTPAccount == "" {
		return fmt.Errorf("SMTP 服务器未配置")
	}
	encodedSubject := fmt.Sprintf("=?UTF-8?B?%s?=", base64.StdEncoding.EncodeToString([]byte(subject)))
	mail := []byte(fmt.Sprintf("To: %s\r\n"+
		"From: %s\r\n"+
		"Subject: %s\r\n"+
		"Date: %s\r\n"+
		"Message-ID: %s\r\n"+ // 添加 Message-ID 头
		"Content-Type: text/html; charset=UTF-8\r\n\r\n%s\r\n",
		receiver, fromHeader, encodedSubject, time.Now().Format(time.RFC1123Z), id, content))
	auth := getSMTPAuth()
	addr := fmt.Sprintf("%s:%d", SMTPServer, SMTPPort)
	to := strings.Split(receiver, ";")
	client, err := newSMTPClient(addr)
	if err != nil {
		return err
	}
	defer client.Close()
	if shouldAuthenticateSMTP() {
		if err = client.Auth(auth); err != nil {
			return err
		}
	}
	if err = client.Mail(fromAddress); err != nil {
		return err
	}
	for _, receiver := range to {
		if err = client.Rcpt(receiver); err != nil {
			return err
		}
	}
	w, err := client.Data()
	if err != nil {
		return err
	}
	_, err = w.Write(mail)
	if err != nil {
		return err
	}
	err = w.Close()
	if err != nil {
		return err
	}
	err = client.Quit()
	if err != nil {
		SysError(fmt.Sprintf("failed to send email to %s: %v", receiver, err))
	}
	return err
}
