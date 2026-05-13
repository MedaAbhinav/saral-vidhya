import { useCallback, useRef, useState } from 'react';

interface Props { content: string }

// ─── Mermaid lazy-load (try first; fall back to custom renderer) ──────────────
let mermaidReady = false;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mermaidLib: any = null;
async function getMermaid() {
  if (mermaidLib) return mermaidLib;
  try {
    const mod = await import('mermaid');
    mermaidLib = mod.default ?? mod;
    if (!mermaidReady) {
      mermaidLib.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose', logLevel: 5 });
      mermaidReady = true;
    }
    return mermaidLib;
  } catch { return null; }
}
void getMermaid(); // pre-warm

// ─── Text helpers ─────────────────────────────────────────────────────────────
function stripFences(raw: string) {
  return raw.replace(/^```mermaid\s*/i,'').replace(/^```\s*/m,'').replace(/```\s*$/m,'').trim();
}
function cleanLabel(s: string) {
  s = s.trim();
  s = s.replace(/^root\(\((.+?)\)\)$/i,'$1').replace(/^root\((.+?)\)$/i,'$1')
       .replace(/^root\[(.+?)\]$/i,'$1').replace(/^root$/i,'');
  s = s.replace(/^\(\((.+?)\)\)$/,'$1').replace(/^\((.+?)\)$/,'$1')
       .replace(/^\[\[(.+?)\]\]$/,'$1').replace(/^\[(.+?)\]$/,'$1')
       .replace(/^\{(.+?)\}$/,'$1').replace(/^"(.+?)"$/,'$1')
       .replace(/^[-*+]\s+/,'');
  return s.replace(/[\u2018\u2019]/g,"'").replace(/[\u201C\u201D]/g,'"').trim();
}

// ─── Tree ─────────────────────────────────────────────────────────────────────
interface TNode { id: string; label: string; children: TNode[] }

function buildTree(raw: string): TNode | null {
  const lines = stripFences(raw).split('\n');
  const flat: {depth:number;label:string}[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t || /^mindmap$/i.test(t)) continue;
    const depth = Math.floor((line.match(/^(\s*)/)?.[1]?.length ?? 0) / 2);
    const label = cleanLabel(t);
    if (label) flat.push({ depth, label });
  }
  if (!flat.length) return null;
  const minD = Math.min(...flat.map(n => n.depth));
  let id = 0;
  const mk = (label: string): TNode => ({ id: String(id++), label, children: [] });
  const root = mk(flat[0].label);
  const stack: {node:TNode;depth:number}[] = [{node:root,depth:minD}];
  for (let i = 1; i < flat.length; i++) {
    const { depth, label } = flat[i];
    const node = mk(label);
    while (stack.length > 1 && stack[stack.length-1].depth >= depth) stack.pop();
    stack[stack.length-1].node.children.push(node);
    stack.push({ node, depth });
  }
  return root;
}

// ─── Layout ───────────────────────────────────────────────────────────────────
const BRANCH_COLORS = [
  { line:'#3B82F6', nodeFill:'#DBEAFE', nodeStroke:'#3B82F6', nodeTxt:'#1E40AF', lvl1Fill:'#3B82F6', lvl1Txt:'#fff' },
  { line:'#10B981', nodeFill:'#D1FAE5', nodeStroke:'#10B981', nodeTxt:'#065F46', lvl1Fill:'#10B981', lvl1Txt:'#fff' },
  { line:'#F59E0B', nodeFill:'#FEF3C7', nodeStroke:'#F59E0B', nodeTxt:'#78350F', lvl1Fill:'#F59E0B', lvl1Txt:'#fff' },
  { line:'#8B5CF6', nodeFill:'#EDE9FE', nodeStroke:'#8B5CF6', nodeTxt:'#4C1D95', lvl1Fill:'#8B5CF6', lvl1Txt:'#fff' },
  { line:'#EF4444', nodeFill:'#FEE2E2', nodeStroke:'#EF4444', nodeTxt:'#7F1D1D', lvl1Fill:'#EF4444', lvl1Txt:'#fff' },
  { line:'#06B6D4', nodeFill:'#CFFAFE', nodeStroke:'#06B6D4', nodeTxt:'#164E63', lvl1Fill:'#06B6D4', lvl1Txt:'#fff' },
  { line:'#EC4899', nodeFill:'#FCE7F3', nodeStroke:'#EC4899', nodeTxt:'#831843', lvl1Fill:'#EC4899', lvl1Txt:'#fff' },
  { line:'#84CC16', nodeFill:'#ECFCCB', nodeStroke:'#84CC16', nodeTxt:'#3F6212', lvl1Fill:'#84CC16', lvl1Txt:'#fff' },
];

const CHAR_W = 6.8;
const LINE_H = 13;
const PAD_X  = 10;
const PAD_Y  = 7;
const X_STEP = 170; // horizontal spacing between depths
const LEAF_H = 52;  // vertical space per leaf

function leafCount(n: TNode): number {
  return n.children.length ? n.children.reduce((s,c) => s + leafCount(c), 0) : 1;
}

function maxDepth(n: TNode, d=0): number {
  return n.children.length ? Math.max(...n.children.map(c => maxDepth(c, d+1))) : d;
}

function wrapText(label: string, maxW: number): string[] {
  const maxChars = Math.floor((maxW - PAD_X*2) / CHAR_W);
  if (label.length <= maxChars) return [label];
  const words = label.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur+' '+w : w;
    if (test.length <= maxChars) { cur = test; }
    else { if (cur) lines.push(cur); cur = w.length > maxChars ? w.slice(0,maxChars-1)+'…' : w; }
  }
  if (cur) lines.push(cur);
  return lines.slice(0,3);
}

interface LNode {
  id:string; label:string; lines:string[];
  x:number; y:number; w:number; h:number;
  depth:number; colorIdx:number;
  children:LNode[];
}

function layoutNode(n: TNode, depth:number, colorIdx:number, yTop:number, xBase:number): LNode {
  const isRoot = depth === 0;
  const maxNodeW = isRoot ? 150 : depth===1 ? 140 : 130;
  const lines = wrapText(n.label, maxNodeW);
  const w = Math.min(maxNodeW, Math.max(...lines.map(l=>l.length)) * CHAR_W + PAD_X*2);
  const h = lines.length * LINE_H + PAD_Y*2;
  const leaves = leafCount(n);
  const totalH = leaves * LEAF_H;
  const cx = xBase + w/2;
  const cy = yTop + totalH/2;

  let childY = yTop;
  const children = n.children.map((c,i) => {
    const ci = depth===0 ? i : colorIdx;
    const childLeaves = leafCount(c);
    const child = layoutNode(c, depth+1, ci, childY, xBase + X_STEP);
    childY += childLeaves * LEAF_H;
    return child;
  });

  return { id:n.id, label:n.label, lines, x:cx, y:cy, w, h, depth, colorIdx, children };
}

function allNodes(n: LNode): LNode[] {
  return [n, ...n.children.flatMap(allNodes)];
}
function allEdges(n: LNode): {from:LNode;to:LNode}[] {
  return n.children.flatMap(c => [{from:n,to:c}, ...allEdges(c)]);
}

// S-curve bezier: exits right edge of parent, enters left edge of child
function bezier(from:LNode, to:LNode) {
  const x1 = from.x + from.w/2;
  const y1 = from.y;
  const x2 = to.x - to.w/2;
  const y2 = to.y;
  const mx = (x1+x2)/2;
  return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
}

// ─── SVG mind map ─────────────────────────────────────────────────────────────
function MindMapSVG({ root }: { root: TNode }) {
  const PAD = 24;
  const leaves = leafCount(root);
  const depth  = maxDepth(root);
  const svgH = leaves * LEAF_H + PAD*2;
  const svgW = (depth+1) * X_STEP + 180 + PAD*2;

  const layoutRoot = layoutNode(root, 0, 0, PAD, PAD);
  const nodes = allNodes(layoutRoot);
  const edges = allEdges(layoutRoot);

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${svgW} ${svgH}`}
      style={{ overflow:'visible', display:'block' }}
      aria-label="Mind map"
    >
      {/* ── Edges ── */}
      {edges.map(({from,to}) => {
        const col = to.depth===1
          ? BRANCH_COLORS[(to.colorIdx)%BRANCH_COLORS.length]
          : BRANCH_COLORS[(to.colorIdx)%BRANCH_COLORS.length];
        return (
          <path
            key={`e-${from.id}-${to.id}`}
            d={bezier(from,to)}
            fill="none"
            stroke={col.line}
            strokeWidth={to.depth===1 ? 2.5 : to.depth===2 ? 1.8 : 1.2}
            strokeOpacity={to.depth===1 ? 0.75 : 0.55}
          />
        );
      })}

      {/* ── Nodes ── */}
      {nodes.map(node => {
        const isRoot = node.depth===0;
        const col = BRANCH_COLORS[node.colorIdx % BRANCH_COLORS.length];

        const fill   = isRoot ? '#6366F1'
                     : node.depth===1 ? col.lvl1Fill
                     : col.nodeFill;
        const stroke = isRoot ? '#4F46E5' : col.nodeStroke;
        const txtCol = isRoot ? '#fff'
                     : node.depth===1 ? col.lvl1Txt
                     : col.nodeTxt;
        const rx = isRoot ? node.h/2 : node.depth===1 ? 8 : 6;
        const sw = isRoot ? 2 : node.depth===1 ? 0 : 1.5;

        const fontSize = isRoot ? 13 : node.depth===1 ? 12 : node.depth===2 ? 11 : 10;
        const fontWeight = isRoot ? 700 : node.depth===1 ? 700 : 500;
        const totalTxtH = node.lines.length * LINE_H;
        const txtStartY = node.y - totalTxtH/2 + LINE_H*0.75;

        return (
          <g key={`n-${node.id}`}>
            {/* Shadow */}
            {node.depth <= 1 && (
              <rect
                x={node.x-node.w/2+2} y={node.y-node.h/2+2}
                width={node.w} height={node.h} rx={rx}
                fill="rgba(0,0,0,0.08)"
              />
            )}
            {/* Box */}
            <rect
              x={node.x-node.w/2} y={node.y-node.h/2}
              width={node.w} height={node.h} rx={rx}
              fill={fill} stroke={stroke} strokeWidth={sw}
            />
            {/* Text lines */}
            {node.lines.map((line,i) => (
              <text
                key={i}
                x={node.x} y={txtStartY + i*LINE_H}
                textAnchor="middle"
                fontSize={fontSize}
                fontWeight={fontWeight}
                fill={txtCol}
                fontFamily="system-ui,sans-serif"
              >
                {line}
              </text>
            ))}
          </g>
        );
      })}
    </svg>
  );
}

