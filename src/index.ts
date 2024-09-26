import {Context} from "probot";
import {Octokit} from "@octokit/rest";

const handlePullRequestLabeled = async (context: Context<"pull_request.labeled">) => {
    const label = context.payload.label.name;
    const pullRequestNumber = context.payload.pull_request.number;
    context.log.info(`Label ${label} was added to pull request #${pullRequestNumber}`);

    if (label === "trigger-workflow") {
        const owner = context.payload.repository.owner.login;
        const repo = context.payload.repository.name;
        const workflow_id = "dispatch-workflow.yml";
        const ref = "main"
        // const ref = context.payload.pull_request.head.ref

        const octokit = context.octokit;
        const inputs = {
            name: "Alice",
            runTests: "yes"
        }
        try {
            await octokit.actions.createWorkflowDispatch({owner, repo, workflow_id, ref, inputs});
            context.log.info(`Workflow ${workflow_id} triggered successfully!`);
        } catch (error) {
            context.log.error(`Failed to trigger workflow: ${error}`);
        }
    }
};

const handlePullRequestUnlabeled = async (context: Context<"pull_request.unlabeled">) => {
    const label = context.payload.label.name;
    const pullRequestNumber = context.payload.pull_request.number;
    context.log.info(`Label ${label} was removed from pull request #${pullRequestNumber}`);

    // rollback

};

exports.handler = async (event: any) => {
    const githubEvent = JSON.parse(event.body);
    const context = {
        payload: githubEvent,
        log: console,
        octokit: new Octokit({auth: process.env.GITHUB_TOKEN})
    };

    if (githubEvent.action === "labeled") {
        await handlePullRequestLabeled(context as any as Context<"pull_request.labeled">);
    } else if (githubEvent.action === "unlabeled") {
        await handlePullRequestUnlabeled(context as any as Context<"pull_request.unlabeled">);
    }

    return {statusCode: 200, body: JSON.stringify({message: "Success"})};
};
