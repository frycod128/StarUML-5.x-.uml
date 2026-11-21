# StarUML 5 XPD format reference

Everything here was confirmed against StarUML 5.0.2 and the projects it ships in
`<install>\samples`. Keep new output inside this vocabulary.

## 1. Document skeleton

```xml
<?xml version="1.0" encoding="UTF-8"?>
<XPD:PROJECT xmlns:XPD="http://www.staruml.com" version="1">
<XPD:HEADER>
<XPD:SUBUNITS>
</XPD:SUBUNITS>
<XPD:PROFILES>
<XPD:PROFILE>UMLStandard</XPD:PROFILE>
</XPD:PROFILES>
</XPD:HEADER>
<XPD:BODY>
<XPD:OBJ name="DocumentElement" type="UMLProject" guid="CCCCCCCCCCCCCCCCCCCCCCAA">
<XPD:ATTR name="Documentation" type="string">…</XPD:ATTR>
<XPD:ATTR name="Title" type="string">Project title</XPD:ATTR>
<XPD:ATTR name="Author" type="string"></XPD:ATTR>
<XPD:ATTR name="Company" type="string"></XPD:ATTR>
<XPD:ATTR name="Copyright" type="string"></XPD:ATTR>
<XPD:ATTR name="#OwnedElements" type="integer">1</XPD:ATTR>
<XPD:OBJ name="OwnedElements[0]" type="UMLModel" guid="…">
<XPD:ATTR name="Name" type="string">…</XPD:ATTR>
<XPD:REF name="Namespace">CCCCCCCCCCCCCCCCCCCCCCAA</XPD:REF>
<XPD:ATTR name="#OwnedDiagrams" type="integer">1</XPD:ATTR>
<XPD:OBJ name="OwnedDiagrams[0]" type="UMLClassDiagram" guid="…">
<XPD:ATTR name="Name" type="string">…</XPD:ATTR>
<XPD:ATTR name="DefaultDiagram" type="boolean">True</XPD:ATTR>
<XPD:REF name="DiagramOwner">…model guid…</XPD:REF>
<XPD:OBJ name="DiagramView" type="UMLClassDiagramView" guid="…">
<XPD:REF name="Diagram">…diagram guid…</XPD:REF>
<XPD:ATTR name="#OwnedViews" type="integer">N</XPD:ATTR>
<XPD:OBJ name="OwnedViews[0]" type="UMLClassView" guid="…"> … </XPD:OBJ>
</XPD:OBJ>
</XPD:OBJ>
<XPD:ATTR name="#OwnedElements" type="integer">M</XPD:ATTR>
<XPD:OBJ name="OwnedElements[0]" type="UMLClass" guid="…"> … </XPD:OBJ>
</XPD:OBJ>
</XPD:OBJ>
</XPD:BODY>
</XPD:PROJECT>
```

Notes

- Order of `ATTR`/`REF`/`OBJ` children is forgiving, but the collection counter
  `#Field` must still sit next to its collection and match its size.
- `Type="boolean"` values are `True`/`False` (capitalised); integers are plain
  digits; enums are literals. Lowercase `true`/`false` is silently dropped.
- `Type="Points"` values are **integer** pairs only: `"120,80;340,80"`. A decimal
  or `NaN` anywhere makes StarUML show
  `'291.13' is not a valid integer value.` and refuse the whole project. Round
  the coordinates when the geometry helpers return floats.
- Every `ATTR` needs a real XPD type name (`string`, `integer`, `boolean`,
  `real`, `Points`, `UMLVisibilityKind`, …). Calling the builder as
  `attr('Title', '图书管理系统用例图')` writes the title into `@type` and
  serialises `undefined` as the value; the file validates as XML but never opens.
- Views and model elements are separate trees: a view points at its model element with
  `<XPD:REF name="Model">`, and the element lists the views back through `Views[i]`.
