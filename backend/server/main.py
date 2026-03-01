"""
FastAPI backend: REST + WebSocket for AI social simulation.
Run from backend dir: uvicorn server.main:app --reload
"""
import asyncio
import json
import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Ensure backend root is on path when running as uvicorn server.main:app
_backend_root = Path(__file__).resolve().parent.parent
if str(_backend_root) not in __import__("sys").path:
    __import__("sys").path.insert(0, str(_backend_root))

from llm.bedrock_client import BedrockClient
from agents.persona import AgentState
from agents.generator import generate_agents
from simulation.engine import SimulationEngine, SimulationConfig
from simulation.interactions import ConversationTurn
from reports.synthesis import synthesize_report


# --------------- Config ---------------
class GenerateAgentsRequest(BaseModel):
    scenario: str = "Ban bicycles in Central London"
    population_size: int = 25


class RunSimulationRequest(BaseModel):
    scenario: str
    population_size: int = 25
    num_rounds: int = 7


# --------------- App state ---------------
bedrock: BedrockClient = None
last_generated_agents: list[AgentState] = []


@asynccontextmanager
async def lifespan(app: FastAPI):
    global bedrock
    bedrock = BedrockClient(
        region=os.getenv("BEDROCK_REGION"),
        aws_access_key=os.getenv("AWS_ACCESS_KEY_ID") or os.getenv("AWS_ACCESS_KEY"),
        aws_secret_key=os.getenv("AWS_SECRET_ACCESS_KEY") or os.getenv("AWS_SECRET_KEY"),
        aws_session_token=os.getenv("AWS_SESSION_TOKEN"),
    )
    yield
    bedrock = None


app = FastAPI(title="AI Social Simulation API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------- REST: Generate agents ---------------
@app.post("/generate_agents")
async def post_generate_agents(body: GenerateAgentsRequest):
    global last_generated_agents
    personas = generate_agents(body.scenario, body.population_size, bedrock)
    last_generated_agents = [
        AgentState(id=f"agent-{i+1}", persona=p)
        for i, p in enumerate(personas)
    ]
    return {
        "agents": [a.persona.model_dump() for a in last_generated_agents],
        "count": len(last_generated_agents),
    }


# --------------- REST: Run simulation (sync, returns report) ---------------
@app.post("/run_simulation")
async def post_run_simulation(body: RunSimulationRequest):
    if not last_generated_agents and body.population_size:
        personas = generate_agents(body.scenario, body.population_size, bedrock)
        agents = [AgentState(id=f"agent-{i+1}", persona=p) for i, p in enumerate(personas)]
    else:
        agents = list(last_generated_agents) if last_generated_agents else []
        if not agents:
            return {"error": "No agents. Call POST /generate_agents first."}
    config = SimulationConfig(
        scenario=body.scenario,
        population_size=len(agents),
        num_rounds=body.num_rounds,
    )
    engine = SimulationEngine(bedrock, config)
    engine.agents = agents
    from simulation.graph import SocialGraph
    engine.graph = SocialGraph(agents)
    turns = await engine.run_async()
    history = engine.get_conversation_history()
    beliefs = engine.get_final_beliefs()
    report = synthesize_report(history, beliefs, bedrock)
    return {
        "report": report,
        "turns_count": len(turns),
        "final_beliefs": beliefs,
    }


# --------------- WebSocket: Stream simulation ---------------
@app.websocket("/simulation_stream")
async def websocket_simulation_stream(websocket: WebSocket):
    await websocket.accept()
    try:
        payload = await websocket.receive_text()
        data = json.loads(payload)
        scenario = data.get("scenario", "Ban bicycles in Central London")
        population_size = int(data.get("population_size", 25))
        num_rounds = int(data.get("num_rounds", 7))
    except (json.JSONDecodeError, WebSocketDisconnect) as e:
        await websocket.send_json({"type": "error", "message": str(e)})
        return

    try:
        if last_generated_agents and len(last_generated_agents) == population_size:
            agents = list(last_generated_agents)
        else:
            personas = generate_agents(scenario, population_size, bedrock)
            agents = [AgentState(id=f"agent-{i+1}", persona=p) for i, p in enumerate(personas)]
            await websocket.send_json({
                "type": "agents_generated",
                "count": len(agents),
                "agents": [a.persona.model_dump() for a in agents],
            })

        config = SimulationConfig(scenario=scenario, population_size=len(agents), num_rounds=num_rounds)
        collected_turns: list = []

        def collect_turn(turn: ConversationTurn):
            collected_turns.append(turn)

        engine = SimulationEngine(bedrock, config, on_turn=collect_turn)
        engine.agents = agents
        from simulation.graph import SocialGraph
        engine.graph = SocialGraph(agents)
        turns = await engine.run_async()

        for t in collected_turns:
            await websocket.send_json({
                "type": "turn",
                "round": t.round_index,
                "agent_id": t.agent_id,
                "agent_name": t.agent_name,
                "message": t.message,
                "stance": t.stance,
                "reasoning": t.reasoning,
                "confidence": t.confidence,
                "archetype": t.archetype,
                "belief_before": t.belief_before,
                "belief_after": t.belief_after,
            })
            await asyncio.sleep(0.05)

        history = engine.get_conversation_history()
        beliefs = engine.get_final_beliefs()
        report = synthesize_report(history, beliefs, bedrock)
        await websocket.send_json({
            "type": "report",
            "report": report,
            "turns_count": len(turns),
            "final_beliefs": beliefs,
        })
    except Exception as e:
        await websocket.send_json({"type": "error", "message": str(e)})
    finally:
        try:
            await websocket.close()
        except Exception:
            pass


@app.get("/health")
async def health():
    return {"status": "ok"}
