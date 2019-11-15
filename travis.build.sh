#!/bin/bash
source travis.env.sh

docker build --build-arg KRAWLER_BRANCH=$KRAWLER_BRANCH -f dockerfile.arpege -t weacast/weacast-arpege:$VERSION .
docker build --build-arg KRAWLER_BRANCH=$KRAWLER_BRANCH -f dockerfile.gfs -t weacast/weacast-gfs:$VERSION .
docker login -u="$DOCKER_USER" -p="$DOCKER_PASSWORD"
docker push weacast/weacast-arpege:$VERSION
docker push weacast/weacast-gfs:$VERSION

docker build --build-arg TAG=$VERSION -f dockerfile.arpege-world -t weacast/weacast-arpege:world-$VERSION .
docker push weacast/weacast-arpege:world-$VERSION
docker build --build-arg TAG=$VERSION -f dockerfile.arpege-isobaric-world -t weacast/weacast-arpege:isobaric-world-$VERSION .
docker push weacast/weacast-arpege:isobaric-world-$VERSION
docker build --build-arg TAG=$VERSION -f dockerfile.arpege-europe -t weacast/weacast-arpege:europe-$VERSION .
docker push weacast/weacast-arpege:europe-$VERSION
docker build --build-arg TAG=$VERSION -f dockerfile.arpege-isobaric-europe -t weacast/weacast-arpege:isobaric-europe-$VERSION .
docker push weacast/weacast-arpege:isobaric-europe-$VERSION

docker build --build-arg TAG=$VERSION -f dockerfile.arome-france -t weacast/weacast-arome:france-$VERSION .
docker push weacast/weacast-arome:france-$VERSION
docker build --build-arg TAG=$VERSION -f dockerfile.arome-france-high -t weacast/weacast-arome:france-high-$VERSION .
docker push weacast/weacast-arome:france-high-$VERSION

docker build --build-arg TAG=$VERSION -f dockerfile.gfs-world -t weacast/weacast-gfs:world-$VERSION .
docker push weacast/weacast-gfs:world-$VERSION
docker build --build-arg TAG=$VERSION -f dockerfile.gfs-isobaric-world -t weacast/weacast-gfs:isobaric-world-$VERSION .
docker push weacast/weacast-gfs:isobaric-world-$VERSION
