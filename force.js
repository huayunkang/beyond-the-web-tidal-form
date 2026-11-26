/* Adapted physics routines from three.js r122 examples/webgl_animation_cloth.html
   https://github.com/mrdoob/three.js/blob/95ef309c79158aa506f3f7ddeab769e7c4908187/examples/webgl_animation_cloth.html

The MIT License

Copyright © 2010-2020 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/
(() => {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (x,lo,hi) => Math.max(lo,Math.min(hi,x));
  const tiers = [[64,13],[96,17],[128,21]];
  const eye = 5.65, step = 18/1000;

  // The annular rest mesh has two boundary loops and a full turn across its width.
  function surface(u,v) {
    const r = 1.54 + 0.16*Math.cos(2*u-.7) + 0.12*Math.cos(3*u+1.4);
    const twist = u + .73*Math.sin(u+.78) + .2*Math.sin(3*u-.2);
    const width = .45 + .13*(.5+.5*Math.cos(2*u+1.3));
    const lobe = (1-v*v)*(.073*Math.sin(10*v+3*u)+.047*Math.cos(18*v-4*u)) +
      .047*Math.sin(5*u+v*6) * Math.pow(Math.abs(v),3);
    const radial = r + (v*width*Math.cos(twist)-lobe*Math.sin(twist));
    return [
      radial*Math.cos(u)+.13*Math.cos(2*u+.4),
      0.82*radial*Math.sin(u)+.14*Math.sin(2*u-.59),
      .23*Math.cos(2*u-1.45)+.31*Math.sin(3*u+.5) + v*width*Math.sin(twist)+lobe*Math.cos(twist)
    ];
  }

  // Minimal vector interface used by the MIT example functions below.
  class ClothVector {
    constructor(x=0,y=0,z=0){this.set(x,y,z)}
    set(x,y,z){this.x=x;this.y=y;this.z=z;return this}
    copy(v){return this.set(v.x,v.y,v.z)}
    add(v){return this.set(this.x+v.x,this.y+v.y,this.z+v.z)}
    sub(v){return this.set(this.x-v.x,this.y-v.y,this.z-v.z)}
    subVectors(a,b){return this.set(a.x-b.x,a.y-b.y,a.z-b.z)}
    multiplyScalar(s){return this.set(this.x*s,this.y*s,this.z*s)}
    length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}
    normalize(){return this.multiplyScalar(1/Math.max(1e-9,this.length()))}
    dot(v){return this.x*v.x+this.y*v.y+this.z*v.z}
  }
  const DRAG=.97, clothFunction=(u,v,target)=>target.set(...surface(u,v));

  function Particle( x, y, z, mass ) {

  	this.position = new ClothVector();
  	this.previous = new ClothVector();
  	this.original = new ClothVector();
  	this.a = new ClothVector( 0, 0, 0 ); // acceleration
  	this.mass = mass;
  	this.invMass = 1 / mass;
  	this.tmp = new ClothVector();
  	this.tmp2 = new ClothVector();

  	// init

  	clothFunction( x, y, this.position ); // position
  	clothFunction( x, y, this.previous ); // previous
  	clothFunction( x, y, this.original );

  }

  // Force -> Acceleration

  Particle.prototype.addForce = function ( force ) {

  	this.a.add(
  		this.tmp2.copy( force ).multiplyScalar( this.invMass )
  	);

  };


  // Performs Verlet integration

  Particle.prototype.integrate = function ( timesq ) {

  	const newPos = this.tmp.subVectors( this.position, this.previous );
  	newPos.multiplyScalar( DRAG ).add( this.position );
  	newPos.add( this.a.multiplyScalar( timesq ) );

  	this.tmp = this.previous;
  	this.previous = this.position;
  	this.position = newPos;

  	this.a.set( 0, 0, 0 );

  };


  const diff = new ClothVector();

  function satisfyConstraints( p1, p2, distance ) {

  	diff.subVectors( p2.position, p1.position );
  	const currentDist = diff.length();
  	if ( currentDist === 0 ) return; // prevents division by 0
  	const correction = diff.multiplyScalar( 1 - distance / currentDist );
  	const correctionHalf = correction.multiplyScalar( 0.5 );
  	p1.position.add( correctionHalf );
  	p2.position.sub( correctionHalf );

  }

  function build(rows,cols,old) {
    const n=rows*cols, rest=new Float32Array(n*3), now=new Float32Array(n*3), prev=new Float32Array(n*3);
    const a=new Float32Array(n*9), tri=new Uint16Array(rows*(cols-1)*6), particles=new Array(n);
    const left=new Uint32Array(n), right=new Uint32Array(n), lower=new Uint32Array(n), higher=new Uint32Array(n);
    const ia=[],ib=[],length=[],stiff=[];
    const index=(i,j)=>((i+rows)%rows)*cols+j;
    for(let i=0;i<rows;i++) for(let j=0;j<cols;j++) {
      const id=index(i,j), q=3*id, u=i*TAU/rows, v=2*j/(cols-1)-1;
      const p=particles[id]=new Particle(u,v,0,.1);
      rest.set([p.original.x,p.original.y,p.original.z],q);
      a.set([Math.cos(u),Math.sin(u),v],9*id+6);
      left[id]=3*index(i-1,j); right[id]=3*index(i+1,j);
      lower[id]=3*index(i,Math.max(0,j-1)); higher[id]=3*index(i,Math.min(cols-1,j+1));
      if(old) {
        const q0=3*(Math.round(i*old.rows/rows)%old.rows*old.cols+Math.round(j*(old.cols-1)/(cols-1)));
        for(let c=0;c<3;c++){
          now[q+c]=rest[q+c]+old.now[q0+c]-old.rest[q0+c];
          prev[q+c]=now[q+c]-(old.now[q0+c]-old.prev[q0+c]);
        }
      }
    }
    if(!old){now.set(rest);prev.set(rest)}
    for(let i=0;i<n;i++){
      const q=3*i,p=particles[i];
      p.position.set(now[q],now[q+1],now[q+2]);p.previous.set(prev[q],prev[q+1],prev[q+2]);
    }
    function link(i,j,k,l,t) {
      const a=3*index(i,j),b=3*index(k,l);
      ia.push(a);ib.push(b);
      length.push(Math.hypot(rest[a]-rest[b],rest[a+1]-rest[b+1],rest[a+2]-rest[b+2]));stiff.push(t);
    }
    let off=0;
    for(let i=0;i<rows;i++) for(let j=0;j<cols;j++) {
      link(i,j,i+1,j,.87);link(i,j,i+2,j,.27);
      if(j+1<cols) {
        const x=index(i,j),y=index(i+1,j),z=index(i+1,j+1),w=index(i,j+1);
        tri.set([x,y,z,x,z,w],off);off+=6;
        link(i,j,i,j+1,.86);link(i,j,i+1,j+1,.44);link(i+1,j,i,j+1,.44);
      }
      if(j+2<cols) link(i,j,i,j+2,.22);
    }
    return {rows,cols,n,rest,now,prev,particles,a,tri,left,right,lower,higher,ia:new Uint16Array(ia),ib:new Uint16Array(ib),
      length:new Float32Array(length),stiff:new Float32Array(stiff)};
  }

  const planeVS = `#version 300 es
    out vec2 uv;
    void main(){vec2 a=vec2((gl_VertexID<<1)&2,gl_VertexID&2);uv=a;gl_Position=vec4(a*2.-1.,0.,1.);}
  `;
  const planeFS = `#version 300 es
    precision highp float; in vec2 uv; out vec4 frag;
    uniform float u_a, u_e; uniform vec2 u_m;
    float hash(vec2 p){return fract(52.9829189*fract(dot(p,vec2(.06711056,.00583715))));}
    void main(){
      vec2 q=uv-.5;
      float copper=exp(-dot((q-vec2(-.21,.25))*vec2(2.6,3.3),(q-vec2(-.21,.25))*vec2(2.6,3.3)));
      float teal=exp(-dot((q-vec2(.29,-.08))*vec2(3.,2.4),(q-vec2(.29,-.08))*vec2(3.,2.4)));
      float floorShadow=exp(-dot((q-vec2(.01,-min(.275,u_a*.24)))*vec2(4.2,14.),(q-vec2(.01,-min(.275,u_a*.24)))*vec2(4.2,14.)));
      vec3 c=vec3(.027,.042,.043)+vec3(.079,.035,.017)*copper+vec3(.014,.064,.056)*teal;
      c *= 1.-.47*smoothstep(.17,.76,length(q*vec2(.94,1.1)));
      c *= 1.-.34*floorShadow;
      vec2 qm=(uv-u_m)*vec2(max(.72,u_a),1.);
      c+=vec3(.047,.060,.048)*u_e*exp(-11.*dot(qm,qm));
      c+=(hash(gl_FragCoord.xy)-.5)*.017;
      frag=vec4(max(c,vec3(.009)),1.);
    }
  `;
  const meshVS = `#version 300 es
    precision highp float;
    layout(location=0) in vec3 a_pos;layout(location=1) in vec3 a_n;layout(location=2) in vec3 a_u;
    uniform mat3 u_rot;uniform float u_aspect,u_scale;
    out vec3 normal,pos,trace; 
    void main(){
      pos=u_rot*a_pos;
      float d=5.65-pos.z;
      gl_Position=vec4(pos.x*u_scale/u_aspect,(pos.y-.07)*u_scale,d*.978-.72,d);
      normal=u_rot*a_n;trace=a_u;
    }
  `;
  const meshFS = `#version 300 es
    precision highp float;
    in vec3 normal,pos,trace;out vec4 frag;
    uniform vec3 u_bands;uniform float u_energy,u_hue,u_shine;
    float hash(vec2 p){return fract(52.9829189*fract(dot(p,vec2(.06711056,.00583715))));}
    float panel(vec3 r,vec3 d,vec2 limits,float edge){
      d=normalize(d);
      vec3 a=normalize(cross(d,vec3(0,1,0))),b=cross(d,a);
      vec2 p=abs(vec2(dot(r,a),dot(r,b)));
      vec2 rect=1.-smoothstep(limits-vec2(edge),limits+vec2(edge),p);
      return rect.x*rect.y*smoothstep(.0,.68,dot(r,d));
    }
    void main(){
      vec3 n=normalize(normal);
      if(!gl_FrontFacing)n=-n;
      vec3 v=normalize(vec3(0.,.07,5.65)-pos);
      vec3 r=reflect(-v,n);
      float nd=max(0.,dot(n,v));
      float f=pow(1.-nd,3.8);
      float across=trace.z;
      float u=atan(trace.y,trace.x);
      float pat=.45+.30*sin(2.*u+3.*across)+.18*cos(7.*u-2.5*across)+.08*sin(13.*u+11.*across);
      float oxide=smoothstep(.26,.77,pat);
      float edge=smoothstep(.88,1.,abs(across));
      float fiber=cos(82.*across+3.*sin(5.*u)+1.25*cos(11.*u));
      float micro=sin(263.*across+2.7*sin(7.*u))*sin(9.*u-7.5*across);
      float lines=1.-smoothstep(.72,.995,fiber);
      vec3 copper=mix(vec3(.34,.112,.062),vec3(.54,.265,.12),.5+.5*cos(3.*u-2.*across));
      vec3 verdigris=vec3(.058,.24,.21);
      vec3 foil=mix(copper,verdigris,oxide*.88);
      foil=mix(foil,vec3(.76,.68,.54),edge*.67);
      float key=panel(r,vec3(-.54,.60,.67),vec2(.30,.73),.16);
      float stripe=panel(r,vec3(-.67,.04,.74),vec2(.12,.52),.065);
      float soft=panel(r,vec3(.73,-.18,.62),vec2(.55,.28),.18);
      float rim=panel(r,vec3(.28,.76,-.61),vec2(.18,.78),.14);
      float silver=panel(r,vec3(.13,.26,.96),vec2(.11,.49),.065);
      float front=clamp(dot(n,normalize(vec3(-.58,.63,.58))),0.,1.);
      vec3 c=.49*foil+foil*front*.70;
      c+=vec3(1.12,.71,.40)*key*(.42+.68*(1.-oxide));
      c+=vec3(1.60,1.12,.64)*stripe*(.15+.45*foil.r);
      c+=vec3(.29,.66,.62)*soft*(.41+.47*oxide);
      c+=vec3(1.25,.64,.34)*rim*(.35+.75*f);
      c+=vec3(1.02,1.10,1.17)*silver*(.16+.34*f+.30*edge);
      c+=f*vec3(.11,.23,.24)+edge*(.08+.12*f);
      c*=.88+.14*lines+.038*micro;
      c+=vec3(.15,.23,.19)*u_energy*(.12+u_bands.y*.24)*(.43+.57*cos(3.*u+u_hue*6.283));
      c*=.96+.10*u_shine;
      c=c/(c+.71);
      c=pow(max(c,0.),vec3(.79));
      c+=(hash(gl_FragCoord.xy)-.5)*.019;
      frag=vec4(c,1.);
    }
  `;

  function rotation(pitch,yaw,roll) {
    const cx=Math.cos(pitch),sx=Math.sin(pitch),cy=Math.cos(yaw),sy=Math.sin(yaw);
    const cz=Math.cos(roll),sz=Math.sin(roll);
    return new Float32Array([
      cz*cy, sz*cy, -sy,
      cz*sy*sx-sz*cx,sz*sy*sx+cz*cx,cy*sx,
      cz*sy*cx+sz*sx,sz*sy*cx-cz*sx,cy*cx
    ]);
  }

  window.BeyondScenes ||= {};
  window.BeyondScenes.force = function({gl,program,triangle}) {
    const bg=program(planeVS,planeFS),mesh=program(meshVS,meshFS);
    const makeLocations=(prog,names)=>Object.fromEntries(names.map(n=>[n,gl.getUniformLocation(prog,n)]));
    const bu=makeLocations(bg,['u_a','u_e','u_m']),mu=makeLocations(mesh,['u_rot','u_aspect','u_scale','u_bands','u_energy','u_hue','u_shine']);
    const vao=gl.createVertexArray(),vbo=gl.createBuffer(),ebo=gl.createBuffer();
    gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ebo);
    for(let i=0;i<3;i++) {gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,3,gl.FLOAT,false,36,12*i)}
    gl.bindVertexArray(null);
    let data,q=-1,carry=0,clock=0,grab=null,lastDown=false,activity=0,deform=0,velocity=0,grabbed=false;
    let camera=rotation(.4,-.27,-.19), aspect=1,scale=3.15;
    const depthClear=new Float32Array([1]);
    function change(next) {
      data=build(...tiers[next],data);
      gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bufferData(gl.ARRAY_BUFFER,data.a.byteLength,gl.DYNAMIC_DRAW);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,data.tri,gl.STATIC_DRAW);
      gl.bindVertexArray(null);q=next;grab=null;
    }
    function pick(x,y) {
      let best=-1,bestD=.052;
      const p=data.now,m=camera;
      for(let k=0;k<p.length;k+=3){
        const xx=p[k],yy=p[k+1],zz=p[k+2];
        const d=eye-(m[2]*xx+m[5]*yy+m[8]*zz);
        const u=.5+.5*scale*(m[0]*xx+m[3]*yy+m[6]*zz)/(d*aspect);
        const v=.5+.5*scale*(m[1]*xx+m[4]*yy+m[7]*zz-.07)/d;
        const dd=((u-x)*Math.min(aspect,1.35))**2+(v-y)**2+d*.0005;
        if(dd<bestD){best=k;bestD=dd}
      }
      return best;
    }
    const windForce=new ClothVector(), normal=new ClothVector(), tmpForce=new ClothVector();
    const restore=new ClothVector(), dragForce=new ClothVector();
    function physics(target,level,reduced,auto,drive) {
      const {particles,a,ia,ib,length,stiff,cols,rows}=data;
      // Same r122 wind direction and normal projection, adapted to sculpture units and per-vertex area.
      const now=clock*1000;
      const windStrength=(Math.cos(now/7000)*20+40)*(reduced?0:auto?.0025:.001);
      windForce.set(Math.sin(now/2000),Math.cos(now/3000),Math.sin(now/1000));
      windForce.normalize();
      windForce.multiplyScalar(windStrength);
      const elastic=reduced?12.5:7.7, gx=grab?grab.node/3:-1, gi=Math.floor(gx/cols), gj=gx%cols;
      const pulse=auto&&!reduced ? 5.7*Math.pow(.5+.5*Math.sin(clock*2.1),6) : 0;
      for(let i=0;i<rows;i++){
        const ringD=grab?Math.min(Math.abs(i-gi),rows-Math.abs(i-gi)):0;
        const rowW=grab&&target ? Math.exp(-.017*(ringD*96/rows)**2):0;
        const waveD=(i/rows-.51-.19*Math.sin(clock*.81))*7.8;
        const wave=(pulse+(reduced?0:drive*4.8))*Math.exp(-waveD*waveD);
        for(let j=0;j<cols;j++){
          const id=i*cols+j,k=9*id,p=particles[id],pos=p.position,home=p.original;
          normal.set(a[k+3],a[k+4],a[k+5]);
          tmpForce.copy(normal).normalize().multiplyScalar(normal.dot(windForce));
          p.addForce(tmpForce);
          restore.set((home.x-pos.x)*elastic,(home.y-pos.y)*elastic,(home.z-pos.z)*(elastic*1.28)+wave*.7);
          if(reduced){
            restore.x-=(pos.x-p.previous.x)*24;restore.y-=(pos.y-p.previous.y)*24;restore.z-=(pos.z-p.previous.z)*24;
          }
          p.addForce(restore);
          if(rowW>.01){
            const w=rowW*Math.exp(-.095*((j-gj)*16/cols)**2)*23;
            dragForce.set((home.x+target[0]-pos.x)*w,(home.y+target[1]-pos.y)*w,(home.z+target[2]-pos.z)*w);
            p.addForce(dragForce);
          }
          p.integrate(step*step); // r122 Particle.integrate()
        }
      }
      const passes=level===0?2:3;
      for(let it=0;it<passes;it++) {
        for(let l=0;l<ia.length;l++){
          const pa=particles[ia[l]/3],pb=particles[ib[l]/3],v=pa.position,w=pb.position;
          // Soft bend/shear uses a relaxed goal; the upstream pair projection stays intact.
          const d=Math.sqrt((v.x-w.x)**2+(v.y-w.y)**2+(v.z-w.z)**2);
          satisfyConstraints(pa,pb,d+stiff[l]*(length[l]-d));
        }
        if(grab&&target) {
          const p=particles[grab.node/3].position;
          p.x+=(grab.rest[0]+target[0]-p.x)*.20;
          p.y+=(grab.rest[1]+target[1]-p.y)*.20;
          p.z+=(grab.rest[2]+target[2]-p.z)*.20;
        }
      }
    }
    function geometry() {
      const {now:p,prev,rest,a,left,right,lower,higher,n,particles}=data;
      for(let i=0;i<n;i++){
        const q=i*3,live=particles[i].position,old=particles[i].previous;
        p[q]=live.x;p[q+1]=live.y;p[q+2]=live.z;prev[q]=old.x;prev[q+1]=old.y;prev[q+2]=old.z;
      }
      let d2=0,v2=0;
      for(let i=0;i<n;i++){
        const q=i*3,d=i*9,l=left[i],r=right[i],b=lower[i],t=higher[i];
        const tx=p[r]-p[l],ty=p[r+1]-p[l+1],tz=p[r+2]-p[l+2];
        const bx=p[t]-p[b],by=p[t+1]-p[b+1],bz=p[t+2]-p[b+2];
        const nx=ty*bz-tz*by,ny=tz*bx-tx*bz,nz=tx*by-ty*bx;
        const norm=1/Math.max(1e-7,Math.sqrt(nx*nx+ny*ny+nz*nz));
        a[d]=p[q];a[d+1]=p[q+1];a[d+2]=p[q+2];a[d+3]=nx*norm;a[d+4]=ny*norm;a[d+5]=nz*norm;
        for(let c=0;c<3;c++){d2+=(p[q+c]-rest[q+c])**2;v2+=(p[q+c]-prev[q+c])**2;}
      }
      deform=Math.sqrt(d2/n);velocity=Math.sqrt(v2/n)/step;
    }
    function render(f) {
      const input=f.input||{},mark=f.mark||{},bands=f.bands||[0,0,0];
      const down=Boolean(input.down),reduced=Boolean(f.reduced),auto=Boolean(f.auto);
      const quality=clamp(f.quality??2,0,2)|0;
      if(!data||(!down&&quality!==q))change(quality);
      const age=f.age??f.time??0,dt=clamp(f.dt||0,0,.043);
      aspect=Math.max(.25,f.width/f.height);
      const portrait=clamp((.85-aspect)/.38,0,1);
      scale=Math.min(3.57,aspect*(2.05+.61*portrait));
      if(!lastDown)camera=rotation(.31+.10*portrait+(reduced?0:.045*Math.sin(age*.47)), -.31-.20*portrait+(reduced?0:.13*Math.sin(age*.33)), -.205-.48*portrait);
      if(down&&!lastDown){
        const u=clamp(input.x??.5,0,1),v=clamp(input.y??.5,0,1),node=pick(u,v);
        if(node>=0) grab={u,v,node,rest:[data.now[node],data.now[node+1],data.now[node+2]]};
      }
      if(!down)grab=null;
      let target=null;
      if(grab){
        const dx=(clamp(input.x??.5,0,1)-grab.u)*2*aspect*eye/scale;
        const dy=(clamp(input.y??.5,0,1)-grab.v)*2*eye/scale;
        const d=Math.hypot(dx,dy),s=Math.min(1,1.27/Math.max(.001,d));
        const lift=.34*clamp(input.pressure||.58,.2,1)+.19*Math.min(1,d);
        const m=camera;
        target=[s*(m[0]*dx+m[1]*dy)+m[2]*lift,s*(m[3]*dx+m[4]*dy)+m[5]*lift,s*(m[6]*dx+m[7]*dy)+m[8]*lift];
      }
      grabbed=Boolean(grab);lastDown=down;
      carry+=dt;clock+=dt;
      for(let k=0;k<4&&carry>=step;k++,carry-=step)physics(target,q,reduced,auto,(bands[0]||0)*.65+(bands[1]||0)*.35);
      geometry();
      activity+=(clamp((grabbed?.50:0)+deform*2.8+(mark.energy||0)*.23,0,1)-activity)*Math.min(1,dt*7);
      gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.disable(gl.BLEND);
      gl.useProgram(bg);gl.uniform1f(bu.u_a,aspect);gl.uniform1f(bu.u_e,activity);gl.uniform2f(bu.u_m,mark.x??.5,mark.y??.5);
      triangle(bg);
      gl.clearBufferfv(gl.DEPTH,0,depthClear);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.depthMask(true);
      gl.useProgram(mesh);gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bufferSubData(gl.ARRAY_BUFFER,0,data.a);
      gl.uniformMatrix3fv(mu.u_rot,false,camera);gl.uniform1f(mu.u_aspect,aspect);gl.uniform1f(mu.u_scale,scale);
      gl.uniform3f(mu.u_bands,bands[0]||0,bands[1]||0,bands[2]||0);gl.uniform1f(mu.u_energy,activity);
      gl.uniform1f(mu.u_hue,mark.hue||0);gl.uniform1f(mu.u_shine,Math.min(1,velocity*.42+.16+(bands[2]||0)*.5));
      gl.drawElements(gl.TRIANGLES,data.tri.length,gl.UNSIGNED_SHORT,0);
      gl.bindVertexArray(null);gl.disable(gl.DEPTH_TEST);
    }
    return {render,
      stats:()=>({particles:0,module:'闭环扭绸 · Three.js r122 Verlet / 约束松弛',grid:data?`${data.rows}×${data.cols} 网格约束`:'网格约束',
        vertices:data?.n||0,constraints:data?.ia.length||0,displacement:deform,velocity,grabbed}),
      dispose(){gl.deleteBuffer(vbo);gl.deleteBuffer(ebo);gl.deleteVertexArray(vao);gl.deleteProgram(bg);gl.deleteProgram(mesh)}
    };
  };
})();
