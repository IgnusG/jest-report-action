/* eslint no-magic-numbers: 0 */

import * as core from '@actions/core';

import {
  readAndParseXMLFile,
  parseTestInformation,
  parseTestsuite,
  createAnnotationsFromTestsuites,
  publishTestResults
} from './tasks';

function parseWorkingDir(dir) {
  if ((/\/$/).test(dir)) return dir;

  return `${ dir }/`;
}

const config = {
  accessToken: core.getInput('access-token'),
  junitFile: core.getInput('junit-file'),
  runName: core.getInput('run-name'),
  checkName: core.getInput('check-name'),
  workingDir: parseWorkingDir(core.getInput('working-directory'))
}

async function parseTestsAndPublishResults(
  { $config = config } = {}
) {
  const { testsuites: jest } = await readAndParseXMLFile(`${ $config.workingDir }${ $config.junitFile }`);

  const { time, tests, failures } = parseTestInformation(jest);

  const testsuites = jest.testsuite.map(parseTestsuite({ $config }));
  const { annotations, unknownFailures } = await createAnnotationsFromTestsuites(testsuites);

  let testInformation = {
    annotations,
    time,
    passed: tests - failures,
    failed: failures,
    total: tests,
    conclusion: failures > 0 ? 'failure' : 'success'
  }

  if (unknownFailures.length > 0) {
    testInformation = {
      ...testInformation,
      details: `Following tests failed, but could not be found in the source files:\n${ unknownFailures.map(fail => `- ${ fail }`).join('\n') }`
    };
  }

  await publishTestResults(testInformation, { $config });
}

parseTestsAndPublishResults().catch(error => {
  core.setFailed(`Something went wrong: ${ error }`);
});

