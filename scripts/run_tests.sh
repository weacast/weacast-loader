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

NODE_VER=20
MONGO_VER=7
CI_STEP_NAME="Run tests"
RUN_SONAR=false
while getopts "m:n:sr:" option; do
    case $option in
        m) # defines mongo version
            MONGO_VER=$OPTARG
            ;;
        n) # defines node version
            NODE_VER=$OPTARG
             ;;
        s) # enable SonarQube analysis and publish code quality & coverage results
            RUN_SONAR=true
            ;;
        r) # report outcome to slack
            load_env_files "$WORKSPACE_DIR/development/common/SLACK_WEBHOOK_JOBS.enc.env"
            CI_STEP_NAME=$OPTARG
            trap 'slack_ci_report "$ROOT_DIR" "$CI_STEP_NAME" "$?" "$SLACK_WEBHOOK_JOBS"' EXIT
            ;;
        *)
            ;;
    esac
done

## Init workspace
##

. "$WORKSPACE_DIR/development/workspaces/jobs/jobs.sh" weacast-loaders

# Required by tests
GTIFF2JSON_TAG=$(get_json_value "$ROOT_DIR/package.json" 'peerDependencies["@weacast/gtiff2json"]')
GRIB2JSON_TAG=$(get_json_value "$ROOT_DIR/package.json" 'peerDependencies["@weacast/grib2json"]')

use_node "$NODE_VER"
git clone https://github.com/kalisio/krawler.git && cd krawler && yarn install && yarn link && cd ..
yarn link @kalisio/krawler
yarn global add "@weacast/gtiff2json@$GTIFF2JSON_TAG"
yarn global add "@weacast/grib2json@$GRIB2JSON_TAG"

## Run tests
##

run_lib_tests "$ROOT_DIR" "$RUN_SONAR" "$NODE_VER" "$MONGO_VER"
