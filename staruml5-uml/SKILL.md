---
name: staruml5-uml
description: "Create or edit StarUML 5 (.uml) project files in the legacy XPD XML format for use case, class, activity, statechart, sequence and communication diagrams. Use when the deliverable must open in StarUML 5.x; StarUML 6/7 projects are JSON (.mdj, _type/_id/ownedElements) and are a different format. This skill is still under development: check https://github.com/frycod128/StarUML-5.x-.uml.git for a newer version before working around a missing feature, and open an issue there if it is still missing."
metadata:
  short-description: Write StarUML 5 XPD XML project files
---

# StarUML 5 (.uml) project files

> **This skill is still under development.** If a feature you need is not covered, first check the repository for a newer version: https://github.com/frycod128/StarUML-5.x-.uml.git — if it is still not covered, please open an issue there.
>
> 本 skill 仍在开发中：遇到未覆盖的功能，请先到 https://github.com/frycod128/StarUML-5.x-.uml.git 查看是否有更新版本；若仍未覆盖，欢迎在仓库提交 issue。

Classic StarUML 5.x is the Delphi build (5.0.2 is common). It reads **XPD XML** projects. It cannot read the StarUML 6/7 `.mdj` JSON format (`_type`/`_id`/`ownedElements`): such a file fails with a modal 错误 / 无法打开模型文件。文件格式无效 (invalid model file) dialog, whatever extension it carries. If the user's version is not already known, settle that first — the two formats are not interchangeable.

Generate the XML with a script; do not hand-write a few thousand lines of `<XPD:OBJ>`.

Sequence and communication diagrams add a model/view graph that is easy to make
XML-valid but renderer-invalid. Read
[references/interaction-diagrams.md](references/interaction-diagrams.md) before
creating either kind.

## Ground truth ships with the application

StarUML 5 usually lives in `C:\Program Files (x86)\StarUML`, but it can be installed on another drive. Resolve it from `STARUML_HOME`, `%ProgramFiles(x86)%`, or by searching for `StarUML.exe`; the bundled scripts do that discovery themselves and accept explicit paths.

| Source | Use it for |
| --- | --- |
| `samples\*.uml` | Real projects (use case, class, statechart) — copy element/view shapes and field sets from them |
| `samples\StarUML Application Model.uml` | StarUML's own metamodel; `scripts/mine_metamodel.py UMLClassView UMLTransition` prints a type's fields and superclass |
| `StarUML.exe` | Type/enum names as plain strings, e.g. `rg -a -o "UML[A-Za-z]*(View\|Diagram)" StarUML.exe` |
| `StarUML.chm` | Help; extract with 7-Zip and read `modeling_with_<kind>_<element>.htm` for the toolbox element list of each diagram kind |

