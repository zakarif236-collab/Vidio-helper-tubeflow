"""
Section Validator and Workflow Orchestrator
- Enforces SCRIPT/TEXT section rules
- Runs AI workflow if validation passes
"""
import re
from typing import Dict, Any

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

def run_workflow(audio_path: str = None, script: str = None, text: str = None, ai_endpoints: Dict[str, str] = None) -> Dict[str, Any]:
    """
    Orchestrates the AI workflow:
    - Transcribe audio/video with Whisper (if audio_path provided)
    - Process transcript/script with spaCy/NLTK
    - Summarize with Hugging Face
    - Returns structured output
    """
    import requests
    result = {}
    transcript = None
    if audio_path:
        with open(audio_path, 'rb') as f:
            resp = requests.post(ai_endpoints['transcribe'], files={'file': f})
            transcript = resp.json().get('transcript')
    elif script:
        transcript = script
    else:
        transcript = text
    # NLP processing
    nlp_resp = requests.post(ai_endpoints['nlp'], json={'text': transcript})
    nlp_data = nlp_resp.json()
    # Summarization
    sum_resp = requests.post(ai_endpoints['summarize'], json={'text': transcript})
    sum_data = sum_resp.json()
    # Compose output
    result['Transcript'] = transcript
    result['NLP'] = nlp_data
    result['Summaries'] = sum_data
    return result

# Example usage:
# validation_msg = validate_sections(script_input, text_input)
# if validation_msg:
#     print(validation_msg)
# else:
#     output = run_workflow(audio_path=None, script=script_input, text=text_input, ai_endpoints={...})
