import traverse from '@babel/traverse';
import * as t from '@babel/types';

import escapeStringRegexp from 'escape-string-regexp';

function isLiteralNamed(literalNode, names, { $t = t } = {}) {
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

function isNameEquivalent(node, expected) {
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

// Internal Dependencies
export {
  isLiteralNamed as $_isLiteralNamed,
  isNameEquivalent as $_isNameEquivalent
};

