---
name: staruml5-uml
description: Create or edit StarUML 5 (.uml) project files in the legacy XPD XML format that classic StarUML 5.x can open, covering use case, class, activity and statechart diagrams. Use when the deliverable must open in StarUML 5.x; StarUML 6/7 projects are JSON (.mdj, _type/_id/ownedElements) and are a different format.
metadata:
  short-description: Write StarUML 5 XPD XML project files
---

# StarUML 5 (.uml) project files

Classic StarUML 5.x is the Delphi build (5.0.2 is common). It reads **XPD XML** projects. It cannot read the StarUML 6/7 `.mdj` JSON format (`_type`/`_id`/`ownedElements`): such a file fails with a modal 错误 / 无法打开模型文件。文件格式无效 (invalid model file) dialog, whatever extension it carries. If the user's version is not already known, settle that first — the two formats are not interchangeable.

Generate the XML with a script; do not hand-write a few thousand lines of `<XPD:OBJ>`.

## Ground truth ships with the application

StarUML 5 usually lives in `C:\Program Files (x86)\StarUML`, but it can be installed on another drive. Resolve it from `STARUML_HOME`, `%ProgramFiles(x86)%`, or by searching for `StarUML.exe`; the bundled scripts do that discovery themselves and accept explicit paths.

| Source | Use it for |
| --- | --- |
| `samples\*.uml` | Real projects (use case, class, statechart) — copy element/view shapes and field sets from them |
| `samples\StarUML Application Model.uml` | StarUML's own metamodel; `scripts/mine_metamodel.py UMLClassView UMLTransition` prints a type's fields and superclass |
| `StarUML.exe` | Type/enum names as plain strings, e.g. `rg -a -o "UML[A-Za-z]*(View\|Diagram)" StarUML.exe` |
| `StarUML.chm` | Help; extract with 7-Zip and read `modeling_with_<kind>_<element>.htm` for the toolbox element list of each diagram kind |

Every `type="..."` in the output must trace back to one of these. Invented type names produce files StarUML refuses or misreads. The shipped samples contain no activity diagram, so for that kind the element set comes from the help pages plus the metamodel, not from an example instance.

## Invariants

