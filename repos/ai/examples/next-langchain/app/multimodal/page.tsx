'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  AlertCircle,
  ImageIcon,
  X,
  Send,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { ChatMessage } from '../../components/chat-message';
import { ThinkingIndicator } from '../../components/thinking-indicator';
import type { CustomDataMessage } from '../types';

const transport = new DefaultChatTransport({
  api: '/api/multimodal',
});

/**
 * Pre-loaded image examples using local images
 * These allow users to instantly try the vision capabilities
 * Images are stored in public/images and converted to base64 before sending
 */
const IMAGE_EXAMPLES = [
  {
    label: 'Analyze Architecture',
    prompt:
      'Describe the architectural style and notable features of this building.',
    filename: 'empire-state-building.jpg',
    imagePath: '/images/empire-state-building.jpg',
  },
  {
    label: 'Describe Nature Scene',
    prompt:
      'What animals and plants can you identify in this image? Describe the ecosystem.',
    filename: 'macaw-parrot.jpg',
    imagePath: '/images/macaw-parrot.jpg',
  },
  {
    label: 'Read Document',
    prompt:
      'What information can you extract from this document? Summarize the key points.',
    filename: 'constitution.jpg',
    imagePath: '/images/constitution.jpg',
  },
  {
    label: 'Analyze Artwork',
    prompt:
      'Analyze the artistic techniques, style, and historical context of this painting.',
    filename: 'mona-lisa.jpg',
    imagePath: '/images/mona-lisa.jpg',
  },
];

/**
 * Converts an image URL to a base64 data URL
 * This is needed because OpenAI can't access localhost images
 */
