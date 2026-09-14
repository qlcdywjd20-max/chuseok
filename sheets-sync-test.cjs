const fs=require('fs'),vm=require('vm'),assert=require('assert');
const app=fs.readFileSync(__dirname+'/app.js','utf8');
let requests=0,reply,fail=false,delayResolve,waiting=false;
const ctx={__TEST__:true,URL,URLSearchParams,Date,console,AbortController,setTimeout,clearTimeout,confirm:()=>true,document:{getElementById:()=>({value:''})},localStorage:{getItem:()=>null,setItem:()=>{}},DEFAULT_BANK:Array.from({length:29},(_,i)=>({id:i+1,type:'chuseok',enabled:true})),fetch:async(url,options)=>{requests++;assert.equal(options.cache,'no-store');assert(new URL(url).searchParams.has('_fresh'));if(waiting)await new Promise(r=>delayResolve=r);if(fail)throw Error('offline');return {ok:true,text:async()=>reply};}};
vm.createContext(ctx);vm.runInContext(app,ctx);
vm.runInContext("hasControl=()=>true;render=()=>{};renderControl=()=>{};tone=()=>{};publish=async()=>{};S=fresh();S.screen='board';",ctx);
function csv(rows){return [['칸번호','유형','제목','문제','보기1','보기2','보기3','보기4','정답','미션내용','제한시간','사용여부','점수'],...rows].map(r=>r.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\r\n');}
const rows=[[19,'쏜다!','쏜다','','','','','','','함께 노래',30,true,30],[4,'노래퀴즈','노래','제목은?','제목은?','','','','사랑의 배터리','',30,true,20],[1,'추석퀴즈','추석','수정 문제','떡국','팥빙수','붕어빵','송편',4,'',30,true,20]];
(async()=>{
reply=csv(rows);await vm.runInContext('refreshBank({auto:true})',ctx);
vm.runInContext("assert=undefined;",ctx);const read=x=>JSON.parse(vm.runInContext('JSON.stringify('+x+')',ctx));
assert.equal(read('S.bank[0].answer'),'송편');assert.equal(read('S.bank[18].type'),'shot');assert.equal(read('S.bank[3].quizKind'),true);assert.equal(read('S.bank[3].choices.length'),0);assert.equal(read('S.bank[1].enabled'),false);assert.equal(read('S.bank.length'),29);
vm.runInContext("S.card=clone(S.bank[0]);S.screen='question';startTimer(30);S.scores=[10,20,30];S.successes=[1,2,3];",ctx);
const deadline=read('S.timer.deadline');rows[2][3]='시트에서 바꾼 새 문제';rows[2][8]=1;rows[2][12]=25;reply=csv(rows);
await vm.runInContext('refreshBank({auto:true})',ctx);assert.equal(read('S.card.question'),'시트에서 바꾼 새 문제');assert.equal(read('S.card.answer'),'떡국');assert.equal(read('S.card.points'),25);assert.equal(read('S.timer.deadline'),deadline);assert.deepEqual(read('S.scores'),[10,20,30]);
rows[2][0]=19;reply=csv(rows);const bank=read('S.bank');await vm.runInContext('refreshBank({auto:true})',ctx);assert.deepEqual(read('S.bank'),bank);assert(read('bankMessage').includes('중복'));rows[2][0]=1;
fail=true;await vm.runInContext('refreshBank({auto:true})',ctx);assert.deepEqual(read('S.bank'),bank);assert(read('bankMessage').includes('마지막 문제'));fail=false;
// Scored questions stay frozen; the next visit gets the edited row.
vm.runInContext('S.scored=true',ctx);rows[2][3]='다음 도전용';reply=csv(rows);await vm.runInContext('refreshBank({auto:true})',ctx);assert.equal(read('S.card.question'),'시트에서 바꾼 새 문제');assert.equal(read('S.bank[0].question'),'다음 도전용');
// Single-flight network request; reset during loading cannot restore the old game.
waiting=true;const n=requests;const a=vm.runInContext('refreshBank({auto:true})',ctx),b=vm.runInContext('refreshBank({auto:true})',ctx);assert.equal(requests,n+1);vm.runInContext('S=fresh()',ctx);delayResolve();await Promise.all([a,b]);assert.equal(read('S.screen'),'start');assert.equal(read('S.bankAt'),null);waiting=false;
// A failed check does not block game start; pause during a check cancels transition.
fail=true;await vm.runInContext("dispatch('start')",ctx);assert.equal(read('S.screen'),'opening');fail=false;waiting=true;
vm.runInContext("S=fresh();S.screen='board';S.flow={kind:'arrival',due:Date.now()};S.players[1].path=['S',1]",ctx);
const pending=vm.runInContext('advanceFlow()',ctx);vm.runInContext('pauseAll()',ctx);delayResolve();await pending;assert.equal(read('S.screen'),'board');assert.equal(read('S.paused'),true);assert.equal(read('S.flow.kind'),'arrival');
console.log('PASS: live sheet structure, free-text song, shot, fixed 29 IDs, changed active question/answer/points, preserved timer/scores, invalid/offline fallback, scored snapshot, single-flight/reset/pause races.');
})().catch(e=>{console.error(e);process.exitCode=1});
