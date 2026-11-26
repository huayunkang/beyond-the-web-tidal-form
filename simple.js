(() => {
  'use strict';
  const TAU=Math.PI*2, clip=(v,a,b)=>Math.max(a,Math.min(b,v));
  const bright=['#ffdfaa','#bd8458','#6e392e','#718b71','#2b5d55'];
  const signatures=[
    'Canvas 2D · CPU 三维点阵投影',
    'Canvas 2D · CPU 速度网格 / 示踪粒子',
    'Canvas 2D · CPU 网格投影 / 近似光照',
    'Canvas 2D · CPU 弹性网 / 位移回弹'
  ];
  function random(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}}
  function pose(w,h,pitch,yaw,roll,s){
    return {w,h,cx:w*.518,cy:h*.50,k:Math.min(w,h)*s,x:Math.cos(pitch),a:Math.sin(pitch),y:Math.cos(yaw),b:Math.sin(yaw),z:Math.cos(roll),c:Math.sin(roll)};
  }
  function project(o,x,y,z,m){
    const yy=m.x*y-m.a*z, zz=m.a*y+m.x*z;
    const xx=m.y*x+m.b*zz, depth=m.y*zz-m.b*x, d=4.5/(4.5-depth);
    o.x=m.cx+(m.z*xx-m.c*yy)*m.k*d;o.y=m.cy-(m.c*xx+m.z*yy)*m.k*d;o.z=depth;
    o.u=m.z*xx-m.c*yy;o.v=m.c*xx+m.z*yy;
  }
  function basis(u,v,kind) {
    const radius=(kind===2?1.52:1.42)+.16*Math.cos(2*u-.54)+.092*Math.cos(3*u+1.2);
    const twist=u+.7*Math.sin(u+.65)+.27*Math.sin(3*u-.26);
    const cloth=(.34+.15*(.5+.5*Math.cos(2*u+1.3)))*v;
    const r=radius+cloth*Math.cos(twist);
    return [r*Math.cos(u)+.10*Math.sin(2*u),.81*r*Math.sin(u)+.12*Math.sin(2*u-.65),
      .27*Math.sin(3*u+.55)+.18*Math.cos(2*u-1.35)+cloth*Math.sin(twist)+.058*Math.sin(9*v+3*u)*(1-v*v)];
  }
  function makeMesh(id,res){
    const grid=id===3?(res?52:45):(res?60:48), columns=id===3?6:7,n=grid*columns;
    const rest=new Float32Array(n*3), out=Array.from({length:n},()=>({}));
    const faces=[], links=[];
    const at=(i,j)=>(i%grid)*columns+j;
    function link(a,b,weight){
      const x=a*3,y=b*3;links.push([x,y,Math.hypot(rest[y]-rest[x],rest[y+1]-rest[x+1],rest[y+2]-rest[x+2]),weight]);
    }
    for(let i=0;i<grid;i++)for(let j=0;j<columns;j++)rest.set(basis(TAU*i/grid,2*j/(columns-1)-1,id),3*at(i,j));
    for(let i=0;i<grid;i++)for(let j=0;j<columns-1;j++){
      const a=at(i,j),b=at(i+1,j),c=at(i+1,j+1),d=at(i,j+1);
      faces.push({a,b,c,d,u:TAU*i/grid,v:2*(j+.5)/(columns-1)-1,z:0});
      if(id===3){
        link(a,b,.72);link(a,d,.77);link(a,c,.42);
        if(j===columns-2)link(d,c,.76);
      }
    }
    return {grid,columns,n,rest,now:rest.slice(),prev:rest.slice(),out,faces,links};
  }
  function interpolate(g,j,cols,s,t){return (g[j]*(1-s)+g[j+1]*s)*(1-t)+(g[j+cols]*(1-s)+g[j+cols+1]*s)*t}
  function rgb(r,g,b){return 'rgb('+clip(r|0,0,255)+','+clip(g|0,0,255)+','+clip(b|0,0,255)+')'}
  function renderMesh(ctx,mesh,camera,kind,edge){
    const {n,now,faces,out}=mesh;
    for(let i=0,k=0;i<n;i++,k+=3)project(out[i],now[k],now[k+1],now[k+2],camera);
    for(const f of faces)f.z=(out[f.a].z+out[f.b].z+out[f.c].z+out[f.d].z)*.25;
    faces.sort((a,b)=>a.z-b.z);
    ctx.lineWidth=.70;
    for(const f of faces){
      const a=out[f.a],b=out[f.b],c=out[f.c],d=out[f.d];
      const vx=b.u-a.u,vy=b.v-a.v,vz=b.z-a.z, wx=d.u-a.u,wy=d.v-a.v,wz=d.z-a.z;
      const nx=vy*wz-vz*wy,ny=vz*wx-vx*wz,nz=vx*wy-vy*wx;
      const normal=(nz<0?-1:1)/Math.max(.000001,Math.sqrt(nx*nx+ny*ny+nz*nz));
      const x=nx*normal,y=ny*normal,z=nz*normal;
      const light=clip(-x*.37+y*.58+z*.72,0,1), rim=Math.pow(1-clip(z,0,1),1.7);
      const silk=.44+.36*Math.sin(3*f.u+3*f.v)+.16*Math.cos(9*f.u-6*f.v);
      const flash=Math.pow(Math.abs(-x*.43+y*.48+z*.75),5);
      const border=clip((Math.abs(f.v)-.58)*2.3,0,1);
      let c0;
      if(kind===2){
        const tinted=clip(.55+.43*Math.sin(4*f.u+6*f.v),0,1);
        const n0=49+133*light+60*flash;
        c0=rgb(n0+19+25*tinted+27*border,n0+8-5*tinted+15*border,n0-1-27*tinted+12*border);
      }else{
        const teal=clip(silk,0,1),s=17+light*45, shine=90*flash*(.68+edge*.32)+rim*33+border*18;
        c0=rgb(s+96*(1-teal)+shine,s+46*(1-teal)+32*teal+shine*.79,s+20*(1-teal)+29*teal+shine*.62);
      }
      ctx.fillStyle=ctx.strokeStyle=c0;
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(c.x,c.y);ctx.lineTo(d.x,d.y);ctx.closePath();ctx.stroke();ctx.fill();
    }
  }

  window.BeyondSimple=(canvas,actIndex)=>{
    const ctx=canvas.getContext('2d',{alpha:false});
    if(!ctx)throw Error('需要独立的 Canvas 2D 画布');
    const id=clip(actIndex|0,0,3),rng=random(32907+id);
    const base=['#0c120f','#0b1210','#171410','#110e0b'][id];
    let size='',background,w=0,h=0,lastDown=false,moveX=.5,moveY=.5,spinX=0,spinY=0,time=0,active=true;
    let mesh=null,drift=null,grip=null,carry=0,distance=0,speed=0;
    const W=24,H=17;
    function sceneSize(){
      const aw=canvas.width,ah=canvas.height,key=aw+'x'+ah;
      if(size===key)return false;
      size=key;w=Math.max(aw,1);h=Math.max(ah,1);
      background=ctx.createRadialGradient(w*.54,h*.49,0,w*.51,h*.48,Math.max(w,h)*.65);
      const tone=['#25352a','#142820','#433b32','#322921'][id];
      background.addColorStop(0,tone);background.addColorStop(.48,base);background.addColorStop(1,'#080b09');
      return true;
    }
    function paint(){
      ctx.globalAlpha=1;ctx.fillStyle=background;ctx.fillRect(0,0,w,h);
    }
    function configure(q){
      if(drift||mesh)return;
      if(id===0){
        const n=q===0?760:q===1?1030:1360,seed=new Float32Array(n*3);
        for(let i=0;i<seed.length;i++)seed[i]=rng();
        drift={n,seed};
      }else if(id===1){
        const n=q===0?430:q===1?610:780,x=new Float32Array(n),y=x.slice(),phase=x.slice();
        for(let i=0;i<n;i++){x[i]=rng();y[i]=rng();phase[i]=rng()*TAU}
        drift={n,x,y,phase,vx:new Float32Array(W*H),vy:new Float32Array(W*H)};
      }else mesh=makeMesh(id,q>0);
    }
    const o={};
    function genesis(f,m){
      const {n,seed}=drift, reduced=!!f.reduced, input=f.input||{}, mark=f.mark||{};
      const a=reduced?0:time, camera=pose(w,h,.26,-.24+spinX*.72,-.42,.291);
      paint();
      for(let color=0;color<bright.length;color++){
        ctx.fillStyle=bright[color];ctx.globalAlpha=[.78,.60,.48,.62,.59][color];
        ctx.beginPath();
        for(let i=color;i<n;i+=bright.length){
          const k=i*3,u=TAU*seed[k],j=Math.floor(seed[k+1]*36)/36,p=seed[k+2];
          const phase=u+TAU*j*.72+a*.12+spinY*.63;
          const rad=1.12+.31*Math.cos(phase*2-j*6)+.082*Math.sin(9*u+10*j+a)+.12*(p-.5);
          const v=.45*Math.sin(3*u-j*6+a*.42)+.29*Math.sin(4*j*TAU+u-.19*a);
          project(o,rad*Math.cos(phase),.75*rad*Math.sin(phase),v,camera);
          const px=input.x??.5, py=input.y??.5,dx=o.x-px*w,dy=o.y-(1-py)*h,den=Math.max(4,dx*dx+dy*dy);
          const influence=input.down?Math.exp(-den/(m*m*.063))*(.13+(mark.energy||0)*.027):0;
          const r=(.86+p*1.66)*Math.max(.91,Math.min(1.70,m/490))*(.91+.24*Math.max(0,o.z));
          ctx.rect(o.x+dx*influence-r*.5,o.y+dy*influence-r*.5,r,r);
        }
        ctx.fill();
      }
      ctx.globalAlpha=1;
    }
    function flow(f,m,dt,rebuild){
      const {n,x,y,phase,vx,vy}=drift,input=f.input||{},press=!!input.down,reduce=!!f.reduced;
      if(rebuild)paint();
      const mag=clip(dt*60,0,2.2),x0=input.x??.5,y0=input.y??.5;
      const dx=clip(input.dx||0,-.06,.06),dy=clip(input.dy||0,-.06,.06),t=reduce?0:time*.61;
      for(let j=0,k=0;j<H;j++)for(let i=0;i<W;i++,k++){
        const u=i/(W-1),v=j/(H-1),x=u-x0,y=v-y0,weight=press?Math.exp(-48*(x*x+y*y)):0;
        const a=(u-.5)*1.14,b=v-.51,r=Math.hypot(a,b);
        const swell=reduce?0:.0027*Math.exp(-Math.abs(r-.30)*4.0);
        vx[k]=vx[k]*(reduce?.81:.955)+mag*(swell*(-b)*(.4+.6*Math.cos(t))-weight*y*.013+weight*dx*.66);
        vy[k]=vy[k]*(reduce?.81:.955)+mag*(swell*a*(.55+.45*Math.cos(t-.7))+weight*x*.013+weight*dy*.66);
      }
      ctx.globalAlpha=reduce?.35:clip(dt*3.25,.028,.16);
      ctx.fillStyle=base;ctx.fillRect(0,0,w,h);ctx.globalAlpha=1;
      const palette=['#549d80','#82aa8b','#ce9160','#a65542'];
      ctx.lineWidth=Math.max(.83,Math.min(1.85,m/565));
      for(let k=0;k<palette.length;k++){
        ctx.strokeStyle=palette[k];ctx.globalAlpha=[.44,.40,.46,.43][k];ctx.beginPath();
        for(let i=k;i<n;i+=4){
          const a=x[i],b=y[i],u=clip(a*(W-1),0,W-1.001),v=clip(b*(H-1),0,H-1.001);
          const ix=Math.floor(u),iy=Math.floor(v),j=iy*W+ix,s=u-ix,t=v-iy;
          const av=interpolate(vx,j,W,s,t),bv=interpolate(vy,j,W,s,t);

          const halo=reduce?0:.00055*Math.sin(time*.62+phase[i]);
          const xx=a+(av+halo)*mag,yy=b+(bv+halo*.55)*mag;
          if(xx<.025||xx>.975||yy<.025||yy>.975||rng()<.0035){
            const phi=rng()*TAU,r=.19+rng()*.23;x[i]=.51+r*Math.cos(phi)*.97;y[i]=.49+r*Math.sin(phi)*.76;
            continue;
          }
          x[i]=xx;y[i]=yy;
          if(Math.abs(xx-a)+Math.abs(yy-b)>.00012){ctx.moveTo(a*w,(1-b)*h);ctx.lineTo(xx*w,(1-yy)*h);}
        }
        ctx.stroke();
      }
      ctx.globalAlpha=1;
    }
    function nearest(camera,pointer){
      const p=mesh.now,o={};let picked=-1,min=(Math.min(w,h)*.196)**2;
      for(let i=0;i<p.length;i+=3){
        project(o,p[i],p[i+1],p[i+2],camera);
        const e=(o.x-(pointer.x??.5)*w)**2+(o.y-(1-(pointer.y??.5))*h)**2;
        if(e<min){min=e;picked=i;}
      }
      return picked;
    }
    function spring(f,camera,dt){
      const input=f.input||{},p=mesh.now,old=mesh.prev,rest=mesh.rest,reduced=!!f.reduced;
      if(input.down&&!lastDown){
        const k=nearest(camera,input);
        if(k>=0)grip={k,x:input.x??.5,y:input.y??.5,orig:[p[k],p[k+1],p[k+2]]};
      }
      if(!input.down)grip=null;
      carry+=dt;
      for(let j=0;j<3&&carry>=.018;j++,carry-=.018){
        const damp=reduced?.87:.958;
        for(let k=0;k<p.length;k++){
          const x=p[k],v=(x-old[k])*damp;
          p[k]=x+v+(rest[k]-x)*(reduced?.062:.028);
          if(!reduced&&k%3===2)p[k]+=.00035*Math.sin(time*2.2+(k/mesh.columns)*.24)*(f.auto?2:1);
          old[k]=x;
        }
        for(const [a,b,d,s] of mesh.links){
          const x=p[b]-p[a],y=p[b+1]-p[a+1],z=p[b+2]-p[a+2],len=Math.sqrt(x*x+y*y+z*z);
          if(len<.00001)continue;
          const k=.5*s*(len-d)/len;
          p[a]+=k*x;p[a+1]+=k*y;p[a+2]+=k*z;p[b]-=k*x;p[b+1]-=k*y;p[b+2]-=k*z;
        }
        if(grip){
          const {k,x,y,orig}=grip;
          const a=clip(((input.x??.5)-x)*w/camera.k,-1,1),b=clip(((input.y??.5)-y)*h/camera.k,-1,1);
          p[k]+=(orig[0]+camera.z*a+camera.c*b-p[k])*.29;
          p[k+1]+=(orig[1]-camera.c*a+camera.z*b-p[k+1])*.29;
          p[k+2]+=(orig[2]+.11+Math.hypot(a,b)*.15-p[k+2])*.22;
        }
      }
      let a=0,b=0;
      for(let k=0;k<p.length;k++){a+=(p[k]-rest[k])**2;b+=(p[k]-old[k])**2;}
      distance=Math.sqrt(a/mesh.n);speed=Math.sqrt(b/mesh.n)/.018;
    }
    const render=f=>{
      if(!active)return;
      const input=f.input||{},dt=clip(f.dt??1/60,0,.042),tool=input.down,mark=f.mark||{},reduced=!!f.reduced;
      configure(clip(f.quality??1,0,2));const rebuild=sceneSize(),m=Math.min(w,h);
      time+=dt;
      const px=input.x??moveX,py=input.y??moveY;
      if(tool){spinX=clip(spinX+(px-moveX)*3.7,-1.4,1.4);spinY=clip(spinY+(py-moveY)*2.55,-.97,.97);}
      moveX=px;moveY=py;
      if(id===0)genesis(f,m);
      else if(id===1)flow(f,m,dt,rebuild);
      else{
        const portrait=clip((.85-w/h)*2.7,0,1);
        const moment=reduced?0:time*.31;
        const orbit=id===2?spinX+Math.sin(moment)*.38:.13*Math.sin(moment);
        const camera=pose(w,h,.22+portrait*.36+(id===2?spinY:0),-.34+orbit,-.36-portrait*.36,.275);
        if(id===3)spring(f,camera,dt);
        paint();
        ctx.globalAlpha=.32;ctx.fillStyle='#080807';ctx.beginPath();ctx.ellipse(w*.52,h*.50+m*.26,m*.29,m*.046,-.04,0,TAU);ctx.fill();ctx.globalAlpha=1;
        renderMesh(ctx,mesh,camera,id,clip((mark.energy||0)+(f.bands?.[1]||0),0,1));
      }
      lastDown=Boolean(tool);
    };
    return {render,stats(){return {module:signatures[id],particles:drift?.n||0,
      grid:id===1?'24×17 速度网格':mesh?mesh.grid+'×'+mesh.columns+' 网格':id===0?'36 股点列':'待绘制',
      vertices:mesh?.n||0,constraints:mesh?.links.length||0,displacement:distance,velocity:speed,grabbed:!!grip,
      backend:'Canvas 2D'}},
      dispose(){active=false;drift=null;mesh=null;grip=null;background=null;}
    };
  };
})();
