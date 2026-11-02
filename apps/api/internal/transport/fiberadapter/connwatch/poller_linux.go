//go:build linux

package connwatch

import (
	"errors"

	"golang.org/x/sys/unix"
)

// epoll-based poller. Watches EPOLLRDHUP (peer half-closed write side, i.e.
// FIN), EPOLLHUP (both halves), and EPOLLERR (errors including RST).
//
// Each accepted connection is registered with EPOLLONESHOT and a fresh token
// in the epoll data union (Fd field, low 32 bits). wait() returns the token
// the kernel echoes back, never a raw fd: if the fd was closed and re-accepted
// before a stale event was processed, the token lookup misses and the event is
// dropped instead of firing the new connection's done.
//
// EPOLLONESHOT disarms the fd after its first event; deregister on Close is
// what re-releases it, and re-register on the next Accept re-arms it.
type epollPoller struct {
	epfd   int
	wakeup [2]int // pipe; close writer side to make EpollWait return
}

func newPoller() (poller, error) {
	epfd, err := unix.EpollCreate1(unix.EPOLL_CLOEXEC)
	if err != nil {
		return nil, err
	}

	var pipes [2]int
	if err := unix.Pipe2(pipes[:], unix.O_CLOEXEC|unix.O_NONBLOCK); err != nil {
		_ = unix.Close(epfd)
		return nil, err
	}

	// Register the pipe read end so closing the write end wakes EpollWait via EPOLLHUP.
	ev := unix.EpollEvent{Events: unix.EPOLLIN, Fd: 0}
	if err := unix.EpollCtl(epfd, unix.EPOLL_CTL_ADD, pipes[0], &ev); err != nil {
		_ = unix.Close(epfd)
		_ = unix.Close(pipes[0])
		_ = unix.Close(pipes[1])
		return nil, err
	}

	return &epollPoller{epfd: epfd, wakeup: pipes}, nil
}

func (p *epollPoller) register(fd int, token int32) error {
	// token is embedded in the epoll data union (Fd field, low 32 bits of
	// data at offset 8) so the kernel echoes it back on the event.
	ev := unix.EpollEvent{
		Events: unix.EPOLLONESHOT | unix.EPOLLRDHUP | unix.EPOLLHUP | unix.EPOLLERR,
		Fd:     token,
	}
	return unix.EpollCtl(p.epfd, unix.EPOLL_CTL_ADD, fd, &ev)
}

func (p *epollPoller) deregister(fd int, token int32) error {
	err := unix.EpollCtl(p.epfd, unix.EPOLL_CTL_DEL, fd, nil)
	if errors.Is(err, unix.ENOENT) {
		return nil
	}
	return err
}

func (p *epollPoller) wait() ([]int32, error) {
	events := make([]unix.EpollEvent, 64)
	for {
		n, err := unix.EpollWait(p.epfd, events, -1)
		if err != nil {
			if errors.Is(err, unix.EINTR) {
				continue
			}
			return nil, err
		}
		tokens := make([]int32, 0, n)
		for i := range n {
			token := events[i].Fd
			if token == 0 {
				return nil, errPollerClosed
			}
			tokens = append(tokens, token)
		}
		if len(tokens) == 0 {
			continue
		}
		return tokens, nil
	}
}

func (p *epollPoller) close() error {
	_ = unix.Close(p.wakeup[1])
	_ = unix.Close(p.wakeup[0])
	return unix.Close(p.epfd)
}

var errPollerClosed = errors.New("connwatch: poller closed")
