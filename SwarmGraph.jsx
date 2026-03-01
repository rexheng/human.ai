import React, { useRef, useEffect, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

/**
 * SwarmGraph — force-directed knowledge graph of agents.
 * grayscale: true for Swiss-editorial (white bg, near-black nodes, no accent).
 */
const SwarmGraph = ({ agents, links, onNodeClick, onNodeHover, grayscale = false, showLastAction = false }) => {
  const fgRef = useRef();

  const palette = grayscale
    ? { bg: '#ffffff', node: '#1a1a1a', nodeLabel: '#4a4a4a', link: 'rgba(26,26,26,0.2)', legendBg: 'rgba(255,255,255,0.9)', legendBorder: '#e0e0e0', legendText: '#4a4a4a', legendMono: '#8a8a8a', stay: '#2dd4a0', churn: '#ee6b90', downgrade: '#f0b429' }
    : { bg: '#060810', node: '#4a8aff', nodeLabel: '#dee0ed', link: 'rgba(74,138,255,0.2)', legendBg: 'rgba(12,14,24,0.8)', legendBorder: '#191d32', legendText: '#dee0ed', legendMono: '#9599b5', stay: '#2dd4a0', churn: '#ee6b90', downgrade: '#f0b429' };

  const data = useMemo(() => ({
    nodes: agents.map(agent => ({
      id: agent.id,
      name: agent.name,
      role: agent.role,
      val: 10,
      color: palette.node,
      lastAction: agent.lastAction || null,
      confidence: agent.confidence ?? null,
      archetype: agent.archetype || "",
      lastReasoning: agent.lastReasoning || "",
      persona: agent.persona || '',
      culture: agent.culture || '',
      income: agent.income || '',
      traits: agent.traits || null,
    })),
    links: (links || []).map(l => ({ ...l, value: l.weight ?? 1 })),
  }), [agents, links, palette.node]);

  useEffect(() => {
    if (fgRef.current) {
      fgRef.current.d3Force('charge').strength(-150);
      fgRef.current.d3Force('link').distance(100);
    }
  }, []);

  return (
    <div style={{
      width: '100%',
      height: '100%',
      minHeight: 380,
      position: 'relative',
      background: palette.bg,
      overflow: 'hidden',
      border: grayscale ? '1px solid #e0e0e0' : '1px solid #191d32',
    }}>
      <ForceGraph2D
        ref={fgRef}
        graphData={data}
        nodeLabel={node => {
          const parts = [node.name, node.role];
          if (node.persona) parts.push(node.persona);
          if (node.culture) parts.push(`Location: ${node.culture}`);
          if (node.income) parts.push(node.income);
          if (node.lastAction) parts.push(`Vote: ${node.lastAction}`);
          if (node.archetype) parts.push(`Archetype: ${node.archetype}`);
          if (node.confidence != null) parts.push(`Confidence: ${Math.round(Number(node.confidence) * 100)}%`);
          if (node.lastReasoning) parts.push(`Reasoning: ${node.lastReasoning}`);
          if (node.traits && typeof node.traits === 'object') {
            const t = node.traits;
            const ocean = ['O', 'C', 'E', 'A', 'N'].map(k => t[k] != null ? `${k}:${t[k]}` : null).filter(Boolean);
            if (ocean.length) parts.push(`OCEAN: ${ocean.join(' ')}`);
          }
          return parts.join('\n');
        }}
        nodeColor={() => palette.node}
        nodeCanvasObject={(node, ctx, globalScale) => {
          const label = node.name;
          const fontSize = Math.max(10, 12 / globalScale);
          const action = showLastAction && node.lastAction ? node.lastAction : null;
          const actionColor = action === 'Stay' ? palette.stay : action === 'Churn' ? palette.churn : action === 'Downgrade' ? palette.downgrade : null;
          ctx.font = `${fontSize}px ${grayscale ? '"Geist Sans", system-ui, sans-serif' : 'Sans-Serif'}`;
          ctx.fillStyle = palette.node;
          ctx.beginPath();
          ctx.arc(node.x, node.y, grayscale ? 4 : 6, 0, 2 * Math.PI, false);
          ctx.fill();
          if (actionColor) {
            ctx.strokeStyle = actionColor;
            ctx.lineWidth = 2;
            ctx.stroke();
          } else if (grayscale) {
            ctx.strokeStyle = '#e0e0e0';
            ctx.lineWidth = 1;
            ctx.stroke();
          } else {
            ctx.shadowBlur = 15;
            ctx.shadowColor = palette.node;
            ctx.strokeStyle = palette.node;
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.shadowBlur = 0;
          }
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = palette.nodeLabel;
          ctx.fillText(label, node.x, node.y + 14);
          if (action && globalScale > 0.5) {
            ctx.font = `${Math.max(8, 10 / globalScale)}px ${grayscale ? '"Geist Mono", ui-monospace, monospace' : 'monospace'}`;
            ctx.fillStyle = actionColor || palette.nodeLabel;
            ctx.fillText(action, node.x, node.y + 26);
          }
        }}
        linkColor={() => palette.link}
        linkWidth={grayscale ? 1 : 2}
        linkDirectionalParticles={grayscale ? 0 : 2}
        linkDirectionalParticleSpeed={d => (d.value || 1) * 0.005}
        onNodeClick={onNodeClick}
        onNodeHover={onNodeHover}
        cooldownTicks={100}
      />
      <div style={{ position: 'absolute', top: 12, left: 12, pointerEvents: 'none' }}>
        <div style={{
          background: palette.legendBg,
          padding: '10px 14px',
          border: `1px solid ${palette.legendBorder}`,
          fontFamily: grayscale ? '"Geist Mono", ui-monospace, monospace' : 'inherit',
          fontSize: '0.6875rem',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: palette.legendMono,
        }}>
          {agents.length} agents · Strand network
        </div>
      </div>
    </div>
  );
};

export default SwarmGraph;
