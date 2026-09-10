const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=__dirname,js='const DEFAULT_BANK='+fs.readFileSync(path.join(root,'board-data.json'),'utf8')+';'+fs.readFileSync(path.join(root,'app.js'),'utf8');
const context={__TEST__:true,assert,console,setTimeout:f=>{f();return 0},clearTimeout(){},confirm:()=>true,document:{getElementById:()=>({value:'1'}),querySelectorAll:()=>[]},localStorage:{getItem:()=>null,setItem(){}},Date,crypto:require('crypto').webcrypto};vm.createContext(context);vm.runInContext(js,context);
(async()=>{await vm.runInContext(`(async()=>{
authority=true;hasControl=()=>true;render=()=>{};renderControl=()=>{};updateClock=()=>{};tone=()=>{};publish=()=>{};
assert.equal(Object.keys(coords).length,30);assert.equal(new Set(Object.values(coords).map(c=>c.join(','))).size,30);
const p={path:['S']};for(let n=1;n<=29;n++){p.path.push(nextStep(p));assert.equal(position(p),n);}assert.equal(nextStep(p),'S');
for(let n=1;n<=29;n++)assert.equal(position({path:canonical(n)}),n);assert.throws(()=>canonical(30));
S=fresh();S.screen='board';S.players[0].path=canonical(5);S.players[1].path=canonical(9);await roll(4);assert.equal(position(S.players[0]),9);assert.equal(position(S.players[1]),9);assert.equal(S.extra,false);assert.equal(S.dice.value,4);dispatch('undo');assert.equal(position(S.players[0]),5);
S=fresh();S.screen='board';S.players[0].path=canonical(28);await roll(4);assert.equal(position(S.players[0]),2);dispatch('undo');assert.equal(position(S.players[0]),28);
S=fresh();S.screen='board';await roll(6);assert.equal(position(S.players[0]),6);assert.equal(S.phase,'next');assert.equal(S.extra,false);
const legacy={...fresh(),diceVersion:undefined,scores:[120,100,140],players:[{path:['S',12,11]},{path:['S',5]},{path:['S','F']}]};const migrated=normalizeState(legacy);assert.deepEqual(migrated.scores,[120,100,140]);assert.equal(position(migrated.players[0]),11);assert.equal(migrated.screen,'start');assert.equal(migrated.bank.length,29);
S=fresh();S.card=clone(DEFAULT_BANK[0]);S.screen='intro';openContent();assert.equal(S.screen,'question');assert.equal(seconds(),20);timerAction('pause');assert(!S.timer.running);timerAction('add');assert(seconds()>=29);timerAction('restart');assert(S.timer.running);timerAction('end');assert.equal(S.screen,'camera');S.cameraUntil=Date.now()-1;tick();assert.equal(S.screen,'question');assert.notEqual(S.screen,'answer');dispatch('answer');assert.equal(S.screen,'answer');applyScore(true);assert.equal(S.scores[0],10);applyScore(true);assert.equal(S.scores[0],10);dispatch('undo');assert.equal(S.scores[0],0);
for(const [type,n] of [['mission',20],['chance',30],['golden',50]]){S=fresh();S.card={type};applyScore(true);assert.equal(S.scores[0],n);assert.equal(S.scores[1],0);}
S=fresh();S.card={type:'memory',points:40};applyScore(true);assert.equal(S.scores[0],40);dispatch('scoreDelta','0:-10');assert.equal(S.scores[0],30);
S=fresh();S.screen='board';S.completed=28;S.roundOpen=true;finishContent();assert.equal(S.screen,'finale');assert.equal(S.completed,29);assert(showHTML().includes('1위'));dispatch('reset');assert.equal(S.screen,'start');assert.deepEqual(S.scores,[0,0,0]);
const bank=validateBank(DEFAULT_BANK);assert.equal(bank.length,29);assert.throws(()=>validateBank([DEFAULT_BANK[0],DEFAULT_BANK[0]]));
const row={'칸번호':2,'유형':'건강상식','문제':'질문','보기1':'가','보기2':'나','정답':2,'사용여부':true,'배점':30};assert.equal(validateBank([row])[0].answer,'나');assert.equal(validateBank([row])[0].points,30);assert.equal(validateBank([{'칸번호':4,'유형':'몸으로 말해요','미션내용':'몸짓 미션'}])[0].points,20);
for(let i=0;i<100;i++){const n=randomDie();assert(n>=1&&n<=6);}
for(const screen of ['start','board','intro','question','camera','answer','mission','chance','finale']){S=fresh();S.screen=screen;S.card=clone(DEFAULT_BANK[0]);assert.equal(typeof showHTML(),'string');assert(!showHTML().includes('data-action'));}
})()`,context);console.log('PASS: 30 perimeter positions, sequential wrap, dice 1–6, no capture/extra, legacy data preservation, 20s timer/manual answer, scoring/undo, Sheets points, automatic finale, audience-only content.');})().catch(e=>{console.error(e);process.exitCode=1});
