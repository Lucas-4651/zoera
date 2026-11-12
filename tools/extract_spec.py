#!/usr/bin/env python3
"""Extract a compact, human/agent-readable reference of the BSD v2 football API
from the OpenAPI schema dumped at ./openapi.json."""
import json
import re
import sys
from collections import OrderedDict

SPEC = json.load(open("openapi.json"))
PATHS = SPEC["paths"]
COMPS = SPEC.get("components", {}).get("schemas", {})


def resolve(schema, depth=0, seen=None):
    """Return a compact field map for an object schema."""
    if seen is None:
        seen = set()
    if not isinstance(schema, dict) or depth > 4:
        return {}
    if "$ref" in schema:
        ref = schema["$ref"].split("/")[-1]
        if ref in seen:
            return {}
        seen = seen | {ref}
        return resolve(COMPS.get(ref, {}), depth, seen)
    t = schema.get("type")
    if t == "array":
        return resolve(schema.get("items", {}), depth, seen)
    if t == "object" or "properties" in schema:
        out = OrderedDict()
        for name, sub in (schema.get("properties") or {}).items():
            out[name] = field_type(sub)
        return out
    return {}


def field_type(sub):
    if not isinstance(sub, dict):
        return "?"
    if "$ref" in sub:
        ref = sub["$ref"].split("/")[-1]
        st = COMPS.get(ref, {}).get("type", "object")
        if st == "array":
            it = COMPS.get(ref, {}).get("items", {})
            return f"array<{field_type(it)}>"
        return ref
    if sub.get("type") == "array":
        it = sub.get("items", {})
        if "$ref" in it:
            return f"array<{it['$ref'].split('/')[-1]}>"
        return f"array<{it.get('type','?')}>"
    if sub.get("type") == "object":
        if "additionalProperties" in sub:
            return "object<string,?>"
        return "object"
    return sub.get("type", "?")


def param_list(params):
    out = []
    for p in params or []:
        if p.get("name") in ("format",):
            continue
        out.append(
            {
                "name": p.get("name"),
                "in": p.get("in"),
                "required": bool(p.get("required")),
                "type": field_type(p.get("schema", {})),
                "default": (p.get("schema") or {}).get("default"),
                "desc": (p.get("description") or "").replace("\n", " ")[:220],
            }
        )
    return out


def ok_schema(op):
    resp = (op.get("responses") or {}).get("200") or (op.get("responses") or {}).get("201") or {}
    content = (resp.get("content") or {}).get("application/json") or {}
    sch = content.get("schema") or {}
    return sch


def describe(path_key, op):
    sch = ok_schema(op)
    info = OrderedDict()
    info["summary"] = op.get("summary") or ""
    info["description"] = (op.get("description") or "").replace("\n", " ")[:600]
    info["params"] = param_list(op.get("parameters"))
    if "$ref" in sch:
        top = sch["$ref"].split("/")[-1]
        info["top"] = top
        tc = COMPS.get(top, {})
        props = tc.get("properties", {})
        if "results" in props:
            info["item_schema"] = props["results"].get("items", {})
            info["item_fields"] = resolve(info["item_schema"])
        else:
            info["fields"] = resolve(sch)
    else:
        info["fields"] = resolve(sch)
        if sch.get("type") == "array":
            info["item_fields"] = resolve(sch.get("items", {}))
    return info


def render(path_key, method, op):
    info = describe(path_key, op)
    lines = [f"### {method.upper()} {path_key}"]
    if info["summary"]:
        lines.append(f"**Summary:** {info['summary']}")
    if info["description"]:
        lines.append(f"**Notes:** {info['description']}")
    if info["params"]:
        lines.append("**Params:**")
        for p in info["params"]:
            bits = [f"`{p['name']}`", p["type"]]
            if p["required"]:
                bits.append("REQUIRED")
            if p["default"] is not None:
                bits.append(f"default={p['default']}")
            if p["desc"]:
                bits.append(p["desc"])
            lines.append("  - " + " | ".join(bits))
    fields = info.get("item_fields") or info.get("fields") or {}
    if fields:
        lines.append("**Response fields:**")
        for k, v in fields.items():
            lines.append(f"  - `{k}`: {v}")
    else:
        lines.append("**Response:** (no schema resolved)")
    return "\n".join(lines)


def main():
    targets = sys.argv[1:] or ["/api/v2/"]
    out = []
    for path_key in sorted(PATHS):
        if not any(path_key.startswith(t) for t in targets):
            continue
        for method, op in PATHS[path_key].items():
            if method not in ("get", "post"):
                continue
            out.append(render(path_key, method, op))
    print("\n\n".join(out))


if __name__ == "__main__":
    main()
