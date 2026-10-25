import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const original = await fs.readFile(new URL('./postprocess.js', import.meta.url), 'utf8');
const source = original.replace(/^import \{ readTXT, writeTXT \}.*$/m, 'const { readTXT, writeTXT } = globalThis.__ndbcMock.flat')
                       .replace(/^import \{ Parser \}.*$/m, 'const { Parser } = globalThis.__ndbcMock.xml');
assert(!source.includes("import {"));
let n = 0;
const prefix = ['#STN','LAT','LON','YYYY','MM','DD','hh','mm'];
const order = ['WDIR','WSPD','GST','WVHT','DPD','APD','MWD','PRES','PTDY','ATMP','WTMP','DEWP','VIS','TIDE'];
const older = ['WDIR','WSPD','GST','WVHT','DPD','APD','MWD','PRES','ATMP','WTMP','DEWP','VIS','PTDY','TIDE'];
const values = {WDIR:'135',WSPD:'6.2',GST:'8.0',WVHT:'1.3',DPD:'9',APD:'8',MWD:'112',PRES:'1018.5',PTDY:'0.4',ATMP:'26.2',WTMP:'27.8',DEWP:'20.6',VIS:'MM',TIDE:'MM'};
const base = ['41004','32.502','-79.099','2026','10','16','20','30'];
function fixture(cols=order, overrides={}, station=base) {
  return `${prefix.concat(cols).join(' ')}\n#text units description\n${station.concat(cols.map(k => overrides[k] ?? values[k])).join(' ')}`;
}
async function convert(txt, xmlNodes=[]) {
  const writes=[];
  globalThis.__ndbcMock={flat:{readTXT:async path=>path.endsWith('.xml')?'<stations/>':txt,writeTXT:async(path,val)=>{writes.push({path,val})}},xml:{Parser:class {parse(){return {find:()=>xmlNodes}}}}};
  const code = 'data:text/javascript;base64,'+Buffer.from(source).toString('base64')+'#'+(++n);
  try {await import(code)} finally {delete globalThis.__ndbcMock}
  assert.equal(writes.length,1);
  assert.equal(writes[0].path,'./noaa-ndbc-data/latest-observations.csv');
  const [header,...records]=writes[0].val.split('\r\n');
  return {header, records, row:(index=0)=>Object.fromEntries(header.split(',').map((name,i)=>[name,records[index].split(',')[i].replace(/^"|"$/g,'')]))};
}
const check=(v)=>{assert.equal(v.air_temp_degc,'26.2');assert.equal(v.sea_surface_temp_degc,'27.8');assert.equal(v.dewpoint_temp_degc,'20.6');assert.equal(v.pressure_tendency_hpa,'0.4');assert.equal(v.sea_level_pressure_hpa,'1018.5');assert.equal(v.wind_dir_degt,'135');assert.equal(v.station_visibility_nmi,'')};

test('01 current NOAA column order',async()=>check((await convert(fixture())).row()));
test('02 former NOAA column order',async()=>check((await convert(fixture(older))).row()));
test('03 all 14 measurements map by field names',async()=>{const v=(await convert(fixture(order,{VIS:'3.0',TIDE:'2.0'}))).row();assert.equal(v.station_visibility_nmi,'3');assert.equal(v.water_level_ft,'2');assert.equal(v.gust_speed_mps,'8')});
test('04 deterministic 40 nontrivial field permutations',async()=>{for(let i=0;i<40;i++){let p=[...order];for(let j=13;j>0;j--){const k=(i*17+j*13)%(j+1);[p[j],p[k]]=[p[k],p[j]]}check((await convert(fixture(p))).row())}});
test('05 extra whitespace and tab separators',async()=>check((await convert(fixture().replaceAll(' ','   \t'))).row()));
test('06 CRLF source',async()=>check((await convert(fixture().replaceAll('\n','\r\n'))).row()));
test('07 UTF8 BOM before header',async()=>check((await convert('\uFEFF'+fixture())).row()));
test('08 blank space and BOM before header',async()=>check((await convert(' \t\uFEFF'+fixture())).row()));
test('09 leading whitespace before #STN header',async()=>check((await convert('    '+fixture())).row()));
test('10 leading blank/comment lines',async()=>check((await convert('\n  \n# data\n'+fixture())).row()));
test('11 trailing blank lines',async()=>check((await convert(fixture()+'\n \n\t')).row()));
test('12 two stations preserve timestamps and orders',async()=>{let txt=fixture();let line='ABC02 0.0 5.0 2026 10 17 21 00 '+order.map(k=>values[k]).join(' ');let v=await convert(txt+'\n'+line);assert.equal(v.records.length,2);assert.equal(v.row(1).station_id,'ABC02')});
test('13 zero reading is not missing',async()=>{let v=(await convert(fixture(order,{WSPD:'0.0',PTDY:'0.0'}))).row();assert.equal(v.wind_speed_mps,'0');assert.equal(v.pressure_tendency_hpa,'0')});
test('14 missing marker MM omits correct field',async()=>{let v=(await convert(fixture(order,{PTDY:'MM',ATMP:'23.4'}))).row();assert.equal(v.pressure_tendency_hpa,'');assert.equal(v.air_temp_degc,'23.4')});
test('15 historical 999 marker omitted',async()=>{let v=(await convert(fixture(order,{PRES:'999'}))).row();assert.equal(v.sea_level_pressure_hpa,'')});
test('16 malformed field count (short) rejected',async()=>await assert.rejects(convert(fixture().replace(/\sMM$/, '')),/field count/));
test('17 malformed field count (extra) rejected',async()=>await assert.rejects(convert(fixture()+' extra'),/field count/));
test('18 missing source header rejected',async()=>await assert.rejects(convert(fixture().split('\n').slice(2).join('\n')),/header #STN was not found/));
test('19 duplicate field header rejected',async()=>await assert.rejects(convert(fixture().replace('PTDY  ATMP','PTDY  PTDY').replace('PTDY ATMP','PTDY PTDY')),/duplicate|header structure/));
test('20 unknown field header rejected',async()=>await assert.rejects(convert(fixture().replace('PTDY  ATMP','XTDY  ATMP').replace('PTDY ATMP','XTDY ATMP')),/Unknown/));
test('21 removed required header field rejected',async()=>await assert.rejects(convert(fixture().replace(' PTDY ATMP',' ATMP')),/header structure/));
test('22 unexpected station/time header rejected',async()=>await assert.rejects(convert(fixture().replace('#STN LAT',' #STN LAX')),/header structure/));
test('23 new header column rejected instead of shifting',async()=>await assert.rejects(convert(fixture().replace('PTDY ATMP','PTDY NEW ATMP')),/header structure/));
test('24 full 27-column downstream CSV schema preserved',async()=>{let o=await convert(fixture());assert.equal(o.header.split(',').length,27);assert.equal(o.header.split(',')[8],'air_temp_degc');assert.equal(o.header.split(',')[12],'pressure_tendency_hpa');assert.equal(o.header.split(',')[26],'timestamp')});
test('25 station metadata still joins',async()=>{const node={getAttr:key=>({id:'41004',lat:'32.502',lon:'-79.099',elev:'10',name:'Test Buoy',owner:'NOAA'}[key]??'')};const v=(await convert(fixture(),[node])).row();assert.equal(v.station_elev,'10');assert.equal(v.station_name,'Test Buoy')});

test('26 prototype property not accepted as field name',async()=>await assert.rejects(convert(fixture().replace('PTDY ATMP','toString ATMP')),/Unknown/));
