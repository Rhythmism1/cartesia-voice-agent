import asyncio
import json
import os
import requests
from typing import List, Any
from dotenv import load_dotenv

from fastapi import Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from passlib.context import CryptContext
from jose import jwt, JWTError
from datetime import datetime, timedelta

from motor.motor_asyncio import AsyncIOMotorClient  # MongoDB driver
from livekit import rtc
from livekit.agents import JobContext, WorkerOptions, cli, JobProcess
from livekit.agents.llm import ChatContext, ChatMessage
from livekit.agents.pipeline import VoicePipelineAgent
from livekit.agents.log import logger
from livekit.plugins import deepgram, silero, cartesia, openai
from fastapi.middleware.cors import CORSMiddleware


# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Replace with your frontend URL
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods
    allow_headers=["*"],  # Allow all headers
)
# Middleware for CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development; restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Password hashing and JWT settings
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# MongoDB connection
DATABASE_URL = os.getenv("MONGO_DB_URL", "mongodb+srv://username:password@cluster0.mongodb.net/mydatabase")
client = AsyncIOMotorClient(DATABASE_URL)
db = client.get_database("mydatabase")
users_collection = db.get_collection("users")

# Pydantic models
class LoginRequest(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str

class RegisterRequest(BaseModel):
    email: str
    password: str

class TestCodeUpdate(BaseModel):
    test_code: str

# Helper functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

http_bearer = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(http_bearer)):
    token = credentials.credentials  # Extract the token from the Authorization header
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if email is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return email
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )
# Authentication endpoints
@app.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest):
    user = await users_collection.find_one({"email": request.email})
    if not user or not verify_password(request.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    access_token = create_access_token(data={"sub": user["email"]}, expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/register")
async def register(request: RegisterRequest):
    user = await users_collection.find_one({"email": request.email})
    if user:
        raise HTTPException(status_code=400, detail="User already exists")

    hashed_password = pwd_context.hash(request.password)
    await users_collection.insert_one({"email": request.email, "password": hashed_password, "test_code": ""})
    return {"message": "User registered successfully"}

# Test code endpoints
@app.put("/setup/test-code")
async def update_test_code(data: TestCodeUpdate, user_email: str = Depends(get_current_user)):
    user = await users_collection.find_one({"email": user_email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    await users_collection.update_one({"email": user_email}, {"$set": {"test_code": data.test_code}})
    return {"message": "Test code updated successfully"}

@app.get("/setup/test-code")
async def get_test_code(user_email: str = Depends(get_current_user)):
    print(f"Fetching test code for user: {user_email}")  # Log user email
    user = await users_collection.find_one({"email": user_email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Safely retrieve the test code or default to an empty string
    test_code = user.get("test_code", "")
    print(f"Test code retrieved: {test_code}")  # Log the retrieved test code
    return {"test_code": test_code}

# Prewarm models for LiveKit
def prewarm(proc: JobProcess):
    proc.userdata["vad"] = silero.VAD.load()

    headers = {
        "X-API-Key": os.getenv("CARTESIA_API_KEY", ""),
        "Cartesia-Version": "2024-08-01",
        "Content-Type": "application/json",
    }
    response = requests.get("https://api.cartesia.ai/voices", headers=headers)
    if response.status_code == 200:
        proc.userdata["cartesia_voices"] = response.json()
    else:
        logger.warning(f"Failed to fetch Cartesia voices: {response.status_code}")

# LiveKit voice assistant entrypoint
async def entrypoint(ctx: JobContext):
    initial_ctx = ChatContext(
        messages=[
            ChatMessage(
                role="system",
                content="You are a voice assistant created by LiveKit. Your interface with users will be voice. Pretend we're having a conversation, no special formatting or headings, just natural speech.",
            )
        ]
    )
    cartesia_voices: List[dict[str, Any]] = ctx.proc.userdata["cartesia_voices"]

    tts = cartesia.TTS(voice="248be419-c632-4f23-adf1-5324ed7dbf1d")
    agent = VoicePipelineAgent(
        vad=ctx.proc.userdata["vad"],
        stt=deepgram.STT(),
        llm=openai.LLM(model="gpt-4o-mini"),
        tts=tts,
        chat_ctx=initial_ctx,
    )

    is_user_speaking = False
    is_agent_speaking = False

    @ctx.room.on("participant_attributes_changed")
    def on_participant_attributes_changed(changed_attributes: dict[str, str], participant: rtc.Participant):
        if participant.kind != rtc.ParticipantKind.PARTICIPANT_KIND_STANDARD:
            return

        if "voice" in changed_attributes:
            voice_id = participant.attributes.get("voice")
            if not voice_id:
                return

            voice_data = next((voice for voice in cartesia_voices if voice["id"] == voice_id), None)
            if not voice_data:
                return

            if "embedding" in voice_data:
                model = "sonic-english"
                language = "en"
                if "language" in voice_data and voice_data["language"] != "en":
                    language = voice_data["language"]
                    model = "sonic-multilingual"
                tts._opts.voice = voice_data["embedding"]
                tts._opts.model = model
                tts._opts.language = language
                if not (is_agent_speaking or is_user_speaking):
                    asyncio.create_task(agent.say("How do I sound now?", allow_interruptions=True))

    await ctx.connect()

    @agent.on("agent_started_speaking")
    def agent_started_speaking():
        nonlocal is_agent_speaking
        is_agent_speaking = True

    @agent.on("agent_stopped_speaking")
    def agent_stopped_speaking():
        nonlocal is_agent_speaking
        is_agent_speaking = False

    @agent.on("user_started_speaking")
    def user_started_speaking():
        nonlocal is_user_speaking
        is_user_speaking = True

    @agent.on("user_stopped_speaking")
    def user_stopped_speaking():
        nonlocal is_user_speaking
        is_user_speaking = False

    voices = [{"id": voice["id"], "name": voice["name"]} for voice in cartesia_voices]
    voices.sort(key=lambda x: x["name"])
    await ctx.room.local_participant.set_attributes({"voices": json.dumps(voices)})

    agent.start(ctx.room)
    await agent.say("Hi there, how are you doing today?", allow_interruptions=True)

# Run the FastAPI and LiveKit agent with multiprocessing
def run_fastapi():
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

def run_livekit_agent():
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, prewarm_fnc=prewarm))

if __name__ == "__main__":
    import multiprocessing
    multiprocessing.set_start_method("spawn")  # Explicitly set spawn method for macOS
    processes = [
        multiprocessing.Process(target=run_fastapi),
        multiprocessing.Process(target=run_livekit_agent),
    ]
    for process in processes:
        process.start()
    for process in processes:
        process.join()
