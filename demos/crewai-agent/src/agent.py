from crewai import Agent

from tools.calculator import calculator
from tools.weather import get_weather
from tools.file_reader import read_file
from tools.search import web_search

tools = [calculator, get_weather, read_file, web_search]

assistant = Agent(
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
