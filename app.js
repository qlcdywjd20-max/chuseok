'use strict';
// Team indices are stable: existing database scores keep belonging to the same team.
const TEAMS=[{name:'구청장팀',count:16,color:'#4d9fde',ink:'#134c79'},{name:'관장님팀',count:16,color:'#edb444',ink:'#74430f'},{name:'지회장팀',count:18,color:'#55a678',ink:'#20593b'}], TEAM_ORDER=[1,0,2];
const CATS={smart:['스마트퀴즈','#f0d78f','📺',10],chuseok:['추석퀴즈','#f0d78f','🌕',10],town:['우리동네','#f0d78f','🏘️',10],memory:['추억퀴즈','#f0d78f','📻',10],health:['건강상식','#f0d78f','🌿',10],song:['노래퀴즈','#c7b4df','♪',10],gesture:['몸으로 말해요','#a8cdb3','🙌',20],mission:['팀미션','#f0b180','👏',20],chance:['찬스','#aacce7','✦',30],special:['찬스','#aacce7','✦',30],golden:['보너스','#e6aaa0','🎁',50],bonus:['보너스','#e6aaa0','🎁',50],cheer:['응원미션','#f0b180','👏',20]};
const TYPES={'스마트경로당퀴즈':'smart','추석퀴즈':'chuseok','우리동네퀴즈':'town','추억퀴즈':'memory','건강상식':'health','건강퀴즈':'health','노래':'song','노래퀴즈':'song','노래한소절':'song','몸으로말해요':'gesture','몸짓':'gesture','미션':'mission','팀미션':'mission','찬스':'chance','복주머니찬스':'chance','특별찬스':'special','골든미션':'golden','보너스':'bonus','응원전':'cheer'};
const KEYS={api:'onmaeul.api.v3',bank:'onmaeul.bank.v3'};
const clone=o=>JSON.parse(JSON.stringify(o)),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])), $=id=>document.getElementById(id);
const fresh=()=>({version:3,diceVersion:1,players:TEAMS.map(()=>({path:['S']})),scores:[0,0,0],selected:0,screen:'start',at:Date.now(),phase:'ready',busy:false,passed:[],notice:'',card:null,timer:null,scored:false,outcome:null,extra:false,sound:true,bank:clone(DEFAULT_BANK),bankAt:null,dice:null,completed:0,totalTurns:29,turnAt:0,scoreFx:null,chanceApplied:false,roundOpen:false});
let S=fresh(),history=[],authority=false,mode='control',owner='',lastScreen='',lastBank='',lastClock=-1,ctx=null,apiMessage='',fetching=false,storageOK=true;
// 30 perimeter squares: START + 29 existing question IDs. No interior routes.
const coords={S:[1475,650]};let cellId=1;
for(let r=5;r>=0;r--)coords[cellId++]=[1475,50+r*100];
for(let c=8;c>=0;c--)coords[cellId++]=[125+c*150,50];
for(let r=1;r<=6;r++)coords[cellId++]=[125,50+r*100];
for(let c=1;c<=8;c++)coords[cellId++]=[125+c*150,650];
const position=p=>p.path.at(-1),isQuiz=c=>!!(c?.isQuiz||c?.choices?.length),category=c=>CATS[c?.type]||CATS.mission;
const pointsFor=c=>Number.isFinite(Number(c?.points))?Number(c.points):category(c)[3];
function canonical(id){if(id==='S'||id===0||id==='0')return ['S'];const n=Number(id);if(!Number.isInteger(n)||n<1||n>29)throw Error('위치는 출발 또는 1~29번입니다.');return ['S',...Array.from({length:n},(_,i)=>i+1)];}
function nextStep(p){const at=position(p);return at==='S'?1:at===29?'S':Number(at)+1;}
// Read legacy state without resetting scores or replacing the saved question bank.
function normalizeState(raw){const s={...fresh(),...clone(raw)};s.bank=(s.bank||DEFAULT_BANK).map(c=>({...c,choices:c.choices||[],points:c.points??category(c)[3]}));if(!s.diceVersion){s.diceVersion=1;s.players=s.players.map(p=>({path:canonical(position(p)==='F'?'S':position(p))}));s.screen='start';s.timer=null;s.card=null;s.busy=false;s.phase='ready';s.extra=false;s.dice=null;s.completed=0;s.roundOpen=false;}s.totalTurns=Math.max(1,Math.min(999,Number(s.totalTurns)||29));return s;}
function safeRead(k){try{return JSON.parse(localStorage.getItem(k));}catch{return null;}}
function safeWrite(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch{storageOK=false;}}
function hasControl(){return authority;}
function saveHistory(){}
function pushHistory(){const s=clone(S);if(s.timer?.running){s.timer.remaining=Math.max(0,s.timer.deadline-Date.now());s.timer.running=false;}history.push(s);if(history.length>80)history.shift();saveHistory();}
function publish(){render();}
function setScreen(screen){S.screen=screen;S.at=Date.now();}
function seconds(t=S.timer,now=Date.now()){return t?Math.max(0,Math.ceil((t.running?t.deadline-now:t.remaining)/1000)):0;}
function tone(kind){if(!hasControl()||!S.sound)return;try{ctx??=new (window.AudioContext||window.webkitAudioContext)();if(ctx.state==='suspended')ctx.resume();const notes={step:[660],dice:[330,440,550],intro:[330,440,660],count:[880],end:[440,330],answer:[523,659,784,1047],special:[392,523,659,784],golden:[523,659,784,1047,1319],finish:[523,659,784,1047,784,1047]}[kind]||[660];notes.forEach((hz,i)=>{const start=ctx.currentTime+i*.12,osc=ctx.createOscillator(),gain=ctx.createGain();osc.type=kind==='step'?'sine':'triangle';osc.frequency.setValueAtTime(hz,start);gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.09,start+.01);gain.gain.exponentialRampToValueAtTime(.001,start+.16);osc.connect(gain);gain.connect(ctx.destination);osc.start(start);osc.stop(start+.18);});}catch{}}
function randomDie(){const a=new Uint32Array(1);do{crypto.getRandomValues(a);}while(a[0]>=4294967292);return a[0]%6+1;}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function roll(steps,correction=false){
 if(!hasControl()||S.busy||S.screen!=='board'||(!correction&&S.phase!=='ready'))return;
 if(!Number.isInteger(steps)||(!correction&&(steps<1||steps>6)))return;
 const p=S.players[S.selected];if(steps<0&&p.path.length<2)return;
 pushHistory();S.busy=true;S.card=null;S.timer=null;S.passed=[];S.notice='';S.scored=false;S.outcome=null;
 if(!correction){S.roundOpen=true;S.dice={value:steps,rollingUntil:Date.now()+1200,showUntil:Date.now()+2150};tone('dice');publish();await sleep(2200);}
 for(let i=0;i<Math.abs(steps);i++){if(!hasControl())return;if(steps<0)p.path.pop();else p.path.push(nextStep(p));S.passed=[position(p)];tone('step');publish();await sleep(480);}
 if(!hasControl())return;S.busy=false;S.phase=correction?'ready':'next';S.notice='도착!';S.arrivalUntil=Date.now()+1100;
 if(correction){publish();return;}const at=position(p);S.card=clone(S.bank.find(c=>c.id===at&&c.enabled)||null);S.chanceApplied=false;
 publish();await sleep(700);if(!hasControl())return;if(S.card){setScreen('intro');tone(['golden','bonus'].includes(S.card.type)?'golden':'intro');}else S.notice=at==='S'?'출발! 다시 한 바퀴 도전해요.':'쉬어가는 칸입니다. 다음 팀으로 진행해 주세요.';publish();
}
function startTimer(duration=20){S.timer={startedAt:Date.now(),duration,remaining:duration*1000,deadline:Date.now()+duration*1000,running:true,ended:false,kind:'quiz'};lastClock=-1;}
function endTimer(){if(!S.timer||S.timer.ended)return;S.timer.running=false;S.timer.remaining=0;S.timer.ended=true;tone('end');setScreen('camera');S.cameraUntil=Date.now()+3000;}
function timerAction(a){if(!S.timer)return;const t=S.timer;if(a==='pause'&&t.running){t.remaining=Math.max(0,t.deadline-Date.now());t.running=false;}if(a==='start'&&!t.ended&&!t.running){t.deadline=Date.now()+t.remaining;t.running=true;}if(a==='restart'){setScreen('question');startTimer(t.duration);}if(a==='add'){t.remaining=(t.running?Math.max(0,t.deadline-Date.now()):t.remaining)+10000;t.deadline=Date.now()+t.remaining;t.duration=Math.max(t.duration,t.remaining/1000);t.ended=false;if(S.screen==='camera')setScreen('question');}if(a==='end')endTimer();publish();}
function openContent(){if(!S.card)return;if(['chance','special'].includes(S.card.type)){setScreen('chance');S.chanceApplied=false;tone('special');}else if(isQuiz(S.card)){setScreen('question');startTimer(S.card.duration||20);}else{setScreen('mission');S.timer=null;}publish();}
function changeScore(i,delta){S.scores[i]=Math.max(-9999,Math.min(9999,S.scores[i]+delta));S.scoreFx={team:i,delta,at:Date.now()};}
function applyScore(success){if(S.scored)return;pushHistory();S.scored=true;S.outcome=success?'success':'soft';if(success){changeScore(S.selected,pointsFor(S.card));tone('answer');}S.at=Date.now();publish();}
function finishContent(){if(S.roundOpen){S.completed++;S.roundOpen=false;}S.timer=null;S.card=null;S.outcome=null;S.notice='다음 팀을 선택해 주세요.';if(S.completed>=S.totalTurns){setScreen('finale');tone('finish');}else setScreen('board');publish();}
function dispatch(a,v){if(!hasControl()||S.busy&&a!=='sound')return;if(a==='roll'){roll(Number(v));return;}if(a==='random'){roll(randomDie());return;}if(a==='forward'||a==='back'){roll(a==='forward'?1:-1,true);return;}if(a.startsWith('timer-')){timerAction(a.slice(6));return;}
 switch(a){
 case 'start':case 'board':S.timer=null;S.card=null;S.phase='ready';setScreen('board');break;
 case 'opening':pushHistory();S.timer=null;setScreen('start');break;
 case 'team':if(![0,1,2].includes(Number(v)))return;pushHistory();S.selected=Number(v);S.phase='ready';S.card=null;S.timer=null;S.roundOpen=false;setScreen('board');S.turnAt=Date.now();break;
 case 'next':if(S.screen!=='board')return;if(S.roundOpen){S.completed++;S.roundOpen=false;}if(S.completed>=S.totalTurns){setScreen('finale');break;}pushHistory();S.selected=(S.selected+1)%3;S.phase='ready';S.card=null;S.timer=null;S.notice='';S.turnAt=Date.now();break;
 case 'open':openContent();return;
 case 'question':case 'nextQuestion':{const b=S.bank.filter(c=>c.enabled),c=a==='question'?b.find(c=>c.id===Number(v)):b[(b.findIndex(c=>c.id===S.card?.id)+1)%b.length];if(!c)return;pushHistory();S.card=clone(c);S.timer=null;S.scored=false;S.outcome=null;S.roundOpen=true;S.phase='next';setScreen('intro');}break;
 case 'answer':if(!S.card||!isQuiz(S.card))return;S.timer&&(S.timer.running=false);setScreen('answer');tone('answer');break;
 case 'good':applyScore(true);return;case 'soft':applyScore(false);return;
 case 'complete':finishContent();return;
 case 'chance':if(S.chanceApplied)return;pushHistory();S.chanceApplied=true;S.at=Date.now();tone('special');break;
 case 'scoreDelta':{const [i,n]=String(v).split(':').map(Number);if(![0,1,2].includes(i)||!Number.isFinite(n))return;pushHistory();changeScore(i,n);}break;
 case 'score':{const [i,n]=String(v).split(':').map(Number);if(![0,1,2].includes(i)||!Number.isFinite(n)||Math.abs(n)>9999)return;pushHistory();changeScore(i,n-S.scores[i]);}break;
 case 'position':{const path=canonical(v);pushHistory();S.players[S.selected].path=path;S.phase='ready';S.card=null;S.timer=null;S.roundOpen=false;setScreen('board');}break;
 case 'undo':if(!history.length)return;S=normalizeState(history.pop());S.busy=false;S.dice=null;S.scoreFx=null;if(S.screen==='camera')S.screen='question';break;
 case 'sound':S.sound=!S.sound;if(S.sound)tone('step');break;
 case 'turns':{const n=Number(v);if(!Number.isInteger(n)||n<1||n>999)return;S.totalTurns=n;}break;
 case 'points':{const n=Number(v);if(!Number.isInteger(n)||n<0||n>999)return;const c=S.bank.find(c=>c.id===Number($('questionChoice').value));if(c)c.points=n;}break;
 case 'finale':if(!confirm('현재 점수로 최종 결과를 발표할까요?'))return;pushHistory();S.timer=null;setScreen('finale');tone('finish');break;
 case 'reset':if(!confirm('모든 말·점수·진행 횟수를 초기화할까요? 문제은행은 유지됩니다.'))return;{const bank=S.bank,bankAt=S.bankAt,sound=S.sound,totalTurns=S.totalTurns;S=fresh();Object.assign(S,{bank,bankAt,sound,totalTurns});history=[];}break;
 default:return;
 }publish();
}
function validateBank(rows){if(!Array.isArray(rows)||!rows.length)throw Error('문제 행이 없습니다.');const seen=new Set;return rows.map((r,i)=>{const k=Object.hasOwn(r,'칸번호'),get=(ko,en)=>k?r[ko]:r[en],id=Number(get('칸번호','id'));if(!Number.isInteger(id)||id<1||id>29||seen.has(id))throw Error((i+1)+'행: 칸번호는 중복 없이 1~29입니다.');seen.add(id);const t=String(get('유형','type')||'').replace(/\s/g,''),type=TYPES[t]||t;if(!CATS[type])throw Error(id+'번: 유형을 확인하세요.');const e=get('사용여부','enabled'),enabled=e===undefined||e===''||e===true||String(e).toUpperCase()==='TRUE';const choices=(k?[1,2,3,4].map(n=>r['보기'+n]||''):r.choices||[]).map(String).filter(x=>x.trim());let answer=String(get('정답','answer')??'');if(choices.length&&enabled){if(choices.length<2||choices.length>4)throw Error(id+'번: 보기는 2~4개입니다.');if(/^[1-4]$/.test(answer))answer=choices[+answer-1];if(!choices.includes(answer))throw Error(id+'번: 정답을 확인하세요.');}const duration=Number(get('제한시간','duration')||20),points=Number(get('배점','points')===''||get('배점','points')==null?CATS[type][3]:get('배점','points'));if(!Number.isFinite(duration)||duration<5||duration>600||!Number.isInteger(points)||points<0||points>999)throw Error(id+'번: 제한시간 5~600초, 배점 0~999점을 입력하세요.');const question=String(get('문제','question')||''),prompt=String(get('미션내용','prompt')||'');if(enabled&&!(choices.length?question:prompt).trim())throw Error(id+'번: 문제 또는 미션 내용을 입력하세요.');return {id,type,enabled,choices,answer,duration,points,question,prompt,title:String(get('제목','title')||CATS[type][0])};});}
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
async function refreshBank(){
 if(fetching||S.busy||!hasControl())return;if(!['board','start'].includes(S.screen)){bankMessage='보드 화면에서 새로고침해 주세요.';renderControl();return;}
 const source=$('apiUrl').value.trim();let request;try{request=bankRequestUrl(source);}catch(e){bankMessage=e.message;renderControl();return;}
 fetching=true;bankMessage='문제은행을 불러오는 중…';renderControl();const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),30000);
 try{const url=new URL(request.url);url.searchParams.set('t',Date.now());const res=await fetch(url,{signal:abort.signal,credentials:'omit',cache:'no-store'});if(!res.ok)throw Error('시트 열람 권한 또는 웹앱 배포 권한을 확인하세요. (응답 '+res.status+')');const text=await res.text();if(/^\s*</.test(text))throw Error('문제 대신 로그인 화면을 받았습니다. 시트 공유 설정을 확인하세요.');const payload=request.csv?parseBankCsv(text):JSON.parse(text);if(payload.error)throw Error(payload.error);const rows=validateBank(payload.rows||payload);if(!hasControl())throw Error('조작권이 변경되었습니다. 다시 이어받으세요.');pushHistory();const map=new Map(rows.map(c=>[c.id,c]));S.bank=DEFAULT_BANK.map(c=>map.get(c.id)||{...clone(c),enabled:false});S.bankAt=Date.now();S.bankSource=source;safeWrite(KEYS.api,source);safeWrite(KEYS.bank,{rows:S.bank,at:S.bankAt});await publish();bankMessage=hasControl()?rows.filter(c=>c.enabled).length+'개 문제·미션 반영 완료':'서버 저장을 확인하지 못했습니다. 조작권을 다시 이어받으세요.';
 }catch(e){bankMessage='기존 문제로 계속 진행합니다. '+e.message;}finally{clearTimeout(timeout);fetching=false;renderControl();}
}
function confetti(){return '<div class="confetti">'+Array.from({length:36},(_,i)=>`<i style="--x:${i*37%100}%;--delay:${i%8*.11}s;--c:${['#e7b448','#619dc4','#6eaf80','#d692a2'][i%4]}"></i>`).join('')+'</div>';}
function die(n,cls=''){const dots={1:[5],2:[1,9],3:[1,5,9],4:[1,3,7,9],5:[1,3,5,7,9],6:[1,3,4,6,7,9]}[n]||[5];return `<div class="die ${cls}" aria-label="주사위 ${n}">${Array.from({length:9},(_,i)=>`<i class="${dots.includes(i+1)?'pip':''}"></i>`).join('')}</div>`;}
const locationText=p=>position(p)==='S'?'출발 칸':`${String(position(p)).padStart(2,'0')}번 칸`;
function ranks(){return TEAMS.map((t,i)=>({i,score:S.scores[i],rank:1+S.scores.filter(n=>n>S.scores[i]).length})).sort((a,b)=>b.score-a.score||a.i-b.i);}
function renderBoard(){const key=JSON.stringify(S.bank.map(c=>[c.id,c.type,c.enabled]));if(key!==lastBank){lastBank=key;$('nodes').innerHTML=[{id:'S',type:'start',enabled:true},...S.bank].map(c=>{const [x,y]=coords[c.id],cat=category(c);return `<g id="node${c.id}" transform="translate(${x} ${y})" class="cell"><rect x="-72" y="-47" width="144" height="94" rx="12" fill="${c.id==='S'?'#243e46':c.enabled?cat[1]:'#e1ded6'}"/><text class="cell-number" y="-12" fill="${c.id==='S'?'white':'#293b3c'}">${c.id==='S'?'출발':String(c.id).padStart(2,'0')}</text><text class="cell-type" y="30" fill="${c.id==='S'?'#f4da90':'#354447'}">${c.id==='S'?'START ↑':c.enabled?cat[0]:'쉼터'}</text></g>`;}).join('');}
 if(!$('pawns').children.length)$('pawns').innerHTML=TEAMS.map((t,i)=>`<g id="pawn${i}" class="pawn"><g transform="scale(.72)"><g class="pawn-bounce"><path d="M-13 -46L-19 -64L-7 -58L0 -70L8 -58L20 -64L13 -46C29 -31 30 -4 0 0C-30 -4 -29 -31 -13 -46Z" fill="${t.color}" stroke="white" stroke-width="4"/><path d="M-13 -43Q0 -36 13 -43" fill="none" stroke="${t.ink}" stroke-width="4"/><text y="-15" fill="${t.ink}" font-size="24" text-anchor="middle">福</text></g></g></g>`).join('');
 S.players.forEach((p,i)=>{const at=position(p),same=S.players.map((q,j)=>position(q)===at?j:-1).filter(j=>j>=0),[x,y]=coords[at]||coords.S,xy=`translate(${x+(same.indexOf(i)-(same.length-1)/2)*42} ${y+40})`,el=$('pawn'+i);if(el.getAttribute('transform')!==xy){el.classList.remove('hop');void el.getBoundingClientRect();el.setAttribute('transform',xy);el.classList.add('hop');}el.classList.toggle('current',S.selected===i);});
 Object.keys(coords).forEach(id=>$('node'+id)?.classList.toggle('lit',S.passed.map(String).includes(id)));
 $('boardwrap').classList.toggle('dim',!['board','start'].includes(S.screen));$('boardwrap').classList.toggle('hidden-board',S.screen==='finale');
}
let scoreValues=[null,null,null],scoreTargets=[null,null,null],scoreStart=[0,0,0],scoreFrom=[0,0,0];
function renderScore(){TEAM_ORDER.forEach(i=>{const el=$('team'+i),rank=1+S.scores.filter(n=>n>S.scores[i]).length;el.classList.toggle('current',S.selected===i);$('loc'+i).textContent='현재 '+locationText(S.players[i]);$('rank'+i).textContent=rank===1?'♛ 1위':rank+'위';if(scoreTargets[i]!==S.scores[i]){scoreFrom[i]=scoreValues[i]??S.scores[i];scoreStart[i]=Date.now();scoreTargets[i]=S.scores[i];}const fx=S.scoreFx,fxkey=fx?.team===i?String(fx.at):'';if($('gain'+i).dataset.key!==fxkey){$('gain'+i).dataset.key=fxkey;$('gain'+i).innerHTML=fxkey&&Date.now()-fx.at<1800?`<b class="gain">${fx.delta>0?'+':''}${fx.delta}점!</b>`:'';}});$('boardNote').textContent=S.notice;}
function showHTML(){const c=S.card,cat=category(c),team=TEAMS[S.selected],quiz=isQuiz(c),shell=(body,extra='')=>`<section class="show ${extra}" style="--cat:${cat[1]}">${body}</section>`;
 if(S.screen==='board'||S.screen==='start')return '';
 if(S.screen==='finale')return shell(`<div class="eyebrow">2026 스마트경로당 한가위 골든벨</div><h2>오늘의 한가위 챔피언!</h2><div class="podium">${ranks().map(({i,score,rank})=>`<div style="--team:${TEAMS[i].color}"><span>${['🥇','🥈','🥉'][rank-1]} ${rank}위</span><h3>${TEAMS[i].name}</h3><strong>${score}<small>점</small></strong></div>`).join('')}</div><p class="closing">50개 스마트경로당이 함께해서 더욱 즐거웠습니다.<br>풍성하고 건강한 한가위 보내세요!</p>${confetti()}`,'finale');
 if(!c)return '';
 const head=`<div class="quiz-head"><span class="challenger" style="background:${team.color}">${team.name} 도전!</span><span>${String(c.id).padStart(2,'0')}번 · ${cat[0]} · ${pointsFor(c)}점</span></div>`;
 if(S.screen==='intro')return shell(`${head}<div class="intro-icon">${cat[2]}</div><h2>${quiz?'문제가 도착했습니다!':['bonus','golden'].includes(c.type)?'복 터지는 보너스!':'함께 도전해요!'}</h2><p class="show-lead">${quiz?'잠시 후 문제를 공개합니다.':'잠시 후 미션을 공개합니다.'}</p>`,'intro');
 if(['question','camera'].includes(S.screen))return shell(`${head}<h2 class="question">${esc(c.question||c.title)}</h2><div class="quiz-body"><div class="choices">${(c.choices||[]).map((s,i)=>`<div><b>${['①','②','③','④'][i]}</b> ${esc(s)}</div>`).join('')}</div><div class="clock"><strong data-timer></strong><span>초</span></div></div><div class="timerbar"><i id="timerbar"></i></div><div class="writing" id="writePrompt">정답을 적어주세요!</div><p class="audience">${team.name} ${team.count}개소가 도전합니다 · 다른 팀은 응원해주세요!</p>${S.screen==='camera'?'<div class="camera"><span>📸</span><h2>하나, 둘, 셋!<br>정답판 보여주세요!</h2></div>':''}`);
 if(S.screen==='answer')return shell(`${head}<div class="eyebrow">정답 공개</div><h2 class="answer">${(c.choices||[]).includes(c.answer)?'정답은 '+['①','②','③','④'][c.choices.indexOf(c.answer)]+'번!':''}<br>${esc(c.answer||'문제은행 정답을 확인해 주세요.')}</h2><p class="show-lead">${S.outcome==='success'?'정답입니다! +'+pointsFor(c)+'점':S.outcome==='soft'?'아쉽습니다! 다음 도전을 응원합니다.':'모두 정답판을 확인해 주세요!'}</p>${S.outcome==='success'?confetti():''}`);
 if(S.screen==='chance')return shell(`${head}<div class="chance-card ${S.chanceApplied?'flipped':''}"><div>${S.chanceApplied?'🧧':'✦'}</div><h2>${S.chanceApplied?'복이 터졌습니다!':'CHANCE'}</h2><p>${S.chanceApplied?esc((c.prompt||c.title).replace(/\[[^\]]+\]/g,'')):'어떤 행운이 기다릴까요?'}</p>${S.chanceApplied?`<strong>성공하면 +${pointsFor(c)}점</strong>`:''}</div>${S.outcome==='success'?confetti():''}`,'chance-show');
 return shell(`${head}<div class="intro-icon">${cat[2]}</div><h2 class="mission-text">${esc(c.prompt||c.title).replace(/\n/g,'<br>')}</h2><p class="show-lead">${S.outcome==='success'?'미션 성공! +'+pointsFor(c)+'점':S.outcome==='soft'?'함께 도전해주셔서 감사합니다!':'우리 팀 모두 함께 도전해요!'}</p>${S.outcome==='success'||['golden','bonus'].includes(c.type)?confetti():''}`,'mission');
}
function render(){renderBoard();renderScore();$('turnline').innerHTML=`이번 차례는 <b style="color:${TEAMS[S.selected].ink}">${TEAMS[S.selected].name}</b>입니다!`;$('round').textContent=`${Math.min(S.completed+1,S.totalTurns)} / ${S.totalTurns} 라운드`;$('startPanel').hidden=S.screen!=='start';$('scorezone').classList.toggle('starting',S.screen==='start');const key=JSON.stringify([S.screen,S.at,S.card,S.outcome,S.chanceApplied,S.scores]);if(key!==lastScreen){lastScreen=key;$('screen').innerHTML=showHTML();}renderControl();updateClock();}
function updateClock(){const now=Date.now(),left=seconds();document.querySelectorAll('[data-timer]').forEach(e=>{e.textContent=left;e.classList.toggle('urgent',left<=10&&left>0);});if($('timerbar'))$('timerbar').style.width=(S.timer?left/S.timer.duration*100:0)+'%';if($('writePrompt'))$('writePrompt').textContent=left===0?'정답판을 들어주세요!':left<=10?'정답판을 들고 카메라를 바라봐주세요!':'정답을 적어주세요!';TEAMS.forEach((_,i)=>{const t=Math.min(1,(now-scoreStart[i])/650);scoreValues[i]=Math.round(scoreFrom[i]+(scoreTargets[i]-scoreFrom[i])*(1-Math.pow(1-t,3)));$('score'+i).textContent=scoreValues[i];});const d=S.dice,visible=d&&now<d.showUntil;let dk=visible?(now<d.rollingUntil?'rolling'+Math.floor(now/100):'result'+d.value):'';if($('diceOverlay').dataset.key!==dk){$('diceOverlay').dataset.key=dk;$('diceOverlay').innerHTML=visible?`<div class="dice-stage">${die(now<d.rollingUntil?Math.floor(now/100)%6+1:d.value,now<d.rollingUntil?'rolling':'')}<h2>${now<d.rollingUntil?'두근두근…':d.value===6?'대박! 6칸 이동!':d.value+'칸 이동!'}</h2></div>`:'';}}
function tick(){updateClock();if(!hasControl())return;const now=Date.now();if(S.screen==='intro'&&now-S.at>1500){openContent();return;}if(S.timer?.running){const left=seconds();if(left!==lastClock){lastClock=left;if(left<=10&&left>0)tone('count');}if(left===0){endTimer();publish();}}if(S.screen==='camera'&&now>=S.cameraUntil){setScreen('question');publish();}}
function fit(){const r=$('view').getBoundingClientRect();$('stage').style.transform=`scale(${Math.min(r.width/1600,r.height/900)})`;}
function button(label,action,value='',disabled=false,cls=''){return `<button class="${cls}" data-action="${action}" data-value="${esc(value)}" ${disabled?'disabled':''}>${label}</button>`;}
let controlKey='';
function renderControl(){if(mode==='display')return;const key=JSON.stringify([S.screen,S.selected,S.busy,S.phase,S.card,S.scored,S.chanceApplied,S.scores,S.sound,S.timer?.running,S.timer?.ended,history.length,authority,S.bankAt,apiMessage,bankMessage,fetching]);if(key===controlKey&&$('adminActions'))return;controlKey=key;
 const keep={};$('control').querySelectorAll('input,select,details').forEach(e=>{if(e.id)keep[e.id]=e.tagName==='DETAILS'?e.open:e.value;});const scroll=$('control').scrollTop;
 const b=(label,a,v='',disabled=false,cls='')=>button(label,a,v,disabled||S.busy,cls),board=S.screen==='board';
 $('control').innerHTML=`<div id="adminActions"><div class="admin-title"><b>행사 조작실</b><a href="/game" target="_blank">관람 화면 ↗</a></div><div class="row">${button('조작권 이어받기','takeover')}${button('로그아웃','logout')}</div><p id="cloudStatus">${esc(apiMessage||'서버 연결 완료')}</p><div class="row">${TEAMS.map((t,i)=>b(t.name,'team',i,false,S.selected===i?'selected':'')).join('')}</div><h2>${TEAMS[S.selected].name} · ${S.completed}/${S.totalTurns}회 완료</h2>${S.screen==='start'?b('🎲 게임 시작','start','',false,'primary'):''}<div class="row">${b('🎲 주사위 던지기','random','',!board||S.phase!=='ready','primary')}${b('다음 팀 →','next','',!board)}</div><details><summary>주사위 결과 직접 입력</summary><div class="row">${[1,2,3,4,5,6].map(n=>b(n+'칸','roll',n,!board||S.phase!=='ready')).join('')}</div></details>
 ${S.card?`<h2>${S.card.id}번 ${esc(S.card.title)} · ${pointsFor(S.card)}점</h2><div class="row">${b('문제 열기','open','',S.screen!=='intro')}${b('정답 공개','answer','',!['question','camera'].includes(S.screen))}</div>`:''}
 ${S.timer?`<h2>남은 시간 <span data-timer></span>초</h2><div class="row">${b('시작','timer-start','',S.timer.running||S.timer.ended)}${b('정지','timer-pause','',!S.timer.running)}${b('초기화·재시작','timer-restart')}${b('+10초','timer-add')}${b('시간 종료','timer-end','',S.timer.ended)}</div>`:''}
 ${S.screen==='chance'?b('찬스 카드 뒤집기','chance','',S.chanceApplied,'primary'):''}
 ${['answer','mission','chance'].includes(S.screen)?`<div class="row">${b('정답·성공 +'+pointsFor(S.card)+'점','good','',S.scored||S.screen==='chance'&&!S.chanceApplied,'primary')}${b('오답 · 0점','soft','',S.scored)}</div>`:''}
 ${S.card?`<div class="row">${b('다음 진행','complete')}${b('문제 건너뛰기','complete')}</div>`:''}
 <h2>점수 추가 / 감점</h2>${TEAMS.map((t,i)=>`<div class="score-control"><b>${t.name} ${S.scores[i]}점</b><div class="row">${[10,20,30,-10].map(n=>b((n>0?'+':'')+n,'scoreDelta',i+':'+n)).join('')}</div></div>`).join('')}
 <details id="questionsDetails"><summary>문제 선택 · 배점 수정</summary><select id="questionChoice">${S.bank.filter(c=>c.enabled).map(c=>`<option value="${c.id}">${c.id}번 ${esc(c.title)} · ${pointsFor(c)}점</option>`).join('')}</select><div class="row">${b('선택 문제 띄우기','question')}${b('다음 문제','nextQuestion')}</div><label>선택 문제 배점<input id="pointsInput" type="number" min="0" max="999" value="10"></label>${b('배점 저장','points')}</details>
 <details id="adjustDetails"><summary>말 위치 · 행사 설정</summary><div class="row">${b('한 칸 앞으로','forward','',!board)}${b('한 칸 뒤로','back','',!board||S.players[S.selected].path.length<2)}${b('실행취소','undo','',!history.length)}</div><select id="positionInput"><option value="S">출발</option>${S.bank.map(c=>`<option value="${c.id}">${c.id}번 칸</option>`).join('')}</select>${b('말 위치 수정','position')}
 <label>총 진행 횟수 (완료 시 최종 결과)<input id="turnsInput" type="number" min="1" max="999" value="${S.totalTurns}"></label>${b('횟수 적용','turns')}<div class="row">${b(S.sound?'효과음 ON':'효과음 OFF','sound')}${b('START 화면','opening')}${b('보드 복귀','board')}${b('최종 결과','finale')}${b('게임 초기화','reset','',false,'danger')}</div></details>
 <details id="bankDetails"><summary>Google Sheets 문제은행</summary><label>구글시트 또는 Apps Script 주소<input id="apiUrl" value="${esc(S.bankSource||safeRead(KEYS.api)||DEFAULT_BANK_URL||'')}" placeholder="https://script.google.com/macros/s/…/exec"></label>${b('문제 새로고침','refresh','',fetching||!board&&S.screen!=='start')}<p>${esc(bankMessage)}</p><p>선택 열 ‘배점’을 추가할 수 있습니다. 비우면 유형별 기본 점수를 적용합니다.</p></details></div>`;
 Object.entries(keep).forEach(([id,v])=>{if($(id)){if($(id).tagName==='DETAILS')$(id).open=v;else $(id).value=v;}});$('control').scrollTop=scroll;
 $('control').querySelectorAll('button').forEach(b=>{if(!authority&&!['takeover','logout'].includes(b.dataset.action))b.disabled=true;});
}

