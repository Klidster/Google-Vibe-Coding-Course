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
"""
Unit tests for the ambient expense agent workflow.

Tests cover:
  - parse_expense_input: dict, float, JSON string, dollar-amount string
  - classify_expense node: routing to "auto_approve" vs "review"
  - auto_approve node: returns approved=True with decision="auto"
  - review_agent node: returns a RequestInput interrupt
  - finalize_report node: accepts both auto-approve and human-review inputs
  - Graph structure: correct node names and edge wiring
"""

import asyncio
import json
import pytest
from unittest.mock import MagicMock

from google.adk.events import RequestInput

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_mock_ctx(route_holder: dict, state: dict | None = None):
    """Return a lightweight mock Context suitable for node unit tests."""
    ctx = MagicMock()
    ctx.state = state if state is not None else {}

    def set_route(v):
        route_holder["route"] = v

    type(ctx).route = property(fget=lambda self: route_holder.get("route"), fset=lambda self, v: set_route(v))
    return ctx


# ---------------------------------------------------------------------------
# parse_expense_input tests
# ---------------------------------------------------------------------------

from app.agent import parse_expense_input


def test_parse_dict_passthrough():
    data = {"amount": 42.0, "description": "Lunch"}
    assert parse_expense_input(data) == data


def test_parse_float():
    result = parse_expense_input(50.0)
    assert result["amount"] == 50.0
    assert "description" in result


def test_parse_json_string():
    payload = json.dumps({"amount": 120.0, "description": "Client dinner"})
    result = parse_expense_input(payload)
    assert result["amount"] == 120.0
    assert result["description"] == "Client dinner"


def test_parse_dollar_amount_string():
    result = parse_expense_input("$75 for office supplies")
    assert result["amount"] == 75.0
    assert result["description"] != ""


def test_parse_unknown_falls_back():
    result = parse_expense_input(None)
    assert result["amount"] == 0.0


# ---------------------------------------------------------------------------
# classify_expense tests
# ---------------------------------------------------------------------------

from app.agent import classify_expense, auto_approve, review_agent, finalize_report


def run_sync_node(node_func, ctx, node_input):
    """Run a synchronous @node-decorated function, bypassing the async machinery."""
    import inspect

    inner = node_func._func  # Access the underlying function from FunctionNode
    if inspect.iscoroutinefunction(inner):
        return asyncio.get_event_loop().run_until_complete(inner(ctx=ctx, node_input=node_input))
    return inner(ctx=ctx, node_input=node_input)


def test_classify_routes_to_auto_approve_under_100():
    route_holder = {}
    state = {}
    ctx = make_mock_ctx(route_holder, state)
    result = run_sync_node(classify_expense, ctx, {"amount": 45.0, "description": "Pens"})

    assert route_holder.get("route") == "auto_approve"
    assert result["amount"] == 45.0
    assert state["expense"]["amount"] == 45.0


def test_classify_routes_to_review_at_100():
    route_holder = {}
    state = {}
    ctx = make_mock_ctx(route_holder, state)
    run_sync_node(classify_expense, ctx, {"amount": 100.0, "description": "Team lunch"})
    assert route_holder.get("route") == "review"


def test_classify_routes_to_review_above_100():
    route_holder = {}
    state = {}
    ctx = make_mock_ctx(route_holder, state)
    run_sync_node(classify_expense, ctx, {"amount": 250.0, "description": "Flight"})
    assert route_holder.get("route") == "review"


def test_classify_routes_to_auto_approve_at_99_99():
    route_holder = {}
    state = {}
    ctx = make_mock_ctx(route_holder, state)
    run_sync_node(classify_expense, ctx, {"amount": 99.99, "description": "Supplies"})
    assert route_holder.get("route") == "auto_approve"


# ---------------------------------------------------------------------------
# auto_approve tests
# ---------------------------------------------------------------------------

def test_auto_approve_returns_approved():
    route_holder = {}
    state = {"expense": {"amount": 45.0, "description": "Pens"}}
    ctx = make_mock_ctx(route_holder, state)
    result = run_sync_node(auto_approve, ctx, {"amount": 45.0, "description": "Pens"})

    assert result["approved"] is True
    assert result["decision"] == "auto"
    assert result["expense"]["amount"] == 45.0


