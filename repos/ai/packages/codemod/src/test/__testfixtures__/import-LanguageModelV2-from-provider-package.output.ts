// @ts-nocheck
import { LanguageModelV2 } from '@ai-sdk/provider';
import { LanguageModelV2 } from '@ai-sdk/provider';
import { LanguageModelV2Middleware } from '@ai-sdk/provider';
import { LanguageModelV2Middleware } from '@ai-sdk/provider';
import { someOtherFunction } from 'ai';

// Multiple imports in one declaration
import {
  LanguageModelV2 as LMV1Multi,
  LanguageModelV2 as LMV2Multi,
  LanguageModelV2Middleware as LMV1MiddlewareMulti,
  LanguageModelV2Middleware as LMV2MiddlewareMulti,
} from '@ai-sdk/provider';

import { anotherFunction } from 'ai';

// Import with alias
import { LanguageModelV2 as LMV1 } from '@ai-sdk/provider';

// Mixed imports
import { LanguageModelV2 as LMV1Mixed } from '@ai-sdk/provider';

import { generateText } from 'ai';

// Should not affect other packages
import { LanguageModelV1 as LMV1Other } from 'some-other-package';
import { LanguageModelV2 as LMV2Other } from 'another-package';
