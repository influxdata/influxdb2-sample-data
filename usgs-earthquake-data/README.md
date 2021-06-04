# USGS Earthquake Data

This directory contains the following files generated from the USGS Earthquake Data (https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php).

### all_week-annotated.csv
This is the earthquake data for the past week in Annotated CSV format meant to be imported into InfluxDB via the `csv.from` function.

### all_week.lp
This is the earthquake data in Line Protocol format meant to be imported into InfluxDB via the web UI or CLI `influx write` command.

### all_week.geojson
This is the earthquake data for the past week which forms the basis for the csv and lp files. Pulled from https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php.

### postprocess.js
A deno script for converting the earthquake data file into line protocol for further processing.