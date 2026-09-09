const fs=require('fs'),vm=require('vm'),assert=require('assert');
const context={URL,URLSearchParams,console,assert};vm.createContext(context);
vm.runInContext('const DEFAULT_BANK='+fs.readFileSync(__dirname+'/board-data.json','utf8')+';'+fs.readFileSync(__dirname+'/app.js','utf8'),context);
function checks(){
  const headers=['칸번호','유형','제목','문제','보기1','보기2','보기3','보기4','정답','미션내용','제한시간','사용여부'];
  const fields=['3','스마트경로당퀴즈','우리, 스마트경로당','몇 개소가 함께할까요?','20','30','40','50','4','','30','TRUE'];
  const csv=[headers,fields].map(row=>row.map(v=>'"'+v.replaceAll('"','""')+'"').join(',')).join('\r\n');
  const result=validateBank(parseBankCsv(csv));
  assert.equal(result[0].type,'smart');assert.equal(result[0].answer,'50');assert.equal(result[0].title,'우리, 스마트경로당');
  fields[1]='팀미션';fields[3]='';fields.fill('',4,9);fields[9]='첫 줄\n"함께" 해요';
  const missionCsv=[headers,fields].map(row=>row.map(v=>'"'+v.replaceAll('"','""')+'"').join(',')).join('\r\n');
  assert.equal(validateBank(parseBankCsv(missionCsv))[0].prompt,'첫 줄\n"함께" 해요');
  assert.throws(()=>parseBankCsv('wrong,header\n1,2'),/필수 열/);
  assert.throws(()=>bankRequestUrl('https://example.com/spreadsheets/d/abc/edit'));
  assert.throws(()=>bankRequestUrl('http://docs.google.com/spreadsheets/d/abc/edit'));
  assert.equal(bankRequestUrl('https://docs.google.com/spreadsheets/d/abc/edit#gid=12').url,'https://docs.google.com/spreadsheets/d/abc/export?format=csv&gid=12');
  assert.equal(bankRequestUrl('https://script.google.com/macros/s/abc/exec?x=1').csv,false);
}
vm.runInContext('('+checks.toString()+')()',context);
if(process.argv[2]){
  context.csv=fs.readFileSync(process.argv[2],'utf8');
  const rows=vm.runInContext('validateBank(parseBankCsv(csv))',context);
  assert.equal(rows.length,29);
  console.log('Actual sheet: 29 rows validated; question 2:',rows[1].question,'question 3 type:',rows[2].type);
}
console.log('PASS: smart category, CSV commas/quotes/newlines, sheet tab URL, Apps Script compatibility, invalid source rejection.');
Object.assign(context,{setTimeout,clearTimeout,AbortController,fetch:async()=>{},document:{getElementById:()=>({value:'https://docs.google.com/spreadsheets/d/abc/edit'})},localStorage:{setItem(){},getItem(){return null;}}});
async function refreshChecks(){
  S=fresh();S.screen='board';hasControl=()=>true;renderControl=()=>{};saveHistory=()=>{};
  let writes=0;publish=async()=>{await new Promise(resolve=>setTimeout(resolve,5));writes++;};
  const before=JSON.stringify(S.bank);
  fetch=async()=>({ok:true,text:async()=>'<html>Sign in</html>'});
  await refreshBank();assert.equal(JSON.stringify(S.bank),before);assert.equal(writes,0);assert.match(bankMessage,/로그인/);
  fetch=async()=>({ok:true,text:async()=>JSON.stringify({error:'wrong tab'})});
  await refreshBank();assert.equal(JSON.stringify(S.bank),before);assert.equal(writes,0);
  const headers='칸번호,유형,제목,문제,보기1,보기2,보기3,보기4,정답,미션내용,제한시간,사용여부';
  fetch=async()=>({ok:true,text:async()=>headers+'\n3,스마트경로당퀴즈,함께해요,몇 개소?,20,30,40,50,4,,30,TRUE'});
  await refreshBank();assert.equal(writes,1);assert.equal(S.bank[2].type,'smart');assert.equal(S.bank[2].answer,'50');
  assert.equal(S.bank[0].enabled,false);assert.equal(S.bankSource,'https://docs.google.com/spreadsheets/d/abc/edit');
  assert.match(bankMessage,/반영 완료/);assert.equal(fetching,false);
}
vm.runInContext('('+refreshChecks.toString()+')()',context).then(()=>console.log('PASS: failed imports preserve bank; valid import saves source, waits for publish, and disables missing cells.')).catch(error=>{console.error(error);process.exitCode=1;});
