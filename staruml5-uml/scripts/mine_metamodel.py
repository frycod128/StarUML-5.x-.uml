#!/usr/bin/env python3
"""Read StarUML 5's metamodel out of the sample project it ships.

    python mine_metamodel.py UMLActionState UMLTransitionView
    python mine_metamodel.py --list State          # class names containing "State"
    python mine_metamodel.py UMLClassView --sample "D:\\...\\StarUML Application Model.uml"

The sample `StarUML Application Model.uml` models StarUML's own UML 1.4
metamodel, so it answers "which fields does this element type have, and what does
it inherit from" - the fastest way to add a diagram kind the shipped projects do
not cover. Pair it with the toolbox list in StarUML.chm
(`modeling_with_<kind>_<element>.htm`) and with type names found inside
StarUML.exe (`rg -a -o "UML[A-Za-z]*(View|Diagram)" StarUML.exe`).
"""

import argparse
import os
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

SAMPLE_NAME = "StarUML Application Model.uml"


def default_sample():
    """Locate the metamodel sample that ships with StarUML 5."""
    candidates = []
    if os.environ.get("STARUML_HOME"):
        candidates.append(Path(os.environ["STARUML_HOME"]) / "samples")
    roots = [os.environ.get("ProgramFiles"), os.environ.get("ProgramFiles(x86)")]
    roots += [f"{drive}:\\Program Files" for drive in ("C", "D", "E")]
    roots += [f"{drive}:\\Program Files (x86)" for drive in ("C", "D", "E")]
    for root in filter(None, roots):
        candidates.append(Path(root) / "StarUML" / "samples")
    for directory in candidates:
        sample = directory / SAMPLE_NAME
        if sample.is_file():
            return sample
    return candidates[0] / SAMPLE_NAME if candidates else Path(SAMPLE_NAME)


def tag(elem):
    return elem.tag.split("}")[-1]


def attr(elem, name):
    for child in elem:
        if tag(child) == "ATTR" and child.get("name") == name:
            return child.text
    return None


def kids(elem, field):
    return [c for c in elem if tag(c) == "OBJ" and (c.get("name") or "").startswith(field)]


def refs(elem, field):
    return [c.text for c in elem if tag(c) == "REF" and (c.get("name") or "").startswith(field)]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("names", nargs="*", help="metamodel class names, e.g. UMLActionStateView")
    parser.add_argument("--sample", default=None, help="path to 'StarUML Application Model.uml'")
    parser.add_argument("--list", metavar="PATTERN", help="list class names containing PATTERN")
    args = parser.parse_args()

    path = Path(args.sample) if args.sample else default_sample()
    if not path.is_file():
        print(f"sample not found: {path}\n"
              f"pass --sample <path to StarUML Application Model.uml> or set STARUML_HOME",
              file=sys.stderr)
        return 2

    root = ET.fromstring(path.read_bytes().decode("utf-8-sig"))
    objects = [e for e in root.iter() if tag(e) == "OBJ"]
    by_id = {o.get("guid"): o for o in objects}
    classes = {}
    for obj in objects:
        if obj.get("type") != "UMLClass":
            continue
        name = attr(obj, "Name")
        if name:
            classes[name] = obj

    if args.list:
        pattern = args.list.lower()
        for name in sorted(n for n in classes if pattern in n.lower()):
            print(name)
        return 0

    if not args.names:
        parser.print_help()
        return 1

    for name in args.names:
        obj = classes.get(name)
        if obj is None:
            print(f"=== {name}: not defined in this sample ===")
            continue
        parents = []
        for guid in refs(obj, "Generalizations"):
            generalization = by_id.get(guid)
            if generalization is None:
                continue
            for parent_guid in refs(generalization, "Parent"):
                parent = by_id.get(parent_guid)
                if parent is not None:
                    parents.append(attr(parent, "Name"))
        print(f"=== {name} (extends {', '.join(parents) or '-'}) ===")
        fields = kids(obj, "Attributes")
        if not fields:
            print("    (no own attributes)")
        for field in fields:
            type_expr = attr(field, "TypeExpression") or ""
            visibility = attr(field, "Visibility") or ""
            suffix = f"  [{visibility}]" if visibility else ""
            print(f"    {attr(field, 'Name')}: {type_expr}{suffix}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
