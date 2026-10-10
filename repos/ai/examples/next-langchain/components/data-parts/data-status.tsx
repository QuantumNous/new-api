'use client';

export interface DataStatusProps {
  status: 'complete' | 'pending' | string;
  message: string;
}

export function DataStatus({ status, message }: DataStatusProps) {
  const isComplete = status === 'complete';

  return (
    <div
      className={`p-3 rounded-lg border text-sm ${
        isComplete
          ? 'bg-green-500/10 border-green-500/30'
          : 'bg-yellow-500/10 border-yellow-500/30'
      }`}
    >
      <div className="flex items-center gap-2">
        {isComplete ? (
          <svg
            className="h-5 w-5 text-green-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        ) : (
          <div className="h-5 w-5 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
        )}
        <span
          className={`font-medium ${
            isComplete ? 'text-green-400' : 'text-yellow-400'
          }`}
        >
          {message}
        </span>
      </div>
    </div>
  );
}
