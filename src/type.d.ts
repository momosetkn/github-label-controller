declare namespace NodeJS {
    interface ProcessEnv {
        GITHUB_APP_PRIVATE_KEY: string;
        GITHUB_APP_ID: string;
    }
    interface LabelControllerItem {
        label: string;
        ifAddWorkflowId: string;
        ifRemoveWorkflowId: string;
    }
}
