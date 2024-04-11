#!/usr/bin/env bash
set -euo pipefail
# set -x

JOB_ID=$1

THIS_FILE=$(readlink -f "${BASH_SOURCE[0]}")
THIS_DIR=$(dirname "$THIS_FILE")
# ROOT_DIR=$(dirname "$THIS_DIR")

. "$THIS_DIR/kash/kash.sh"

### Github Actions

init_github_run_tests() {
    install_reqs yq age sops nvm node16 node18 node20 mongo4 mongo5 mongo6 cc_test_reporter
}

init_github_build_model() {
    install_reqs age sops nvm node16
}

init_github_build_loader() {
    install_reqs age sops nvm node16
}

init_github_additional_tests() {
    install_reqs age sops nvm node16 node18 node20 mongo4 mongo5 mongo6
}

begin_group "Init $CI_ID for $JOB_ID"

init_"${CI_ID}_${JOB_ID}"

end_group "Init $CI_ID for $JOB_ID"
