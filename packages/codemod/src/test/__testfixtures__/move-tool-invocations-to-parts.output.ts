// @ts-nocheck
import { useChat } from 'ai/react';

function ProcessMessages() {
  const { messages } = useChat();
  
  // Check for tool-invocation type
  messages.forEach(message => {
    message.parts.map(part => {
      /* FIXME(@ai-sdk-upgrade-v5): The generic 'tool-invocation' type has been replaced with typed naming: 'tool-${toolName}'. Update to check for specific tool types. See migration guide: https://ai-sdk.dev/docs/migration-guides/migration-guide-5-0#tool-part-type-changes-uimessage */
      if (part.type === 'tool-invocation') {
        /* FIXME(@ai-sdk-upgrade-v5): The part.toolInvocation.toolName property has been removed. Tool parts now use typed naming: part.type === 'tool-${toolName}'. See migration guide: https://ai-sdk.dev/docs/migration-guides/migration-guide-5-0#tool-part-type-changes-uimessage */
        return part.toolInvocation.toolName;
      }
    });
  });

  // Check for tool-invocation with == operator
  const results = message.parts.filter(part => {
    /* FIXME(@ai-sdk-upgrade-v5): The generic 'tool-invocation' type has been replaced with typed naming: 'tool-${toolName}'. Update to check for specific tool types. See migration guide: https://ai-sdk.dev/docs/migration-guides/migration-guide-5-0#tool-part-type-changes-uimessage */
    if (part.type == 'tool-invocation') {
      return true;
    }
  });

  // Check toolInvocation.state
  message.parts.map(part => {
    /* FIXME(@ai-sdk-upgrade-v5): The generic 'tool-invocation' type has been replaced with typed naming: 'tool-${toolName}'. Update to check for specific tool types. See migration guide: https://ai-sdk.dev/docs/migration-guides/migration-guide-5-0#tool-part-type-changes-uimessage */
    if (part.type === 'tool-invocation') {
      /* FIXME(@ai-sdk-upgrade-v5): The part.toolInvocation.state property has been removed. Tool parts now have specific states: 'input-available', 'calling', 'output-available'. See migration guide: https://ai-sdk.dev/docs/migration-guides/migration-guide-5-0#tool-part-type-changes-uimessage */
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
    /* FIXME(@ai-sdk-upgrade-v5): The generic 'tool-invocation' type has been replaced with typed naming: 'tool-${toolName}'. Update to check for specific tool types. See migration guide: https://ai-sdk.dev/docs/migration-guides/migration-guide-5-0#tool-part-type-changes-uimessage */
    if (part.type === 'tool-invocation') {
      /* FIXME(@ai-sdk-upgrade-v5): The part.toolInvocation.toolName property has been removed. Tool parts now use typed naming: part.type === 'tool-${toolName}'. See migration guide: https://ai-sdk.dev/docs/migration-guides/migration-guide-5-0#tool-part-type-changes-uimessage */
      const name = part.toolInvocation.toolName;
      /* FIXME(@ai-sdk-upgrade-v5): The part.toolInvocation.toolName property has been removed. Tool parts now use typed naming: part.type === 'tool-${toolName}'. See migration guide: https://ai-sdk.dev/docs/migration-guides/migration-guide-5-0#tool-part-type-changes-uimessage */
      console.log(`Tool: ${part.toolInvocation.toolName}`);
      return name;
    }
  });
}