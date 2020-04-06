import * as xmlParser from 'xml2js';

import { promises as fs } from 'fs';

export async function readAndParseXMLFile(file, { $fs = fs, $xmlParser = xmlParser } = {}) {
  const data = await $fs.readFile(file);
  const parser = new $xmlParser.Parser();

  const json = await parser.parseStringPromise(data);

  return json;
}

export function parseTestInformation(testsuiteRoot) {
  const { '$': { tests, failures, time } } = testsuiteRoot;

  return { tests, failures, time };
}

export function parseTestcase(testcase) {
  const { '$': { classname, name, time }, failure } = testcase;

  return {
    describe: classname,
    test: name,
    time,
    failure: failure !== undefined ? failure : false
  }
}

export function parseTestsuite(testsuite) {
  const { '$': { name, errors, failures, skipped, time }, testcase } = testsuite;

  return {
    path: name,
    errors, failures, skipped,
    time,
    testcases: Array.isArray(testcase) ? testcase.map(parseTestcase) : [ parseTestcase(testcase) ]
  }
}

