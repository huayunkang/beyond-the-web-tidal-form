/* ACT 02 — 渗流 / FLOW. WebGL2 host adapting the original MIT solver and source shaders; methods and sources:
   GPU Gems Ch.38 (Mark J. Harris); Pavel Dobryakov, WebGL-Fluid-Simulation (2017, MIT; see licenses/PavelDoGreat-WebGL-Fluid-Simulation.MIT.txt). */
(() => {
  'use strict';

  const VS = `#version 300 es
  precision highp float;
  out vec2 uv;
  void main() {
    vec2 q = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
    uv = q;
    gl_Position = vec4(q * 2.0 - 1.0, 0.0, 1.0);
  }`;
  const FS = body => `#version 300 es
  precision highp float;
  precision highp sampler2D;
  in vec2 uv;
  out vec4 outColor;
  ${body}`;
  const seat = `
  uniform vec2 uRect;
  uniform float uMark;
  vec2 turn(vec2 p, float a) {
    float c=cos(a), s=sin(a);
    return vec2(c*p.x+s*p.y,-s*p.x+c*p.y);
  }
  vec2 opening(vec2 u) {
    vec2 p=(u-0.5)*uRect;
    float portrait=smoothstep(0.0,.48,uRect.y-1.0);
    p=turn(p,mix(.40,1.10,portrait));
    return p*vec2(.72,1.18);
  }
  vec3 blendInk(float t) {
    vec3 silver=vec3(.97,.10,.035), oxide=vec3(.24,.88,.045), copper=vec3(.25,.055,.86);
    return silver*(.36+.64*smoothstep(.28,.97,t))
       + oxide*(1.0-smoothstep(.07,.52,abs(t-.27)))*.68
       + copper*(1.0-smoothstep(.11,.53,abs(t-.82)))*.66;
  }`;

  // Literal upstream GLSL, extracted from lab/pavel/script.js before the WebGL 2 wrapper.
  const PAVEL = Object.freeze({
    vertex: `
    precision highp float;

    attribute vec2 aPosition;
    varying vec2 vUv;
    varying vec2 vL;
    varying vec2 vR;
    varying vec2 vT;
    varying vec2 vB;
    uniform vec2 texelSize;

    void main () {
        vUv = aPosition * 0.5 + 0.5;
        vL = vUv - vec2(texelSize.x, 0.0);
        vR = vUv + vec2(texelSize.x, 0.0);
        vT = vUv + vec2(0.0, texelSize.y);
        vB = vUv - vec2(0.0, texelSize.y);
        gl_Position = vec4(aPosition, 0.0, 1.0);
    }
`,
    splat: `
    precision highp float;
    precision highp sampler2D;

    varying vec2 vUv;
    uniform sampler2D uTarget;
    uniform float aspectRatio;
    uniform vec3 color;
    uniform vec2 point;
    uniform float radius;

    void main () {
        vec2 p = vUv - point.xy;
        p.x *= aspectRatio;
        vec3 splat = exp(-dot(p, p) / radius) * color;
        vec3 base = texture2D(uTarget, vUv).xyz;
        gl_FragColor = vec4(base + splat, 1.0);
    }
`,
    curl: `
    precision mediump float;
    precision mediump sampler2D;

    varying highp vec2 vUv;
    varying highp vec2 vL;
    varying highp vec2 vR;
    varying highp vec2 vT;
    varying highp vec2 vB;
    uniform sampler2D uVelocity;

    void main () {
        float L = texture2D(uVelocity, vL).y;
        float R = texture2D(uVelocity, vR).y;
        float T = texture2D(uVelocity, vT).x;
        float B = texture2D(uVelocity, vB).x;
        float vorticity = R - L - T + B;
        gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
    }
`,
    vorticity: `
    precision highp float;
    precision highp sampler2D;

    varying vec2 vUv;
    varying vec2 vL;
    varying vec2 vR;
    varying vec2 vT;
    varying vec2 vB;
    uniform sampler2D uVelocity;
    uniform sampler2D uCurl;
    uniform float curl;
    uniform float dt;

    void main () {
        float L = texture2D(uCurl, vL).x;
        float R = texture2D(uCurl, vR).x;
        float T = texture2D(uCurl, vT).x;
        float B = texture2D(uCurl, vB).x;
        float C = texture2D(uCurl, vUv).x;

        vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
        force /= length(force) + 0.0001;
        force *= curl * C;
        force.y *= -1.0;

        vec2 velocity = texture2D(uVelocity, vUv).xy;
        velocity += force * dt;
        velocity = min(max(velocity, -1000.0), 1000.0);
        gl_FragColor = vec4(velocity, 0.0, 1.0);
    }
`,
    divergence: `
    precision mediump float;
    precision mediump sampler2D;

    varying highp vec2 vUv;
    varying highp vec2 vL;
    varying highp vec2 vR;
    varying highp vec2 vT;
    varying highp vec2 vB;
    uniform sampler2D uVelocity;

    void main () {
        float L = texture2D(uVelocity, vL).x;
        float R = texture2D(uVelocity, vR).x;
        float T = texture2D(uVelocity, vT).y;
        float B = texture2D(uVelocity, vB).y;

        vec2 C = texture2D(uVelocity, vUv).xy;
        if (vL.x < 0.0) { L = -C.x; }
        if (vR.x > 1.0) { R = -C.x; }
        if (vT.y > 1.0) { T = -C.y; }
        if (vB.y < 0.0) { B = -C.y; }

        float div = 0.5 * (R - L + T - B);
        gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
    }
`,
    clear: `
    precision mediump float;
    precision mediump sampler2D;

    varying highp vec2 vUv;
    uniform sampler2D uTexture;
    uniform float value;

    void main () {
        gl_FragColor = value * texture2D(uTexture, vUv);
    }
`,
    pressure: `
    precision mediump float;
    precision mediump sampler2D;

    varying highp vec2 vUv;
    varying highp vec2 vL;
    varying highp vec2 vR;
    varying highp vec2 vT;
    varying highp vec2 vB;
    uniform sampler2D uPressure;
    uniform sampler2D uDivergence;

    void main () {
        float L = texture2D(uPressure, vL).x;
        float R = texture2D(uPressure, vR).x;
        float T = texture2D(uPressure, vT).x;
        float B = texture2D(uPressure, vB).x;
        float C = texture2D(uPressure, vUv).x;
        float divergence = texture2D(uDivergence, vUv).x;
        float pressure = (L + R + B + T - divergence) * 0.25;
        gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
    }
`,
    gradient: `
    precision mediump float;
    precision mediump sampler2D;

    varying highp vec2 vUv;
    varying highp vec2 vL;
    varying highp vec2 vR;
    varying highp vec2 vT;
    varying highp vec2 vB;
    uniform sampler2D uPressure;
    uniform sampler2D uVelocity;

    void main () {
        float L = texture2D(uPressure, vL).x;
        float R = texture2D(uPressure, vR).x;
        float T = texture2D(uPressure, vT).x;
        float B = texture2D(uPressure, vB).x;
        vec2 velocity = texture2D(uVelocity, vUv).xy;
        velocity.xy -= vec2(R - L, T - B);
        gl_FragColor = vec4(velocity, 0.0, 1.0);
    }
`,
    advection: `
    precision highp float;
    precision highp sampler2D;

    varying vec2 vUv;
    uniform sampler2D uVelocity;
    uniform sampler2D uSource;
    uniform vec2 texelSize;
    uniform vec2 dyeTexelSize;
    uniform float dt;
    uniform float dissipation;

    vec4 bilerp (sampler2D sam, vec2 uv, vec2 tsize) {
        vec2 st = uv / tsize - 0.5;

        vec2 iuv = floor(st);
        vec2 fuv = fract(st);

        vec4 a = texture2D(sam, (iuv + vec2(0.5, 0.5)) * tsize);
        vec4 b = texture2D(sam, (iuv + vec2(1.5, 0.5)) * tsize);
        vec4 c = texture2D(sam, (iuv + vec2(0.5, 1.5)) * tsize);
        vec4 d = texture2D(sam, (iuv + vec2(1.5, 1.5)) * tsize);

        return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);
    }

    void main () {
    #ifdef MANUAL_FILTERING
        vec2 coord = vUv - dt * bilerp(uVelocity, vUv, texelSize).xy * texelSize;
        vec4 result = bilerp(uSource, coord, dyeTexelSize);
    #else
        vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
        vec4 result = texture2D(uSource, coord);
    #endif
        float decay = 1.0 + dissipation * dt;
        gl_FragColor = result / decay;
    }`
  });
  const pavelVertex = '#version 300 es\n' + PAVEL.vertex
    .replace('attribute vec2 aPosition;', '')
    .replace(/\bvarying\b/g,'out')
    .replace(/void main\s*\(\s*\)\s*\{/, 'void main(){\nvec2 aPosition=vec2(float((gl_VertexID << 1) & 2),float(gl_VertexID & 2))*2.0-1.0;');
  const pavelFragment = (key,manual) => '#version 300 es\n'
    + (manual && key==='advection' ? '#define MANUAL_FILTERING\n' : '')
    + 'precision highp float;\nout vec4 pavelOut;\n'
    + PAVEL[key].replace(/\bvarying\b/g,'in').replace(/\btexture2D\b/g,'texture').replace(/\bgl_FragColor\b/g,'pavelOut');

  const source = {
    seed: `${seat}
    uniform int uMode;
    uniform float uCells;
    uniform vec4 uArrival;
    float stripe(float signedDist,float phase) {
      float bell=exp(-pow(signedDist/.036,2.0));
      float lamella=1.0+0.28*sin(signedDist*542.0+phase)+.13*sin(signedDist*903.0-phase*1.3);
      return bell*lamella+0.26*exp(-pow(signedDist/.083,2.0));
    }
    vec2 spin(vec2 p,vec2 center,float extent,float strength) {
      vec2 d=p-center;
      return vec2(-d.y,d.x)*exp(-dot(d,d)/(extent*extent))*strength;
    }
    void main(){
      vec2 p=opening(uv);
      float r=length(p), a=atan(p.y,p.x);
      if(uMode==0) {
        vec2 q=(uv-.5)*uRect;
        vec2 w=spin(q,vec2(-.23,.11),.43,.68)+spin(q,vec2(.26,-.075),.32,-.88)
              +spin(q,vec2(.035,.21),.50,.31)+spin(q,(uArrival.xy-.5)*uRect,.19,.16*uArrival.z);
        w+=vec2(.05*q.y, -.035*q.x);
        w*=uCells;
        outColor=vec4(w,0,1);
        return;
      }
      // Two continuous sheets, with their breaks at opposite ends of a diagonal.
      float phase=3.0*sin(a*3.0)+1.8*sin(a*7.0+.8)+.46*sin(a*17.0);
      float f=r-(.308+.045*sin(2.0*a-.7)+.021*sin(5.0*a+.4));
      float g=r-(.246-.05*sin(2.0*a-.36)+.025*cos(4.0*a-.4));
      float g1=smoothstep(-.81,-.32,cos(a+.77));
      float g2=smoothstep(-.70,-.25,cos(a-2.51));
      float taper=.62+.50*pow(.5+.5*sin(a*2.0-.42),1.55);
      float outer=stripe(f,phase)*g1*taper;
      float inner=stripe(g,phase*.73+1.1)*g2;
      float echo=.27*stripe(f-.068,phase*1.3)*g1*smoothstep(.18,.88,sin(a+.82));
      float thread=exp(-pow((r-.145-.058*sin(2.0*a))/.016,2.0))*.2*smoothstep(.08,.66,cos(a-1.4));
      float bias=clamp(uMark,0.0,1.0);
      vec3 cool = mix(vec3(.52,.83,.02),vec3(1.06,.48,.045),smoothstep(-.32,.68,cos(a-.8)));
      vec3 hot = mix(vec3(.24,.054,1.0),vec3(.96,.28,.38),smoothstep(-.22,.88,cos(a+2.18)));
      vec3 ink=outer*cool + inner*hot*.84 + echo*vec3(.53,.70,.21) + thread*vec3(.78,.51,.16);
      ink*=mix(.91,1.10,bias);
      vec2 d=(uv-uArrival.xy)*uRect;
      ink+=blendInk(bias)*exp(-dot(d,d)/.009)*uArrival.z*.075;
      outColor=vec4(ink,1);
    }`,
    copy: `
    uniform sampler2D uA;
    uniform float uMul;
    void main(){outColor=vec4(texture(uA,uv).rgb*uMul,1);}`,
    show: `${seat}${window.EditionTypes.causticGLSL}
    uniform sampler2D uA;
    uniform vec2 uPix;
    uniform float uFrame; uniform sampler2D uType, uVel; uniform float uAspect;
    float felt(vec3 c){return log(1.0+dot(c,vec3(.94,.84,.83)));}
    float dust(vec2 p){
      vec3 q=fract(vec3(p.xyx)*.1031);
      q+=dot(q,q.yzx+27.17);
      return fract((q.x+q.y)*q.z);
    }
    void main(){
      vec3 sampleInk=max(texture(uA,uv).rgb,0.);
      vec2 sx=vec2(uPix.x,0), sy=vec2(0,uPix.y);
      float d=felt(sampleInk);
      float L=felt(texture(uA,uv-sx).rgb), R=felt(texture(uA,uv+sx).rgb);
      float D=felt(texture(uA,uv-sy).rgb), U=felt(texture(uA,uv+sy).rgb);
      vec2 g=vec2(R-L,U-D);
      vec3 N=normalize(vec3(-g*13.0,1.0));
      vec3 light=normalize(vec3(-.62,.42,.78));
      float nDot=max(dot(N,light),0.0);
      float high=pow(max(dot(N,normalize(vec3(-.41,.24,1.0))),0.),24.);
      float edge=smoothstep(.012,.17,length(g));
      float mass=dot(sampleInk,vec3(1));
      vec3 rgb=(sampleInk.r*vec3(.98,.095,.035)
                +sampleInk.g*vec3(.035,.39,.98)
                +sampleInk.b*vec3(1.0,.60,.09))/max(mass,.0001);
      float cover=1.-exp(-mass*1.82);
      vec2 vel=texture(uVel,uv).xy;
      // Letterpress on the bottom glass: actual solved velocity bends its image.
      vec2 letter=uv-vec2(.5,.53);
      letter*=vec2(1.08,1.08*2.7/uAspect);
      letter+=vec2(.5)+clamp(vel*vec2(.00165,.0034),vec2(-.12),vec2(.12))+g*.068;
      float glyph=0.; float focusGain=1.;
      if(all(greaterThanEqual(letter,vec2(0)))&&all(lessThanEqual(letter,vec2(1)))) { vec3 ray=editionCaustic(uv*vec2(uAspect,1.)*900.,uFrame/12.,108.,min(.64,.12+.04*length(vel))); letter+=ray.xy/vec2(1440.,512.);focusGain=ray.z;glyph=texture(uType,letter).r; }
      float ridges=.5+.5*sin(d*62.+dot(uv,vec2(26.,38.)));
      float glint=pow(max(dot(N,normalize(vec3(-.46,.36,.99))),0.),36.);
      float grain=dust(gl_FragCoord.xy)-.5;
      vec3 paper=mix(vec3(.105,.032,.054),vec3(.17,.054,.06),uv.x*.6+uv.y*.4);
      paper=mix(paper,vec3(.99,.80,.67)*mix(1.,focusGain,.63),glyph*.87);
      vec3 enamel=rgb*(.72+.47*nDot)+vec3(.44,.67,.86)*glint*.53+edge*(.11+.25*ridges);
      vec3 color=mix(paper,enamel,cover*.94)+grain*.018;
      color+=cover*glyph*(.1+.31*edge)*vec3(1.,.92,.70);
      outColor=vec4(max(color,0.),1.);
    }`
  };

  const levels = [[80,320,12],[128,512,17],[176,736,22]];
  const limit = (n, a, b) => Math.min(b, Math.max(a, n));
  const value = (n, fallback) => Number.isFinite(n) ? n : fallback;

  function flow(api) {
    const { gl } = api;
    const ext = gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float');
    if (!ext) throw new Error('Flow needs a renderable half-float WebGL2 target.');
    const linear=!!gl.getExtension('OES_texture_float_linear');
    const texLimit = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), 1792);
    const shaders = {};
    // Generate a local font plate. No font file or image is downloaded.
    const card=document.createElement('canvas');card.width=1440;card.height=512;
    const pen=card.getContext('2d');pen.fillStyle='#000';pen.fillRect(0,0,1440,512);
    pen.fillStyle='#fff';pen.textAlign='center';pen.textBaseline='middle';
    pen.font='500 448px EditionRoman,Georgia,serif';pen.save();pen.translate(720,244);pen.scale(1300/pen.measureText('CHAOS').width,1);pen.lineWidth=4.6;pen.strokeStyle='#fff';pen.lineJoin='round';pen.strokeText('CHAOS',0,0);pen.fillText('CHAOS',0,0);pen.restore();
    const letters={tex:gl.createTexture()};gl.bindTexture(gl.TEXTURE_2D,letters.tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,card);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
    for(const k of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,k,gl.LINEAR);
    for(const k of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,k,gl.CLAMP_TO_EDGE);
    let fields = null, failed = false, frames = 0, steps = 0, jacobi = 0, lastPasses = 0, modelClock = 0;
    let mark = [.5,.5,0], hue=.18, serial=0, lastX=.5,lastY=.5, generated = false;
    const caps = [gl.BLEND,gl.DEPTH_TEST,gl.CULL_FACE,gl.SCISSOR_TEST,gl.STENCIL_TEST];

    try {
      for(const key of Object.keys(PAVEL)) if(key!=='vertex') {
        const p=api.program(pavelVertex,pavelFragment(key,!linear));
        if(!p) throw new Error('Pavel shader failed: '+key);
        shaders[key]={p,u:new Map()};
      }
      for (const [key, shader] of Object.entries(source)) {
        const p=api.program(VS,FS(shader));
        if(!p) throw new Error('Flow shader failed: '+key);
        shaders[key]={p,u: new Map()};
      }
    } catch(err) {
      Object.values(shaders).forEach(item=>gl.deleteProgram(item.p));
      throw err;
    }

    function target(width,height,internal,format,filter) {
      const tex=gl.createTexture(), fbo=gl.createFramebuffer();
      if(!tex||!fbo) {
        if(tex)gl.deleteTexture(tex);
        if(fbo)gl.deleteFramebuffer(fbo);
        throw new Error('Unable to allocate a Flow target.');
      }
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D,tex);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,filter);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,filter);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D,0,internal,width,height,0,format,gl.HALF_FLOAT,null);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,fbo);
      gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);
      if(gl.checkFramebufferStatus(gl.DRAW_FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE) {
        gl.deleteFramebuffer(fbo); gl.deleteTexture(tex);
        return null;
      }
      gl.clearBufferfv(gl.COLOR,0,new Float32Array(4));
      return {tex,fbo,w:width,h:height};
    }

    function free(state) {
      if (state) for(const t of state.owned){
        gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fbo);
      }
    }

    function use(key) {
      const shader=shaders[key];
      gl.useProgram(shader.p);
      return shader;
    }
    function at(shader,name) {
      if(!shader.u.has(name)) shader.u.set(name,gl.getUniformLocation(shader.p,name));
      return shader.u.get(name);
    }
    function one(shader,name,val){gl.uniform1f(at(shader,name),val);}
    function int(shader,name,val){gl.uniform1i(at(shader,name),val);}
    function rgb(shader,name,val){gl.uniform3f(at(shader,name),val[0],val[1],val[2]);}
    function xy(shader,name,val){gl.uniform2f(at(shader,name),val[0],val[1]);}
    function vec4(shader,name,val){gl.uniform4f(at(shader,name),val[0],val[1],val[2],val[3]);}
    function tex(shader,name,buf,unit) {
      gl.activeTexture(gl.TEXTURE0+unit);
      gl.bindTexture(gl.TEXTURE_2D,buf.tex);
      int(shader,name,unit);
    }
    function out(shader,to) {
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,to.fbo);
      gl.viewport(0,0,to.w,to.h);
      api.triangle(shader.p);
    }
    function flip(pair){ const old=pair.read;pair.read=pair.write;pair.write=old; }

    function resize(w,h,q,params,f) {
      const ratio=limit(w/h,.30,4.0);
      const dims=short=>ratio>1 ? [Math.min(texLimit,Math.round(short*ratio)),short] : [short,Math.min(texLimit,Math.round(short/ratio))];
      const [vw,vh]=dims(params[0]), [dw,dh]=dims(params[1]);
      if(fields && fields.vw===vw && fields.vh===vh && fields.dw===dw && fields.dh===dh) return;
      const old=fields, fresh={vw,vh,dw,dh,owned:[], fluidFormats:new Map(),
        rect:[Math.max(ratio,1),Math.max(1/ratio,1)], inv:[1/vw,1/vh], cells:Math.min(vw,vh),ratio,q};
      const make=(kind,which,filterable)=>{
        const [a,b]=which==='dye'?[dw,dh]:[vw,vh];
        const formats={rg:[gl.RG16F,gl.RG],r:[gl.R16F,gl.RED],rgba:[gl.RGBA16F,gl.RGBA]};
        let chosen=fresh.fluidFormats.get(kind)||kind;
        const alloc=()=>target(a,b,...formats[chosen],filterable&&linear?gl.LINEAR:gl.NEAREST);
        let t=alloc();
        if(!t && chosen!=='rgba'){chosen='rgba'; t=alloc();}
        if(!t) throw new Error('Flow has no complete half-float framebuffer.');
        fresh.owned.push(t);
        fresh.fluidFormats.set(kind,chosen);
        return t;
      };
      const pair=(kind,key,linear)=>({read:make(kind,key,linear),write:make(kind,key,linear)});
      try{
        fresh.vel=pair('rg','vel',true);
        fresh.dye=pair('rgba','dye',true);
        fresh.p=pair('r','vel',false);
        fresh.div=make('r','vel',false);
        fresh.curl=make('r','vel',false);

        if(old && old.ratio/fresh.ratio<1.40 && fresh.ratio/old.ratio<1.40) {
          const s=use('copy');
          tex(s,'uA',old.vel.read,0); one(s,'uMul',fresh.cells/old.cells); out(s,fresh.vel.read);
          tex(s,'uA',old.dye.read,0); one(s,'uMul',1); out(s,fresh.dye.read);
        }else {
          const s=use('seed');
          xy(s,'uRect',fresh.rect);one(s,'uCells',fresh.cells);one(s,'uMark',hue);
          vec4(s,'uArrival',[mark[0],mark[1],mark[2],0]);
          int(s,'uMode',0);out(s,fresh.vel.read);
          int(s,'uMode',1);out(s,fresh.dye.read);
          lastX=value(f.input?.x,.5);lastY=value(f.input?.y,.5);
        }
      }catch(err){free(fresh);throw err;}
      fields=fresh;
      free(old);
    }

    // Auto mode uses the same stroke injection as a pointer. It does not replace the solver.
    function trace(t,aspect){
      const phase=limit((t-2.3)/4.7,0,1);
      const a=3.88+3.84*phase;
      const safeAspect=Math.max(aspect,1.0);
      return [ .5+(.28*Math.cos(a)+.095*Math.sin(2*a))/Math.sqrt(safeAspect),
               .49+.27*Math.sin(a)*Math.min(1,aspect*1.25) ];
    }
    function strokeFor(f,dt,field) {
      const p=f.input||{};
      if(p.down) {
        const x=limit(value(p.x,.5),0,1), y=limit(value(p.y,.5),0,1);
        const last=[x-limit(value(p.dx,x-lastX),-.16,.16),y-limit(value(p.dy,y-lastY),-.16,.16)];
        lastX=x;lastY=y;
        const speed=(d,range)=>limit(d/Math.max(dt,.013)*range*field.cells,-1.55*field.cells,1.55*field.cells);
        return {xy:[x,y,...last],v:[speed(x-last[0],field.rect[0]),speed(y-last[1],field.rect[1])],
          power:.51+.56*limit(value(p.pressure,.58),0,1)};
      }
      if(f.auto && !f.reduced) {
        const t=value(f.age,modelClock);
        if(t>2.3 && t<7) {
          const now=trace(t,field.ratio), then=trace(t-dt,field.ratio);
          const env=Math.sin(Math.PI*limit((t-2.3)/4.7,0,1));
          return {xy:[...now,...then],v:now.map((v,i)=>(v-then[i])/Math.max(dt,.01)*field.rect[i]*field.cells*1.56),power:.48+.45*env};
        }
      }
      lastX=value(p.x,.5);lastY=value(p.y,.5);
      return {xy:[lastX,lastY,lastX,lastY],v:[0,0],power:0};
    }

    function splat(s, uv, velocityColor, pigment, radius) {
      // Pavel splat(), using the same shader twice; three channels are dye concentrations, not display RGB.
      const p=use('splat');
      const r=s.ratio>1?s.ratio*radius:radius;
      xy(p,'point',uv); one(p,'aspectRatio',s.ratio); one(p,'radius',r);
      tex(p,'uTarget',s.vel.read,0); rgb(p,'color',velocityColor); out(p,s.vel.write); flip(s.vel);
      if(pigment) {
        tex(p,'uTarget',s.dye.read,0); rgb(p,'color',pigment); out(p,s.dye.write); flip(s.dye);
      }
    }

    function step(f, dt, params) {
      const s=fields, stroke=strokeFor(f,dt,s);
      const air=limit(value(f.bands?.[0],0)+value(f.bands?.[1],0)*.35,0,1);

      let injections = 0;
      // The original solver order below is intentional. Only host input & artistic coefficients differ.
      if(stroke.power>0) {
        const [x,y,px,py]=stroke.xy,travel=Math.hypot(x-px,y-py);
        const n=travel>.035?2:1;
        const amount=stroke.power*dt*9/n;
        const mix=limit(hue+.24*Math.sin(modelClock*.75),0,1);
        const pigment=[(.59+.23*mix)*amount,(.53-.36*mix)*amount,(.12+.58*mix)*amount];
        const vel=[stroke.v[0]*stroke.power*.64/n,stroke.v[1]*stroke.power*.64/n,0];
        for(let i=1;i<=n;i++) splat(s,[px+(x-px)*i/n,py+(y-py)*i/n],vel,pigment,.0011+.0009*stroke.power);
        injections = n;
        serial++; if(f.memory && f.input?.down) f.memory.impulse=Math.min(1,(f.memory.impulse||0)+.003+Math.hypot(...stroke.v)*.0001);
      } else if(!f.reduced && steps%4===0 && modelClock>.45) {
        const clock=modelClock;
        const upright=s.ratio<1;
        const p1=upright?[.43+.11*Math.sin(clock*.43),.69]:[.30,.56+.10*Math.sin(clock*.54)];
        const p2=upright?[.63+.09*Math.cos(clock*.48),.36]:[.70,.42+.08*Math.cos(clock*.45)];
        const engine=2.2+4.6*air;
        splat(s,p1,[engine*(upright?-.86:1.6),engine,0],[.037,.056,.007],.0017);
        splat(s,p2,[engine*(upright?.86:-1.6),-engine,0],[.031,.009,.043],.0014);
        injections = 2;
      }

      let p=use('curl');
      xy(p,'texelSize',s.inv); tex(p,'uVelocity',s.vel.read,0); out(p,s.curl);

      p=use('vorticity');
      xy(p,'texelSize',s.inv); tex(p,'uVelocity',s.vel.read,0); tex(p,'uCurl',s.curl,1);
      one(p,'curl',21+6*air); one(p,'dt',dt); out(p,s.vel.write); flip(s.vel);

      p=use('divergence');
      xy(p,'texelSize',s.inv); tex(p,'uVelocity',s.vel.read,0); out(p,s.div);

      p=use('clear');
      tex(p,'uTexture',s.p.read,0); one(p,'value',.8); out(p,s.p.write); flip(s.p);

      p=use('pressure');
      xy(p,'texelSize',s.inv); tex(p,'uDivergence',s.div,0);
      for(let i=0;i<params[2];i++){
        tex(p,'uPressure',s.p.read,1); out(p,s.p.write); flip(s.p);
      }

      p=use('gradient');
      xy(p,'texelSize',s.inv); tex(p,'uPressure',s.p.read,0); tex(p,'uVelocity',s.vel.read,1);
      out(p,s.vel.write); flip(s.vel);

      p=use('advection');
      xy(p,'texelSize',s.inv);
      if(!linear) xy(p,'dyeTexelSize',s.inv);
      tex(p,'uVelocity',s.vel.read,0); int(p,'uSource',0);
      one(p,'dt',dt); one(p,'dissipation',.24); out(p,s.vel.write); flip(s.vel);

      if(!linear) xy(p,'dyeTexelSize',[1/s.dw,1/s.dh]);
      tex(p,'uVelocity',s.vel.read,0); tex(p,'uSource',s.dye.read,1);
      one(p,'dissipation',.22); out(p,s.dye.write); flip(s.dye);

      steps++;jacobi=params[2];lastPasses=jacobi+7+2*injections;modelClock+=dt;
    }
    function render(f) {
      if (failed || !f.width || !f.height) return false;
      const entering=gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING), view=gl.getParameter(gl.VIEWPORT);
      const was=caps.map(cap=>gl.isEnabled(cap));
      const q=limit(Math.floor(value(f.quality,1)),0,2), params=levels[q];
      const activeTexture=gl.getParameter(gl.ACTIVE_TEXTURE);
      for(let i=0;i<caps.length;i++) if(was[i])gl.disable(caps[i]);
      try{
        if(!generated) {
          const m=f.mark||{};
          mark=[limit(value(m.x,.5),0,1),limit(value(m.y,.5),0,1),limit(value(m.energy,0),0,1)];
          hue=limit(value(m.hue,.18),0,1);generated=true;
        }
        resize(f.width,f.height,q,params,f);
        const dt=limit(value(f.dt,1/60),0,1/27);
        // Throttle the weakest tier in hands-off mode; its display still follows the common frame timer.
        const divider=q===0&&!f.input?.down&&!f.auto&&!f.reduced?2:1;
        if((!f.reduced || f.input?.down) && dt && frames%divider===0) step(f,Math.min(1/21,dt*divider),params);
        const output=use('show');
        tex(output,'uA',fields.dye.read,0);tex(output,'uVel',fields.vel.read,1);tex(output,'uType',letters,2);one(output,'uAspect',fields.ratio);
        xy(output,'uRect',fields.rect);
        xy(output,'uPix',[1.35/fields.dw,1.35/fields.dh]);
        one(output,'uFrame',f.reduced?0:Math.floor(value(f.time,0)*12));
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,entering);
        gl.viewport(view[0],view[1],view[2],view[3]);
        api.triangle(output.p);
        frames++;
        return true;
      }catch(err){
        failed=true;
        free(fields);fields=null;
        console.warn('[Beyond / Flow]',err.message);
        return false;
      }finally{
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,entering);
        gl.viewport(view[0],view[1],view[2],view[3]);
        gl.activeTexture(activeTexture);
        for(let i=0;i<caps.length;i++) if(was[i])gl.enable(caps[i]);
      }
    }

    function dispose(){
      free(fields);fields=null;failed=true;gl.deleteTexture(letters.tex);
      Object.values(shaders).forEach(item=>gl.deleteProgram(item.p));
    }
    function stats(){
      return {
        particles:0,
        module:failed ? 'Flow: half-float unavailable' : 'Pavel FP16 · 压力投影 / 速度场折字',
        grid:fields ? `V ${fields.vw}×${fields.vh} · D ${fields.dw}×${fields.dh}` : '—',
        jacobiIterations:jacobi,
        passes:lastPasses,
        simulationSteps:steps,
        strokes:serial
      };
    }
    return {render,dispose,stats};
  }
  window.BeyondScenes=window.BeyondScenes||{};
  window.BeyondScenes.flow=flow;
})();
