export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const containerId = searchParams.get('container_id');
  const fileId = searchParams.get('file_id');
  const filename = searchParams.get('filename') || 'file';

  if (!containerId || !fileId) {
    return new Response('Missing container_id or file_id', { status: 400 });
  }

  const resourceName = process.env.AZURE_RESOURCE_NAME;
  if (!resourceName) {
    return new Response('AZURE_RESOURCE_NAME not configured', { status: 500 });
  }

  const apiKey = process.env.AZURE_API_KEY;
  if (!apiKey) {
    return new Response('AZURE_API_KEY not configured', { status: 500 });
  }

  try {
    const response = await fetch(
      `https://${resourceName}.openai.azure.com/openai/v1/containers/${containerId}/files/${fileId}/content`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      },
    );

    if (!response.ok) {
      return new Response(`Failed to fetch file: ${response.statusText}`, {
        status: response.status,
      });
    }

    const arrayBuffer = await response.arrayBuffer();
    const contentType =
      response.headers.get('content-type') || 'application/octet-stream';

    return new Response(arrayBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error downloading file:', error);
    return new Response('Error downloading file', { status: 500 });
  }
}
