import os

from dotenv import load_dotenv
from fastapi import FastAPI
from pydantic import BaseModel
from google import genai

load_dotenv()

app = FastAPI(title="MindFlow API")

api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    raise RuntimeError("GEMINI_API_KEY is not configured")

client = genai.Client(api_key=api_key)


class AIRequest(BaseModel):
    prompt: str


@app.get("/")
def root():
    return {"message": "MindFlow API is running"}


@app.post("/ai/generate")
def generate_ai(request: AIRequest):
    response = client.models.generate_content(
        model="gemini-flash-latest",
        contents=request.prompt,
    )

    return {
        "response": response.text
    }