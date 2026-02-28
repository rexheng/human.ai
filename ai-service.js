/**
 * ai-service.js
 *
 * Multi-agent swarm backend.
 * Flow:
 *   1. Mistral AI → generates population sample (agent identities + traits)
 *   2. Strands on AWS Bedrock → creates + simulates the swarm
 */

import { Agent, McpClient, BedrockModel } from "@strands-agents/sdk";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MISTRAL_API_KEY   = import.meta.env.VITE_MISTRAL_API_KEY;
const BEDROCK_REGION    = import.meta.env.VITE_BEDROCK_REGION    || "us-west-2";
const BEDROCK_AGENT_ARN = import.meta.env.VITE_BEDROCK_AGENT_ARN || "";
const BEARER_TOKEN      = import.meta.env.VITE_BEDROCK_BEARER_TOKEN || "";
const BEDROCK_MODEL_ID  = "anthropic.claude-3-sonnet-20240229-v1:0";
const MISTRAL_CHAT_URL  = "https://api.mistral.ai/v1/chat/completions";

// ---------------------------------------------------------------------------
// MCP Client Singleton (lazy, cached)
// One connection reused across all Strands agent calls.
// ---------------------------------------------------------------------------

let _mcpClientPromise = null;

function getMcpClient() {
    if (!BEDROCK_AGENT_ARN) return Promise.resolve(null);
    if (_mcpClientPromise) return _mcpClientPromise;

    _mcpClientPromise = (async () => {
        try {
            const url = new URL(
                `https://bedrock-agentcore.${BEDROCK_REGION}.amazonaws.com` +
                `/runtimes/${encodeURIComponent(BEDROCK_AGENT_ARN)}/invocations?qualifier=DEFAULT`
            );
            const transport = new StreamableHTTPClientTransport(url, {
                requestInit: {
                    headers: {
                        "Authorization": `Bearer ${BEARER_TOKEN}`,
                        "Content-Type": "application/json"
                    }
                }
            });
            const client = new McpClient({ transport });
            await client.connect();
            console.log("[ai-service] MCP connected");
            return client;
        } catch (err) {
            console.warn("[ai-service] MCP failed, running without tools:", err.message);
            _mcpClientPromise = null; // allow retry next call
            return null;
        }
    })();

    return _mcpClientPromise;
}

// ---------------------------------------------------------------------------
// Bedrock Model Singleton
// ---------------------------------------------------------------------------

let _bedrockModel = null;

function getBedrockModel() {
    if (!_bedrockModel) {
        _bedrockModel = new BedrockModel({
            region: BEDROCK_REGION,
            modelId: BEDROCK_MODEL_ID,
        });
    }
    return _bedrockModel;
}

// ---------------------------------------------------------------------------
// Mistral function-call tool schema for identity generation
// ---------------------------------------------------------------------------

const IDENTITY_TOOL = {
    type: "function",
    function: {
        name: "register_agent_identity",
        description: "Register one synthetic agent into the population sample.",
        parameters: {
            type: "object",
            required: ["id", "name", "role", "culture", "education", "income", "traits", "description"],
            properties: {
                id:          { type: "string" },
                name:        { type: "string" },
                role:        { type: "string" },
                culture:     { type: "string" },
                education:   { type: "string" },
                income:      { type: "string" },
                traits: {
                    type: "object",
                    required: ["O", "C", "E", "A", "N"],
                    properties: {
                        O: { type: "integer", minimum: 1, maximum: 10 },
                        C: { type: "integer", minimum: 1, maximum: 10 },
                        E: { type: "integer", minimum: 1, maximum: 10 },
                        A: { type: "integer", minimum: 1, maximum: 10 },
                        N: { type: "integer", minimum: 1, maximum: 10 }
                    }
                },
                description: { type: "string" }
            }
        }
    }
};

// ---------------------------------------------------------------------------
// A. generateSwarmIdentities — Mistral Function Calling
// ---------------------------------------------------------------------------

