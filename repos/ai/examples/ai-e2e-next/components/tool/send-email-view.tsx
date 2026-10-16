import type { SendEmailUIToolInvocation } from '@/agent/anthropic/tool-search-agent';

export default function SendEmailView({
  invocation,
}: {
  invocation: SendEmailUIToolInvocation;
}) {
  switch (invocation.state) {
    case 'input-available': {
      return (
        <div className="flex flex-col gap-2 p-3 bg-violet-50 rounded border-l-4 border-violet-400 shadow">
          <div className="flex items-center font-semibold text-violet-700">
            <span className="inline-block mr-2 bg-violet-200 text-violet-900 rounded px-2 py-0.5 text-xs font-mono tracking-wider">
              EMAIL
            </span>
            Sending email...
          </div>
          <div className="pl-5 text-sm text-violet-800">
            <span className="font-semibold">To:</span>{' '}
            <span className="inline-block bg-white border border-violet-100 rounded px-2 py-0.5 font-mono">
              {invocation.input.to}
            </span>
          </div>
          <div className="pl-5 text-sm text-violet-800">
            <span className="font-semibold">Subject:</span>{' '}
            <span className="inline-block bg-white border border-violet-100 rounded px-2 py-0.5">
              {invocation.input.subject}
            </span>
          </div>
        </div>
      );
    }
    case 'output-available': {
      const output = invocation.output;
      return (
        <div className="flex flex-col gap-2 p-3 bg-violet-50 rounded border-l-4 border-violet-400 shadow">
          <div className="flex items-center font-semibold text-violet-700">
            <span className="inline-block mr-2 bg-violet-200 text-violet-900 rounded px-2 py-0.5 text-xs font-mono tracking-wider">
              EMAIL
            </span>
            {output.success ? 'Email sent' : 'Failed to send'}
          </div>
          <div className="pl-5 text-sm text-violet-800">
            <span className="font-semibold">To:</span>{' '}
            <span className="inline-block bg-white border border-violet-100 rounded px-2 py-0.5 font-mono">
              {invocation.input.to}
            </span>
          </div>
          <div className="pl-5 text-sm text-violet-800">
            <span className="font-semibold">Subject:</span>{' '}
            <span className="inline-block bg-white border border-violet-100 rounded px-2 py-0.5">
              {output.subject}
            </span>
          </div>
          <div className="pl-5 text-xs text-violet-600">{output.message}</div>
        </div>
      );
    }

    case 'output-error':
      return (
        <div className="flex flex-col gap-2 p-3 bg-red-50 rounded border-l-4 border-red-400 shadow">
          <div className="flex items-center font-semibold text-red-700">
            <span className="inline-block mr-2 bg-red-200 text-red-900 rounded px-2 py-0.5 text-xs font-mono tracking-wider">
              EMAIL
            </span>
            Error
          </div>
          <div className="pl-5 text-sm text-red-600">
            {invocation.errorText}
          </div>
        </div>
      );
  }
}
