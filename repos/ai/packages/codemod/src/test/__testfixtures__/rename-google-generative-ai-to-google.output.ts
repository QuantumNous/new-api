// @ts-ignore provider package is not a codemod dependency.
import { createGoogle, type GoogleProvider } from '@ai-sdk/google';

export const provider: GoogleProvider = createGoogle();