- Unless the user explicitly requests other colors, call
  `xpd.applyDefaultDiagramPalette(project)` before serialization. It preserves
  explicit colors and adds line `$000E0E87`, fill `$00B9FFFF`, and font
  `$00010000` to every View.

## 2. Namespaces and diagrams

| Element | Fields that matter |
| --- | --- |
| `UMLProject` | `Documentation`, `Title`, `Author`, `Company`, `Copyright`, `OwnedElements[]` |
| `UMLModel` / `UMLPackage` | `Name`, `Namespace` (REF), `OwnedDiagrams[]`, `OwnedElements[]` |
| `<Kind>Diagram` (`UMLUseCaseDiagram`, `UMLClassDiagram`, `UMLActivityDiagram`, `UMLStatechartDiagram`, …) | `Name`, `DefaultDiagram` (boolean), `DiagramOwner` (REF), child `DiagramView` |
| `<Kind>DiagramView` | `Diagram` (REF), `OwnedViews[]` |

The diagram is owned by whatever the user drew it in: a package/model
(`OwnedDiagrams` + `DiagramOwner` = that namespace) or a state machine
(`OwnedDiagrams` + `DiagramOwner` = the `UMLActivityGraph`/`UMLStateMachine`).

## 3. Use case diagram

### Model elements

```xml
<XPD:OBJ name="OwnedElements[0]" type="UMLActor" guid="…">
<XPD:ATTR name="Name" type="string">客服</XPD:ATTR>
<XPD:REF name="Namespace">…model…</XPD:REF>
<XPD:ATTR name="#Views" type="integer">3</XPD:ATTR>     <!-- view + 2 compartments -->
<XPD:REF name="Views[0]">…actor view…</XPD:REF>
<XPD:ATTR name="#Associations" type="integer">1</XPD:ATTR>
<XPD:REF name="Associations[0]">…UMLAssociationEnd guid…</XPD:REF>
</XPD:OBJ>

<XPD:OBJ name="OwnedElements[1]" type="UMLUseCase" guid="…">   <!-- Name, Namespace, #Views, #Associations -->

<XPD:OBJ name="OwnedElements[2]" type="UMLAssociation" guid="…">
<XPD:REF name="Namespace">…model…</XPD:REF>
<XPD:ATTR name="#Views" type="integer">4</XPD:ATTR>            <!-- association view + 3 labels -->
<XPD:ATTR name="#Connections" type="integer">2</XPD:ATTR>
<XPD:OBJ name="Connections[0]" type="UMLAssociationEnd" guid="…">   <!-- order is arbitrary, see note -->
<XPD:ATTR name="Multiplicity" type="string">1</XPD:ATTR>            <!-- optional -->
<XPD:ATTR name="IsNavigable" type="boolean">True</XPD:ATTR>         <!-- optional; True draws the arrow -->
<XPD:REF name="Association">…association…</XPD:REF>
<XPD:REF name="Participant">…actor or use case…</XPD:REF>
<XPD:ATTR name="#Views" type="integer">4</XPD:ATTR>                 <!-- Head/Tail RoleName, Multiplicity, Property, Qualifier -->
</XPD:OBJ>
<XPD:OBJ name="Connections[1]" type="UMLAssociationEnd" guid="…">
</XPD:OBJ>

<XPD:OBJ name="OwnedElements[3]" type="UMLInclude" guid="…">   <!-- arrow Base -> Addition -->
<XPD:REF name="Namespace">…model…</XPD:REF>
<XPD:REF name="Addition">…included use case…</XPD:REF>   <!-- target -->
<XPD:REF name="Base">…including use case…</XPD:REF>      <!-- source -->
</XPD:OBJ>

<XPD:OBJ name="OwnedElements[4]" type="UMLExtend" guid="…">    <!-- arrow Extension -> Base -->
<XPD:REF name="Namespace">…model…</XPD:REF>
<XPD:REF name="Base">…extended use case…</XPD:REF>       <!-- the arrow head -->
<XPD:REF name="Extension">…extending use case…</XPD:REF> <!-- the arrow tail -->
<XPD:ATTR name="Condition" type="string">超期</XPD:ATTR>  <!-- optional -->
</XPD:OBJ>

<XPD:OBJ name="OwnedElements[5]" type="UMLGeneralization" guid="…">   <!-- arrow Child -> Parent -->
<XPD:REF name="Namespace">…model…</XPD:REF>
<XPD:REF name="Child">…sub actor…</XPD:REF>
<XPD:REF name="Parent">…parent actor…</XPD:REF>
</XPD:OBJ>
```

