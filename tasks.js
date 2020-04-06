import * as github from '@actions/github';

import * as xmlParser from 'xml2js';

import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';

import escapeStringRegexp from 'escape-string-regexp';

import { promises as fs } from 'fs';
import path from 'path';


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

function cleanStackWithRelativePaths(stacktrace) {
  const filters = [
    line => {
      // Remove jasmin stacks
      if (line.includes('node_modules/jest-jasmin')) return false;
      // Remove process queue stacks
      if (line.includes('internal/process/task_queues')) return false;
      // Remove empty promises
      // eslint-disable-next-line no-useless-escape
      if (line.trimStart() === 'at new Promise (\<anonymous\>)') return false;

      return line;
    },
    line => {
      const { groups: { file } } = (/.*\((?<file>.*)\).?/).exec(line) || { groups: { file: false } };

      return file 
        ? line.replace(file, path.relative(process.cwd(), file)) 
        : line;
    }
  ];

  const applyFilters = line => filters.reduce((result, filter) => filter(result), line);
  const isNotEmpty = line => line !== false;


  return stacktrace
    .map(applyFilters)
    .filter(isNotEmpty);
}

function formatJestMessage(message) {
  const messageLines = message.split('\n');

  // Skip first line (title) and one blank line
  const expectationStart = 2; 
  const filterStacktrace = line => line.trimStart().startsWith('at ');

  try {
    const [ title ] = messageLines;

    const expectations = messageLines
      .slice(expectationStart)
      .filter(line => !filterStacktrace(line))
      .join('\n');

    const stacktrace = messageLines.filter(filterStacktrace);

    return {
      title,
      expectations,
      stacktrace: cleanStackWithRelativePaths(stacktrace).join('\n')
    }
  } catch(error) {
    console.error(`Failed to parse - falling back to "stupid" mode - error: ${ error.message }`);

    return message;
  }
}

export function createAnnotation({ path: filePath }, testcase, location) {
  const { failure: [ message ] } = testcase;

  const { title, expectations, stacktrace } = formatJestMessage(message);

  let annotation = {
    path: filePath,
    title,
    start_line: location.start.line,
    end_line: location.end.line,
    annotation_level: 'failure',
    message: expectations,
    rawValue: stacktrace
  };

  if (location.start.line === location.end.line) {
    annotation = {
      ...annotation,
      start_column: location.start.column,
      end_column: location.end.column
    };
  }

  return annotation;
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

export async function createCheckRunWithAnnotations(checkInformation, { $github = github, $config }) {
  const { time, passed, failed, total, annotations } = checkInformation;

  const octokit = new $github.GitHub($config.accessToken);

  const checkRequest = {
    ...$github.context.repo,
    name: 'Jest Test',
    head_sha: $github.context.sha,
    output: {
      title: 'Jest Test Results',
      summary: `
## These are all the test results I was able to find from your jest-junit reporter
**${ total }** tests were completed in **${ time }s** with **${ passed }** passed ✔ and **${ failed }** failed ✖ tests.
`,
      annotations
    }
  };

  try {
    await octokit.checks.create(checkRequest);
  } catch (error) {
    throw new Error(`Request to create annotations failed - request: ${ JSON.stringify(checkRequest) } - error: ${ error.message } `);
  }
}
