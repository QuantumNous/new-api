---
title: Generate Object with File Prompt through Form Submission
description: Learn how to generate object with file prompt through form submission using the AI SDK and Next.js
tags: ['next', 'multi-modal']
---

# Generate Object with File Prompt through Form Submission

<Note>
  This feature is limited to models/providers that support PDF inputs
  ([Anthropic](/providers/ai-sdk-providers/anthropic#pdf-support),
  [OpenAI](/providers/ai-sdk-providers/openai#pdf-support), [Google
  Gemini](/providers/ai-sdk-providers/google#file-inputs), and [Google
  Vertex](/providers/ai-sdk-providers/google-vertex#file-inputs)).
</Note>

With select models, you can send PDFs (files) as part of your prompt. Let's create a simple Next.js application that allows a user to upload a PDF send it to an LLM for summarization.

## Client

On the frontend, create a form that allows the user to upload a PDF. When the form is submitted, send the PDF to the `/api/analyze` route.

```tsx file="app/page.tsx"
'use client';

import { useState } from 'react';

export default function Page() {
  const [description, setDescription] = useState<string>();
  const [loading, setLoading] = useState(false);

  return (
    <div>
      <form
        action={async formData => {
          try {
            setLoading(true);
            const response = await fetch('/api/analyze', {
              method: 'POST',
              body: formData,
            });
            setLoading(false);

            if (response.ok) {
              setDescription(await response.text());
            }
          } catch (error) {
            console.error('Analysis failed:', error);
          }
        }}
      >
        <div>
          <label>Upload Image</label>
          <input name="pdf" type="file" accept="application/pdf" />
        </div>
        <button type="submit" disabled={loading}>
          Submit{loading && 'ing...'}
        </button>
      </form>
      {description && (
        <pre>{JSON.stringify(JSON.parse(description), null, 2)}</pre>
      )}
    </div>
  );
}
```

## Server

On the server, create an API route that receives the PDF, sends it to the LLM, and returns the result. This example uses the [ `generateText` ](/docs/reference/ai-sdk-core/generate-text) function with `Output.object` to generate the summary as part of a structured output.

```typescript file="app/api/analyze/route.ts"
import { generateText, Output } from 'ai';
import { z } from 'zod';

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get('pdf') as File;

  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  const charArray = Array.from(uint8Array, byte => String.fromCharCode(byte));
  const binaryString = charArray.join('');
  const base64Data = btoa(binaryString);
  const fileDataUrl = `data:application/pdf;base64,${base64Data}`;

  const result = await generateText({
    model: 'openai/gpt-4o',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Analyze the following PDF and generate a summary.',
          },
          {
            type: 'file',
            data: fileDataUrl,
            mediaType: 'application/pdf',
          },
        ],
      },
    ],
    output: Output.object({
      schema: z.object({
        people: z
          .object({
            name: z.string().describe('The name of the person.'),
            age: z.number().min(0).describe('The age of the person.'),
          })
          .array()
          .describe('An array of people.'),
      }),
    }),
  });

  return Response.json(result.output);
}
```