`Connections[]` order is **not** significant: StarUML resolves each end through
`Participant`. Its own samples store the head end first in one file and the tail
end first in another, so do not key anything off the index.

### System boundary

Use `UMLSubsystem` in the model and **`UMLSubsystemView`** in the diagram. It
renders the familiar boundary rectangle with the name at the top:

```xml
<XPD:OBJ name="OwnedElements[0]" type="UMLSubsystem" guid="…">
<XPD:ATTR name="Name" type="string">图书管理系统</XPD:ATTR>
<XPD:REF name="Namespace">…model…</XPD:REF>
</XPD:OBJ>
```

`UMLSystemBoundaryView` also exists and draws a plain rectangle, but it does not
show the model element's name — only use it when an anonymous box is wanted.

### Views

| View | Children besides `Left/Top/Width/Height` + `Model` |
| --- | --- |
| `UMLActorView` | `NameCompartment` (`NameLabel` with `FontStyle` 1 and `Text`, `StereotypeLabel` `Visible=False`, `PropertyLabel` `Visible=False`), `AttributeCompartment` (`Visible=False` + `Model`), `OperationCompartment` (`Visible=False` + `Model`) |
| `UMLUseCaseView` | same as actor plus `ExtensionPointCompartment` (`Visible=False`) |
| `UMLAssociationView` | `Points`, `Head` (head view), `Tail` (tail view), `NameLabel`, `StereotypeLabel`, `PropertyLabel`, `HeadRoleNameLabel`, `TailRoleNameLabel`, `HeadMultiplicityLabel`, `TailMultiplicityLabel`, `HeadPropertyLabel`, `TailPropertyLabel`, `HeadQualifierCompartment`, `TailQualifierCompartment` |
| `UMLIncludeView` | `Points`, `Head`, `Tail`, `NameLabel`, `StereotypeLabel` (text `<<include>>`), `PropertyLabel` |
| `UMLExtendView` | same as include with text `<<extend>>` |
| `UMLGeneralizationView` | `Points`, `Head`, `Tail`, `NameLabel`, `StereotypeLabel`, `PropertyLabel` (all three hidden) |
| `UMLSubsystemView` | `NameCompartment` + hidden `AttributeCompartment`/`OperationCompartment` (same shape as `UMLActorView`) |

Label rules: the three main edge labels reference the relationship through `Model`;
each end-specific label references its `UMLAssociationEnd` guid and carries
`EdgePosition` = `epHead` / `epTail`. Hidden labels are still emitted with
`<XPD:ATTR name="Visible" type="boolean">False</XPD:ATTR>`.

**The association's end labels are not cosmetic.** StarUML 5 dereferences them
while building the diagram: omit `HeadRoleNameLabel` … `TailQualifierCompartment`
and opening the file raises
`Access violation at address … in module 'StarUML.exe', read of address 00000038`.
Emit all ten; `PropertyLabel` is the only one the official samples sometimes omit.
`HeadQualifierCompartment`/`TailQualifierCompartment` are
`UMLQualifierCompartmentView` with `Visible=False`, `Left/Top/Width/Height` 0/0/50/8,
and `Model` = the corresponding end guid (that is what gives the end its 4 `Views`).

