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
while getopts "prml:" option; do
    case $option in
        p) # publish
            PUBLISH=true
            ;;
        r) # report outcome to slack
            CI_STEP_NAME=$OPTARG
            trap 'slack_ci_report "$ROOT_DIR" "$CI_STEP_NAME" "$?" "$SLACK_WEBHOOK_JOBS"' EXIT
            ;;
        m) # weacast model image to be build: gfs, arpege
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

JOB=$(get_job_name)
KRAWLER_VERSION=$(get_job_krawler_version)
GIT_TAG=$(get_job_tag)

if [[ -z "$GIT_TAG" ]]; then
    echo "About to build ${JOB}:${LOADER} development version based on krawler development version..."
else
    echo "About to build ${JOB}:${LOADER} v${VERSION} based on krawler ${KRAWLER_VERSION}..."
fi

load_env_files "$WORKSPACE_DIR/development/common/kalisio_dockerhub.enc.env" "$WORKSPACE_DIR/development/common/SLACK_WEBHOOK_JOBS.enc.env"
load_value_files "$WORKSPACE_DIR/development/common/KALISIO_DOCKERHUB_PASSWORD.enc.value"

## Build container
##

IMAGE_NAME="weacast/weacast-$MODEL"
DOCKERFILE=dockerfile.$MODEL-$LOADER
if [[ -z "$GIT_TAG" ]]; then
    VERSION=latest
else
    VERSION=$(get_job_version)
fi
IMAGE_TAG=$LOADER-$VERSION

begin_group "Building container ..."

docker login --username "$KALISIO_DOCKERHUB_USERNAME" --password-stdin < "$KALISIO_DOCKERHUB_PASSWORD"
# DOCKER_BUILDKIT is here to be able to use Dockerfile specific dockerginore (app.Dockerfile.dockerignore)
DOCKER_BUILDKIT=1 docker build -f "$ROOT_DIR/$DOCKERFILE" \
    --build-arg TAG=$VERSION -t "$IMAGE_NAME:$IMAGE_TAG" \
    "$ROOT_DIR"

if [ "$PUBLISH" = true ]; then
    docker push "$IMAGE_NAME:$IMAGE_TAG"
fi

docker logout

end_group "Building container ..."
