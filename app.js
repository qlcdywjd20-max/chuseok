'use strict';
// Team indices are stable: existing database scores keep belonging to the same team.
const TEAMS=[{name:'동대문구청팀',count:16,color:'#4d9fde',ink:'#134c79'},{name:'복지관팀',count:16,color:'#edb444',ink:'#74430f'},{name:'동대문구지회팀',count:18,color:'#55a678',ink:'#20593b'}], TEAM_ORDER=[1,0,2];
const CATS={smart:['스마트퀴즈','#f0d78f','📺',10],chuseok:['추석퀴즈','#a9cbee','🌕',10],town:['우리동네퀴즈','#a9cbee','🏘️',10],memory:['추억퀴즈','#f0d78f','📻',10],health:['건강상식','#f0d78f','🌿',10],song:['노래퀴즈','#9edfee','♪',15],gesture:['몸으로 말해요','#a8cdb3','🙌',15],mission:['팀미션','#a8d5b3','👏',15],chance:['찬스','#efd17a','✦',20],special:['찬스','#efd17a','✦',20],golden:['보너스','#e6aaa0','🎁',50],bonus:['보너스','#e6aaa0','🎁',50],cheer:['응원미션','#cbb2e8','👏',20]};
CATS.reverse=['역전칸!','#e6aaa0','✦',50];
CATS.shot=['쏜다!','#efb684','🎤',30];
const TYPES={'역전칸!':'reverse','역전칸':'reverse','스마트경로당퀴즈':'smart','추석퀴즈':'chuseok','우리동네퀴즈':'town','추억퀴즈':'memory','건강상식':'health','건강퀴즈':'health','쏜다!':'shot','쏜다':'shot','단체미션':'mission','일반퀴즈':'chuseok','노래':'song','노래퀴즈':'song','노래한소절':'song','몸으로말해요':'gesture','몸짓':'gesture','미션':'mission','팀미션':'mission','찬스':'chance','복주머니찬스':'chance','특별찬스':'special','골든미션':'golden','보너스':'bonus','응원전':'cheer','응원미션':'cheer'};
const KEYS={api:'onmaeul.api.v3',bank:'onmaeul.bank.v3'};
const clone=o=>JSON.parse(JSON.stringify(o)),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])), $=id=>document.getElementById(id);
const fresh=()=>({version:3,diceVersion:1,communityVersion:1,successes:[0,0,0],paused:false,pausedAt:null,flow:null,dieInput:null,openingIndex:0,finaleIndex:0,players:TEAMS.map(()=>({path:['S']})),scores:[0,0,0],selected:1,screen:'start',at:Date.now(),phase:'ready',busy:false,passed:[],notice:'',card:null,timer:null,scored:false,outcome:null,extra:false,sound:true,bgmOn:true,bgmVolume:.12,bank:clone(DEFAULT_BANK),bankAt:null,dice:null,completed:0,totalTurns:29,turnAt:0,scoreFx:null,chanceApplied:false,roundOpen:false});
let S=fresh(),history=[],authority=false,mode='control',owner='',lastScreen='',lastBank='',lastClock=-1,ctx=null,apiMessage='',fetching=false,storageOK=true;
// 30 perimeter squares: START + 29 existing question IDs. No interior routes.
const coords={S:[1475,650]};let cellId=1;
for(let r=5;r>=0;r--)coords[cellId++]=[1475,50+r*100];
for(let c=8;c>=0;c--)coords[cellId++]=[125+c*150,50];
for(let r=1;r<=6;r++)coords[cellId++]=[125,50+r*100];
for(let c=1;c<=8;c++)coords[cellId++]=[125+c*150,650];
const position=p=>p.path.at(-1),isQuiz=c=>!!(c?.quizKind||c?.isQuiz||c?.choices?.length||c?.question&&c?.answer),category=c=>CATS[c?.type]||CATS.mission;
const pointsFor=c=>Number.isFinite(c?.points)?c.points:category(c)[3]; // 시트의 점수/배점이 최우선입니다.
function canonical(id){if(id==='S'||id===0||id==='0')return ['S'];const n=Number(id);if(!Number.isInteger(n)||n<1||n>29)throw Error('위치는 출발 또는 1~29번입니다.');return ['S',...Array.from({length:n},(_,i)=>i+1)];}
function nextStep(p){const at=position(p);return at==='S'?1:at===29?'S':Number(at)+1;}
// Read legacy state without resetting scores or replacing the saved question bank.
function normalizeState(raw){const s={...fresh(),...clone(raw)};s.bank=(s.bank||DEFAULT_BANK).map(c=>({...c,choices:c.choices||[],points:c.points??category(c)[3]}));if(!s.diceVersion){s.diceVersion=1;s.players=s.players.map(p=>({path:canonical(position(p)==='F'?'S':position(p))}));s.screen='start';s.timer=null;s.card=null;s.busy=false;s.phase='ready';s.extra=false;s.dice=null;s.completed=0;s.roundOpen=false;}if(!raw?.communityVersion){s.communityVersion=1;s.successes=[0,0,0];s.paused=false;s.flow=null;s.busy=false;s.dice=null;s.timer=null;s.card=null;s.screen='start';s.phase='ready';s.roundOpen=false;s.selected=1;s.notice='기존 획득 점수는 보존했습니다. 성공 횟수는 담당자가 확인해 주세요.';}s.successes=(s.successes||[0,0,0]).map(n=>Math.max(0,Number(n)||0));if(s.screen==='intro'){s.flow=null;s.timer=null;}if(s.screen==='camera'&&s.flow?.kind==='answer')s.flow=null;if(['finalWait','finale'].includes(s.screen)){s.flow=null;s.finaleIndex=4;}s.communityAchieved=false;s.totalTurns=Math.max(1,Math.min(999,Number(s.totalTurns)||29));return s;}
function safeRead(k){try{return JSON.parse(localStorage.getItem(k));}catch{return null;}}
function safeWrite(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch{storageOK=false;}}
function hasControl(){return authority;}
function saveHistory(){}
function pushHistory(){const s=clone(S);s.checkpointAt=gameNow();if(s.timer?.running){s.timer.remaining=Math.max(0,s.timer.deadline-gameNow());}history.push(s);if(history.length>80)history.shift();saveHistory();}
function publish(){render();}
function setScreen(screen){S.screen=screen;S.at=gameNow();}
function seconds(t=S.timer,now=(S.paused?S.pausedAt:Date.now())){return t?Math.max(0,Math.ceil((t.running?t.deadline-now:t.remaining)/1000)):0;}
function playTone(kind){if(!S.sound&&kind!=='unlock')return;try{ctx??=new (window.AudioContext||window.webkitAudioContext)();if(ctx.state==='suspended')ctx.resume();if(kind==='unlock')return;const notes={test:[523,659,784,1047],step:[660],dice:[330,440,550],intro:[330,440,660],count:[880],end:[440,330],answer:[523,659,784,1047],special:[392,523,659,784],golden:[523,659,784,1047,1319],finish:[523,659,784,1047,784,1047]}[kind]||[660];notes.forEach((hz,i)=>{const start=ctx.currentTime+i*.12,osc=ctx.createOscillator(),gain=ctx.createGain();osc.type=kind==='step'?'sine':'triangle';osc.frequency.setValueAtTime(hz,start);gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.09,start+.01);gain.gain.exponentialRampToValueAtTime(.001,start+.16);osc.connect(gain);gain.connect(ctx.destination);osc.start(start);osc.stop(start+.18);});}catch{}}
let festivalAudio=null,localAudioEnabled=false;
function enableLocalSound(){localAudioEnabled=true;festivalAudio??=createFestivalAudio({document,window,fallback:playTone});festivalAudio.mount();festivalAudio.update(S);festivalAudio.unlock();}
function tone(kind){if(!hasControl()||!S.sound)return;S.audioCue={id:crypto.randomUUID(),kind,at:Date.now()};}
function receiveSound(){if((mode!=='display'&&!localAudioEnabled)||typeof createFestivalAudio==='undefined')return;festivalAudio??=createFestivalAudio({document,window,fallback:playTone});festivalAudio.mount();festivalAudio.update(S);}
function randomDie(){const a=new Uint32Array(1);do{crypto.getRandomValues(a);}while(a[0]>=4294967292);return a[0]%6+1;}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
// All transitions are persisted; there are no uninterruptible sleep-based moves.
function gameNow(){return S.paused?S.pausedAt:Date.now();}
function flowTo(kind,delay=0){S.flow={kind,due:gameNow()+delay};}
function roll(steps,correction=false){
 if(!hasControl()||S.busy||S.paused||S.screen!=='board'||(!correction&&S.phase!=='ready'))return;
 if(!Number.isInteger(steps)||(!correction&&(steps<1||steps>6)))return;
 if(correction&&steps<0&&S.players[S.selected].path.length<2)return;
 pushHistory();S.busy=true;S.card=null;S.timer=null;S.passed=[];S.notice='';S.scored=false;S.outcome=null;
 S.move={left:Math.abs(steps),direction:Math.sign(steps),correction};
 if(correction){flowTo('move',0);}else{S.roundOpen=true;S.dice={value:steps,rollingUntil:Date.now()+1200,showUntil:Date.now()+2200};flowTo('move',2200);tone('dice');}publish();
}
function pauseAll(){if(S.paused)return;S.paused=true;S.pausedAt=Date.now();publish();}
function resumeAll(){if(!S.paused)return;const dt=Date.now()-S.pausedAt;for(const k of ['at','cameraUntil','arrivalUntil','turnAt'])if(S[k])S[k]+=dt;if(S.flow)S.flow.due+=dt;if(S.timer?.running)S.timer.deadline+=dt;if(S.dice){S.dice.rollingUntil+=dt;S.dice.showUntil+=dt;}if(S.scoreFx)S.scoreFx.at+=dt;S.paused=false;S.pausedAt=null;publish();}
function advanceFlow(){const f=S.flow;if(!f)return;pushHistory();S.flow=null;
 if(f.kind==='move'){const p=S.players[S.selected];if(S.move.left>0){if(S.move.direction<0)p.path.pop();else p.path.push(nextStep(p));S.move.left--;S.passed=[position(p)];tone('step');flowTo('move',540);}else{S.busy=false;S.phase=S.move.correction?'ready':'next';S.notice='도착!';S.arrivalUntil=Date.now()+1000;if(!S.move.correction)flowTo('arrival',900);}}
 else if(f.kind==='arrival'){const at=position(S.players[S.selected]);S.card=clone(S.bank.find(c=>c.id===at&&c.enabled)||null);S.chanceApplied=false;if(S.card){setScreen('intro');tone(['golden','bonus'].includes(S.card.type)?'golden':'intro');S.flow=null;}else{S.notice='쉬어가는 칸입니다. 다음 팀도 함께 응원해요!';flowTo('finish',1600);}}
 else if(f.kind==='content'){S.flow=null;} // 문제 공개는 담당자가 직접 누릅니다.
 else if(f.kind==='chanceReveal'){S.chanceApplied=true;startTimer(S.card.duration||20);tone('special');}
 else if(f.kind==='answer'){S.flow=null;} // 정답은 담당자가 공개합니다.
 else if(f.kind==='finish')finishContent();
 else if(f.kind==='nextTeam'){S.selected=TEAM_ORDER[(TEAM_ORDER.indexOf(S.selected)+1)%3];S.phase='ready';S.card=null;S.timer=null;S.dice=null;S.dieInput=null;S.notice='';S.turnAt=Date.now();setScreen('board');}
 else if(f.kind==='opening'){S.openingIndex++;if(S.openingIndex<5)flowTo('opening',1500);else{S.selected=1;S.phase='ready';setScreen('board');}}
 else if(f.kind==='finale'){S.flow=null;}
 publish();
}
function beginFinale(){S.timer=null;S.busy=false;S.dice=null;S.finaleIndex=0;S.card=null;S.flow=null;setScreen('finalWait');tone('intro');}

