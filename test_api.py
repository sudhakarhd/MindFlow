import os
from dotenv import load_dotenv
from google import genai

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    raise RuntimeError("GEMINI_API_KEY is not set")

client = genai.Client(api_key=api_key)

response = client.models.generate_content(
    model="gemini-flash-latest",
    contents=(
        "Give me a one-sentence reminder for an adult "
        "to drink water and take a one-minute breathing pause."
    ),
)

print("\n--- AI RESPONSE ---")
print(response.text)
print("-------------------")