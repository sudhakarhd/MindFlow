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


@app.post("/ai/generate")
def generate_ai(request: AIRequest):
    response = client.models.generate_content(
        model="gemini-flash-latest",
        contents=request.prompt,
    )

    return {
        "response": response.text
    }


@app.post("/ai/parse-receipt")
async def parse_receipt(request: AIRequest):
    try:
        image_url = request.prompt
        async with httpx.AsyncClient() as http_client:
            res = await http_client.get(image_url)
            if res.status_code != 200:
                raise HTTPException(status_code=400, detail="Failed to fetch image from URL")
            image_bytes = res.content

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                {
                    "inline_data": {
                        "mime_type": "image/jpeg",
                        "data": base64.b64encode(image_bytes).decode("utf-8")
                    }
                },
                "Extract receipt details in strict JSON format with keys: store_name (string), receipt_date (YYYY-MM-DD string), total_amount (number), and items (array of objects with name, price, and category where category must be one of: Produce, Dairy, Meat, Pantry, Household). Return ONLY valid JSON."
            ]
        )
        return {"response": response.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
