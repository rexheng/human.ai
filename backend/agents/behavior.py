"""
Agent behavior: prompt and call LLM so agent responds in character.
Supports Strands Agent invocation first, then Bedrock/Mistral, then deterministic fallback.
"""
import json
import logging
import os
import re
from typing import Any, Dict, List

from .persona import AgentState
from llm.bedrock_client import BedrockClient

log = logging.getLogger(__name__)


BEHAVIOR_SYSTEM = """You are simulating a human persona in a policy discussion. Stay in character. Reply briefly and naturally."""

BEHAVIOR_PROMPT = """Persona:
Name: {name}, Age: {age}
Occupation: {occupation}
Income: {income_bracket}
Political leaning: {political_leaning}
Location: {location}
Personality (1-10): openness={openness}, conscientiousness={conscientiousness}, extraversion={extraversion}, agreeableness={agreeableness}, neuroticism={neuroticism}

Scenario:
{scenario}

Conversation so far with other agents:
{messages}

Respond as this person would: one short paragraph of opinion, then exactly one of: SUPPORT, OPPOSE, or UNDECIDED."""

STRANDS_BEHAVIOR_PROMPT = """You are simulating one human in a social debate.
Return JSON only with keys:
- message: short first-person opinion sentence (8-35 words)
- stance: one of support, oppose, undecided
- reasoning: one concise explanation for your stance
- confidence: number from 0.35 to 0.95

Persona:
Name={name}, age={age}, occupation={occupation}, income={income_bracket}, political={political_leaning}, location={location}
OCEAN: O={openness}, C={conscientiousness}, E={extraversion}, A={agreeableness}, N={neuroticism}

Scenario:
{scenario}

Recent discussion:
{messages}
"""


def _format_messages(history: List[dict]) -> str:
    if not history:
        return "(No messages yet.)"
    lines = []
    for m in history[-15:]:
        who = m.get("agent_name", m.get("name", "Agent"))
        msg = m.get("message", m.get("content", ""))
        lines.append(f"- {who}: {msg}")
    return "\n".join(lines)


def _derive_archetype(agent: AgentState) -> str:
    o = agent.persona.ocean
    scores = {
        "Visionary Analyst": o.openness * 0.6 + o.conscientiousness * 0.4,
        "Pragmatic Skeptic": (10 - o.openness) * 0.6 + (10 - o.agreeableness) * 0.4,
        "Community Builder": o.agreeableness * 0.55 + o.extraversion * 0.45,
        "Cautious Realist": o.neuroticism * 0.6 + o.conscientiousness * 0.4,
        "Independent Challenger": (10 - o.agreeableness) * 0.55 + o.extraversion * 0.45,
    }
    return max(scores, key=scores.get)


def _estimate_confidence(agent: AgentState, stance: str) -> float:
    o = agent.persona.ocean
    base = 0.45 + (o.conscientiousness / 10.0) * 0.22 + (o.extraversion / 10.0) * 0.12 - (o.neuroticism / 10.0) * 0.16
    if stance == "undecided":
        base -= 0.08
    return round(max(0.35, min(0.95, base)), 2)


def _fallback_opinion(agent: AgentState, scenario: str) -> Dict[str, Any]:
    p = agent.persona
    leaning = (p.political_leaning or "").lower()
    key = sum(ord(c) for c in (p.name + scenario))
    left_templates = [
        "I support this if it protects vulnerable people and includes accountability.",
        "This looks worthwhile, but we should pair it with fairness safeguards.",
        "I am broadly in favor because the social benefits seem meaningful.",
    ]
    right_templates = [
        "I oppose this because it could overreach and create avoidable side effects.",
        "This seems too costly for uncertain gains, so I would reject it.",
        "I am against it unless there is stronger proof it will work as promised.",
    ]
    center_templates = [
        "I can see both sides and would need clearer evidence before deciding.",
        "I am undecided right now because the trade-offs are still unclear.",
        "I need more detail on cost and impact before I can commit either way.",
    ]

    if "left" in leaning:
        stance = "support"
        message = left_templates[key % len(left_templates)]
    elif "right" in leaning:
        stance = "oppose"
        message = right_templates[key % len(right_templates)]
    else:
        mode = key % 3
        if mode == 0:
            stance = "support"
            message = left_templates[key % len(left_templates)]
        elif mode == 1:
            stance = "oppose"
            message = right_templates[key % len(right_templates)]
        else:
            stance = "undecided"
            message = center_templates[key % len(center_templates)]

    reasoning_by_stance = {
        "support": "I expect net social benefit if rollout is monitored and adjusted quickly.",
        "oppose": "The downside risk and cost burden appear larger than the likely upside right now.",
        "undecided": "Current evidence is mixed, so I need clearer trade-off data before committing.",
    }
    confidence = _estimate_confidence(agent, stance)
    return {
        "message": message,
        "stance": stance,
        "reasoning": reasoning_by_stance[stance],
        "confidence": confidence,
        "archetype": _derive_archetype(agent),
        "thinking": f"{p.name} weighs household impact, fairness, and feasibility before speaking.",
    }