Every `type="..."` in the output must trace back to one of these. Invented type names produce files StarUML refuses or misreads. The shipped samples used by this skill contain no activity or interaction project, so those element sets come from the help pages, the metamodel and observed StarUML-created projects rather than from a shipped sample.

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
- **A running StarUML process or a visible main window is not proof that an `.uml` file loaded.** Invalid or semantically incomplete XPD can leave an empty StarUML window. A file passes the live-open gate only when the Model Explorer shows the expected project/model hierarchy **and** the expected default diagram tab opens with its named elements. Blank canvas, title bar containing only `StarUML`, empty project tree, a New Project dialog, or a fallback empty project must all be treated as load failure.
- `open_check.ps1` must reject a visible `TNewProjectForm` or `TMessageForm` even when the main title already contains the requested filename. A title alone is not evidence; the helper also requires a visible document tab. `-DismissNewProjectDialog` is an explicit test-only opt-in.
- A generated diagram preview is not a process screenshot. Label each artifact accurately and capture a real StarUML window only when the user has authorized desktop use.
- Sequence message endpoints are type-sensitive: `UMLSeqStimulusView.Head` and `.Tail` must reference `UMLLifeLineView` GUIDs, never the enclosing `UMLSeqObjectView`. Communication `UMLLinkView.Head/Tail` reference `UMLColObjectView` GUIDs.
- A view nested through `ContainedViews` must carry `ContainerView` = its actual parent view GUID. In particular, emit `UMLInteractionOperandView.ContainerView` pointing at its `UMLCombinedFragmentView`. Some observed 5.0 builds tolerate the missing inverse, but emitting it preserves the metamodel relationship and avoids build-dependent failures.
- Do not nest a sequence message view under `UMLInteractionOperandView.ContainedViews`. The file may load, but the message disappears. Keep `UMLSeqStimulusView` in `DiagramView.OwnedViews` and place it inside the operand with its `Points`; model containment remains `UMLStimulus.InteractionInstanceSet`.
- `UMLStimulus` is not a `UMLInteractionFragment`. Do not put it in `UMLInteractionOperand.Fragments`; that collection represents nested interaction fragments such as `UMLCombinedFragment` and `UMLInteractionOperand`.
- When a `UMLSequenceDiagram` has `ShowActivation=True`, every `UMLSeqStimulusView` must contain a nested `UMLActivationView`. Omitting it has produced `Access violation ... read of address 00000038`.
- Communication links use `LineStyle=lsRectilinear`; every consecutive pair in `Points` must share X or share Y. Apply the same test to any rectilinear sequence edge.
- A non-ASCII basename is not automatically fatal. If static checks pass but the live check returns `NO-DOCUMENT`, copy the identical bytes to an ASCII basename and retry before rewriting XML. Chinese directory names are not equivalent to a Chinese file basename.
- `scripts/open_check.ps1` terminates all running StarUML instances. Get explicit user authorization around desktop use, run it serially, and never launch parallel open checks.
- Keep new projects in the `http://www.staruml.com` XPD namespace. Some shipped examples use an older namespace; changing to it did not repair interaction loading.
- **Default diagram style:** unless the user explicitly requests other colors, use line color `#870e0e`, fill color `#ffffb9`, and text color `#000001` for all in-diagram elements. Set each applicable view's `LineColor`, `FillColor`, and `FontColor`; call `xpd.applyDefaultDiagramPalette(project)` before serializing so missing colors are added without overwriting explicit overrides. StarUML's own view defaults are black/white, not this palette.
- StarUML color attributes are Delphi BGR strings, not CSS RGB: `#870e0e` → `$000E0E87`, `#ffffb9` → `$00B9FFFF`, `#000001` → `$00010000`.
- **Swimlanes (activity diagrams):** a lane is a `UMLPartition` in the activity graph's `Partitions` collection, and it points back with `<XPD:REF name="ActivityGraph">` — **not** `Namespace`. Its view is a `UMLSwimlaneView` carrying a single `NameLabel` (`LabelView`), **not** a `NameCompartment`; there is no `Direction` attribute. Any of those three mistakes (Namespace ref, NameCompartment, `UMLPartitionView`) makes the whole diagram render blank even though the file loads. See [references/format.md](references/format.md) §8.
- **Swimlanes are decoration only.** StarUML 5.0.2 writes no container link between a lane and its activities — no `ContainedViews` on the lane, no `ContainerView` on the activities, no `OwnerPartitions` on the vertices. Activities are positioned inside the lane rectangle but stay owned by the activity graph's `Top` state, so dragging a lane never moves them. Do not promise the user model-level lane membership.
- **State action compartments:** `EntryActions` / `DoActivities` / `ExitActions` hold `UMLUninterpretedAction` items with a `Name` and an `Owner` back-reference, and they render inside the state box as `entry / …`, `do / …`, `exit / …`. They are **not** in `xpd.DEFAULT_ARRAY_FIELDS`: pass them in `arrayFields` or the app silently drops the collection and the box renders without the lines. See [references/format.md](references/format.md) §9.
- **There is no internal-transition feature in StarUML 5.0.2.** The state's collection editor offers only entry / do / exit actions plus a read-only 「关系」 list, and the app never writes an `InternalTransitions` field (a hand-authored one is ignored). A self-transition — `UMLTransition` in the state machine's `Transitions` with `Source` = `Target` = the state — is the only representation: with a view it paints a self-loop **arrow with the label outside the box**, never an in-box row. To record "state unchanged, no arrow" emit the self-transition **without a view** (it then only appears in the 「关系」 list) and quote it in a table in the report.
- StarUML 5 is UML 1.4, so names differ from UML 2 habits: include stores `Base`/`Addition`; association ends store `Participant`/`Multiplicity`/`IsNavigable`; class members are `Attributes`/`Operations` (+ `Parameters` with a `pdkReturn` parameter for the return type); activity nodes are `UMLActionState`, `UMLPseudostate` (kind), `UMLFinalState` with `UMLTransition` flows carrying `GuardCondition`.
- Content of activity/statechart diagrams hangs off a state machine: `UMLActivityGraph` (or `UMLStateMachine`) → `Top` composite state → `Subvertices[i]` and `Transitions[i]`; the diagram itself is owned by that graph (`DiagramOwner` = graph).
- Class/action views store only `NameCompartment` (+ `NameLabel`/`StereotypeLabel`/`PropertyLabel`); attribute and operation rows are regenerated by the app from the model, so never emit them.
- On open the app re-renders from stored geometry, so the coordinates decide the layout. Give shapes enough width/height for their text, keep edges short and orthogonal where possible, and keep multiplicity/guard labels clear of lines.

