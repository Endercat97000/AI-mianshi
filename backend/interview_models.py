from typing import Literal
from pydantic import Field
from .schemas import InputModel

Difficulty = Literal["easy", "normal", "hard"]
ClaimState = Literal["UNKNOWN", "QUESTIONED", "SUPPORTED", "PARTIALLY_SUPPORTED", "CONTRADICTED", "INSUFFICIENT_EVIDENCE"]

class Capability(InputModel):
    name: str = Field(min_length=1, max_length=120)
    requirement_quote: str = Field(min_length=1, max_length=1000)
    reason: str = Field(min_length=1, max_length=1500)

class Fact(InputModel):
    category: Literal["education", "experience", "project", "skill", "credential"]
    summary: str = Field(min_length=1, max_length=1000)
    quote: str = Field(min_length=1, max_length=2000)

class Claim(InputModel):
    statement: str = Field(min_length=1, max_length=1000)
    quote: str = Field(min_length=1, max_length=2000)
    capability: str = Field(min_length=1, max_length=120)
    verification: str = Field(min_length=1, max_length=1500)

class Question(InputModel):
    question: str = Field(min_length=1, max_length=1500)
    capability: str = Field(min_length=1, max_length=120)
    resume_quote: str = Field(default="", max_length=2000)
    reason: str = Field(min_length=1, max_length=1500)
    difficulty: Difficulty = "normal"

class Flag(InputModel):
    observation: str = Field(min_length=1, max_length=1000)
    quote: str = Field(min_length=1, max_length=2000)
    verify: str = Field(min_length=1, max_length=1500)

class Competition(InputModel):
    name: str = Field(min_length=1, max_length=200)
    quote: str = Field(min_length=1, max_length=2000)
    edition_track: str = Field(min_length=1, max_length=500)
    award_level: str = Field(min_length=1, max_length=500)
    format: str = Field(min_length=1, max_length=500)
    selectivity: str = Field(min_length=1, max_length=1000)
    role_relevance: str = Field(min_length=1, max_length=1000)
    contribution: str = Field(min_length=1, max_length=1000)
    reference_value: str = Field(min_length=1, max_length=1000)
    unknowns: list[str] = Field(default_factory=list, max_length=8)
    suggested_question: str = Field(default="", max_length=1000)
    source_status: Literal["resume_only"] = "resume_only"

class Plan(InputModel):
    capabilities: list[Capability] = Field(min_length=1, max_length=15)
    resume_facts: list[Fact] = Field(default_factory=list, max_length=40)
    claims: list[Claim] = Field(default_factory=list, max_length=30)
    verification_flags: list[Flag] = Field(default_factory=list, max_length=20)
    questions: list[Question] = Field(min_length=1, max_length=12)
    competitions: list[Competition] = Field(default_factory=list, max_length=6)

class PlanRequest(InputModel):
    resume_id: int = Field(gt=0)
    privacy: bool = True
    skill_ids: list[str] = Field(default_factory=lambda: ["project-requirement", "question-design"], max_length=5)
    question_count: int = Field(default=5, ge=1, le=12)
    interview_style: Literal["conversational", "focused"] = "conversational"
    # Returned by preview. Generation rejects stale/unreviewed input.
    preview_hash: str = ""

class SessionCreate(InputModel):
    generation_id: int = Field(gt=0)
    budget: int = Field(default=8, ge=1, le=30)
    difficulty: Difficulty = "normal"
    opening: Literal["none", "introduction", "recent", "expectations"] = "none"

class ClaimUpdate(InputModel):
    claim_index: int = Field(ge=0)
    state: ClaimState
    answer_quote: str = Field(min_length=1, max_length=3000)
    reason: str = Field(min_length=1, max_length=1500)

class Analysis(InputModel):
    observation: str = Field(min_length=1, max_length=3000)
    answer_quote: str = Field(min_length=1, max_length=3000)
    updates: list[ClaimUpdate] = Field(default_factory=list, max_length=30)
    follow_up: Question | None = None

class AnswerRequest(InputModel):
    answer: str = Field(min_length=1, max_length=15000)
    revision: int = Field(ge=0)

class ReviewRequest(InputModel):
    state: ClaimState
    note: str = Field(min_length=1, max_length=2000)

class SessionOptions(InputModel):
    difficulty: Difficulty

class RevisionRequest(InputModel):
    revision: int = Field(ge=0)

class UseQuestionRequest(InputModel):
    revision: int = Field(ge=0)
    question: Question
