import 'dotenv/config';
import { APICallError } from 'ai';
import { print } from './print';
import { isRecordableResult, recordFixture } from './record-fixture';

export function run(fn: () => Promise<unknown>) {
  fn()
    .then(result => {
      if (isRecordableResult(result)) {
        return recordFixture(result);
      }
    })
    .catch(error => {
      console.error(error);

      if (APICallError.isInstance(error)) {
        console.log();
        print('Request body:', error.requestBodyValues);
        print('Response body:', error.responseBody);
      }
    });
}
