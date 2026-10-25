(()=>{
const canvas=document.querySelector('#portfolio-globe');if(!canvas)return;const ctx=canvas.getContext('2d');if(!ctx)return;
const container=canvas.parentElement;let width=500,height=510,time=0,last=0,frame=0,visible=true,targetX=0,targetY=0,tiltX=0,tiltY=0;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
// A textured sphere rendered on the GPU, composited below the orbit effects.
const surface=document.createElement('canvas');surface.width=720;surface.height=720;
const gpu=surface.getContext('webgl',{alpha:true,antialias:true,preserveDrawingBuffer:true,premultipliedAlpha:false});
let textureReady=false,sphereProgram=null,angleUniform,tiltUniform,modeUniform;
if(gpu){
const vertex='attribute vec2 position;varying vec2 point;void main(){point=position;gl_Position=vec4(position,0.0,1.0);}';
const fragment=`precision highp float;
varying vec2 point;uniform sampler2D earth;uniform float rotation;uniform float tilt;uniform float darkMode;
void main(){
vec2 p=point*1.035;float d=dot(p,p);if(d>1.0){gl_FragColor=vec4(0.0);return;}
vec3 n=vec3(p.x,-p.y,sqrt(1.0-d));float c=cos(tilt),s=sin(tilt);vec3 world=vec3(n.x,n.y*c+n.z*s,-n.y*s+n.z*c);
float longitude=atan(world.x,world.z)-rotation;float latitude=asin(clamp(-world.y,-1.0,1.0));
vec2 uv=vec2(fract(longitude/6.2831853+0.5),latitude/3.14159265+0.5);
vec3 tex=texture2D(earth,uv).rgb;
float land=smoothstep(-0.04,0.09,tex.r+tex.g*.3-tex.b*.83);
vec3 ocean=mix(vec3(0.012,0.15,0.24),vec3(0.035,0.36,0.44),dot(tex,vec3(.3,.5,.2)));
vec3 ground=mix(vec3(.30,.58,.57),vec3(.85,.94,.86),dot(tex,vec3(.3,.5,.2)));
vec3 col=mix(ocean,ground,land);
vec3 goldGround=mix(vec3(.25,.23,.14),vec3(.94,.78,.42),dot(tex,vec3(.3,.5,.2)));
col=mix(col,mix(ocean*.55,goldGround,land),darkMode);
float diffuse=.34+.76*max(dot(normalize(vec3(-.6,-.5,1.0)),n),0.0);col*=diffuse;
float rim=pow(1.0-n.z,3.0);col+=rim*mix(vec3(.08,.58,.65),vec3(.75,.57,.22),darkMode)*.72;
float shine=pow(max(dot(reflect(normalize(vec3(.6,.5,-1.0)),n),vec3(0.0,0.0,1.0)),0.0),42.0);col+=vec3(.7,.95,1.0)*shine*.38;
float gridLon=abs(sin(longitude*12.0));float gridLat=abs(sin(latitude*10.0));float grid=max(1.0-smoothstep(.0,.025,gridLon),1.0-smoothstep(.0,.025,gridLat));col+=grid*mix(vec3(.13,.43,.48),vec3(.35,.27,.11),darkMode)*.3;
gl_FragColor=vec4(col,smoothstep(1.0,.986,d));}`;
function shader(type,source){const sh=gpu.createShader(type);gpu.shaderSource(sh,source);gpu.compileShader(sh);if(!gpu.getShaderParameter(sh,gpu.COMPILE_STATUS))return null;return sh;}
const vs=shader(gpu.VERTEX_SHADER,vertex),fs=shader(gpu.FRAGMENT_SHADER,fragment);
if(vs&&fs){sphereProgram=gpu.createProgram();gpu.attachShader(sphereProgram,vs);gpu.attachShader(sphereProgram,fs);gpu.linkProgram(sphereProgram);if(gpu.getProgramParameter(sphereProgram,gpu.LINK_STATUS)){gpu.useProgram(sphereProgram);const b=gpu.createBuffer();gpu.bindBuffer(gpu.ARRAY_BUFFER,b);gpu.bufferData(gpu.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gpu.STATIC_DRAW);const loc=gpu.getAttribLocation(sphereProgram,'position');gpu.enableVertexAttribArray(loc);gpu.vertexAttribPointer(loc,2,gpu.FLOAT,false,0,0);angleUniform=gpu.getUniformLocation(sphereProgram,'rotation');tiltUniform=gpu.getUniformLocation(sphereProgram,'tilt');modeUniform=gpu.getUniformLocation(sphereProgram,'darkMode');
const image=new Image();image.onload=()=>{gpu.useProgram(sphereProgram);const texture=gpu.createTexture();gpu.activeTexture(gpu.TEXTURE0);gpu.bindTexture(gpu.TEXTURE_2D,texture);gpu.pixelStorei(gpu.UNPACK_FLIP_Y_WEBGL,true);gpu.texImage2D(gpu.TEXTURE_2D,0,gpu.RGB,gpu.RGB,gpu.UNSIGNED_BYTE,image);gpu.texParameteri(gpu.TEXTURE_2D,gpu.TEXTURE_MIN_FILTER,gpu.LINEAR);gpu.texParameteri(gpu.TEXTURE_2D,gpu.TEXTURE_MAG_FILTER,gpu.LINEAR);gpu.texParameteri(gpu.TEXTURE_2D,gpu.TEXTURE_WRAP_S,gpu.REPEAT);gpu.texParameteri(gpu.TEXTURE_2D,gpu.TEXTURE_WRAP_T,gpu.CLAMP_TO_EDGE);gpu.uniform1i(gpu.getUniformLocation(sphereProgram,'earth'),0);textureReady=true;};image.src='assets/earth-texture.jpg';}}
}

const cpuSurface=document.createElement('canvas');const cpuSize=360;cpuSurface.width=cpuSize;cpuSurface.height=cpuSize;const cpuContext=cpuSurface.getContext('2d');let mapPixels=null,mapWidth=0,mapHeight=0,cpuFrame=null,cpuLookup=null,lastRasterTime=-1,lastRasterDark=null;
const cpuImage=new Image();cpuImage.onload=()=>{const map=document.createElement('canvas');map.width=1024;map.height=512;const c=map.getContext('2d');c.drawImage(cpuImage,0,0,1024,512);mapPixels=c.getImageData(0,0,1024,512).data;mapWidth=1024;mapHeight=512;cpuFrame=cpuContext.createImageData(cpuSize,cpuSize);cpuLookup=[];for(let y=0;y<cpuSize;y++)for(let x=0;x<cpuSize;x++){const nx=(x+.5)/cpuSize*2.07-1.035,ny=(y+.5)/cpuSize*2.07-1.035,d=nx*nx+ny*ny;if(d>=1)continue;const nz=Math.sqrt(1-d),t=-.13,wy=ny*Math.cos(t)+nz*Math.sin(t),wz=-ny*Math.sin(t)+nz*Math.cos(t);const lon=Math.atan2(nx,wz)/(Math.PI*2)+.5,lat=Math.asin(-wy)/Math.PI+.5;const shade=.38+.72*Math.max(0,(-.45*nx-.35*ny+.82*nz));const rim=Math.pow(1-nz,3)*.6;cpuLookup.push([(y*cpuSize+x)*4,lon,Math.min(511,Math.max(0,Math.floor((1-lat)*512)))*1024,shade,rim,nz]);}};cpuImage.src='assets/earth-texture.jpg';
function drawCpu(rotation,dark){if(!mapPixels||!cpuLookup)return false;if(Math.abs(time-lastRasterTime)<.04&&dark===lastRasterDark)return true;lastRasterTime=time;lastRasterDark=dark;const data=cpuFrame.data,offset=rotation/(Math.PI*2);for(const [i,lon,row,shade,rim,nz] of cpuLookup){const u=((lon-offset)%1+1)%1,idx=(row+Math.floor(u*mapWidth))*4;const tr=mapPixels[idx]/255,tg=mapPixels[idx+1]/255,tb=mapPixels[idx+2]/255;const land=Math.max(0,Math.min(1,(tr+tg*.3-tb*.83+.02)/.11));const lum=tr*.3+tg*.5+tb*.2;let r,g,b;if(dark){r=(.012+(0.25+.65*lum)*land)*shade+rim*.65;g=(.085+(0.23+.49*lum)*land)*shade+rim*.48;b=(.12+(0.14+.18*lum)*land)*shade+rim*.17;}else{r=(.015+(.24+.4*lum)*land)*shade+rim*.1;g=(.19+(.3+.4*lum)*land)*shade+rim*.55;b=(.28+(.24+.36*lum)*land)*shade+rim*.62;}data[i]=Math.min(255,r*255);data[i+1]=Math.min(255,g*255);data[i+2]=Math.min(255,b*255);data[i+3]=Math.min(255,nz*1800);}cpuContext.putImageData(cpuFrame,0,0);return true;}
let activeSurface=surface;
function drawSurface(rotation,tilt,dark){if(textureReady&&sphereProgram){gpu.viewport(0,0,720,720);gpu.clearColor(0,0,0,0);gpu.clear(gpu.COLOR_BUFFER_BIT);gpu.useProgram(sphereProgram);gpu.uniform1f(angleUniform,rotation);gpu.uniform1f(tiltUniform,tilt);gpu.uniform1f(modeUniform,dark?1:0);gpu.drawArrays(gpu.TRIANGLES,0,6);activeSurface=surface;return true;}activeSurface=cpuSurface;return drawCpu(rotation,dark);}

const rad=Math.PI/180;
// Simplified decorative continental silhouettes in longitude / latitude.
const lands=[[[ -168,71],[-141,70],[-123,58],[-110,55],[-96,63],[-82,56],[-61,52],[-53,47],[-65,43],[-78,33],[-81,25],[-88,29],[-97,22],[-103,18],[-110,24],[-117,33],[-125,45],[-136,56],[-155,60]], [[-97,22],[-87,21],[-82,11],[-77,8],[-84,8],[-91,16]], [[-81,12],[-69,11],[-61,6],[-49,0],[-35,-7],[-41,-22],[-50,-28],[-55,-40],[-68,-55],[-74,-48],[-73,-32],[-78,-13],[-81,0]], [[-54,60],[-43,59],[-22,72],[-23,82],[-44,83],[-63,75]], [[-17,36],[0,37],[12,33],[31,31],[35,23],[44,11],[51,11],[43,-4],[39,-18],[28,-34],[18,-35],[11,-18],[8,1],[-5,5],[-17,17]], [[-10,36],[-7,44],[-10,51],[0,58],[11,55],[21,60],[30,70],[61,73],[90,77],[120,73],[151,60],[177,62],[166,51],[143,46],[138,36],[123,29],[121,19],[109,12],[100,3],[98,20],[89,22],[80,8],[73,13],[67,25],[53,26],[46,13],[35,14],[33,30],[24,36],[13,45],[4,43]], [[112,-11],[128,-12],[137,-11],[153,-24],[150,-38],[134,-35],[115,-35]], [[47,-13],[51,-17],[48,-26],[44,-24]], [[130,31],[141,46],[145,43],[137,32]], [[166,-34],[178,-38],[172,-46],[166,-45]], [[-8,50],[-6,58],[0,59],[2,51]]];
function inside(x,y,poly){let result=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])result=!result;}return result;}
function vector(lon,lat){const a=lon*rad,b=lat*rad;return [Math.cos(b)*Math.sin(a),-Math.sin(b),Math.cos(b)*Math.cos(a)];}
const dots=[];for(let lat=-56;lat<82;lat+=3)for(let lon=-177;lon<180;lon+=3/Math.max(.3,Math.cos(lat*rad)))if(lands.some(p=>inside(lon,lat,p)))dots.push(vector(lon,lat));
const cities=[[74,31],[0,51],[-74,41],[139,36],[103,1],[55,25],[-46,-23],[151,-34]].map(c=>vector(...c));const connections=[[0,1],[0,3],[0,4],[1,2],[1,5],[2,6],[3,7],[4,7]];
function rotate(v,angle){const a=Math.cos(angle),b=Math.sin(angle);let x=v[0]*a+v[2]*b,z=-v[0]*b+v[2]*a,y=v[1];const t=-.13+tiltY,c=Math.cos(t),s=Math.sin(t);return [x,y*c-z*s,y*s+z*c];}
function draw(){const light=document.documentElement.dataset.theme==='light';const accent=light?'27,154,151':'224,186,93';const pale=light?'161,242,227':'255,232,173';const angle=-.5+time*.105+tiltX;const r=Math.min(width*.355,height*.355),cx=width*.5,cy=height*.44;
ctx.clearRect(0,0,width,height);const rgba=(c,a)=>`rgba(${c},${a})`;
const project=v=>{const q=rotate(v,angle);return {x:cx+q[0]*r,y:cy+q[1]*r,z:q[2]}};
// Grounded ripple platform.
const platformY=cy+r*1.27;
ctx.save();ctx.translate(cx,platformY);ctx.scale(1,.22);for(let i=0;i<4;i++){const phase=(time*.23+i/4)%1;ctx.beginPath();ctx.ellipse(0,0,r*(.45+phase*.95),r*(.45+phase*.95),0,0,Math.PI*2);ctx.strokeStyle=rgba(accent,(1-phase)*.28);ctx.lineWidth=1;ctx.stroke();}const ground=ctx.createRadialGradient(0,0,0,0,0,r*1.45);ground.addColorStop(0,rgba(accent,.16));ground.addColorStop(1,rgba(accent,0));ctx.fillStyle=ground;ctx.fillRect(-r*1.5,-r*1.5,r*3,r*3);ctx.restore();
const globeFill=ctx.createRadialGradient(cx-r*.4,cy-r*.45,0,cx,cy,r);globeFill.addColorStop(0,light?'#57ada9':'#6d633d');globeFill.addColorStop(.42,light?'#167b7e':'#292f29');globeFill.addColorStop(.82,light?'#083b4d':'#101d22');globeFill.addColorStop(1,light?'#092e3a':'#060e13');
// Back portions of satellite orbits.
function orbit(k,a){const v=[Math.cos(a)*1.24,Math.sin(a)*.38,Math.sin(a)*1.17];const tilt=k===0?.45:-.65;const x=v[0]*Math.cos(tilt)-v[1]*Math.sin(tilt),y=v[0]*Math.sin(tilt)+v[1]*Math.cos(tilt);return {x:cx+x*r,y:cy+y*r,z:v[2]};}
function orbitLine(k,front){ctx.beginPath();let started=false;for(let i=0;i<=160;i++){const q=orbit(k,i/160*Math.PI*2);if((q.z>=0)!==front){started=false;continue;}if(!started){ctx.moveTo(q.x,q.y);started=true;}else ctx.lineTo(q.x,q.y);}ctx.strokeStyle=front?rgba(light?'140,197,190':'222,193,118',.85):rgba(accent,.19);ctx.lineWidth=front?1.7:1;ctx.stroke();}
orbitLine(0,false);orbitLine(1,false);
ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fillStyle=globeFill;ctx.shadowColor=rgba(accent,.2);ctx.shadowBlur=26;ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle=rgba(pale,.7);ctx.lineWidth=1;ctx.stroke();
// Graticule on the visible hemisphere.
ctx.save();ctx.beginPath();ctx.arc(cx,cy,r-.5,0,Math.PI*2);ctx.clip();
function gridLine(points){ctx.beginPath();let started=false;for(const v of points){const q=project(v);if(q.z<0){started=false;continue;}if(!started){ctx.moveTo(q.x,q.y);started=true;}else ctx.lineTo(q.x,q.y);}ctx.strokeStyle=rgba(pale,.14);ctx.lineWidth=.65;ctx.stroke();}
for(let lat=-60;lat<=60;lat+=20){const a=[];for(let lon=-180;lon<=180;lon+=3)a.push(vector(lon,lat));gridLine(a);}for(let lon=-180;lon<180;lon+=25){const a=[];for(let lat=-90;lat<=90;lat+=3)a.push(vector(lon,lat));gridLine(a);}
if(drawSurface(angle,-.13+tiltY,!light)){ctx.drawImage(activeSurface,cx-r*1.035,cy-r*1.035,r*2.07,r*2.07);}else{for(const v of dots){const p=project(v);if(p.z<=0)continue;ctx.beginPath();ctx.arc(p.x,p.y,1.1,0,Math.PI*2);ctx.fillStyle=rgba(pale,.35+p.z*.5);ctx.fill();}}
for(const [a,b] of connections){const v1=cities[a],v2=cities[b];const route=[];for(let i=0;i<=45;i++){const f=i/45;let v=v1.map((x,j)=>x*(1-f)+v2[j]*f),len=Math.hypot(...v),lift=1+.12*Math.sin(f*Math.PI);v=v.map(x=>x/len*lift);route.push(project(v));}ctx.beginPath();let started=false;for(const p of route){if(p.z<0){started=false;continue;}if(!started){ctx.moveTo(p.x,p.y);started=true;}else ctx.lineTo(p.x,p.y);}ctx.strokeStyle=rgba(pale,.75);ctx.lineWidth=1.1;ctx.stroke();const p=route[Math.floor((time*.2+a*.17)%1*45)];if(p.z>0){ctx.beginPath();ctx.arc(p.x,p.y,2.2,0,Math.PI*2);ctx.fillStyle='#eafff4';ctx.shadowColor=rgba(pale,1);ctx.shadowBlur=10;ctx.fill();ctx.shadowBlur=0;}}
for(const c of cities){const p=project(c);if(p.z<0)continue;ctx.beginPath();ctx.arc(p.x,p.y,2.6,0,Math.PI*2);ctx.fillStyle=rgba(pale,1);ctx.shadowColor=rgba(pale,1);ctx.shadowBlur=12;ctx.fill();ctx.shadowBlur=0;const pulse=(time*.45+c[0])%1;ctx.beginPath();ctx.arc(p.x,p.y,3+Math.abs(pulse)*8,0,Math.PI*2);ctx.strokeStyle=rgba(pale,(1-Math.abs(pulse))*.4);ctx.lineWidth=.7;ctx.stroke();}
const shine=ctx.createRadialGradient(cx-r*.4,cy-r*.5,0,cx-r*.25,cy-r*.3,r*.8);shine.addColorStop(0,'#ffffff30');shine.addColorStop(1,'#ffffff00');ctx.fillStyle=shine;ctx.fillRect(cx-r,cy-r,2*r,2*r);ctx.restore();
orbitLine(0,true);orbitLine(1,true);
// Two tiny satellites, each following its own orbit.
for(let k=0;k<2;k++){const p=orbit(k,time*(k===0?.32:-.23)+k*2.4);if(p.z<0&&Math.hypot((p.x-cx)/r,(p.y-cy)/r)<1)continue;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(k===0?-.45:.6);const scale=.7+(p.z+1.2)*.18;ctx.scale(scale,scale);ctx.fillStyle=light?'#287a8b':'#b0904c';ctx.strokeStyle=light?'#a6e6df':'#ffe5a0';ctx.lineWidth=.8;ctx.fillRect(-19,-5,12,10);ctx.strokeRect(-19,-5,12,10);ctx.fillRect(7,-5,12,10);ctx.strokeRect(7,-5,12,10);ctx.beginPath();ctx.moveTo(-15,-5);ctx.lineTo(-15,5);ctx.moveTo(-11,-5);ctx.lineTo(-11,5);ctx.moveTo(11,-5);ctx.lineTo(11,5);ctx.moveTo(15,-5);ctx.lineTo(15,5);ctx.moveTo(-19,0);ctx.lineTo(19,0);ctx.stroke();const metal=ctx.createLinearGradient(-5,-6,6,7);metal.addColorStop(0,'#ecf5f2');metal.addColorStop(.5,light?'#9cbec4':'#d9bc72');metal.addColorStop(1,'#315260');ctx.fillStyle=metal;ctx.fillRect(-5,-7,10,14);ctx.strokeRect(-5,-7,10,14);ctx.beginPath();ctx.moveTo(0,-7);ctx.lineTo(0,-13);ctx.stroke();ctx.restore();}
}
function resize(){const bounds=canvas.getBoundingClientRect();width=bounds.width;height=bounds.height;const ratio=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);draw();}
function tick(now){frame=requestAnimationFrame(tick);if(!visible||document.hidden){last=now;return;}const freeze=reduced.matches||document.body.classList.contains('motion-paused');if(!freeze){time+=last?Math.min((now-last)/1000,.05):0;tiltX+=(targetX-tiltX)*.04;tiltY+=(targetY-tiltY)*.04;}last=now;draw();}
container.addEventListener('pointermove',e=>{if(e.pointerType==='touch')return;const b=container.getBoundingClientRect();targetX=((e.clientX-b.left)/b.width-.5)*.35;targetY=((e.clientY-b.top)/b.height-.5)*.18;});container.addEventListener('pointerleave',()=>{targetX=0;targetY=0;});new ResizeObserver(resize).observe(canvas);new IntersectionObserver(e=>{visible=e[0].isIntersecting;},{threshold:.02}).observe(container);resize();frame=requestAnimationFrame(tick);
})();
