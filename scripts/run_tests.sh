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

NODE_VER=16
MONGO_VER=4
CI_STEP_NAME="Run tests"
CODE_COVERAGE=false
while getopts "m:n:cr:" option; do
    case $option in
        m) # defines mongo version
            MONGO_VER=$OPTARG
            ;;
        n) # defines node version
            NODE_VER=$OPTARG
             ;;
        c) # publish code coverage
            CODE_COVERAGE=true
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
use_node "$NODE_VER"
GTIFF2JSON_TAG=$(node -p -e "require('./package.json').peerDependencies['@weacast/gtiff2json']")
GRIB2JSON_TAG=$(node -p -e "require('./package.json').peerDependencies['@weacast/grib2json']")
git clone https://github.com/kalisio/krawler.git && cd krawler && yarn install && yarn link && cd ..
yarn link @kalisio/krawler
yarn global add @weacast/gtiff2json@${GTIFF2JSON_TAG}
yarn global add @weacast/grib2json@${GRIB2JSON_TAG}

## Run tests
##

run_lib_tests "$ROOT_DIR" "$CODE_COVERAGE" "$NODE_VER" "$MONGO_VER"
