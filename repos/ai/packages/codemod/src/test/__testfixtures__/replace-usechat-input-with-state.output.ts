// @ts-nocheck
import { useChat } from '@ai-sdk/react';

import { useState } from 'react';

export function ChatComponent() {
  const [input, setInput] = useState('');
  const {
    messages,
    handleSubmit
  } = useChat({
    api: '/api/chat',
  });

  const handleChange = e => setInput(e.target.value);
  const currentInput = input;
}

export function AnotherComponent() {
  const [input, setInput] = useState('');
  const {
    messages,
    handleSubmit,
    isLoading
  } = useChat({
    api: '/api/chat',
    onError: (error) => console.error(error),
  });

  const submitHandler = handleSubmit;
  const onChange = e => setInput(e.target.value);
  return { input, onChange, submitHandler };
}

export function ComponentWithAlias() {
  const [chatInput, setChatInput] = useState('');
  const {
    messages,
    handleSubmit
  } = useChat();

  const value = chatInput;
  const handler = e => setChatInput(e.target.value);
  return { value, handler };
}

export function PartialExtraction() {
  const [input, setInput] = useState('');
  const {
    handleSubmit
  } = useChat({
    api: '/api/chat',
  });

  return input;
}

export function OnlyHandleInputChange() {
  const [input, setInput] = useState('');
  const {
    messages
  } = useChat();
  return e => setInput(e.target.value);
}

// Test with new import syntax
import { useChat as useChatNew } from '@ai-sdk/react';

export function WithNewImportSyntax() {
  const [input, setInput] = useState('');
  const {} = useChatNew();
  return input;
}