## Workflow

1. Fix the diagram kind, the element list and the layout on paper (rows/columns), then read the matching table in [references/format.md](references/format.md). For sequence or communication work, also read [references/interaction-diagrams.md](references/interaction-diagrams.md) and build both diagrams from one message table when they must correspond.
2. Write a small generator that builds the tree with `scripts/xpd.js` and serializes it; keep the content data (nodes, edges, members) separate from the XML mechanics.
3. Validate: `python scripts/validate_xpd.py out.uml --require-standard-palette` unless the user explicitly requested a different palette. On top of XML/GUID/counter checks it rejects decimal `Points`, lowercase booleans, bad attribute types, malformed relationships, edge ends that point at model elements, association views missing their end labels, wrong sequence/link endpoint view types, missing operand `ContainerView` back-references, missing sequence activations, nested sequence message views, and diagonal rectilinear connectors. When StarUML's samples are present it also flags types/fields they never use.
4. **Open it in StarUML 5 — static checks are not enough.** After explicit desktop authorization, `pwsh -File scripts/open_check.ps1 -File .\out.uml -AuthorizeCloseAll` launches a fresh app and exits `0` LOADED / `1` ERROR dialog / `2` NO-DOCUMENT / `3` not authorized / `4` another check is running. It requires the target title, no startup/error dialog, and a visible document tab. New Project dialogs fail by default; `-DismissNewProjectDialog` exists only as an explicit test opt-in. Add `-Screenshot .\open-check.png` after the gate when a visual review artifact is useful. The helper kills every existing StarUML instance, so run it serially and warn the user about open work. Even `LOADED` only proves the basic document tab gate: visually verify that the expected default diagram and named elements are displayed and that the Model Explorer contains the expected project/model hierarchy.
5. Deliver the `.uml`, plus a rendered diagram preview when useful for layout review. Call it a preview or rendering, never a screenshot unless it was captured from the application.

For a use case project, start from `scripts/example_usecase.js` instead of the blank boilerplate: it already has the boundary, the full association label set, include, extend and generalization wired up.

## Troubleshooting

