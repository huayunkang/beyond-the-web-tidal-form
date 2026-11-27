/* A preview never calls the scene loader. The real world changes only under the tile cover. */
window.FieldIndex=({acts,dialog,buttons,current,enter,reduced})=>{
 const $=id=>document.getElementById(id),key=$('indexKey'),home=$('indexHome'),stage=$('spaceStage'),shell=dialog.querySelector('.spaceShell'),tools=$('instruments'),go=$('enterAct');
 const lenses=[
 ['编排','一切复杂，始于简单的规则。','#c6b881'],['扰动','一次微小的扰动，足以改变整个世界。','#b86d56'],
 ['接种','没有谁设计每一道纹路，规则本身孕育了形态。','#c67b86'],['偏转','同一组构件，换个角度，还是同一个世界吗？','#a7beab'],
 ['塑形','规则定义可能，选择赋予意义。','#cfb9a4'],['回返','当边界消失，创造才刚刚开始。','#abc3cb']];
 const plates=acts.map((_,i)=>'plates/0'+(i+1)+'.webp');
 let state='closed',choice=0,carousel=null;
 const setState=s=>{state=s;dialog.dataset.state=s}, tiles=OrbitTiles($('entryTiles'),{reduced});
 const gate=OrbitGate({key,dialog,surface:shell,reduced,onClosed:()=>{if(state==='closing')finish()}});
 function keyState(v){key.setAttribute('aria-expanded',String(v));key.setAttribute('aria-label',v?'收起展谱':'打开展谱');const t=key.querySelector('.gateText');if(t)t.textContent=v?'收起':'展谱'}
 function focusLens(i){choice=((i%6)+6)%6;const [cn,en,roman]=acts[choice],[verb,phrase,accent]=lenses[choice];
  dialog.dataset.preview=choice;dialog.style.setProperty('--hueInk',accent);
  $('lensNo').textContent='0'+(choice+1);$('lensVerb').textContent=verb;$('spaceCN').textContent=cn;$('spaceEN').textContent=en;
  $('spacePhrase').textContent=phrase;$('enterLabel').textContent='进入'+cn+'实验';$('spaceStatus').textContent='观察 '+roman+'，'+cn+'。'+phrase;
  buttons.forEach((b,j)=>{b.setAttribute('aria-pressed',String(choice===j));b.setAttribute('aria-current',String(current()===j))});
  if(!reduced()&&go.animate){for(const el of [$('spaceCN'),$('spaceEN')]){el.getAnimations().forEach(a=>a.cancel());el.animate([{transform:'perspective(600px) rotateX(-35deg) translateY(.16em)',opacity:.2},{transform:'none',opacity:1}],{duration:400,easing:'cubic-bezier(.16,1,.3,1)'})}}
 }
 function select(i){if(state==='open')carousel?.select((i+6)%6)}
 for(let i=0;i<6;i++){const b=document.createElement('button');b.type='button';b.dataset.act=i;b.setAttribute('aria-label','预览'+acts[i][2]+' '+acts[i][0]);b.textContent=acts[i][2];b.onclick=()=>select(i);$('waypoints').append(b);buttons.push(b)}
 $('phaseNext').onclick=()=>select(choice+1);$('phasePrev').onclick=()=>select(choice-1);
 function open(){if(state==='entering'||state==='open')return;const fresh=state==='closed';setState('open');if(fresh){dialog.append(key);dialog.showModal();tools.open=false;if(!$('meter').hidden)$('observe').click();key.focus({preventScroll:true});}
  keyState(true);gate.set(true);if(fresh){carousel=OrbitCarousel(stage,{acts,plates,reduced,onSelect:focusLens});choice=current();carousel.select(choice,true);focusLens(choice)}else carousel?.suspend?.(false)}
 function close(){if(state!=='open')return;setState('closing');tools.open=false;keyState(false);carousel?.suspend?.(true);gate.set(false)}
 function toggle(){if(state==='open')close();else if(state!=='entering')open()}
 function finish(){carousel?.destroy();carousel=null;tools.open=false;tiles.clear();setState('closed');if(dialog.open)dialog.close();home.append(key);keyState(false);key.focus({preventScroll:true})}
 function ready(i){return new Promise(resolve=>{const until=performance.now()+8500;function sample(){const s=window.BeyondApp?.snapshot();if((s?.act===i&&s.transition===null&&s.ready)||performance.now()>until){resolve();return}setTimeout(sample,35)}sample()})}
 async function enterFocus(){if(state!=='open')return;const i=choice,rect=carousel?.activeRect?.()||stage.getBoundingClientRect();setState('entering');tools.open=false;carousel?.suspend?.(true);let committed=false;
  const commit=()=>{if(committed)return;committed=true;dialog.dataset.cover='true';gate.set(false,true);enter(i)};
  try{await tiles.play({image:plates[i],origin:rect,enter:commit,ready:()=>ready(i)})}catch(err){console.warn('图版转场不可用，直接进入现场',err)}
  finally{commit();await ready(i);gate.set(false,true);delete dialog.dataset.cover;finish()}}
 go.onclick=enterFocus;key.onclick=toggle;dialog.addEventListener('cancel',e=>{e.preventDefault();if(tools.open){tools.open=false;tools.querySelector('summary').focus()}else if(state!=='entering')toggle()});
 dialog.addEventListener('keydown',e=>{if(e.altKey||e.ctrlKey||e.metaKey||state==='entering')return;
 if(e.key==='Tab'){const able=[...dialog.querySelectorAll('summary,button,a[href],[tabindex="0"]')].filter(el=>el.tabIndex>=0&&getComputedStyle(el).visibility==='visible'&&el.getClientRects().length&&(!tools.contains(el)||tools.open||el.tagName==='SUMMARY'));if(able.length&&((e.shiftKey&&document.activeElement===able[0])||(!e.shiftKey&&document.activeElement===able.at(-1)))){e.preventDefault();(e.shiftKey?able.at(-1):able[0]).focus()}return}
 if(tools.open&&tools.contains(e.target))return;if(['ArrowRight','ArrowLeft','ArrowUp','ArrowDown','Home','End'].includes(e.key)||/^[1-6]$/.test(e.key)){e.preventDefault();const i=/^[1-6]$/.test(e.key)?+e.key-1:e.key==='Home'?0:e.key==='End'?5:choice+(['ArrowRight','ArrowDown'].includes(e.key)?1:-1);select(i);return}
 if(e.target===stage&&(e.key==='Enter'||e.key===' ')){e.preventDefault();enterFocus()}});
 return {open,close,toggle,showMeter(on){$('liveName').textContent='正在运行：'+acts[current()][0];if(on)tools.open=true},motionChanged(){if(state==='open'){carousel?.suspend?.(true);carousel?.suspend?.(false)}}};
};
