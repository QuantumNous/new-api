package hashtag

import (
	"testing"

	. "github.com/onsi/ginkgo"
	. "github.com/onsi/gomega"

	"github.com/go-redis/redis/v8/internal/rand"
)

func TestGinkgoSuite(t *testing.T) {
	RegisterFailHandler(Fail)
	RunSpecs(t, "hashtag")
}

var _ = Describe("CRC16", func() {
	// http://redis.io/topics/cluster-spec#keys-distribution-model
	It("should calculate CRC16", func() {
		tests := []struct {
			s string
			n uint16
		}{
			{"123456789", 0x31C3},
			{string([]byte{83, 153, 134, 118, 229, 214, 244, 75, 140, 37, 215, 215}), 21847},
		}

		for _, test := range tests {
			Expect(crc16sum(test.s)).To(Equal(test.n), "for %s", test.s)
		}
	})
})

var _ = Describe("HashSlot", func() {
	It("should calculate hash slots", func() {
		tests := []struct {
			key  string
			slot int
		}{
			{"123456789", 12739},
			{"{}foo", 9500},
			{"foo{}", 5542},
			{"foo{}{bar}", 8363},
			{"", 10503},
			{"", 5176},
			{string([]byte{83, 153, 134, 118, 229, 214, 244, 75, 140, 37, 215, 215}), 5463},
		}
		// Empty keys receive random slot.
		rand.Seed(100)

		for _, test := range tests {
			Expect(Slot(test.key)).To(Equal(test.slot), "for %s", test.key)
		}
	})

	It("should extract keys from tags", func() {
		tests := []struct {
			one, two string
		}{
			{"foo{bar}", "bar"},
			{"{foo}bar", "foo"},
			{"{user1000}.following", "{user1000}.followers"},
			{"foo{{bar}}zap", "{bar"},
			{"foo{bar}{zap}", "bar"},
		}

		for _, test := range tests {
			Expect(Slot(test.one)).To(Equal(Slot(test.two)), "for %s <-> %s", test.one, test.two)
		}
	})
})
