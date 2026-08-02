package common

import (
	"context"
	"crypto/tls"
	"encoding/base64"
	"fmt"
	"net"
	"net/smtp"
	"slices"
	"strings"
	"time"
)

const defaultSMTPTimeout = 30 * time.Second

func generateMessageID() (string, error) {
	split := strings.Split(SMTPFrom, "@")
	if len(split) < 2 {
		return "", fmt.Errorf("invalid SMTP account")
	}
	domain := strings.Split(SMTPFrom, "@")[1]
	return fmt.Sprintf("<%d.%s@%s>", time.Now().UnixNano(), GetRandomString(12), domain), nil
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

func smtpTLSConfig() *tls.Config {
	return &tls.Config{
		ServerName:         SMTPServer,
		InsecureSkipVerify: SMTPInsecureSkipVerify, // #nosec G402 -- admin-controlled SMTP compatibility option.
	}
}

func dialSMTPClient(ctx context.Context, addr string) (*smtp.Client, net.Conn, error) {
	dialer := &net.Dialer{}
	conn, err := dialer.DialContext(ctx, "tcp", addr)
	if err != nil {
		return nil, nil, err
	}
	stopClose := context.AfterFunc(ctx, func() {
		_ = conn.Close()
	})
	defer stopClose()
	if deadline, ok := ctx.Deadline(); ok {
		if err := conn.SetDeadline(deadline); err != nil {
			_ = conn.Close()
			return nil, nil, err
		}
	}

	if SMTPSSLEnabled || (SMTPPort == 465 && !SMTPStartTLSEnabled) {
		tlsConn := tls.Client(conn, smtpTLSConfig())
		if err := tlsConn.HandshakeContext(ctx); err != nil {
			_ = conn.Close()
			return nil, nil, err
		}
		client, err := smtp.NewClient(tlsConn, SMTPServer)
		if err != nil {
			_ = conn.Close()
			return nil, nil, err
		}
		return client, conn, nil
	}

	client, err := smtp.NewClient(conn, SMTPServer)
	if err != nil {
		_ = conn.Close()
		return nil, nil, err
	}

	if SMTPStartTLSEnabled {
		startTLSSupported, _ := client.Extension("STARTTLS")
		if !startTLSSupported {
			_ = client.Close()
			return nil, nil, fmt.Errorf("SMTP server does not support STARTTLS")
		}
		if err := client.StartTLS(smtpTLSConfig()); err != nil {
			_ = client.Close()
			return nil, nil, err
		}
	}

	return client, conn, nil
}

func newSMTPClient(addr string) (*smtp.Client, error) {
	ctx, cancel := context.WithTimeout(context.Background(), defaultSMTPTimeout)
	defer cancel()
	client, _, err := dialSMTPClient(ctx, addr)
	return client, err
}

func SendEmail(subject string, receiver string, content string) error {
	return SendEmailContext(context.Background(), subject, receiver, content)
}

func SendEmailContext(parent context.Context, subject string, receiver string, content string) (err error) {
	if strings.ContainsAny(subject, "\r\n") || strings.ContainsAny(receiver, "\r\n") {
		return fmt.Errorf("email headers must not contain line breaks")
	}
	if SMTPFrom == "" { // for compatibility
		SMTPFrom = SMTPAccount
	}
	if strings.ContainsAny(SMTPFrom, "\r\n") || strings.ContainsAny(SystemName, "\r\n") {
		return fmt.Errorf("email headers must not contain line breaks")
	}
	id, err2 := generateMessageID()
	if err2 != nil {
		return err2
	}
	if SMTPServer == "" && SMTPAccount == "" {
		return fmt.Errorf("SMTP 服务器未配置")
	}
	encodedSubject := fmt.Sprintf("=?UTF-8?B?%s?=", base64.StdEncoding.EncodeToString([]byte(subject)))
	mail := []byte(fmt.Sprintf("To: %s\r\n"+
		"From: %s <%s>\r\n"+
		"Subject: %s\r\n"+
		"Date: %s\r\n"+
		"Message-ID: %s\r\n"+ // 添加 Message-ID 头
		"Content-Type: text/html; charset=UTF-8\r\n\r\n%s\r\n",
		receiver, SystemName, SMTPFrom, encodedSubject, time.Now().Format(time.RFC1123Z), id, content))
	auth := getSMTPAuth()
	addr := fmt.Sprintf("%s:%d", SMTPServer, SMTPPort)
	to := strings.Split(receiver, ";")
	ctx, cancel := context.WithTimeout(parent, defaultSMTPTimeout)
	defer cancel()
	client, conn, err := dialSMTPClient(ctx, addr)
	if err != nil {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		return err
	}
	stopClose := context.AfterFunc(ctx, func() {
		_ = conn.Close()
	})
	defer stopClose()
	defer client.Close()
	defer func() {
		if err != nil && ctx.Err() != nil {
			err = ctx.Err()
		}
	}()
	if shouldAuthenticateSMTP() {
		if err = client.Auth(auth); err != nil {
			return err
		}
	}
	if err = client.Mail(SMTPFrom); err != nil {
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
