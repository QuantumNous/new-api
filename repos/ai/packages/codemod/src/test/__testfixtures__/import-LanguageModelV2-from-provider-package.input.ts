// @ts-nocheck
import { LanguageModelV1 } from 'ai';
import { LanguageModelV2 } from 'ai';
import { LanguageModelV1Middleware } from 'ai';
import { LanguageModelV2Middleware } from 'ai';
import { someOtherFunction } from 'ai';

// Multiple imports in one declaration
import { 
  LanguageModelV1 as LMV1Multi, 
  LanguageModelV2 as LMV2Multi, 
  LanguageModelV1Middleware as LMV1MiddlewareMulti,
  LanguageModelV2Middleware as LMV2MiddlewareMulti,
  anotherFunction 
} from 'ai';

// Import with alias
import { LanguageModelV1 as LMV1 } from 'ai';

// Mixed imports
import { LanguageModelV1 as LMV1Mixed, generateText } from 'ai';

// Should not affect other packages
import { LanguageModelV1 as LMV1Other } from 'some-other-package';
import { LanguageModelV2 as LMV2Other } from 'another-package';
