/*! Orbit / field index. MagneticButtons (Codrops 2009–2020, MIT), ExpandingRoundedMenu and
 * Theodore (Codrops 2009–2021, MIT). See licenses/Codrops-MagneticButtons-MIT.txt,
 * licenses/Codrops-ExpandingRoundedMenu-MIT.txt, licenses/Codrops-Theodore-MIT.txt.
 * Source modules, retained timing/geometry and artwork changes: research/空间展谱-入口.md. */
(() => {
  'use strict';
  let sequence=0;
  const SVG='http://www.w3.org/2000/svg',clamp=t=>Math.max(0,Math.min(t,1));
  const mix=(a,b,t)=>(1-t)*a+t*b, ease4=t=>t<.5?8*t**4:1-8*(1-t)**4;
  function svg(name,attrs={}){const n=document.createElementNS(SVG,name);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);return n}
  window.OrbitGate=({key,dialog,surface,reduced=false,onClosed=()=>{}})=>{
    const still=()=>typeof reduced==='function'?!!reduced():!!reduced;
    const focusMedia=matchMedia('(any-hover: hover) and (any-pointer: fine)');
    const before=[...key.childNodes],text=key.querySelector('.gateText')||document.createElement('span');
    text.className='gateText';if(!text.textContent.trim())text.textContent='展谱';
    key.classList.add('orbitControl');
    const wheel=svg('svg',{viewBox:'0 0 60 44','aria-hidden':'true',focusable:'false','class':'orbitWheel'});
    const dial=svg('g',{'class':'orbitDial'}),pupil=svg('g',{'class':'orbitPupil'});
    dial.append(svg('ellipse',{cx:30,cy:23,rx:22,ry:12,transform:'rotate(-32 30 23)','class':'outerArc'}),svg('ellipse',{cx:30,cy:23,rx:17,ry:8,transform:'rotate(29 30 23)','class':'innerArc'}));
    pupil.append(svg('path',{d:'M22 23H38M30 16V30','class':'sightMark'}),svg('circle',{cx:30,cy:23,r:2.8,'class':'sightCore'}));
    dial.append(svg('circle',{cx:48.7,cy:11.1,r:2.5,'class':'orbitBody'}));wheel.append(dial,pupil);
    const face=document.createElement('span');face.className='orbitFace';face.append(wheel,text);key.replaceChildren(face);
    const id='orbit-reveal-'+(++sequence),defs=svg('svg',{width:0,height:0,focusable:'false','aria-hidden':'true','class':'orbitDefs'});
    const d=svg('defs'),clip=svg('clipPath',{id,clipPathUnits:'objectBoundingBox'}),wave=svg('path');clip.append(wave);d.append(clip);defs.append(d);dialog.append(defs);
    const page=document.documentElement,body=document.body;let t=0,goal=0,af=0,mf=0,last=0,mx=0,my=0,px=0,py=0,dead=false;
    // MagneticButtons/demo1/buttonCtrl.js: same trigger radius, pull, damped interpolation and reversed label pull.
    function magnet(){mf=0;px=mix(px,mx,.1);py=mix(py,my,.1);if(Math.abs(px-mx)+Math.abs(py-my)<.04){px=mx;py=my}
      face.style.transform='translate3d('+px.toFixed(2)+'px,'+py.toFixed(2)+'px,0)';
      text.style.transform='translate3d('+(-px*.6).toFixed(2)+'px,'+(-py*.6).toFixed(2)+'px,0)';
      if(px!==mx||py!==my)mf=requestAnimationFrame(magnet)
    }
    function aim(x,y){if(still()){x=y=0;px=py=0}mx=x;my=y;if(!mf)mf=requestAnimationFrame(magnet)}
    function move(e){if(!focusMedia.matches||e.pointerType!=='mouse'||still())return;
      const rect=key.getBoundingClientRect(),x=e.clientX-(rect.x+rect.width/2),y=e.clientY-(rect.y+rect.height/2);
      if(Math.hypot(x,y)<rect.width*.7)aim(x*.3,y*.3);
      else if(mx!==0||my!==0)aim(0,0)
    }
    function reset(){aim(0,0)}
    function paint(){
      const a=clamp(t/.67),b=clamp((t-.67)/.33);
      // Theodore: rotate its V/Q wave 90°. (1,1) → (.5,0) → (0,0)
      // Right-hand aperture gathers vertically at its origin before it reaches the corners.
      const head=1-.5*a**5-.51*(1-(1-b)**3), control=1-a**5-.01*b;
      const height=.5*(1-(1-t)**3);
      wave.setAttribute('d','M1 '+(.5-height)+' H'+head+' Q'+control+' .5 '+head+' '+(.5+height)+' H1 Z');
      const z=ease4(t);
      surface.style.clipPath=t===1?'none':'url(#'+id+')';
      // Keep the real 3D camera undisturbed once open: no perma-transform on the shell.
      surface.style.setProperty('--gate-cover-scale',(1+.1*(1-z)).toFixed(4));
      page.style.setProperty('--gate-scene-scale',(1-.058*z).toFixed(4));
      page.style.setProperty('--gate-scene-sat',(1-.60*z).toFixed(4));
      wheel.style.setProperty('--gate-angle',(z*132).toFixed(2)+'deg');
      key.dataset.orbit=String(goal===1?'open':'closed');
      surface.dataset.gateTransit=t===0||t===1?'rest':'travel';
    }
    function tick(now){af=0;if(dead)return;const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;
      t=still()?goal:clamp(t+(goal===1?1:-1)*dt/.79);paint();
      if(t!==goal)af=requestAnimationFrame(tick);
      else {if(t===0){body.classList.remove('orbitIndexActive');onClosed()}}
    }
    function set(open,instant=false){if(dead)return;const next=open?1:0,previous=goal;goal=next;
      if(next)body.classList.add('orbitIndexActive');
      if(instant||still()){
        cancelAnimationFrame(af);af=0;const alreadyClosed=t===0&&previous===0;t=goal;paint();if(!t){body.classList.remove('orbitIndexActive');if(!alreadyClosed||dialog.open)onClosed()}return
      }
      if(t===goal){cancelAnimationFrame(af);af=0;paint();if(!goal&&previous!==goal){body.classList.remove('orbitIndexActive');onClosed()}return}
      if(!af){last=performance.now();af=requestAnimationFrame(tick)}else paint()
    }
    window.addEventListener('pointermove',move,{passive:true});window.addEventListener('blur',reset);key.addEventListener('pointercancel',reset);paint();
    return {set,destroy(){dead=true;cancelAnimationFrame(af);cancelAnimationFrame(mf);window.removeEventListener('pointermove',move);window.removeEventListener('blur',reset);key.removeEventListener('pointercancel',reset);body.classList.remove('orbitIndexActive');page.style.removeProperty('--gate-scene-scale');page.style.removeProperty('--gate-scene-sat');surface.style.removeProperty('--gate-cover-scale');surface.style.removeProperty('clip-path');delete surface.dataset.gateTransit;delete key.dataset.orbit;key.classList.remove('orbitControl');key.replaceChildren(...before);defs.remove()}}
  }
})();