function startTimer(duration=20){S.timer={startedAt:gameNow(),duration,remaining:duration*1000,deadline:gameNow()+duration*1000,running:true,ended:false,kind:'quiz'};lastClock=-1;}
function endTimer(){if(!S.timer||S.timer.ended)return;S.timer.running=false;S.timer.remaining=0;S.timer.ended=true;S.flow=null;tone('end');publish();}
function timerAction(a){if(!S.timer)return;S.flow=null;const t=S.timer;if(a==='pause'&&t.running){t.remaining=Math.max(0,t.deadline-gameNow());t.running=false;}if(a==='start'&&!t.ended&&!t.running){t.deadline=gameNow()+t.remaining;t.running=true;}if(a==='restart'){setScreen(isQuiz(S.card)?'question':'mission');startTimer(t.duration);}if(a==='add'){t.remaining=(t.running?Math.max(0,t.deadline-gameNow()):t.remaining)+10000;t.deadline=gameNow()+t.remaining;t.duration=Math.max(t.duration,t.remaining/1000);t.ended=false;if(S.screen==='camera')setScreen('question');}if(a==='end')endTimer();publish();}
function openContent(){if(!S.card)return;S.flow=null;if(['chance','special'].includes(S.card.type)){setScreen('chance');S.chanceApplied=false;flowTo('chanceReveal',1600);tone('special');}else if(isQuiz(S.card)){setScreen('question');startTimer(S.card.duration||20);}else{setScreen('mission');startTimer(S.card.duration||20);}publish();}
function changeScore(i,delta){S.scores[i]=Math.max(-9999,Math.min(9999,S.scores[i]+delta));S.scoreFx={team:i,delta,at:gameNow()};}
function applyScore(success){if(S.scored||!S.card||!['answer','mission','chance'].includes(S.screen))return;S.timer&&(S.timer.running=false);pushHistory();S.scored=true;S.outcome=success?'success':'soft';if(success){changeScore(S.selected,pointsFor(S.card));S.successes[S.selected]++;S.communityAchieved=false;tone('success');}S.at=gameNow();flowTo('finish',S.communityAchieved?4000:2400);publish();}
function finishContent(){if(!S.roundOpen&&S.screen==='turn')return;pushHistory();if(S.roundOpen){S.completed++;S.roundOpen=false;}S.timer=null;S.outcome=null;S.communityAchieved=false;S.dice=null;S.busy=false;if(S.completed>=S.totalTurns){beginFinale();}else{setScreen('turn');flowTo('nextTeam',2600);}publish();}
function nextStage(){if(S.flow){advanceFlow();return;}if(S.screen==='start'){dispatch('start');return;}if(S.screen==='intro'){openContent();return;}if(['question','camera'].includes(S.screen)){S.flow=null;S.timer&&(S.timer.running=false);setScreen('answer');tone('answer');publish();return;}if(S.screen==='chance'&&!S.chanceApplied){S.chanceApplied=true;publish();return;}if(['answer','mission','chance'].includes(S.screen)){if(!S.scored&&!confirm('미판정 문제를 0점으로 건너뛰고 다음 팀으로 진행할까요?'))return;finishContent();}}

