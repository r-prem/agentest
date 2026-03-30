from crewai.tools import tool


@tool("web_search")
def web_search(query: str, max_results: int = 3) -> str:
    """Search the web for information on a given query.

    Args:
        query: The search query.
        max_results: Maximum number of results to return (default: 3).
    """
    mock_results = [
        {"title": f"{query} - Wikipedia", "snippet": f"Overview article about {query} with detailed information."},
        {"title": f"Understanding {query} | Blog", "snippet": f"A comprehensive guide to {query} and its applications."},
        {"title": f"{query} explained simply", "snippet": f"Simple explanation of {query} for beginners."},
        {"title": f"Latest news on {query}", "snippet": f"Recent developments and updates related to {query}."},
        {"title": f"{query} - official docs", "snippet": f"Official documentation and reference for {query}."},
    ]

    lines = []
    for i, r in enumerate(mock_results[:max_results]):
        lines.append(f"{i + 1}. {r['title']}\n   {r['snippet']}")
    return "\n".join(lines)
