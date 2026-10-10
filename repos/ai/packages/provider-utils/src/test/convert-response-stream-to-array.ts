import { convertReadableStreamToArray } from './convert-readable-stream-to-array';

export async function convertResponseStreamToArray(
  response: Response,
): Promise<string[]> {
  return await convertReadableStreamToArray(
    response.body!.pipeThrough(new TextDecoderStream()),
  );
}