function dispatch(a,v){if(!hasControl())return;
 if(a==='bgmToggle'){S.bgmOn=S.bgmOn===false;if(S.bgmOn)S.bgmStarted=true;publish();return;}if(a==='bgmVolume'){const n=Number($('bgmVolumeInput').value);if(Number.isFinite(n)){S.bgmVolume=Math.max(0,Math.min(100,n))/100;publish();}return;}if(['applause','fanfare','soundStop'].includes(a)){tone(a);publish();return;}if(a==='successTest'){tone('successTest');publish();return;}
 if(a==='pauseAll'){pauseAll();return;}if(a==='resumeAll'){resumeAll();return;}
 if(a==='previous'){if(!history.length)return;const paused=S.paused;S=normalizeState(history.pop());const dt=Date.now()-(S.checkpointAt||Date.now());for(const k of ['at','cameraUntil','arrivalUntil','turnAt'])if(S[k])S[k]+=dt;if(S.dice){S.dice.rollingUntil+=dt;S.dice.showUntil+=dt;}if(S.flow)S.flow.due+=dt;S.paused=paused;S.pausedAt=paused?Date.now():null;if(S.timer?.running)S.timer.deadline=Date.now()+S.timer.remaining;publish();return;}
 if(a==='nextStage'){nextStage();return;}
 if(a==='dieSelect'){if(S.busy)return;S.dieInput=Number(v);publish();return;}
 if(a==='revealDice'){roll(S.dieInput);return;}
 if(a==='replayQuestion'){if(!S.card)return;pushHistory();S.flow=null;S.timer=null;if(isQuiz(S.card)){setScreen('question');startTimer(S.card.duration||20);}else{setScreen('mission');}publish();return;}
 if(a==='replayAnswer'){if(!S.card||!isQuiz(S.card))return;pushHistory();S.flow=null;S.timer=null;setScreen('answer');publish();return;}
 if(a==='scoreDirect'||a==='successDirect'){const i=Number(v),id=(a==='scoreDirect'?'directScore':'directSuccess')+i,n=Number($(id).value);if(!Number.isInteger(n)||Math.abs(n)>9999||a==='successDirect'&&n<0)return;pushHistory();if(a==='scoreDirect')changeScore(i,n-S.scores[i]);else S.successes[i]=n;publish();return;}
 if(S.busy&&!['sound','team','position','reset','opening','finale','finalReveal','scoreDelta','score'].includes(a))return;if(a==='roll'){roll(Number(v));return;}if(a==='random')return; // 실물 주사위만 사용
 if(a==='forward'||a==='back'){roll(a==='forward'?1:-1,true);return;}if(a.startsWith('timer-')){timerAction(a.slice(6));return;}
 switch(a){
 case 'start':pushHistory();S.bgmStarted=true;S.flow=null;S.timer=null;S.card=null;S.dice=null;S.busy=false;S.openingIndex=0;setScreen('opening');flowTo('opening',1500);break;
 case 'board':S.flow=null;S.busy=false;S.timer=null;S.card=null;S.phase='ready';setScreen('board');break;
 case 'opening':pushHistory();S.flow=null;S.busy=false;S.dice=null;S.timer=null;setScreen('start');break;
 case 'team':if(![0,1,2].includes(Number(v)))return;pushHistory();S.flow=null;S.busy=false;S.dice=null;S.selected=Number(v);S.phase='ready';S.card=null;S.timer=null;S.roundOpen=false;setScreen('board');S.turnAt=Date.now();break;
 case 'next':finishContent();return;
 case 'open':openContent();return;
 case 'question':case 'nextQuestion':{const b=S.bank.filter(c=>c.enabled),c=a==='question'?b.find(c=>c.id===Number(v)):b[(b.findIndex(c=>c.id===S.card?.id)+1)%b.length];if(!c)return;pushHistory();S.card=clone(c);S.timer=null;S.scored=false;S.outcome=null;S.roundOpen=true;S.phase='next';S.flow=null;setScreen('intro');S.flow=null;}break;
 case 'camera':if(!S.card||!isQuiz(S.card))return;S.flow=null;if(S.timer){S.timer.running=false;S.timer.remaining=0;S.timer.ended=true;}setScreen('camera');tone('end');break;
 case 'answer':S.flow=null;if(!S.card||!isQuiz(S.card))return;S.timer&&(S.timer.running=false);setScreen('answer');tone('answer');break;
 case 'good':applyScore(true);return;case 'soft':applyScore(false);return;
 case 'complete':finishContent();return;
 case 'chance':if(S.chanceApplied)return;S.flow=null;startTimer(S.card.duration||20);pushHistory();S.chanceApplied=true;S.at=Date.now();tone('special');break;
 case 'scoreDelta':{const [i,n]=String(v).split(':').map(Number);if(![0,1,2].includes(i)||!Number.isFinite(n))return;pushHistory();changeScore(i,n);}break;
 case 'score':{const [i,n]=String(v).split(':').map(Number);if(![0,1,2].includes(i)||!Number.isFinite(n)||Math.abs(n)>9999)return;pushHistory();changeScore(i,n-S.scores[i]);}break;
 case 'position':{const path=canonical(v);pushHistory();S.flow=null;S.busy=false;S.dice=null;S.players[S.selected].path=path;S.phase='ready';S.card=null;S.timer=null;S.roundOpen=false;setScreen('board');}break;
 case 'undo':if(!history.length)return;S=normalizeState(history.pop());S.busy=false;S.flow=null;S.dice=null;S.scoreFx=null;if(S.screen==='camera')S.screen='question';break;
 case 'sound':S.sound=!S.sound;if(S.sound)tone('step');break;
 case 'turns':{const n=Number(v);if(!Number.isInteger(n)||n<1||n>999)return;S.totalTurns=n;}break;
 case 'points':S.notice='배점은 행사 유형별 통일 규칙을 사용합니다.';break;
 case 'legacyPoints':{const n=Number(v);if(!Number.isInteger(n)||n<0||n>999)return;const c=S.bank.find(c=>c.id===Number($('questionChoice').value));if(c)c.points=n;}break;
 case 'finale':pushHistory();beginFinale();break;
 case 'finalReveal':pushHistory();S.flow=null;S.timer=null;S.busy=false;S.dice=null;S.finaleIndex=4;setScreen('finale');tone('fanfare');break;
 case 'audioTest':tone('test');break;
 case 'reset':if(!confirm('모든 말·점수·진행 횟수를 초기화할까요? 문제은행은 유지됩니다.'))return;{const bank=S.bank,bankAt=S.bankAt,sound=S.sound,bgmOn=S.bgmOn,bgmVolume=S.bgmVolume,totalTurns=S.totalTurns;S=fresh();Object.assign(S,{bank,bankAt,sound,bgmOn,bgmVolume,totalTurns});history=[];}break;
 default:return;
 }publish();
}
function validateBank(rows){
 if(!Array.isArray(rows)||!rows.length)throw Error('문제 행이 없습니다.');const seen=new Set;
 return rows.map((r,index)=>{
  const get=(...keys)=>{for(const k of keys)if(Object.hasOwn(r,k))return r[k];};
  const id=Number(get('칸번호','번호','id'));if(!Number.isInteger(id)||id<1||id>29||seen.has(id))throw Error((index+1)+'행: 칸번호는 중복 없이 1~29입니다.');seen.add(id);
  const rawType=String(get('유형','문제유형','type')||'').replace(/\s/g,''),type=TYPES[rawType]||rawType;if(!CATS[type])throw Error(id+'번: 유형을 확인하세요. ('+rawType+')');
  const active=get('사용여부','활성화여부','enabled'),enabled=active===undefined||active===''||active===true||String(active).trim().toUpperCase()==='TRUE';
  const question=String(get('문제','question')||'').trim(),prompt=String(get('미션내용','prompt')||'').trim();
  let choices=(get('choices')||[1,2,3,4].map(n=>get('보기'+n)||'')).map(v=>String(v).trim());
  // 주관식 노래 문제에서 보기1에 안내 문구만 적힌 기존 시트도 허용합니다.
  if(type==='song'&&choices.filter(Boolean).length<2)choices=[];
  let answer=String(get('정답','answer')??'').trim();
  if(choices.some(Boolean)){
   if(/^[①②③④]$/.test(answer))answer=String('①②③④'.indexOf(answer)+1);
   if(/^[1-4](번)?$/.test(answer)){answer=choices[parseInt(answer)-1]||'';}
   choices=choices.filter(Boolean);
   if(enabled&&(choices.length<2||choices.length>4||!choices.includes(answer)))throw Error(id+'번: 보기 2~4개와 올바른 정답을 확인하세요.');
  }else choices=[];
  const quizKind=!!(question&&(choices.length||answer));
  if(enabled&&(!question&&!prompt||choices.length&&!question||question&&!prompt&&!quizKind))throw Error(id+'번: 퀴즈는 문제와 정답, 미션은 미션내용을 입력하세요.');
  const duration=Number(get('제한시간','duration')||20),p=get('점수','배점','points'),points=p==null||String(p).trim()===''?CATS[type][3]:Number(p);
  if(!Number.isFinite(duration)||duration<5||duration>600||!Number.isInteger(points)||points<0||points>999)throw Error(id+'번: 제한시간 5~600초, 점수 0~999를 입력하세요.');
  return {id,type,enabled,question,prompt,choices,answer,quizKind,duration,points,title:String(get('제목','title')||CATS[type][0])};
 });
}
const DEFAULT_BANK_URL='https://docs.google.com/spreadsheets/d/1m2UBLTw6tiayReLXHKPlhr7bGpgReh41PqvKxIQRmt8/edit#gid=0';
let bankMessage='';
function bankRequestUrl(value){
 const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password)throw Error('구글시트 또는 Apps Script의 HTTPS 주소를 입력하세요.');
 const sheet=url.pathname.match(/^\/spreadsheets\/d\/([\w-]+)\/(?:edit|export)?$/);
 if(url.hostname==='docs.google.com'&&sheet){const gid=url.searchParams.get('gid')||new URLSearchParams(url.hash.slice(1)).get('gid')||'0';if(!/^\d+$/.test(gid))throw Error('시트 탭 번호를 확인하세요.');return {url:`https://docs.google.com/spreadsheets/d/${sheet[1]}/export?format=csv&gid=${gid}`,csv:true};}
 if(url.hostname==='script.google.com'&&/^\/macros\/s\/[^/]+\/exec$/.test(url.pathname))return {url:url.href,csv:false};throw Error('구글시트 공유 주소 또는 Apps Script /exec 주소를 입력하세요.');
}
function parseBankCsv(text){
 const table=[];let row=[],cell='',quoted=false;text=text.replace(/^\uFEFF/,'');
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v.trim()))table.push(row);row=[];cell='';}else cell+=c;}
 if(quoted)throw Error('시트 CSV의 따옴표가 닫히지 않았습니다.');row.push(cell);if(row.some(v=>v.trim()))table.push(row);const headers=(table.shift()||[]).map(v=>v.trim());
 for(const h of ['칸번호','유형','제목','문제','보기1','보기2','보기3','보기4','정답','미션내용','제한시간','사용여부'])if(!headers.includes(h))throw Error('필수 열이 없습니다: '+h);
 return table.filter(r=>r[headers.indexOf('칸번호')]?.trim()).map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??''])));
}
// 기존 CSV / Apps Script 가져오기를 공통 사용합니다. 칸번호로만 연결하며 행 순서는 무관합니다.
let bankFlight=null,bankTransition=null,bankCheckedAt=0,viewerBank=null;
// Public viewers only overlay sheet content locally; game state writes still require the admin lease.
function applyViewerBank(){
 if(mode!=='display'||hasControl()||!viewerBank||viewerBank.source!==(S.bankSource||DEFAULT_BANK_URL))return;
 S.bank=clone(viewerBank.rows).map(c=>({...c,answer:''}));
 const c=viewerBank.rows.find(c=>c.id===S.card?.id);
 if(c?.enabled&&!S.scored&&['intro','question','mission','chance','camera','answer'].includes(S.screen))S.card={...clone(c),answer:S.screen==='answer'?c.answer:''};
}