For include/extend/generalization the arrow head is the *target*: `Head` = the view
of `Addition` (include), `Base` (extend) or `Parent` (generalization); `Tail` = the
view of `Base` (include), `Extension` (extend) or `Child` (generalization).

A ready-made generator for all of the above is
[`scripts/example_usecase.js`](../scripts/example_usecase.js); its output is
[`assets/use-case-diagram-full.uml`](../assets/use-case-diagram-full.uml).

## 4. Class diagram

Model elements

```xml
<XPD:OBJ name="OwnedElements[0]" type="UMLClass" guid="…">
<XPD:ATTR name="Name" type="string">Book</XPD:ATTR>
<XPD:REF name="Namespace">…model…</XPD:REF>
<XPD:ATTR name="#Views" type="integer">4</XPD:ATTR>          <!-- class view + 3 compartments -->
<XPD:ATTR name="#Attributes" type="integer">5</XPD:ATTR>
<XPD:OBJ name="Attributes[0]" type="UMLAttribute" guid="…">
<XPD:ATTR name="Name" type="string">bookId</XPD:ATTR>
<XPD:ATTR name="Visibility" type="UMLVisibilityKind">vkPublic</XPD:ATTR>
<XPD:ATTR name="TypeExpression" type="string">Integer</XPD:ATTR>
<XPD:REF name="Owner">…class…</XPD:REF>
</XPD:OBJ>
<XPD:ATTR name="#Operations" type="integer">2</XPD:ATTR>
<XPD:OBJ name="Operations[0]" type="UMLOperation" guid="…">
<XPD:ATTR name="Name" type="string">borrowBook</XPD:ATTR>
<XPD:REF name="Owner">…class…</XPD:REF>
<XPD:ATTR name="#Parameters" type="integer">2</XPD:ATTR>
<XPD:OBJ name="Parameters[0]" type="UMLParameter" guid="…">   <!-- input parameter -->
<XPD:ATTR name="Name" type="string">book</XPD:ATTR>
<XPD:ATTR name="TypeExpression" type="string">Book</XPD:ATTR>
<XPD:REF name="BehavioralFeature">…operation…</XPD:REF>
</XPD:OBJ>
<XPD:OBJ name="Parameters[1]" type="UMLParameter" guid="…">   <!-- return type lives in a pdkReturn parameter, no Name -->
<XPD:ATTR name="DirectionKind" type="UMLParameterDirectionKind">pdkReturn</XPD:ATTR>
<XPD:ATTR name="TypeExpression" type="string">Boolean</XPD:ATTR>
<XPD:REF name="BehavioralFeature">…operation…</XPD:REF>
</XPD:OBJ>
</XPD:OBJ>
<XPD:ATTR name="#Associations" type="integer">1</XPD:ATTR>
<XPD:REF name="Associations[0]">…UMLAssociationEnd guid…</XPD:REF>
</XPD:OBJ>
```

Views: `UMLClassView` = `Left/Top/Width/Height`, `Model`, `NameCompartment`
(+ `NameLabel`/`StereotypeLabel`/`PropertyLabel`), `AttributeCompartment` (+ `Model`),
`OperationCompartment` (+ `Model`), `TemplateParameterCompartment`
(`Visible=False` + `Model`). Do **not** emit attribute/operation row views — the app
rebuilds them from `Attributes`/`Operations` when it draws.

Association view: identical shape to the use case one, including multiplicity labels
(`HeadMultiplicityLabel`/`TailMultiplicityLabel` with `Text` such as `1`, `*`) and
`IsNavigable` on the end that should show an arrow.

## 5. Activity diagram (UML 1.4 names)

Content hangs off an activity graph, which is an owned element of the namespace:

```xml
<XPD:OBJ name="OwnedElements[0]" type="UMLActivityGraph" guid="…">
<XPD:ATTR name="Name" type="string">借书流程</XPD:ATTR>
<XPD:REF name="Namespace">…model…</XPD:REF>
<XPD:OBJ name="Top" type="UMLCompositeState" guid="…">
<XPD:ATTR name="Name" type="string">TOP</XPD:ATTR>
<XPD:REF name="StateMachine">…activity graph…</XPD:REF>
<XPD:ATTR name="#Subvertices" type="integer">11</XPD:ATTR>
<XPD:OBJ name="Subvertices[0]" type="UMLActionState" guid="…">
<XPD:ATTR name="Name" type="string">扫描图书条码</XPD:ATTR>
<XPD:REF name="ContainerState">…Top…</XPD:REF>
<XPD:ATTR name="#Views" type="integer">2</XPD:ATTR>
<XPD:ATTR name="#Outgoings" type="integer">1</XPD:ATTR>
<XPD:ATTR name="#Incomings" type="integer">1</XPD:ATTR>
</XPD:OBJ>
<XPD:OBJ name="Subvertices[1]" type="UMLPseudostate" guid="…">      <!-- initial / decision -->
<XPD:ATTR name="PseudostateKind" type="UMLPseudostateKind">pkInitial</XPD:ATTR>   <!-- or pkDecision -->
<XPD:REF name="ContainerState">…Top…</XPD:REF>
</XPD:OBJ>
<XPD:OBJ name="Subvertices[2]" type="UMLFinalState" guid="…">       <!-- the bull's-eye -->
<XPD:REF name="ContainerState">…Top…</XPD:REF>
</XPD:OBJ>
</XPD:OBJ>
<XPD:ATTR name="#Transitions" type="integer">12</XPD:ATTR>          <!-- owned by the GRAPH, not by Top -->
<XPD:OBJ name="Transitions[0]" type="UMLTransition" guid="…">
<XPD:REF name="StateMachine">…activity graph…</XPD:REF>
<XPD:REF name="Source">…source node…</XPD:REF>
<XPD:REF name="Target">…target node…</XPD:REF>
<XPD:ATTR name="GuardCondition" type="string">[有效]</XPD:ATTR>      <!-- what the user types in Guard -->
</XPD:OBJ>
<XPD:ATTR name="#OwnedDiagrams" type="integer">1</XPD:ATTR>
<XPD:OBJ name="OwnedDiagrams[0]" type="UMLActivityDiagram" guid="…">
<XPD:ATTR name="Name" type="string">借书流程活动图</XPD:ATTR>
<XPD:ATTR name="DefaultDiagram" type="boolean">True</XPD:ATTR>
<XPD:REF name="DiagramOwner">…activity graph…</XPD:REF>
<XPD:OBJ name="DiagramView" type="UMLActivityDiagramView" guid="…"> … </XPD:OBJ>
</XPD:OBJ>
</XPD:OBJ>
```

Views per node kind

| Element | View type | Stored children |
| --- | --- | --- |
| `UMLActionState` | `UMLActionStateView` | `NameCompartment` (`NameLabel` `FontStyle=1` + `Text`, hidden stereotype/property labels) |
| `UMLPseudostate` | `UMLPseudostateView` | none — only `Left/Top/Width/Height` + `Model` |
| `UMLFinalState` | `UMLFinalStateView` | none |
| `UMLTransition` | `UMLTransitionView` | `LineStyle`, `Points`, `Model`, `Head`, `Tail`, `NameLabel` (guard text), `StereotypeLabel`, `PropertyLabel` |

Samples of the same shape: statechart diagrams in
`samples\Satellite Operation System.uml` use `UMLStateMachine` → `Top` →
`Subvertices`/`Transitions` with `UMLStateView`/`UMLPseudostateView`/`UMLTransitionView`.
`UMLStateView` additionally stores `InternalTransitionCompartment`.

## 6. Geometry

- `Points` is `"x1,y1;x2,y2[;…]"` in absolute canvas coordinates (origin top-left),
  **integers only**. The first point belongs to the `Tail` view, the last to the
  `Head` view. Compute the border intersections with floats, then round:
  `Math.round(x)` — never emit the raw result.
