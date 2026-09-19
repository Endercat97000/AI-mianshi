import re

def redact(text: str, name: str = "") -> str:
    if name:
        text = text.replace(name, "<CANDIDATE>")
    text = re.sub(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", "<EMAIL>", text)
    text = re.sub(r"(?<!\w)\d{17}[0-9Xx](?!\w)", "<ID>", text)
    text = re.sub(r"(?<!\d)(?:\+?86[-\s]?)?1[3-9](?:\d[-\s]?){9}(?!\d)", "<PHONE>", text)
    text = re.sub(r"(?im)(地址|住址|address)\s*[:：].*", r"\1：<ADDRESS>", text)
    return text
