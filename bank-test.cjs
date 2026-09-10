const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');const c={__TEST__:true,assert,URL,URLSearchParams,Date,console,document:{},DEFAULT_BANK:JSON.parse(fs.readFileSync(path.join(__dirname,'board-data.json')))};vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'app.js'),'utf8'),c);
vm.runInContext(String.raw`
assert.equal(bankRequestUrl('https://docs.google.com/spreadsheets/d/abc/edit#gid=123').url,'https://docs.google.com/spreadsheets/d/abc/export?format=csv&gid=123');
assert.equal(bankRequestUrl('https://script.google.com/macros/s/abc/exec').csv,false);
assert.throws(()=>bankRequestUrl('https://example.com/data'));assert.throws(()=>bankRequestUrl('http://docs.google.com/spreadsheets/d/abc/edit'));
const headers=['칸번호','유형','제목','문제','보기1','보기2','보기3','보기4','정답','미션내용','제한시간','사용여부','배점'];
const row=[1,'스마트경로당퀴즈','제목','쉼표, 따옴표 "와"\n줄바꿈','첫째','둘째','','',2,'',20,'TRUE',''];
const csv=[headers,row].map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n');
const bank=validateBank(parseBankCsv(csv));assert.equal(bank[0].question,row[3]);assert.equal(bank[0].answer,'둘째');assert.equal(bank[0].points,10);assert.equal(bank[0].type,'smart');assert.throws(()=>parseBankCsv('bad,header\n1,2'));assert.throws(()=>parseBankCsv('"not closed'));
`,c);console.log('PASS: Sheets URL restrictions, gid, Apps Script, CSV quoting/newlines, smart quiz and optional points.');

