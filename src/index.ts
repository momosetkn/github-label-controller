import {Context} from "probot";
import {Octokit} from "@octokit/rest";
import {createAppAuth} from "@octokit/auth-app";
import type {ProbotOctokit} from "probot/lib/octokit/probot-octokit";
import ProcessEnv = NodeJS.ProcessEnv;
import LabelControllerItem = NodeJS.LabelControllerItem;

async function executeWorkflowsWhenAddLabel(
    {context, label, octokit, owner, pullRequestNumber, ref, repo, workflow_id, labelControllerConfig}: {
        octokit: ProbotOctokit,
        owner: string,
        repo: string,
        label: string,
        pullRequestNumber: number,
        context: Context<"pull_request.labeled">,
        workflow_id: string,
        ref: string,
        labelControllerConfig: LabelControllerItem,
    }
) {
    // ラベルが付与されているプルリクエストの一覧を取得
    const response = await octokit.pulls.list({
        owner,
        repo,
        state: "open",
    });

    console.log("response.data" + response.data);

    // ラベルが付与されているPRのみフィルタリング
    const labeledPRs = response.data.filter(pr =>
        pr.labels.some(l => l.name === label) && pr.number !== pullRequestNumber
    );
    context.log.info("labeledPRs: " + labeledPRs.map(x => x.number));
    for (const labeledPR of labeledPRs) {
        // プルリクエストからラベルを削除
        await octokit.issues.removeLabel({
            owner,
            repo,
            issue_number: labeledPR.number,  // PR番号はIssue番号として扱う
            name: label,         // 剥がすラベル名
        });
        // rollback処理
        console.log("rollback" + labeledPR.number)
        // ラベルを剥がすことで自分自身を間接的に呼ぶ
        // await octokit.actions.createWorkflowDispatch({owner, repo, workflow_id: labelControllerConfig.ifRemoveWorkflowId, ref});
    }

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

async function getLabelControllerConfig(octokit: ProbotOctokit, owner: string, repo: string, label: string) {
    const labelControllerJson = await getFile({
        octokit,
        owner, repo,
        path: ".github/label-controller.json"
    })
    const labelController = JSON.parse(labelControllerJson!) as LabelControllerItem[]
    const item = labelController.find(x => x.label === label)
    return item;
}

const handlePullRequestLabeled = async (context: Context<"pull_request.labeled">) => {
    const label = context.payload.label.name;
    const pullRequestNumber = context.payload.pull_request.number;
    context.log.info(`Label ${label} was added to pull request #${pullRequestNumber}`);

    const owner = context.payload.repository.owner.login;
    const repo = context.payload.repository.name;
    // const ref = "main"
    const ref = context.payload.pull_request.head.ref

    const octokit = context.octokit;
    const item = await getLabelControllerConfig(octokit, owner, repo, label);
    if (item!!) {
        context.log.info(`Match the Label ${label}`);
        const workflow_id = item.ifAddWorkflowId;
        if (item.label === label) {
            await executeWorkflowsWhenAddLabel({octokit, owner, repo, label, pullRequestNumber, context, workflow_id, ref, labelControllerConfig: item});
        } else {
            context.log.info(`else--------------------Label ${label} was added to pull request #${pullRequestNumber}`);
        }
    }
};


const handlePullRequestUnlabeled = async (context: Context<"pull_request.unlabeled">) => {
    const label = context.payload.label.name;
    const pullRequestNumber = context.payload.pull_request.number;
    context.log.info(`Label ${label} was removed from pull request #${pullRequestNumber}`);

    const owner = context.payload.repository.owner.login;
    const repo = context.payload.repository.name;
    const ref = context.payload.pull_request.head.ref
    const octokit = context.octokit;

    // rollback

    await ifRemoveLabel(
        {
            label, octokit, owner, ref, repo
        }
    )

};
const ifRemoveLabel = async (    { label, octokit, owner, ref, repo}: {
                                     octokit: ProbotOctokit,
                                     owner: string,
                                     repo: string,
                                     label: string,
                                     ref: string
                                 } ) => {
    const item = await getLabelControllerConfig(octokit, owner, repo, label);
    if(!item) return

    console.log("execute ifRemoveLabel:" + label + "ref"  + ref);
    await octokit.actions.createWorkflowDispatch({owner, repo, workflow_id: item.ifRemoveWorkflowId, ref});
}

const getFile = async ({
                           octokit, path, owner, repo
                       }:
                           {
                               octokit: ProbotOctokit,
                               owner: string,
                               repo: string,
                               path: string,
                           }
) => {
    // ファイルの内容を取得
    const response = await octokit.repos.getContent({
        owner,
        repo,
        path,
    });

    if ("content" in response.data) {
        const fileContentBase64 = response.data.content;
        const fileContent = atob(fileContentBase64);  // Base64をデコード

        console.log("ファイルの内容:", fileContent);
        return fileContent
    } else {
        console.error("ファイルが見つかりませんでした。");
        return null
    }
}

export const handler = async (event: any) => {
    const processEnv = process.env as ProcessEnv
    const privateKey = processEnv.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, '\n');
    const appId = processEnv.GITHUB_APP_ID;
    const githubToken = processEnv.GITHUB_TOKEN;

    console.log("event.body: " + event.body)
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
        // octokit: new Octokit({auth: githubToken}) // これで動いたは動いた
    };

    if (githubEvent.action === "labeled") {
        await handlePullRequestLabeled(context as any as Context<"pull_request.labeled">);
    } else if (githubEvent.action === "unlabeled") {
        await handlePullRequestUnlabeled(context as any as Context<"pull_request.unlabeled">);
    }

    return {statusCode: 200, body: JSON.stringify({message: "Success"})};
};
