import * as core from '@actions/core';

import { readAndParseXMLFile, parseTestInformation, createAnnotationsFromTestsuites, createCheckRunWithAnnotations, parseTestsuite } from './tasks';

const config = {
  accessToken: core.getInput('access-token'),
  junitFile: core.getInput('junit-file'),
  runName: core.getInput('run-name')
}

const zeroTests = 0;

async function parseTestsAndCreateJestCheck(
  { $config = config } = {}
) {
  const { testsuites: jest } = await readAndParseXMLFile($config.junitFile);

  const { time, tests, failures } = parseTestInformation(jest);

  const testsuites = jest.testsuite.map(parseTestsuite);
  const annotations = await createAnnotationsFromTestsuites(testsuites);

  const checkInformation = {
    annotations,
    time,
    passed: tests - failures,
    failed: failures,
    total: tests,
    conclusion: failures > zeroTests ? 'failure' : 'success'
  }

  await createCheckRunWithAnnotations(checkInformation, { $config });
}

parseTestsAndCreateJestCheck().catch(error => {
  core.setFailed(`Something went wrong: ${ error }`);
});

