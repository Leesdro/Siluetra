// SVG path geometry parser; original Siluetra implementation. Arcs become cubic segments.
const tokenRE=/[a-zA-Z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;
export function parseSvgPath(data){
 const source=String(data||''),tokens=source.match(tokenRE)||[];if(source.replace(tokenRE,'').replace(/[\s,]/g,''))throw Error('Datos SVG inválidos.');if(tokens.length>200000)throw Error('El trazado supera el límite de puntos.');
 let i=0,cmd='',lastCmd='',current={x:0,y:0},start={x:0,y:0},sp=null,quadratic=null,cubicControl=null;const paths=[];
 const number=()=>{if(i>=tokens.length||/^[a-z]$/i.test(tokens[i]))throw Error('Trazado SVG incompleto.');const v=Number(tokens[i++]);if(!Number.isFinite(v))throw Error('Coordenada SVG inválida.');return v;};
 const anchor=p=>{sp.nodes.push(p);current={x:p.x,y:p.y};};
 const curve=(c,d,p)=>{sp.nodes.at(-1).out=c;anchor({...p,in:d});cubicControl=d;};
 while(i<tokens.length){if(/^[a-z]$/i.test(tokens[i]))cmd=tokens[i++];if(!cmd)throw Error('Comando SVG ausente.');const upper=cmd.toUpperCase(),relative=cmd!==upper,origin={...current},point=()=>{const x=number(),y=number();return {x:x+(relative?origin.x:0),y:y+(relative?origin.y:0)};};if(upper!=='M'&&!sp)throw Error('El trazado debe comenzar con M.');
  if(upper==='M'){const p=point();sp={nodes:[],closed:false};paths.push(sp);anchor(p);start={...current};cmd=relative?'l':'L';}
  else if(upper==='L')anchor(point());
  else if(upper==='H')anchor({x:number()+(relative?origin.x:0),y:origin.y});
  else if(upper==='V')anchor({x:origin.x,y:number()+(relative?origin.y:0)});
  else if(upper==='C'){const c=point(),d=point(),p=point();curve(c,d,p);}
  else if(upper==='S'){const c=/^[CS]$/.test(lastCmd)&&cubicControl?{x:2*origin.x-cubicControl.x,y:2*origin.y-cubicControl.y}:origin,d=point(),p=point();curve(c,d,p);}
  else if(upper==='Q'||upper==='T'){const q=upper==='Q'?point():/^[QT]$/.test(lastCmd)&&quadratic?{x:2*origin.x-quadratic.x,y:2*origin.y-quadratic.y}:origin,p=point();curve({x:origin.x+(q.x-origin.x)*2/3,y:origin.y+(q.y-origin.y)*2/3},{x:p.x+(q.x-p.x)*2/3,y:p.y+(q.y-p.y)*2/3},p);quadratic=q;}
  else if(upper==='A'){const rx=number(),ry=number(),angle=number(),large=number(),sweep=number(),p=point();if(![0,1].includes(large)||![0,1].includes(sweep))throw Error('Indicador de arco SVG inválido.');for(const [c,d,q] of arcCubics(origin,p,rx,ry,angle,large,sweep))curve(c,d,q);if(!rx||!ry)anchor(p);}
  else if(upper==='Z'){sp.closed=true;current={...start};const n=sp.nodes;if(n.length>1&&Math.hypot(n[0].x-n.at(-1).x,n[0].y-n.at(-1).y)<1e-9){if(n.at(-1).in)n[0].in=n.at(-1).in;n.pop();}cmd='';}
  else throw Error('Comando SVG no admitido: '+cmd);
  if(!['Q','T'].includes(upper))quadratic=null;if(!['C','S'].includes(upper))cubicControl=null;lastCmd=upper;
 }
 return {...(paths[0]||{nodes:[],closed:false}),...(paths.length>1?{subpaths:paths.slice(1)}:{})};
}
function arcCubics(a,b,rx,ry,degrees,large,sweep){rx=Math.abs(rx);ry=Math.abs(ry);if(!rx||!ry||a.x===b.x&&a.y===b.y)return [];const phi=degrees*Math.PI/180,c=Math.cos(phi),s=Math.sin(phi),dx=(a.x-b.x)/2,dy=(a.y-b.y)/2,x=c*dx+s*dy,y=-s*dx+c*dy,lambda=x*x/(rx*rx)+y*y/(ry*ry);if(lambda>1){rx*=Math.sqrt(lambda);ry*=Math.sqrt(lambda);}const factor=(large===sweep?-1:1)*Math.sqrt(Math.max(0,(rx*rx*ry*ry-rx*rx*y*y-ry*ry*x*x)/(rx*rx*y*y+ry*ry*x*x))),cx=factor*rx*y/ry,cy=-factor*ry*x/rx,C={x:c*cx-s*cy+(a.x+b.x)/2,y:s*cx+c*cy+(a.y+b.y)/2},u={x:(x-cx)/rx,y:(y-cy)/ry},v={x:(-x-cx)/rx,y:(-y-cy)/ry};let angle=Math.atan2(u.y,u.x),delta=Math.atan2(u.x*v.y-u.y*v.x,u.x*v.x+u.y*v.y);if(!sweep&&delta>0)delta-=2*Math.PI;if(sweep&&delta<0)delta+=2*Math.PI;const count=Math.ceil(Math.abs(delta)/(Math.PI/2)),step=delta/count,result=[],map=(x,y)=>({x:C.x+c*rx*x-s*ry*y,y:C.y+s*rx*x+c*ry*y});for(let j=0;j<count;j++){const t=angle+j*step,q=t+step,k=4/3*Math.tan(step/4);result.push([map(Math.cos(t)-k*Math.sin(t),Math.sin(t)+k*Math.cos(t)),map(Math.cos(q)+k*Math.sin(q),Math.sin(q)-k*Math.cos(q)),j===count-1?b:map(Math.cos(q),Math.sin(q))]);}return result;}
