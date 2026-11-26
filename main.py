import os
import base64
import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
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


import time
import random

def call_gemini_with_retry(contents, models=["gemini-2.5-flash", "gemini-flash-latest", "gemini-1.5-flash"]):
    last_exception = None
    for model in models:
        for attempt in range(3):
            try:
                response = client.models.generate_content(
                    model=model,
                    contents=contents,
                )
                return response
            except Exception as e:
                err_str = str(e)
                last_exception = e
                if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str or "503" in err_str:
                    sleep_time = (2 ** attempt) + random.uniform(0.1, 0.5)
                    time.sleep(sleep_time)
                    continue
                else:
                    break
    if last_exception:
        raise last_exception
    raise RuntimeError("Failed to generate content from Gemini API after retries.")


@app.post("/ai/generate")
def generate_ai(request: AIRequest):
    try:
        response = call_gemini_with_retry(request.prompt)
        return {
            "response": response.text
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ai/parse-receipt")
async def parse_receipt(request: AIRequest):
    try:
        image_url = request.prompt
        async with httpx.AsyncClient() as http_client:
            res = await http_client.get(image_url)
            if res.status_code != 200:
                raise HTTPException(status_code=400, detail="Failed to fetch image from URL")
            image_bytes = res.content

        contents = [
            {
                "inline_data": {
                    "mime_type": "image/jpeg",
                    "data": base64.b64encode(image_bytes).decode("utf-8")
                }
            },
            "Extract receipt details in strict JSON format with keys: store_name (string), receipt_date (YYYY-MM-DD string), total_amount (number), and items (array of objects with name, price, and category where category must be one of: Produce, Dairy, Meat, Pantry, Household). Return ONLY valid JSON."
        ]

        response = call_gemini_with_retry(contents, models=["gemini-2.5-flash", "gemini-flash-latest", "gemini-1.5-flash"])
        return {"response": response.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
