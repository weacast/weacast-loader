#!/usr/bin/env bash
set -euo pipefail
# set -x

THIS_FILE=$(readlink -f "${BASH_SOURCE[0]}")
THIS_DIR=$(dirname "$THIS_FILE")
ROOT_DIR=$(dirname "$THIS_DIR")

. "$THIS_DIR/kash/kash.sh"

## Parse options
##

PUBLISH=false
CI_STEP_NAME="Build"
LOADER=
while getopts "pr:m:l:" option; do
    case $option in
        p) # publish
            PUBLISH=true
            ;;
        r) # report outcome to slack
            CI_STEP_NAME=$OPTARG
            trap 'slack_ci_report "$ROOT_DIR" "$CI_STEP_NAME" "$?" "$SLACK_WEBHOOK_JOBS"' EXIT
            ;;
        m) # weacast model image to be build or used (if loader build): gfs, arpege, ...
            MODEL=$OPTARG
            ;;
        l) # weacast loader image to be build: europe, isobaric-europe, ...
            LOADER=$OPTARG
            ;;
        *)
            ;;
    esac
done

## Init workspace
##

WORKSPACE_DIR="$(dirname "$ROOT_DIR")"
init_job_infos "$ROOT_DIR"

GIT_TAG=$(get_job_tag)
GTIFF2JSON_TAG=$(node -p -e "require('./package.json').peerDependencies['@weacast/gtiff2json']")
GRIB2JSON_TAG=$(node -p -e "require('./package.json').peerDependencies['@weacast/grib2json']")

load_env_files "$WORKSPACE_DIR/development/common/kalisio_dockerhub.enc.env" "$WORKSPACE_DIR/development/common/SLACK_WEBHOOK_JOBS.enc.env"
load_value_files "$WORKSPACE_DIR/development/common/KALISIO_DOCKERHUB_PASSWORD.enc.value"

## Build container
##

IMAGE_NAME="weacast/weacast-$MODEL"
if [[ -z "$GIT_TAG" ]]; then
    VERSION=latest
    KRAWLER_TAG=latest
else
    VERSION=$(get_job_version)
    KRAWLER_TAG=$(get_job_krawler_version)
fi
if [[ -z "$LOADER" ]]; then
    IMAGE_TAG=$VERSION
    DOCKERFILE=dockerfile.$MODEL
else
    IMAGE_TAG=$LOADER-$VERSION
    DOCKERFILE=dockerfile.$MODEL-$LOADER
fi

echo "About to build image ${IMAGE_NAME}:${IMAGE_TAG} based on kalisio/krawler:${KRAWLER_TAG}..."

begin_group "Building container ..."

docker login --username "$KALISIO_DOCKERHUB_USERNAME" --password-stdin < "$KALISIO_DOCKERHUB_PASSWORD"
# DOCKER_BUILDKIT is here to be able to use Dockerfile specific dockerginore (app.Dockerfile.dockerignore)
DOCKER_BUILDKIT=1 docker build -f "$ROOT_DIR/$DOCKERFILE" \
    --build-arg KRAWLER_TAG=$KRAWLER_TAG --build-arg TAG=$VERSION \
    --build-arg GTIFF2JSON_TAG=$GTIFF2JSON_TAG --build-arg GRIB2JSON_TAG=$GRIB2JSON_TAG \
    -t "$IMAGE_NAME:$IMAGE_TAG" \
    "$ROOT_DIR"

if [ "$PUBLISH" = true ]; then
    docker push "$IMAGE_NAME:$IMAGE_TAG"
fi

docker logout

end_group "Building container ..."
