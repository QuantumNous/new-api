// @ts-nocheck
import { useChat } from 'ai';
import { useChat as useReactChat } from '@ai-sdk/react';

// Test 1: Destructuring from useChat hook
function ChatComponent1() {
  const { messages, sendMessage, addToolOutput } = useChat();

  return (
    (<button
      onClick={() => {
        addToolOutput({
          tool: 'test-tool',
          toolCallId: 'call-1',
          output: 'result',
        });
      }}
    >Submit Result
          </button>)
  );
}

// Test 2: Destructuring with alias
function ChatComponent2() {
  const { addToolOutput: submitToolResult } = useReactChat();

  return (
    <button onClick={() => submitToolResult({ tool: 'tool', toolCallId: 'id', output: 'data' })}>
      Submit
    </button>
  );
}

// Test 3: Using chat object directly
function ChatComponent3() {
  const chat = useChat();

  return (
    (<button onClick={() => chat.addToolOutput({ tool: 'test', toolCallId: 'id', output: 'out' })}>Submit
          </button>)
  );
}

// Test 4: Object property shorthand
function ChatComponent4() {
  const { addToolOutput, sendMessage } = useChat();

  const handlers = {
    addToolOutput,
    sendMessage,
  };

  return <div>{JSON.stringify(handlers)}</div>;
}

// Test 5: Object property non-shorthand
const config = {
  addToolOutput: (data: any) => console.log(data),
  other: 'value',
};

// Test 6: Member expression in various contexts
class ChatManager {
  chat: any;

  constructor(chat: any) {
    this.chat = chat;
  }

  submitResult() {
    this.chat.addToolOutput({ tool: 'test', toolCallId: 'id', output: 'result' });
  }

  getHandler() {
    return this.chat.addToolOutput;
  }
}

// Test 7: Passed as callback
function processChat(callback: any) {
  callback();
}

function ChatComponent5() {
  const chat = useChat();

  processChat(() => {
    chat.addToolOutput({ tool: 'tool', toolCallId: 'id', output: 'data' });
  });

  return null;
}

// Test 8: Type annotation (should be renamed in Pick type)
type ChatHelpers = Pick<any, 'sendMessage' | 'addToolOutput' | 'stop'>;

// Test 9: Interface property
interface IChatHandlers {
  addToolOutput: (args: any) => void;
  sendMessage: (msg: string) => void;
}

// Test 10: Should NOT transform - different package
import { addToolOutput as otherToolResult } from 'other-package';

function OtherComponent() {
  otherToolResult({ tool: 'other', toolCallId: 'id', output: 'data' });
  return null;
}

