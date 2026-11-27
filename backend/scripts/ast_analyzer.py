import sys
import json
import ast

def build_node(node, edge_label=""):
    """Recursive syntax tree node generator for statements, expressions, and operands."""
    if node is None:
        return None

    # While Loop
    if isinstance(node, ast.While):
        children = []
        cond_node = build_node(node.test, edge_label="condition")
        if cond_node:
            children.append(cond_node)
        body_nodes = [build_node(s) for s in node.body if build_node(s)]
        if len(body_nodes) == 1 and body_nodes[0].get("name") == "branch":
            children.append({**body_nodes[0], "edge": "body"})
        else:
            children.append({"name": "body", "type": "control", "edge": "body", "children": body_nodes})
        return {"name": "while", "type": "control", "edge": edge_label, "children": [c for c in children if c]}

    # If / Branch
    if isinstance(node, ast.If):
        children = []
        cond_node = build_node(node.test, edge_label="condition")
        if cond_node:
            children.append(cond_node)
        if_children = [build_node(s) for s in node.body if build_node(s)]
        if len(if_children) == 1 and if_children[0].get("type") in ("control", "assign"):
            children.append({**if_children[0], "edge": "if-body"})
        else:
            children.append({"name": "if-body", "type": "control", "edge": "if-body", "children": if_children})
        if node.orelse:
            else_children = [build_node(s) for s in node.orelse if build_node(s)]
            if len(else_children) == 1 and else_children[0].get("type") in ("control", "assign"):
                children.append({**else_children[0], "edge": "else-body"})
            else:
                children.append({"name": "else-body", "type": "control", "edge": "else-body", "children": else_children})
        return {"name": "branch", "type": "control", "edge": edge_label, "children": children}

    # For Loop
    if isinstance(node, ast.For):
        children = [
            build_node(node.target, edge_label="target"),
            build_node(node.iter, edge_label="iter"),
            {"name": "body", "type": "control", "edge": "body", "children": [build_node(s) for s in node.body if build_node(s)]}
        ]
        return {"name": "for", "type": "control", "edge": edge_label, "children": [c for c in children if c]}

    # Assign
    if isinstance(node, (ast.Assign, ast.AugAssign)):
        children = []
        if isinstance(node, ast.Assign):
            for t in node.targets:
                children.append(build_node(t))
            children.append(build_node(node.value))
        else:
            children.append(build_node(node.target))
            children.append(build_node(node.value))
        return {"name": "assign", "type": "control", "edge": edge_label, "children": [c for c in children if c]}

    # Return
    if isinstance(node, ast.Return):
        children = [build_node(node.value)] if node.value else []
        return {"name": "return", "type": "control", "edge": edge_label, "children": [c for c in children if c]}

    # Compare
    if isinstance(node, ast.Compare):
        op_sym = {ast.NotEq: "!=", ast.Gt: ">", ast.Lt: "<", ast.Eq: "==", ast.GtE: ">=", ast.LtE: "<="}.get(type(node.ops[0]), "op")
        children = [build_node(node.left)]
        for comp in node.comparators:
            children.append(build_node(comp))
        return {"name": f"compare\nop: {op_sym}", "type": "op", "edge": edge_label, "children": [c for c in children if c]}

    # BinOp
    if isinstance(node, ast.BinOp):
        op_sym = {ast.Sub: "-", ast.Add: "+", ast.Mult: "*", ast.Div: "/", ast.Mod: "%"}.get(type(node.op), "op")
        children = [build_node(node.left), build_node(node.right)]
        return {"name": f"bin op\nop: {op_sym}", "type": "op", "edge": edge_label, "children": [c for c in children if c]}

    # Name (Variable)
    if isinstance(node, ast.Name):
        return {"name": f"variable\nname: {node.id}", "type": "variable", "edge": edge_label}

    # Constant / Literal
    if isinstance(node, ast.Constant):
        return {"name": f"constant\nvalue: {node.value}", "type": "constant", "edge": edge_label}

    # Call
    if isinstance(node, ast.Call):
        func_name = getattr(node.func, "id", getattr(node.func, "attr", "call"))
        children = [build_node(arg) for arg in node.args if build_node(arg)]
        return {"name": f"call\n{func_name}()", "type": "call", "edge": edge_label, "children": children}

    # FunctionDef
    if isinstance(node, ast.FunctionDef):
        body_children = [build_node(s) for s in node.body if build_node(s)]
        return {"name": f"def {node.name}()", "type": "control", "edge": edge_label, "children": body_children}

    # Expr
    if isinstance(node, ast.Expr):
        return build_node(node.value, edge_label=edge_label)

    return None

