import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import ReactFlow, { Background, Controls, MarkerType, useNodesState, useEdgesState, type Node, type Edge } from 'reactflow';
import 'reactflow/dist/style.css';
import Dagre from '@dagrejs/dagre';
import { tc } from './theme';
import './style.css';
import { ConversationInput } from './ConversationInput';

type GraphNode = { id:string; kind:string; label:string; status:string; source:string };
type GraphEdge = { id:string; source:string; target:string; label:string };
type Draft = { id:string; person:string; body:string; state:string };
type Graph = { nodes:GraphNode[]; edges:GraphEdge[]; drafts:Draft[] };
// Dagre centers nodes, while React Flow uses top-left positions.
function flow(graph:Graph): {nodes:Node[]; edges:Edge[]} {
  const layout = new Dagre.graphlib.Graph(); layout.setDefaultEdgeLabel(() => ({})); layout.setGraph({ rankdir:'TB', nodesep:40, ranksep:60, marginx:20, marginy:20 });
  for (const n of graph.nodes) layout.setNode(n.id, { width:200, height:80 });
  for (const e of graph.edges) layout.setEdge(e.source, e.target);
  Dagre.layout(layout); const palette = tc(false);
  return {nodes:graph.nodes.map(n => { const p = layout.node(n.id); return {id:n.id, position:{x:p.x-100,y:p.y-40}, data:{label:<><strong>{n.kind}</strong><br/>{n.label}<br/><small>{n.status} {n.source === 'simulated' ? '· simulated' : ''}</small></>}, style:{width:200, background:palette.base, color:palette.text, border:`1px solid ${palette.mauve}`, borderRadius:10}}; }), edges:graph.edges.map(e=>({...e, markerEnd:{type:MarkerType.ArrowClosed}}))};
}
function App() {
 const [graph,setGraph]=useState<Graph>({nodes:[],edges:[],drafts:[]}); const [topic,setTopic]=useState('Group project'); const [person,setPerson]=useState('Alex'); const [task,setTask]=useState('Confirm frontend deadline'); const [body,setBody]=useState('Hi Alex, are you planning to finish the frontend by Saturday?'); const [reply,setReply]=useState('Yes, I will finish on Saturday.'); const [error,setError]=useState(''); const [selected,setSelected]=useState<GraphNode|null>(null);
 const [question,setQuestion]=useState('What am I waiting for?'); const [answer,setAnswer]=useState('');
 const ask=async()=>{try{setError(''); const r=await fetch('/api/ask',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({question})}); const data=await r.json(); if(!r.ok) throw Error(data.error); setAnswer(data.answer);}catch(e){setError((e as Error).message);}};
 const refresh=async()=>{const r=await fetch('/api/graph'); if(!r.ok) throw Error('Could not load graph'); setGraph(await r.json());};
 useEffect(()=>{refresh().catch(e=>setError(e.message));},[]);
 const post=async(path:string,data:object={})=>{try {setError(''); const r=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)}); const result=await r.json(); if(!r.ok) throw Error(result.error); await refresh();} catch(e){setError((e as Error).message);}};
 const [nodes,setNodes,onNodesChange]=useNodesState([]); const [edges,setEdges,onEdgesChange]=useEdgesState([]);
 useEffect(()=>{const elements=flow(graph); setNodes(elements.nodes); setEdges(elements.edges);},[graph,setNodes,setEdges]);
 return <main><header><h1>NeuroProxy</h1><p>Your conversations, remembered. Your commitments, handled.</p><strong>Simulation mode: no real messages are sent.</strong></header><div className="columns"><div><ConversationInput onSaved={refresh}/><section><h2>Create a delegation</h2><p>Enter the details and review the message before approving the simulation.</p><form onSubmit={e=>{e.preventDefault();void post('/api/drafts',{topic,person,task,body});}}><label>Topic<input value={topic} onChange={e=>setTopic(e.target.value)} required /></label><label>Person<input value={person} onChange={e=>setPerson(e.target.value)} required /></label><label>Task<input value={task} onChange={e=>setTask(e.target.value)} required /></label><label>Message draft<textarea value={body} onChange={e=>setBody(e.target.value)} required /></label><button>Create draft</button></form>{error && <p role="alert">{error}</p>}<h2>Recover context</h2><label>Question<input value={question} onChange={e=>setQuestion(e.target.value)}/></label><button onClick={ask}>Ask NeuroProxy</button>{answer && <p>{answer}</p>}<h2>Delegations</h2>{graph.drafts.map(d=><article key={d.id}><b>{d.person}</b><p>{d.body}</p><p>Status: {d.state.replaceAll('_',' ')} · simulated</p>{d.state==='pending_approval' && <><button onClick={()=>post(`/api/drafts/${d.id}/approve-simulation`)}>Approve simulated send</button> <button onClick={()=>post(`/api/drafts/${d.id}/cancel`)}>Cancel</button></>}{d.state==='waiting_for_reply' && <><label>Simulated reply<input value={reply} onChange={e=>setReply(e.target.value)}/></label><button onClick={()=>post(`/api/drafts/${d.id}/simulate-reply`,{body:reply})}>Receive simulated reply</button></>}</article>)}</section></div><section className="graph"><h2>Cognitive Action Graph</h2><p>Select a node to recover its details. Drag, zoom, and pan to explore.</p><div className="canvas"><ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onNodeClick={(_,n)=>setSelected(graph.nodes.find(x=>x.id===n.id) ?? null)} fitView><Background/><Controls/></ReactFlow></div>{selected && <aside><b>{selected.kind}</b><p>{selected.label}</p><p>{selected.status.replaceAll('_',' ')} {selected.source==='simulated' && '· simulated'}</p></aside>}</section></div></main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
