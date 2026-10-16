package proto_test

import (
	"bytes"
	"encoding"
	"testing"
	"time"

	. "github.com/onsi/ginkgo"
	. "github.com/onsi/gomega"

	"github.com/go-redis/redis/v8/internal/proto"
)

type MyType struct{}

var _ encoding.BinaryMarshaler = (*MyType)(nil)

func (t *MyType) MarshalBinary() ([]byte, error) {
	return []byte("hello"), nil
}

var _ = Describe("WriteBuffer", func() {
	var buf *bytes.Buffer
	var wr *proto.Writer

	BeforeEach(func() {
		buf = new(bytes.Buffer)
		wr = proto.NewWriter(buf)
	})

	It("should write args", func() {
		err := wr.WriteArgs([]interface{}{
			"string",
			12,
			34.56,
			[]byte{'b', 'y', 't', 'e', 's'},
			true,
			nil,
		})
		Expect(err).NotTo(HaveOccurred())

		Expect(buf.Bytes()).To(Equal([]byte("*6\r\n" +
			"$6\r\nstring\r\n" +
			"$2\r\n12\r\n" +
			"$5\r\n34.56\r\n" +
			"$5\r\nbytes\r\n" +
			"$1\r\n1\r\n" +
			"$0\r\n" +
			"\r\n")))
	})

	It("should append time", func() {
		tm := time.Date(2019, 1, 1, 9, 45, 10, 222125, time.UTC)
		err := wr.WriteArgs([]interface{}{tm})
		Expect(err).NotTo(HaveOccurred())

		Expect(buf.Len()).To(Equal(41))
	})

	It("should append marshalable args", func() {
		err := wr.WriteArgs([]interface{}{&MyType{}})
		Expect(err).NotTo(HaveOccurred())

		Expect(buf.Len()).To(Equal(15))
	})
})

type discard struct{}

func (discard) Write(b []byte) (int, error) {
	return len(b), nil
}

func (discard) WriteString(s string) (int, error) {
	return len(s), nil
}

func (discard) WriteByte(c byte) error {
	return nil
}

func BenchmarkWriteBuffer_Append(b *testing.B) {
	buf := proto.NewWriter(discard{})
	args := []interface{}{"hello", "world", "foo", "bar"}

	for i := 0; i < b.N; i++ {
		err := buf.WriteArgs(args)
		if err != nil {
			b.Fatal(err)
		}
	}
}
