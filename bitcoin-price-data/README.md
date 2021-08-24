# CoinDesk Bitcoin Price Data

“Powered by CoinDesk” - https://www.coindesk.com/price/bitcoin

This directory contains the following files generated from the CoinDesk Bitcoin Pricing Data (https://www.coindesk.com/price/bitcoin).

### bitcoin-currentprice-annotated.csv
This is the latest Bitcoin pricing data from the API in annotated CSV format. This is meant to be imported into InfluxDB via the `csv.from` function.

### bitcoin-historical-annotated.csv
This is the last 30 days of Bitcoin pricing data from the API in annotated CSV format. This is meant to be imported into InfluxDB via the `csv.from` function.

### currentprice.json
This is the latest Bitcoin pricing data from the API in JSON format.

### currentprice.lp
This is the latest Bitcoin pricing data from the API in line protocol format. This is meant to be imported into InfluxDB via the web UI or CLI `influx write` command.

### postprocess.js
A deno script for converting the currentprice.json file into line protocol for further processing.
