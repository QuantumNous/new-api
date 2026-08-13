import json


PROTOCOL_VERSION = "2025-06-18"
EMPTY_INPUT_SCHEMA = {"type": "object", "properties": {}, "additionalProperties": False}


class McpError(Exception):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code
        self.message = message


class ToolExecutionError(Exception):
    pass


class Tool:
    def __init__(self, name, description, handler, input_schema=None):
        self.name = name
        self.description = description
        self.handler = handler
        self.input_schema = input_schema or EMPTY_INPUT_SCHEMA

    def definition(self):
        return {"name": self.name, "description": self.description, "inputSchema": self.input_schema}


class McpServer:
    def __init__(self, name, tools):
        self.name = name
        self.tools = {tool.name: tool for tool in tools}

    def handle(self, request):
        if not isinstance(request, dict):
            raise McpError(-32600, "invalid request")
        method = request.get("method")
        if not isinstance(method, str):
            raise McpError(-32600, "invalid request")
        if method == "initialize":
            return {
                "protocolVersion": PROTOCOL_VERSION,
                "capabilities": {"tools": {}},
                "serverInfo": {"name": self.name, "version": "1.0.0"},
            }
        if method == "tools/list":
            return {"tools": [tool.definition() for tool in self.tools.values()]}
        if method == "tools/call":
            return self._call_tool(request.get("params"))
        raise McpError(-32601, "method not found")

    def _call_tool(self, params):
        if not isinstance(params, dict):
            raise McpError(-32602, "invalid params")
        name = params.get("name")
        arguments = params.get("arguments")
        if not isinstance(name, str) or name not in self.tools:
            raise McpError(-32601, "tool not found")
        if arguments != {}:
            raise McpError(-32602, "invalid arguments")
        try:
            result = self.tools[name].handler()
        except ToolExecutionError as exc:
            return tool_result(str(exc), is_error=True)
        return tool_result(result)


def tool_result(value, *, is_error=False):
    text = value if isinstance(value, str) else json.dumps(value, sort_keys=True)
    return {"content": [{"type": "text", "text": text}], "isError": bool(is_error)}


def run_jsonrpc_server(stdin, stdout, server, *, max_line_bytes=1024 * 1024):
    for line in _iter_bounded_lines(stdin, max_line_bytes):
        if line is None:
            _write_response(stdout, None, error=(-32700, "parse error"))
            break
        try:
            request = json.loads(line)
        except json.JSONDecodeError:
            _write_response(stdout, None, error=(-32700, "parse error"))
            break
        if not isinstance(request, dict):
            _write_response(stdout, None, error=(-32600, "invalid request"))
            break
        if request.get("jsonrpc") != "2.0":
            if "id" in request:
                _write_response(stdout, request.get("id"), error=(-32600, "invalid request"))
            break
        if "id" not in request:
            continue
        request_id = request.get("id")
        try:
            result = server.handle(request)
        except McpError as exc:
            _write_response(stdout, request_id, error=(exc.code, exc.message))
        except Exception:
            _write_response(stdout, request_id, error=(-32603, "internal error"))
        else:
            _write_response(stdout, request_id, result=result)


def _iter_bounded_lines(stream, max_line_bytes):
    while True:
        line = stream.readline(max_line_bytes + 1)
        if line == "":
            return
        if len(line.encode("utf-8", "replace")) > max_line_bytes:
            yield None
            return
        yield line


def _write_response(stdout, request_id, *, result=None, error=None):
    payload = {"jsonrpc": "2.0", "id": request_id}
    if error is not None:
        code, message = error
        payload["error"] = {"code": code, "message": message}
    else:
        payload["result"] = result
    stdout.write(json.dumps(payload, separators=(",", ":"), sort_keys=True) + "\n")
    stdout.flush()
