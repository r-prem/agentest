from crewai.tools import tool

MOCK_WEATHER = {
    "new york": {"temp": 62, "condition": "Partly cloudy"},
    "london": {"temp": 55, "condition": "Rainy"},
    "paris": {"temp": 68, "condition": "Sunny"},
    "tokyo": {"temp": 72, "condition": "Clear"},
    "sydney": {"temp": 78, "condition": "Warm and humid"},
    "san francisco": {"temp": 59, "condition": "Foggy"},
}


@tool("get_weather")
def get_weather(city: str) -> str:
    """Get the current weather for a given city.

    Args:
        city: The city name to look up weather for.
    """
    data = MOCK_WEATHER.get(city.lower())
    if data:
        return f"{city}: {data['temp']}°F, {data['condition']}"
    return f"{city}: 65°F, Mild (no specific data available)"
