from pathlib import Path

from crewai.tools import tool


@tool("read_file")
def read_file(file_path: str) -> str:
    """Read the contents of a local file given its path.

    Args:
        file_path: Path to the file to read.
    """
    try:
        content = Path(file_path).resolve().read_text()
        if len(content) > 2000:
            return content[:2000] + "\n... (truncated)"
        return content
    except Exception as e:
        return f"Error reading file: {e}"
