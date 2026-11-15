import { useEffect, useMemo, useRef } from 'react';
import { buildPath, getAngle, getCurvePulseDuration, getDetailScale, getPoint, type LoaderCurveKey } from './vendor/boldkit/math-curves';

// Adapted from BoldKit's MathCurveLoader (MIT): see THIRD_PARTY_LICENSES/boldkit.txt.
export function EmptyCurve({curve,color,background=false}:{curve:LoaderCurveKey;color:string;background?:boolean}) {
 const svg=useRef<SVGSVGElement>(null);const path=useRef<SVGPathElement>(null);const head=useRef<SVGRectElement>(null);
 const track=useMemo(()=>buildPath(curve,1),[curve]);
 useEffect(()=>{
  let frame=0;let visible=true;const motion=window.matchMedia('(prefers-reduced-motion: reduce)');const start=performance.now();
  const draw=()=>{const now=performance.now();const duration=background?9000:5500;const progress=((now-start)%duration)/duration;const detail=getDetailScale(now,getCurvePulseDuration(curve));const point=getPoint(curve,progress,detail);path.current?.setAttribute('d',buildPath(curve,detail));head.current?.setAttribute('x',String(point.x-4));head.current?.setAttribute('y',String(point.y-4));head.current?.setAttribute('transform',`rotate(${getAngle(curve,progress,detail)} ${point.x} ${point.y})`);};
  const tick=()=>{draw();frame=requestAnimationFrame(tick);};
  const update=()=>{cancelAnimationFrame(frame);frame=0;if(!visible||document.hidden)return;draw();if(!motion.matches)frame=requestAnimationFrame(tick);};
  const observer=typeof IntersectionObserver==='undefined'?null:new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting ?? true;update();});
  if(svg.current)observer?.observe(svg.current);motion.addEventListener('change',update);document.addEventListener('visibilitychange',update);update();
  return()=>{observer?.disconnect();motion.removeEventListener('change',update);document.removeEventListener('visibilitychange',update);cancelAnimationFrame(frame);};
 },[curve,background]);
 return <svg ref={svg} className={background?'empty-curve empty-curve-background':'empty-curve'} viewBox="0 0 100 100" preserveAspectRatio={background?'xMidYMid slice':'xMidYMid meet'} opacity={background?0.2:1} aria-hidden="true" focusable="false"><path ref={path} d={track} fill="none" stroke={color} strokeOpacity={background?1:0.5} strokeWidth={background?2:4} strokeLinecap="square" strokeLinejoin="miter"/><rect ref={head} x="46" y="46" width="8" height="8" fill={color} stroke="hsl(var(--foreground))" strokeWidth="1.5"/></svg>;
}
