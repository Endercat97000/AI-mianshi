import datetime
import re
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator

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
    # Local calendar date on which the candidate is scheduled to interview (YYYY-MM-DD); null = unscheduled.
    interview_date: str | None = Field(default=None, max_length=10)

    @field_validator("interview_date")
    @classmethod
    def _valid_interview_date(cls, value: str | None):
        if value is None or value == "":
            return None
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
            raise ValueError("面试日期格式应为 YYYY-MM-DD")
        datetime.date.fromisoformat(value)  # rejects impossible dates such as 2026-02-30
        return value

class SettingsUpdate(InputModel):
    provider: Literal["openai", "deepseek", "openrouter", "ollama", "custom"]
    base_url: str = Field(default="", max_length=2000)
    model: str = Field(default="", max_length=200)
    # null retains the existing key; empty string deletes it.
    api_key: str | None = Field(default=None, max_length=4000)
