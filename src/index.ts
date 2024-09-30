import {Context} from "probot";
import {Octokit} from "@octokit/rest";
import {createAppAuth} from "@octokit/auth-app";
import type {ProbotOctokit} from "probot/lib/octokit/probot-octokit";
import ProcessEnv = NodeJS.ProcessEnv;
import LabelControllerItem = NodeJS.LabelControllerItem;

async function executeWorkflowsWhenAddLabel(
    {context, label, octokit, owner, pullRequestNumber, ref, repo, workflow_id}: {
        octokit: ProbotOctokit,
        owner: string,
        repo: string,
        label: string,
        pullRequestNumber: number,
        context: Context<"pull_request.labeled">,
        workflow_id: string,
        ref: string,
    }
) {
    // ラベルが付与されているプルリクエストの一覧を取得
    const response = await octokit.pulls.list({
        owner,
        repo,
        state: "open",
    });
    // ラベルが付与されているPRのみフィルタリング
    const labeledPRs = response.data.filter(pr =>
        pr.labels.some(l => l.name === label) && pr.number !== pullRequestNumber
    );
    context.log.info("labeledPRs: " + labeledPRs.map(x => x.number));
    for (const labeledPR of labeledPRs) {
        // プルリクエストからラベルを削除(ラベルを剥がすことで自分自身を間接的に呼ぶ)
        await octokit.issues.removeLabel({
            owner,
            repo,
            issue_number: labeledPR.number,  // PR番号はIssue番号として扱う
            name: label,         // 剥がすラベル名
        });
    }

    try {
        await octokit.actions.createWorkflowDispatch({owner, repo, workflow_id, ref});
        context.log.info(`Workflow ${workflow_id} triggered successfully!`);
    } catch (error) {
        context.log.error(`Failed to trigger workflow: ${error}`);
    }
}

const handlePullRequestLabeled = async (context: Context<"pull_request.labeled">) => {
    const label = context.payload.label.name;
    const pullRequestNumber = context.payload.pull_request.number;
    context.log.info(`Label ${label} was added to pull request #${pullRequestNumber}`);

    const owner = context.payload.repository.owner.login;
    const repo = context.payload.repository.name;
    const ref = context.payload.pull_request.head.ref

    const octokit = context.octokit;
    const configs = await getLabelControllerConfigs(context)
    const item = configs.find(x => x.label === label);
    if (!item) return

    context.log.info(`Match the Label ${label}`);
    const workflow_id = item.ifAddWorkflowId;
    if (item.label === label) {
        await executeWorkflowsWhenAddLabel({
            octokit,
            owner,
            repo,
            label,
            pullRequestNumber,
            context,
            workflow_id,
            ref,
        });
    }
};

const handlePullRequestSynchronize = async (context: Context<"pull_request.synchronize">) => {
    const owner = context.payload.repository.owner.login;
    const repo = context.payload.repository.name;
    const ref = context.payload.pull_request.head.ref
    const octokit = context.octokit;
    const labels = context.payload.pull_request.labels.map(x => x.name);

    const configs = await getLabelControllerConfigs(context)
    for (const config of configs) {
        const matchedLabel = labels.find(x => x === config.label)
        if (!!matchedLabel) {
            await octokit.actions.createWorkflowDispatch({owner, repo, workflow_id: config.ifAddWorkflowId, ref});
        }
    }
};


const handlePullRequestUnlabeled = async (context: Context<"pull_request.unlabeled">) => {
    const label = context.payload.label.name;
    const pullRequestNumber = context.payload.pull_request.number;
    context.log.info(`Label ${label} was removed from pull request #${pullRequestNumber}`);
    // マージによるクローズであれば、処理対象外
    if (context.payload.pull_request.state === "closed" && !!context.payload.pull_request.merged_at) {
        return
    }

    const owner = context.payload.repository.owner.login;
    const repo = context.payload.repository.name;
    const ref = context.payload.pull_request.head.ref
    const octokit = context.octokit;

    const configs = await getLabelControllerConfigs(context)
    const config = configs.find(x => x.label === label);
    if (!config) return

    console.log("execute ifRemoveLabel:" + label + "ref" + ref);
    await octokit.actions.createWorkflowDispatch({owner, repo, workflow_id: config.ifRemoveWorkflowId, ref});
};

const handlePullRequestClosed = async (context: Context<"pull_request.closed">) => {
    const pullRequestNumber = context.payload.pull_request.number;

    const owner = context.payload.repository.owner.login;
    const repo = context.payload.repository.name;
    const octokit = context.octokit;
    const labels = context.payload.pull_request.labels.map(x => x.name);

    const configs = await getLabelControllerConfigs(context)
    for (const config of configs) {
        const matchedLabel = labels.find(x => x === config.label)
        if (!!matchedLabel) {
            // プルリクエストからラベルを削除
            await octokit.issues.removeLabel({
                owner,
                repo,
                issue_number: pullRequestNumber,  // PR番号はIssue番号として扱う
                name: config.label,         // 剥がすラベル名
            });
        }
    }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getLabelControllerConfigs = async (context: Context<any>) => {
    const owner = context.payload.repository.owner.login;
    const repo = context.payload.repository.name;
    const octokit = context.octokit;
    // ファイルの内容を取得
    const response = await octokit.repos.getContent({
        owner,
        repo,
        path: ".github/label-controller.json",
    });

    if ("content" in response.data) {
        const fileContentBase64 = response.data.content;
        const fileContent = atob(fileContentBase64);  // Base64をデコード

        return JSON.parse(fileContent) as LabelControllerItem[]
    } else {
        throw Error("ファイルが見つかりませんでした。")
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const handler = async (event: any) => {
    const processEnv = process.env as ProcessEnv
    const privateKey = processEnv.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, '\n');
    const appId = processEnv.GITHUB_APP_ID;

    const githubEvent = JSON.parse(event.body);
    const installationId = githubEvent.installation.id

    const auth = createAppAuth({
        appId,
        privateKey,
        installationId
    });
    const appAuthentication = await auth({type: "installation"});
    const context = {
        payload: githubEvent,
        log: console,
        octokit: new Octokit({auth: appAuthentication.token})
    };

    if (githubEvent.action === "labeled") {
        await handlePullRequestLabeled(context as never as Context<"pull_request.labeled">);
    } else if (githubEvent.action === "unlabeled") {
        await handlePullRequestUnlabeled(context as never as Context<"pull_request.unlabeled">);
    } else if (githubEvent.action === "closed") {
        await handlePullRequestClosed(context as never as Context<"pull_request.unlabeled">);
    } else if (githubEvent.action === "synchronize") {
        await handlePullRequestSynchronize(context as never as Context<"pull_request.synchronize">);
    } else {
        console.log(`Unhandled action "${githubEvent.action}"`)
    }

    return {statusCode: 200, body: JSON.stringify({message: "Success"})};
};
