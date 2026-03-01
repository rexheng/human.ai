"""
Generate a population of personas using AWS Bedrock (Mistral).
"""
import json
import logging
import re
from typing import List

from .persona import Persona, OceanTraits
from llm.bedrock_client import BedrockClient

log = logging.getLogger(__name__)


SYSTEM = """You are a demographic and psychology expert. Generate realistic, diverse personas as JSON only."""

PROMPT_TEMPLATE = """Generate exactly {population_size} distinct personas for a social simulation about this scenario:

Scenario: {scenario}

For each person output a JSON object with:
- name (first name only)
- age (18-75)
- occupation (one short phrase)
- income_bracket (e.g. "low", "medium", "high", "very high")
- political_leaning (e.g. "left", "centre-left", "centre", "centre-right", "right")
- location (UK city or region)
- ocean: object with openness, conscientiousness, extraversion, agreeableness, neuroticism (each 1-10 number)

Return ONLY a JSON array of {population_size} objects, no markdown or explanation. Example:
[{{"name":"Jane","age":34,"occupation":"teacher","income_bracket":"medium","political_leaning":"centre-left","location":"Manchester","ocean":{{"openness":7,"conscientiousness":6,"extraversion":5,"agreeableness":8,"neuroticism":4}}}}]
"""


def _parse_ocean(obj: dict) -> OceanTraits:
    o = obj.get("ocean") or {}
    return OceanTraits(
        openness=float(o.get("openness", 5)),
        conscientiousness=float(o.get("conscientiousness", 5)),
        extraversion=float(o.get("extraversion", 5)),
        agreeableness=float(o.get("agreeableness", 5)),
        neuroticism=float(o.get("neuroticism", 5)),
    )


def generate_agents(
    scenario: str,
    population_size: int,
    bedrock: BedrockClient,
) -> List[Persona]:
    prompt = PROMPT_TEMPLATE.format(
        scenario=scenario,
        population_size=min(population_size, 50),
    )
    try:
        raw = bedrock.invoke(
            prompt=prompt,
            system=SYSTEM,
            max_tokens=4096,
            temperature=0.8,
        )
    except Exception as e:
        log.warning("Bedrock persona generation failed, using fallback: %s", e)
        return _fallback_personas(population_size)
    raw = re.sub(r"^```\w*\n?", "", raw)
    raw = re.sub(r"\n?```\s*$", "", raw)
    raw = raw.strip()
    try:
        arr = json.loads(raw)
    except json.JSONDecodeError as e:
        log.warning("Bedrock response JSON parse failed, using fallback: %s", e)
        return _fallback_personas(population_size)
    out: List[Persona] = []
    for i, obj in enumerate(arr[:population_size]):
        if not isinstance(obj, dict):
            continue
        try:
            ocean = _parse_ocean(obj)
            p = Persona(
                name=str(obj.get("name", f"Agent_{i+1}")),
                age=int(obj.get("age", 35)),
                occupation=str(obj.get("occupation", "worker")),
                income_bracket=str(obj.get("income_bracket", "medium")),
                political_leaning=str(obj.get("political_leaning", "centre")),
                location=str(obj.get("location", "London")),
                ocean=ocean,
            )
            out.append(p)
        except Exception:
            continue
    while len(out) < population_size:
        out.extend(_fallback_personas(min(population_size - len(out), 5)))
    _rebalance_leanings_if_collapsed(out)
    return out[:population_size]


def _fallback_personas(n: int) -> List[Persona]:
    names = ["Alex", "Sam", "Jordan", "Morgan", "Casey", "Riley", "Quinn", "Avery", "Parker", "Drew"]
    jobs = ["teacher", "nurse", "developer", "driver", "retail worker"]
    locations = ["London", "Manchester", "Birmingham", "Leeds", "Bristol"]
    leanings = ["left", "centre-left", "centre", "centre-right", "right"]
    incomes = ["low", "medium", "high", "very high"]
    out = []
    for i in range(n):
        out.append(
            Persona(
                name=names[i % len(names)] + str(i),
                age=28 + (i % 40),
                occupation=jobs[i % len(jobs)],
                income_bracket=incomes[i % len(incomes)],
                political_leaning=leanings[i % len(leanings)],
                location=locations[i % len(locations)],
                ocean=OceanTraits(
                    openness=4 + (i % 6),
                    conscientiousness=4 + ((i + 2) % 6),
                    extraversion=3 + ((i + 3) % 7),
                    agreeableness=3 + ((i + 4) % 7),
                    neuroticism=2 + ((i + 5) % 8),
                ),
            )
        )
    return out


def _rebalance_leanings_if_collapsed(personas: List[Persona]) -> None:
    if not personas:
        return
    leanings = [str(p.political_leaning or "").strip().lower() for p in personas]
    unique = {l for l in leanings if l}
    if len(unique) > 1:
        return
    cycle = ["left", "centre-left", "centre", "centre-right", "right"]
    for i, p in enumerate(personas):
        p.political_leaning = cycle[i % len(cycle)]