// ─── Zoom wrapper ─────────────────────────────────────────────────────────────
const MIN_Z = 0.4, MAX_Z = 2.5, STEP = 0.15;

export default function MermaidView({ content }: Props) {
  const _ref = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);

  const zoomIn  = useCallback(()=>setZoom(z=>Math.min(MAX_Z,+(z+STEP).toFixed(2))),[]);
  const zoomOut = useCallback(()=>setZoom(z=>Math.max(MIN_Z,+(z-STEP).toFixed(2))),[]);
  const reset   = useCallback(()=>setZoom(1),[]);
  const onWheel = useCallback((e:React.WheelEvent)=>{
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setZoom(z=>e.deltaY<0?Math.min(MAX_Z,+(z+STEP).toFixed(2)):Math.max(MIN_Z,+(z-STEP).toFixed(2)));
  },[]);

  if (!content) return null;
  const tree = buildTree(content);
  if (!tree) return <p style={{padding:24,color:'#9CA3AF'}}>Mind map unavailable.</p>;

  return (
    <div style={{ userSelect:'none' }}>
      {/* Toolbar */}
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'8px 16px',
        borderBottom:'1px solid var(--border)',
        background:'var(--surface)',
        borderRadius:'8px 8px 0 0',
      }}>
        <span style={{fontSize:'0.78rem',color:'var(--text-secondary)'}}>
          🗺️ Mindmap · Ctrl+scroll to zoom
        </span>
        <div style={{display:'flex',gap:'4px'}}>
          {[
            {label:'−', action:zoomOut, disabled:zoom<=MIN_Z},
            {label:`${Math.round(zoom*100)}%`, action:reset, disabled:false},
            {label:'+', action:zoomIn,  disabled:zoom>=MAX_Z},
          ].map(b => (
            <button
              key={b.label}
              onClick={b.action}
              disabled={b.disabled}
              style={{
                minWidth:'36px', height:'30px', borderRadius:'6px',
                border:'1px solid var(--border)', background:'var(--surface)',
                cursor:b.disabled?'not-allowed':'pointer',
                fontWeight:700, fontSize:'0.9rem', color:'var(--primary)',
                opacity:b.disabled?0.4:1,
              }}
            >{b.label}</button>
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={_ref}
        onWheel={onWheel}
        style={{
          overflowX:'auto', overflowY:'visible',
          background:'#FAFBFF',
          borderRadius:'0 0 8px 8px',
          border:'1px solid var(--border)',
          borderTop:'none',
          padding:'12px',
          cursor: zoom>1?'grab':'default',
        }}
      >
        <div style={{
          transform:`scale(${zoom})`,
          transformOrigin:'top left',
          display:'inline-block',
          minWidth:'100%',
        }}>
          <MindMapSVG root={tree} />
        </div>
      </div>
    </div>
  );
}
