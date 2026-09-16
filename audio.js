/* Local recordings only. Attribution and permitted uses: /audio/LICENSES.md. */
function createFestivalAudio({document:doc, window:win, fallback=()=>{}}) {
  const make=(id,src,loop=false)=>{const a=doc.createElement('audio');a.id=id;a.src=src;a.loop=loop;a.preload='auto';a.hidden=true;doc.body.append(a);return a;};
  const bgm=make('festivalBgm','/audio/four-beers-polka.mp3',true);
  const success=make('festivalSuccess','/audio/correct-bell.wav');
  const effects={success,applause:make('festivalApplause','/audio/applause.wav'),fanfare:make('festivalFanfare','/audio/ta-da.mp3')};
  let activeEffect=null,effectToken=0;
  function stopEffects(){effectToken++;for(const a of Object.values(effects)){a.pause();a.currentTime=0;}activeEffect=null;restore();}
  let state={},unlocked=false,ducked=false,playing=false,restoreTimer=null,muted=false,controls=null;
  const seen=new Set();let first=true,priming=Promise.resolve();
  const baseVolume=()=>Math.max(0,Math.min(1,Number.isFinite(Number(state.bgmVolume))?Number(state.bgmVolume):.12));
  const wanted=()=>unlocked&&!muted&&state.bgmOn!==false&&!state.paused;
  const gain=()=>{bgm.volume=baseVolume()*(ducked?.2:1);};
  function restore(){win.clearTimeout(restoreTimer);restoreTimer=null;ducked=false;gain();}
  function sync(){gain();if(!wanted()){bgm.pause();report();return;}if(bgm.paused&&!playing){playing=true;bgm.play().then(()=>{bgm.dataset.status='playing';if(!wanted())bgm.pause();report();}).catch(e=>{bgm.dataset.status=e.name==='NotAllowedError'?'click-required':'load-error';report();}).finally(()=>{playing=false;});}}
  function unlock(){
    // Both play calls must originate in this window's user gesture, before awaiting.
    muted=false;fallback('unlock');if(bgm.error)bgm.load();
    if(!unlocked){priming=Promise.all(Object.values(effects).map(a=>{a.volume=0;return a.play().then(()=>{a.pause();a.currentTime=0;a.volume=.7;}).catch(()=>{a.volume=.7;});}));}
    unlocked=true;playing=false;sync();report();return priming;
  }
  function playSuccess(kind='success'){
    if(!unlocked||muted||state.sound===false)return;
    stopEffects();const sound=effects[kind],token=effectToken;activeEffect=sound;sound.volume=.7;
    ducked=true;gain();sound.dataset.plays=String(Number(sound.dataset.plays||0)+1);
    sound.play().then(()=>{if(token!==effectToken)return;restoreTimer=win.setTimeout(()=>{if(activeEffect===sound){sound.pause();activeEffect=null;restore();}},Math.min(60000,(Number.isFinite(sound.duration)?sound.duration+1:45)*1000));}).catch(()=>{if(token!==effectToken)return;activeEffect=null;restore();sound.dataset.status='load-error';fallback('answer');});
  }
  for(const sound of Object.values(effects))for(const event of ['ended','error'])sound.addEventListener(event,()=>{if(activeEffect===sound){activeEffect=null;restore();}});
  const gesture=()=>{if(!muted&&(!unlocked||bgm.dataset.status==='click-required'))unlock();};
  win.addEventListener('pointerdown',gesture,{capture:true});win.addEventListener('keydown',gesture,{capture:true});
  function update(next){state=next;sync();if(state.sound===false)stopEffects();
    const cue=state.audioCue;
    if(first){first=false;if(cue)seen.add(cue.id);return;}
    if(!cue||seen.has(cue.id))return;
    seen.add(cue.id);if(seen.size>256)seen.delete(seen.values().next().value);
    if(!unlocked||muted||state.sound===false||Date.now()-cue.at>12000||Date.now()-cue.at< -1000||(state.paused&&!['test','successTest','applause','fanfare','soundStop'].includes(cue.kind)))return;
    if(cue.kind==='soundStop')stopEffects();else if(['applause','fanfare'].includes(cue.kind))playSuccess(cue.kind);else if(['success','successTest'].includes(cue.kind))playSuccess();else fallback(cue.kind);
  }
  function report(){
    if(!controls)return;
    const message=muted?'이 창 음소거':bgm.error?'음원 로드 실패 · 소리 켜기로 재시도':!unlocked||bgm.dataset.status==='click-required'?'이 창에서 소리 켜기를 눌러주세요':state.bgmOn===false?'관리자 BGM OFF':state.paused?'행사 일시정지':baseVolume()===0?'BGM 음량 0%':!bgm.paused?'BGM 재생 중 · '+Math.round(baseVolume()*100)+'%':'BGM 연결 중';
    controls.querySelector('[role=status]').textContent=message;
  }
  function setMuted(value){muted=value;if(muted)stopEffects();sync();report();}
  function mount(){
    if(controls)return;
    controls=doc.createElement('details');controls.id='broadcastAudioControls';controls.open=true;
    controls.style.cssText='position:fixed;right:12px;bottom:12px;z-index:9999;padding:10px 16px;background:#fff9ebee;border:1px solid #ba975d;border-radius:16px;max-width:310px;color:#513b21;font:16px system-ui;box-shadow:0 3px 18px #0002';
    controls.innerHTML='<summary style="cursor:pointer">♫ 이 창 송출 음향</summary><div style="display:flex;gap:8px;margin-top:8px"><button type="button" data-local="on">소리 켜기 / 재시도</button><button type="button" data-local="test">이 창 성공음 테스트</button><button type="button" data-local="off">이 창 음소거</button></div><p role="status" style="font-size:14px;margin:8px 0"></p><p style="font-size:12px;margin:0">음향은 실제 공유할 창 한 곳에서 켜주세요. 화면 공유 시 탭 오디오/컴퓨터 소리 공유도 켜주세요.</p>';
    controls.querySelectorAll('button').forEach(b=>{b.style.cssText='font:14px system-ui;padding:8px;border:1px solid #cbb687;border-radius:8px;cursor:pointer;background:#fff2ca;color:#513b21';});
    controls.querySelector('[data-local=on]').onclick=unlock;
    controls.querySelector('[data-local=off]').onclick=()=>setMuted(true);
    controls.querySelector('[data-local=test]').onclick=()=>{unlock().then(()=>{success.volume=.7;success.currentTime=0;success.play().catch(()=>fallback('answer'));});};
    doc.body.append(controls);report();
  }
  for(const event of ['playing','pause','error','volumechange'])bgm.addEventListener(event,report);
  return {update,unlock,setMuted,mount};
}
if(typeof module!=='undefined')module.exports={createFestivalAudio};
