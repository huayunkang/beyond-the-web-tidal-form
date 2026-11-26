/* IV / VI. Perspective projection: three.js r180 Matrix4.makePerspective, WebGL branch,
   Copyright 2010–2025 three.js authors (MIT). Julia / orbit trap: Iwan Kelaiah,
   Copyright 2026 (MIT, licenses/fractal-explorer-MIT.txt). Everything else here is the exhibition staging. */
(()=>{
'use strict';
const scenes=window.BeyondScenes=window.BeyondScenes||{},tau=Math.PI*2,clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const vert='#version 300 es\nprecision highp float;out vec2 uv;void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2); uv=p;gl_Position=vec4(p*2.-1.,0.,1.);}';
const frag=s=>'#version 300 es\nprecision highp float;in vec2 uv;out vec4 col;'+s;
function program(api,v,s){const gl=api.gl,p=api.program(v,s),u={};for(let i=0;i<gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);i++){let n=gl.getActiveUniform(p,i).name;u[n]=gl.getUniformLocation(p,n)}return {p,u}}
function tex(gl,canvas){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,canvas);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.generateMipmap(gl.TEXTURE_2D);return t}
function atlas(gl,mode){let c=document.createElement('canvas');c.width=1024;c.height=512;let x=c.getContext('2d');x.fillStyle='white';x.textAlign='center';if(mode===0){x.font='bold 40px Georgia,serif';x.fillText('P E R C E P T I O N',511,112);x.font='24px Georgia';x.fillText('I V   /   V I E W   §   0 1',511,420);x.font='bold 87px serif';x.fillText('见',512,288);for(let i=0;i<60;i++)x.fillRect(124+i*13,119,2,i%5===0?10:4)}else{x.font='bold 102px Georgia,serif';x.fillText('INFINITY',512,208);x.font='46px serif';x.fillText('无　限　／　Ⅵ',512,285);x.fillRect(225,312,575,2)}return tex(gl,c)}
const back=frag(`uniform vec2 size;uniform float side,tilt,zoom;float h(vec2 p){return fract(sin(dot(mod(p,690.),vec2(12.99,78.23)))*43758.54);}
void main(){vec2 q=(uv-.5)*vec2(size.x/size.y,1.);float hor=.42+tilt*.025;float grain=(h(gl_FragCoord.xy)-.5)*.025;
vec3 sky=mix(vec3(.94,.73,.58),vec3(.40,.58,.69),pow(smoothstep(hor,1.03,uv.y),.78));
vec2 sun=q-vec2(.42-.22*side,.095);float d=length(sun);sky+=vec3(.12,.072,.025)*exp(-4.*d);
sky=mix(sky,vec3(1.,.88,.63),1.-smoothstep(.088,.090,d));
float floorY=hor-uv.y;float z=1./max(.0007,floorY);float xx=q.x*z+side*2.;
vec2 g=abs(fract(vec2(xx*.38,z*.11)-.5)-.5)/max(fwidth(vec2(xx*.38,z*.11)),.0001);
float grid=(1.-min(min(g.x,g.y),1.))*smoothstep(.015,.25,floorY);
vec3 slab=mix(vec3(.42,.58,.63),vec3(.84,.77,.64),clamp(floorY*2.35,0.,1.));slab-=vec3(.10,.10,.095)*grid;
sky=mix(sky,slab,smoothstep(-.0015,.002,floorY));col=vec4(sky+grain,1.);}`);
const mv=`#version 300 es
precision highp float; layout(location=0)in vec3 point; layout(location=1)in vec3 normal;layout(location=2)in vec2 ref;layout(location=3)in float mat;
uniform mat4 proj;uniform float side,tilt,shadow,distanceZ;out vec3 nrm,pos;out vec2 pos2;flat out float material;
void main(){vec3 p=point;if(shadow>.5){float h=p.y+1.56;p-=h*vec3(-.56,1.,.37);}
float c=cos(side),s=sin(side);vec3 v=vec3(c*p.x-s*p.z,p.y,s*p.x+c*p.z);
v=vec3(v.x,cos(tilt)*v.y-sin(tilt)*v.z,sin(tilt)*v.y+cos(tilt)*v.z);
gl_Position=proj*vec4(v-vec3(0.,0.,distanceZ),1.);nrm=normal;pos=point;pos2=ref;material=mat;}`;
const mf=`#version 300 es
precision highp float;in vec3 nrm,pos;in vec2 pos2;flat in float material;uniform sampler2D inscription;uniform float shadow,side;out vec4 col;
float hash(vec2 x){return fract(sin(dot(x,vec2(12.9898,78.233)))*43758.545);}
void main(){if(shadow>.5){col=vec4(.38,.46,.445,1);return;}vec3 n=normalize(nrm);vec3 ivory=vec3(.94,.87,.72), blue=vec3(.055,.23,.33),bronze=vec3(.79,.29,.095);
vec3 base=material<.5?ivory:material<1.5?blue:material<2.5?bronze:material<3.5?vec3(.18,.35,.43):vec3(.95,.70,.38);
float lit=max(dot(n,normalize(vec3(-.44,.78,.64))),0.);float line=pow(.5+.5*sin(105.*pos.y+4.*sin(pos.x*3.2)+pos.z*7.),5.);
float grain=hash(floor(gl_FragCoord.xy))-.5;vec3 color=base*(.60+.39*lit)+vec3(.012,.035,.047)*(1.-lit);
color+=(.023*grain-.016*line)*(material<.5?1.:.44);float spec=pow(max(dot(n,normalize(vec3(-.1,.6,1.))),0.),16.);color+=vec3(.18,.14,.075)*spec;
float ink=texture(inscription,pos2*vec2(.204,.41)+.5).a*smoothstep(.65,.9,n.z);
color=mix(color,material<.5?blue:ivory,ink*.91);col=vec4(color,1.);}`;
function eyeMesh(){
 const out=[],sub=(a,b)=>a.map((x,i)=>x-b[i]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 function tri(a,b,c,material){let n=cross(sub(b,a),sub(c,a));let l=Math.hypot(...n)||1;for(let p of [a,b,c])out.push(...p.slice(0,3),...n.map(x=>x/l),p[3],p[4],material)}
 function quad(a,b,c,d,m){tri(a,b,c,m);tri(a,c,d,m)}
 function beam(curve,start,end,z,thick,paint,steps){
  let prev;for(let i=0;i<=steps;i++){let u=start+(end-start)*i/steps,r=curve(u);
   const point=(t,h)=>{let x=r[0]+(r[2]-r[0])*t,y=r[1]+(r[3]-r[1])*t;return [x*(8-z)/8,y*(8-z)/8,z-h,x,y]};
   const v=[[.085,0],[.915,0],[1,.055],[1,thick-.035],[.95,thick],[.05,thick],[0,thick-.035],[0,.055]].map(([t,h])=>point(t,h));
   const colors=[paint,4,1,3,3,3,3,4];
   if(prev)for(let k=0;k<8;k++){let j=(k+1)%8;quad(prev[k],v[k],v[j],prev[j],colors[k]);}
   if(i===0||i===steps)for(let k=1;k<7;k++){if(!i)tri(v[0],v[k+1],v[k],2);else tri(v[0],v[k],v[k+1],2);}
   prev=v;
  }
 }
 // Coordinates are scaled back along their original camera rays: depth is invisible from ONE point only.
 const eye=t=>{const c=Math.cos(t),s=Math.sin(t);let k=.67+.33*Math.abs(s);return [2.43*c,1.21*s*k,1.98*c,.84*s*k]};
 let zs=[1.69,-.48,.90,-1.52,.45,-.83,1.2,-1.65];for(let i=0;i<8;i++)beam(eye,tau*i/8+.003,tau*(i+1)/8-.003,zs[i],.40,i===1||i===6?3:0,24);
 const iris=t=>[.82*Math.cos(t),.82*Math.sin(t),.55*Math.cos(t),.55*Math.sin(t)];
 for(let i=0;i<6;i++)beam(iris,i*tau/6+.014,(i+1)*tau/6-.014,[-.55,1.1,-1.2,1.38,-.32,1.0][i],.44,i%2?2:1,14);
 const pupil=t=>[.35*Math.cos(t),.35*Math.sin(t),0,0];beam(pupil,0,tau,-1.65,.49,1,48);return new Float32Array(out)}
function perspective(aspect,half){const near=.1,far=50,top=near*half,bottom=-top,right=top*aspect,left=-right;
 // Source: Matrix4.makePerspective() r180, symmetric WebGL clip-space branch.
 const x=2*near/(right-left),y=2*near/(top-bottom),a=(right+left)/(right-left),b=(top+bottom)/(top-bottom),c=-(far+near)/(far-near),d=-2*far*near/(far-near);
 return new Float32Array([x,0,0,0,0,y,0,0,a,b,c,-1,0,0,d,0]);}
scenes.perception=api=>{const gl=api.gl,bg=program(api,vert,back),obj=program(api,mv,mf),glyph=atlas(gl,0),vao=gl.createVertexArray(),vbo=gl.createBuffer(),data=eyeMesh();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);let offset=0;[3,3,2,1].forEach((n,i)=>{gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,n,gl.FLOAT,false,36,offset*4);offset+=n});gl.bindVertexArray(null);
 let angle=0,target=0,tilt=.015,vertical=.015,user=false,draws=0;return {render(f){api.reset();const input=f.input;let dx=input.dx||0,dy=input.dy||0;if(input.down||Math.abs(dx)+Math.abs(dy)>.00001){target=clamp(target+dx*3.4,-.99,.99);vertical=clamp(vertical+dy*.62,-.25,.28);user=true}
 if(f.auto&&!input.down)target=.72*(.5-.5*Math.cos(f.age*.61));else if(!user)target=f.reduced?0:.032*Math.sin(f.age*.48);angle+=(target-angle)*(1.-Math.exp(-10*f.dt));tilt+=(vertical-tilt)*(1.-Math.exp(-10*f.dt));const aspect=f.width/f.height;
 gl.useProgram(bg.p);gl.uniform2f(bg.u.size,f.width,f.height);gl.uniform1f(bg.u.side,angle);gl.uniform1f(bg.u.tilt,tilt);api.triangle(bg.p);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.clearDepth(1);gl.clear(gl.DEPTH_BUFFER_BIT);
 gl.useProgram(obj.p);gl.bindVertexArray(vao);gl.uniformMatrix4fv(obj.u.proj,false,perspective(aspect,Math.max(.26,.353/aspect)));gl.uniform1f(obj.u.distanceZ,8+Math.abs(angle)*1.85);gl.uniform1f(obj.u.side,angle);gl.uniform1f(obj.u.tilt,tilt);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,glyph);gl.uniform1i(obj.u.inscription,0);gl.uniform1f(obj.u.shadow,1);gl.drawArrays(gl.TRIANGLES,0,data.length/9);gl.uniform1f(obj.u.shadow,0);gl.drawArrays(gl.TRIANGLES,0,data.length/9);gl.disable(gl.DEPTH_TEST);gl.bindVertexArray(null);draws++;},stats:()=>({module:'视差建筑 / 单视点空间配准',grid:'15 个异深度构件',viewAngle:+(angle*180/Math.PI).toFixed(2),viewTilt:+tilt.toFixed(3),draws}),dispose(){gl.deleteTexture(glyph);gl.deleteBuffer(vbo);gl.deleteVertexArray(vao);gl.deleteProgram(bg.p);gl.deleteProgram(obj.p)}}};

