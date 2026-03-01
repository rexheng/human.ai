"""
Pydantic models for agent personas and OCEAN traits.
"""
from typing import Optional
from pydantic import BaseModel, Field


class OceanTraits(BaseModel):
    openness: float = Field(ge=0, le=10, description="1-10")
    conscientiousness: float = Field(ge=0, le=10, description="1-10")
    extraversion: float = Field(ge=0, le=10, description="1-10")
    agreeableness: float = Field(ge=0, le=10, description="1-10")
    neuroticism: float = Field(ge=0, le=10, description="1-10")


class Persona(BaseModel):
    name: str
    age: int = Field(ge=18, le=90)
    occupation: str
    income_bracket: str
    political_leaning: str
    location: str
    ocean: OceanTraits = Field(default_factory=lambda: OceanTraits(openness=5, conscientiousness=5, extraversion=5, agreeableness=5, neuroticism=5))


class AgentState(BaseModel):
    """Agent with id and mutable belief state."""
    id: str
    persona: Persona
    belief: str = "undecided"  # support | oppose | undecided
    confidence: float = 0.5  # 0-1
    conversation_history: list[dict] = Field(default_factory=list)

    class Config:
        arbitrary_types_allowed = True
