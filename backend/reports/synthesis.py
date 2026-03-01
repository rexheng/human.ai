"""
Synthesize final report from all agent interactions and decisions using Mistral.
"""
import json
import re
from typing import List, Dict, Any

from llm.bedrock_client import BedrockClient


REPORT_SYSTEM = """You are an analyst summarizing the outcome of a simulated policy discussion. Output valid JSON only."""

REPORT_PROMPT = """Given these agent interactions and final beliefs, produce a short analytical report as JSON.

Interactions (sample):
{interactions_text}

Final beliefs per agent:
{beliefs_text}

Return a single JSON object with these exact keys:
- consensus_level: string (e.g. "low", "medium", "high")
- major_arguments: array of strings (2-4 short summary arguments)
- disagreement_clusters: array of strings (e.g. "urban vs rural", "left vs right")
- predicted_policy_support: string (e.g. "45% support, 30% oppose, 25% undecided")

Output only the JSON object, no markdown."""


def synthesize_report(
    conversation_history: List[dict],
    final_beliefs: List[dict],
    bedrock: BedrockClient,
) -> Dict[str, Any]:
    interactions_text = "\n".join(
        f"{h.get('agent_name', '')}: {h.get('message', '')} -> {h.get('stance', '')}"
        for h in conversation_history[:80]
    )
    beliefs_text = "\n".join(
        f"{b.get('agent_name', '')}: {b.get('belief', '')}"
        for b in final_beliefs
    )
    prompt = REPORT_PROMPT.format(
        interactions_text=interactions_text or "(none)",
        beliefs_text=beliefs_text or "(none)",
    )
    try:
        raw = bedrock.invoke(
            prompt=prompt,
            system=REPORT_SYSTEM,
            max_tokens=1024,
            temperature=0.3,
        )
        raw = re.sub(r"^```\w*\n?", "", raw)
        raw = re.sub(r"\n?```\s*$", "", raw)
        raw = raw.strip()
        return json.loads(raw)
    except Exception:
        support = sum(1 for b in final_beliefs if b.get("belief") == "support")
        oppose = sum(1 for b in final_beliefs if b.get("belief") == "oppose")
        n = len(final_beliefs) or 1
        return {
            "consensus_level": "low",
            "major_arguments": ["Insufficient data for full synthesis."],
            "disagreement_clusters": [],
            "predicted_policy_support": f"{100*support//n}% support, {100*oppose//n}% oppose, {100*(n-support-oppose)//n}% undecided",
        }
