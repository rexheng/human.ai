"""
Simulation engine: run 5–10 rounds, select groups, discuss, update beliefs, store history.
"""
import asyncio
from typing import List, Optional, Callable, Any
from dataclasses import dataclass, field

from agents.persona import AgentState
from agents.generator import generate_agents
from .interactions import run_round, ConversationTurn
from .graph import SocialGraph
from llm.bedrock_client import BedrockClient


@dataclass
class SimulationConfig:
    scenario: str
    population_size: int
    num_rounds: int = 7
    group_size: int = 3


class SimulationEngine:
    def __init__(
        self,
        bedrock: BedrockClient,
        config: SimulationConfig,
        on_turn: Optional[Callable[[ConversationTurn], Any]] = None,
    ):
        self.bedrock = bedrock
        self.config = config
        self.on_turn = on_turn
        self.agents: List[AgentState] = []
        self.graph: Optional[SocialGraph] = None
        self.all_turns: List[ConversationTurn] = []
        self._running = False

    def generate_population(self) -> List[dict]:
        """Generate agents via LLM and return list of persona dicts for API."""
        personas = generate_agents(
            self.config.scenario,
            self.config.population_size,
            self.bedrock,
        )
        self.agents = [
            AgentState(id=f"agent-{i+1}", persona=p)
            for i, p in enumerate(personas)
        ]
        self.graph = SocialGraph(self.agents)
        return [a.persona.model_dump() for a in self.agents]

    def run_sync(self) -> List[ConversationTurn]:
        """Run all rounds synchronously. For WebSocket we can run_async and stream."""
        self.all_turns = []
        self._running = True
        for r in range(self.config.num_rounds):
            turns = run_round(
                r,
                self.agents,
                self.config.scenario,
                self.graph,
                self.bedrock,
                group_size=self.config.group_size,
                on_turn=self._emit_turn,
            )
            self.all_turns.extend(turns)
        self._running = False
        return self.all_turns

    def _emit_turn(self, turn: ConversationTurn) -> None:
        if self.on_turn:
            self.on_turn(turn)

    async def run_async(self) -> List[ConversationTurn]:
        """Run rounds in async loop; each round can yield for streaming."""
        return await asyncio.to_thread(self.run_sync)

    def get_conversation_history(self) -> List[dict]:
        out = []
        for a in self.agents:
            for h in a.conversation_history:
                out.append({
                    "agent_id": a.id,
                    "agent_name": a.persona.name,
                    "message": h.get("message", ""),
                    "stance": h.get("stance", ""),
                    "reasoning": h.get("reasoning", ""),
                    "confidence": h.get("confidence", a.confidence),
                })
        return out

    def get_final_beliefs(self) -> List[dict]:
        return [
            {"agent_id": a.id, "agent_name": a.persona.name, "belief": a.belief, "confidence": a.confidence}
            for a in self.agents
        ]
