import * as github from '@actions/github';

async function createCheckWithAnnotations(
  { conclusion, summary, annotations }, 
  { $octokit, $config, $github = github }
) {
  let sha = $github.context.sha;

  // DEV: If we're on a PR, use the sha from the payload to prevent Ghost Check Runs
  if ($github.context.payload.pull_request) {
    sha = $github.context.payload.pull_request.head.sha;
  }

  const checkRequest = {
    ...$github.context.repo,
    head_sha: sha,
    name: $config.checkName,
    conclusion,
    output: {
      title: 'Jest Test Results',
      summary,
      annotations 
    }
  };

  try {
    await $octokit.checks.create(checkRequest);
  } catch (error) {
    throw new Error(`Request to create annotations failed - request: ${ JSON.stringify(checkRequest) } - error: ${ error.message } `);
  }
}

async function updateCheckWithAnnotations(annotations, { $octokit, $github = github }) {
  const updateCheckRequest = {
    ...$github.context.repo,
    head_sha: $github.context.sha,
    output: { annotations }
  };

  try {
    await $octokit.checks.update(updateCheckRequest);
  } catch (error) {
    throw new Error(`Request to update annotations failed - request: ${ JSON.stringify(updateCheckRequest) } - error: ${ error.message } `);
  }
}

export async function publishTestResults(testInformation, { $github = github, $config }) {
  const zeroAnnotations = 0;
  const maximumAnnotations = 50;

  const { details, time, passed, failed, total, conclusion, annotations } = testInformation;

  const octokit = new $github.GitHub($config.accessToken);

  await createCheckWithAnnotations({
    summary:
    '#### These are all the test results I was able to find from your jest-junit reporter\n' +
    `**${ total }** tests were completed in **${ time }s** with **${ passed }** passed ✔ and **${ failed }** failed ✖ tests.` +
    `${ details ? `\n\n${ details }` : '' }`,
    conclusion,
    annotations: annotations.slice(zeroAnnotations, maximumAnnotations)
  }, { $octokit: octokit, $config });

  let batchedAnnotations = annotations.slice(maximumAnnotations);

  while (batchedAnnotations.length > zeroAnnotations) {
    await updateCheckWithAnnotations({
      annotations: batchedAnnotations.slice(zeroAnnotations, maximumAnnotations)
    }, { $octokit: octokit });

    batchedAnnotations = batchedAnnotations.slice(maximumAnnotations);
  }
}

// Internal Dependencies
export {
  createCheckWithAnnotations as $_createCheckWithAnnotations,
  updateCheckWithAnnotations as $_updateCheckWithAnnotations
}

