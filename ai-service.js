/**
 * ai-service.js
 * 
 * Refactored to use Strands Agent Framework and Model Context Protocol (MCP).
 * Orchestrates interactions via Amazon Bedrock AgentCore.
 */

import { Agent, McpClient, BedrockModel } from "@strands-agents/sdk";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const MISTRAL_API_KEY = import.meta.env.VITE_MISTRAL_API_KEY;

// Bedrock / MCP Config
const BEDROCK_REGION = import.meta.env.VITE_BEDROCK_REGION || "us-west-2";
const BEDROCK_AGENT_ARN = import.meta.env.VITE_BEDROCK_AGENT_ARN || "";
const BEARER_TOKEN = import.meta.env.VITE_BEDROCK_BEARER_TOKEN || "";
/**
 * Initializes a Strands Agent with Bedrock MCP tools.
 */
async function createStrandsAgent(modelName = "anthropic.claude-3-sonnet-20240229-v1:0") {
    const model = new BedrockModel({
        region: BEDROCK_REGION,
        modelId: modelName
    });

    // If we have an Agent ARN, we can connect to the MCP server
    let tools = [];
    if (BEDROCK_AGENT_ARN) {
        try {
            const encodedArn = encodeURIComponent(BEDROCK_AGENT_ARN);
            const mcpUrl = new URL(`https://bedrock-agentcore.${BEDROCK_REGION}.amazonaws.com/runtimes/${encodedArn}/invocations?qualifier=DEFAULT`);

            const transport = new StreamableHTTPClientTransport(mcpUrl, {
                requestInit: {
                    headers: {
                        "Authorization": `Bearer ${BEARER_TOKEN}`,
                        "Content-Type": "application/json"
                    }
                }
            });

            const mcpClient = new McpClient({ transport });
            await mcpClient.connect();
            tools = await mcpClient.listTools();
        } catch (error) {
            console.warn("MCP Connection failed, falling back to model-only agent:", error);
        }
    }

    return new Agent({
        model,
        tools
    });
}

/**
 * Generates a batch of agent identities using Mistral AI.
 * (Kept for compatibility with initial Identity Allocation flow)
 */
export async function generateSwarmIdentities(count) {
    const prompt = `Generate a JSON array of ${count} unique AI agent identities for a multi-agent swarm.
  Each identity should have:
  - id: (unique string)
  - name: (vivid name)
  - role: (specialized role in a complexity-solving swarm)
  - traits: (OCEAN model: O, C, E, A, N as integers 1-10)
  - description: (one sentence personality sketch)
  
  Format: [{"id": "...", "name": "...", "role": "...", "traits": {"O": 5, ...}, "description": "..."}]
  Respond ONLY with the JSON array.`;

    try {
        const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${MISTRAL_API_KEY}`
            },
            body: JSON.stringify({
                model: "mistral-large-latest",
                messages: [{ role: "user", content: prompt }]
            })
        });

        const data = await response.json();
        const content = data.choices[0].message.content.trim();
        const jsonStr = content.replace(/```json|```/g, "").trim();
        return JSON.parse(jsonStr);
    } catch (error) {
        console.error("Mistral API Error:", error);
        return Array.from({ length: count }).map((_, i) => ({
            id: `agent-${i}`,
            name: `Agent-${i}`,
            role: "Generalist",
            traits: { O: 5, C: 5, E: 5, A: 5, N: 5 },
            description: "A standard fallback agent."
        }));
    }
}

/**
 * Orchestrates a swarm interaction using a Strands Agent.
 * This determines interaction links and weights.
 */
export async function getSwarmInteraction(agents, task) {
    const agent = await createStrandsAgent();

    const prompt = `As the Amazon Bedrock AgentCore orchestrator, determine the interaction links for this swarm:
  Agents: ${JSON.stringify(agents.map(a => ({ id: a.id, role: a.role })))}
  Task: ${task}
  
  Return a JSON array of links for the Strand Pattern:
  [{"source": "agentId1", "target": "agentId2", "weight": 0.8}]
  Respond ONLY with the JSON array.`;

    try {
        const result = await agent.invoke(prompt);
        const content = result.toString();
        const jsonStr = content.replace(/```json|```/g, "").trim();
        return JSON.parse(jsonStr);
    } catch (error) {
        console.error("Strands Agent Interaction Error:", error);
        return [];
    }
}

/**
 * New function to handle persona-based ticks using Strands Agent.
 */
export async function agentTickStrands(agentData, actions, ctx) {
    const agent = await createStrandsAgent();

    const traits = Object.entries(agentData.traits).map(([k, v]) => `${k}:${v}`).join(", ");
    const memories = agentData.memories.slice(-5).join("\n");
    const recent = actions.slice(-6).map(a => `[${a.name}]: ${a.action}`).join("\n");

    const systemPrompt = `You are ${agentData.name}, a ${agentData.role}. Big Five: ${traits}.\nMemories:\n${memories}\nRecent Actions:\n${recent}\n${ctx}`;
    const userPrompt = "What do you do next? Respond ONLY with JSON: {\"thought\":\"...\",\"action\":\"...\",\"sentiment\":<-1 to 1>,\"stance\":\"...\"}";

    try {
        const result = await agent.invoke({
            system: systemPrompt,
            messages: [{ role: "user", content: userPrompt }]
        });
        const content = result.toString();
        const jsonStr = content.replace(/```json|```/g, "").trim();
        return JSON.parse(jsonStr);
    } catch (error) {
        console.error("Strands Agent Tick Error:", error);
        return { thought: "I'm processing...", action: "Observing.", sentiment: 0, stance: "neutral" };
    }
}
