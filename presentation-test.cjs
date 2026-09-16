const fs=require('fs'),vm=require('vm'),assert=require('assert');const c={__TEST__:true,assert,console,Date,URL,URLSearchParams,crypto:require('crypto').webcrypto,confirm:()=>true,document:{getElementById:()=>({value:''})},DEFAULT_BANK:[{id:1,type:'chuseok',enabled:true,question:'Q',answer:'A',choices:['A','B'],points:20,duration:20}]};vm.createContext(c);vm.runInContext(fs.readFileSync(__dirname+'/app.js','utf8'),c);
vm.runInContext(`hasControl=()=>true;render=()=>{};renderControl=()=>{};publish=()=>{};S=fresh();S.card=clone(DEFAULT_BANK[0]);S.screen='question';startTimer();endTimer();assert.equal(S.screen,'question');assert.equal(S.flow,null);assert(S.timer.ended);dispatch('camera');assert.equal(S.screen,'camera');assert.equal(S.flow,null);dispatch('answer');assert.equal(S.screen,'answer');
beginFinale();assert.equal(S.screen,'finalWait');assert.equal(S.flow,null);let h=showHTML();assert(h.includes('노래 메들리'));assert(!h.includes('podium'));nextStage();assert.equal(S.screen,'finalWait');dispatch('finalReveal');assert.equal(S.screen,'finale');assert.equal(S.flow,null);assert(showHTML().includes('최종 합산 점수'));
S=fresh();S.scores=[45,80,25];S.screen='board';dispatch('finalReveal');assert.equal(S.screen,'finale');assert(showHTML().includes('복지관팀입니다!'));assert.deepEqual(S.scores,[45,80,25]);assert.equal(S.audioCue.kind,'fanfare');
S.scores=[80,80,25];assert(showHTML().includes('공동 MVP는'));
S.screen='question';S.busy=true;S.timer={running:true};S.flow={kind:'next',due:0};dispatch('finalReveal');assert.equal(S.timer,null);assert.equal(S.flow,null);assert.equal(S.busy,false);
// Audio lifecycle and duplicate events are exercised in audio-test.cjs.

`,c);console.log('PASS: manual board/answer reveal, held medley, manual final scores, manual presentation transitions.');
