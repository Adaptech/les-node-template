#!/usr/bin/env bash

repo_path=Adaptech/les-node-template
GIT_REVISION=$(git rev-parse --short HEAD)
RELEASE_VERSION=$(date +%Y%m%d)-${GIT_REVISION}
RELEASE_NAME=les-node-template-${RELEASE_VERSION}
RELEASES_DIR=${PWD}/releases/les-node-template
RELEASE_DIR=${RELEASES_DIR}/${RELEASE_NAME}

echo "Preparing the archive ${RELEASE_NAME}.tar.gz ..."
if [ -e ${RELEASE_DIR} ]; then
    rm -rf ${RELEASE_DIR}
fi
mkdir -p ${RELEASE_DIR}

cp -R config ${RELEASE_DIR}/
cp -R test ${RELEASE_DIR}/
cp -R src ${RELEASE_DIR}/
cp * ${RELEASE_DIR}/
cp .* ${RELEASE_DIR}/

tar -C ${RELEASES_DIR} -zcf ${RELEASES_DIR}/${RELEASE_NAME}.tar.gz ${RELEASE_NAME}
rm -rf ${RELEASE_DIR}

# Ask for github credentials so we don't have to login for each request
echo 'Enter your Github credentials'
read -p 'username: ' github_username
read -s -p 'token or password: ' github_token
echo ''
echo ''

echo "Creating the github release..."

rc=`curl -s -u ${github_username}:${github_token} \
 -H 'Content-Type:application/json' \
 -d '{"tag_name":"release-'"${RELEASE_VERSION}"'","target_commitish": "master","name":"v'"${RELEASE_VERSION}"'","body":"Release '"${RELEASE_VERSION}"'","draft":false,"prerelease":false}' https://api.github.com/repos/${repo_path}/releases`
tmp=`echo ${rc} | jq -r '.upload_url'`
if [ ${tmp} = "null" ]; then
    echo 'Something went wrong'
    echo ${rc}
    exit 1
fi
upload_url=${tmp%%\{*}

echo "Uploading the archive to github..."

echo "Uploading ${RELEASE_NAME}.tar.gz ..."
curl -s -u ${github_username}:${github_token} \
 -H 'Content-Type:application/octet-stream' \
 --data-binary @releases/les-node-template/${RELEASE_NAME}.tar.gz \
 ${upload_url}?name=${RELEASE_NAME}.tar.gz
echo ''

echo "Done"
