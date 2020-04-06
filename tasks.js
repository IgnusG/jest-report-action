import * as github from '@actions/github';

import * as xmlParser from 'xml2js';

import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';

import escapeStringRegexp from 'escape-string-regexp';

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

export function isLiteralNamed(literalNode, names, { $t = t } = {}) {
  const isIdentifier = (node) => Array.isArray(names) 
    ? names.some(name => $t.isIdentifier(node, { name })) 
    : $t.isIdentifier(node, { name: names });

  // Simple describe("") or test("")
  if (isIdentifier(literalNode)) return true;
  if ($t.isCallExpression(literalNode)) {
    let node = literalNode.callee;

    if (!$t.isMemberExpression(node)) return false;
    // Advanced describe.each([])("") or test.each([])("")
    if (!$t.isMemberExpression(node)) return isLiteralNamed(node.object, names);

    // Very advanced describe.skip.each([])("") or test.only.each([])("")
    return isLiteralNamed(node.object.object, names);
  }

  return false;
}

export function isNameEquivalent(node, expected) {
  const rawValue = node.value;
  // Wildcard all special formatting values of Jest
  const regex = new RegExp(
    escapeStringRegexp(rawValue).replace(/%[psdifjo#]/g, '.*')
  );

  return regex.test(expected);
}

export function findTestIn(ast, { $traverse = traverse } = {}) {
  return function findTest(expectedDescribeTitle, expectedTestTitle) {
    let resolved = false;

    $traverse(ast, {
      CallExpression(parentPath) {
        const { node: { callee: describe, arguments: [ describeTitle ] } } = parentPath;

        parentPath.stop();

        if (!isLiteralNamed(describe, 'describe')) return;
        if (!isNameEquivalent(describeTitle, expectedDescribeTitle)) return;

        parentPath.traverse({
          CallExpression(childPath) {
            const { node: { callee: test, loc: location, arguments: [ testTitle ] } } = childPath;

            if(!isLiteralNamed(test, ['test', 'it'])) return;
            if(!isNameEquivalent(testTitle, expectedTestTitle)) return;

            childPath.stop();

            resolved = location;
          }
        });
      }
    });

    return resolved;
  }
}

export function createAnnotation({ path }, testcase, location) {
  return {
    path,
    start_line: location.start.line,
    end_line: location.end.line,
    start_column: location.start.line,
    end_column: location.end.line,
    annotation_level: 'failure',
    message: testcase.failure
  }
}

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

export async function publishAnnotationsToRun(annotations, { $github = github, $config }) {
  const octokit = new $github.GitHub($config.accessToken);
  const runIdRequest = { ...$github.context.repo, ref: $github.context.sha };
  const runIdResult = await octokit.checks.listForRef(runIdRequest);

  const [ { id: runId } ] = runIdResult.data.check_runs
    .filter(({ name }) => name === $config.runName);

  const annotationRequest = {
    ...$github.context.repo,
    check_run_id: runId,
    output: {
      title: 'Jest Test Results',
      summary: 'These are all the test results I was able to find from your jest-junit reporter',
      annotations
    }
  };

  await octokit.check.update(annotationRequest);
}
