# Whisper, spaCy, NLTK, and Hugging Face API
# FastAPI microservice for transcription, NLP, and summarization

from fastapi import FastAPI, File, UploadFile, Form
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import uvicorn
import os

# Whisper
import whisper

# spaCy & NLTK
import spacy
import nltk
from nltk.tokenize import sent_tokenize, word_tokenize
from nltk.stem import PorterStemmer

# Hugging Face Transformers
from transformers import pipeline

# Download NLTK data if not present
nltk.download('punkt')

# Load models
whisper_model = whisper.load_model('base')
nlp = spacy.load('en_core_web_sm')
summarizer = pipeline('summarization', model='facebook/bart-large-cnn')

app = FastAPI()

class TextRequest(BaseModel):
    text: str

@app.post('/transcribe')
def transcribe(file: UploadFile = File(...)):
    temp_path = f"temp_{file.filename}"
    with open(temp_path, 'wb') as f:
        f.write(file.file.read())
    result = whisper_model.transcribe(temp_path)
    os.remove(temp_path)
    return {"transcript": result['text']}

@app.post('/nlp')
def nlp_process(req: TextRequest):
    text = req.text
    doc = nlp(text)
    sentences = [sent.text for sent in doc.sents]
    words = [token.text for token in doc]
    entities = [(ent.text, ent.label_) for ent in doc.ents]
    stems = [PorterStemmer().stem(w) for w in word_tokenize(text)]
    return {
        "sentences": sentences,
        "words": words,
        "entities": entities,
        "stems": stems
    }

@app.post('/summarize')
def summarize(req: TextRequest):
    text = req.text
    # Layered summaries
    short = summarizer(text, max_length=30, min_length=10, do_sample=False)[0]['summary_text']
    medium = summarizer(text, max_length=60, min_length=30, do_sample=False)[0]['summary_text']
    detailed = summarizer(text, max_length=120, min_length=60, do_sample=False)[0]['summary_text']
    return {
        "short": short,
        "medium": medium,
        "detailed": detailed
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