- `<?xml version="1.0" encoding="UTF-8"?>`, then `<XPD:PROJECT xmlns:XPD="http://www.staruml.com" version="1">` → `<XPD:HEADER>` (empty `SUBUNITS`, `PROFILES` containing `UMLStandard`) → `<XPD:BODY>` → one `<XPD:OBJ name="DocumentElement" type="UMLProject" guid="…">`.
- Children are `<XPD:OBJ name="Field" …>` for single-valued fields and `<XPD:OBJ name="Field[i]" …>` for collections; every collection is preceded by `<XPD:ATTR name="#Field" type="integer">N</XPD:ATTR>`.
- Field order inside an object: `ATTR`s → `REF`s → `#Views`/`Views[i]` → owned collections → `#Associations` / `#Outgoings` / `#Incomings`.
- Values are type-tagged; enums are written as literals: `PseudostateKind=pkInitial|pkDecision`, `LineStyle=lsOblique|lsRectilinear`, `DirectionKind=pdkReturn`, `Visibility=vkPublic`, `Aggregation`/`IsNavigable` on association ends.
- `Points` are **integer** pairs (`"120,80;340,80"`). Decimals or `NaN` abort the load with `'291.13' is not a valid integer value.`; round after computing border intersections.
- Booleans are `True`/`False`, never `true`/`false` (lowercase is dropped, and a default diagram marked with it will not open).
- Never call `attr(name, value)` by mistake — the signature is `attr(name, type, value)`. A missing value writes the intended string into `@type` and `undefined` into the text.
- Use case relationships use UML 1.4 names: `UMLInclude` = `Base` + `Addition`, `UMLExtend` = `Base` + `Extension`, `UMLGeneralization` = `Parent` + `Child`. `Connections[]` order on an association is arbitrary — StarUML matches ends by `Participant`.
- `UMLAssociationView` must contain all ten end-label/qualifier children (`HeadRoleNameLabel` … `TailQualifierCompartment`). StarUML 5 raises an access violation without them — this is not an optional nicety. `PropertyLabel` may be omitted (StarUML's own samples do).
- A visible system boundary is `UMLSubsystem` + `UMLSubsystemView`. `UMLSystemBoundaryView` exists but draws an unnamed rectangle.
- GUIDs are opaque 24-character base64 strings that StarUML's own files end with `AA`; they must be unique. References are the raw GUID as element text: `<XPD:REF name="Model">…</XPD:REF>`.
- Inverse collections are stored, not derived: `Views` on anything a view references through `Model`, `Associations` on classifiers (`Participant`), `Outgoings`/`Incomings` on state vertices (`Source`/`Target`). They must list the same GUIDs in document order — `scripts/xpd.js` computes them.
- Write flat XML (no indentation), UTF-8, no BOM.
- A diagram is `OwnedDiagrams[i]` under its owner, and its views live in `DiagramView` (`<Kind>DiagramView`) → `OwnedViews[i]`. Node views carry `Left/Top/Width/Height` plus `Model`; edge views carry `Points` (`"x,y;x,y"`), `Head`/`Tail` (view GUIDs, not model GUIDs) and label views.
- StarUML 5 is UML 1.4, so names differ from UML 2 habits: include stores `Base`/`Addition`; association ends store `Participant`/`Multiplicity`/`IsNavigable`; class members are `Attributes`/`Operations` (+ `Parameters` with a `pdkReturn` parameter for the return type); activity nodes are `UMLActionState`, `UMLPseudostate` (kind), `UMLFinalState` with `UMLTransition` flows carrying `GuardCondition`.
- Content of activity/statechart diagrams hangs off a state machine: `UMLActivityGraph` (or `UMLStateMachine`) → `Top` composite state → `Subvertices[i]` and `Transitions[i]`; the diagram itself is owned by that graph (`DiagramOwner` = graph).
- Class/action views store only `NameCompartment` (+ `NameLabel`/`StereotypeLabel`/`PropertyLabel`); attribute and operation rows are regenerated by the app from the model, so never emit them.
- On open the app re-renders from stored geometry, so the coordinates decide the layout. Give shapes enough width/height for their text, keep edges short and orthogonal where possible, and keep multiplicity/guard labels clear of lines.

## Workflow

1. Fix the diagram kind, the element list and the layout on paper (rows/columns), then read the matching table in [references/format.md](references/format.md).
2. Write a small generator that builds the tree with `scripts/xpd.js` and serializes it; keep the content data (nodes, edges, members) separate from the XML mechanics.
3. Validate: `python scripts/validate_xpd.py out.uml`. On top of XML/GUID/counter checks it rejects decimal `Points`, lowercase booleans, bad attribute types, malformed relationships, edge ends that point at model elements, and association views missing their end labels. When StarUML's samples are present it also flags types/fields they never use.
4. **Open it in StarUML 5 — static checks are not enough.** `pwsh -File scripts/open_check.ps1 -File .\out.uml` launches the app, polls the window title and exits `0` LOADED / `1` ERROR dialog / `2` NO-DOCUMENT. A structurally perfect file can still crash the app, and a file that never parses looks identical to "nothing there".
5. Deliver the `.uml`, plus a rendered preview image when the user benefits from checking the layout without opening the tool.

For a use case project, start from `scripts/example_usecase.js` instead of the blank boilerplate: it already has the boundary, the full association label set, include, extend and generalization wired up.

## Troubleshooting

| What you see | First thing to try |
| --- | --- |
| `无法打开模型文件。文件格式无效` | The file is not XPD XML (usually StarUML 6/7 JSON, PlantUML or XMI). Check the first line. |
| `'291.13' is not a valid integer value.` (sometimes just an empty window) | A `Points` attribute has a decimal or `NaN`. Round every coordinate. |
| `Access violation at address … read of address 00000038` | An `UMLAssociationView` is missing its end labels/qualifier compartments, or `Head`/`Tail` do not reference view GUIDs. |
| Empty window, title bar is only `StarUML`, no dialog | Either the file was never parsed (run the validator — look for a bad attribute type or `undefined`) **or** the file name is one StarUML refuses. Copy it to `test.uml`; if the copy opens, rename the deliverable. |
| Diagram tab missing but the model tree is populated | No diagram has `DefaultDiagram=True`. |
| Boundary box has no caption | Switch the view from `UMLSystemBoundaryView` to `UMLSubsystemView`. |

One reproducible naming trap: on a Chinese-locale StarUML 5 install, files whose
name ends with `用例图.uml` opened to an empty window (identical bytes loaded fine
after renaming; `…_子用例图.uml` and names with a suffix were fine). If a file
validates but never parses, rename it before rewriting the XML.

## Files

- [references/format.md](references/format.md) — document skeleton, per-diagram element/view/field tables, geometry and label placement, failure catalogue.
- [scripts/xpd.js](scripts/xpd.js) — XPD tree builder and serializer (GUIDs, counters, inverse collections). `node scripts/xpd.js --self-test` proves it end to end.
- [scripts/example_activity.js](scripts/example_activity.js) — a complete, runnable generator; copy it, swap the node/flow tables, keep the surrounding structure.
- [scripts/example_usecase.js](scripts/example_usecase.js) — the use case counterpart: boundary, actors, associations, include, extend, generalization, several diagrams, geometry helpers. Start here for use case work.
- [scripts/validate_xpd.py](scripts/validate_xpd.py) — static validator described above.
- [scripts/open_check.ps1](scripts/open_check.ps1) — launches StarUML 5 with a file and reports LOADED / ERROR / NO-DOCUMENT (exit 0/1/2). The only check that catches crashes.
- [scripts/mine_metamodel.py](scripts/mine_metamodel.py) — read fields/superclass of metamodel types from the installed sample, or list types by pattern.
- Exemplars in [assets/](assets) — complete use case, class and activity projects. `use-case-diagram-example.uml` comes from StarUML's own samples; `use-case-diagram-full.uml` is the output of `example_usecase.js` and covers every relationship type. Open one when you want a known-good starting point, or diff new output against it.
