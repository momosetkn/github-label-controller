
rm -rf artifact && mkdir artifact

#build
pnpm install --prd
pnpm pru --prd

#layer
#rm -rf artifact/nodejs && mkdir -p artifact/nodejs
#cp -r node_modules artifact/nodejs
#zip -r artifact/layer.zip artifact/nodejs

zip -r artifact/layer.zip node_modules

aws --profile private \
 s3api put-object \
  --bucket momosemomose-tokyo \
  --key github-label-controller/layer.zip \
  --body artifact/layer.zip

aws --profile private \
lambda publish-layer-version \
  --layer-name my-layer \
  --description "Dependencies layer" \
  --content S3Bucket=momosemomose-tokyo,S3Key=github-label-controller/layer.zip \
  --compatible-runtimes nodejs20.x

# function
pnpm tsc

(cd dist && zip -r ../artifact/function.zip .)

aws --profile private \
 s3api put-object \
  --bucket momosemomose-tokyo \
  --key github-label-controller/function.zip \
  --body artifact/function.zip

aws --profile private \
lambda update-function-code --function-name github-label-controller \
--s3-bucket momosemomose-tokyo --s3-key github-label-controller/function.zip

