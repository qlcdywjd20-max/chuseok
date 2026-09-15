const assert=require('assert'),{createFestivalAudio}=require('./audio.js');
(async()=>{
 const elements=[],handlers={},fallback=[];let reject=false;
 const doc={body:{append(a){elements.push(a)}},createElement(){return {paused:true,currentTime:0,volume:1,dataset:{},listeners:{},addEventListener(k,f){this.listeners[k]=f},play(){this.calls=(this.calls||0)+1;if(reject)return Promise.reject(Error('file unavailable'));this.paused=false;return Promise.resolve()},pause(){this.paused=true}}}};
 const win={addEventListener(k,f){handlers[k]=f},setTimeout,clearTimeout};const audio=createFestivalAudio({document:doc,window:win,fallback:k=>fallback.push(k)}),[bgm,sfx]=elements;
 let s={screen:'start',sound:true,bgmOn:true,bgmVolume:.12};audio.update(s);assert(bgm.paused);assert(bgm.loop);audio.unlock();await new Promise(r=>setImmediate(r));assert(!bgm.paused,'BGM ON plays before game starts after a local click');audio.setMuted(true);assert(bgm.paused);handlers.pointerdown();assert(bgm.paused,'other clicks must not undo local mute');audio.unlock();await new Promise(r=>setImmediate(r));assert(!bgm.paused);s={...s,screen:'board',bgmStarted:true};audio.update(s);await new Promise(r=>setImmediate(r));assert(!bgm.paused);assert.equal(bgm.volume,.12);
 const cue={id:'correct-1',kind:'success',at:Date.now()};audio.update({...s,audioCue:cue});await new Promise(r=>setImmediate(r));assert.equal(bgm.volume,.024);assert.equal(sfx.dataset.plays,'1');audio.update({...s,audioCue:cue});assert.equal(sfx.dataset.plays,'1');
 audio.update({...s,bgmVolume:.3,audioCue:cue});assert.equal(bgm.volume,.06);sfx.listeners.ended();assert.equal(bgm.volume,.3);
 audio.update({...s,audioCue:{id:'old',kind:'success',at:Date.now()-20000}});assert.equal(sfx.dataset.plays,'1');audio.update({...s,paused:true});assert(bgm.paused);
 audio.update({...s,paused:false});await new Promise(r=>setImmediate(r));assert(!bgm.paused);audio.update({...s,bgmOn:false});assert(bgm.paused);
 audio.update({...s,sound:false,audioCue:{id:'muted',kind:'success',at:Date.now()}});assert.equal(sfx.dataset.plays,'1');
 const applause=elements[2],fanfare=elements[3];
 const manual={...s,paused:true,audioCue:{id:'clap',kind:'applause',at:Date.now()}};audio.update(manual);await new Promise(r=>setImmediate(r));assert(!applause.paused);assert.equal(applause.dataset.plays,'1');audio.update(manual);assert.equal(applause.dataset.plays,'1');assert.equal(bgm.volume,.024);
 audio.update({...manual,audioCue:{id:'fan',kind:'fanfare',at:Date.now()}});await new Promise(r=>setImmediate(r));assert(applause.paused);assert(!fanfare.paused);applause.listeners.ended();assert.equal(bgm.volume,.024,'old effect must not restore current effect gain');
 audio.update({...manual,audioCue:{id:'stop',kind:'soundStop',at:Date.now()}});assert(fanfare.paused);assert.equal(bgm.volume,.12);
 reject=true;audio.update({...s,audioCue:{id:'failed',kind:'success',at:Date.now()}});await new Promise(r=>setImmediate(r));assert.equal(bgm.volume,.12);assert(fallback.includes('answer'));
 console.log('PASS: explicit start-screen unlock, local mute/retry, local files, start gating, loop, 12% default, exactly-once success, duck 2.4%, restore, changed volume, stale cue, pause/mute/resume, missing-file fallback.');
})().catch(e=>{console.error(e);process.exitCode=1});
