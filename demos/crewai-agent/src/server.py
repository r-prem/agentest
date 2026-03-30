"""
FastAPI server that exposes a CrewAI agent as an OpenAI-compatible chat endpoint.

Start with:  python server.py
Or:          uvicorn server:app --reload --port 8123
"""
import os
import json

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from fastapi import FastAPI
from pydantic import BaseModel
from crewai import Agent, Task, Crew

from tools.calculator import calculator
from tools.weather import get_weather
from tools.file_reader import read_file
from tools.search import web_search

app = FastAPI()

tools = [calculator, get_weather, read_file, web_search]

agent = Agent(
    role="Helpful Assistant",
    goal="Answer user questions accurately using the available tools",
    backstory=(
        "You are a helpful assistant with access to a calculator, weather lookup, "
        "file reader, and web search. You MUST use the appropriate tool to answer "
        "questions — never guess or make up information."
    ),
    tools=tools,
    verbose=False,
)


class ChatRequest(BaseModel):
    messages: list[dict]


@app.post("/api/chat")
async def chat(request: ChatRequest):
    # Extract the latest user message as the task description
    user_messages = [m for m in request.messages if m.get("role") == "user"]
    user_input = user_messages[-1]["content"] if user_messages else "Hello"

    # Build context from prior messages
    context = ""
    for m in request.messages:
        role = m.get("role", "unknown")
        content = m.get("content", "")
        if role == "tool":
            tool_call_id = m.get("tool_call_id", "")
            context += f"[Tool result for {tool_call_id}]: {content}\n"
        elif role == "assistant" and m.get("tool_calls"):
            for tc in m["tool_calls"]:
                fn = tc.get("function", {})
                context += f"[Called {fn.get('name', '?')}({fn.get('arguments', '')})]\n"

    task = Task(
        description=f"{user_input}\n\nPrior context:\n{context}" if context else user_input,
        expected_output="A helpful, accurate answer using tool results",
        agent=agent,
    )

    crew = Crew(agents=[agent], tasks=[task], verbose=False)
    result = crew.kickoff()

    # Return in OpenAI chat completions format
    return {
        "choices": [
            {
                "message": {
                    "role": "assistant",
                    "content": str(result),
                }
            }
        ]
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8123)
