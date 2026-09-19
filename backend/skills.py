import hashlib
import re
from .database import ROOT

SKILLS_DIR = ROOT / "skills"

def read_skill(identifier: str):
    if not re.fullmatch(r"[a-z0-9-]{1,60}", identifier):
        raise ValueError("无效的 Skill 名称。")
    root = SKILLS_DIR.resolve()
    path = (root / identifier / "SKILL.md").resolve()
    if not path.is_relative_to(root) or not path.is_file():
        raise ValueError("Skill 不存在。")
    if path.stat().st_size > 30000:
        raise ValueError("Skill 文件超过 30 KB。")
    content = path.read_text(encoding="utf-8")
    return {"id": identifier, "content": content, "version": hashlib.sha256(content.encode()).hexdigest()[:16]}

def list_skills():
    result = []
    for path in sorted(SKILLS_DIR.glob("*/SKILL.md")):
        try:
            result.append(read_skill(path.parent.name))
        except (ValueError, OSError):
            continue
    return result

def write_skill(identifier: str, description: str, content: str):
    if not re.fullmatch(r"[a-z0-9-]{1,60}", identifier):
        raise ValueError("Skill 名称只能用小写字母、数字和短横线（如 frontend-react）。")
    if not description.strip():
        raise ValueError("请填写规则描述。")
    if not content.strip():
        raise ValueError("请填写规则内容。")
    folder = SKILLS_DIR / identifier
    folder.mkdir(parents=True, exist_ok=True)
    md = f"---\nname: {identifier}\ndescription: {description.strip()}\n---\n\n{content.strip()}\n"
    (folder / "SKILL.md").write_text(md, encoding="utf-8")
    return read_skill(identifier)
