"""
Social graph: influence weights based on extraversion, occupation, confidence.
"""
from typing import Dict, List
from collections import defaultdict

from agents.persona import AgentState

OCCUPATION_INFLUENCE = {
    "teacher": 1.2,
    "doctor": 1.3,
    "lawyer": 1.2,
    "engineer": 1.0,
    "developer": 1.0,
    "nurse": 1.1,
    "manager": 1.25,
    "consultant": 1.2,
    "journalist": 1.3,
    "politician": 1.4,
    "driver": 0.8,
    "retail": 0.85,
    "worker": 0.9,
}


def build_influence_weights(agents: List[AgentState]) -> Dict[str, float]:
    """Per-agent influence score (0-1+) from extraversion, occupation, confidence."""
    weights = {}
    for a in agents:
        occ = (a.persona.occupation or "").lower()
        occ_score = 1.0
        for k, v in OCCUPATION_INFLUENCE.items():
            if k in occ:
                occ_score = v
                break
        extra = a.persona.ocean.extraversion / 10.0
        conf = a.confidence
        influence = (extra * 0.4 + occ_score * 0.3 + conf * 0.3)
        weights[a.id] = min(2.0, max(0.2, influence))
    return weights


class SocialGraph:
    def __init__(self, agents: List[AgentState]):
        self.agents = {a.id: a for a in agents}
        self.influence = build_influence_weights(agents)
        self.edges: List[tuple[str, str, float]] = []  # (source, target, weight)

    def add_interaction(self, source_id: str, target_id: str, weight: float = 1.0) -> None:
        self.edges.append((source_id, target_id, weight))

    def get_influence(self, agent_id: str) -> float:
        return self.influence.get(agent_id, 0.5)

    def get_neighbors(self, agent_id: str) -> List[tuple[str, float]]:
        out = []
        for s, t, w in self.edges:
            if s == agent_id:
                out.append((t, w))
            elif t == agent_id:
                out.append((s, w))
        return out
