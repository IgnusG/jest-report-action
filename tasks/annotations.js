import path from 'path';

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
      stacktrace: `Stacktrace:\n${ cleanStackWithRelativePaths(stacktrace).join('\n') }`
    }
  } catch(error) {
    console.error(`Failed to parse - falling back to "stupid" mode - error: ${ error.message }`);

    return { title: 'Test Failed', expectations: 'A fix a day keeps the debugger away...', stacktrace: message };
  }
}

export function createAnnotation({ path: filePath }, testcase, location) {
  const { describe, test, failure: [ message ] } = testcase;

  const { title, expectations, stacktrace } = formatJestMessage(message);

  let annotation = {
    path: filePath,
    title: `${ describe } > ${ test }`,
    start_line: location.start.line,
    end_line: location.end.line,
    annotation_level: 'failure',
    message: `${ title }\n${ expectations }\n\n${ stacktrace }`
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

// Internal Dependencies
export {
  cleanStackWithRelativePaths as $_cleanStackWithRelativePaths,
  formatJestMessage as $_formatJestMessage
};

