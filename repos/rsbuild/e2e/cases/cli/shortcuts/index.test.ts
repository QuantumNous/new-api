import { test } from '@e2e/helper';

test('should display shortcuts as expected in dev', async ({ exec, logHelper }) => {
  const { childProcess } = exec('node ./dev.js');
  const { expectLog, clearLogs } = logHelper;

  // help
  await expectLog('press h + enter to show shortcuts');
  childProcess.stdin?.write('h\n');
  await expectLog('u + enter  show urls');

  // print urls
  clearLogs();
  childProcess.stdin?.write('u\n');
  await expectLog('➜  Local:    http://localhost:');

  // restart server
  clearLogs();
  childProcess.stdin?.write('r\n');
  await expectLog('restarting server');
  await expectLog('➜  Local:    http://localhost:');
});

test('should display shortcuts as expected in preview', async ({ exec, logHelper }) => {
  const { childProcess } = exec('node ./preview.js');
  const { expectLog, clearLogs } = logHelper;

  // help
  await expectLog('press h + enter to show shortcuts');
  childProcess.stdin?.write('h\n');
  await expectLog('u + enter  show urls');

  // print urls
  clearLogs();
  childProcess.stdin?.write('u\n');
  await expectLog('➜  Local:    http://localhost:');
});

test('should show all collapsed urls through shortcuts in dev', async ({ exec, logHelper }) => {
  const { childProcess } = exec('node ./devMany.js');
  const { expectLog, expectNoLog, clearLogs } = logHelper;

  await expectLog('... 2 more entries, press u + enter to show all');

  clearLogs();
  childProcess.stdin?.write('u\n');
  await expectLog('route11    http://localhost:');
  expectNoLog('more entries, press u + enter to show all');
});

test('should limit urls without shortcut help when shortcuts are disabled', async ({
  exec,
  logHelper,
}) => {
  exec('node ./devManyNoShortcuts.js');
  const { expectLog, expectNoLog } = logHelper;

  await expectLog('... 2 more entries, set server.printUrls.maxRoutes to show more');
  expectNoLog('press h + enter to show shortcuts');
  expectNoLog('press u + enter to show all');
});

test('should support custom shortcuts in dev', async ({ exec, logHelper }) => {
  const { childProcess } = exec('node ./devCustom.js');
  const { expectLog, clearLogs } = logHelper;

  await expectLog('press h + enter to show shortcuts');

  clearLogs();
  childProcess.stdin?.write('s\n');
  await expectLog('hello world!');
});

test('should support custom shortcuts in preview', async ({ exec, logHelper }) => {
  const { childProcess } = exec('node ./previewCustom.js');
  const { expectLog, clearLogs } = logHelper;

  // help
  await expectLog('press h + enter to show shortcuts');

  clearLogs();
  childProcess.stdin?.write('s\n');
  await expectLog('hello world!');
});
