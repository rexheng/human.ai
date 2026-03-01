"""
Optional Strands Swarm for policy debate: multiple specialist agents (researcher, critic, synthesizer)
collaborate to simulate a structured debate. Used when USE_STRANDS_SWARM=1 and Strands is installed.
"""
import logging
import os
from typing import Any, Dict, Optional

log = logging.getLogger(__name__)


def run_policy_debate_swarm(scenario: str, max_handoffs: int = 12) -> Optional[Dict[str, Any]]:
    """
    Run a Strands Swarm of specialist agents debating the policy scenario.
    Returns a dict with summary, positions, and key arguments, or None if Swarm unavailable.
    """
    if os.getenv("USE_STRANDS_SWARM", "0").lower() not in {"1", "true", "yes"}:
        return None
    try:
        from strands import Agent
        from strands.multiagent import Swarm
        from strands.models import BedrockModel
    except Exception as e:
        log.debug("Strands Swarm import skipped: %s", e)
        return None

    region_name = os.getenv("BEDROCK_REGION", "us-east-1")
    model_id = os.getenv("STRANDS_MODEL_ID", "us.anthropic.claude-sonnet-4-20250514-v1:0")
    try:
        model = BedrockModel(model_id=model_id, region_name=region_name, temperature=0.5)
    except Exception as e:
        log.warning("Strands BedrockModel init failed: %s", e)
        return None

    researcher = Agent(
        name="researcher",
        model=model,
        system_prompt="You are a policy researcher. Summarise the scenario, list key facts and stakeholders, and possible outcomes. Be concise.",
    )
    critic = Agent(
        name="critic",
        model=model,
        system_prompt="You are a critical analyst. Challenge assumptions, point out risks and trade-offs, and alternative interpretations. Be concise.",
    )
    synthesizer = Agent(
        name="synthesizer",
        model=model,
        system_prompt="You are a synthesizer. Summarise the debate so far, note areas of agreement and disagreement, and give a short conclusion with support / oppose / undecided lean. Be concise.",
    )

    swarm = Swarm(
        [researcher, critic, synthesizer],
        entry_point=researcher,
        max_handoffs=max_handoffs,
        max_iterations=max_handoffs,
        execution_timeout=120.0,
        node_timeout=45.0,
    )

    task = f"Policy scenario to debate:\n\n{scenario}\n\nFirst, research the scenario. Then hand off to the critic to challenge. Finally, hand off to the synthesizer to summarise and conclude with a stance (support, oppose, or undecided)."
    try:
        result = swarm(task)
        status = getattr(result, "status", None)
        final = getattr(result, "result", None) or getattr(result, "message", None) or str(result)
        return {
            "status": str(status),
            "summary": final[:2000] if final else "",
            "node_history": [getattr(n, "node_id", str(n)) for n in getattr(result, "node_history", [])],
        }
    except Exception as e:
        log.warning("Strands Swarm execution failed: %s", e)
        return None
