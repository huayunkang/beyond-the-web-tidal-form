/* Original score. No samples, microphone, streaming audio or server data. */
window.BeyondScore=()=>{
 let ctx,master,an,osc=[],gains=[],pan,lp,noiseGain,enabled=false,bins,bands=[0,0,0],phrase=-1;
 const chords=[[65.406,98,164.81],[73.42,110,174.61],[82.407,123.47,207.65],[65.406,130.81,196]];
 function init(){if(ctx)return;const C=window.AudioContext||window.webkitAudioContext;if(!C)return;ctx=new C();master=ctx.createGain();master.gain.value=0;an=ctx.createAnalyser();an.fftSize=512;an.smoothingTimeConstant=.78;master.connect(an);an.connect(ctx.destination);bins=new Uint8Array(an.frequencyBinCount);
 pan=ctx.createStereoPanner?.()||ctx.createGain();pan.connect(master);lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=640;lp.Q.value=.72;lp.connect(pan);
 for(let i=0;i<3;i++){let o=ctx.createOscillator(),g=ctx.createGain();o.type=i===1?'triangle':'sine';o.frequency.value=chords[0][i];g.gain.value=.04;o.connect(g).connect(lp);o.start();osc.push(o);gains.push(g)}
 const buf=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),v=buf.getChannelData(0);let seed=583,x=0;for(let k=0;k<v.length;k++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;x=.94*x+.06*(seed/2147483648-1);v[k]=x}
 const n=ctx.createBufferSource();n.loop=true;n.buffer=buf;noiseGain=ctx.createGain();noiseGain.gain.value=.04;n.connect(noiseGain).connect(lp);n.start()}
 function set(on){try{if(on){init();if(!ctx)return false;ctx.resume().catch(()=>{});}enabled=!!on;if(master)master.gain.setTargetAtTime(enabled?.64:.00001,ctx.currentTime,.035);if(!on)bands=[0,0,0];return enabled}catch{return false}}
 function ping(act,x=.5){if(!enabled||!ctx)return;const t=ctx.currentTime,f=chords[act][2]*(x>.67?1.5:1);[1,2.01,3.98,6.42].forEach((r,i)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.frequency.value=f*r;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.10/(i+1),t+.016);g.gain.exponentialRampToValueAtTime(.0001,t+1.7-i*.21);o.connect(g).connect(pan);o.start();o.stop(t+1.74);o.onended=()=>{g.disconnect();o.disconnect()}})}
 function frame(f,index){if(!enabled||!ctx||document.hidden)return bands;const t=ctx.currentTime,e=f.mark.energy;for(let i=0;i<3;i++){osc[i].frequency.setTargetAtTime(chords[index][i]*(1+.0018*Math.sin(f.time*.6+i)),t,.48);gains[i].gain.setTargetAtTime(.035+(i===0?.055:.018)*(.55+e),t,.18)}
 lp.frequency.setTargetAtTime(400+f.mark.y*680+e*780,t,.17);noiseGain.gain.setTargetAtTime(.02+e*.25,t,.12);if(pan.pan)pan.pan.setTargetAtTime(.66*(f.mark.x-.5),t,.18);
 const beat=Math.floor(f.time/(index===3?2.25:3.8));if(beat!==phrase){phrase=beat;if(f.auto||index===3)ping(index,(beat%5)/5)}
 an.getByteFrequencyData(bins);function mean(a,b){let sum=0;for(let i=a;i<=b;i++)sum+=bins[i];return sum/((b-a+1)*255)}bands=[mean(0,3),mean(4,17),mean(18,55)];return bands}
 function visibility(){if(!ctx)return;if(document.hidden)ctx.suspend().catch(()=>{});else if(enabled)ctx.resume().catch(()=>{})}return{set,ping,frame,visibility,get on(){return enabled}}
};
