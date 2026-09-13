#!/usr/bin/env python3
"""Static checks for a StarUML 5 (.uml, XPD XML) project file.

    python validate_xpd.py project.uml [--samples DIR_OR_FILE ...] [--quiet]

Hard failures (exit 1):
  * not well-formed XML
  * duplicate GUIDs
  * references to GUIDs that do not exist
  * a '#Field' counter that disagrees with the collection it counts

Warnings:
  * types or fields that never appear in StarUML's own sample projects. This is
    expected for diagram kinds the samples do not cover (for example activity
    diagrams) - confirm those names against the metamodel sample, the help file
    or strings inside StarUML.exe before ignoring the warning.
"""

import argparse
import os
import sys
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from pathlib import Path


def default_sample_dirs():
    """Look for the samples shipped with an installed StarUML 5."""
    if os.environ.get("STARUML_HOME"):
        yield Path(os.environ["STARUML_HOME"]) / "samples"
    roots = [os.environ.get("ProgramFiles"), os.environ.get("ProgramFiles(x86)")]
    roots += [f"{drive}:\\Program Files" for drive in ("C", "D", "E")]
    roots += [f"{drive}:\\Program Files (x86)" for drive in ("C", "D", "E")]
    for root in filter(None, roots):
        yield Path(root) / "StarUML" / "samples"


def tag(elem):
    return elem.tag.split("}")[-1]


def field_of(name):
    return (name or "").split("[")[0]


def load(path):
    return ET.fromstring(Path(path).read_bytes().decode("utf-8-sig"))


def validate(path):
    problems = []
    notes = []

    try:
        root = load(path)
    except ET.ParseError as exc:
        return [f"not well-formed XML: {exc}"], [], {}

    if tag(root) != "PROJECT":
        problems.append(f"root element is <{root.tag}>, expected <XPD:PROJECT>")

    objects = [e for e in root.iter() if tag(e) == "OBJ"]
    refs = [e for e in root.iter() if tag(e) == "REF"]

    defined = defaultdict(list)
    for obj in objects:
        defined[obj.get("guid")].append(obj.get("type"))
    for guid, types in defined.items():
        if len(types) > 1:
            problems.append(f"duplicate guid {guid} used by {types}")

    for ref in refs:
        target = (ref.text or "").strip()
        if target and target not in defined:
            problems.append(f"dangling reference {ref.get('name')} -> {target}")

    # counters: '#Field' must match the OBJ children or REF members named Field[i]
    for obj in objects:
        counters = {}
        child_counts = Counter()
        ref_counts = Counter()
        for child in obj:
            if tag(child) == "ATTR":
                name = child.get("name") or ""
                if name.startswith("#"):
                    counters[name[1:]] = int(child.text or 0)
            elif tag(child) == "OBJ":
                child_counts[field_of(child.get("name"))] += 1
            elif tag(child) == "REF":
                ref_counts[field_of(child.get("name"))] += 1
        for field, declared in counters.items():
            actual = child_counts.get(field, 0) or ref_counts.get(field, 0)
            if declared != actual:
                problems.append(
                    f"{obj.get('type')}: counter #{field}={declared} but {actual} entries found"
                )

    counts = Counter(o.get("type") for o in objects)
    notes.append(f"{len(objects)} objects, {len(refs)} references")
    return problems, notes, counts


def schema(root):
    out = defaultdict(lambda: {"attrs": set(), "refs": set(), "children": set()})
    for obj in root.iter():
        if tag(obj) != "OBJ":
            continue
        t = obj.get("type")
        for child in obj:
            if tag(child) == "ATTR":
                name = child.get("name") or ""
                if not name.startswith("#"):
                    out[t]["attrs"].add(name)
            elif tag(child) == "REF":
                out[t]["refs"].add(field_of(child.get("name")))
            elif tag(child) == "OBJ":
                out[t]["children"].add(field_of(child.get("name")))
    return out


def union_schema(paths):
    merged = defaultdict(lambda: {"attrs": set(), "refs": set(), "children": set()})
    for path in paths:
        try:
            part = schema(load(path))
        except ET.ParseError:
            continue
        for t, fields in part.items():
            for key in ("attrs", "refs", "children"):
                merged[t][key] |= fields[key]
    return merged


def collect_samples(explicit):
    files = []
    for item in (explicit or []):
        p = Path(item)
        if p.is_dir():
            files.extend(sorted(p.glob("*.uml")))
        elif p.is_file():
            files.append(p)
    if not explicit:
        for candidate in default_sample_dirs():
            if candidate.is_dir():
                files.extend(sorted(candidate.glob("*.uml")))
                break
    return files


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("file")
    parser.add_argument("--samples", nargs="*", default=None,
                        help="sample .uml files or directories (StarUML's own projects)")
    parser.add_argument("--no-samples", action="store_true")
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args()

    problems, notes, counts = validate(args.file)
    print(f"checked: {args.file}")
    for note in notes:
        print("  " + note)
    if counts and not args.quiet:
        print("  types: " + ", ".join(f"{t} x{n}" for t, n in sorted(counts.items())))

    if problems:
        print("\nFAILED")
        for problem in problems[:40]:
            print("  - " + problem)
        return 1
    print("XML/GUID/counter checks: OK")

    if not args.no_samples:
        samples = collect_samples(args.samples)
        if samples:
            mine = schema(load(args.file))
            theirs = union_schema(samples)
            unknown = []
            for t, fields in mine.items():
                if t not in theirs:
                    unknown.append(f"type {t}")
                    continue
                for key in ("attrs", "refs", "children"):
                    for field in sorted(fields[key] - theirs[t][key]):
                        unknown.append(f"{t}.{key}:{field}")
            print(f"vocabulary vs {len(samples)} StarUML sample project(s): "
                  + ("all known" if not unknown else f"{len(unknown)} item(s) to confirm"))
            for item in unknown[:20]:
                print("  ? " + item)
        else:
            print("vocabulary check skipped: no StarUML samples found")
    return 0


if __name__ == "__main__":
    sys.exit(main())
