'use client';

export interface DataProgressProps {
  step: string;
  message: string;
  progress: number;
  currentStep: number;
  totalSteps: number;
}

export function DataProgress({
  step,
  message,
  progress,
  currentStep,
  totalSteps,
}: DataProgressProps) {
  // Don't show the progress bar if the analysis is complete
  if (currentStep === totalSteps) {
    return null;
  }

  return (
    <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/30 text-sm">
      <div className="flex items-center gap-2 mb-2">
        <div className="animate-spin h-4 w-4 border-2 border-blue-400 border-t-transparent rounded-full" />
        <span className="font-medium text-blue-400">
          Step {currentStep}/{totalSteps}: {step}
        </span>
      </div>
      <p className="text-blue-300/80 mb-2">{message}</p>
      <div className="w-full bg-blue-500/20 rounded-full h-2">
        <div
          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-xs text-blue-400/60 mt-1 text-right">{progress}%</p>
    </div>
  );
}