- Straight edges: `LineStyle` `lsOblique` with two points. Routed edges:
  `lsRectilinear` with the corner points spelled out (e.g. `140,380;140,695;370,695`).
- Endpoints should sit on the shape border: rectangles via line/rect intersection,
  ellipses via the ellipse equation. For actor figures clip to the upper part of the
  view rectangle so the line meets the figure, not the name label.
- Named elements (e.g. `多对多`) put the text in the model element's `Name`; the
  association view's `NameLabel` shows it, so leave that label visible.
- Edge label placement is computed by the app: a label view stores `Alpha` and
  `Distance`, and the offset from the middle of its segment is
  `(distance·cos(th+alpha), −distance·sin(th+alpha))` where `th` is the angle of
  `tailPoint − headPoint` (see the sample values). For a downward edge
  `Alpha = 1.5707963267949` puts the text to the right of the line, `-1.5707963267949`
  to the left; `Distance` 15/25/30/40 are the usual insets.
- Give every node a size that fits its longest line of text: class/action boxes need
  roughly `7 px × characters` plus padding, use-case ellipses about `10 px × characters`.

## 7. Failure catalogue

| Symptom in StarUML | Cause |
| --- | --- |
| 无法打开模型文件。文件格式无效 modal, nothing loads | File is not XPD XML (typically StarUML 6 JSON, or PlantUML/XMI) |
| `'291.13' is not a valid integer value.` modal, or an empty window | `Points` contains decimals or `NaN`; round every coordinate |
| `Access violation at address … read of address 00000038` right after opening | `UMLAssociationView` is missing one of its end-label / qualifier children (see §3); a sequence stimulus view lacks its nested `UMLActivationView` while `ShowActivation=True`; or an edge `Head`/`Tail` points at a non-view |
| App opens on an empty window: title bar reads just `StarUML`, no error dialog | The file was never parsed. Either a malformed `ATTR` (type is not an XPD type name, value is `undefined`) or a file name StarUML refuses — renaming usually tells you which (see SKILL.md → Troubleshooting) |
| Diagram canvas empty although the file loaded | No diagram is marked `DefaultDiagram=True`; double-click one in the Model Explorer |
| File opens, but elements are missing from the explorer/diagram | Dangling GUID reference, or a type name that does not exist in the 5.x metamodel |
| Class/action box renders empty | `NameCompartment`+`NameLabel` missing, or `Model` ref missing on the view |
| Lines not shown / arrows attached nowhere | `Head`/`Tail` point at model GUIDs instead of view GUIDs, or `Points` missing |
| System boundary is a nameless rectangle | Drawn with `UMLSystemBoundaryView`; use `UMLSubsystem` + `UMLSubsystemView` to show the caption |
| Multiplicity/guard text missing | `Multiplicity`/`GuardCondition` not set on the model element (the app re-renders label text) |
| Transitions ignored in an activity/statechart diagram | `Transitions` emitted inside `Top` instead of the state machine |
| Whole activity diagram blank after adding a lane | Partition attached with `Namespace` instead of `ActivityGraph`, view built from `NameCompartment`, or the non-existent `UMLPartitionView` / `Direction` used |
| State box renders without `entry /` / `exit /` lines | `EntryActions` / `ExitActions` / `DoActivities` not listed in `arrayFields`, so no `#…` counter was written and the app dropped the collection |
| `InternalTransitions` written by hand is ignored | 5.0.2 has no such feature; use a `UMLTransition` with `Source` = `Target` (see §9) |
| Duplicate/ghost shapes | Missing inverse collections (`Views`, `Associations`, `Outgoings`, `Incomings`) or counters that disagree with the actual child count |
| Chinese text garbled | File not UTF-8 (write UTF-8 without BOM; escape `&`, `<`, `>`) |


## 8. Activity diagram: swimlanes (Partition + SwimlaneView)

