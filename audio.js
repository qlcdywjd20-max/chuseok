/* Local recordings only. Attribution and permitted uses: /audio/LICENSES.md. */
function createFestivalAudio({document:doc, window:win, fallback=()=>{}}) {
  const make=(id,src,loop=false)=>{const a=doc.createElement('audio');a.id=id;a.src=src;a.loop=loop;a.preload='auto';a.hidden=true;doc.body.append(a);return a;};
  const bgm=make('festivalBgm','/audio/how-are-you-gayageum.mp3',true);
  const success=make('festivalSuccess','/audio/correct-bell.wav');
  let state={},unlocked=false,ducked=false,playing=false,restoreTimer=null;
  const seen=new Set();let first=true;
  const baseVolume=()=>Math.max(0,Math.min(1,Number.isFinite(Number(state.bgmVolume))?Number(state.bgmVolume):.12));
  const wanted=()=>state.bgmOn!==false&&!state.paused&&(state.bgmStarted??(state.screen&&state.screen!=='start'));
  const gain=()=>{bgm.volume=baseVolume()*(ducked?.2:1);};
  function restore(){win.clearTimeout(restoreTimer);restoreTimer=null;ducked=false;gain();}
  function sync(){gain();if(!wanted()){bgm.pause();return;}if(bgm.paused&&!playing){playing=true;bgm.play().then(()=>{bgm.dataset.status='playing';if(!wanted())bgm.pause();}).catch(e=>{bgm.dataset.status=e.name==='NotAllowedError'?'click-required':'load-error';}).finally(()=>{playing=false;});}}
  function unlock(){
    // Called in this display window's real pointer/key gesture, not a remote admin click.
    // Prime both media elements while activation is available; no on-screen controls.
    if(unlocked)return;
    fallback('unlock');
    success.volume=0;
    success.play().then(()=>{success.pause();success.currentTime=0;success.volume=.7;unlocked=true;sync();}).catch(()=>{success.volume=.7;});
    sync();
  }
  function playSuccess(){
    if(!unlocked||state.sound===false)return;
    restore();success.pause();success.currentTime=0;success.volume=.7;
    ducked=true;gain();success.dataset.plays=String(Number(success.dataset.plays||0)+1);
    success.play().then(()=>{restoreTimer=win.setTimeout(restore,5000);}).catch(()=>{restore();success.dataset.status='load-error';fallback('answer');});
  }
  success.addEventListener('ended',restore);success.addEventListener('error',restore);
  win.addEventListener('pointerdown',unlock,{capture:true});win.addEventListener('keydown',unlock,{capture:true});
  function update(next){state=next;sync();if(state.sound===false){success.pause();restore();}
    const cue=state.audioCue;
    if(first){first=false;if(cue)seen.add(cue.id);return;}
    if(!cue||seen.has(cue.id))return;
    seen.add(cue.id);if(seen.size>256)seen.delete(seen.values().next().value);
    if(!unlocked||state.sound===false||Date.now()-cue.at>4000||Date.now()-cue.at< -1000||(state.paused&&!['test','successTest'].includes(cue.kind)))return;
    if(['success','successTest'].includes(cue.kind))playSuccess();else fallback(cue.kind);
  }
  return {update,unlock};
}
if(typeof module!=='undefined')module.exports={createFestivalAudio};
