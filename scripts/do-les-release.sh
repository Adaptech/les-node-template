#!/usr/bin/env bash

GIT_REVISION=$(git rev-parse --short HEAD)
RELEASE_VERSION=$(date +%Y%m%d)-${GIT_REVISION}
RELEASE_NAME=les-node-template-${RELEASE_VERSION}
RELEASES_DIR=${PWD}/releases/les-node-template
RELEASE_DIR=${RELEASES_DIR}/${RELEASE_NAME}

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
echo "Done"