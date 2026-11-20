// @ts-nocheck
import { addToolResult } from 'not-ai-package';

// Should NOT be transformed - imported from different package
function ChatComponent() {
  return (
    <button
      onClick={() => {
        addToolResult({
          tool: 'test-tool',
          toolCallId: 'call-1',
          output: 'result',
        });
      }}
    >
      Submit Result
    </button>
  );
}

