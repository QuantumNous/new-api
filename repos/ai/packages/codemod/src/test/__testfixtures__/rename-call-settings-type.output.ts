import { type LanguageModelCallOptions, type RequestOptions } from 'ai';

let settings: LanguageModelCallOptions & Omit<RequestOptions, 'timeout'>;
