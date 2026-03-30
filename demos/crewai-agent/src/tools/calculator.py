from crewai.tools import tool


@tool("calculator")
def calculator(a: float, b: float, operation: str) -> str:
    """Perform basic arithmetic operations (add, subtract, multiply, divide).

    Args:
        a: The first number.
        b: The second number.
        operation: The operation to perform — one of: add, subtract, multiply, divide.
    """
    match operation:
        case "add":
            return str(a + b)
        case "subtract":
            return str(a - b)
        case "multiply":
            return str(a * b)
        case "divide":
            return str(a / b) if b != 0 else "Error: division by zero"
        case _:
            return f"Unknown operation: {operation}"
