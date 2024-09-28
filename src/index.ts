import {Context} from "probot";
import {Octokit} from "@octokit/rest";
import {createAppAuth} from "@octokit/auth-app";
import ProcessEnv = NodeJS.ProcessEnv;

const handlePullRequestLabeled = async (context: Context<"pull_request.labeled">) => {
    const label = context.payload.label.name;
    const pullRequestNumber = context.payload.pull_request.number;
    context.log.info(`Label ${label} was added to pull request #${pullRequestNumber}`);

    if (label === "trigger-workflow") {
        const owner = context.payload.repository.owner.login;
        const repo = context.payload.repository.name;
        const workflow_id = "test1.yml";
        // const ref = "main"
        const ref = context.payload.pull_request.head.ref

        const octokit = context.octokit;
        const inputs = {
            name: "Alice",
            runTests: "yes"
        }
        try {
            await octokit.actions.createWorkflowDispatch({owner, repo, workflow_id, ref});
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

export const handler = async (event: any) => {
    const processEnv = process.env as ProcessEnv
    const privateKey = processEnv.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, '\n');
    const appId = processEnv.GITHUB_APP_ID;
    const githubToken = processEnv.GITHUB_TOKEN;

    console.log("event.body: " + event.body)
    const githubEvent = JSON.parse(event.body);
    const installationId =     githubEvent.installation.id

    const auth = createAppAuth({
        appId,
        privateKey,
        installationId
    });

    const appAuthentication = await auth({ type: "installation" });

    const context = {
        payload: githubEvent,
        log: console,
        octokit: new Octokit({auth: appAuthentication.token})
        // octokit: new Octokit({auth: githubToken}) // これで動いたは動いた
    };

    if (githubEvent.action === "labeled") {
        await handlePullRequestLabeled(context as any as Context<"pull_request.labeled">);
    } else if (githubEvent.action === "unlabeled") {
        await handlePullRequestUnlabeled(context as any as Context<"pull_request.unlabeled">);
    }

    return {statusCode: 200, body: JSON.stringify({message: "Success"})};
};
