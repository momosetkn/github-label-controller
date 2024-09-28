declare namespace NodeJS {
    interface ProcessEnv {
        GITHUB_APP_PRIVATE_KEY: string;
        GITHUB_APP_ID: string;
        GITHUB_TOKEN: string;
    }
    interface LabelControllerItem {
        label: string;
        workflowId: string;
    }
}
