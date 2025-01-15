import { parse, SFCBlock, SFCCustomBlock, SFCDescriptor } from './parse'

import {
  compileTemplate,
  TemplateCompileOptions,
  TemplateCompileResult
} from './compileTemplate'

import {
  compileStyle,
  compileStyleAsync,
  StyleCompileOptions,
  StyleCompileResults
} from './compileStyle'

// API
export { parse, compileTemplate, compileStyle, compileStyleAsync }

// types
export {
  SFCBlock,
  SFCCustomBlock,
  SFCDescriptor,
  TemplateCompileOptions,
  TemplateCompileResult,
  StyleCompileOptions,
  StyleCompileResults
}
