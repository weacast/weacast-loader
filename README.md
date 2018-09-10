# Weacat loader

[Krawler](https://kalisio.github.io/krawler/) based services to download data from the global numerical weather prediction model ARPEGE (Action de Recherche Petite Echelle Grande Echelle) and the small scale numerical prediction model AROME operational at Météo-France and the global numerical weather prediction model GFS (Global Forecast System).

These data are then visualized using the [Weacast client](https://github.com/weacast/weacast-client).

First you need to build the Docker containers containing the ARPEGE, AROME and GFS services (this repo dir):
```
# Manually
docker build -t weacast/weacast-arpege -f dockerfile.arpege .
docker build -t weacast/weacast-gfs -f dockerfile.gfs .
docker build -t weacast/weacast-gfs -f dockerfile.gfs .
# Using Weacast Docker compose files
docker-compose build weacast-arpege weacast-arome weacast-gfs
```

Then you have run it using the Docker compose files (weacast application repo dir):
```
# Stop/remove previous instances if any
docker-compose stop weacast-arpege weacast-arome weacast-gfs
docker-compose rm weacast-arpege weacast-arome weacast-gfs
# Launch new ones
docker-compose up -d weacast-arpege weacast-arome weacast-gfs
```
