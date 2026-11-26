// Typography follows the exhibit clock. No second animation loop, font API or network dependency.
(()=>{const plane=document.querySelector('.parallax'),slugs=document.querySelector('.slugs'),arc=document.querySelector('#cultureArc'),strip=document.querySelector('#recurrence');let last=-1,prev=-1;
const plans=[[],[['500 54px EditionRoman','CHAOS']],[['italic 500 54px EditionRoman','Emergence']],[['500 54px EditionRoman','PERCEPTION'],['500 60px EditionSong','见']],[['italic 500 200px EditionRoman','Forma']],[['500 54px EditionRoman','INFINITY'],['500 58px EditionSong','无限']]],tasks=new Map();
window.EditionFonts=i=>{if(!document.fonts||!plans[i].length)return Promise.resolve();if(!tasks.has(i))tasks.set(i,Promise.race([Promise.allSettled(plans[i].map(([style,word])=>document.fonts.load(style,word))),new Promise(ok=>setTimeout(ok,1500))]));return tasks.get(i)};
window.EditionDraw=(act,t,energy,reduced,scene,mem)=>{if(act===5)window.EditionMotion?.(strip,t,energy,reduced);
if(act===prev&&t>=last&&t-last<1/24)return;prev=act;last=t;
if(act===1)slugs.style.setProperty('--ink',reduced?'0':Math.min(1,energy).toFixed(3));
if(act===2){const offset=Math.round(21*Math.min(1,Math.max(0,((mem.feed||.045)-.026)/.032)));arc.setAttribute('d','M12,202 Q247,'+(-45+offset)+' 631,97')}
if(act===3){const value=scene.stats?.().viewAngle||0;plane.style.setProperty('--view',(Math.max(-1,Math.min(1,value/57))).toFixed(3))}
};
})();