const space=frag(`
uniform vec2 size,hand;uniform vec3 bands;uniform vec4 archive;uniform float travel,turn,order,limit,withPrint,artAspect;uniform sampler2D plate,seal;
mat2 R(float t){float s=sin(t),c=cos(t);return mat2(c,s,-s,c);}
float hash(vec2 p){return fract(sin(dot(mod(p,635.),vec2(64.17,73.91)))*43814.31);}
float line(float d,float w){return 1.-smoothstep(0.,w,d);}
float stars(vec2 p,float scale,float seed){p*=scale;vec2 id=floor(p),v=fract(p)-vec2(hash(id+seed),hash(id*.63-seed));float a=hash(id*1.79+seed);return smoothstep(.92,1.,a)*exp(-dot(v,v)*270.);}
void main(){float asp=size.x/size.y;vec2 view=(uv-.5)*vec2(asp,1.);float small=1.-smoothstep(.7,1.28,asp);float lens=mix(1.,.74,small);
vec2 origin=mix(vec2(.078,.022),vec2(.012,-.013),small);vec2 p=R(-.31-turn*.095)*(view-origin)*2.17/lens;p.y/=.70;float r=max(length(p),.0004),ang=atan(p.y,p.x);
float t=travel;float spacing=1.51;float lg=log2(r)/spacing-t;
float sc=exp2(fract(lg)*spacing-.40);float layer=floor(lg);
float phi=ang+log(r)*.67+turn*.27+.075*sin(layer*2.+archive.x);
vec2 z=R(phi)*vec2(sc*.90,0.);vec2 c=vec2(-.76+.045*sin(archive.x*1.4)+.007*sin(order),.114+.020*cos(archive.y*1.7)+.008*sin(archive.w)+.008*sin(archive.z*47.));
float trap=32.,i=0.,radius=12.;
for(int n=0;n<82;n++){if(float(n)>=limit)break;
 // Original Julia iteration, escape radius, and orbit-trap geometry from fractals.js (Iwan Kelaiah, MIT).
 z=vec2(z.x*z.x-z.y*z.y,2.0*z.x*z.y)+c;
 float circle=abs(length(z-vec2(.25,0.))-.45);float crosshair=min(abs(z.x),abs(z.y));
 float diagonal=abs(z.x+z.y)*.70710678;trap=min(trap,min(circle,min(crosshair,diagonal)));radius=min(radius,length(z));
 if(dot(z,z)>256.)break;i+=1.;}
float smoothI=i+1.-log2(max(1.,log2(max(2.,length(z)))));
float growth=clamp((i-2.)*.095,0.,1.);float relief=pow(.5+.5*cos(smoothI*.92+.65*phi),4.);
float hair=exp(-trap*(110.+35.*sin(phi)));float soft=exp(-trap*21.);
float rim=smoothstep(.005,.15,fract(lg))*(1.-smoothstep(.91,1.,fract(lg)));
float range=exp(-.57*pow(r,1.5))*smoothstep(.0008,.058,r);
float density=range*rim*(.03+growth*.49+relief*.29+hair*.38+soft*.17);
vec3 ink=vec3(.028,.046,.095);vec3 color=ink+vec3(.036,.047,.077)*exp(-r*.9);
float st=stars(view+turn*.008,105.,6.)+.65*stars(view-turn*.014,180.,51.);
color+=st*vec3(.57,.69,.83)*(1.-.35*growth);
vec3 copper=vec3(.91,.42,.17),pale=vec3(.98,.83,.57),cyan=vec3(.23,.64,.68);
vec3 metal=mix(copper,cyan,smoothstep(-.64,.73,sin(phi*1.7+sc+archive.y*.4)));
metal=mix(metal,pale,clamp(.26+relief*.50+hair*.10+bands.y*.20,0.,1.));color+=density*metal*1.26;
float crest=pow(clamp(hair*growth,0.,1.),3.)*range*rim; color+=crest*vec3(.21,.18,.116);
float bandsEtch=line(abs(sin((log2(r)+t*.25)*22.+.55*sin(ang*3.+turn))),max(.018,1.6*fwidth((log2(r)+t*.25)*22.)));
color+=vec3(.17,.12,.06)*bandsEtch*range*(.33+.67*growth);
float arc=line(abs(fract(lg)-.53),.0038)*smoothstep(.06,.55,cos(ang*1.5-.4));color+=arc*vec3(.34,.34,.30)*range;
float tick=line(abs(fract((ang+3.14159)*44./6.28318)-.5),.095);color+=tick*line(abs(fract(lg)-.54),.014)*range*.16;
 // A real image, not a reconstruction from a hue statistic. One window is placed per scale octave.
 for(int j=-4;j<=1;j++){float s=exp2((float(j)+fract(t))*spacing);
 float a=.86+.47*float(j)+turn*.10;vec2 loc=vec2(.95*cos(a),.95*sin(a))*s;
 vec2 q=R(-.09-.05*float(j))*(p-loc)/s;
 vec2 lens=q/vec2(.34,.34);float edge=length(lens); if(edge<1.16&&withPrint>.5){
 // Estimate the studio paper from both sides of the captured image at the same elevation.
 // Re-deposit only the sculpture as an orbit impression. No sheet, rectangular frame or UI is inherited.
 lens.x+=.038*lens.y*lens.y;float sx=min(1.,1.30/max(.45,artAspect));
 vec2 u=vec2(.55,.50)+lens*.5*vec2(sx,sx*artAspect/1.40);u=clamp(u,.002,.998);
 vec3 raw=texture(plate,u).rgb;
 vec3 paper=mix(texture(plate,vec2(.026,u.y)).rgb,texture(plate,vec2(.974,u.y)).rgb,u.x);
 float diff=length(raw-paper);vec3 neighbor=texture(plate,clamp(u+vec2(.004,.002),.002,.998)).rgb;
 float engraving=smoothstep(.023,.28,length(raw-neighbor));
 float ink=(1.-smoothstep(.73,1.16,edge))*max(smoothstep(.062,.26,diff),engraving*.64);
 float Y=dot(raw,vec3(.24,.62,.14));
 vec3 reliefInk=mix(vec3(.18,.34,.47),vec3(1.05,.81,.53),smoothstep(.13,.88,Y));
 reliefInk=mix(reliefInk,raw,.27)+engraving*vec3(.28,.17,.07);
 color=mix(color,reliefInk,ink*.82)+ink*.075*raw;
 }
 }
 // Letterpress marks travel through the same log scale, rather than sitting in a screen-space caption.
 vec2 polar=vec2(fract((ang+.46)/6.28318+.5),fract(lg));vec2 label=(polar-vec2(.74,.70))*vec2(5.4,7.)+.5;
 if(all(greaterThan(label,vec2(0)))&&all(lessThan(label,vec2(1))))color=mix(color,pale,texture(seal,label).a*.76*range);
 color+=vec3(.98,.79,.51)*exp(-r*(68.-bands.x*6.));
 color+=(hash(gl_FragCoord.xy)-.5)*.023;color=color/(vec3(.89)+color*.27);
 col=vec4(color,1.);}
`);
scenes.infinity=api=>{const gl=api.gl,pr=program(api,vert,space),label=atlas(gl,1);let travel=.25,turn=0,target=0,count=0,iter=0,seen=false,last={};return {render(f){api.reset();const m=f.memory||{},b=f.bands||[0,0,0],input=f.input;travel+=(f.reduced?0:.062+Math.min(.11,b[0]*.09))*f.dt+(input.dy||0)*.72;target=clamp(target+(input.dx||0)*3.0,-5,5);turn+=(target-turn)*(1-Math.exp(-8*f.dt));let aspect=f.width/f.height;
 iter=[38,54,76][f.quality]||54;seen=!!api.artwork;last={shape:+m.shape||0,twist:+m.twist||0,feed:+m.feed||0,seeds:+m.seeds||0,order:+m.order||0};gl.useProgram(pr.p);let u=pr.u;gl.uniform2f(u.size,f.width,f.height);gl.uniform3f(u.bands,...b);gl.uniform4f(u.archive,last.shape,last.twist,last.feed,last.seeds);gl.uniform1f(u.order,last.order);gl.uniform1f(u.travel,travel);gl.uniform1f(u.turn,turn);gl.uniform1f(u.limit,iter);gl.uniform1f(u.withPrint,seen?1:0);gl.uniform1f(u.artAspect,api.artAspect||aspect);
 gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,label);gl.uniform1i(u.seal,1);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,api.artwork||label);gl.uniform1i(u.plate,0);api.triangle(pr.p);count++;},stats:()=>({module:'Julia 轨道陷阱 / 对数尺度蚀刻',grid:iter+' 次逃逸上限 · 6 级成像窗',archivePlate:seen,archiveInputs:last,travel:+travel.toFixed(4),viewShift:+turn.toFixed(3),draws:count}),dispose(){gl.deleteTexture(label);gl.deleteProgram(pr.p)}}};
})();
