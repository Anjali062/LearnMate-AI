from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from google import genai
import os
import uuid

from pdf_utils import extract_text_from_pdf
from sse_starlette.sse import EventSourceResponse
import asyncio

# ---------------- LOAD ENV ----------------
load_dotenv()

# ---------------- APP ----------------
app = FastAPI()

# ---------------- CORS ----------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------- GEMINI CLIENT ----------------
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

MODEL = "gemini-1.5-flash"   # ✅ stable working model

# ---------------- MEMORY ----------------
pdf_content = ""
pdf_summary = ""


# ---------------- REQUEST ----------------
class Question(BaseModel):
    question: str


# ---------------- HOME ----------------
@app.get("/")
def home():
    return {"message": "LearnMate AI Running 🚀"}


# ---------------- SUMMARIZE TEXT ----------------
@app.post("/summarize")
def summarize(data: dict):
    try:
        text = data.get("text", "")

        if not text:
            return {"error": "No text provided"}

        prompt = f"""
Summarize in bullet points:

{text}
"""

        response = client.models.generate_content(
            model=MODEL,
            contents=prompt
        )

        return {"summary": response.text}

    except Exception as e:
        return {"error": str(e)}


# ---------------- UPLOAD PDF ----------------
@app.post("/upload-pdf")
async def upload_pdf(file: UploadFile = File(...)):
    global pdf_content, pdf_summary

    try:
        file_path = f"temp_{uuid.uuid4()}.pdf"

        with open(file_path, "wb") as f:
            f.write(await file.read())

        text = extract_text_from_pdf(file_path)
        os.remove(file_path)

        if not text:
            return {"error": "No text found in PDF"}

        pdf_content = text

        prompt = f"""
Summarize this PDF:

{text[:6000]}
"""

        response = client.models.generate_content(
            model=MODEL,
            contents=prompt
        )

        pdf_summary = response.text

        return {"summary": pdf_summary}

    except Exception as e:
        return {"error": str(e)}


# ---------------- GET SUMMARY ----------------
@app.get("/pdf-summary")
def get_summary():
    if not pdf_summary:
        return {"error": "No PDF uploaded"}

    return {"summary": pdf_summary}


# ---------------- CHAT WITH PDF ----------------
@app.post("/chat-pdf")
def chat_pdf(data: dict):
    try:
        question = data.get("question", "")

        if not pdf_content:
            return {"error": "Upload PDF first"}

        prompt = f"""
Answer ONLY from PDF:

PDF:
{pdf_content[:8000]}

Question:
{question}
"""

        response = client.models.generate_content(
            model=MODEL,
            contents=prompt
        )

        return {"answer": response.text}

    except Exception as e:
        return {"error": str(e)}


# ---------------- QUIZ ----------------
@app.get("/generate-quiz")
def generate_quiz():
    try:
        if not pdf_content:
            return {"error": "Upload PDF first"}

        prompt = f"""
Create 5 MCQs in JSON format:

[
  {{
    "question": "...",
    "options": ["A", "B", "C", "D"],
    "answer": "A"
  }}
]

PDF:
{pdf_content[:6000]}
"""

        response = client.models.generate_content(
            model=MODEL,
            contents=prompt
        )

        return {"quiz": response.text}

    except Exception as e:
        return {"error": str(e)}
@app.post("/chat-stream")
async def chat_stream(data: dict):
    question = data.get("question", "")

    if not pdf_content:
        return {"error": "No PDF uploaded"}

    prompt = f"""
Answer ONLY from PDF content:

PDF:
{pdf_content[:8000]}

Question:
{question}
"""

    async def event_generator():
        try:
            response = client.models.generate_content(
                model="gemini-1.5-flash",
                contents=prompt,
            )

            # simulate streaming (Gemini SDK doesn't true-stream in all versions)
            text = response.text

            for word in text.split(" "):
                yield f"data: {word} \n\n"
                await asyncio.sleep(0.03)

            yield "data: [DONE]\n\n"

        except Exception as e:
            yield f"data: ERROR: {str(e)}\n\n"

    return EventSourceResponse(event_generator())