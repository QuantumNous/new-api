'use client';

interface TextProps {
  text: string;
}

/**
 * Renders a text message part
 */
export function Text({ text }: TextProps) {
  return <div className="whitespace-pre-wrap leading-relaxed">{text}</div>;
}