# ---------------------------------------------------------------------------
# review_agent tests
# ---------------------------------------------------------------------------

def test_review_agent_returns_request_input():
    route_holder = {}
    state = {"expense": {"amount": 120.0, "description": "Client dinner"}}
    ctx = make_mock_ctx(route_holder, state)
    result = run_sync_node(review_agent, ctx, {"amount": 120.0, "description": "Client dinner"})

    assert isinstance(result, RequestInput)
    assert "120.00" in result.message
    assert "Client dinner" in result.message
    assert result.interrupt_id == "expense_human_approval"


def test_review_agent_message_contains_amount():
    route_holder = {}
    state = {"expense": {"amount": 500.0, "description": "Conference"}}
    ctx = make_mock_ctx(route_holder, state)
    result = run_sync_node(review_agent, ctx, {"amount": 500.0, "description": "Conference"})

    assert "500.00" in result.message


# ---------------------------------------------------------------------------
# finalize_report tests
# ---------------------------------------------------------------------------

def test_finalize_auto_approve_path():
    route_holder = {}
    state = {"expense": {"amount": 45.0, "description": "Pens"}}
    ctx = make_mock_ctx(route_holder, state)
    # node_input is the auto_approve output dict
    result = run_sync_node(
        finalize_report, ctx,
        {"approved": True, "expense": {"amount": 45.0, "description": "Pens"}, "decision": "auto"}
    )
    assert result["status"] == "APPROVED"
    assert result["decision_by"] == "Automatic Approval"
    assert result["amount"] == 45.0


def test_finalize_human_approved():
    route_holder = {}
    state = {"expense": {"amount": 120.0, "description": "Client dinner"}}
    ctx = make_mock_ctx(route_holder, state)
    result = run_sync_node(finalize_report, ctx, "yes")
    assert result["status"] == "APPROVED"
    assert result["decision_by"] == "Human Reviewer"


def test_finalize_human_rejected():
    route_holder = {}
    state = {"expense": {"amount": 120.0, "description": "Client dinner"}}
    ctx = make_mock_ctx(route_holder, state)
    result = run_sync_node(finalize_report, ctx, "no")
    assert result["status"] == "REJECTED"
    assert result["decision_by"] == "Human Reviewer"


def test_finalize_human_bool_true():
    route_holder = {}
    state = {"expense": {"amount": 200.0, "description": "Flight"}}
    ctx = make_mock_ctx(route_holder, state)
    result = run_sync_node(finalize_report, ctx, True)
    assert result["status"] == "APPROVED"


def test_finalize_human_bool_false():
    route_holder = {}
    state = {"expense": {"amount": 200.0, "description": "Flight"}}
    ctx = make_mock_ctx(route_holder, state)
    result = run_sync_node(finalize_report, ctx, False)
    assert result["status"] == "REJECTED"


# ---------------------------------------------------------------------------
# Graph structure tests
# ---------------------------------------------------------------------------

from app.agent import workflow


def test_workflow_name():
    assert workflow.name == "expense_workflow"


def test_workflow_has_all_nodes():
    node_names = {n.name for n in workflow.graph.nodes}
    assert "classify_expense" in node_names
    assert "auto_approve" in node_names
    assert "review_agent" in node_names
    assert "finalize_report" in node_names


def test_workflow_start_connects_to_classify():
    from google.adk.workflow import START
    start_edges = [e for e in workflow.graph.edges if e.from_node.name == START.name]
    assert len(start_edges) == 1
    assert start_edges[0].to_node.name == "classify_expense"


def test_workflow_classify_has_conditional_edges():
    classify_edges = [e for e in workflow.graph.edges if e.from_node.name == "classify_expense"]
    routes = {e.route for e in classify_edges}
    assert "auto_approve" in routes
    assert "review" in routes


def test_workflow_terminal_nodes():
    terminal = workflow.graph._terminal_node_names
    assert "finalize_report" in terminal


def test_workflow_review_agent_connects_to_finalize():
    review_edges = [e for e in workflow.graph.edges if e.from_node.name == "review_agent"]
    assert any(e.to_node.name == "finalize_report" for e in review_edges)


def test_workflow_auto_approve_connects_to_finalize():
    auto_edges = [e for e in workflow.graph.edges if e.from_node.name == "auto_approve"]
    assert any(e.to_node.name == "finalize_report" for e in auto_edges)