| What you see | First thing to try |
| --- | --- |
| `无法打开模型文件。文件格式无效` | The file is not XPD XML (usually StarUML 6/7 JSON, PlantUML or XMI). Check the first line. |
| `'291.13' is not a valid integer value.` (sometimes just an empty window) | A `Points` attribute has a decimal or `NaN`. Round every coordinate. |
| `Access violation at address … read of address 00000038` | An `UMLAssociationView` is missing end labels/qualifier compartments; a `UMLSeqStimulusView` lacks its nested `UMLActivationView` while `ShowActivation=True`; or an edge `Head`/`Tail` does not reference a view GUID. |
| Empty window, title bar is only `StarUML`, no dialog | Treat this as a failed load, not success. Either the file was never parsed (run the validator — look for a bad attribute type or `undefined`), the XPD has semantically invalid object/view relationships, or the file name is one StarUML refuses. Copy it to `test.uml`; if the copy opens, rename the deliverable. |
| Main title contains the requested filename but New Project or error dialog remains | Failed load. `open_check.ps1` now prioritizes dialogs and document tabs over the title. |
| Diagram tab missing but the model tree is populated | No diagram has `DefaultDiagram=True`. |
| Sequence diagram blank although messages exist in the model | `UMLSeqStimulusView.Head/Tail` probably reference `UMLSeqObjectView`; retarget them to the nested `UMLLifeLineView`s. |
| `alt` frame is missing or the whole document does not load | Each `ContainedViews` operand needs a `ContainerView` reference to the exact parent frame view. Also check the reversed operand `CombinedFragment` references. |
| Communication connector is diagonal or crosses a box | Use `lsRectilinear` and equal-X/equal-Y segments, with bounds taken from the object rectangles. |
| Parallel load checks report opposite results | The helper kills every StarUML process. Stop parallel checks and rerun once; use the mutex/busy result as a signal, not as a model verdict. |
| Whole diagram blank after adding a swimlane (title and tabs still fine) | The partition is attached wrongly: use `Partitions[i]` on the `UMLActivityGraph` with an `ActivityGraph` reference, a `UMLSwimlaneView` whose only child is a `NameLabel`. `Namespace` refs, a `NameCompartment`, `UMLPartitionView` or a `Direction` attribute each blank the whole diagram. |
| State box shows no `entry /` or `exit /` line | The collection was emitted without being listed in `arrayFields`, so no `#EntryActions` counter was written and the app dropped it. Add `EntryActions`/`DoActivities`/`ExitActions` to `arrayFields`. |
| Looking for an internal transition editor | None exists in 5.0.2 — see the invariant above. A self-transition is stored as an ordinary `UMLTransition` with `Source` = `Target`; emitting it without a view keeps it invisible on the diagram. |
| Boundary box has no caption | Switch the view from `UMLSystemBoundaryView` to `UMLSubsystemView`. |

One reproducible naming trap: on a Chinese-locale StarUML 5 install, a file whose
basename ended with `用例图.uml` opened to an empty window while the identical
bytes loaded under an ASCII basename. Treat this as a filename fallback, not a
diagnosis of the XML: copy first and retry, so a genuine structural error is not
hidden by unrelated rewrites.

## Files

- [references/format.md](references/format.md) — document skeleton, per-diagram element/view/field tables, geometry and label placement, failure catalogue.
- [references/interaction-diagrams.md](references/interaction-diagrams.md) — Sequence and communication model/view trees, stimuli/actions, `alt` operands, endpoint invariants, orthogonal routing, BGR colors and interaction-specific failures.
- [scripts/xpd.js](scripts/xpd.js) — XPD tree builder and serializer (GUIDs, counters, inverse collections). `node scripts/xpd.js --self-test` proves it end to end.
- [scripts/example_activity.js](scripts/example_activity.js) — a complete, runnable generator; copy it, swap the node/flow tables, keep the surrounding structure.
- [scripts/example_swimlane.js](scripts/example_swimlane.js) — activity diagram with three `UMLSwimlaneView` lanes; the comment block records every lane trap (ActivityGraph reference, NameLabel-only view, no Direction, palette must own the colors, decoration-only semantics).
- [scripts/example_statechart.js](scripts/example_statechart.js) — statechart with `entry`/`exit` compartments and a view-less self-transition standing in for the unsupported internal transition.
- [scripts/example_usecase.js](scripts/example_usecase.js) — the use case counterpart: boundary, actors, associations, include, extend, generalization, several diagrams, geometry helpers. Start here for use case work.
- [scripts/example_sequence.js](scripts/example_sequence.js) — complete sequence diagram with `alt`, two operands, messages laid over operands, required activations, and the standard palette.
- [scripts/validate_xpd.py](scripts/validate_xpd.py) — static validator described above.
- [scripts/open_check.ps1](scripts/open_check.ps1) — after explicit authorization, closes existing StarUML instances, launches one fresh instance and reports LOADED / ERROR / NO-DOCUMENT (exit 0/1/2; guards return 3/4). Run checks serially.
- [scripts/mine_metamodel.py](scripts/mine_metamodel.py) — read fields/superclass of metamodel types from the installed sample, or list types by pattern.
- Exemplars in [assets/](assets) — complete use case, class, activity, statechart and sequence projects, including `activity-with-swimlanes.uml` and `statechart-example.uml` generated by the two scripts above. `use-case-diagram-example.uml` comes from StarUML's own samples; `use-case-diagram-full.uml`, `activity-diagram-example.uml`, and `sequence-diagram-full.uml` are generated by the corresponding scripts and use the standard palette.
