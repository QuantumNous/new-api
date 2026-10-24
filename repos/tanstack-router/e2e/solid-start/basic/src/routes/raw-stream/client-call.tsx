import { createFileRoute } from '@tanstack/solid-router'
import { createSignal } from 'solid-js'
import {
  TEST10_EXPECTED,
  TEST11_EXPECTED,
  TEST12_STREAM_A_EXPECTED,
  TEST12_STREAM_B_EXPECTED,
  TEST13_EXPECTED,
  TEST14_STREAM_A_EXPECTED,
  TEST14_STREAM_B_EXPECTED,
  TEST14_STREAM_C_EXPECTED,
  TEST7_EXPECTED,
  TEST8_EXPECTED,
  TEST9_EXPECTED,
  binaryHintBinaryFn,
  binaryHintTextFn,
  burstPauseBurstFn,
  collectBytes,
  compareBytes,
  consumeBinaryStream,
  createStreamConsumer,
  emptyStreamFn,
  errorStreamFn,
  interleavedStreamsFn,
  jsonEndsFirstFn,
  largeBinaryFn,
  mixedStreamingFn,
  multipleRawStreamsFn,
  rawEndsFirstFn,
  singleRawStreamFn,
  textHintMixedFn,
  textHintPureBinaryFn,
  textHintPureTextFn,
  threeStreamsFn,
} from '../../raw-stream-fns'

