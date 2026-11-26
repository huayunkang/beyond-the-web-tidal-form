/*! Codrops Repetitive Typography (MIT), Copyright (c) 2009–2021 Codrops.
 * Source: 9bd910cadc638ac3a855690600eecf485504b6e1/src/js/index.js, start / step2 / step3.
 * Retained: alternating clipped glyph exchange, center repeat pair stagger, row staggering and timing.
 * Exhibit: four foreshortened rows rather than an image-grid reveal; scroll-independent shared clock.
 * See licenses/Codrops-RepetitiveTypography-MIT.txt. No GSAP runtime, external typeface or photo. */
(() => {
  const states = new WeakMap(), word = 'INFINITUM', clamp = x => Math.max(0, Math.min(1,x));
  const letterDirection = pos => pos%2 ? 1 : -1;
  // Original repeatedCenterTitleChars.stagger function.
  const pairDelay = index => index%2 == 0 ? 0.08*(index/2) : 0.08*(index-(index-1)/2-1);
  const expo = x => x <= 0 ? 0 : x >= 1 ? 1 : x < .5 ? 2**(20*x-11) : 1-2**(-20*x+9);
  const ramp = (t,start,duration=.7) => expo(clamp((t-start)/duration));
  function init(root) {
    root.setAttribute('aria-hidden','true');root.style.pointerEvents='none';
    const strip=document.createElement('span');strip.style.cssText='display:block;position:relative;width:100%;height:3.4em;color:inherit;font-family:EditionRoman,Georgia,serif;font-weight:500;font-style:normal;line-height:.96;letter-spacing:.035em;white-space:nowrap;isolation:isolate;';
    const rows=[];
    for(let row=0;row<4;row++){
      const box=document.createElement('span');
      box.style.cssText='display:flex;align-items:baseline;position:absolute;left:0;right:0;top:0;line-height:.96;overflow:hidden;transform-origin:0 50%;';
      let glyphs=[];
      for(const ch of word){const glyph=document.createElement('span');glyph.textContent=ch;glyph.style.cssText='display:inline-block;flex:0 0 auto;line-height:1.06;font:inherit;';box.append(glyph);glyphs.push(glyph)}
      strip.append(box);rows.push({box,glyphs})
    }
    root.replaceChildren(strip);const state={rows,last:-1,energy:-1};states.set(root,state);return state
  }
  window.EditionMotion=function(root,age,energy=0,reduced=false){
    if(!root)return;
    const state=states.get(root)||init(root);const h=clamp(Number(energy)||0);
    // States are sampled at display cadence, not by an extra rAF. Stop repeating in reduced motion.
    const t=reduced?4.6:(Math.max(0,Number(age)||0)%9.4);
    const stamp=Math.floor(t*30),load=Math.round(h*16);
    if(stamp===state.last&&load===state.energy)return;
    state.last=stamp;state.energy=load;
    const enter=t<7.3?t:Math.max(.4,4.7*(9.4-t)/2.1);
    state.rows.forEach(({box,glyphs},row)=>{
      const channel=row/3;
      const descend=ramp(enter,1.37+row/12), repeat=ramp(enter,1.42+.09*row);
      const plate=[1,.78,.57,.36][row], line=[0,1.26,2.19,2.86][row];
      const scale=plate*(row?(.7+.3*repeat):1);
      const dx=(.06*row+(.08+.11*h)*row*repeat);
      box.style.transform='translate('+dx.toFixed(3)+'em,'+(line*descend).toFixed(3)+'em) scale('+scale.toFixed(4)+')';
      box.style.opacity=(row?(1-channel*.34)*descend:1).toFixed(3);
      glyphs.forEach((g,i)=>{
        if(!row){
          // A single stable opening word; its odd/even glyphs split and reunite.
          const depart=ramp(enter,.4+.02*i), land=ramp(enter,1.37+pairDelay(i));
          g.style.transform='translateY('+(letterDirection(i)*100*(depart-land)).toFixed(1)+'%)';
        }else{
          const slide=ramp(enter,.55+(row-1)*.09+pairDelay(i));
          g.style.transform='translateY('+(letterDirection(i)*100*(1-slide)).toFixed(1)+'%)';
        }
      })
    })
  }
})();
