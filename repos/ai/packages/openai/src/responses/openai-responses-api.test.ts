import type { InferSchema } from '@ai-sdk/provider-utils';
import { describe, expectTypeOf, it } from 'vitest';
import type {
  openaiResponsesChunkSchema,
  openaiResponsesResponseSchema,
} from './openai-responses-api';

/**
 * expectTypeOf is utilized to ensure that the required sections of openaiResponsesChunkSchema
 * and openaiResponsesResponseSchema are of the same type.
 */

describe('openaiResponses schema alignment', () => {
  type Chunk = InferSchema<typeof openaiResponsesChunkSchema>;
  type Response = InferSchema<typeof openaiResponsesResponseSchema>;

  it('matches annotation shape between chunk and response schemas', () => {
    type ChunkAnnotation = Extract<
      Chunk,
      { type: 'response.output_text.annotation.added' }
    >['annotation'];

    type ResponseAnnotation = Extract<
      NonNullable<Response['output']>[number],
      { type: 'message' }
    >['content'][number]['annotations'][number];

    expectTypeOf<ChunkAnnotation>().toEqualTypeOf<ResponseAnnotation>();
  });

  it('aligns web_search_call actions', () => {
    type ChunkWebSearchAction = Extract<
      Extract<Chunk, { type: 'response.output_item.done' }>['item'],
      { type: 'web_search_call' }
    >['action'];

    type ResponseWebSearchAction = Extract<
      NonNullable<Response['output']>[number],
      { type: 'web_search_call' }
    >['action'];

    expectTypeOf<ChunkWebSearchAction>().toEqualTypeOf<ResponseWebSearchAction>();
  });

  it('aligns code_interpreter outputs', () => {
    type ChunkCodeInterpreterOutputs = Extract<
      Extract<Chunk, { type: 'response.output_item.done' }>['item'],
      { type: 'code_interpreter_call' }
    >['outputs'];

    type ResponseCodeInterpreterOutputs = Extract<
      NonNullable<Response['output']>[number],
      { type: 'code_interpreter_call' }
    >['outputs'];

    expectTypeOf<ChunkCodeInterpreterOutputs>().toEqualTypeOf<ResponseCodeInterpreterOutputs>();
  });

  it('aligns file_search_call results', () => {
    type ChunkFileSearchResults = Extract<
      Extract<Chunk, { type: 'response.output_item.done' }>['item'],
      { type: 'file_search_call' }
    >['results'];

    type ResponseFileSearchResults = Extract<
      NonNullable<Response['output']>[number],
      { type: 'file_search_call' }
    >['results'];

    expectTypeOf<ChunkFileSearchResults>().toEqualTypeOf<ResponseFileSearchResults>();
  });

  it('aligns message phase between added chunk, done chunk, and response schemas', () => {
    type AddedChunkPhase = Extract<
      Extract<Chunk, { type: 'response.output_item.added' }>['item'],
      { type: 'message' }
    >['phase'];

    type DoneChunkPhase = Extract<
      Extract<Chunk, { type: 'response.output_item.done' }>['item'],
      { type: 'message' }
    >['phase'];

    type ResponsePhase = Extract<
      NonNullable<Response['output']>[number],
      { type: 'message' }
    >['phase'];

    expectTypeOf<AddedChunkPhase>().toEqualTypeOf<DoneChunkPhase>();
    expectTypeOf<DoneChunkPhase>().toEqualTypeOf<ResponsePhase>();
  });

  it('aligns output_text logprobs', () => {
    type ChunkLogprobs = Extract<
      Chunk,
      { type: 'response.output_text.delta' }
    >['logprobs'];

    type ResponseLogprobs = Extract<
      Extract<
        NonNullable<Response['output']>[number],
        { type: 'message' }
      >['content'][number],
      { type: 'output_text' }
    >['logprobs'];

    expectTypeOf<ChunkLogprobs>().toEqualTypeOf<ResponseLogprobs>();
  });
});
