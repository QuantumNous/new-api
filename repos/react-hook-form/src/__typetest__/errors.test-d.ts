import type { FieldError, FieldErrors, GlobalError, Merge } from '../types';

import type { Equal, Expect } from './__fixtures__';
import { _ } from './__fixtures__';

/** {@link FieldErrors} */ {
  /** it should support optional record fields */
  {
    const actual = _ as FieldErrors<{
      test?: string;
      test1?: string;
      attachment: {
        data: string;
        data1: string;
      };
    }>;
    type _t = Expect<
      Equal<
        typeof actual,
        {
          test?: FieldError;
          test1?: FieldError;
          attachment?: Merge<
            FieldError,
            {
              data?: FieldError;
              data1?: FieldError;
            }
          >;
        } & {
          root?: Record<string, GlobalError> & GlobalError;
          form?: GlobalError;
        }
      >
    >;
  }

  /** it should support nullable record fields */
  {
    const actual = _ as FieldErrors<{
      test?: string;
      test1?: string | null;
      attachment: {
        data: string;
        data1: string;
      } | null;
    }>;
    type _t = Expect<
      Equal<
        typeof actual,
        {
          test?: FieldError;
          test1?: FieldError;
          attachment?: Merge<
            FieldError,
            {
              data?: FieldError;
              data1?: FieldError;
            }
          >;
        } & {
          root?: Record<string, GlobalError> & GlobalError;
          form?: GlobalError;
        }
      >
    >;
  }

  /** it should not treat Date, File, FileList or Blob as record fields */
  {
    const actual = _ as FieldErrors<{
      date: Date;
      file: File;
      fileList: FileList;
      record: {
        date: Date;
        file: File;
        fileList: FileList;
      };
    }>;
    const recordDate = actual.record?.date;
    const recordFile = actual.record?.file;
    const recordFileList = actual.record?.fileList;
    type _t1 = Expect<Equal<typeof actual.date, FieldError | undefined>>;
    type _t2 = Expect<Equal<typeof actual.file, FieldError | undefined>>;
    type _t3 = Expect<Equal<typeof actual.fileList, FieldError | undefined>>;
    type _t4 = Expect<Equal<typeof recordDate, FieldError | undefined>>;
    type _t5 = Expect<Equal<typeof recordFile, FieldError | undefined>>;
    type _t6 = Expect<Equal<typeof recordFileList, FieldError | undefined>>;
  }

  /** it should handle field name conflicts with FieldError properties correctly */
  {
    const actual = _ as FieldErrors<{
      frequencyInput: {
        type: 'monthly' | 'yearly';
      };
    }>;

    const fiType = actual.frequencyInput?.type;
    const fiTypeMessage = actual.frequencyInput?.type?.message;
    type _t1 = Expect<Equal<typeof fiType, FieldError | undefined>>;
    type _t2 = Expect<Equal<typeof fiTypeMessage, string | undefined>>;
  }
}
