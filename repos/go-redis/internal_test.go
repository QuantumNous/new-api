package redis

import (
	. "github.com/onsi/ginkgo"
	. "github.com/onsi/gomega"
)

var _ = Describe("newClusterState", func() {
	var state *clusterState

	createClusterState := func(slots []ClusterSlot) *clusterState {
		opt := &ClusterOptions{}
		opt.init()
		nodes := newClusterNodes(opt)
		state, err := newClusterState(nodes, slots, "10.10.10.10:1234")
		Expect(err).NotTo(HaveOccurred())
		return state
	}

	Describe("sorting", func() {
		BeforeEach(func() {
			state = createClusterState([]ClusterSlot{{
				Start: 1000,
				End:   1999,
			}, {
				Start: 0,
				End:   999,
			}, {
				Start: 2000,
				End:   2999,
			}})
		})

		It("sorts slots", func() {
			Expect(state.slots).To(Equal([]*clusterSlot{
				{start: 0, end: 999, nodes: nil},
				{start: 1000, end: 1999, nodes: nil},
				{start: 2000, end: 2999, nodes: nil},
			}))
		})
	})

	Describe("loopback", func() {
		BeforeEach(func() {
			state = createClusterState([]ClusterSlot{{
				Nodes: []ClusterNode{{Addr: "127.0.0.1:7001"}},
			}, {
				Nodes: []ClusterNode{{Addr: "127.0.0.1:7002"}},
			}, {
				Nodes: []ClusterNode{{Addr: "1.2.3.4:1234"}},
			}, {
				Nodes: []ClusterNode{{Addr: ":1234"}},
			}})
		})

		It("replaces loopback hosts in addresses", func() {
			slotAddr := func(slot *clusterSlot) string {
				return slot.nodes[0].Client.Options().Addr
			}

			Expect(slotAddr(state.slots[0])).To(Equal("10.10.10.10:7001"))
			Expect(slotAddr(state.slots[1])).To(Equal("10.10.10.10:7002"))
			Expect(slotAddr(state.slots[2])).To(Equal("1.2.3.4:1234"))
			Expect(slotAddr(state.slots[3])).To(Equal(":1234"))
		})
	})
})
