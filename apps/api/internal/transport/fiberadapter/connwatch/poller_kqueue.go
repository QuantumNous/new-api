//go:build darwin || freebsd || netbsd || openbsd || dragonfly

package connwatch

import (
	"errors"
	"sync"

	"golang.org/x/sys/unix"
)

// kqueue-based poller. EVFILT_READ also fires when data is readable, so
// we only treat it as a disconnect when EV_EOF (or EV_ERROR) is set.
//
// kqueue has no per-registration data echo like epoll's union, so the token
// is recorded here (fd -> token) instead of in the kernel event. wait() maps
// the reported fd back to its token before returning it, and a token that
// maps to nothing (the conn was already closed, or its fd was re-accepted by
// a newer conn) resolves to that conn's token only if it is still registered.
//
// EV_CLEAR (absent upstream) makes the read filter edge-triggered: without
// it, a keep-alive connection with unread data re-arms the event on every
// kevent return and the watcher loop spins. EOF/HUP state persists in the
// kernel across the clear, so disconnects still fire.
//
// EVFILT_USER is just used to nudge Kevent on close().
type kqueuePoller struct {
	kqfd   int
	tokens map[int]int32 // fd -> registration token
	mu     sync.Mutex
}

const wakeIdent = 1

func newPoller() (poller, error) {
	kqfd, err := unix.Kqueue()
	if err != nil {
		return nil, err
	}
	ev := unix.Kevent_t{
		Ident:  wakeIdent,
		Filter: unix.EVFILT_USER,
		Flags:  unix.EV_ADD | unix.EV_CLEAR,
	}
	if _, err := unix.Kevent(kqfd, []unix.Kevent_t{ev}, nil, nil); err != nil {
		_ = unix.Close(kqfd)
		return nil, err
	}
	return &kqueuePoller{kqfd: kqfd, tokens: make(map[int]int32)}, nil
}

func (p *kqueuePoller) register(fd int, token int32) error {
	ev := unix.Kevent_t{
		Ident:  uint64(fd),
		Filter: unix.EVFILT_READ,
		Flags:  unix.EV_ADD | unix.EV_CLEAR,
	}
	if _, err := unix.Kevent(p.kqfd, []unix.Kevent_t{ev}, nil, nil); err != nil {
		return err
	}
	p.mu.Lock()
	p.tokens[fd] = token
	p.mu.Unlock()
	return nil
}

func (p *kqueuePoller) deregister(fd int, token int32) error {
	ev := unix.Kevent_t{
		Ident:  uint64(fd),
		Filter: unix.EVFILT_READ,
		Flags:  unix.EV_DELETE,
	}
	_, err := unix.Kevent(p.kqfd, []unix.Kevent_t{ev}, nil, nil)
	if errors.Is(err, unix.ENOENT) {
		err = nil
	}
	p.mu.Lock()
	delete(p.tokens, fd)
	p.mu.Unlock()
	return err
}

func (p *kqueuePoller) wait() ([]int32, error) {
	events := make([]unix.Kevent_t, 64)
	for {
		n, err := unix.Kevent(p.kqfd, nil, events, nil)
		if err != nil {
			if errors.Is(err, unix.EINTR) {
				continue
			}
			return nil, err
		}
		tokens := make([]int32, 0, n)
		for i := range n {
			e := events[i]
			if e.Filter == unix.EVFILT_USER && e.Ident == wakeIdent {
				return nil, errPollerClosed
			}
			if e.Flags&unix.EV_EOF != 0 || e.Flags&unix.EV_ERROR != 0 {
				p.mu.Lock()
				tok, ok := p.tokens[int(e.Ident)]
				p.mu.Unlock()
				if ok {
					tokens = append(tokens, tok)
				}
			}
		}
		if len(tokens) == 0 {
			continue
		}
		return tokens, nil
	}
}

func (p *kqueuePoller) close() error {
	wake := unix.Kevent_t{
		Ident:  wakeIdent,
		Filter: unix.EVFILT_USER,
		Fflags: unix.NOTE_TRIGGER,
	}
	_, _ = unix.Kevent(p.kqfd, []unix.Kevent_t{wake}, nil, nil)
	return unix.Close(p.kqfd)
}

var errPollerClosed = errors.New("connwatch: poller closed")
