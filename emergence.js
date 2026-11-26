// ACT III — EMERGENCE. MIT Copyright (c) 2026 Dongcheng Cang.
// See licenses/cangdongcheng-reaction-diffusion.MIT.txt. SIM_FRAG is the unmodified upstream shader.
// Source: cangdongcheng/reaction-diffusion @5c9f284eb09600fe82436e449d8d2fad2414c71e/main.js
(() => {
'use strict';
const SIM_FRAG = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 frag;

uniform sampler2D u_state;
uniform vec2 u_texel;
uniform float u_feed;
uniform float u_kill;
uniform float u_du;
uniform float u_dv;
uniform float u_dt;

uniform vec2 u_mouse;      // in [0,1] uv coords; (<0, <0) means "not active"
uniform float u_mouse_r;   // radius in uv units
uniform float u_mouse_active;

void main() {
  vec2 uv = v_uv;

  // 9-point Laplacian: centre -1, edges 0.2, corners 0.05
  vec2 centre = texture(u_state, uv).rg;

  vec2 sum = vec2(0.0);
  sum += texture(u_state, uv + vec2(-u_texel.x, -u_texel.y)).rg * 0.05;
  sum += texture(u_state, uv + vec2( 0.0,      -u_texel.y)).rg * 0.20;
  sum += texture(u_state, uv + vec2( u_texel.x, -u_texel.y)).rg * 0.05;
  sum += texture(u_state, uv + vec2(-u_texel.x,  0.0     )).rg * 0.20;
  sum += centre * -1.0;
  sum += texture(u_state, uv + vec2( u_texel.x,  0.0     )).rg * 0.20;
  sum += texture(u_state, uv + vec2(-u_texel.x,  u_texel.y)).rg * 0.05;
  sum += texture(u_state, uv + vec2( 0.0,       u_texel.y)).rg * 0.20;
  sum += texture(u_state, uv + vec2( u_texel.x,  u_texel.y)).rg * 0.05;

  float u = centre.r;
  float v = centre.g;
  float lap_u = sum.r;
  float lap_v = sum.g;

  float uvv = u * v * v;
  float du = u_du * lap_u - uvv + u_feed * (1.0 - u);
  float dv = u_dv * lap_v + uvv - (u_feed + u_kill) * v;

  u += du * u_dt;
  v += dv * u_dt;

  // Mouse interaction: paint v = 1 inside a circle
  if (u_mouse_active > 0.5) {
    float d = distance(uv, u_mouse);
    if (d < u_mouse_r) {
      float falloff = 1.0 - smoothstep(0.0, u_mouse_r, d);
      v = mix(v, 1.0, falloff);
    }
  }

  frag = vec4(clamp(u, 0.0, 1.0), clamp(v, 0.0, 1.0), 0.0, 1.0);
}`;
const VERT = `#version 300 es
out vec2 v_uv;
void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);v_uv=p;gl_Position=vec4(p*2.-1.,0.,1.);}`;
const DISP = `#version 300 es
precision highp float;
in vec2 v_uv; out vec4 frag;
uniform sampler2D field, lettering;
uniform vec2 texel, size, lightAt;
uniform float feed;
float noise(vec2 p){p=fract(p*vec2(123.34,345.45));p+=dot(p,p+34.345);return fract(p.x*p.y);}
vec2 coordinates(vec2 p){
  bool tall=size.y>size.x;
  vec2 c=tall?vec2(.51,.49):vec2(.44,.51);
  vec2 q=(p-c)*size/min(size.x,size.y)*(tall?.94:.86);
  float a=tall?-.99:0.; return vec2(cos(a)*q.x-sin(a)*q.y,sin(a)*q.x+cos(a)*q.y)+.5;
}
float h(vec2 s){vec2 v=texture(field,s).rg;return .62*v.g+.21*(1.-v.r);}
void main(){
  vec2 st=coordinates(v_uv);vec2 u=clamp(st,0.,1.);
  vec2 v=texture(field,u).rg;float z=h(u);
  float dx=h(u+vec2(texel.x,0))-h(u-vec2(texel.x,0));
  float dy=h(u+vec2(0,texel.y))-h(u-vec2(0,texel.y));
  vec3 normal=normalize(vec3(-dx*5.1,-dy*5.1,1.));
  vec3 light=normalize(vec3(-.52+.38*(lightAt.x-.5),.72,.79));
  vec3 view=vec3(0.,0.,1.);float dif=max(0.,dot(light,normal));
  float spec=pow(max(0.,dot(normal,normalize(light+view))),21.);
  float edge=length(vec2(dx,dy));float n=noise(gl_FragCoord.xy);
  float inside=smoothstep(.004,.025,min(min(st.x,st.y),min(1.-st.x,1.-st.y)));
    vec2 xy=u-.5;
  vec2 ab=vec2(.896*xy.x+.444*xy.y,-.444*xy.x+.896*xy.y)/vec2(.448,.295);
  float theta=atan(ab.y,ab.x); float radial=length(ab);
  float rim=.94+.049*cos(3.*theta+.5)+.035*cos(5.*theta-1.);
  float d=radial-rim;
  float midskin=(1.-smoothstep(-.011,.027,d))*smoothstep(.94,1.05,length((ab-vec2(.37,-.23))/vec2(.31,.28)));
  float body=smoothstep(.003,.085,z)*inside;
  float shadow=smoothstep(.013,.15,h(clamp(st+vec2(.008,-.015),0.,1.)))*inside;
  float pool=1.-smoothstep(.04,.90,length(v_uv-vec2(.26,.77)));
  vec3 bg=mix(vec3(.124,.069,.118),vec3(.275,.159,.199),pool);
  bg+=.10*(noise(floor(gl_FragCoord.xy*.43))-.5)*.12;
    bg*=1.-.19*shadow;
  vec3 tissue=mix(vec3(.30,.148,.194),vec3(.56,.301,.361),clamp(.69-.45*ab.y+.15*cos(theta+2.1),0.,1.));
  float incise=.5+.5*cos(radial*440.+2.4*cos(theta*7.+radial*24.));
  tissue+=.047*incise*(.26+.74*radial)+.019*(n-.5);
  tissue+=vec3(.15,.075,.06)*(1.-smoothstep(.0,.032,abs(d+.015)));
  bg=mix(bg,tissue,midskin*.93); 
  float pigment=clamp((1.-v.r)*.27+v.g*1.47,0.,1.);
  vec3 low=mix(vec3(.30,.063,.17),vec3(.48,.15,.20),smoothstep(.026,.059,feed));
  float zone=smoothstep(-.15,.75,u.x+.38*sin(u.y*8.)+.2*cos(u.x*5.));
  vec3 flesh=mix(vec3(.73,.24,.30),vec3(.70,.47,.77),zone);
  vec3 pearl=mix(vec3(1.,.75,.50),vec3(.97,.79,.88),zone);
  vec3 albedo=mix(low,flesh,smoothstep(.06,.46,pigment));
  albedo=mix(albedo,pearl,smoothstep(.48,.89,pigment));
  vec3 col=albedo*(.62+.44*dif)+vec3(1.,.86,.77)*spec*.24;
  col+=vec3(.22,.061,.026)*smoothstep(.025,.19,edge)*(1.-normal.z);
  col+=.032*(n-.5);
  vec2 glyph=vec2((u.x-.5)*2.2+.5,(u.y-.48)*5.7+.5)+vec2(dx,dy)*.16;
  if(all(greaterThan(glyph,vec2(0)))&&all(lessThan(glyph,vec2(1)))){
    float engraving=texture(lettering,glyph).a*body*(.35+.20*dif);
    col=mix(col,vec3(.996,.894,.757),engraving);
  }
  frag=vec4(mix(bg,col,body),1.);
}`;
function specimen(size,key){
  const data=new Float32Array(size*size*2),ca=Math.cos(.46),sa=Math.sin(.46);
  for(let j=0;j<size;j++)for(let i=0;i<size;i++){
    const x=(i+.5)/size-.5, y=(j+.5)/size-.5, a=(x*ca+y*sa)/.448, b=(-x*sa+y*ca)/.295;
    const r=Math.hypot(a,b),theta=Math.atan2(b,a);
    const rim=.94+.049*Math.cos(3*theta+.5)+.035*Math.cos(5*theta-1);
    // One deterministic seed value defines the initial inoculation patches; no precomputed pattern.
    const freq=size/6.5, cx=Math.floor((x+.5)*freq),cy=Math.floor((y+.5)*freq); const v=Math.sin(cx*72.23+cy*189.7+key)*9187.45; const patch=v-Math.floor(v);
    const cut=((a-.37)/.31)**2+((b+.23)/.28)**2;
    const mask=r<rim&&cut>1&&patch>.70;
    const k=(j*size+i)*2;data[k]=mask?.49:1.;data[k+1]=mask?.36+.035*Math.sin(i*.95+j*.43):0.;
  }return data;
}
function letterTexture(gl){
 const c=document.createElement('canvas');c.width=512;c.height=128;
 const x=c.getContext('2d');x.textAlign='center';x.textBaseline='middle';x.fillStyle='white';x.font='italic 500 60px EditionRoman,Georgia,serif';x.fillText('Emergence',256,65);
 const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
 gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,c);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
 for(const key of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,key,gl.LINEAR);return t;
}
function emergence(api){
 const {gl,program,triangle}=api;if(!gl.getExtension('EXT_color_buffer_float')) throw Error('反应扩散需要可绘制浮点缓冲');
 const sim=program(VERT,SIM_FRAG),view=program(VERT,DISP);let tex=[],fbo=[],n=0,read=0,steps=0,seeds=0,down=false,feed=.0367,kill=.0615,target=feed,finished=false;
 const u=(p,names)=>Object.fromEntries(names.split(' ').map(k=>[k,gl.getUniformLocation(p,k)]));
 const su=u(sim,'u_state u_texel u_feed u_kill u_du u_dv u_dt u_mouse u_mouse_r u_mouse_active');
 const vu=u(view,'field lettering texel size lightAt feed');gl.activeTexture(gl.TEXTURE0);const lettering=letterTexture(gl);
 const bind=(i,t)=>{gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,t)};
 function alloc(size,key){
   n=size;const initial=specimen(n,key);
   for(let i=0;i<2;i++){
     const t=gl.createTexture();tex.push(t);bind(0,t);
     gl.texImage2D(gl.TEXTURE_2D,0,gl.RG16F,n,n,0,gl.RG,gl.FLOAT,i===0?initial:null);
     for(const key of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,key,gl.LINEAR);
     for(const key of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,key,gl.CLAMP_TO_EDGE);
     const fb=gl.createFramebuffer();fbo.push(fb);gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);
     if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE){return false}
   }return true;
 }
 function substeps(count,x,y,paint){
  gl.useProgram(sim);gl.viewport(0,0,n,n);
  gl.uniform1i(su.u_state,0);gl.uniform2f(su.u_texel,1/n,1/n);gl.uniform1f(su.u_feed,feed);gl.uniform1f(su.u_kill,kill);
  gl.uniform1f(su.u_du,.47);gl.uniform1f(su.u_dv,.22);gl.uniform1f(su.u_dt,1);gl.uniform2f(su.u_mouse,x,y);
  gl.uniform1f(su.u_mouse_r,.023);gl.uniform1f(su.u_mouse_active,paint?1:0);
  for(let j=0;j<count;j++){bind(0,tex[read]);gl.bindFramebuffer(gl.FRAMEBUFFER,fbo[1-read]);triangle(sim);read=1-read;steps++}
 }
 function render(f){
  const m=f.memory||{},inp=f.input;
  if(!n){
        // Only the first entry samples the previous scene. Returning preserves the recipe and the user's feed.
    const inherited=Number.isFinite(m.impulse)?Math.max(0,Math.min(1,m.impulse)):0;
    if(!Number.isFinite(m.germKey))m.germKey=((f.mark?.x??.5)-.5)*7+((f.mark?.y??.5)-.5)*3+inherited*17.3;
    if(!alloc([260,372,504][f.quality],m.germKey))return false;
    target=feed=m.feed>0&&Number.isFinite(m.feed)?Math.min(.058,Math.max(.026,m.feed)):.045;
    seeds=m.seeds||0; substeps(120,-1,-1,false);
  }
  if(inp.down&&!down)seeds++;
  if(inp.down){target=Math.min(.058,Math.max(.026,target+inp.dx*.083));}
  feed+=(target-feed)*(1-Math.exp(-f.dt*8));kill=.0576+(feed-.026)*.19;
  m.feed=feed;m.seeds=seeds;down=inp.down;
  const tall=f.height>f.width,min=Math.min(f.width,f.height),a=tall?-.99:0;
  const qx=(inp.x-(tall?.51:.44))*f.width/min*(tall?.94:.86),qy=(inp.y-(tall?.49:.51))*f.height/min*(tall?.94:.86);
  const bounded=v=>Math.max(.035,Math.min(.965,v));
  substeps(f.reduced?2:[4,6,8][f.quality],bounded(Math.cos(a)*qx-Math.sin(a)*qy+.5),bounded(Math.sin(a)*qx+Math.cos(a)*qy+.5),inp.down);
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,f.width,f.height);gl.useProgram(view);bind(0,tex[read]);bind(1,lettering);
  gl.uniform1i(vu.field,0);gl.uniform1i(vu.lettering,1);gl.uniform2f(vu.texel,1/n,1/n);gl.uniform2f(vu.size,f.width,f.height);
  gl.uniform2f(vu.lightAt,inp.x,inp.y);gl.uniform1f(vu.feed,feed);triangle(view);gl.activeTexture(gl.TEXTURE0);return true;
 }
 return {render,stats:()=>({module:'Gray–Scott · 双物质反应扩散 / 化学场浮雕',grid:n+' × '+n+' / F '+feed.toFixed(4)+' · K '+kill.toFixed(4),simulationSteps:steps,seedCount:seeds,feed,kill}),dispose(){if(finished)return;finished=true;tex.forEach(t=>gl.deleteTexture(t));fbo.forEach(t=>gl.deleteFramebuffer(t));gl.deleteTexture(lettering);gl.deleteProgram(sim);gl.deleteProgram(view)}};
}
(window.BeyondScenes ||= {}).emergence=emergence;
})();