function ClientCallTests() {
  const [results, setResults] = createSignal<Record<string, any>>({})
  const [loading, setLoading] = createSignal<Record<string, boolean>>({})

  const consumeStream = createStreamConsumer()

  const runTest = async (
    testName: string,
    fn: () => Promise<any>,
    processor: (result: any) => Promise<any>,
  ) => {
    setLoading((prev) => ({ ...prev, [testName]: true }))
    try {
      const result = await fn()
      const processed = await processor(result)
      setResults((prev) => ({ ...prev, [testName]: processed }))
    } catch (error) {
      setResults((prev) => ({
        ...prev,
        [testName]: { error: String(error) },
      }))
    } finally {
      setLoading((prev) => ({ ...prev, [testName]: false }))
    }
  }

  return (
    <div class="space-y-4">
      <h2>Client-Side Server Function Calls (RPC)</h2>
      <p class="text-gray-600">
        These tests invoke server functions directly from the client, using the
        binary framing protocol for RawStream data.
      </p>

      {/* Test 1: Single Raw Stream */}
      <div class="border p-4 rounded">
        <h3 data-testid="test1-title">Test 1: Single Raw Stream</h3>
        <button
          data-testid="test1-btn"
          onClick={() =>
            runTest('test1', singleRawStreamFn, async (result) => ({
              message: result.message,
              streamContent: await consumeStream(result.data),
            }))
          }
          disabled={loading().test1}
          class="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {loading().test1 ? 'Loading...' : 'Run Test'}
        </button>
        <pre data-testid="test1-result">{JSON.stringify(results().test1)}</pre>
      </div>

      {/* Test 2: Multiple Raw Streams */}
      <div class="border p-4 rounded">
        <h3 data-testid="test2-title">Test 2: Multiple Raw Streams</h3>
        <button
          data-testid="test2-btn"
          onClick={() =>
            runTest('test2', multipleRawStreamsFn, async (result) => ({
              message: result.message,
              firstContent: await consumeStream(result.first),
              secondContent: await consumeStream(result.second),
            }))
          }
          disabled={loading().test2}
          class="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {loading().test2 ? 'Loading...' : 'Run Test'}
        </button>
        <pre data-testid="test2-result">{JSON.stringify(results().test2)}</pre>
      </div>

      {/* Test 3: JSON Ends First */}
      <div class="border p-4 rounded">
        <h3 data-testid="test3-title">Test 3: JSON Ends Before Raw Stream</h3>
        <button
          data-testid="test3-btn"
          onClick={() =>
            runTest('test3', jsonEndsFirstFn, async (result) => ({
              message: result.message,
              hasTimestamp: typeof result.timestamp === 'number',
              slowContent: await consumeStream(result.slowData),
            }))
          }
          disabled={loading().test3}
          class="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {loading().test3 ? 'Loading...' : 'Run Test'}
        </button>
        <pre data-testid="test3-result">{JSON.stringify(results().test3)}</pre>
      </div>

      {/* Test 4: Raw Ends First */}
      <div class="border p-4 rounded">
        <h3 data-testid="test4-title">Test 4: Raw Stream Ends Before JSON</h3>
        <button
          data-testid="test4-btn"
          onClick={() =>
            runTest('test4', rawEndsFirstFn, async (result) => ({
              message: result.message,
              deferredData: await result.deferredData,
              fastContent: await consumeStream(result.fastData),
            }))
          }
          disabled={loading().test4}
          class="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {loading().test4 ? 'Loading...' : 'Run Test'}
        </button>
        <pre data-testid="test4-result">{JSON.stringify(results().test4)}</pre>
      </div>

      {/* Test 5: Large Binary */}
      <div class="border p-4 rounded">
        <h3 data-testid="test5-title">Test 5: Large Binary Data</h3>
        <button
          data-testid="test5-btn"
          onClick={() =>
            runTest('test5', largeBinaryFn, async (result) => {
              const totalBytes = await consumeBinaryStream(result.binary)
              return {
                message: result.message,
                expectedSize: result.size,
                actualSize: totalBytes,
                sizeMatch: totalBytes === result.size,
              }
            })
          }
          disabled={loading().test5}
          class="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {loading().test5 ? 'Loading...' : 'Run Test'}
        </button>
        <pre data-testid="test5-result">{JSON.stringify(results().test5)}</pre>
      </div>

      {/* Test 6: Mixed Streaming */}
      <div class="border p-4 rounded">
        <h3 data-testid="test6-title">Test 6: Mixed Streaming</h3>
        <button
          data-testid="test6-btn"
          onClick={() =>
            runTest('test6', mixedStreamingFn, async (result) => ({
              immediate: result.immediate,
              deferred: await result.deferred,
              rawContent: await consumeStream(result.raw),
            }))
          }
          disabled={loading().test6}
          class="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {loading().test6 ? 'Loading...' : 'Run Test'}
        </button>
        <pre data-testid="test6-result">{JSON.stringify(results().test6)}</pre>
      </div>

      {/* Hint Tests Section */}
      <h2 class="mt-8">Hint Parameter Tests (RPC)</h2>
      <p class="text-gray-600">
        These tests verify that hint parameter works correctly for RPC calls.
        Note: RPC always uses binary framing regardless of hint.
      </p>

      {/* Test 7: Text Hint with Pure Text */}
      <div class="border p-4 rounded">
        <h3 data-testid="test7-title">Test 7: Text Hint - Pure Text</h3>
        <button
          data-testid="test7-btn"
          onClick={() =>
            runTest('test7', textHintPureTextFn, async (result) => {
              const bytes = await collectBytes(result.data)
              const comparison = compareBytes(bytes, TEST7_EXPECTED)
              const decoder = new TextDecoder()
              return {
                message: result.message,
                asText: decoder.decode(bytes),
                ...comparison,
              }
            })
          }
          disabled={loading().test7}
          class="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {loading().test7 ? 'Loading...' : 'Run Test'}
        </button>
        <pre data-testid="test7-result">{JSON.stringify(results().test7)}</pre>
      </div>

      {/* Test 8: Text Hint with Pure Binary */}
      <div class="border p-4 rounded">
        <h3 data-testid="test8-title">Test 8: Text Hint - Pure Binary</h3>
        <button
          data-testid="test8-btn"
          onClick={() =>
            runTest('test8', textHintPureBinaryFn, async (result) => {
              const bytes = await collectBytes(result.data)
              const comparison = compareBytes(bytes, TEST8_EXPECTED)
              return {
                message: result.message,
                ...comparison,
              }
            })
          }
          disabled={loading().test8}
          class="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {loading().test8 ? 'Loading...' : 'Run Test'}
        </button>
        <pre data-testid="test8-result">{JSON.stringify(results().test8)}</pre>
      </div>

      {/* Test 9: Text Hint with Mixed Content */}
      <div class="border p-4 rounded">
        <h3 data-testid="test9-title">Test 9: Text Hint - Mixed Content</h3>
        <button
          data-testid="test9-btn"
          onClick={() =>
            runTest('test9', textHintMixedFn, async (result) => {
              const bytes = await collectBytes(result.data)
              const comparison = compareBytes(bytes, TEST9_EXPECTED)
              return {
                message: result.message,
                ...comparison,
              }
            })
          }
          disabled={loading().test9}
          class="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {loading().test9 ? 'Loading...' : 'Run Test'}
        </button>
        <pre data-testid="test9-result">{JSON.stringify(results().test9)}</pre>
      </div>

      {/* Test 10: Binary Hint with Text Data */}
      <div class="border p-4 rounded">
        <h3 data-testid="test10-title">Test 10: Binary Hint - Text Data</h3>
        <button
          data-testid="test10-btn"
          onClick={() =>
            runTest('test10', binaryHintTextFn, async (result) => {
              const bytes = await collectBytes(result.data)
              const comparison = compareBytes(bytes, TEST10_EXPECTED)
              const decoder = new TextDecoder()
              return {
                message: result.message,
                asText: decoder.decode(bytes),
                ...comparison,
              }
            })
          }
          disabled={loading().test10}
          class="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {loading().test10 ? 'Loading...' : 'Run Test'}
        </button>
        <pre data-testid="test10-result">
          {JSON.stringify(results().test10)}
        </pre>
      </div>

      {/* Test 11: Binary Hint with Binary Data */}
      <div class="border p-4 rounded">
        <h3 data-testid="test11-title">Test 11: Binary Hint - Binary Data</h3>
        <button
          data-testid="test11-btn"
          onClick={() =>
            runTest('test11', binaryHintBinaryFn, async (result) => {
              const bytes = await collectBytes(result.data)
              const comparison = compareBytes(bytes, TEST11_EXPECTED)
              return {
                message: result.message,
                ...comparison,
              }
            })
          }
          disabled={loading().test11}
          class="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {loading().test11 ? 'Loading...' : 'Run Test'}
        </button>
        <pre data-testid="test11-result">
          {JSON.stringify(results().test11)}
        </pre>
      </div>

      {/* Multiplexing Tests Section */}
      <h2 class="mt-8">Multiplexing Tests (RPC)</h2>
      <p class="text-gray-600">
        These tests verify correct interleaving of multiple concurrent streams.
      </p>

      {/* Test 12: Interleaved Streams */}
      <div class="border p-4 rounded">
        <h3 data-testid="test12-title">Test 12: Interleaved Streams</h3>
        <button
          data-testid="test12-btn"
          onClick={() =>
            runTest('test12', interleavedStreamsFn, async (result) => {
              const [bytesA, bytesB] = await Promise.all([
                collectBytes(result.streamA),
                collectBytes(result.streamB),
              ])
              const comparisonA = compareBytes(bytesA, TEST12_STREAM_A_EXPECTED)
              const comparisonB = compareBytes(bytesB, TEST12_STREAM_B_EXPECTED)
              return {
                message: result.message,
                streamA: comparisonA,
                streamB: comparisonB,
              }
            })
          }
          disabled={loading().test12}
          class="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {loading().test12 ? 'Loading...' : 'Run Test'}
        </button>
        <pre data-testid="test12-result">
          {JSON.stringify(results().test12)}
        </pre>
      </div>

      {/* Test 13: Burst-Pause-Burst */}
      <div class="border p-4 rounded">
        <h3 data-testid="test13-title">Test 13: Burst-Pause-Burst</h3>
        <button
          data-testid="test13-btn"
          onClick={() =>
            runTest('test13', burstPauseBurstFn, async (result) => {
              const bytes = await collectBytes(result.data)
              const comparison = compareBytes(bytes, TEST13_EXPECTED)
              return {
                message: result.message,
                ...comparison,
              }
            })
          }
          disabled={loading().test13}
          class="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {loading().test13 ? 'Loading...' : 'Run Test'}
        </button>
        <pre data-testid="test13-result">
          {JSON.stringify(results().test13)}
        </pre>
      </div>

      {/* Test 14: Three Concurrent Streams */}
      <div class="border p-4 rounded">
        <h3 data-testid="test14-title">Test 14: Three Concurrent Streams</h3>
        <button
          data-testid="test14-btn"
          onClick={() =>
            runTest('test14', threeStreamsFn, async (result) => {
              const [bytesA, bytesB, bytesC] = await Promise.all([
                collectBytes(result.fast),
                collectBytes(result.slow),
                collectBytes(result.burst),
              ])
              const comparisonA = compareBytes(bytesA, TEST14_STREAM_A_EXPECTED)
              const comparisonB = compareBytes(bytesB, TEST14_STREAM_B_EXPECTED)
              const comparisonC = compareBytes(bytesC, TEST14_STREAM_C_EXPECTED)
              return {
                message: result.message,
                fast: comparisonA,
                slow: comparisonB,
                burst: comparisonC,
              }
            })
          }
          disabled={loading().test14}
          class="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {loading().test14 ? 'Loading...' : 'Run Test'}
        </button>
        <pre data-testid="test14-result">
          {JSON.stringify(results().test14)}
        </pre>
      </div>

      {/* Edge Case Tests Section */}
      <h2 class="mt-8">Edge Case Tests (RPC)</h2>
      <p class="text-gray-600">
        These tests verify edge cases like empty streams and error handling.
      </p>

      {/* Test 15: Empty Stream */}
      <div class="border p-4 rounded">
        <h3 data-testid="test15-title">Test 15: Empty Stream</h3>
        <button
          data-testid="test15-btn"
          onClick={() =>
            runTest('test15', emptyStreamFn, async (result) => {
              const bytes = await collectBytes(result.data)
              return {
                message: result.message,
                byteCount: bytes.length,
                isEmpty: bytes.length === 0,
              }
            })
          }
          disabled={loading().test15}
          class="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {loading().test15 ? 'Loading...' : 'Run Test'}
        </button>
        <pre data-testid="test15-result">
          {JSON.stringify(results().test15)}
        </pre>
      </div>

      {/* Test 16: Stream Error */}
      <div class="border p-4 rounded">
        <h3 data-testid="test16-title">Test 16: Stream Error</h3>
        <button
          data-testid="test16-btn"
          onClick={() =>
            runTest('test16', errorStreamFn, async (result) => {
              try {
                // Try to consume the stream - should error
                const content = await consumeStream(result.data)
                return {
                  message: result.message,
                  streamContent: content,
                  errorCaught: false,
                }
              } catch (err) {
                return {
                  message: result.message,
                  errorCaught: true,
                  errorMessage: String(err),
                }
              }
            })
          }
          disabled={loading().test16}
          class="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {loading().test16 ? 'Loading...' : 'Run Test'}
        </button>
        <pre data-testid="test16-result">
          {JSON.stringify(results().test16)}
        </pre>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/raw-stream/client-call')({
  component: ClientCallTests,
})
