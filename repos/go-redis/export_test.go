package redis

import (
	"context"
	"fmt"
	"net"
	"strings"

	"github.com/go-redis/redis/v8/internal"
	"github.com/go-redis/redis/v8/internal/hashtag"
	"github.com/go-redis/redis/v8/internal/pool"
)

func (c *baseClient) Pool() pool.Pooler {
	return c.connPool
}

func (c *PubSub) SetNetConn(netConn net.Conn) {
	c.cn = pool.NewConn(netConn)
}

func (c *ClusterClient) LoadState(ctx context.Context) (*clusterState, error) {
	// return c.state.Reload(ctx)
	return c.loadState(ctx)
}

func (c *ClusterClient) SlotAddrs(ctx context.Context, slot int) []string {
	state, err := c.state.Get(ctx)
	if err != nil {
		panic(err)
	}

	var addrs []string
	for _, n := range state.slotNodes(slot) {
		addrs = append(addrs, n.Client.getAddr())
	}
	return addrs
}

func (c *ClusterClient) Nodes(ctx context.Context, key string) ([]*clusterNode, error) {
	state, err := c.state.Reload(ctx)
	if err != nil {
		return nil, err
	}

	slot := hashtag.Slot(key)
	nodes := state.slotNodes(slot)
	if len(nodes) != 2 {
		return nil, fmt.Errorf("slot=%d does not have enough nodes: %v", slot, nodes)
	}
	return nodes, nil
}

func (c *ClusterClient) SwapNodes(ctx context.Context, key string) error {
	nodes, err := c.Nodes(ctx, key)
	if err != nil {
		return err
	}
	nodes[0], nodes[1] = nodes[1], nodes[0]
	return nil
}

func (state *clusterState) IsConsistent(ctx context.Context) bool {
	if len(state.Masters) < 3 {
		return false
	}
	for _, master := range state.Masters {
		s := master.Client.Info(ctx, "replication").Val()
		if !strings.Contains(s, "role:master") {
			return false
		}
	}

	if len(state.Slaves) < 3 {
		return false
	}
	for _, slave := range state.Slaves {
		s := slave.Client.Info(ctx, "replication").Val()
		if !strings.Contains(s, "role:slave") {
			return false
		}
	}

	return true
}

func GetSlavesAddrByName(ctx context.Context, c *SentinelClient, name string) []string {
	addrs, err := c.Slaves(ctx, name).Result()
	if err != nil {
		internal.Logger.Printf(ctx, "sentinel: Slaves name=%q failed: %s",
			name, err)
		return []string{}
	}
	return parseSlaveAddrs(addrs, false)
}
