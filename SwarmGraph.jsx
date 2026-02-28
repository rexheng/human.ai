import React, { useRef, useEffect, useState, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import * as d3 from 'd3-force';
import { User, Activity, Zap } from 'lucide-react';

/**
 * SwarmGraph Component
 * 
 * Visualizes a swarm of 10-50 agents using a force-directed graph.
 * Supports dynamic updates and 'tweaking' animations.
 */
const SwarmGraph = ({ agents, links, onNodeClick }) => {
    const fgRef = useRef();

    // Prepare graph data
    const data = useMemo(() => {
        return {
            nodes: agents.map(agent => ({
                id: agent.id,
                name: agent.name,
                role: agent.role,
                val: 10, // Size base
                color: agent.traits ? `hsl(${agent.traits.O * 36}, 70%, 60%)` : '#4a8aff'
            })),
            links: links || []
        };
    }, [agents, links]);

    useEffect(() => {
        if (fgRef.current) {
            // Add custom forces if needed
            fgRef.current.d3Force('charge').strength(-150);
            fgRef.current.d3Force('link').distance(100);
        }
    }, []);

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative', background: '#060810', borderRadius: '16px', overflow: 'hidden', border: '1px solid #191d32' }}>
            <ForceGraph2D
                ref={fgRef}
                graphData={data}
                nodeLabel={node => `${node.name} (${node.role})`}
                nodeColor={node => node.color}
                nodeCanvasObject={(node, ctx, globalScale) => {
                    const label = node.name;
                    const fontSize = 12 / globalScale;
                    ctx.font = `${fontSize}px Sans-Serif`;
                    const textWidth = ctx.measureText(label).width;
                    const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2); // some padding

                    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                    ctx.beginPath();
                    ctx.arc(node.x, node.y, 6, 0, 2 * Math.PI, false);
                    ctx.fill();

                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = node.color;
                    ctx.fillText(label, node.x, node.y + 12);

                    // Outer glow for nodes
                    ctx.shadowBlur = 15;
                    ctx.shadowColor = node.color;
                    ctx.strokeStyle = node.color;
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }}
                linkColor={() => 'rgba(74, 138, 255, 0.2)'}
                linkWidth={2}
                linkDirectionalParticles={2}
                linkDirectionalParticleSpeed={d => d.value * 0.005 || 0.01}
                onNodeClick={onNodeClick}
                cooldownTicks={100}
            />

            {/* Legend / Overlay */}
            <div style={{ position: 'absolute', top: 20, left: 20, pointerEvents: 'none' }}>
                <div style={{ background: 'rgba(12, 14, 24, 0.8)', padding: '12px', borderRadius: '12px', border: '1px solid #191d32', backdropFilter: 'blur(8px)' }}>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#dee0ed', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Activity size={16} color="#4a8aff" /> Strand Swarm Network
                    </h3>
                    <div style={{ fontSize: '12px', color: '#9599b5' }}>
                        {agents.length} Active Agents
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SwarmGraph;
