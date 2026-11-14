import 'dotenv/config';

const dynamic = 'force-dynamic';

const execute = async (
  _req: Request,
  {
    params,
  }: {
    params: Promise<{
      file: string;
    }>;
  },
) => {
  const { file } = await params;

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set');
  }

  const infoUrl = `https://api.anthropic.com/v1/files/${file}`;
  const infoPromise = fetch(infoUrl, {
    method: 'GET',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'files-api-2025-04-14',
    },
  });

  const downloadUrl = `https://api.anthropic.com/v1/files/${file}/content`;
  const downloadPromise = fetch(downloadUrl, {
    method: 'GET',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'files-api-2025-04-14',
    },
  });

  const [infoResponse, downloadResponse] = await Promise.all([
    infoPromise,
    downloadPromise,
  ]);

  if (!infoResponse.ok) {
    throw new Error(
      `HTTP Error: ${infoResponse.status} ${infoResponse.statusText}`,
    );
  }

  if (!downloadResponse.ok) {
    throw new Error(
      `HTTP Error: ${downloadResponse.status} ${downloadResponse.statusText}`,
    );
  }

  // https://github.com/anthropics/anthropic-sdk-typescript/blob/main/src/resources/beta/files.ts
  const {
    filename,
    size_bytes,
  }: {
    type: 'file';
    id: string;
    size_bytes: number;
    created_at: Date;
    filename: string;
    mime_type: string;
    downloadable?: boolean;
  } = await infoResponse.json();

  // get as binary data
  const arrayBuffer = await downloadResponse.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  return new Response(buffer, {
    status: 200,
    headers: {
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Content-Type': 'application/octet-stream',
      'Content-Length': size_bytes.toString(),
      'X-File-Name': encodeURIComponent(filename),
    },
  });
};

export { dynamic, execute as GET, execute as POST };
