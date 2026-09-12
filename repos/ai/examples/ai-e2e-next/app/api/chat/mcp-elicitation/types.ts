import { UIDataTypes, type UIMessage } from 'ai';
export type ElicitationAction = 'accept' | 'decline' | 'cancel';

export interface ElicitationRequest {
  id: string;
  message: string;
  requestedSchema: unknown;
}

export interface ElicitationResponse {
  id: string;
  action: ElicitationAction;
  content?: Record<string, unknown>;
}

// Define custom data types for elicitation
export type ElicitationDataTypes = {
  'elicitation-request': {
    elicitationId: string;
    message: string;
    requestedSchema: unknown;
  };
  'elicitation-response': {
    elicitationId: string;
    action: ElicitationAction;
    content?: Record<string, unknown>;
  };
};

// Define custom message type with elicitation data parts
export type MCPElicitationUIMessage = UIMessage<
  never, // metadata type
  ElicitationDataTypes,
  never // no tools in this example (all tools come from MCP)
>;