async function refreshBank(options={}){
 const controller=hasControl();
 if(!controller&&(!options.auto||mode!=='display'))return false;
 if(bankFlight)return bankFlight;
 const manual=!options.auto;
 const source=(manual?$('apiUrl')?.value?.trim():null)||S.bankSource||DEFAULT_BANK_URL;
 const originalState=S;
 fetching=true;if(manual){bankMessage='최신 문제은행을 확인하는 중…';renderControl();}
 bankFlight=(async()=>{
  const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),7000);
  try{
   const request=bankRequestUrl(source),url=new URL(request.url);url.searchParams.set('_fresh',Date.now());
   const res=await fetch(url,{signal:abort.signal,credentials:'omit',cache:'no-store'});
   if(!res.ok)throw Error('시트 열람 실패 (응답 '+res.status+')');
   const text=await res.text();if(/^\s*</.test(text))throw Error('로그인 화면을 받았습니다. 시트 공유 권한을 확인하세요.');
   const payload=request.csv?parseBankCsv(text):JSON.parse(text);if(payload.error)throw Error(payload.error);
   const rows=validateBank(payload.rows||payload);
   if(controller&&(!hasControl()||S!==originalState))return false;
   if(!controller&&(hasControl()||source!==(S.bankSource||DEFAULT_BANK_URL)))return false;
   const map=new Map(rows.map(c=>[c.id,c]));
   // 누락된 번호는 쉼터입니다. 고정된 예제 문제를 대신 섞지 않습니다.
   const bank=Array.from({length:29},(_,i)=>map.get(i+1)||{id:i+1,type:S.bank.find(c=>c.id===i+1)?.type||'mission',enabled:false,choices:[],question:'',prompt:'',answer:'',title:'쉼터',duration:20,points:0});
   if(!controller){viewerBank={source,rows:bank};bankCheckedAt=Date.now();applyViewerBank();render();return true;}
   const changed=JSON.stringify(bank)!==JSON.stringify(S.bank)||S.bankSource!==source;
   S.bank=bank;S.bankSource=source;bankCheckedAt=Date.now();
   if(changed){
    S.bankAt=bankCheckedAt;
    // 진행 중 문제도 같은 칸 번호의 최신 문구/정답/유형으로 갱신합니다.
    // 판정 완료 문제는 지급된 점수와 결과를 보존합니다. 타이머는 다시 시작하지 않습니다.
    const c=bank.find(c=>c.id===S.card?.id);
    if(c?.enabled&&!S.scored&&['intro','question','mission','chance','camera','answer'].includes(S.screen)){
     const wasQuiz=isQuiz(S.card);S.card=clone(c);
     if(S.screen!=='intro'&&wasQuiz!==isQuiz(c)){
      S.flow=null;S.screen=isQuiz(c)?(S.screen==='answer'?'answer':'question'):'mission';
     }
    }
    safeWrite(KEYS.api,source);safeWrite(KEYS.bank,{rows:bank,at:S.bankAt});await publish();
   }
   bankMessage='시트 자동 연결 · '+rows.filter(c=>c.enabled).length+'개 · 마지막 확인 '+new Date(bankCheckedAt).toLocaleTimeString('ko-KR')+' · 5초마다 확인';
   return true;
  }catch(e){bankMessage='시트 연결 확인 필요 · 마지막 문제로 계속 진행합니다. '+(e.name==='AbortError'?'응답 시간이 초과되었습니다.':e.message);return false;}
  finally{clearTimeout(timeout);fetching=false;renderControl();}
 })();
 try{return await bankFlight;}finally{bankFlight=null;}
}
// 연결 중에도 일시정지·팀 변경·위치 수정이 가능합니다. 변경 전 요청은 진행을 되돌리지 않습니다.
async function withLatestBank(action){
 if(bankTransition)return;
 const token={},state=S,screen=S.screen,flow=S.flow,team=S.selected,paused=S.paused;
 bankTransition=token;
 try{await refreshBank({auto:true});if(hasControl()&&S===state&&S.screen===screen&&S.flow===flow&&S.selected===team&&S.paused===paused)action();}
 finally{if(bankTransition===token)bankTransition=null;}
}
function installBankSync(poll=true){
const dispatchBeforeSheets=dispatch;
dispatch=function(a,v){
 if(['start','question','nextQuestion','open','replayQuestion'].includes(a)&&hasControl())return withLatestBank(()=>dispatchBeforeSheets(a,v));
 return dispatchBeforeSheets(a,v);
};
const flowBeforeSheets=advanceFlow;
advanceFlow=function(){
 if(S.flow?.kind==='arrival')return withLatestBank(()=>flowBeforeSheets());
 return flowBeforeSheets();
};
if(poll){setInterval(()=>void refreshBank({auto:true}),5000);window.addEventListener('focus',()=>void refreshBank({auto:true}));}
}
if(typeof window!=='undefined'&&!globalThis.__TEST__)installBankSync();
function confetti(){return '<div class="confetti">'+Array.from({length:36},(_,i)=>`<i style="--x:${i*37%100}%;--delay:${i%8*.11}s;--c:${['#e7b448','#619dc4','#6eaf80','#d692a2'][i%4]}"></i>`).join('')+'</div>';}
function die(n,cls=''){const dots={1:[5],2:[1,9],3:[1,5,9],4:[1,3,7,9],5:[1,3,5,7,9],6:[1,3,4,6,7,9]}[n]||[5];return `<div class="die ${cls}" aria-label="주사위 ${n}">${Array.from({length:9},(_,i)=>`<i class="${dots.includes(i+1)?'pip':''}"></i>`).join('')}</div>`;}
const locationText=p=>position(p)==='S'?'출발 칸':`${String(position(p)).padStart(2,'0')}번 칸`;
function ranks(){return TEAMS.map((t,i)=>({i,score:S.scores[i],rank:1+S.scores.filter(n=>n>S.scores[i]).length})).sort((a,b)=>b.score-a.score||a.i-b.i);}
function renderBoard(){const key=JSON.stringify(S.bank.map(c=>[c.id,c.type,c.enabled]));if(key!==lastBank){lastBank=key;$('nodes').innerHTML=[{id:'S',type:'start',enabled:true},...S.bank].map(c=>{const [x,y]=coords[c.id],cat=category(c);return `<g id="node${c.id}" transform="translate(${x} ${y})" class="cell"><rect x="-72" y="-47" width="144" height="94" rx="12" fill="${c.id==='S'?'#243e46':c.enabled?cat[1]:'#e1ded6'}"/><text class="cell-number" x="${c.id==='S'?0:-43}" y="-14" fill="${c.id==='S'?'white':'#293b3c'}">${c.id==='S'?'출발':String(c.id).padStart(2,'0')}</text><text class="cell-type" y="38" fill="${c.id==='S'?'#f4da90':'#354447'}">${c.id==='S'?'START ↑':c.enabled?cat[0]:'쉼터'}</text><text class="cell-icon" x="42" y="-14">${c.id==='S'?'⚑':cat[2]}</text></g>`;}).join('');}
 if(!$('pawns').children.length)$('pawns').innerHTML=TEAMS.map((t,i)=>`<g id="pawn${i}" class="pawn"><g class="pawn-bounce"><circle cy="-69" r="17" fill="${t.color}" stroke="white" stroke-width="4"/><path d="M-13 -50 Q-10 -33 -24 -18 Q-31 -7 -24 0 L24 0 Q31 -7 24 -18 Q10 -33 13 -50Z" fill="${t.color}" stroke="white" stroke-width="4"/><ellipse cy="-2" rx="29" ry="9" fill="${t.color}" stroke="white" stroke-width="4"/><text y="-17" fill="${t.ink}" font-size="18" text-anchor="middle">${['구청','복지','지회'][i]}</text></g></g>`).join('');
 S.players.forEach((p,i)=>{const at=position(p),same=S.players.map((q,j)=>position(q)===at?j:-1).filter(j=>j>=0),[x,y]=coords[at]||coords.S,xy=`translate(${x+(same.indexOf(i)-(same.length-1)/2)*(same.length===2?62:47)} ${y+42}) scale(${same.length===3?.76:1} 1)`,el=$('pawn'+i);if(el.getAttribute('transform')!==xy){el.classList.remove('hop');void el.getBoundingClientRect();el.setAttribute('transform',xy);el.classList.add('hop');}el.classList.toggle('current',S.selected===i);});
 Object.keys(coords).forEach(id=>$('node'+id)?.classList.toggle('lit',S.passed.map(String).includes(id)));
 $('boardwrap').classList.toggle('dim',!['board','start'].includes(S.screen));$('boardwrap').classList.toggle('hidden-board',['finalWait','finale'].includes(S.screen));
}
let scoreValues=[null,null,null],scoreTargets=[null,null,null],scoreStart=[0,0,0],scoreFrom=[0,0,0];
function renderScore(){TEAM_ORDER.forEach(i=>{const el=$('team'+i),rank=1+S.scores.filter(n=>n>S.scores[i]).length;el.classList.toggle('current',S.selected===i);$('loc'+i).textContent='현재 '+locationText(S.players[i]);$('rank'+i).textContent=rank===1?'♛ 1위':rank+'위';if(scoreTargets[i]!==S.scores[i]){scoreFrom[i]=scoreValues[i]??S.scores[i];scoreStart[i]=gameNow();scoreTargets[i]=S.scores[i];}const fx=S.scoreFx,fxkey=fx?.team===i?String(fx.at):'';if($('gain'+i).dataset.key!==fxkey){$('gain'+i).dataset.key=fxkey;$('gain'+i).innerHTML=fxkey&&gameNow()-fx.at<1800?`<b class="gain">${fx.delta>0?'+':''}${fx.delta}점!</b>`:'';}});$('boardNote').textContent=S.notice;}
function showHTML(){const c=S.card,cat=category(c),team=TEAMS[S.selected],quiz=isQuiz(c),shell=(body,extra='')=>`<section class="show ${extra}" style="--cat:${cat[1]}">${body}</section>`;
 if(S.screen==='board'||S.screen==='start')return '';
 if(S.screen==='opening'){const i=S.openingIndex;return shell('<div class="eyebrow">2026 스마트경로당 한가위 행사</div><h2>온(ON)마을 복(福) 터졌네!</h2><div class="opening-name" style="color:'+(i<3?TEAMS[TEAM_ORDER[i]].ink:'#31554d')+'">'+(i<3?TEAMS[TEAM_ORDER[i]].name:i===3?'세 팀 모두 준비되셨나요?':'START!')+'</div><div class="connection-lights">'+Array.from({length:50},(_,n)=>'<i style="--delay:'+n*.025+'s"></i>').join('')+'</div><p class="show-lead">50개 스마트경로당, 함께 만드는 우리 팀의 도전!</p>','opening');}
 if(S.screen==='turn'){const next=TEAMS[TEAM_ORDER[(TEAM_ORDER.indexOf(S.selected)+1)%3]];return shell('<div class="eyebrow">다음 도전을 준비해주세요</div><h2 class="next-team" style="color:'+next.ink+'">다음 차례는<br>'+next.name+'입니다!</h2><p class="show-lead">실물 주사위를 준비해 주세요!</p>','turn-show');}
 if(S.screen==='finalWait')return shell('<div class="eyebrow">두구두구…</div><h2>최종 점수, 기대해주세요!</h2><div class="intro-icon">♫</div><p class="show-lead">점수 발표 전에 잠시!<br>강사님과 노래 메들리로 기분전환~</p><p class="closing">다 함께 즐겁게 노래해요!</p>','finale');
 if(S.screen==='finale'){
  const result=ranks(),top=result[0]?.score,mvp=result.filter(r=>r.score===top),final=S.finaleIndex>=4;
  return shell('<div class="eyebrow">한가위 골든벨 · 최종 합산 점수</div><h2 style="font-size:52px;line-height:1.3">'+(mvp.length>1?'공동 MVP는<br>':'오늘의 MVP는<br>')+mvp.map(r=>esc(TEAMS[r.i].name)).join(' · ')+'입니다!</h2><div class="podium">'+result.map((r,n)=>'<div class="'+(S.finaleIndex>0&&S.finaleIndex<=n?'unrevealed ':'')+(final&&r.score===top?'mvp-winner':'')+'" style="--team:'+TEAMS[r.i].color+'"><span>'+(final&&r.score===top?'🏆 MVP':['🥇','🥈','🥉'][r.rank-1]+' '+r.rank+'위')+'</span><h3>'+TEAMS[r.i].name+'</h3><strong>'+r.score+'<small>점</small></strong></div>').join('')+'</div><p class="closing">'+(final?'함께해서 더 큰 복(福)! 우리 모두가 한 팀입니다.':'문제 점수와 보너스 점수를 모두 합산합니다.')+'</p>'+confetti(),'finale');
 }
 if(!c)return '';
 const head=`<div class="quiz-head"><span class="challenger" style="background:${team.color}">${team.name} 도전!</span><span>${String(c.id).padStart(2,'0')}번 · ${cat[0]}</span><div class="reward-badge" aria-label="성공 시 ${pointsFor(c)}점"><span>성공 시</span><strong>+${pointsFor(c)}<small>점</small></strong></div></div>`;
 if(S.screen==='intro')return shell(`${head}<div class="intro-icon">${cat[2]}</div><h2>${quiz?'문제가 도착했습니다!':['bonus','golden'].includes(c.type)?'복 터지는 보너스!':'함께 도전해요!'}</h2><p class="show-lead">${quiz?'잠시 후 문제를 공개합니다.':'잠시 후 미션을 공개합니다.'}</p>`,'intro');
 if(['question','camera'].includes(S.screen))return shell(`${head}<h2 class="question">${esc(c.question||c.title)}</h2><div class="quiz-body"><div class="choices">${(c.choices||[]).map((s,i)=>`<div><b>${['①','②','③','④'][i]}</b> ${esc(s)}</div>`).join('')}</div><div class="clock"><strong data-timer></strong><span>초</span></div></div><div class="timerbar"><i id="timerbar"></i></div><div class="writing" id="writePrompt">정답을 적어주세요!</div><p class="audience">${team.name} ${team.count}개소가 도전합니다 · 다른 팀은 응원해주세요!</p>${S.screen==='camera'?'<div class="camera"><span>📸</span><h2>하나, 둘, 셋!<br>정답판 보여주세요!</h2></div>':''}`);
 if(S.screen==='answer')return shell(`${head}<div class="eyebrow">정답 공개</div><h2 class="answer">${(c.choices||[]).includes(c.answer)?'정답은 '+['①','②','③','④'][c.choices.indexOf(c.answer)]+'번!':''}<br>${esc(c.answer||'문제은행 정답을 확인해 주세요.')}</h2><p class="show-lead">${S.outcome==='success'?'정답입니다! +'+pointsFor(c)+'점':S.outcome==='soft'?'아쉽습니다! 다음 도전을 응원합니다.':'모두 정답판을 확인해 주세요!'}</p>${S.outcome==='success'?confetti()+(''):''}`);
 if(S.screen==='chance')return shell(`${head}<div class="chance-card ${S.chanceApplied?'flipped':''}"><div>${S.chanceApplied?'🧧':'✦'}</div><h2>${S.chanceApplied?'복이 터졌습니다!':'CHANCE'}</h2><p>${S.chanceApplied?esc((c.prompt||c.title).replace(/\[[^\]]+\]/g,'')):'어떤 행운이 기다릴까요?'}</p>${S.chanceApplied?`<strong>성공하면 +${pointsFor(c)}점</strong>`:''}</div>${S.outcome==='success'?confetti():''}`,'chance-show');
 return shell(`${head}<div class="intro-icon">${cat[2]}</div><h2 class="mission-text">${esc(c.prompt||c.title).replace(/\n/g,'<br>')}</h2>${S.timer&&!S.timer.ended?'<div class="mission-clock"><span data-timer></span>초 · 함께 도전해주세요!</div>':''}<p class="show-lead">${S.outcome==='success'?'미션 성공! +'+pointsFor(c)+'점':S.outcome==='soft'?'함께 도전해주셔서 감사합니다!':'우리 팀 모두 함께 도전해요!'}</p>${S.outcome==='success'||['golden','bonus'].includes(c.type)?confetti():''}${S.communityAchieved?'<div class="community-win">공동체 미션 달성!<br>최종 점수 인정!</div>':''}`,'mission');
}
function fitQuizText(){
 const panel=$('screen').querySelector('.show');if(!panel)return;
 const text=[...panel.querySelectorAll('.question,.choices>div,.answer,.mission-text,.show-lead')];
 for(let pass=0;pass<24&&panel.scrollHeight>panel.clientHeight+2;pass++){
  let changed=false;for(const el of text){const size=parseFloat(getComputedStyle(el).fontSize);const min=el.matches('.choices>div')?34:el.matches('.question')?48:el.matches('.show-lead')?32:54;if(size>min){el.style.setProperty('font-size',Math.max(min,size-2)+'px','important');changed=true;}}
  if(!changed)break;
 }
}
function render(){applyViewerBank();receiveSound();renderBoard();renderScore();$('scorezone').style.visibility=['finalWait','finale'].includes(S.screen)?'hidden':'';$('turnline').innerHTML=`이번 차례는 <b style="color:${TEAMS[S.selected].ink}">${TEAMS[S.selected].name}</b>입니다!`;$('round').textContent=`${Math.min(S.completed+1,S.totalTurns)} / ${S.totalTurns} 라운드`;$('startPanel').hidden=S.screen!=='start';$('scorezone').classList.toggle('starting',S.screen==='start');const key=JSON.stringify([S.screen,S.at,S.card,S.outcome,S.chanceApplied,S.scores,S.openingIndex,S.finaleIndex,S.successes,S.selected]);if(key!==lastScreen){lastScreen=key;$('screen').innerHTML=showHTML();requestAnimationFrame(fitQuizText);}renderControl();updateClock();}
function updateClock(){const now=S.paused?S.pausedAt:Date.now(),left=seconds();document.body.classList.toggle('game-paused',!!S.paused);document.querySelectorAll('[data-timer]').forEach(e=>{e.textContent=left;e.classList.toggle('urgent',left<=10&&left>0);});if($('timerbar'))$('timerbar').style.width=(S.timer?left/S.timer.duration*100:0)+'%';if($('writePrompt'))$('writePrompt').textContent=left===0?'정답판을 들어주세요!':left<=10?'정답판을 들고 카메라를 바라봐주세요!':'정답을 적어주세요!';TEAMS.forEach((_,i)=>{const t=Math.max(0,Math.min(1,(now-scoreStart[i])/650));scoreValues[i]=Math.round(scoreFrom[i]+(scoreTargets[i]-scoreFrom[i])*(1-Math.pow(1-t,3)));$('score'+i).textContent=scoreValues[i];});const d=S.dice,visible=d&&now<d.showUntil;let dk=visible?(now<d.rollingUntil?'rolling'+Math.floor(now/100):'result'+d.value):'';if($('diceOverlay').dataset.key!==dk){$('diceOverlay').dataset.key=dk;$('diceOverlay').innerHTML=visible?`<div class="dice-stage">${die(now<d.rollingUntil?Math.floor(now/100)%6+1:d.value,now<d.rollingUntil?'rolling':'')}<h2>${now<d.rollingUntil?'두근두근…':d.value===6?'대박! 6칸 이동!':d.value+'칸 이동!'}</h2></div>`:'';}}
function tick(){updateClock();if(!hasControl()||S.paused)return;const now=Date.now();if(S.flow&&now>=S.flow.due){advanceFlow();return;}if(S.timer?.running){const left=seconds();if(left!==lastClock){lastClock=left;if(left<=10&&left>0){tone('count');publish();}}if(left===0){pushHistory();endTimer();publish();}}}

