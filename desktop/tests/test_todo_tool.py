"""todo_write's wire contract.

The parameter is `todos` — a top-level arguments key named "items" shadows minijinja's
`.items()` map method in hosted chat templates (Together GLM-5.2, 2026-07-21) and 400s
every request that replays the call. The old key stays accepted at execution time for
models that free-style it, but must never reappear in the schema.
"""

from coworker.tools.todo import _TODO_SCHEMA, TodoList, todo_tools


def _write(**kwargs):
    todo = TodoList()
    (spec,) = todo_tools(todo)
    return spec(**kwargs), todo


def test_schema_param_is_todos_not_items():
    props = _TODO_SCHEMA["function"]["parameters"]["properties"]
    assert "todos" in props
    assert "items" not in props  # regression guard: see module docstring
    assert _TODO_SCHEMA["function"]["parameters"]["required"] == ["todos"]


def test_todos_key_writes_the_list():
    result, todo = _write(todos=[{"content": "a", "status": "in_progress"}])
    assert todo.items == [{"content": "a", "status": "in_progress"}]
    assert result == {"count": 1, "todos": [{"content": "a", "status": "in_progress"}]}


def test_legacy_items_key_still_executes():
    result, todo = _write(items=[{"content": "b", "status": "done"}])
    assert todo.items == [{"content": "b", "status": "done"}]
    assert result["count"] == 1