def _extract_json(text: str) -> Dict[str, Any]:
    cleaned = re.sub(r"^```(?:json)?\s*", "", text.strip(), flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        return json.loads(cleaned)
    except Exception:
        pass
    match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except Exception:
            return {}
    return {}


def _invoke_with_strands(prompt: str) -> Dict[str, Any]:
    if os.getenv("USE_STRANDS_AGENTS", "1").lower() not in {"1", "true", "yes"}:
        return {}
    try:
        from strands import Agent as StrandsAgent
        from strands.models import BedrockModel
    except Exception as e:
        log.debug("Strands import skipped: %s", e)
        return {}

    model_id = os.getenv("STRANDS_MODEL_ID", "us.anthropic.claude-sonnet-4-20250514-v1:0")
    region_name = os.getenv("BEDROCK_REGION", "us-east-1")
    try:
        model = BedrockModel(model_id=model_id, region_name=region_name, temperature=0.4)
        strands_agent = StrandsAgent(model=model, callback_handler=None)
        result = strands_agent(prompt)
        raw = getattr(result, "message", None) or str(result)
        return _extract_json(str(raw))
    except Exception as e:
        log.warning("Strands agent invoke failed: %s", e)
        return {}


def _normalize_detail(agent: AgentState, raw_text: str, parsed: Dict[str, Any]) -> Dict[str, Any]:
    stance = str(parsed.get("stance", "")).strip().lower()
    if stance not in {"support", "oppose", "undecided"}:
        stance = "undecided"
    message = str(parsed.get("message", "")).strip()
    reasoning = str(parsed.get("reasoning", "")).strip()
    confidence = parsed.get("confidence")
    try:
        confidence = float(confidence)
    except Exception:
        confidence = _estimate_confidence(agent, stance)
    confidence = round(max(0.35, min(0.95, confidence)), 2)
    if not message:
        message = raw_text.strip()[:280] if raw_text else f"{agent.persona.name} expresses their view."
    if not reasoning:
        reasoning = "The agent balances personal risk, social value, and practical feasibility."
    return {
        "message": message[:500],
        "stance": stance,
        "reasoning": reasoning[:400],
        "confidence": confidence,
        "archetype": _derive_archetype(agent),
        "thinking": f"{agent.persona.name} updates priors from nearby peers and local cost pressure.",
    }


def get_agent_response_detail(
    agent: AgentState,
    scenario: str,
    conversation_messages: List[dict],
    bedrock: BedrockClient,
) -> Dict[str, Any]:
    # Fast simulation: skip LLM, use deterministic fallback so rounds finish in seconds
    if os.getenv("USE_FAST_SIMULATION", "0").lower() in {"1", "true", "yes"}:
        return _fallback_opinion(agent, scenario)

    p = agent.persona
    o = p.ocean
    messages = _format_messages(conversation_messages)

    strands_prompt = STRANDS_BEHAVIOR_PROMPT.format(
        name=p.name,
        age=p.age,
        occupation=p.occupation,
        income_bracket=p.income_bracket,
        political_leaning=p.political_leaning,
        location=p.location,
        openness=o.openness,
        conscientiousness=o.conscientiousness,
        extraversion=o.extraversion,
        agreeableness=o.agreeableness,
        neuroticism=o.neuroticism,
        scenario=scenario,
        messages=messages,
    )
    parsed = _invoke_with_strands(strands_prompt)
    if parsed:
        return _normalize_detail(agent, "", parsed)

    prompt = BEHAVIOR_PROMPT.format(
        name=p.name,
        age=p.age,
        occupation=p.occupation,
        income_bracket=p.income_bracket,
        political_leaning=p.political_leaning,
        location=p.location,
        openness=o.openness,
        conscientiousness=o.conscientiousness,
        extraversion=o.extraversion,
        agreeableness=o.agreeableness,
        neuroticism=o.neuroticism,
        scenario=scenario,
        messages=messages,
    )
    try:
        raw = bedrock.invoke(
            prompt=prompt,
            system=BEHAVIOR_SYSTEM,
            max_tokens=300,
            temperature=0.7,
        )
    except Exception as e:
        log.warning("Bedrock behavior invoke failed: %s", e)
        return _fallback_opinion(agent, scenario)

    text = (raw or "").strip()
    if not text:
        return _fallback_opinion(agent, scenario)

    matches = list(re.finditer(r"\b(SUPPORT|OPPOSE|UNDECIDED)\b", text, flags=re.IGNORECASE))
    stance = "undecided"
    message = text
    if matches:
        token = matches[-1].group(1).lower()
        stance = "support" if token == "support" else "oppose" if token == "oppose" else "undecided"
        last = matches[-1]
        message = (text[: last.start()] + text[last.end() :]).strip(" \n:-")
    if not message or len(message) < 10:
        message = f"{p.name} expresses their view."

    return _normalize_detail(agent, message, {"stance": stance, "message": message})


def get_agent_response(
    agent: AgentState,
    scenario: str,
    conversation_messages: List[dict],
    bedrock: BedrockClient,
) -> tuple[str, str]:
    detail = get_agent_response_detail(agent, scenario, conversation_messages, bedrock)
    return str(detail.get("message", "")), str(detail.get("stance", "undecided"))
