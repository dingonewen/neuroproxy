import { Fragment, type ReactNode } from 'react';
import { unified } from 'unified';
import remarkParse from 'remark-parse';

type MarkdownNode={type:string;value?:string;url?:string;depth?:number;ordered?:boolean;start?:number|null;children?:MarkdownNode[]};
const parser=unified().use(remarkParse);
function safeHref(url:string|undefined):string|undefined {
 if(!url)return undefined;
 try {const parsed=new URL(url);return ['http:','https:','mailto:'].includes(parsed.protocol)?url:undefined;} catch{return undefined;}
}
function render(node:MarkdownNode,index:number):ReactNode {
 const children=node.children?.map(render);const key=index;
 switch(node.type){
  case 'root': return <Fragment key={key}>{children}</Fragment>;
  case 'text': return node.value;
  case 'paragraph': return <p key={key}>{children}</p>;
  case 'strong': return <strong key={key}>{children}</strong>;
  case 'emphasis': return <em key={key}>{children}</em>;
  case 'inlineCode': return <code key={key}>{node.value}</code>;
  case 'code': return <pre key={key}><code>{node.value}</code></pre>;
  case 'break': return <br key={key}/>;
  case 'heading': return <p className="markdown-heading" key={key}>{children}</p>;
  case 'list': return node.ordered?<ol key={key} start={node.start ?? undefined}>{children}</ol>:<ul key={key}>{children}</ul>;
  case 'listItem': return <li key={key}>{children}</li>;
  case 'blockquote': return <blockquote key={key}>{children}</blockquote>;
  case 'link': {const href=safeHref(node.url);return href?<a key={key} href={href} target="_blank" rel="noopener noreferrer">{children}</a>:<Fragment key={key}>{children}</Fragment>;}
  case 'thematicBreak': return <hr key={key}/>;
  // Raw HTML and unsupported nodes are rendered as inert text or children.
  default:return <Fragment key={key}>{node.value ?? children}</Fragment>;
 }
}
export function Markdown({text}:{text:string}) {return <>{render(parser.parse(text) as MarkdownNode,0)}</>;}
