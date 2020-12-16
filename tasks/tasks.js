/* eslint max-lines-per-function: 0 */

import { promises as fs } from 'fs';

import { findTestIn, parseJs } from './js-parser';
import { createAnnotation } from './annotations';

export async function createAnnotationsFromTestsuites(testsuites) {
  let annotations = [];
  let unknownFailures = [];

  for (let testsuite of testsuites) {
    let file = null;
    let extension = null;

    try {
      file = await fs.readFile(testsuite.path, { encoding: 'utf-8' });

      const { groups: { extension: extensionResult } } = (/.*\.(?<extension>.*)$/).exec(testsuite.path);

      extension = extensionResult;
    } catch(error) {
      console.error('Unknown error occured while reading the file.', error);

      unknownFailures = [
        ...unknownFailures,
        ...testsuite.testcases.map(({ describe, test }) => `${ describe } > ${ test }`)
      ];

      continue;
    }

    let testAst = null;

    try {
      testAst = parseJs(file, extension);
    } catch(error) {
      console.error(`I probably don't understand the file extension .${ extension } yet. Or a different error occured for file ${ testsuite.path }.\n\n`, error);

      unknownFailures = [
        ...unknownFailures,
        ...testsuite.testcases.map(({ describe, test }) => `${ describe } > ${ test }`)
      ];

      continue;
    }

    for (let testcase of testsuite.testcases) {
      if (!testcase.failure) continue;

      const location = findTestIn(testAst)(testcase.describe, testcase.test)

      if (location === false) {
        console.error('The following testcase ', testcase.describe, ' > ', testcase.test, ' was not found');
        unknownFailures = [ ...unknownFailures, `${ testcase.describe } > ${ testcase.test }` ];
      } else {
        annotations = [ ...annotations, createAnnotation(testsuite, testcase, location) ];
      }
    }
  }

  return { annotations, unknownFailures };
}

