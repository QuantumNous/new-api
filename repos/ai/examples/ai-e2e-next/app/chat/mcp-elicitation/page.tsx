'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, isDataUIPart } from 'ai';
import { useState, useEffect, useRef } from 'react';
import {
  ElicitationDataTypes,
  type MCPElicitationUIMessage,
  type ElicitationAction,
} from '@/app/api/chat/mcp-elicitation/types';
export default function MCPElicitationChat() {
  const [input, setInput] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [currentElicitation, setCurrentElicitation] = useState<{
    elicitationId: string;
    message: string;
    requestedSchema: unknown;
  } | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});

  // Track which elicitation IDs we've already handled
  const handledElicitationsRef = useRef<Set<string>>(new Set());

  const { messages, sendMessage } = useChat<MCPElicitationUIMessage>({
    transport: new DefaultChatTransport({
      api: '/api/chat/mcp-elicitation',
    }),
  });

  // Check for NEW elicitation requests in messages (only unhandled ones)
  useEffect(() => {
    // Loop through messages in REVERSE order to find the most recent unhandled elicitation
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (!message.parts) continue;

      for (const part of message.parts) {
        if (isDataUIPart(part) && part.type === 'data-elicitation-request') {
          const elicitationId = part.data.elicitationId;

          // Only show modal if this elicitation hasn't been handled yet
          if (!handledElicitationsRef.current.has(elicitationId)) {
            console.log(
              '[page] New elicitation request detected:',
              elicitationId,
            );
            handledElicitationsRef.current.add(elicitationId);

            setCurrentElicitation(part.data);
            setShowModal(true);

            // Initialize form data with defaults from schema
            const schema = part.data.requestedSchema as any;
            if (schema?.properties) {
              const defaults: Record<string, any> = {};
              for (const [key, prop] of Object.entries(schema.properties)) {
                const property = prop as any;
                if (property.default !== undefined) {
                  defaults[key] = property.default;
                } else if (property.type === 'boolean') {
                  defaults[key] = false;
                }
              }
              setFormData(defaults);
            }
            return; // Show only the most recent unhandled elicitation
          }
        }
      }
    }
  }, [messages]);

  const handleElicitationResponse = async (action: ElicitationAction) => {
    if (!currentElicitation) {
      console.warn('[page] No current elicitation to respond to');
      return;
    }

    const elicitationId = currentElicitation.elicitationId;
    console.log(
      '[page] Submitting response for:',
      elicitationId,
      'action:',
      action,
    );

    // Immediately close modal and clear state to prevent double-submission
    setShowModal(false);
    const elicitationToRespond = currentElicitation;
    const dataToSend = action === 'accept' ? { ...formData } : undefined;
    setCurrentElicitation(null);
    setFormData({});

    // Send elicitation response to the separate endpoint
    try {
      const response = await fetch('/api/mcp-elicitation/respond', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: elicitationId,
          action,
          content: dataToSend,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[page] Failed to submit response:', errorData);
        throw new Error(errorData.error || 'Failed to submit response');
      }

      console.log('[page] Successfully submitted response for:', elicitationId);
    } catch (error) {
      console.error('[page] Error sending elicitation response:', error);
      // Don't show alert as the response might have already been processed
      // alert('Failed to submit response. Please try again.');
    }
  };

  const renderFormField = (key: string, property: any, isRequired: boolean) => {
    const label = property.title || key;
    const description = property.description;
    const type = property.type;

    return (
      <div key={key} className="mb-4">
        <label className="block mb-2">
          <span className="font-semibold">
            {label}
            {isRequired && <span className="text-red-500">*</span>}
          </span>
          {description && (
            <span className="block text-sm text-gray-600">{description}</span>
          )}
        </label>
        {type === 'boolean' ? (
          <input
            type="checkbox"
            checked={formData[key] || false}
            onChange={e =>
              setFormData({ ...formData, [key]: e.target.checked })
            }
            className="w-4 h-4"
          />
        ) : type === 'number' || type === 'integer' ? (
          <input
            type="number"
            value={formData[key] || ''}
            onChange={e =>
              setFormData({
                ...formData,
                [key]:
                  type === 'integer'
                    ? parseInt(e.target.value) || 0
                    : parseFloat(e.target.value) || 0,
              })
            }
            className="w-full p-2 border border-gray-300 rounded"
            required={isRequired}
            min={property.minimum}
            max={property.maximum}
          />
        ) : (
          <input
            type={
              property.format === 'email'
                ? 'email'
                : type === 'password'
                  ? 'password'
                  : 'text'
            }
            value={formData[key] || ''}
            onChange={e => setFormData({ ...formData, [key]: e.target.value })}
            className="w-full p-2 border border-gray-300 rounded"
            required={isRequired}
            minLength={property.minLength}
            maxLength={property.maxLength}
          />
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col w-full max-w-2xl py-24 mx-auto">
      <h1 className="mb-8 text-2xl font-bold">MCP Elicitation Example</h1>

      <div className="flex-1 mb-4 overflow-y-auto">
        {messages?.map(m => (
          <div key={m.id} className="mb-4 whitespace-pre-wrap">
            <div className="font-bold mb-1">
              {m.role === 'user' ? 'You' : 'Assistant'}:
            </div>
            {m.parts?.map((part, i) => {
              if (part.type === 'text') {
                return (
                  <div key={i} className="text-gray-800">
                    {part.text}
                  </div>
                );
              }
              if (isDataUIPart(part)) {
                if (part.type === 'data-elicitation-request') {
                  return (
                    <div
                      key={i}
                      className="p-3 mt-2 border-l-4 border-blue-500 bg-blue-50"
                    >
                      <div className="text-sm text-blue-600">
                        📋 Elicitation Request
                      </div>
                      <div className="mt-1 text-gray-700">
                        {part.data.message}
                      </div>
                    </div>
                  );
                }
                if (part.type === 'data-elicitation-response') {
                  return (
                    <div
                      key={i}
                      className="p-3 mt-2 border-l-4 border-green-500 bg-green-50"
                    >
                      <div className="text-sm text-green-600">
                        ✅ Response: {part.data.action}
                      </div>
                      {part.data.content && (
                        <pre className="mt-1 text-xs text-gray-700">
                          {JSON.stringify(part.data.content, null, 2)}
                        </pre>
                      )}
                    </div>
                  );
                }
              }
              return null;
            })}
          </div>
        ))}
      </div>

      <form
        onSubmit={e => {
          e.preventDefault();
          if (!input.trim()) return;
          sendMessage({ text: input });
          setInput('');
        }}
        className="mt-4"
      >
        <input
          disabled={showModal}
          className="w-full p-3 border border-gray-300 rounded shadow-sm disabled:bg-gray-100"
          value={input}
          placeholder={
            showModal
              ? 'Please complete the form above...'
              : 'Type a message... (try: "register me as a new user")'
          }
          onChange={e => setInput(e.target.value)}
        />
      </form>

      {/* Elicitation Modal */}
      {showModal && currentElicitation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-lg p-6 bg-white rounded-lg shadow-xl max-h-[80vh] overflow-y-auto">
            <h2 className="mb-4 text-xl font-bold">Information Required</h2>
            <p className="mb-6 text-gray-700">{currentElicitation.message}</p>

            <form
              onSubmit={e => {
                e.preventDefault();
                handleElicitationResponse('accept');
              }}
            >
              {(() => {
                const schema = currentElicitation.requestedSchema as any;
                if (!schema?.properties) return null;

                const requiredFields = new Set(schema.required || []);

                return Object.entries(schema.properties).map(
                  ([key, property]) =>
                    renderFormField(key, property, requiredFields.has(key)),
                );
              })()}

              <div className="flex gap-2 mt-6">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 font-semibold text-white bg-blue-600 rounded hover:bg-blue-700"
                >
                  Submit
                </button>
                <button
                  type="button"
                  onClick={() => handleElicitationResponse('decline')}
                  className="flex-1 px-4 py-2 font-semibold text-white bg-yellow-600 rounded hover:bg-yellow-700"
                >
                  Decline
                </button>
                <button
                  type="button"
                  onClick={() => handleElicitationResponse('cancel')}
                  className="flex-1 px-4 py-2 font-semibold text-white bg-red-600 rounded hover:bg-red-700"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
