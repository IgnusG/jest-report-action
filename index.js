import * as core from '@actions/core';

import { readAndParseXMLFile, createAnnotationsFromTestsuites, publishAnnotationsToRun, parseTestsuite } from './tasks';

const config = {
  accessToken: core.getInput('access-token'),
  junitFile: core.getInput('junit-file'),
  runName: core.getInput('run-name')
}

async function parseTestsAndPublishAnnotations(
  { $config = config } = {}
) {
  const { testsuites: jest } = await readAndParseXMLFile($config.junitFile);

  const testsuites = jest.testsuite.map(parseTestsuite);
  const annotations = await createAnnotationsFromTestsuites(testsuites);

  await publishAnnotationsToRun(annotations, { $config });
}

parseTestsAndPublishAnnotations().catch(error => {
  core.setFailed(`Something went wrong: ${ error }`);
});

