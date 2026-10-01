/* eslint-disable @next/next/no-img-element */
'use client';

import { useState } from 'react';
import { Download, ImageIcon, ZoomIn, X } from 'lucide-react';

interface FileProps {
  url: string;
  mediaType: string;
}

/**
 * Renders a file message part (images, documents, etc.)
 */
export function File({ url, mediaType }: FileProps) {
  /**
   * Handle image files
   */
  if (mediaType?.startsWith('image/')) {
    const format = mediaType.split('/')[1] || 'png';
    return (
      <div>
        <GeneratedImage base64={url} format={format} />
      </div>
    );
  }

  /**
   * Handle other file types (placeholder for future extensions)
   */
  return null;
}

/**
 * Ensure image string has proper format
 * Handles: data URIs and raw base64
 */
function toImageSrc(input: string, format: string = 'png'): string {
  // Already a data URI
  if (input.startsWith('data:image/')) return input;
  // Raw base64 - add data URI prefix
  return `data:image/${format};base64,${input}`;
}

/**
 * Image viewer modal for full-size preview
 */
function ImageModal({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
      >
        <X className="w-6 h-6" />
      </button>
      <img
        src={src}
        alt="Generated image full size"
        className="max-w-[90vw] max-h-[90vh] rounded-lg shadow-2xl"
        onClick={e => e.stopPropagation()}
      />
    </div>
  );
}

/**
 * Component to render a generated image with download and zoom options
 * Accepts either a data URL or raw base64 string
 */
export function GeneratedImage({
  base64,
  format = 'png',
}: {
  base64: string;
  format?: string;
}) {
  const [showModal, setShowModal] = useState(false);
  /**
   * Convert to proper image source - handles data URIs and raw base64
   */
  const src = toImageSrc(base64, format);

  /**
   * Handle download of the image
   */
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = src;
    link.download = `image-${Date.now()}.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <div className="group relative">
        <div className="relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--background-secondary)] w-fit">
          <img
            src={src}
            alt="Image"
            className="max-w-md rounded-xl cursor-pointer transition-transform hover:scale-[1.02]"
            onClick={() => setShowModal(true)}
          />
          {/* Overlay with actions */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-3 gap-2">
            <button
              onClick={() => setShowModal(true)}
              className="px-3 py-1.5 text-xs font-medium bg-white/20 hover:bg-white/30 text-white rounded-full backdrop-blur-sm flex items-center gap-1.5 transition-colors"
            >
              <ZoomIn className="w-3.5 h-3.5" />
              View
            </button>
            <button
              onClick={handleDownload}
              className="px-3 py-1.5 text-xs font-medium bg-white/20 hover:bg-white/30 text-white rounded-full backdrop-blur-sm flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </button>
          </div>
        </div>
        <div className="inline-flex items-center gap-1.5 mt-2 px-2 py-1 text-xs font-medium text-[var(--foreground)] bg-[var(--background-secondary)] rounded-md border border-[var(--border)]">
          <ImageIcon className="w-3.5 h-3.5" />
          <span>Image</span>
        </div>
      </div>
      {showModal && (
        <ImageModal src={src} onClose={() => setShowModal(false)} />
      )}
    </>
  );
}