Verified against StarUML 5.0.2 by drawing a lane in the GUI and diffing the saved
file. A lane is a pair: one model element on the activity graph plus one view.

```xml
<!-- model: child of UMLActivityGraph, reference name is ActivityGraph (NOT Namespace) -->
<XPD:OBJ name="Partitions[0]" type="UMLPartition" guid="…">
<XPD:ATTR name="Name" type="string">客服</XPD:ATTR>
<XPD:REF name="ActivityGraph">…activity graph guid…</XPD:REF>
<XPD:ATTR name="#Views" type="integer">1</XPD:ATTR>
<XPD:REF name="Views[0]">…swimlane view guid…</XPD:REF>     <!-- written by xpd.js -->
</XPD:OBJ>

<!-- view: child of DiagramView.OwnedViews, only a NameLabel - no compartments -->
<XPD:OBJ name="OwnedViews[0]" type="UMLSwimlaneView" guid="…">
<XPD:ATTR name="LineColor" type="string">$000E0E87</XPD:ATTR>
<XPD:ATTR name="FillColor" type="string">$00B9FFFF</XPD:ATTR>
<XPD:ATTR name="FontColor" type="string">$00010000</XPD:ATTR>
<XPD:ATTR name="Left" type="integer">20</XPD:ATTR>
<XPD:ATTR name="Top" type="integer">20</XPD:ATTR>
<XPD:ATTR name="Width" type="integer">180</XPD:ATTR>
<XPD:ATTR name="Height" type="integer">430</XPD:ATTR>
<XPD:REF name="Model">…partition guid…</XPD:REF>
<XPD:OBJ name="NameLabel" type="LabelView" guid="…">
<XPD:ATTR name="Text" type="string">客服</XPD:ATTR>
</XPD:OBJ>
</XPD:OBJ>
```

Facts that are not obvious from the metamodel and each of which can blank the
whole diagram:

1. The reference is **`ActivityGraph`**. `Namespace` is accepted by the writer but
   the partition then has no owning graph and nothing renders.
2. The view type is `UMLSwimlaneView`. There is a `PartitionView` string in the
   binary (a COM interface name), but `UMLPartitionView` is not a stored type:
   emitting it drops every view in the diagram.
3. The view's only child is `NameLabel`. A `NameCompartment`
   (`UMLNameCompartmentView`) makes the file fail to load.
4. There is **no `Direction` attribute**. `UMLSwimlaneDirectionKind` exists in the
   binary but is not stored on the view; writing a `Direction` attribute errors.
5. Colour: let `applyDefaultDiagramPalette` style the view like any other. Do not
   hand-write `LineColor` / `FillColor` if the project must pass
   `validate_xpd.py --require-standard-palette`.
6. **A circled `(M)` inside the lane means the partition was not emitted as a
   collection.** `Partitions` must be listed in `arrayFields`; if it is not, the
   child is written as `name="Partitions"` with no `[i]` and no `#Partitions`
   counter, the app cannot bind it to its partition collection, and it paints a
   placeholder marker instead. Lanes drawn by hand in the GUI never show the
   marker because the app always writes the indexed form. `Partitions` was added
   to `xpd.DEFAULT_ARRAY_FIELDS`; older copies of `xpd.js` need it passed
   explicitly.
7. Emit the lane views **before** the node views in `DiagramView.OwnedViews` so
   the lanes paint behind the activities.

Ownership: a lane owns nothing. The saved file contains no `ContainedViews`, no
`ContainerView` and no `OwnerPartitions`; activities stay `Subvertices` of the
graph's `Top` composite state and merely sit geometrically inside the lane
rectangle. Dragging a lane therefore leaves the activities behind — this is a
property of the tool, not of the file.

See `scripts/example_swimlane.js` and `assets/activity-with-swimlanes.uml`.

## 9. Statechart internals: entry / do / exit, and the internal-transition reality

### 9.1 Internal activities (they do render, in the box)

