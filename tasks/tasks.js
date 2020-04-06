import { parse } from '@babel/parser';
import { promises as fs } from 'fs';

import { findTestIn } from './js-parser';
import { createAnnotation } from './annotations';

export async function createAnnotationsFromTestsuites(testsuites) {
  let annotations = [];

  for (let testsuite of testsuites) {
    const file = await fs.readFile(testsuite.path, { encoding: 'utf-8' });
    const testAst = parse(file, { sourceType: 'module' });

    for (let testcase of testsuite.testcases) {
      if (!testcase.failure) continue;

      const location = findTestIn(testAst)(testcase.describe, testcase.test)

      if (location === false) {
        console.error('The following testcase ', testcase.describe, ' > ', testcase.test, ' was not found');
        continue;
      } 

      annotations = [ ...annotations, createAnnotation(testsuite, testcase, location) ];
    }
  }

  return annotations;
}

