package governor

import "context"

type AttemptState struct {
	ChannelID           int
	ChannelName         string
	KeyIndex            int
	KeyValue            string
	ReservationID       string
	LeaseHeld           bool
	ApplyKeyConcurrency bool
	StopHeartbeat       context.CancelFunc
	Config              Config
}
