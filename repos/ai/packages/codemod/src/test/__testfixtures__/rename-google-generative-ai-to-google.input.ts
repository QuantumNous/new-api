// @ts-ignore provider package is not a codemod dependency.
import { createGoogleGenerativeAI, type GoogleGenerativeAIProvider } from '@ai-sdk/google';

export const provider: GoogleGenerativeAIProvider = createGoogleGenerativeAI();
