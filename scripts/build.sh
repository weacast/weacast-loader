#!/usr/bin/env bash
set -euo pipefail
# set -x

THIS_FILE=$(readlink -f "${BASH_SOURCE[0]}")
THIS_DIR=$(dirname "$THIS_FILE")
ROOT_DIR=$(dirname "$THIS_DIR")
WORKSPACE_DIR="$(dirname "$ROOT_DIR")"

. "$THIS_DIR/kash/kash.sh"

## Parse options
##

DEFAULT_NODE_VER=20
DEFAULT_DEBIAN_VER=bookworm
NODE_VER=$DEFAULT_NODE_VER
DEBIAN_VER=$DEFAULT_DEBIAN_VER
PUBLISH=false
CI_STEP_NAME="Build"
LOADER=
while getopts "d:n:pr:m:l:" option; do
    case $option in
        d) # defines debian version
            DEBIAN_VER=$OPTARG
            ;;
        n) # defines node version
            NODE_VER=$OPTARG
             ;;
        p) # publish
            PUBLISH=true
            ;;
        r) # report outcome to slack
            CI_STEP_NAME=$OPTARG
            load_env_files "$WORKSPACE_DIR/development/common/SLACK_WEBHOOK_JOBS.enc.env"
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

init_job_infos "$ROOT_DIR"

GIT_TAG=$(get_job_tag)
GTIFF2JSON_TAG=$(get_json_value "$ROOT_DIR/package.json" 'peerDependencies["@weacast/gtiff2json"]')
GRIB2JSON_TAG=$(get_json_value "$ROOT_DIR/package.json" 'peerDependencies["@weacast/grib2json"]')

load_env_files "$WORKSPACE_DIR/development/common/kalisio_dockerhub.enc.env"
load_value_files "$WORKSPACE_DIR/development/common/KALISIO_DOCKERHUB_PASSWORD.enc.value"

## Build container
##

IMAGE_NAME="$KALISIO_DOCKERHUB_URL/weacast/weacast-$MODEL"
if [[ -z "$GIT_TAG" ]]; then
    VERSION=latest
    KRAWLER_SHORT_TAG=latest
else
    VERSION=$(get_job_version)
    KRAWLER_SHORT_TAG=$(get_job_krawler_version)
fi
KRAWLER_TAG="$KRAWLER_SHORT_TAG-node$NODE_VER-$DEBIAN_VER"
if [[ -z "$LOADER" ]]; then
    IMAGE_SHORT_TAG=$VERSION
    DOCKERFILE=dockerfile.$MODEL
else
    IMAGE_SHORT_TAG=$LOADER-$VERSION
    DOCKERFILE=dockerfile.$MODEL-$LOADER
fi
IMAGE_TAG="$IMAGE_SHORT_TAG-node$NODE_VER-$DEBIAN_VER"

begin_group "Building container $IMAGE_NAME:$IMAGE_TAG from krawler:$KRAWLER_TAG ..."

docker login --username "$KALISIO_DOCKERHUB_USERNAME" --password-stdin "$KALISIO_DOCKERHUB_URL" < "$KALISIO_DOCKERHUB_PASSWORD"
# DOCKER_BUILDKIT is here to be able to use Dockerfile specific dockerginore (app.Dockerfile.dockerignore)
DOCKER_BUILDKIT=1 docker build -f "$ROOT_DIR/$DOCKERFILE" \
    --build-arg KRAWLER_TAG="$KRAWLER_TAG" \
    --build-arg TAG="$VERSION-node$NODE_VER-$DEBIAN_VER" \
    --build-arg GTIFF2JSON_TAG="$GTIFF2JSON_TAG" \
    --build-arg GRIB2JSON_TAG="$GRIB2JSON_TAG" \
    -t "$IMAGE_NAME:$IMAGE_TAG" \
    "$ROOT_DIR"

if [ "$PUBLISH" = true ]; then
    docker push "$IMAGE_NAME:$IMAGE_TAG"
    if [ "$NODE_VER" = "$DEFAULT_NODE_VER" ] && [ "$DEBIAN_VER" = "$DEFAULT_DEBIAN_VER" ]; then
        docker tag "$IMAGE_NAME:$IMAGE_TAG" "$IMAGE_NAME:$IMAGE_SHORT_TAG"
        docker push "$IMAGE_NAME:$IMAGE_SHORT_TAG"
    fi
fi

docker logout "$KALISIO_DOCKERHUB_URL"

end_group "Building container $IMAGE_NAME:$IMAGE_TAG from krawler:$KRAWLER_TAG ..."
