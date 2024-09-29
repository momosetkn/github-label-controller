# github-label-controller


## appの作り方


### AWS

AWS Lambda, S3, API Gatewayを使います

環境変数

- GITHUB_APP_ID: Github側のApp ID（https://github.com/settings/apps で確認）
- GITHUB_APP_PRIVATE_KEY: Private keysを改行を\nへ置き換えたもの

5秒以上かかるものもあるので、Lambdaのタイムアウト値をデフォルトの３秒から１５秒ぐらいにしておく

### github側での設定
https://github.com/settings/apps/new

Webhook: Active

以下にAWS LambdaのAPI Gatewayで設定したものを設定
Callback URL, Setup URL (optional), Webhook URL

必要なPermission

- Actions: Read and write
- Metadata: Read-only
- Pull requests: Read and write

必要なSubscribe to events
- Pull request

## Build

pnpm Build

## Release

pnpm release

以下は各自のAWSのクライアントの設定に合わせて書き換えてください
https://github.com/momosetkn/github-label-controller/blob/main/tools/release.sh#L3