export async function generateSwarmIdentities(count, researchQuestion) {
    const question = researchQuestion || "general social simulation";

    try {
        const response = await fetch(MISTRAL_CHAT_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${MISTRAL_API_KEY}`
            },
            body: JSON.stringify({
                model: "mistral-large-latest",
                tools: [IDENTITY_TOOL],
                tool_choice: "any",
                parallel_tool_calls: true,
                messages: [
                    {
                        role: "system",
                        content: `You are a population sampling expert. Given a research question, generate a realistic diverse population. Call register_agent_identity exactly ${count} times. No prose — only tool calls.`
                    },
                    {
                        role: "user",
                        content: `Research question: ${question}. Generate ${count} agents.`
                    }
                ]
            })
        });

        const data = await response.json();
        const toolCalls = data.choices?.[0]?.message?.tool_calls ?? [];
        const agents = toolCalls.map(call => JSON.parse(call.function.arguments));

        // Pad with fallbacks if model returned fewer than requested
        while (agents.length < count) {
            const i = agents.length;
            agents.push({
                id: `agent-${i}`,
                name: `Agent ${i}`,
                role: "Generalist",
                culture: "Western",
                education: "undergraduate",
                income: "middle",
                traits: { O: 5, C: 5, E: 5, A: 5, N: 5 },
                description: "A standard fallback agent."
            });
        }

        return agents.slice(0, count);
    } catch (error) {
        console.error("[ai-service] generateSwarmIdentities error:", error);
        return Array.from({ length: count }, (_, i) => ({
            id: `agent-${i}`,
            name: `Agent ${i}`,
            role: "Generalist",
            culture: "Western",
            education: "undergraduate",
            income: "middle",
            traits: { O: 5, C: 5, E: 5, A: 5, N: 5 },
            description: "A standard fallback agent."
        }));
    }
}

// ---------------------------------------------------------------------------
// Helper: parse JSON from an agent result string
// ---------------------------------------------------------------------------

function parseAgentJson(result) {
    const raw = (result?.lastMessage ?? result?.toString() ?? "")
        .replace(/```json|```/g, "")
        .trim();
    return JSON.parse(raw);
}

// ---------------------------------------------------------------------------
// B. getSwarmInteraction — Strands Multi-Agent Coordinator Pattern
// ---------------------------------------------------------------------------

export async function getSwarmInteraction(agents, task) {
    const mcpClient = await getMcpClient();
    const model     = getBedrockModel();
    const tools     = mcpClient ? [mcpClient] : [];

    const roster = JSON.stringify(
        agents.map(a => ({ id: a.id, role: a.role, traits: a.traits }))
    );

    // Phase 1: run psychology + network analysis in parallel
    const psychologyAnalyst = new Agent({
        model,
        systemPrompt:
            "Analyze OCEAN Big Five pairwise compatibility. High A+A = cooperative link. High E = hub. " +
            "Return ONLY JSON array [{source,target,compatibility}].",
        tools
    });

    const networkArchitect = new Agent({
        model,
        systemPrompt:
            "Design optimal graph topology for the given research task and agent roles. " +
            "Return ONLY JSON array [{source,target,topology}].",
        tools
    });

    const [psychResult, archResult] = await Promise.all([
        psychologyAnalyst.invoke(
            `Agents: ${roster}\nTask: ${task}\nReturn compatibility scores as JSON array.`
        ).catch(() => null),
        networkArchitect.invoke(
            `Agents: ${roster}\nTask: ${task}\nReturn topology recommendations as JSON array.`
        ).catch(() => null)
    ]);

    // Phase 2: coordinator merges both results
    const synthesisCoordinator = new Agent({
        model,
        systemPrompt:
            "You receive psychology compatibility scores and topology recommendations. " +
            "Merge into a final weighted link list. Weight = (compatibility + topologyScore) / 2. " +
            "Include only links with weight >= 0.3. Return ONLY JSON array [{source,target,weight}].",
        tools
    });

    const psychJson  = psychResult  ? (result => { try { return parseAgentJson(result); } catch { return []; } })(psychResult)  : [];
    const archJson   = archResult   ? (result => { try { return parseAgentJson(result); } catch { return []; } })(archResult)   : [];

    try {
        const finalResult = await synthesisCoordinator.invoke(
            `Psychology scores: ${JSON.stringify(psychJson)}\n` +
            `Topology recommendations: ${JSON.stringify(archJson)}\n` +
            `Produce the final weighted link list as a JSON array.`
        );
        return parseAgentJson(finalResult);
    } catch (error) {
        console.error("[ai-service] getSwarmInteraction coordinator error:", error);
        return [];
    }
}

// ---------------------------------------------------------------------------
// Helper: build persona system prompt for agentTickStrands
// ---------------------------------------------------------------------------

function buildPersonaPrompt(agentData, actions, ctx) {
    const traits = Object.entries(agentData.traits || {})
        .map(([k, v]) => `${k}:${v}/10`)
        .join(", ");

    const memories = (agentData.memories || [])
        .slice(-5)
        .join("\n");

    const recent = (actions || [])
        .slice(-6)
        .map(a => `[${a.name}]: ${a.action}`)
        .join("\n");

    return [
        `You are ${agentData.name}, a ${agentData.role}.`,
        `Background: ${agentData.culture || ""} | ${agentData.education || ""} | income: ${agentData.income || ""}`,
        `Big Five traits: ${traits}`,
        memories   ? `Memories:\n${memories}`       : "",
        recent     ? `Recent Actions:\n${recent}`   : "",
        ctx        ? `Research Context: ${ctx}`      : ""
    ].filter(Boolean).join("\n");
}

// ---------------------------------------------------------------------------
// C. agentTickStrands — Persona Tick via Strands
// ---------------------------------------------------------------------------

export async function agentTickStrands(agentData, actions, ctx) {
    const mcpClient = await getMcpClient();
    const agent = new Agent({
        model: getBedrockModel(),
        systemPrompt: buildPersonaPrompt(agentData, actions, ctx),
        tools: mcpClient ? [mcpClient] : []
    });

    const result = await agent.invoke(
        'What do you do next? Respond ONLY with JSON (no markdown): ' +
        '{"thought":"...","action":"...","sentiment":<float -1 to 1>,"stance":"cooperate|neutral|defect|agree|challenge"}'
    );

    const raw = (result.lastMessage ?? result.toString())
        .replace(/```json|```/g, "")
        .trim();

    return JSON.parse(raw);
}

// ---------------------------------------------------------------------------
// D. runSwarmTick — NEW parallel batch export
// ---------------------------------------------------------------------------

export async function runSwarmTick(allAgents, actions, ctx) {
    return Promise.all(
        allAgents.map(agentData =>
            agentTickStrands(agentData, actions, ctx)
                .then(result => ({ agentId: agentData.id, result }))
                .catch(() => ({
                    agentId: agentData.id,
                    result: {
                        thought: "Processing...",
                        action: "Observing.",
                        sentiment: 0,
                        stance: "neutral"
                    }
                }))
        )
    );
}
