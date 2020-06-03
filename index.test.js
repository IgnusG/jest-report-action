import { readAndParseXMLFile, parseTestsuite, createAnnotationsFromTestsuites } from './tasks';

async function testIntegration() {
  const { testsuites: jest } = await readAndParseXMLFile('junit.xml');
  const testsuites = jest.testsuite.map(parseTestsuite({ $config: { workingDir: './extension/' } }));

  const annotations = await createAnnotationsFromTestsuites(testsuites);

  console.log(annotations);
}

testIntegration().catch(error => console.error(error));

