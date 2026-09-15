import { createGoogle } from '@ai-sdk/google';
import { generateText, isStepCount, tool } from 'ai';
import { z } from 'zod';

const pdfBase64 =
  'JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCAyMDAgMjAwXSAvUmVzb3VyY2VzIDw8IC9Gb250IDw8IC9GMSA1IDAgUiA+PiA+PiAvQ29udGVudHMgNCAwIFIgPj4KZW5kb2JqCjQgMCBvYmoKPDwgL0xlbmd0aCA0MyA+PgpzdHJlYW0KQlQgL0YxIDEyIFRmIDcyIDEyMCBUZCAoSXNzdWUgMTYwNzIpIFRqIEVUCgplbmRzdHJlYW0KZW5kb2JqCjUgMCBvYmoKPDwgL1R5cGUgL0ZvbnQgL1N1YnR5cGUgL1R5cGUxIC9CYXNlRm9udCAvSGVsdmV0aWNhID4+CmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA1OCAwMDAwMCBuIAowMDAwMDAwMTE1IDAwMDAwIG4gCjAwMDAwMDAyNDEgMDAwMDAgbiAKMDAwMDAwMDMzNCAwMDAwMCBuIAp0cmFpbGVyCjw8IC9Sb290IDEgMCBSIC9TaXplIDYgPj4Kc3RhcnR4cmVmCjQwNAolJUVPRgo=';

async function main() {
  const calls: Array<{ url: string; requestBody: any; responseBody?: any }> =
    [];
  const google = createGoogle({
    fetch: async (input, init) => {
      const call: { url: string; requestBody: any; responseBody?: any } = {
        url: String(input),
        requestBody:
          typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
      };
      calls.push(call);

      const response = await fetch(input, init);
      call.responseBody = await response
        .clone()
        .json()
        .catch(() => undefined);

      return response;
    },
  });

  await generateText({
    model: google('gemini-2.5-flash-lite'),
    maxOutputTokens: 64,
    prompt:
      'Call the catalogSearch tool, then answer briefly based on the tool result.',
    tools: {
      catalogSearch: tool({
        description: 'Return catalog PDF metadata and document data.',
        inputSchema: z.object({}),
        execute: async () => ({ ok: true }),
        toModelOutput: () => ({
          type: 'content',
          value: [
            { type: 'text', text: 'metadata' },
            {
              type: 'file-data',
              data: pdfBase64,
              mediaType: 'application/pdf',
            } as any,
          ],
        }),
      }),
    },
    toolChoice: { type: 'tool', toolName: 'catalogSearch' },
    stopWhen: isStepCount(2),
  });

  const secondRequest = calls[1]?.requestBody;
  const secondResponse = calls[1]?.responseBody;
  const toolResultParts =
    secondRequest?.contents?.find(
      (content: any) =>
        content.role === 'user' &&
        content.parts?.some((part: any) => part.functionResponse != null),
    )?.parts ?? [];
  const pdfTextPart = toolResultParts.find(
    (part: any) =>
      typeof part.text === 'string' && part.text.includes(pdfBase64),
  );
  const pdfInlineDataPart = toolResultParts.find(
    (part: any) =>
      part.inlineData?.mimeType === 'application/pdf' &&
      part.inlineData?.data === pdfBase64,
  );
  const hasDocumentTokens =
    secondResponse?.usageMetadata?.promptTokensDetails?.some(
      (detail: any) => detail.modality === 'DOCUMENT',
    ) === true;

  const output = {
    requestCount: calls.length,
    observedToolResultParts: toolResultParts,
    promptTokensDetails:
      secondResponse?.usageMetadata?.promptTokensDetails ?? [],
    hasPdfTextPart: pdfTextPart != null,
    hasPdfInlineDataPart: pdfInlineDataPart != null,
    hasDocumentTokens,
  };

  console.log(JSON.stringify(output, null, 2));

  if (pdfTextPart != null) {
    throw new Error(
      'Reproduced issue #16072: PDF file tool result was serialized as a JSON text part instead of file/document data.',
    );
  }

  if (pdfInlineDataPart == null) {
    throw new Error(
      'Expected the PDF tool result to be sent as an inlineData part.',
    );
  }

  if (!hasDocumentTokens) {
    throw new Error(
      'Expected the live Google response to report document tokens for the PDF tool result.',
    );
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
