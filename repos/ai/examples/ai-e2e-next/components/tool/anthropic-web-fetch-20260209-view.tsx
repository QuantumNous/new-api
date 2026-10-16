import type { anthropic } from '@ai-sdk/anthropic';
import type { UIToolInvocation } from 'ai';

export default function AnthropicWebFetch20260209View({
  invocation,
}: {
  invocation: UIToolInvocation<
    ReturnType<typeof anthropic.tools.webFetch_20260209>
  >;
}) {
  switch (invocation.state) {
    case 'input-streaming':
    case 'input-available':
      return (
        <div className="flex flex-col gap-2 p-3 bg-emerald-50 rounded border-l-4 border-emerald-400 shadow">
          <div className="flex items-center font-semibold text-emerald-700">
            <span className="inline-block mr-2 bg-emerald-200 text-emerald-900 rounded px-2 py-0.5 text-xs font-mono tracking-wider">
              FETCH
            </span>
            Fetching URL...
          </div>
          <div className="pl-5 text-sm text-emerald-800">
            <span className="font-semibold">URL:</span>{' '}
            <span className="inline-block bg-white border border-emerald-100 rounded px-2 py-0.5 font-mono break-all">
              {invocation.input?.url}
            </span>
          </div>
        </div>
      );
    case 'output-available':
      return (
        <div className="flex flex-col gap-2 p-3 bg-emerald-50 rounded border-l-4 border-emerald-400 shadow">
          <div className="flex items-center font-semibold text-emerald-700">
            <span className="inline-block mr-2 bg-emerald-200 text-emerald-900 rounded px-2 py-0.5 text-xs font-mono tracking-wider">
              FETCH
            </span>
            Fetched content
          </div>
          <div className="pl-5 text-sm text-emerald-800">
            <span className="font-semibold">URL:</span>{' '}
            <span className="inline-block bg-white border border-emerald-100 rounded px-2 py-0.5 font-mono break-all">
              {invocation.input.url}
            </span>
          </div>
          <div className="pl-5 text-xs text-emerald-900">
            <span className="font-semibold">Title:</span>{' '}
            {invocation.output.content.title ?? 'N/A'}
          </div>
          <div className="pl-5 text-xs text-emerald-900">
            <span className="font-semibold">Type:</span>{' '}
            {invocation.output.content.source.mediaType}
          </div>
        </div>
      );
  }
}
