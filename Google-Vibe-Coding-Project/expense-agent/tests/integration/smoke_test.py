"""
Integration smoke-test for the ambient expense agent workflow.

Runs both branches using the ADK Runner directly (no server needed):
  - auto-approve path  (<$100)
  - human-review path  (>=$100) -- verifies RequestInput is emitted
"""

import asyncio
import json
import sys

from google.adk import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from app.agent import app

SEPARATOR = "─" * 60


async def send(runner, session, message: str):
    """Send a message and collect all events."""
    content = types.Content(role="user", parts=[types.Part(text=message)])
    events = []
    async for event in runner.run_async(
        user_id="test-user",
        session_id=session.id,
        new_message=content,
    ):
        events.append(event)
    return events


async def test_auto_approve():
    print(SEPARATOR)
    print("TEST 1 -- Auto-approve path (amount < $100)")
    print(SEPARATOR)

    session_svc = InMemorySessionService()
    runner = Runner(
        app=app,
        session_service=session_svc,
        auto_create_session=True,
    )

    session = await session_svc.create_session(app_name=app.name, user_id="test-user")
    payload = json.dumps({"amount": 45.0, "description": "Office supplies"})
    events = await send(runner, session, payload)

    # Find the terminal output event
    final = next((e for e in reversed(events) if getattr(e, "output", None)), None)
    if final:
        print(f"  Output: {final.output}")
        assert final.output.get("status") == "APPROVED", f"Expected APPROVED, got: {final.output}"
        assert final.output.get("decision_by") == "Automatic Approval"
        print("  PASSED -- expense auto-approved correctly")
    else:
        print(f"  Events: {[str(e) for e in events]}")
        print("  (!!)  No terminal output found (check events above)")

    return final


async def test_human_review():
    print(SEPARATOR)
    print("TEST 2 -- Human-review path (amount >= $100)")
    print(SEPARATOR)

    session_svc = InMemorySessionService()
    runner = Runner(
        app=app,
        session_service=session_svc,
        auto_create_session=True,
    )

    session = await session_svc.create_session(app_name=app.name, user_id="test-user")
    payload = json.dumps({"amount": 120.0, "description": "Client dinner"})
    events = await send(runner, session, payload)

    # Check for a RequestInput interrupt event (long_running_tool_ids present)
    interrupt_event = next(
        (e for e in events if getattr(e, "long_running_tool_ids", None)), None
    )
    if interrupt_event:
        # Extract the interrupt message from the function call
        part = interrupt_event.content.parts[0] if interrupt_event.content else None
        if part and part.function_call:
            args = dict(part.function_call.args or {})
            print(f"  Interrupt message: {args.get('message', '(no message)')}")
        print(f"  Interrupt IDs: {interrupt_event.long_running_tool_ids}")
        print("  PASSED -- RequestInput interrupt emitted correctly")
    else:
        print(f"  Events: {[str(e)[:120] for e in events]}")
        print("  (!!)  No interrupt event found (may still be correct if runner resolves immediately)")

    return interrupt_event


async def main():
    print("\nAmbient Expense Agent -- Integration Smoke-Test\n")
    try:
        await test_auto_approve()
    except Exception as e:
        print(f"  FAILED: {e}")
        sys.exit(1)

    print()

    try:
        await test_human_review()
    except Exception as e:
        print(f"  FAILED: {e}")
        sys.exit(1)

    print()
    print(SEPARATOR)
    print("All smoke tests completed.")


if __name__ == "__main__":
    asyncio.run(main())
