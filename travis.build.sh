#!/bin/bash
source travis.env.sh
# Build docker only on release
if [[ -z "$TRAVIS_TAG" ]]
then
	echo "Skipping docker images build"
else
	docker build -f dockerfile.arpege -t weacast/weacast-arpege .
	docker tag weacast/weacast-arpege weacast/weacast-arpege:$VERSION
	docker build -f dockerfile.gfs -t weacast/weacast-gfs .
	docker tag weacast/weacast-gfs weacast/weacast-gfs:$VERSION
	docker login -u="$DOCKER_USER" -p="$DOCKER_PASSWORD"
	docker push weacast/weacast-arpege:$VERSION
	docker push weacast/weacast-gfs:$VERSION
fi
