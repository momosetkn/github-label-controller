(cd dist && zip -r ../artifact/function.zip .)

aws --profile private \
 s3api put-object \
  --bucket momosemomose-tokyo \
  --key github-label-controller/function.zip \
  --body artifact/function.zip

aws --profile private \
lambda update-function-code --function-name github-label-controller \
--s3-bucket momosemomose-tokyo --s3-key github-label-controller/function.zip