def ast_to_mermaid(root_node):
    """Converts AST tree node structure into Mermaid flowchart syntax with styled classes."""
    if not root_node:
        return ""

    lines = [
        "graph TD",
        "  classDef control fill:#cce5ff,stroke:#66b2ff,stroke-width:1.5px,color:#0f172a;",
        "  classDef op fill:#dbeafe,stroke:#93c5fd,stroke-width:1.5px,color:#0f172a;",
        "  classDef var fill:#d4edda,stroke:#8fd19e,stroke-width:1.5px,color:#0f172a;",
        "  classDef const fill:#fff3cd,stroke:#ffeeba,stroke-width:1.5px,color:#0f172a;",
        "  classDef default fill:#f1f5f9,stroke:#cbd5e1,stroke-width:1.5px,color:#0f172a;"
    ]

    counter = [0]

    def traverse(node):
        counter[0] += 1
        node_id = f"n{counter[0]}"
        raw_name = node.get("name", "node")
        label = raw_name.replace('"', "'").replace("\n", "<br/>")
        node_type = node.get("type", "default")

        css_class = "default"
        if node_type in ("control", "return", "sequence", "assign"):
            css_class = "control"
        elif node_type == "op":
            css_class = "op"
        elif node_type == "variable":
            css_class = "var"
        elif node_type == "constant":
            css_class = "const"

        lines.append(f'  {node_id}["{label}"]:::{css_class}')

        for child in node.get("children", []):
            if child:
                child_id = traverse(child)
                edge_label = child.get("edge", "")
                if edge_label:
                    lines.append(f'  {node_id} -- "{edge_label}" --> {child_id}')
                else:
                    lines.append(f'  {node_id} --> {child_id}')

        return node_id

    traverse(root_node)
    return "\n".join(lines)

def analyze_code(source_code):
    try:
        tree = ast.parse(source_code)
    except SyntaxError as e:
        return {"error": f"SyntaxError: {e.msg} at line {e.lineno}"}
    except Exception as e:
        return {"error": str(e)}

    functions = []
    classes = []
    imports = []

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                imports.append(alias.name)
        elif isinstance(node, ast.ImportFrom):
            module = node.module or ""
            for alias in node.names:
                imports.append(f"{module}.{alias.name}")
        elif isinstance(node, ast.ClassDef):
            classes.append({
                "name": node.name,
                "line": node.lineno,
                "endLine": getattr(node, "end_lineno", node.lineno),
                "methods": [m.name for m in node.body if isinstance(m, ast.FunctionDef)]
            })
        elif isinstance(node, ast.FunctionDef):
            fn_calls = []
            for child in ast.walk(node):
                if isinstance(child, ast.Call):
                    if isinstance(child.func, ast.Name):
                        fn_calls.append(child.func.id)
                    elif isinstance(child.func, ast.Attribute):
                        fn_calls.append(child.func.attr)

            functions.append({
                "name": node.name,
                "line": node.lineno,
                "endLine": getattr(node, "end_lineno", node.lineno),
                "args": [arg.arg for arg in node.args.args],
                "calls": list(set(fn_calls))
            })

    defined_fn_names = {f["name"] for f in functions}
    called_fn_names = set()

    for f in functions:
        f["internalCalls"] = [c for c in f["calls"] if c in defined_fn_names]
        f["externalCalls"] = [c for c in f["calls"] if c not in defined_fn_names]
        for c in f["internalCalls"]:
            called_fn_names.add(c)

    for f in functions:
        f["isEntryPoint"] = f["name"] not in called_fn_names

    # Build Concrete Syntax Tree (CST/AST) Graph
    parsed_stmts = [build_node(s) for s in tree.body if build_node(s)]
    
    ast_tree = None
    mermaid_diagram = ""
    has_syntax_tree = len(parsed_stmts) > 0

    if has_syntax_tree:
        if len(parsed_stmts) == 1 and parsed_stmts[0].get("children"):
            ast_tree = parsed_stmts[0]
        else:
            ast_tree = {
                "name": "statement\nsequence",
                "type": "control",
                "children": parsed_stmts
            }
        mermaid_diagram = ast_to_mermaid(ast_tree)

    has_class_hierarchy = any(len(c.get("methods", [])) > 0 for c in classes)
    has_call_hierarchy = any(len(f.get("internalCalls", [])) > 0 or len(f.get("externalCalls", [])) > 0 for f in functions)
    has_hierarchy = has_syntax_tree or has_class_hierarchy or has_call_hierarchy

    return {
        "imports": list(set(imports)),
        "classes": classes,
        "functions": functions,
        "astTree": ast_tree,
        "mermaidDiagram": mermaid_diagram,
        "hasHierarchy": has_hierarchy
    }

if __name__ == "__main__":
    input_code = sys.stdin.read()
    result = analyze_code(input_code)
    print(json.dumps(result))
