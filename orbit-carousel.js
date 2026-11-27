/* Spatial edition / 3D transform and spring adapted from Codrops 3DCarousel.
 * Copyright (c) 2009–2026 Codrops. See licenses/Codrops-3DCarousel-MIT.txt.
 * Six-position focus, input, optics and single decoder lifecycle are local. */
window.OrbitCarousel=function(host,{onSelect=()=>{},reduced=false,plates=[],acts=[]}={}){
 const N=6,step=360/N,clamp=(lo,hi,n)=>Math.max(lo,Math.min(hi,n)),wrap=n=>(n%N+N)%N;
 const less=()=>typeof reduced==='function'?reduced():!!reduced;
 const mk=(name,cls,parent)=>{const el=document.createElement(name);el.className=cls;parent.append(el);return el};
 const viewport=mk('div','orb-viewport',host),datum=mk('div','orb-datum',viewport),world=mk('div','orb-world',viewport);
 viewport.setAttribute('aria-hidden','true');datum.innerHTML='<svg viewBox="0 0 1200 360" preserveAspectRatio="none" aria-hidden="true"><g fill="none" stroke="currentColor" vector-effect="non-scaling-stroke"><ellipse cx="600" cy="182" rx="567" ry="157"/><path d="M33 182h17m1100 0h17M596 25h8m-8 314h8"/><ellipse class="orb-subline" cx="600" cy="182" rx="550" ry="152" stroke-dasharray="1 10"/></g></svg>';
 const cells=[],faces=[],windows=[],imgs=[];
 for(let i=0;i<N;i++){
  const cell=mk('div','orb-cell',world),face=mk('div','orb-art',cell),film=mk('div','orb-film',face),img=mk('img','orb-print',film);
  face.dataset.act=i;face.dataset.orb=i;img.src=plates[i]||'plates/0'+(i+1)+'.webp';img.draggable=false;img.alt='';img.decoding='async';
  const slug=mk('span','orb-slug',face);slug.textContent='FIG. 0'+(i+1)+'   /   '+(acts[i]?.[1]||['ORDER','CHAOS','EMERGENCE','PERCEPTION','CREATION','INFINITY'][i]);
  cells.push(cell);faces.push(face);windows.push(film);imgs.push(img);
 }
 const video=document.createElement('video');video.className='orb-movement';video.loop=true;video.muted=true;video.defaultMuted=true;video.playsInline=true;video.preload='none';video.setAttribute('aria-hidden','true');
 let focused=0,radius=500,ratio=.12,spin=0,target=0,frame=0,last=0,drag=null,suspended=false,dead=false;
 let pressure=0,pressVelocity=0,lean=0,leanVelocity=0,impulse=0,wheelSum=0,wheelTime=-Infinity,wheelLock=-Infinity;
 let videoId=-1,clipToken=0,timer=0;
 function stopVideo(){
  const had=video.hasAttribute('src');clearTimeout(timer);timer=0;clipToken++;videoId=-1;video.onplaying=video.onerror=null;
  video.pause();video.classList.remove('orb-playing');video.remove();if(had){video.removeAttribute('src');video.load()}
 }
 function scheduleVideo(){
  stopVideo();if(suspended||dead||less()||navigator.connection?.saveData||document.hidden)return;
  const id=focused,token=clipToken;
  timer=setTimeout(()=>{if(token!==clipToken||dead||suspended||drag||id!==focused)return;
   videoId=id;video.onplaying=()=>{if(id===videoId&&token===clipToken)video.classList.add('orb-playing')};video.onerror=()=>{if(token===clipToken)stopVideo()};
   video.src='loops/0'+(id+1)+'.mp4';windows[id].append(video);
   const p=video.play();if(p?.catch)p.catch(()=>{if(token===clipToken)stopVideo()});
  },230);
 }
 function getCarouselCellTransforms(count,r){const angleStep=360/count;return Array.from({length:count},(_,i)=>
  'rotateY(calc('+(i*angleStep)+'deg + var(--spin, 0deg))) translateZ(calc('+r+'px + var(--spread, 0px) + var(--spin-spread, 0px)))');}
 function draw(){
  world.style.setProperty('--spin',spin.toFixed(3)+'deg');world.style.setProperty('--spin-spread',pressure.toFixed(2)+'px');world.style.setProperty('--spin-lean',lean.toFixed(3)+'deg');
  for(let i=0;i<N;i++){const k=Math.cos((i*step+spin)*Math.PI/180);faces[i].style.visibility=k<-.08?'hidden':'visible';
   faces[i].style.setProperty('--strength',clamp(.36,1,.31+.69*k).toFixed(3));faces[i].dataset.focus=i===focused?'true':'false';}
 }
 function resize(){
  if(dead)return;const {width:w,height:h}=host.getBoundingClientRect();if(!w||!h)return;
  const portrait=w<=730&&h>w,short=h<480,ox=portrait?.5:.56,oy=portrait?.415:short?.41:.425;
  radius=Math.round(w*(portrait?.625:.475));ratio=.12*(portrait?2.45:1);
  const artw=Math.min(w*(portrait?.665:.464),h*(portrait?.74:1.03),855),arth=artw*.70;
  for(const [k,v] of Object.entries({'--orbit-r':radius+'px','--orbit-p':Math.round(Math.max(portrait?540:800,w*.92))+'px','--ox':ox*100+'%','--oy':oy*100+'%','--aw':artw+'px','--ah':arth+'px'}))viewport.style.setProperty(k,v);
  const transforms=getCarouselCellTransforms(N,radius);cells.forEach((el,i)=>el.style.transform=transforms[i]);draw()
 }
 function pump(time){frame=0;if(dead||suspended)return;const dt=Math.min(1/30,Math.max(.001,(time-last)/1000||1/60));last=time;
  const d=target-spin;spin+=d*(1-Math.exp(-dt*(drag?21:9.8)));if(Math.abs(target-spin)<.018)spin=target;
  // Codrops spring constants: speed spreads the ring and leans its plates.
  const speed=drag?impulse:Math.min(900,Math.abs(d)*11);
  const pressTarget=Math.min(180,speed*.05),leanTarget=clamp(-20,20,(drag?drag.speed:Math.sign(d)*speed)*.006);
  pressVelocity+=(120*(pressTarget-pressure)-14*pressVelocity)*dt;pressure+=pressVelocity*dt;
  leanVelocity+=(120*(leanTarget-lean)-14*leanVelocity)*dt;lean+=leanVelocity*dt;impulse*=Math.exp(-dt*7);
  if(Math.abs(d)+Math.abs(pressure)+Math.abs(pressVelocity)+Math.abs(leanVelocity)+Math.abs(lean)<.12&&!drag){spin=target;pressure=pressVelocity=lean=leanVelocity=0;draw();return}
  draw();frame=requestAnimationFrame(pump);
 }
 function start(){if(!frame&&!dead&&!suspended){last=performance.now();frame=requestAnimationFrame(pump)}}
 function settle(index,instant=false){
  if(dead||!Number.isFinite(+index))return;const i=wrap(Math.round(index)),old=focused;
  const desired=-i*step;target=desired+360*Math.round((target-desired)/360);focused=i;
  if(instant||less()){cancelAnimationFrame(frame);frame=0;spin=target;impulse=pressure=pressVelocity=lean=leanVelocity=0;draw()}else start();
  if(old!==i||instant){if(old!==i)onSelect(i);scheduleVideo()}else if(videoId<0&&!timer)scheduleVideo();
 }
 function down(e){if(dead||suspended||drag||!e.isPrimary||e.button!==0)return;
  drag={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,at:e.timeStamp,speed:0,base:spin,moved:false,hit:e.target.closest?.('.orb-art')};
  viewport.setPointerCapture?.(e.pointerId);viewport.classList.add('orb-grabbing');}
 function move(e){if(!drag||e.pointerId!==drag.id)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
  if(!drag.moved&&Math.abs(dx)<7)return;if(!drag.moved&&Math.abs(dx)<Math.abs(dy)*.72)return;
  if(!drag.moved){drag.moved=true;stopVideo()}
  e.preventDefault();const v=(e.clientX-drag.lastX)*1000/Math.max(8,e.timeStamp-drag.at);drag.speed=clamp(-1600,1600,.42*drag.speed+.58*v);impulse=Math.abs(drag.speed);
  drag.lastX=e.clientX;drag.at=e.timeStamp;target=drag.base+dx*ratio;
  if(less()){spin=target;draw()}else start();
 }
 function up(e){if(!drag||e.pointerId!==drag.id)return;
  const d=drag;drag=null;viewport.classList.remove('orb-grabbing');if(viewport.hasPointerCapture?.(e.pointerId))viewport.releasePointerCapture(e.pointerId);
  if(d.moved){const dx=e.clientX-d.x,projection=(e.type==='pointercancel'||e.timeStamp-d.at>100)?0:clamp(-step*.55,step*.55,d.speed*ratio*.35);
   let next=Math.round(-(target+projection)/step);
   if(wrap(next)===focused&&Math.abs(dx)>Math.min(84,host.clientWidth*.14))next=focused-Math.sign(dx);
   settle(next);if(videoId<0)scheduleVideo();
  }else if(e.type!=='pointercancel'&&d.hit){const i=+d.hit.dataset.orb;if(i!==focused)settle(i)}
 }
 function wheel(e){if(dead||suspended||drag||e.ctrlKey)return;e.preventDefault();let d=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY;
  if(e.deltaMode===1)d*=16;else if(e.deltaMode===2)d*=host.clientHeight;const now=performance.now();
  if(now-wheelTime>135||Math.sign(d)!==Math.sign(wheelSum))wheelSum=0;wheelTime=now;
  if(now<wheelLock)return;wheelSum+=d;if(Math.abs(wheelSum)>=32){settle(focused+Math.sign(wheelSum));wheelLock=now+340;wheelSum=0}
 }
 function suspend(on=true){if(dead)return;suspended=!!on;drag=null;viewport.classList.remove('orb-grabbing');
  cancelAnimationFrame(frame);frame=0;stopVideo();if(!on){settle(focused,true)}}
 function visibility(){if(document.hidden){stopVideo();cancelAnimationFrame(frame);frame=0}else if(!suspended){settle(focused,true)}}
 const ac=new AbortController(),opt={signal:ac.signal};viewport.addEventListener('pointerdown',down,opt);viewport.addEventListener('pointermove',move,opt);
 viewport.addEventListener('pointerup',up,opt);viewport.addEventListener('pointercancel',up,opt);viewport.addEventListener('wheel',wheel,{...opt,passive:false});document.addEventListener('visibilitychange',visibility,opt);
 const ro=new ResizeObserver(resize);ro.observe(host);resize();settle(0,true);
 return {select:settle,index:()=>focused,resize,suspend,activeRect:()=>windows[focused].getBoundingClientRect(),
 destroy(){if(dead)return;suspend(true);dead=true;ac.abort();ro.disconnect();viewport.remove()}};
};