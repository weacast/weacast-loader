# weacast-loader

[![Latest Release](https://img.shields.io/github/v/tag/weacast/weacast-loader?sort=semver&label=latest)](https://github.com/weacast/weacast-loader/releases)
[![CI](https://github.com/weacast/weacast-loader/actions/workflows/main.yaml/badge.svg)](https://github.com/weacast/weacast-loader/actions/workflows/main.yaml)
[![Code Climate](https://codeclimate.com/github/weacast/weacast-loader/badges/gpa.svg)](https://codeclimate.com/github/weacast/weacast-loader)
[![Test Coverage](https://codeclimate.com/github/weacast/weacast-loader/badges/coverage.svg)](https://codeclimate.com/github/weacast/weacast-loader/coverage)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Documentation](https://img.shields.io/badge/documentation-available-brightgreen.svg)](https://weacast.github.io/weacast/)

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

The [Weacast docs](https://weacast.github.io/weacast/) are loaded with awesome stuff and tell you everything you need to know about using and configuring Weacast.

## Debug

Here are some request examples if you'd like to test the underlying services manually.

### GFS

The [Grib Filter](https://nomads.ncep.noaa.gov/txt_descriptions/grib_filter_doc.shtml) ease the generation of request URLs for GFS. For instance using the [grib filter for GFS 0.5°](https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p50.pl) you get this kind of URL:

* https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p50.pl?file=gfs.t00z.pgrb2full.0p50.f000&lev_surface=on&var_APCP=on&leftlon=0&rightlon=360&toplat=90&bottomlat=-90&dir=%2Fgfs.20211125%2F00%2Fatmos

### Météo France

> Take care that you need to URL encode your token or remove the trailing `=` caracters

WCS `GetCapabilities` operation:

* https://public-api.meteofrance.fr/public/arpege/1.0/wcs/MF-NWP-GLOBAL-ARPEGE-025-GLOBE-WCS/GetCapabilities?REQUEST=GetCapabilities&service=WCS&version=2.0.1&apikey=token

Select a coverage, e.g. `TEMPERATURE__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND___2021-11-24T12.00.00Z`.

WCS `DescribeCoverage` operation:

* https://public-api.meteofrance.fr/public/arpege/1.0/wcs/MF-NWP-GLOBAL-ARPEGE-025-GLOBE-WCS/DescribeCoverage?REQUEST=DescribeCoverage&service=WCS&version=2.0.1&coverageid=TEMPERATURE__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND___2021-11-24T12.00.00Z&apikey=token

WCS `GetCoverage` operation:

* https://public-api.meteofrance.fr/public/arpege/1.0/wcs/MF-NWP-GLOBAL-ARPEGE-025-GLOBE-WCS/GetCoverage?REQUEST=GetCoverage&service=WCS&version=2.0.1&coverageid=TEMPERATURE__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND___2021-11-24T12.00.00Z&subset=time(2021-11-24T12:00:00Z)&subset=height(2)&apikey=token

> Web services previously supported HTTP GET with key/value pair (KVP) encoding but now use different endpoints for the different operations so that the `REQUEST` parameter might not be required anymore. 

## License

Copyright (c) 2017

Licensed under the [MIT license](LICENSE).

