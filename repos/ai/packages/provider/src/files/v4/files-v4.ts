import type { FilesV4UploadFileCallOptions } from './files-v4-upload-file-call-options';
import type { FilesV4UploadFileResult } from './files-v4-upload-file-result';

/**
 * Specification for a file management interface that implements the files interface version 4.
 */
export type FilesV4 = {
  /**
   * The files interface must specify which files interface version it implements.
   */
  readonly specificationVersion: 'v4';

  /**
   * Provider ID.
   */
  readonly provider: string;

  /**
   * Uploads a file to the provider and returns a provider reference
   * that can be used in subsequent API calls.
   */
  uploadFile(
    options: FilesV4UploadFileCallOptions,
  ): PromiseLike<FilesV4UploadFileResult>;
};
