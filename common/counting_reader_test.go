package common

import (
	"io"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

// TestCountingReaderTalliesPartialReadBeforeError is the whole point of the
// counter: on a truncated upload io.ReadAll throws away what it read, so the
// count must survive the error or the diagnostic cannot tell "client sent
// nothing" from "client stalled midway".
func TestCountingReaderTalliesPartialReadBeforeError(t *testing.T) {
	// 10 bytes then a truncation, exactly like a body cut short of Content-Length.
	truncated := io.MultiReader(strings.NewReader("0123456789"), errReader{io.ErrUnexpectedEOF})
	cr := &countingReader{r: truncated}

	_, err := io.ReadAll(cr)

	require.ErrorIs(t, err, io.ErrUnexpectedEOF)
	require.Equal(t, int64(10), cr.n, "must report bytes actually delivered before the cut")
}

func TestCountingReaderReportsZeroWhenNothingArrives(t *testing.T) {
	cr := &countingReader{r: errReader{io.ErrUnexpectedEOF}}
	_, err := io.ReadAll(cr)
	require.ErrorIs(t, err, io.ErrUnexpectedEOF)
	require.Equal(t, int64(0), cr.n, "a client that sent no body at all must read 0")
}

type errReader struct{ err error }

func (e errReader) Read([]byte) (int, error) { return 0, e.err }
