import { readTXT, writeTXT } from 'https://deno.land/x/flat@0.0.10/src/txt.ts' 
import { Parser } from 'https://deno.land/x/xmlparser@v0.2.0/mod.ts'

const observationsTxt = await readTXT('./noaa-ndbc-data/latest-observations.txt')
const activeStations = await readTXT('./noaa-ndbc-data/active-stations.xml')

const parser = new Parser({
    trimValues: true,
    reflectAttrs: false
  })
const root = parser.parse(activeStations.replaceAll(/\'/ig, '').replaceAll(/""/ig, '" "'))
const stationMap = {}
root.find(['stations', 'station']).forEach((node) => {
    if(node) {
        stationMap[node.getAttr('id').toUpperCase()] = {
            lat: parseFloat(node.getAttr('lat')),
            lon: parseFloat(node.getAttr('lon')),
            elev: parseFloat(node.getAttr('elev') || 0),
            name: node.getAttr('name'),
            owner: node.getAttr('owner'),
            pgm: node.getAttr('pgm'),
            type: node.getAttr('type'),
            met: node.getAttr('met'),
            currents: node.getAttr('currents'),
            waterquality: node.getAttr('waterquality'),
            dart: node.getAttr('dart'),
        }
    }
})

const re = /\s+/
// Resolve NOAA's measurement columns from the source header. Both historical
// header orders are supported without changing the downstream CSV schema.
const measurementNames = {
    WDIR: 'wind_dir_degt',
    WSPD: 'wind_speed_mps',
    GST: 'gust_speed_mps',
    WVHT: 'significant_wave_height_m',
    DPD: 'dominant_wave_period_sec',
    APD: 'avg_wave_period_sec',
    MWD: 'wave_dir_degt',
    PRES: 'sea_level_pressure_hpa',
    PTDY: 'pressure_tendency_hpa',
    ATMP: 'air_temp_degc',
    WTMP: 'sea_surface_temp_degc',
    DEWP: 'dewpoint_temp_degc',
    VIS: 'station_visibility_nmi',
    TIDE: 'water_level_ft',
}
const expectedPrefix = ['#STN', 'LAT', 'LON', 'YYYY', 'MM', 'DD', 'hh', 'mm']
const missing_data_list = "MM,999,9999.0,999.0,99.0,99.00".split(",")
const obsArray = observationsTxt.split(/\r?\n/)
const headerLine = obsArray.find(line => line.trimStart().replace(/^\uFEFF/, '').startsWith('#STN'))
if (!headerLine) {
    throw new Error('NDBC observations header #STN was not found')
}
const sourceHeaders = headerLine.trim().replace(/^\uFEFF/, '').split(re)
if (sourceHeaders.length !== expectedPrefix.length + Object.keys(measurementNames).length ||
    expectedPrefix.some((field, index) => sourceHeaders[index] !== field)) {
    throw new Error('Unexpected NDBC observations header structure')
}
const measurementColumns = sourceHeaders.slice(expectedPrefix.length)
if (new Set(measurementColumns).size !== Object.keys(measurementNames).length ||
    measurementColumns.some(name => !Object.hasOwn(measurementNames, name))) {
    throw new Error('Unknown, missing, or duplicate NDBC measurement column')
}

let jsonArray = obsArray.map(line => {
    const cleanLine = line.trim()
    if (!cleanLine || cleanLine.startsWith('#') || cleanLine.includes('\0')) {
        return null
    }
    const readings = cleanLine.split(re)
    if (readings.length !== sourceHeaders.length) {
        throw new Error('Unexpected NDBC observations field count: ' + readings[0])
    }
    let ret = {
        station_id: readings.shift(),
        lat: parseFloat(readings.shift()),
        lon: parseFloat(readings.shift()),
    }
    let year = readings.shift()
    let month = readings.shift()
    let day = readings.shift()
    let hour = readings.shift()
    let minute = readings.shift()
    let date = year + "-" + month + "-" + day + "T" + hour + ":" + minute + "+0000" //2006-01-02T15:04

    ret["timestamp"] = new Date(date).valueOf() + "000000"
    readings.forEach((value, index) => {
        if (!missing_data_list.includes(value)) {
            ret[measurementNames[measurementColumns[index]]] = parseFloat(value)
        }
    })
    if(stationMap[ret.station_id]) {
        for (const [key, value] of Object.entries(stationMap[ret.station_id])) {
            if(key != 'lat' && key != 'lon') {
                ret["station_"+key] = value
            }
        }
    }
    return ret
}).filter(Boolean)

let headers = [
    "wind_dir_degt",
    "wind_speed_mps",
    "gust_speed_mps",
    "significant_wave_height_m",
    "dominant_wave_period_sec",
    "avg_wave_period_sec",
    "wave_dir_degt",
    "sea_level_pressure_hpa",
    "air_temp_degc",
    "sea_surface_temp_degc",
    "dewpoint_temp_degc",
    "station_visibility_nmi",
    "pressure_tendency_hpa",
    "water_level_ft",
    "station_id",
    "lat",
    "lon",
    "station_elev",
    "station_name",
    "station_owner",
    "station_pgm",
    "station_type",
    "station_met",
    "station_currents",
    "station_waterquality",
    "station_dart",
    "timestamp"
]
let csvArray = [headers.join(',')]
jsonArray.forEach((obj, index) => {
    let arr = []
    let keys = Object.keys(obj)
    headers.forEach((header) => {
        if(keys.includes(header)) {
            if (header !== 'timestamp' && (typeof obj[header] === 'string' || obj[header] instanceof String)) {
                arr.push('"' + obj[header] + '"')
            } else {
                arr.push(obj[header])
            }
        } else {
            arr.push("")
        }
    })
    
    csvArray.push(arr.join(","))
})

await writeTXT('./noaa-ndbc-data/latest-observations.csv', csvArray.join('\r\n'))
