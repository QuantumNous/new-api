# Stream Text Loop Control

```
initial model messages
response model messages
stitchable stream

do {
  prepare step
  convert step input messages (after prepare step) to language model v4 messages

 stream = doStream (with language model v4 messages)
 transform stream for user friendly format

 run tools transformation on stream
   executes tools and injects tool results into stream
   tool approval?

 pipe stream with tool results through further transforms
   transforms:
     add start-step
     filter out empty text chunks
     tool input start
     filter raw chunks when not enabled
     add finish-step
     add finish
   bookkeeping:
     keep track of tool calls/outputs/errors
   timeout mgmt
   events:
     telemetry, tool input delta

 add transformed stream with minor augmentation to stitchable stream

 add new response model messages
   by converting the assembled step output
   to additional response model messages

} while (
    not (
        any of the stop conditions is met
        or
        finish reason is not tool-calls
        or
        tool without execute is called
        or
        tool that needs approval is called
        or
        there are deferred tool calls
    )
)

transform the unified stream with custom user-defined transformations

unified stream
stream 1 -- stream 2 -- stream 3
```

# Stream Pipeline Structure

```
┌────────────────────────────────────────────────────────────┐
│           FUNNEL IN: N STEP STREAMS                        │
│          (sequential, not parallel)                        │
└────────────────────────────────────────────────────────────┘

┌──────────────┐  ┌──────────────┐            ┌──────────────┐
│   Step 0     │  │   Step 1     │            │   Step N     │
│   model.do   │  │   model.do   │            │   model.do   │
│   Stream()   │  │   Stream()   │    ···     │   Stream()   │
└──────┬───────┘  └──────┬───────┘            └──────┬───────┘
       │                 │                           │
 tool callbacks    tool callbacks              tool callbacks
       │                 │                           │
 tool execution    tool execution              tool execution
       │                 │                           │
 step metadata     step metadata               step metadata
 + start/finish    + start/finish              + start/finish
       │                 │                           │
       ▼                 ▼                           ▼
┌────────────────────────────────────────────────────────────┐
│        addStream()    addStream()         addStream()      │
│                                                            │
│                   STITCHABLE STREAM                        │
│     (sequential queue — consumes one at a time,            │
│      next step added on recursion from flush)              │
└─────────────────────────┬──────────────────────────────────┘
                          │
══════════════════════════╪═══════════════════════════════════
                          │
             ┌────────────┴────────────────────────┐
             │         MIDDLE PIPELINE             │
             │    (single linear transform chain)  │
             └────────────┬────────────────────────┘
                          │
                          ▼
                  resilient stream
             (abort handling + start event)
                          │
                          ▼
                      stop gate
                 (stopStream() support)
                          │
                          ▼
                   user transforms
               (experimental_transform[])
                          │
                          ▼
                   output transform
               (enrich w/ partialOutput)
                          │
                          ▼
                   event processor
                 (onChunk, onStepFinish,
                  accumulate content,
                 resolve delayed promises)
                          │
══════════════════════════╪═══════════════════════════════════
                          │
        ┌─────────────────┴─────────────────────┐
        │      FUNNEL OUT: ON-DEMAND .tee()     │
        │                                       │
        │             BASE STREAM               │
        │    (each .tee() splits into two:      │
        │     one for consumer, one remains     │
        │     as baseStream for next tee)       │
        │                                       │
        │   each can be called multiple times   │
        └──┬─────┬──────┬────┬──────┬────┬──────┘
           │     │      │    │      │    │
           ▼     ▼      ▼    ▼      ▼    ▼
         text  full  partial elem   UI  consume
        Stream Stream Output Stream Msg  Stream
                      Stream       Stream
        (text  (all  (json (output (maps (drains
        deltas parts) parse) spec) to UI) stream,
        only)                             resolves
                                          promises)
```
