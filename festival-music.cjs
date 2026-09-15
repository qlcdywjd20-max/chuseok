// Original instrumental game loop: pentatonic plucks, bass, chords and light drums.
// No recordings, samples, or existing song melodies are used.
const fs=require('fs');
function compose(file){
 const rate=22050,bpm=120,beat=60/bpm,bars=16,length=bars*4*beat,n=Math.round(length*rate),mix=new Float64Array(n);
 let seed=1789;const noise=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2147483648-1;};
 const freq=m=>440*2**((m-69)/12);
 function tone(at,dur,midi,amp,kind='pluck'){
  const f=freq(midi),start=Math.round(at*rate),count=Math.round(dur*rate);
  for(let i=0;i<count;i++){const t=i/rate,x=i/count,attack=Math.min(1,t/.008),tail=Math.min(1,(dur-t)/.035);let v;
   if(kind==='bass')v=Math.sin(2*Math.PI*f*t)*Math.exp(-t*5);
   else if(kind==='chord')v=(Math.sin(2*Math.PI*f*t)+.16*Math.sin(4*Math.PI*f*t))*Math.sin(Math.PI*x);
   else v=(Math.sin(2*Math.PI*f*t)+.32*Math.sin(4*Math.PI*f*t)+.12*Math.sin(6*Math.PI*f*t))*Math.exp(-t*7);
   mix[(start+i)%n]+=v*amp*attack*tail;
  }
 }
 function drum(at,kind){const dur=kind==='kick'?.22:.09,start=Math.round(at*rate);
  for(let i=0;i<dur*rate;i++){const t=i/rate;const v=kind==='janggu'?(Math.sin(2*Math.PI*190*t)*.13+noise()*.06)*Math.exp(-t*35):kind==='kick'?Math.sin(2*Math.PI*(52*t+45*.025*(1-Math.exp(-t/.025))))*Math.exp(-t*24)*.27:noise()*Math.exp(-t*(kind==='hat'?75:40))*(kind==='hat'?.035:.075);mix[(start+i)%n]+=v;}
 }
 const chords=[[60,64,67],[57,60,64],[53,57,60],[55,59,62]];
 const melodies=[[72,76,79,76,81,79,76,74],[76,79,81,79,76,74,72,76],[77,81,84,81,79,77,76,74],[79,76,74,71,74,76,79,72]];
 for(let bar=0;bar<bars;bar++){const c=chords[bar%4],mel=melodies[bar%4],at=bar*4*beat;
  for(let b=0;b<4;b++){drum(at+b*beat,'kick');drum(at+(b+.5)*beat,'hat');if(b%2){drum(at+b*beat,'snare');drum(at+b*beat,'janggu');}drum(at+(b+.75)*beat,'janggu');tone(at+b*beat,beat*.7,c[b%2?2:0]-24,.23,'bass');for(const m of c)tone(at+(b+.5)*beat,beat*.38,m,.035,'chord');}
  if(bar%4===3)for(const step of [3.25,3.5,3.75])drum(at+step*beat,'janggu');
  for(let k=0;k<8;k++){if(bar%4===3&&k===7)continue;tone(at+k*beat/2,beat*.7,mel[k]+(bar>=8&&bar<12?12:0),.12);tone(at+k*beat/2+beat*.75,beat*.5,mel[k],.022);}
 }
 const peak=mix.reduce((p,v)=>Math.max(p,Math.abs(v)),0),wav=Buffer.alloc(44+n*2);
 wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(n*2,40);
 for(let i=0;i<n;i++)wav.writeInt16LE(Math.round(mix[i]/peak*.8*32767),44+i*2);
 fs.writeFileSync(file,wav);return {seconds:length,peak:.8,bpm};
}
module.exports=compose;
