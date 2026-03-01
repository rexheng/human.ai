"""
Run one round: select groups, agents discuss, update beliefs, store history.
"""
import random
from typing import List, Callable, Any, Optional
from dataclasses import dataclass, field

from agents.persona import AgentState
from agents.behavior import get_agent_response_detail
from llm.bedrock_client import BedrockClient
from .graph import SocialGraph


@dataclass
class ConversationTurn:
    round_index: int
    agent_id: str
    agent_name: str
    message: str
    stance: str  # support | oppose | undecided
    reasoning: str
    confidence: float
    archetype: str
    belief_before: str
    belief_after: str


def run_round(
    round_index: int,
    agents: List[AgentState],
    scenario: str,
    graph: SocialGraph,
    bedrock: BedrockClient,
    group_size: int = 3,
    on_turn: Optional[Callable[[ConversationTurn], Any]] = None,
) -> List[ConversationTurn]:
    """
    Select random groups, each agent speaks in turn; beliefs updated by influence.
    Returns list of ConversationTurn for streaming/logging.
    """
    turns: List[ConversationTurn] = []
    shuffled = list(agents)
    random.shuffle(shuffled)
    for g in range(0, len(shuffled), group_size):
        group = shuffled[g : g + group_size]
        if len(group) < 2:
            continue
        conv_messages: List[dict] = []
        for agent in group:
            belief_before = agent.belief
            detail = get_agent_response_detail(agent, scenario, conv_messages, bedrock)
            message = str(detail.get("message", f"{agent.persona.name} expresses their view."))
            stance = str(detail.get("stance", "undecided"))
            reasoning = str(detail.get("reasoning", ""))
            confidence = float(detail.get("confidence", agent.confidence))
            archetype = str(detail.get("archetype", ""))
            agent.belief = stance
            agent.confidence = max(0.0, min(1.0, confidence))
            agent.conversation_history.append({
                "agent_name": agent.persona.name,
                "message": message,
                "stance": stance,
                "reasoning": reasoning,
                "confidence": confidence,
                "archetype": archetype,
            })
            conv_messages.append({"agent_name": agent.persona.name, "message": message})
            turn = ConversationTurn(
                round_index=round_index,
                agent_id=agent.id,
                agent_name=agent.persona.name,
                message=message,
                stance=stance,
                reasoning=reasoning,
                confidence=confidence,
                archetype=archetype,
                belief_before=belief_before,
                belief_after=stance,
            )
            turns.append(turn)
            if on_turn:
                on_turn(turn)
            graph.add_interaction(agent.id, group[(group.index(agent) + 1) % len(group)].id, 1.0)
    return turns
