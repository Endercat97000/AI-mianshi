from typing import Literal
from pydantic import BaseModel, ConfigDict, Field

class InputModel(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

class ProjectCreate(InputModel):
    kind: Literal["project", "jd"] = "project"
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1, max_length=50000)

class CandidateCreate(InputModel):
    project_id: int = Field(gt=0)
    name: str = Field(min_length=1, max_length=100)
    role: str = Field(min_length=1, max_length=200)
    notes: str = Field(default="", max_length=10000)

class SettingsUpdate(InputModel):
    provider: Literal["openai", "deepseek", "openrouter", "ollama", "custom"]
    base_url: str = Field(default="", max_length=2000)
    model: str = Field(default="", max_length=200)
    # null retains the existing key; empty string deletes it.
    api_key: str | None = Field(default=None, max_length=4000)
