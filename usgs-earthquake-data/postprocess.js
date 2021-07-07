import { readJSON } from 'https://deno.land/x/flat@0.0.10/src/json.ts'
import { writeTXT } from 'https://deno.land/x/flat@0.0.10/src/txt.ts'

function createEscaper(characters, replacements) {
    return function (value) {
        var retVal = '';
        var from = 0;
        var i = 0;
        while (i < value.length) {
            var found = characters.indexOf(value[i]);
            if (found >= 0) {
                retVal += value.substring(from, i);
                retVal += replacements[found];
                from = i + 1;
            }
            i++;
        }
        if (from == 0) {
            return value;
        }
        else if (from < value.length) {
            retVal += value.substring(from, value.length);
        }
        return retVal;
    };
}
function createQuotedEscaper(characters, replacements) {
    var escaper = createEscaper(characters, replacements);
    return function (value) { return '"' + escaper(value) + '"'; };
}
/**
 * Provides functions escape specific parts in InfluxDB line protocol.
 */
var escape = {
    /**
     * Measurement escapes measurement names.
     */
    measurement: createEscaper(', \n\r\t', ['\\,', '\\ ', '\\n', '\\r', '\\t']),
    /**
     * Quoted escapes quoted values, such as database names.
     */
    quoted: createQuotedEscaper('"\\', ['\\"', '\\\\']),
    /**
     * TagEscaper escapes tag keys, tag values, and field keys.
     */
    tag: createEscaper(', =\n\r\t', ['\\,', '\\ ', '\\=', '\\n', '\\r', '\\t']),
};

const earthquakeJSON = await readJSON('./usgs-earthquake-data/all_week.geojson')

let points = []
earthquakeJSON.features.forEach((feature, index) => {
    let point = {
        tags: {},
        fields: {},
        measurement: "",
        time: 0
    }
    point.time = feature.properties.time * 1000000

    point.fields.lon = feature.geometry.coordinates[0]
    point.fields.lat = feature.geometry.coordinates[1]
    point.fields.depth = feature.geometry.coordinates[2]
    

    // Fields
    point.fields.mag = feature.properties.mag
    point.fields.place = feature.properties.place
    point.fields.url = feature.properties.url
    point.fields.detail = feature.properties.detail
    point.fields.felt = feature.properties.felt || 0
    point.fields.cdi = feature.properties.cdi || 0.0
    point.fields.mmi = feature.properties.mmi || 0.0
    point.fields.alert = feature.properties.alert
    point.fields.status = feature.properties.status
    point.fields.tsunami = feature.properties.tsunami
    point.fields.sig = feature.properties.sig || 0
    point.fields.ids = feature.properties.ids
    point.fields.sources = feature.properties.sources
    point.fields.types = feature.properties.types
    point.fields.nst = feature.properties.nst || 0
    point.fields.dmin = feature.properties.dmin || 0.0
    point.fields.rms = feature.properties.rms || 0.0
    point.fields.gap = feature.properties.gap || 0.0
    
    // Tags
    point.tags.net = feature.properties.net
    point.tags.code = feature.properties.code
    point.tags.magType = feature.properties.magType
    point.measurement = feature.properties.type
    point.tags.title = feature.properties.title
    point.tags.id = feature.id

    points.push(point)
})

let lpLines = []
points.forEach((point, index) => {
    let lp = escape.measurement(point.measurement)
    let fieldsLine = ""
    Object.keys(point.fields)
        .sort()
        .forEach(function (x) {
            if (x) {
                let val = point.fields[x];
                if(val) {
                    if (fieldsLine.length > 0) {
                        fieldsLine += ',';
                    }
                    if(typeof val === 'string') {
                        val = `"${val}"`
                    }
                    fieldsLine += escape.tag(x) + "=" + val;
                }
            }
        })
    let tagsLine = '';
    Object.keys(point.tags)
        .sort()
        .forEach(function (x) {
        if (x) {
            let val = point.tags[x];
            if (val) {
                tagsLine += ',';
                tagsLine += escape.tag(x) + "=" + escape.tag(val);
            }
        }
    });
    lp += tagsLine + " " + fieldsLine + (point.time !== undefined ? ' ' + point.time : '');
    lpLines.push(lp)
})

const newFilename = `./usgs-earthquake-data/all_week.lp`
await writeTXT(newFilename, lpLines.join('\n'))
