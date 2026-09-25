import nodeFetch from 'node-fetch';
import NodeFormData from 'form-data';
import fs, { ReadStream } from 'fs';
import path from 'path';

const BUG_SERVER_HOST = 'https://bug-server.zijieapi.com';
const PRODUCT = 'VisActor/VChart';
const CHECK_SCM_BUILD_INTERVAL_MS = 10 * 1000;
const CHECK_SCM_BUILD_MAX_COUNT = 30;
const CHECK_PHOTO_TEST_INTERVAL_MS = 30 * 1000;
const CHECK_PHOTO_TEST_MAX_COUNT = 300;
const API_END_POINT = '/api/ci/trigger';
const API_URL = `${BUG_SERVER_HOST}${API_END_POINT}`;

let checkPhotoTestMaxCount = CHECK_PHOTO_TEST_MAX_COUNT;

interface Data<D> {
  data: D;
  msg: string;
  code: number;
}
interface UploadFileData {
  fileUrl: string;
}
interface GetScmVersionData {
  status: string;
  version: string;
}
interface TriggerScmBuildData {
  scmVersion: string;
}
interface TriggerPhotoTestData {
  bundleId: string;
  scmVersion: string;
  taskAmount: number;
}
interface GetPhotoResultData {
  totalCount: number;
  successCount: number;
  status: 'pending' | 'ok';
}
async function inlineFetch<D>(
  inlineUrl: string,
  inlineMethod: string,
  inlineGetFormData: (isRetry: boolean) => NodeFormData,
  inlineRetryCount: number
): Promise<Data<D>> {
  let data: Data<D> | null = null;

  const url = `${inlineUrl}?retry=${inlineRetryCount}`;
  console.info('[inlineFetch][url]', url);

  const formData = inlineGetFormData(inlineRetryCount > 0);
  const response = await nodeFetch(url, {
    method: inlineMethod,
    headers: formData.getHeaders(),
    body: formData,
    timeout: 1000 * 300
  });

  console.info('[inlineFetch] response.status:', response.status);
  console.info('[inlineFetch] response.statusText:', response.statusText);
  console.info('[inlineFetch] response.headers:', JSON.stringify(response.headers.raw()));

  data = (await response.json()) as Data<D>;

  if (data.code === -1) {
    throw new Error(`Request failed with data: ${JSON.stringify(data)}`);
  }
  return data;
}

