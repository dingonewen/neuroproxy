/** Wrap text without losing words or Unicode characters. */
export function wrapGraphText(text:string,maxWidth:number,measure:(value:string)=>number):string[] {
 if(!text)return [];
 const lines:string[]=[];let line='';
 for(const word of text.split(/\s+/u)){
  const candidate=line ? `${line} ${word}` : word;
  if(measure(candidate)<=maxWidth){line=candidate;continue;}
  if(line){lines.push(line);line='';}
  for(const char of word){if(line && measure(line+char)>maxWidth){lines.push(line);line='';}line+=char;}
 }
 if(line)lines.push(line);return lines;
}

/** Draw the graph directly instead of relying on browser HTML snapshots. */
export async function graphExportImage(element:HTMLElement):Promise<string> {
 const bounds=element.getBoundingClientRect();
 if(!bounds.width || !bounds.height)throw new Error('Graph canvas is not ready.');
 const pixelRatio=2;
 const output=document.createElement('canvas');
 output.width=Math.round(bounds.width*pixelRatio);output.height=Math.round(bounds.height*pixelRatio);
 const ctx=output.getContext('2d');if(!ctx)throw new Error('Could not create a canvas.');
 ctx.fillStyle=getComputedStyle(element).backgroundColor;ctx.fillRect(0,0,output.width,output.height);

 // Paths use screen matrices so the result matches the currently fitted React Flow viewport.
 for(const path of element.querySelectorAll<SVGPathElement>('.react-flow__edge-path')){
  const d=path.getAttribute('d'),matrix=path.getScreenCTM();if(!d || !matrix)continue;
  ctx.save();ctx.setTransform(pixelRatio*matrix.a,pixelRatio*matrix.b,pixelRatio*matrix.c,pixelRatio*matrix.d,pixelRatio*(matrix.e-bounds.left),pixelRatio*(matrix.f-bounds.top));
  ctx.strokeStyle='#20191d';ctx.fillStyle='#20191d';ctx.lineWidth=1.5;ctx.stroke(new Path2D(d));
  const length=path.getTotalLength();if(length>0){const end=path.getPointAtLength(length),before=path.getPointAtLength(Math.max(0,length-2));const angle=Math.atan2(end.y-before.y,end.x-before.x);const size=8;
   ctx.beginPath();ctx.moveTo(end.x,end.y);ctx.lineTo(end.x-size*Math.cos(angle-.45),end.y-size*Math.sin(angle-.45));ctx.lineTo(end.x-size*Math.cos(angle+.45),end.y-size*Math.sin(angle+.45));ctx.closePath();ctx.fill();}
  ctx.restore();
 }
 // SVG text backgrounds sometimes become opaque black in foreignObject snapshots.
 // Draw each label on a known light background in screen coordinates instead.
 ctx.setTransform(pixelRatio,0,0,pixelRatio,0,0);
 for(const text of element.querySelectorAll<SVGTextElement>('.react-flow__edge-text')){
  const content=text.textContent?.trim();if(!content)continue;const rect=text.getBoundingClientRect();if(!rect.width || !rect.height)continue;
  const x=rect.left-bounds.left,y=rect.top-bounds.top;ctx.fillStyle='#fff';ctx.fillRect(x-3,y-2,rect.width+6,rect.height+4);
  ctx.fillStyle='#20191d';ctx.font=`${Math.max(5,rect.height*.85)}px Inter, sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(content,x+rect.width/2,y+rect.height/2);
 }
 // Paint nodes directly; browser foreignObject snapshots can drop offscreen HTML nodes.
 ctx.textAlign='left';ctx.textBaseline='top';
 for(const node of element.querySelectorAll<HTMLElement>('.react-flow__node')){
  const rect=node.getBoundingClientRect();if(!rect.width || !rect.height || !node.offsetWidth)continue;
  const scale=rect.width/node.offsetWidth,x=rect.left-bounds.left,y=rect.top-bounds.top,padding=8*scale;
  const style=getComputedStyle(node);ctx.fillStyle='#20191d';ctx.fillRect(x+4*scale,y+4*scale,rect.width,rect.height);
  ctx.fillStyle=style.backgroundColor;ctx.fillRect(x,y,rect.width,rect.height);
  ctx.strokeStyle='#20191d';ctx.lineWidth=Math.max(.5,2*scale);ctx.strokeRect(x,y,rect.width,rect.height);
  const title=node.querySelector('strong')?.textContent?.trim() ?? '';
  const status=node.querySelector('small')?.textContent?.trim() ?? '';
  let body=node.textContent?.trim() ?? '';if(title && body.startsWith(title))body=body.slice(title.length).trim();if(status && body.endsWith(status))body=body.slice(0,-status.length).trim();
  const maxWidth=Math.max(1,rect.width-2*padding),titleSize=12*scale,statusSize=8*scale;
  let bodySize=12*scale,lines:string[]=[];
  const available=Math.max(0,rect.height-2*padding-(title?titleSize*1.35:0)-(status?statusSize*1.4:0));
  do{ctx.font=`400 ${bodySize}px Inter, sans-serif`;lines=wrapGraphText(body,maxWidth,value=>ctx.measureText(value).width);if(lines.length*bodySize*1.3<=available || bodySize<=4*scale)break;bodySize*=.9;}while(true);
  ctx.save();ctx.beginPath();ctx.rect(x,y,rect.width,rect.height);ctx.clip();ctx.fillStyle='#20191d';let textY=y+padding;
  if(title){ctx.font=`700 ${titleSize}px Inter, sans-serif`;ctx.fillText(title,x+padding,textY,maxWidth);textY+=titleSize*1.35;}
  ctx.font=`400 ${bodySize}px Inter, sans-serif`;for(const line of lines){ctx.fillText(line,x+padding,textY,maxWidth);textY+=bodySize*1.3;}
  if(status){ctx.font=`400 ${statusSize}px Inter, sans-serif`;ctx.fillStyle='#655b66';ctx.fillText(status,x+padding,Math.min(textY,y+rect.height-padding-statusSize),maxWidth);}
  ctx.restore();
 }
 return output.toDataURL('image/png');
}

export function fullGraphLayout(bounds:{x:number;y:number;width:number;height:number}) {
 const padding=80,rawWidth=Math.max(1,bounds.width)+2*padding,rawHeight=Math.max(1,bounds.height)+2*padding;
 // Bound bitmap memory without cropping any nodes, even for large graphs.
 const scale=Math.min(1,4000/rawWidth,4000/rawHeight,Math.sqrt(4_000_000/(rawWidth*rawHeight)));
 return {width:Math.ceil(rawWidth*scale),height:Math.ceil(rawHeight*scale),scale,x:(padding-bounds.x)*scale,y:(padding-bounds.y)*scale};
}

/** Render an offscreen copy fitted to all graph bounds without changing the live viewport. */
export async function fullGraphExportImage(element:HTMLElement,bounds:{x:number;y:number;width:number;height:number}) {
 const layout=fullGraphLayout(bounds),clone=element.cloneNode(true) as HTMLElement;
 const viewport=clone.querySelector<HTMLElement>('.react-flow__viewport');
 if(!viewport)throw new Error('Graph viewport is not ready.');
 Object.assign(clone.style,{position:'fixed',left:'-100000px',top:'0',width:`${layout.width}px`,height:`${layout.height}px`,minHeight:'0',maxWidth:'none',margin:'0',zIndex:'-1',pointerEvents:'none'});
 clone.setAttribute('aria-hidden','true');viewport.style.transform=`translate(${layout.x}px, ${layout.y}px) scale(${layout.scale})`;
 document.body.appendChild(clone);
 try{return {data:await graphExportImage(clone),width:layout.width,height:layout.height};}
 finally{clone.remove();}
}
