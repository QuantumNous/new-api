import type {
  GroundingMetadataSchema,
  PromptFeedbackSchema,
  SafetyRatingSchema,
  UrlContextMetadataSchema,
  UsageMetadataSchema,
} from './google-language-model';

export type GooglePrompt = {
  systemInstruction?: GoogleSystemInstruction;
  contents: Array<GoogleContent>;
};

export type GoogleSystemInstruction = {
  parts: Array<{ text: string }>;
};

export type GoogleContent = {
  role: 'user' | 'model';
  parts: Array<GoogleContentPart>;
};

export type GoogleContentPart =
  | { text: string; thought?: boolean; thoughtSignature?: string }
  | {
      inlineData: { mimeType: string; data: string };
      thought?: boolean;
      thoughtSignature?: string;
    }
  | {
      functionCall: { id?: string; name: string; args: unknown };
      thoughtSignature?: string;
    }
  | {
      functionResponse: {
        id?: string;
        name: string;
        response: unknown;
        parts?: Array<GoogleFunctionResponsePart>;
      };
    }
  | {
      fileData: { mimeType: string; fileUri: string };
      thought?: boolean;
      thoughtSignature?: string;
    }
  | {
      toolCall: {
        toolType: string;
        args?: unknown;
        id: string;
      };
      thoughtSignature?: string;
    }
  | {
      toolResponse: {
        toolType: string;
        response?: unknown;
        id: string;
      };
      thoughtSignature?: string;
    };

export type GoogleFunctionResponsePart = {
  inlineData: { mimeType: string; data: string };
};

export type GoogleGroundingMetadata = GroundingMetadataSchema;

export type GoogleUrlContextMetadata = UrlContextMetadataSchema;

export type GoogleSafetyRating = SafetyRatingSchema;

export type GooglePromptFeedback = PromptFeedbackSchema;

export type GoogleUsageMetadata = UsageMetadataSchema;

export interface GoogleProviderMetadata {
  promptFeedback: GooglePromptFeedback | null;
  groundingMetadata: GoogleGroundingMetadata | null;
  urlContextMetadata: GoogleUrlContextMetadata | null;
  safetyRatings: GoogleSafetyRating[] | null;
  usageMetadata: GoogleUsageMetadata | null;
  finishMessage: string | null;
  serviceTier: string | null;
}
