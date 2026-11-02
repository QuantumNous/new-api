package common

import (
	"encoding/base64"
	"fmt"
	"net"
	"strconv"
	"strings"
	"sync"
	"time"
)

// smtpSender is the SMTP implementation of EmailSender: one configured account
// plus the server it authenticates against.
type smtpSender struct {
	config SMTPAccountConfig

	mu          sync.Mutex
	lastSentAt  time.Time
	lastError   string
	lastErrorAt time.Time
}

func newSMTPSender(config SMTPAccountConfig) *smtpSender {
	return &smtpSender{config: config}
}

func (s *smtpSender) Send(msg OutgoingMessage) error {
	err := s.deliver(msg)

	s.mu.Lock()
	if err == nil {
		s.lastSentAt = time.Now()
	} else {
		s.lastError = err.Error()
		s.lastErrorAt = time.Now()
	}
	s.mu.Unlock()

	return err
}

func (s *smtpSender) Status() SenderStatus {
	s.mu.Lock()
	lastSentAt, lastError, lastErrorAt := s.lastSentAt, s.lastError, s.lastErrorAt
	s.mu.Unlock()

	usedToday, err := smtpQuotaUsedToday(s.config.Account)
	if err != nil {
		SysError(fmt.Sprintf("failed to read SMTP quota for %s: %v", s.config.Account, err))
	}

	remaining := -1 // unlimited
	if s.config.DailyLimit > 0 {
		remaining = s.config.DailyLimit - usedToday
	}

	return SenderStatus{
		Account:        s.config.Account,
		Server:         s.config.Server,
		Port:           s.config.Port,
		From:           s.envelopeFrom(),
		Priority:       s.config.Priority,
		DailyLimit:     s.config.DailyLimit,
		UsedToday:      usedToday,
		RemainingToday: remaining,
		LastSentAt:     lastSentAt,
		LastError:      lastError,
		LastErrorAt:    lastErrorAt,
	}
}

func (s *smtpSender) envelopeFrom() string {
	if s.config.From != "" {
		return s.config.From
	}
	return s.config.Account
}

func (s *smtpSender) deliver(msg OutgoingMessage) error {
	from := s.envelopeFrom()
	id, err := generateMessageID(from)
	if err != nil {
		return err
	}
	encodedSubject := fmt.Sprintf("=?UTF-8?B?%s?=", base64.StdEncoding.EncodeToString([]byte(msg.Subject)))
	mail := []byte(fmt.Sprintf("To: %s\r\n"+
		"From: %s <%s>\r\n"+
		"Subject: %s\r\n"+
		"Date: %s\r\n"+
		"Message-ID: %s\r\n"+
		"Content-Type: text/html; charset=UTF-8\r\n\r\n%s\r\n",
		msg.Receiver, SystemName, from, encodedSubject, time.Now().Format(time.RFC1123Z), id, msg.Content))

	client, conn, err := newSMTPClient(net.JoinHostPort(s.config.Server, strconv.Itoa(s.config.Port)), s.config, SMTPOperationTimeout)
	if err != nil {
		return err
	}
	defer client.Close()

	if s.config.Account != "" && s.config.Token != "" {
		if err = client.Auth(getSMTPAuth(s.config)); err != nil {
			return err
		}
	}
	if err = client.Mail(from); err != nil {
		return err
	}
	for _, receiver := range strings.Split(msg.Receiver, ";") {
		if err = client.Rcpt(receiver); err != nil {
			return err
		}
	}

	w, err := client.Data()
	if err != nil {
		return err
	}
	if _, err = w.Write(mail); err != nil {
		return err
	}
	if err = w.Close(); err != nil {
		return err
	}
	// The relay accepted the message once DATA closed with 250, so the
	// goodbye is cosmetic: PMail answers it with 421 "Idle timeout" when its
	// session window already closed. Give it a short window of its own, and
	// never let a failed QUIT reach the caller as a send failure.
	conn.SetDeadline(time.Now().Add(smtpQuitTimeout)) // #nosec G104 -- a live TCP conn accepts a deadline.
	if err := client.Quit(); err != nil {
		SysError(fmt.Sprintf("failed to quit SMTP session for %s: %v", from, err))
	}
	return nil
}
