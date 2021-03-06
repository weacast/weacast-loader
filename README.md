# weacast-loader

[![Build Status](https://travis-ci.com/weacast/weacast-loader.png?branch=master)](https://travis-ci.com/weacast/weacast-loader)
[![Code Climate](https://codeclimate.com/github/weacast/weacast-loader/badges/gpa.svg)](https://codeclimate.com/github/weacast/weacast-loader)
[![Test Coverage](https://codeclimate.com/github/weacast/weacast-loader/badges/coverage.svg)](https://codeclimate.com/github/weacast/weacast-loader/coverage)
[![Dependency Status](https://img.shields.io/david/weacast/weacast-loader.svg?style=flat-square)](https://david-dm.org/weacast/weacast-loader)
[![Documentation](https://img.shields.io/badge/documentation-available-brightgreen.svg)](https://weacast.github.io/weacast-docs/)

[Krawler](https://kalisio.github.io/krawler/) based services to download data from the global numerical weather prediction model ARPEGE (Action de Recherche Petite Echelle Grande Echelle) and the small scale numerical prediction model AROME operational at Météo-France and the global numerical weather prediction model GFS (Global Forecast System) produced by the National Centers for Environmental Prediction (NCEP).

These data are then served using the [Weacast services API](https://github.com/weacast/weacast-api) and visualized using the [Weacast client](https://github.com/weacast/weacast-client).

To debug a loader you can run this command from a local krawler/MongoDB install `node --inspect . --cron "0 15,45 * * * *" --run --sync "mongodb://127.0.0.1:27017/weacast" D:\Development\weacast\weacast-loader\jobfile-arpege-europe.js`

To build a Docker image and test it locally:
```
// Base image with latest krawler
docker build --build-arg KRAWLER_TAG=latest -f dockerfile.arpege -t weacast/weacast-arpege:latest .
// Model-specific image
docker build --build-arg TAG=latest -f dockerfile.arpege-europe -t weacast/weacast-arpege:europe-latest .
// Define any required env vars
METEO_FRANCE_TOKEN=xxx
// Run with Mongo instance
docker-compose up -d mongodb-weacast weacast-arpege-europe
// Stop
docker-compose down -v
```

## Documentation

The [Weacast docs](https://weacast.github.io/weacast-docs/) are loaded with awesome stuff and tell you everything you need to know about using and configuring Weacast.

## License

Copyright (c) 2017

Licensed under the [MIT license](LICENSE).

