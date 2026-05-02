"""
Section Validator and Workflow Orchestrator
- Enforces SCRIPT/TEXT section rules
- Runs AI workflow if validation passes
"""
import re

def is_code(text: str) -> bool:
    # Simple heuristic: code-like lines (e.g., def, import, function, var, etc.)
    code_patterns = [r'^\s*(def |import |from |function |let |const |var |class |#include |public |private |if |for |while |return )']
    return any(re.search(p, text, re.MULTILINE) for p in code_patterns)

def validate_sections(script: str, text: str) -> str:
    if script.strip() and not is_code(script):
        return "Text is not required in the SCRIPT section. Please move your text to the TEXT section or rewrite it as valid script."
    if text.strip() and is_code(text):
        return "Script is not required in the TEXT section. Please move your script to the SCRIPT section or rewrite it as descriptive text."
    return ""