async function imageToBase64(imagePath: string): Promise<string> {
  const response = await fetch(imagePath);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function MultimodalPage() {
  const { messages, sendMessage, status, error } = useChat<CustomDataMessage>({
    transport,
  });

  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isLoading = status === 'submitted' || status === 'streaming';

  /**
   * Auto-scroll to bottom when new messages arrive
   */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = event => {
        setSelectedImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    setImageFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = useCallback(async () => {
    if (!input.trim() && !selectedImage) return;

    const messageContent = input.trim() || 'What is in this image?';

    if (selectedImage && imageFile) {
      /**
       * Send message with image attachment
       */
      await sendMessage({
        text: messageContent,
        files: [
          {
            type: 'file',
            mediaType: imageFile.type,
            url: selectedImage,
            filename: imageFile.name,
          },
        ],
      });
    } else {
      /**
       * Send text-only message
       */
      await sendMessage({ text: messageContent });
    }

    setInput('');
    clearImage();
  }, [input, selectedImage, imageFile, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  /**
   * Handle clicking on a pre-loaded image example
   * Converts the local image to base64 and sends it to the model
   */
  const handleImageExample = async (example: (typeof IMAGE_EXAMPLES)[0]) => {
    /**
     * Convert local image to base64 data URL
     */
    const dataUrl = await imageToBase64(example.imagePath);

    /**
     * Send message with image attachment
     */
    await sendMessage({
      text: example.prompt,
      files: [
        {
          type: 'file',
          mediaType: 'image/jpeg',
          url: dataUrl,
          filename: example.filename,
        },
      ],
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 p-6 border-b border-[var(--border)] rounded-t-xl">
        <h1 className="text-2xl font-semibold text-[var(--foreground)] mb-2">
          Multimodal Vision
        </h1>
        <div className="text-sm text-[var(--foreground-secondary)] leading-relaxed">
          Send images to <strong>GPT-4o</strong> for analysis. This example
          demonstrates multimodal input using the <code>@ai-sdk/langchain</code>{' '}
          adapter, which properly converts images and files to LangChain&apos;s
          multimodal content format.
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="mx-6 mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" strokeWidth={2} />
            {error.message}
          </div>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-16 h-16 rounded-full bg-[var(--accent)]/10 flex items-center justify-center mb-6">
              <ImageIcon className="w-8 h-8 text-[var(--accent)]" />
            </div>
            <h2 className="text-xl font-medium text-[var(--foreground)] mb-2">
              Vision-Enabled Chat
            </h2>
            <p className="text-[var(--foreground-secondary)] max-w-lg mb-8">
              Click on any example below to see GPT-4o analyze the image, or
              upload your own image using the button below.
            </p>

            {/* Image Examples Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl w-full">
              {IMAGE_EXAMPLES.map((example, index) => (
                <button
                  key={index}
                  onClick={() => handleImageExample(example)}
                  disabled={isLoading}
                  className="group relative rounded-xl overflow-hidden border border-[var(--border)]
                           bg-[var(--background-secondary)] hover:border-[var(--accent)]
                           transition-all duration-300 hover:shadow-lg hover:shadow-[var(--accent)]/10
                           disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {/* Image */}
                  <div className="aspect-square overflow-hidden">
                    <img
                      src={example.imagePath}
                      alt={example.label}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>

                  {/* Label overlay */}
                  <div
                    className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent 
                                flex flex-col justify-end p-3"
                  >
                    <div className="flex items-center gap-1.5 text-white text-sm font-medium">
                      <Sparkles className="w-3.5 h-3.5" />
                      {example.label}
                    </div>
                  </div>

                  {/* Hover indicator */}
                  <div
                    className="absolute inset-0 bg-[var(--accent)]/0 group-hover:bg-[var(--accent)]/10 
                                transition-colors duration-300 flex items-center justify-center"
                  >
                    <div
                      className="opacity-0 group-hover:opacity-100 transition-opacity duration-300
                                  bg-[var(--accent)] text-white px-3 py-1.5 rounded-full text-xs font-medium
                                  flex items-center gap-1.5"
                    >
                      <Send className="w-3 h-3" />
                      Analyze
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <p className="text-xs text-[var(--foreground-secondary)] mt-6">
              Or upload your own image using the button below
            </p>
          </div>
        ) : (
          <>
            {messages.map(message => (
              <ChatMessage key={message.id} message={message} />
            ))}
            <ThinkingIndicator isStreaming={isLoading} />
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Image Preview */}
      {selectedImage && (
        <div className="mx-6 mb-2 p-3 bg-[var(--background-secondary)] rounded-lg border border-[var(--border)]">
          <div className="flex items-start gap-3">
            <div className="relative">
              <img
                src={selectedImage}
                alt="Selected"
                className="w-20 h-20 object-cover rounded-md"
              />
              <button
                onClick={clearImage}
                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full 
                         flex items-center justify-center text-white hover:bg-red-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 text-sm text-[var(--foreground-secondary)]">
              <p className="font-medium text-[var(--foreground)]">
                {imageFile?.name}
              </p>
              <p>{(imageFile?.size ?? 0 / 1024).toFixed(1)} KB</p>
            </div>
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="flex-shrink-0 p-4 border-t border-[var(--border)]">
        <div className="flex gap-3">
          {/* Image upload button */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageSelect}
            accept="image/*"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="flex-shrink-0 w-12 h-12 rounded-xl border border-[var(--border)] 
                     bg-[var(--background-secondary)] hover:bg-[var(--background-tertiary)]
                     flex items-center justify-center text-[var(--foreground-secondary)]
                     hover:text-[var(--accent)] transition-all duration-200
                     disabled:opacity-50 disabled:cursor-not-allowed"
            title="Attach image"
          >
            <ImageIcon className="w-5 h-5" />
          </button>

          {/* Text input */}
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                selectedImage
                  ? 'Ask about this image...'
                  : 'Type a message or attach an image...'
              }
              disabled={isLoading}
              rows={1}
              className="w-full px-4 py-3 pr-12 rounded-xl border border-[var(--border)]
                       bg-[var(--background-secondary)] text-[var(--foreground)]
                       placeholder-[var(--foreground-secondary)] resize-none
                       focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50
                       disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Send button */}
          <button
            onClick={handleSubmit}
            disabled={isLoading || (!input.trim() && !selectedImage)}
            className="flex-shrink-0 w-12 h-12 rounded-xl bg-[var(--accent)] 
                     hover:bg-[var(--accent-hover)] text-white
                     flex items-center justify-center transition-all duration-200
                     disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>

        <p className="text-xs text-[var(--foreground-secondary)] mt-2 text-center">
          Supports JPEG, PNG, GIF, and WebP images up to 20MB
        </p>
      </div>
    </div>
  );
}
