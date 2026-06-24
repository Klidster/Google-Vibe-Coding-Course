# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import json
import logging
import os
import re
from typing import Any

import google.auth
from google.auth.exceptions import DefaultCredentialsError
from google.adk.agents.context import Context
from google.adk.apps import App
from google.adk.events import RequestInput
from google.adk.workflow import Workflow, node, START

logger = logging.getLogger(__name__)

# Fallback for local execution without active GCP project
try:
    _, project_id = google.auth.default()
    os.environ["GOOGLE_GENAI_USE_VERTEXAI"] = "True"
except DefaultCredentialsError:
    project_id = "mock-project"
    os.environ["GOOGLE_GENAI_USE_VERTEXAI"] = "False"

os.environ["GOOGLE_CLOUD_PROJECT"] = project_id
os.environ["GOOGLE_CLOUD_LOCATION"] = "global"


def parse_expense_input(node_input: Any) -> dict:
    """Robust parser for expense inputs (dict, JSON, simple text/number)."""
    if isinstance(node_input, dict):
        return node_input
    
    if isinstance(node_input, (int, float)):
        return {"amount": float(node_input), "description": "Expense claim"}
        
    if isinstance(node_input, str):
        # Try JSON
        try:
            parsed = json.loads(node_input)
            if isinstance(parsed, dict):
                if "amount" in parsed:
                    parsed["amount"] = float(parsed["amount"])
                return parsed
        except (json.JSONDecodeError, ValueError):
            pass
            
        # Try extracting a dollar amount
        match = re.search(r'\$?(\d+(?:\.\d{2})?)', node_input)
        if match:
            amount = float(match.group(1))
            desc = node_input.replace(match.group(0), "").strip()
            if not desc:
                desc = "Expense claim"
            return {"amount": amount, "description": desc}
            
    return {"amount": 0.0, "description": str(node_input) if node_input else "Unknown expense"}


@node
def classify_expense(ctx: Context, node_input: Any) -> dict:
    """Examines the expense and routes it accordingly."""
    expense = parse_expense_input(node_input)
    ctx.state["expense"] = expense
    amount = expense.get("amount", 0.0)
    
    if amount < 100.0:
        ctx.route = "auto_approve"
    else:
        ctx.route = "review"
    
    return expense


@node
def auto_approve(ctx: Context, node_input: Any) -> dict:
    """Automatically approves expenses under $100."""
    expense = ctx.state.get("expense", {})
    return {
        "approved": True,
        "expense": expense,
        "decision": "auto"
    }


@node
def review_agent(ctx: Context, node_input: Any) -> RequestInput:
    """Triggers a human-in-the-loop pause for expenses of $100 or more."""
    expense = ctx.state.get("expense", {})
    amount = expense.get("amount", 0.0)
    desc = expense.get("description", "")
    
    # We yield/return RequestInput to trigger a pause.
    # The interrupt_id is unique per run.
    return RequestInput(
        interrupt_id="expense_human_approval",
        message=f"Expense claim of ${amount:.2f} for '{desc}' requires review. Approve? (yes/no):",
        response_schema=bool
    )


@node
def finalize_report(ctx: Context, node_input: Any) -> dict:
    """Summarizes and finalizes the expense report decision."""
    expense = ctx.state.get("expense", {})
    
    if isinstance(node_input, dict) and node_input.get("decision") == "auto":
        approved = True
        decision_by = "Automatic Approval"
    else:
        # For review_agent, node_input is the user response (e.g. True or False)
        # Note: Depending on how response is parsed, it could be a bool or a string response.
        if isinstance(node_input, str):
            approved = node_input.strip().lower() in ("yes", "y", "true", "1", "approve", "approved")
        else:
            approved = bool(node_input)
        decision_by = "Human Reviewer"
        
    status = "APPROVED" if approved else "REJECTED"
    amount = expense.get("amount", 0.0)
    desc = expense.get("description", "")
    
    return {
        "status": status,
        "amount": amount,
        "description": desc,
        "decision_by": decision_by
    }


# Define the ADK 2.0 Graph Workflow
workflow = Workflow(
    name="expense_workflow",
    edges=[
        (START, classify_expense),
        (classify_expense, {"auto_approve": auto_approve, "review": review_agent}),
        (auto_approve, finalize_report),
        (review_agent, finalize_report),
    ],
)

app = App(
    root_agent=workflow,
    name="ambient_expense_agent",
)
