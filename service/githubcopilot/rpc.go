package githubcopilot

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"

	"github.com/QuantumNous/new-api/common"
)

const maxRPCPayloadBytes = 32 << 20

var errRPCClosed = errors.New("Copilot RPC process is not running")

type rpcError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type rpcMessage struct {
	ID     *uint64         `json:"id"`
	Result json.RawMessage `json:"result"`
	Error  *rpcError       `json:"error"`
	Method string          `json:"method"`
}

type rpcClient struct {
	stdin  io.WriteCloser
	reader *bufio.Reader

	writeMu sync.Mutex
	nextID  atomic.Uint64

	pendingMu sync.Mutex
	pending   map[uint64]chan rpcMessage

	closeOnce sync.Once
	closed    chan struct{}
}

func newRPCClient(stdin io.WriteCloser, stdout io.Reader) *rpcClient {
	client := &rpcClient{
		stdin:   stdin,
		reader:  bufio.NewReaderSize(stdout, 64<<10),
		pending: make(map[uint64]chan rpcMessage),
		closed:  make(chan struct{}),
	}
	go client.readLoop()
	return client
}

func (c *rpcClient) Call(ctx context.Context, method string, params any, result any) error {
	select {
	case <-c.closed:
		return errRPCClosed
	default:
	}
	id := c.nextID.Add(1)
	request := map[string]any{
		"jsonrpc": "2.0",
		"id":      id,
		"method":  method,
		"params":  params,
	}
	payload, err := common.Marshal(request)
	if err != nil {
		return err
	}
	responseCh := make(chan rpcMessage, 1)
	c.pendingMu.Lock()
	c.pending[id] = responseCh
	c.pendingMu.Unlock()
	defer func() {
		c.pendingMu.Lock()
		delete(c.pending, id)
		c.pendingMu.Unlock()
	}()

	c.writeMu.Lock()
	_, err = fmt.Fprintf(c.stdin, "Content-Length: %d\r\n\r\n", len(payload))
	if err == nil {
		_, err = c.stdin.Write(payload)
	}
	c.writeMu.Unlock()
	if err != nil {
		return fmt.Errorf("write Copilot RPC request: %w", err)
	}

	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-c.closed:
		return errRPCClosed
	case response, ok := <-responseCh:
		if !ok {
			return errRPCClosed
		}
		if response.Error != nil {
			message := strings.TrimSpace(response.Error.Message)
			if message == "" {
				message = "unknown JSON-RPC error"
			}
			return fmt.Errorf("Copilot RPC %s failed: %s", method, message)
		}
		if result == nil || len(response.Result) == 0 {
			return nil
		}
		if err := common.Unmarshal(response.Result, result); err != nil {
			return fmt.Errorf("decode Copilot RPC %s response: %w", method, err)
		}
		return nil
	}
}

func (c *rpcClient) readLoop() {
	for {
		payload, err := c.readFrame()
		if err != nil {
			c.closeWithError()
			return
		}
		var message rpcMessage
		if err := common.Unmarshal(payload, &message); err != nil {
			c.closeWithError()
			return
		}
		if message.ID == nil {
			continue
		}
		c.pendingMu.Lock()
		responseCh := c.pending[*message.ID]
		c.pendingMu.Unlock()
		if responseCh == nil {
			continue
		}
		select {
		case responseCh <- message:
		default:
		}
	}
}

func (c *rpcClient) readFrame() ([]byte, error) {
	contentLength := -1
	for {
		line, err := c.reader.ReadString('\n')
		if err != nil {
			return nil, err
		}
		line = strings.TrimRight(line, "\r\n")
		if line == "" {
			break
		}
		name, value, ok := strings.Cut(line, ":")
		if !ok || !strings.EqualFold(strings.TrimSpace(name), "Content-Length") {
			continue
		}
		length, err := strconv.Atoi(strings.TrimSpace(value))
		if err != nil || length < 0 || length > maxRPCPayloadBytes {
			return nil, fmt.Errorf("invalid Copilot RPC Content-Length")
		}
		contentLength = length
	}
	if contentLength < 0 {
		return nil, fmt.Errorf("missing Copilot RPC Content-Length")
	}
	payload := make([]byte, contentLength)
	if _, err := io.ReadFull(c.reader, payload); err != nil {
		return nil, err
	}
	return payload, nil
}

func (c *rpcClient) Close() {
	c.closeWithError()
}

func (c *rpcClient) closeWithError() {
	c.closeOnce.Do(func() {
		close(c.closed)
		_ = c.stdin.Close()
		c.pendingMu.Lock()
		clear(c.pending)
		c.pendingMu.Unlock()
	})
}

func (c *rpcClient) IsClosed() bool {
	select {
	case <-c.closed:
		return true
	default:
		return false
	}
}