A state carries three action collections. Items are `UMLUninterpretedAction`
with a `Name` and an `Owner` reference; no view is needed, the state view's
`InternalTransitionCompartment` paints them as `entry / …`, `do / …`, `exit / …`.

```xml
<XPD:OBJ name="Subvertices[2]" type="UMLCompositeState" guid="…">
<XPD:ATTR name="Name" type="string">已支付</XPD:ATTR>
<XPD:REF name="ContainerState">…Top…</XPD:REF>
<XPD:ATTR name="#EntryActions" type="integer">1</XPD:ATTR>
<XPD:OBJ name="EntryActions[0]" type="UMLUninterpretedAction" guid="…">
<XPD:ATTR name="Name" type="string">记录支付时间</XPD:ATTR>
<XPD:REF name="Owner">…state guid…</XPD:REF>
</XPD:OBJ>
<XPD:ATTR name="#ExitActions" type="integer">1</XPD:ATTR>
<XPD:OBJ name="ExitActions[0]" type="UMLUninterpretedAction" guid="…">
<XPD:ATTR name="Name" type="string">释放库存锁定</XPD:ATTR>
<XPD:REF name="Owner">…state guid…</XPD:REF>
</XPD:OBJ>
<XPD:OBJ name="InternalTransitionCompartment" type="UMLInternalTransitionCompartmentView" guid="…">
<XPD:REF name="Model">…state guid…</XPD:REF>
</XPD:OBJ>
```

**The silent trap:** emitting these collections without listing them in
`arrayFields` gives each child no `#EntryActions` counter - the child is written as
`name="EntryActions"` instead of `EntryActions[0]` - and the app silently drops the
whole collection: the box renders name-only, with no error dialog. They are in
`xpd.DEFAULT_ARRAY_FIELDS` now, but pass them explicitly if you use an older copy:

```js
const ARRAYS = xpd.DEFAULT_ARRAY_FIELDS.concat(['EntryActions', 'ExitActions', 'DoActivities']);
xpd.writeFile(out, project, { arrayFields: ARRAYS });
```

### 9.2 Internal transitions: not supported in 5.0.2

Confirmed twice — by the collection editor of a state (tabs: 入口动作 / 执行动作 /
出口动作 plus a read-only 「关系」 list) and by diffing a file saved after drawing
a self-transition with the 「自转换」 tool:

- the app never writes an `InternalTransitions` field (a hand-authored one is
  silently ignored, and the compartment stays empty);
- the drawn self-transition is stored as an ordinary `UMLTransition` in the state
  machine's `Transitions`, with `Source` and `Target` both pointing at the state;
- with a transition view it paints a **self-loop arrow** and puts the label
  **outside** the state box — never an in-box row.

```xml
<!-- self-transition: the only representation of "state unchanged" -->
<XPD:OBJ name="Transitions[7]" type="UMLTransition" guid="…">
<XPD:REF name="StateMachine">…state machine…</XPD:REF>
<XPD:REF name="Source">…state guid…</XPD:REF>
<XPD:REF name="Target">…state guid…</XPD:REF>
<XPD:ATTR name="Name" type="string">修改收货地址 [未发货] / 更新运单</XPD:ATTR>
</XPD:OBJ>
```

Practical guidance:

- If the deliverable must show "no arrow", emit the self-transition **without** a
  matching `UMLTransitionView`. It then exists in the model (and shows up in the
  state's 「关系」 list) but is not painted.
- If the user needs it visible on the diagram, it will be an arrow — say so
  instead of promising an in-box internal transition.
- Reference sheets that ask for "internal transitions written inside the state
  box" describe UML 2 tools (StarUML 6/7), not this one.
- Note the built-in rule `MSG_VERIFY_ACTIONSTATE_1`: an *action* state may not
  have internal transitions, exit actions or do activities at all.

See `scripts/example_statechart.js` and `assets/statechart-example.uml`.
