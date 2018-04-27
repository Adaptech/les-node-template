#!/usr/bin/env bash

GIT_REVISION=$(git rev-parse --short HEAD)
RELEASE_VERSION=$(date +%Y%m%d)-${GIT_REVISION}
RELEASE_NAME=les-node-template-${RELEASE_VERSION}
RELEASES_DIR=${PWD}/releases
RELEASE_DIR=${RELEASES_DIR}/${RELEASE_NAME}

if [ -e ${RELEASE_DIR} ]; then
    rm -rf ${RELEASE_DIR}
fi
mkdir -p ${RELEASE_DIR}

cp -R config ${RELEASE_DIR}/
cp -R test ${RELEASE_DIR}/
cp -R src ${RELEASE_DIR}/
cp .babel* ${RELEASE_DIR}/
cp .eslint* ${RELEASE_DIR}/
cp .gitignore ${RELEASE_DIR}/
cp package*.json ${RELEASE_DIR}/
cp yarn.lock ${RELEASE_DIR}/
cp Dockerfile ${RELEASE_DIR}/
cp README.md ${RELEASE_DIR}/
cp LICENSE ${RELEASE_DIR}/

tar -C ${RELEASES_DIR} -zcf ${RELEASES_DIR}/${RELEASE_NAME}.tar.gz ${RELEASE_NAME}
echo "Done"