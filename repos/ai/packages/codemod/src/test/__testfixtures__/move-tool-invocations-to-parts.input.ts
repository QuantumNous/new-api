// @ts-nocheck
import { useChat } from 'ai/react';

function ProcessMessages() {
  const { messages } = useChat();
  
  // Check for tool-invocation type
  messages.forEach(message => {
    message.parts.map(part => {
      if (part.type === 'tool-invocation') {
        return part.toolInvocation.toolName;
      }
    });
  });

  // Check for tool-invocation with == operator
  const results = message.parts.filter(part => {
    if (part.type == 'tool-invocation') {
      return true;
    }
  });

  // Check toolInvocation.state
  message.parts.map(part => {
    if (part.type === 'tool-invocation') {
      switch (part.toolInvocation.state) {
        case 'partial-call':
          return 'Loading...';
        case 'call':
          return `Tool called with ${JSON.stringify(part.toolInvocation.args)}`;
        case 'result':
          return `Result: ${part.toolInvocation.result}`;
      }
    }
  });

  // Access toolInvocation.toolName directly
  const toolNames = message.parts.map(part => {
    if (part.type === 'tool-invocation') {
      const name = part.toolInvocation.toolName;
      console.log(`Tool: ${part.toolInvocation.toolName}`);
      return name;
    }
  });
}