async function fetch<D>(
  url: string,
  method: string,
  getFormData: (isRetry: boolean) => NodeFormData,
  maxRetries = 3
): Promise<Data<D>> {
  let retryCount = 0;
  let success = false;

  let data: Data<D> | null = null;

  while (retryCount < maxRetries && !success) {
    console.info('[fetch] retryCount', retryCount);

    try {
      data = await inlineFetch(url, method, getFormData, retryCount);
      success = true;
    } catch (err) {
      const _err = err as Error;
      console.error('[fetch] err:', _err.message);

      retryCount++;

      if (retryCount === maxRetries) {
        throw _err;
      }

      // retry after 1 second while request failed
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  if (data === null) {
    throw new Error(`[fetch] failed: data not exists`);
  }

  return data;
}

const getFormData = (data: Record<string, string | ReadStream>) => {
  const formData = new NodeFormData({ readable: true });

  formData.append('product', PRODUCT);
  formData.append('token', process.env.BUG_SERVER_TOKEN);

  Object.entries(data).forEach(([key, value]) => {
    if (key) {
      formData.append(key, value ?? '');
    }
  });

  return formData;
};

async function uploadFile() {
  const localFilePath = path.resolve(process.cwd(), 'dist/index.js');
  console.info(`[uploadFile] local path: ${localFilePath}`);

  let stream = fs.createReadStream(localFilePath);
  const close = () => {
    stream.close();
    stream.push(null);
    stream.read(0);
  };

  const res = await fetch<UploadFileData>(API_URL, 'POST', isRetry => {
    if (isRetry) {
      close();
      stream = fs.createReadStream(localFilePath);
    }

    return getFormData({
      bundleFile: stream,
      triggerType: 'upload-file'
    });
  });

  return res;
}

async function triggerScmBuild({ fileUrl }: { fileUrl: string }) {
  const params = {
    triggerType: 'scm-build',
    fileUrl: fileUrl,
    createUser: process.env.GITHUB_ACTOR ?? '',
    commitBranchName: process.env.GITHUB_HEAD_REF ?? ''
  };

  const res = await fetch<TriggerScmBuildData>(API_URL, 'POST', () => getFormData(params));
  console.info(`[triggerScmBuild] scmVersion: ${res.data.scmVersion}`);
  return res;
}

async function getScmVersionInfo({ scmVersion }: { scmVersion: string }) {
  const params = {
    triggerType: 'scm-version-info',
    scmVersion
  };

  const res = await fetch<GetScmVersionData>(API_URL, 'POST', () => getFormData(params));

  console.info(`[getScmVersionInfo] result: ${JSON.stringify(res)}`);
  return res;
}

async function waitUntilScmBuildOK({ scmVersion }: { scmVersion: string }): Promise<{ status: string }> {
  let count = 0;

  return await new Promise(resolve => {
    const interval = setInterval(async () => {
      count++;
      const {
        data: { status }
      } = await getScmVersionInfo({ scmVersion });

      // build_ok/build_failed/building/prepare
      if (['build_ok', 'build_failed'].includes(status) || count > CHECK_SCM_BUILD_MAX_COUNT) {
        resolve({ status });
        clearInterval(interval);
      }
    }, CHECK_SCM_BUILD_INTERVAL_MS);
  });
}

async function triggerPhotoTest({ scmVersion, scmVersionStatus }: { scmVersion: string; scmVersionStatus: string }) {
  const params = {
    triggerType: 'photo-test',
    scmVersion: scmVersion,
    scmVersionStatus: scmVersionStatus,
    commitId: process.env.GITHUB_SHA ?? '',
    commitUrl: process.env.GITHUB_REF ?? '',
    commitBranchName: process.env.GITHUB_HEAD_REF ?? '',
    commitCreateUser: process.env.GITHUB_ACTOR ?? '',
    commitDescription: ''
  };

  const res = await fetch<TriggerPhotoTestData>(API_URL, 'POST', () => getFormData(params));
  return res;
}

async function triggerPerformanceTest({
  scmVersion,
  scmVersionStatus
}: {
  scmVersion: string;
  scmVersionStatus: string;
}) {
  const params = {
    triggerType: 'performance-test',
    scmVersion: scmVersion,
    scmVersionStatus: scmVersionStatus,
    commitId: process.env.GITHUB_SHA ?? '',
    commitUrl: process.env.GITHUB_REF ?? '',
    commitBranchName: process.env.GITHUB_HEAD_REF ?? '',
    commitCreateUser: process.env.GITHUB_ACTOR ?? '',
    commitDescription: ''
  };

  const res = await fetch<TriggerPhotoTestData>(API_URL, 'POST', () => getFormData(params));
  return res;
}

async function getPhotoResult({ scmVersion, bundleId }: { scmVersion: string; bundleId: string }) {
  const params = {
    triggerType: 'photo-result',
    scmVersion,
    bundleId
  };

  const res = await fetch<GetPhotoResultData>(API_URL, 'POST', () => getFormData(params));

  console.info(`[getPhotoResult] result: ${JSON.stringify(res)} `);
  return res;
}

async function waitUntilPhotoTestOK({
  bundleId,
  scmVersion
}: {
  bundleId: string;
  scmVersion: string;
}): Promise<GetPhotoResultData> {
  let count = 0;

  return await new Promise(resolve => {
    const interval = setInterval(async () => {
      count++;
      const { data } = await getPhotoResult({ scmVersion, bundleId });
      // pending / ok
      if (['ok'].includes(data.status) || count > checkPhotoTestMaxCount) {
        resolve(data);
        clearInterval(interval);
      }
    }, CHECK_PHOTO_TEST_INTERVAL_MS);
  });
}

async function trigger() {
  const {
    data: { fileUrl }
  } = await uploadFile();

  if (!fileUrl) {
    throw new Error('uploadFile fail');
  }
  console.info('[trigger] uploadFile success');

  const {
    data: { scmVersion }
  } = await triggerScmBuild({ fileUrl });

  const { status: scmVersionStatus } = await waitUntilScmBuildOK({
    scmVersion
  });
  console.info(`[trigger] scmVersionStatus: ${scmVersionStatus}`);

  if (scmVersionStatus !== 'build_ok') {
    throw new Error(`scm build status: ${scmVersionStatus}`);
  }

  const {
    data: { bundleId, taskAmount }
  } = await triggerPhotoTest({ scmVersion, scmVersionStatus });
  console.info(`[trigger] bundleId: ${bundleId}`);
  console.info(`[trigger] taskAmount: ${taskAmount}`);

  if (taskAmount) {
    checkPhotoTestMaxCount = Math.ceil(taskAmount / 10);
  }

  const {
    status: photoTestStatus,
    successCount,
    totalCount
  } = await waitUntilPhotoTestOK({
    bundleId,
    scmVersion
  });
  console.info(
    `[trigger], test result status: ${photoTestStatus}, totalCount: ${totalCount}, successCount: ${successCount}`
  );

  // trigger performance test
  await triggerPerformanceTest({ scmVersion, scmVersionStatus });

  if (photoTestStatus !== 'ok') {
    throw new Error(`photo test status: ${photoTestStatus}`);
  }

  if (successCount !== totalCount) {
    throw new Error(`totalCount: ${totalCount}, successCount: ${successCount}`);
  }
}

trigger();
