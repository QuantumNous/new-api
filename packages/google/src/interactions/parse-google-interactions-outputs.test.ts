import { describe, expect, it } from 'vitest';
import { parseGoogleInteractionsOutputs } from './parse-google-interactions-outputs';
import type { GoogleInteractionsStep } from './google-interactions-api';

describe('parseGoogleInteractionsOutputs', () => {
  const generateId = () => 'gen-id';

  describe('thought steps', () => {
    it('emits a reasoning part with providerMetadata.google.signature when the thought step carries a signature', () => {
      const steps = [
        {
          type: 'thought',
          signature: 'thought-sig-AAA',
          summary: [{ type: 'text', text: 'I am thinking.' }],
        },
      ] as Array<GoogleInteractionsStep>;
      const { content } = parseGoogleInteractionsOutputs({
        steps,
        generateId,
      });
      expect(content).toMatchInlineSnapshot(`
        [
          {
            "providerMetadata": {
              "google": {
                "signature": "thought-sig-AAA",
              },
            },
            "text": "I am thinking.",
            "type": "reasoning",
          },
        ]
      `);
    });

    it('stamps providerMetadata.google.interactionId on every output part when interactionId is provided', () => {
      const steps = [
        {
          type: 'thought',
          signature: 'thought-sig',
          summary: [{ type: 'text', text: 'planning...' }],
        },
        {
          type: 'model_output',
          content: [{ type: 'text', text: 'answer' }],
        },
        {
          type: 'function_call',
          id: 'call_x',
          name: 'getWeather',
          arguments: { loc: 'NYC' },
          signature: 'fn-sig',
        },
      ] as Array<GoogleInteractionsStep>;
      const { content, hasFunctionCall } = parseGoogleInteractionsOutputs({
        steps,
        generateId,
        interactionId: 'v1_test-interaction',
      });
      expect(hasFunctionCall).toBe(true);
      expect(content).toMatchInlineSnapshot(`
        [
          {
            "providerMetadata": {
              "google": {
                "interactionId": "v1_test-interaction",
                "signature": "thought-sig",
              },
            },
            "text": "planning...",
            "type": "reasoning",
          },
          {
            "providerMetadata": {
              "google": {
                "interactionId": "v1_test-interaction",
              },
            },
            "text": "answer",
            "type": "text",
          },
          {
            "input": "{"loc":"NYC"}",
            "providerMetadata": {
              "google": {
                "interactionId": "v1_test-interaction",
                "signature": "fn-sig",
              },
            },
            "toolCallId": "call_x",
            "toolName": "getWeather",
            "type": "tool-call",
          },
        ]
      `);
    });

    it('omits providerMetadata when no signature and no interactionId are present', () => {
      const steps = [
        {
          type: 'model_output',
          content: [{ type: 'text', text: 'hello' }],
        },
      ] as Array<GoogleInteractionsStep>;
      const { content } = parseGoogleInteractionsOutputs({
        steps,
        generateId,
      });
      expect(content).toEqual([{ type: 'text', text: 'hello' }]);
    });

    it('skips user_input steps (server echo of client input)', () => {
      const steps = [
        {
          type: 'user_input',
          content: [{ type: 'text', text: 'hi' }],
        },
        {
          type: 'model_output',
          content: [{ type: 'text', text: 'hello' }],
        },
      ] as Array<GoogleInteractionsStep>;
      const { content } = parseGoogleInteractionsOutputs({
        steps,
        generateId,
      });
      expect(content).toEqual([{ type: 'text', text: 'hello' }]);
    });
  });

  describe('function_call steps', () => {
    it('captures function_call.signature into providerMetadata.google.signature', () => {
      const steps = [
        {
          type: 'function_call',
          id: 'call_abc',
          name: 'doThing',
          arguments: {},
          signature: 'fn-sig-BBB',
        },
      ] as Array<GoogleInteractionsStep>;
      const { content } = parseGoogleInteractionsOutputs({
        steps,
        generateId,
      });
      expect(content[0]).toMatchObject({
        type: 'tool-call',
        toolCallId: 'call_abc',
        toolName: 'doThing',
        providerMetadata: {
          google: { signature: 'fn-sig-BBB' },
        },
      });
    });
  });

  describe('image content in model_output steps', () => {
    it('emits a file content part with mediaType + base64 data when an image block carries inline data', () => {
      const steps = [
        {
          type: 'model_output',
          content: [
            {
              type: 'image',
              mime_type: 'image/png',
              data: 'aGVsbG8td29ybGQ=',
            },
          ],
        },
      ] as Array<GoogleInteractionsStep>;
      const { content } = parseGoogleInteractionsOutputs({
        steps,
        generateId,
        interactionId: 'v1_image-out',
      });
      expect(content).toMatchInlineSnapshot(`
        [
          {
            "data": {
              "data": "aGVsbG8td29ybGQ=",
              "type": "data",
            },
            "mediaType": "image/png",
            "providerMetadata": {
              "google": {
                "interactionId": "v1_image-out",
              },
            },
            "type": "file",
          },
        ]
      `);
    });

    it('emits a file content part with a URL data variant when an image block carries a uri', () => {
      const steps = [
        {
          type: 'model_output',
          content: [
            {
              type: 'image',
              mime_type: 'image/jpeg',
              uri: 'https://example.test/img.jpg',
            },
          ],
        },
      ] as Array<GoogleInteractionsStep>;
      const { content } = parseGoogleInteractionsOutputs({
        steps,
        generateId,
      });
      expect(content[0]).toMatchObject({
        type: 'file',
        mediaType: 'image/jpeg',
        data: { type: 'url' },
      });
      expect((content[0] as { data: { url: URL } }).data.url.toString()).toBe(
        'https://example.test/img.jpg',
      );
    });

    it('skips an image block with neither data nor uri', () => {
      const steps = [
        {
          type: 'model_output',
          content: [{ type: 'image', mime_type: 'image/png' }],
        },
      ] as Array<GoogleInteractionsStep>;
      const { content } = parseGoogleInteractionsOutputs({
        steps,
        generateId,
      });
      expect(content).toEqual([]);
    });
  });

  describe('video content in model_output steps', () => {
    it('emits a file content part with mediaType + base64 data when a video block carries inline data', () => {
      const steps = [
        {
          type: 'model_output',
          content: [
            {
              type: 'video',
              mime_type: 'video/mp4',
              data: 'AAAAIGZ0eXBpc29t',
            },
          ],
        },
      ] as Array<GoogleInteractionsStep>;
      const { content } = parseGoogleInteractionsOutputs({
        steps,
        generateId,
        interactionId: 'v1_video-out',
      });
      expect(content).toMatchInlineSnapshot(`
        [
          {
            "data": {
              "data": "AAAAIGZ0eXBpc29t",
              "type": "data",
            },
            "mediaType": "video/mp4",
            "providerMetadata": {
              "google": {
                "interactionId": "v1_video-out",
              },
            },
            "type": "file",
          },
        ]
      `);
    });

    it('defaults mediaType to video/mp4 when mime_type is absent', () => {
      const steps = [
        {
          type: 'model_output',
          content: [{ type: 'video', data: 'AAAAIGZ0eXBpc29t' }],
        },
      ] as Array<GoogleInteractionsStep>;
      const { content } = parseGoogleInteractionsOutputs({
        steps,
        generateId,
      });
      expect(content[0]).toMatchObject({
        type: 'file',
        mediaType: 'video/mp4',
        data: { type: 'data', data: 'AAAAIGZ0eXBpc29t' },
      });
    });

    it('emits a file content part with a URL data variant when a video block carries a uri', () => {
      const steps = [
        {
          type: 'model_output',
          content: [
            {
              type: 'video',
              mime_type: 'video/mp4',
              uri: 'https://example.test/clip.mp4',
            },
          ],
        },
      ] as Array<GoogleInteractionsStep>;
      const { content } = parseGoogleInteractionsOutputs({
        steps,
        generateId,
      });
      expect(content[0]).toMatchObject({
        type: 'file',
        mediaType: 'video/mp4',
        data: { type: 'url' },
      });
      expect((content[0] as { data: { url: URL } }).data.url.toString()).toBe(
        'https://example.test/clip.mp4',
      );
    });

    it('skips a video block with neither data nor uri', () => {
      const steps = [
        {
          type: 'model_output',
          content: [{ type: 'video', mime_type: 'video/mp4' }],
        },
      ] as Array<GoogleInteractionsStep>;
      const { content } = parseGoogleInteractionsOutputs({
        steps,
        generateId,
      });
      expect(content).toEqual([]);
    });
  });
});
