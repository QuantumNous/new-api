import type { UIMessage } from 'ai';

/**
 * Progress updates during long-running operations.
 * Emitted by the analyze_data tool.
 */
export interface ProgressData {
  type: 'progress';
  id: string;
  step: string;
  message: string;
  progress: number;
  totalSteps: number;
  currentStep: number;
}

/**
 * Status updates for operation completion.
 * Emitted when an operation finishes.
 */
export interface StatusData {
  type: 'status';
  id: string;
  status: 'complete' | 'pending' | 'error';
  message: string;
}

/**
 * File operation status updates.
 * Emitted by the process_file tool.
 */
export interface FileStatusData {
  type: 'file-status';
  id: string;
  filename: string;
  operation: 'read' | 'compress' | 'validate' | 'transform';
  status: 'started' | 'completed' | 'error';
  size?: string;
}

/**
 * Custom data types emitted by the agent's tools.
 * These map to data-{type} parts in the UI stream.
 */
export type CustomDataTypes = {
  progress: ProgressData;
  status: StatusData;
  'file-status': FileStatusData;
};

/**
 * Tool definitions matching the LangGraph agent's tools.
 * This provides type-safe tool invocations in the UI.
 */
export type AgentTools = {
  analyze_data: {
    input: {
      dataSource: 'sales' | 'inventory' | 'customers' | 'transactions';
      analysisType: 'trends' | 'anomalies' | 'correlations' | 'summary';
    };
    output: string;
  };

  process_file: {
    input: {
      filename: string;
      operation: 'read' | 'compress' | 'validate' | 'transform';
    };
    output: string;
  };
};

/**
 * Fully typed UIMessage for the custom-data agent.
 * Includes custom data types and tool types.
 */
export type CustomDataMessage = UIMessage<unknown, CustomDataTypes, AgentTools>;
