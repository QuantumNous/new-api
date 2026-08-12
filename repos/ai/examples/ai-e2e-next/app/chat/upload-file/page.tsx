'use client';

import ChatInput from '@/components/chat-input';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, generateId, type FileUIPart } from 'ai';
import { useRef, useState } from 'react';

const MODELS = [
  {
    id: 'claude-sonnet-4-6',
    provider: 'anthropic',
    label: 'Claude Sonnet 4.6 (Anthropic)',
  },
  {
    id: 'gemini-3.1-pro-preview',
    provider: 'google',
    label: 'Gemini 3.1 Pro Preview (Google)',
  },
  { id: 'gpt-5.4', provider: 'openai', label: 'GPT-5.4 (OpenAI)' },
  {
    id: 'grok-4.20-0309-reasoning',
    provider: 'xai',
    label: 'Grok 4.20 Reasoning (xAI)',
  },
] as const;

type UploadedFile = {
  id: string;
  filename: string;
  mediaType: string;
  providerReference: Record<string, string>;
  dataUrl: string;
};

async function uploadToProvider({
  base64,
  mediaType,
  filename,
  provider,
}: {
  base64: string;
  mediaType: string;
  filename: string;
  provider: string;
}): Promise<{ providerReference: Record<string, string> }> {
  const res = await fetch('/api/upload-file', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: base64, mediaType, filename, provider }),
  });

  if (!res.ok) {
    throw new Error(`Upload failed: ${res.statusText}`);
  }

  const { providerReference } = await res.json();
  return { providerReference };
}

export default function UploadFilePage() {
  const [selectedModelIndex, setSelectedModelIndex] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(
    new Set(),
  );
  const [uploadingIds, setUploadingIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedModel = MODELS[selectedModelIndex];

  const { messages, setMessages, sendMessage, regenerate, status, error } =
    useChat({
      transport: new DefaultChatTransport({
        api: '/api/chat/upload-file',
      }),
    });

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingIds(prev => new Set(prev).add('new'));
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const base64 = dataUrl.split(',')[1];
      const { providerReference } = await uploadToProvider({
        base64,
        mediaType: file.type,
        filename: file.name,
        provider: selectedModel.provider,
      });

      const id = generateId();

      setUploadedFiles(prev => [
        ...prev,
        {
          id,
          filename: file.name,
          mediaType: file.type,
          providerReference,
          dataUrl,
        },
      ]);
      setSelectedFileIds(prev => new Set(prev).add(id));
    } finally {
      setUploadingIds(prev => {
        const next = new Set(prev);
        next.delete('new');
        return next;
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleUploadToProvider = async ({
    fileId,
    provider,
  }: {
    fileId: string;
    provider: string;
  }) => {
    const file = uploadedFiles.find(f => f.id === fileId);
    if (!file) return;

    setUploadingIds(prev => new Set(prev).add(fileId));
    try {
      const base64 = file.dataUrl.split(',')[1];
      const { providerReference } = await uploadToProvider({
        base64,
        mediaType: file.mediaType,
        filename: file.filename,
        provider,
      });

      const mergedReference = {
        ...file.providerReference,
        ...providerReference,
      };

      setUploadedFiles(prev =>
        prev.map(f =>
          f.id === fileId ? { ...f, providerReference: mergedReference } : f,
        ),
      );

      setMessages(prev =>
        prev.map(msg => ({
          ...msg,
          parts: msg.parts.map(part =>
            part.type === 'file' && part.url === file.dataUrl
              ? { ...part, providerReference: mergedReference }
              : part,
          ),
        })),
      );
    } finally {
      setUploadingIds(prev => {
        const next = new Set(prev);
        next.delete(fileId);
        return next;
      });
    }
  };

  const toggleFile = (id: string) => {
    setSelectedFileIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSend = (text: string) => {
    const files: FileUIPart[] = uploadedFiles
      .filter(f => selectedFileIds.has(f.id))
      .map(f => ({
        type: 'file' as const,
        url: f.dataUrl,
        mediaType: f.mediaType,
        filename: f.filename,
        providerReference: f.providerReference,
      }));

    sendMessage(
      { text, files },
      {
        body: {
          modelId: selectedModel.id,
          providerId: selectedModel.provider,
        },
      },
    );
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="w-64 border-r border-gray-200 p-4 flex flex-col gap-4">
        <h2 className="font-bold text-sm">Uploaded Files</h2>

        <div className="flex flex-col gap-2 flex-1 overflow-y-auto">
          {uploadedFiles.map(f => (
            <div key={f.id} className="flex flex-col gap-1 text-sm">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedFileIds.has(f.id)}
                  onChange={() => toggleFile(f.id)}
                  className="mt-0.5"
                />
                {f.mediaType.startsWith('image/') && (
                  <img
                    src={f.dataUrl}
                    alt={f.filename}
                    className="w-8 h-8 rounded object-cover flex-shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <div className="truncate">{f.filename}</div>
                </div>
              </label>
              <div className="ml-5 flex flex-wrap gap-1">
                {Object.keys(f.providerReference).map(p => (
                  <span
                    key={p}
                    className="text-xs bg-green-100 text-green-800 rounded px-1.5 py-0.5"
                  >
                    {p}
                  </span>
                ))}
                {!f.providerReference[selectedModel.provider] && (
                  <button
                    type="button"
                    disabled={uploadingIds.has(f.id)}
                    onClick={() =>
                      handleUploadToProvider({
                        fileId: f.id,
                        provider: selectedModel.provider,
                      })
                    }
                    className="text-xs bg-blue-100 text-blue-700 rounded px-1.5 py-0.5 hover:bg-blue-200 disabled:opacity-50"
                  >
                    {uploadingIds.has(f.id)
                      ? 'Uploading...'
                      : `Upload to ${selectedModel.provider}`}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            disabled={uploadingIds.has('new')}
            className="text-sm"
          />
          {uploadingIds.has('new') && (
            <div className="text-xs text-gray-500 mt-1">Uploading...</div>
          )}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <div className="border-b border-gray-200 p-4 flex items-center gap-4">
          <h1 className="font-bold">Upload File Chat</h1>
          <select
            value={selectedModelIndex}
            onChange={e => setSelectedModelIndex(Number(e.target.value))}
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          >
            {MODELS.map((m, i) => (
              <option key={m.id} value={i}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-2xl mx-auto flex flex-col gap-4 pb-20">
            {messages.map(message => (
              <div key={message.id} className="flex flex-col gap-1">
                <div className="text-xs text-gray-500 font-bold">
                  {message.role === 'user' ? 'User' : 'AI'}
                </div>
                {message.parts.map((part, index) => {
                  if (part.type === 'text') {
                    return (
                      <div key={index} className="whitespace-pre-wrap">
                        {part.text}
                      </div>
                    );
                  }
                  if (part.type === 'file') {
                    return (
                      <div
                        key={index}
                        className="text-xs text-gray-500 bg-gray-100 rounded px-2 py-1 inline-block"
                      >
                        📎 {part.filename ?? 'file'}
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            ))}

            {error && (
              <div className="mt-4">
                <div className="text-red-500">An error occurred.</div>
                <button
                  type="button"
                  className="px-4 py-2 mt-4 text-blue-500 rounded-md border border-blue-500"
                  onClick={() =>
                    regenerate({
                      body: {
                        modelId: selectedModel.id,
                        providerId: selectedModel.provider,
                      },
                    })
                  }
                >
                  Retry
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 p-4">
          <div className="max-w-2xl mx-auto">
            <ChatInput status={status} onSubmit={handleSend} />
          </div>
        </div>
      </div>
    </div>
  );
}