function fit(){const r=$('view').getBoundingClientRect();$('stage').style.transform=`scale(${Math.min(r.width/1600,r.height/900)})`;}
function button(label,action,value='',disabled=false,cls=''){return `<button class="${cls}" data-action="${action}" data-value="${esc(value)}" ${disabled?'disabled':''}>${label}</button>`;}
let controlKey='';
function renderControl(){if(mode==='display')return;for(const id of ['bankLiveStatus','bankDetailsStatus'])if($(id))$(id).textContent=bankMessage||'조작권을 이어받으면 구글시트를 자동으로 확인합니다.';const refreshButton=$('control').querySelector('[data-action=refresh]');if(refreshButton)refreshButton.disabled=fetching||!authority||S.busy;const key=JSON.stringify([S.screen,S.selected,S.busy,S.phase,S.card,S.scored,S.chanceApplied,S.scores,S.sound,S.bgmOn,S.bgmVolume,S.timer?.running,S.timer?.ended,history.length,authority,S.bankAt,apiMessage,S.paused,S.flow?.kind,S.dieInput,S.successes,S.completed]);if(key===controlKey&&$('adminActions'))return;controlKey=key;
 const keep={};$('control').querySelectorAll('input,select,details').forEach(e=>{if(e.id&&e.id!=='bgmVolumeInput')keep[e.id]=e.tagName==='DETAILS'?e.open:e.value;});const scroll=$('control').scrollTop;
 const b=(label,a,v='',disabled=false,cls='')=>button(label,a,v,disabled||(S.busy&&!['position','scoreDelta','score','sound'].includes(a)),cls),board=S.screen==='board';
 $('control').innerHTML=`<div id="adminActions"><div class="admin-title"><b>행사 조작실</b><a href="/game" target="_blank">관람 화면 ↗</a></div><div class="row">${button('조작권 이어받기','takeover')}${button('로그아웃','logout')}</div><p id="cloudStatus">${esc(apiMessage||'서버 연결 완료')}</p><p id="bankLiveStatus" role="status">${esc(bankMessage||'조작권을 이어받으면 구글시트를 자동으로 확인합니다.')}</p><div class="row">${TEAM_ORDER.map(i=>button(TEAMS[i].name,'team',i,false,S.selected===i?'selected':'')).join('')}</div><h2>${TEAMS[S.selected].name} · ${S.completed}/${S.totalTurns}회 완료</h2><section class="progress-controls"><h2>진행 컨트롤</h2><div class="row">${button('⏸ 일시정지','pauseAll','',S.paused)}${button('▶ 계속 진행','resumeAll','',!S.paused)}${button('이전 단계','previous','',!history.length)}${button('다음 단계','nextStage')}${button('현재 문제 다시보기','replayQuestion','',!S.card)}${button('정답 다시보기','replayAnswer','',!isQuiz(S.card))}${button('타이머 다시 시작','timer-restart','',!S.timer)}</div><p>${S.paused?'진행 일시정지 · 단계 버튼으로 한 단계씩 진행 가능':'자동 진행 중 · 판정 후 다음 팀으로 전환됩니다.'}</p></section>${S.screen==='start'?b('🎲 게임 시작','start','',false,'primary'):''}<section class=progress-controls><h2>최종 결과 발표</h2><div class=row>${button('♫ 최종 발표 준비 · 노래 메들리','finale')}${button('🏆 최종점수 · MVP 발표','finalReveal','',false,'primary')}</div></section><section class="audio-controls"><h2>방송 음향</h2><button type="button" data-action="localAudio">🔊 이 관리자 창에서 소리 켜기</button><div class="row">${button(S.bgmOn===false?'BGM OFF':'BGM ON','bgmToggle')}${button('성공음 테스트','successTest')}${button('👏 박수 재생','applause','',!S.sound)}${button('🎺 팡파르 재생','fanfare','',!S.sound)}${button('■ 효과음 정지','soundStop')}</div><label for="bgmVolumeInput">BGM 음량 · ${Math.round((S.bgmVolume??.12)*100)}%</label><input id="bgmVolumeInput" type="range" min="0" max="100" step="1" value="${Math.round((S.bgmVolume??.12)*100)}">${button('음량 적용','bgmVolume')}<p>이 창을 공유한다면 위의 소리 켜기를 누르세요. 별도 관람 창을 공유한다면 그 창의 소리 켜기를 누르세요. 화면 공유 시 ‘탭 오디오/시스템 소리 공유’도 켜주세요.</p><a href="/audio/LICENSES.md" target="_blank">음원 출처·이용조건</a></section><h2>실물 주사위 결과</h2><div class="row dice-input">${[1,2,3,4,5,6].map(n=>button(n,'dieSelect',n,S.busy||!board||S.phase!=='ready',S.dieInput===n?'selected':'')).join('')}</div>${button('🎲 주사위 공개'+(S.dieInput?' · '+S.dieInput+'칸':''),'revealDice','',!S.dieInput||S.paused||S.busy||!board||S.phase!=='ready','primary')}<p>실제 주사위 숫자를 선택한 뒤 공개하세요.</p>
 ${S.card?`<h2>${S.card.id}번 ${esc(S.card.title)} · ${pointsFor(S.card)}점</h2><div class="row">${b('문제 열기','open','',S.screen!=='intro')}${b('정답판 들어주세요 · 안내','camera','',S.screen!=='question')}${b('정답 공개','answer','',!['question','camera'].includes(S.screen))}</div>`:''}
 ${S.timer?`<h2>남은 시간 <span data-timer></span>초</h2><div class="row">${b('시작','timer-start','',S.timer.running||S.timer.ended)}${b('정지','timer-pause','',!S.timer.running)}${b('초기화·재시작','timer-restart')}${b('+10초','timer-add')}${b('시간 종료','timer-end','',S.timer.ended)}</div>`:''}
 ${S.screen==='chance'?b('찬스 카드 뒤집기','chance','',S.chanceApplied,'primary'):''}
 ${['answer','mission','chance'].includes(S.screen)?`<div class="row">${b('정답·성공 +'+pointsFor(S.card)+'점','good','',S.scored||S.screen==='chance'&&!S.chanceApplied,'primary')}${b('오답 · 0점','soft','',S.scored)}</div>`:''}
 ${S.card?`<div class="row">${b('다음 단계','nextStage')}${b('문제 건너뛰기','complete')}</div>`:''}
 <h2>점수 추가 / 감점</h2>${TEAMS.map((t,i)=>`<div class="score-control"><b>${t.name} ${S.scores[i]}점</b><div class="row">${[5,10,15,20,30,-10].map(n=>b((n>0?'+':'')+n,'scoreDelta',i+':'+n)).join('')}</div></div>`).join('')}
 <details id="directDetails"><summary>점수 직접 수정</summary>${TEAM_ORDER.map(i=>`<label>${TEAMS[i].name} 획득 점수<input id="directScore${i}" type="number" value="${S.scores[i]}"></label>${button('점수 적용','scoreDirect',i)}`).join('')}</details><details id="questionsDetails"><summary>문제 선택 · 시트 배점</summary><select id="questionChoice">${S.bank.filter(c=>c.enabled).map(c=>`<option value="${c.id}">${c.id}번 ${esc(c.title)} · ${pointsFor(c)}점</option>`).join('')}</select><div class="row">${b('선택 문제 띄우기','question')}${b('다음 문제','nextQuestion')}</div><p>점수는 구글시트의 점수 열을 따릅니다.</p></details>
 <details id="adjustDetails"><summary>말 위치 · 행사 설정</summary><div class="row">${b('한 칸 앞으로','forward','',!board)}${b('한 칸 뒤로','back','',!board||S.players[S.selected].path.length<2)}${b('실행취소','undo','',!history.length)}</div><select id="positionInput"><option value="S">출발</option>${S.bank.map(c=>`<option value="${c.id}">${c.id}번 칸</option>`).join('')}</select>${b('말 위치 수정','position')}
 <label>총 진행 횟수 (완료 시 최종 결과)<input id="turnsInput" type="number" min="1" max="999" value="${S.totalTurns}"></label>${b('횟수 적용','turns')}<div class="row">${b(S.sound?'효과음 ON':'효과음 OFF','sound')}${b('송출 소리 테스트','audioTest')}${b('START 화면','opening')}${b('보드 복귀','board')}${b('최종 발표 준비 · 노래 메들리','finale')}${b('게임 초기화','reset','',false,'danger')}</div></details>
 <details id="bankDetails"><summary>Google Sheets 문제은행</summary><label>구글시트 또는 Apps Script 주소<input id="apiUrl" value="${esc(S.bankSource||safeRead(KEYS.api)||DEFAULT_BANK_URL||'')}" placeholder="https://script.google.com/macros/s/…/exec"></label>${b('문제 새로고침','refresh','',fetching)}<p id="bankDetailsStatus">${esc(bankMessage)}</p><p>진행자와 송출 화면 모두 5초마다 시트를 확인합니다. 문제·정답·유형·점수는 칸번호로 연결되며 송출 화면에도 반영됩니다.</p></details></div>`;
 Object.entries(keep).forEach(([id,v])=>{if($(id)){if($(id).tagName==='DETAILS')$(id).open=v;else $(id).value=v;}});$('control').scrollTop=scroll;
 $('control').querySelectorAll('button').forEach(b=>{if(!authority&&!['takeover','logout','localAudio'].includes(b.dataset.action))b.disabled=true;});
}

