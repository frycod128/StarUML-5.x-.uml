# StarUML 5 sequence and communication diagrams

Read this reference when an XPD project must contain `UMLSequenceDiagram` or
`UMLCollaborationDiagram` (the StarUML 5 name for a communication diagram).

The shapes below were calibrated against StarUML 5.0.2 interaction projects and
the strings/types in the installed `StarUML.exe`. The `.uml` format is UML 1.4:
views and model elements are separate trees, and every `Views` collection is a
stored inverse, not something StarUML derives while opening the file.

## Load gate

Static XML validity is necessary but not sufficient. These different outcomes
must not be conflated:

| Evidence | Meaning |
| --- | --- |
| `StarUML.exe` process exists | The application started. It does **not** mean the file loaded. |
| Main window titled only `StarUML`, New Project dialog, or blank canvas | `NO-DOCUMENT` / failed load. |
| Window titled `StarUML - <requested basename>` with no `TNewProjectForm` / `TMessageForm` and a visible `TdxTabSheet` | The basic document-load gate passed. Continue by checking the Model Explorer and the expected default diagram. |
| Target title plus New Project dialog or error dialog | Failed load. The title can be set before parsing succeeds. |
| A rendered preview made outside StarUML | A diagram preview. It is not evidence of a successful application load and it is not a process screenshot. |

`scripts/open_check.ps1` closes **all** running StarUML instances. Use it only
after the user has authorized desktop interaction and accepts that any open
StarUML work will be closed. Run checks one at a time; parallel checks kill each
other and can produce a false `ERROR` or a stale `LOADED`. The helper rejects
startup/error dialogs and requires a visible document tab. Dismissing the New
Project dialog is an explicit `-DismissNewProjectDialog` test option, not the
default interpretation of success.

If a file passes XML checks but the live check reports `NO-DOCUMENT`, copy the
same bytes to an ASCII basename (for example `model_check.uml`) and retry before
rewriting valid XML. On the observed Chinese-locale build, some Chinese basenames
failed while the identical project in a Chinese directory loaded under an ASCII
filename. The directory name was not the problem.

## Model hierarchy

A sequence or communication interaction normally hangs from an operation:

```text
UMLModel
└─ UMLClass
   └─ UMLOperation
      └─ UMLCollaborationInstanceSet
         ├─ UMLObject (ParticipatingInstances)
         ├─ UMLInteractionInstanceSet
         │  ├─ UMLStimulus (ParticipatingStimuli)
         │  ├─ UMLCombinedFragment (Fragments)
         │  └─ UMLSequenceDiagram or UMLCollaborationDiagram
         └─ UMLLink (ParticipatingLinks, when a communication diagram uses it)
```

The diagram is owned by `UMLInteractionInstanceSet`:

```xml
<XPD:OBJ name="OwnedDiagrams[0]" type="UMLSequenceDiagram" guid="…">
<XPD:ATTR name="Name" type="string">Order sequence</XPD:ATTR>
<XPD:ATTR name="DefaultDiagram" type="boolean">True</XPD:ATTR>
<XPD:ATTR name="ShowActivation" type="boolean">True</XPD:ATTR>
<XPD:ATTR name="ShowSequenceNumber" type="boolean">True</XPD:ATTR>
<XPD:ATTR name="MessageSignature" type="UMLMessageSignatureKind">mskNameOnly</XPD:ATTR>
<XPD:REF name="DiagramOwner">INTERACTION_INSTANCE_SET_GUID</XPD:REF>
<XPD:OBJ name="DiagramView" type="UMLSequenceDiagramView" guid="…">
<XPD:REF name="Diagram">SEQUENCE_DIAGRAM_GUID</XPD:REF>
<XPD:ATTR name="#OwnedViews" type="integer">N</XPD:ATTR>
…
</XPD:OBJ>
</XPD:OBJ>
```

Use `UMLCollaborationDiagram` and `UMLCollaborationDiagramView` for a
communication diagram. It does not use `ShowActivation`; it normally stores
`ShowSequenceNumber` and `MessageSignature`.

Key model objects:

```xml
<XPD:OBJ name="OwnedCollaborationInstanceSets[0]"
         type="UMLCollaborationInstanceSet" guid="COLLAB">
<XPD:ATTR name="Name" type="string">Order collaboration</XPD:ATTR>
<XPD:REF name="RepresentedOperation">OPERATION_GUID</XPD:REF>
<XPD:ATTR name="#ParticipatingInstances" type="integer">2</XPD:ATTR>
…
<XPD:ATTR name="#InteractionInstanceSets" type="integer">1</XPD:ATTR>
<XPD:OBJ name="InteractionInstanceSets[0]"
         type="UMLInteractionInstanceSet" guid="INTERACTION">
<XPD:ATTR name="Name" type="string">Order interaction</XPD:ATTR>
<XPD:REF name="Context">COLLAB</XPD:REF>
<XPD:ATTR name="#ParticipatingStimuli" type="integer">M</XPD:ATTR>
…
</XPD:OBJ>
</XPD:OBJ>
```

Each `UMLObject` uses:

```xml
<XPD:OBJ name="ParticipatingInstances[0]" type="UMLObject" guid="OBJ_A">
<XPD:ATTR name="Name" type="string">c:Customer</XPD:ATTR>
<XPD:REF name="CollaborationInstanceSet">COLLAB</XPD:REF>
<XPD:ATTR name="#Views" type="integer">N</XPD:ATTR>
…
<XPD:ATTR name="#SendingStimuli" type="integer">…</XPD:ATTR>
…
<XPD:ATTR name="#ReceivingStimuli" type="integer">…</XPD:ATTR>
…
</XPD:OBJ>
```

The loaded UML 1.4 projects represent the classifier in the instance name
(`c:Customer`, `o:OrderSystem`). Do not invent a `Classifier` reference merely
because UML 2 tools show one.

## Stimuli and actions

Every message is one `UMLStimulus`. `Sender` and `Receiver` point at
`UMLObject`s. Each stimulus contains exactly one action subtype as a nested
`Action` object:

| Meaning | Action type | Extra fields |
| --- | --- | --- |
| synchronous call | `UMLCallAction` | — |
| return | `UMLReturnAction` | — |
| create | `UMLCreateAction` | — |
| destroy | `UMLDestroyAction` | — |
| asynchronous send | `UMLSendAction` | `IsAsynchronous=True` |

```xml
<XPD:OBJ name="ParticipatingStimuli[0]" type="UMLStimulus" guid="STIM">
<XPD:ATTR name="Name" type="string">submitOrder</XPD:ATTR>
<XPD:ATTR name="Arguments" type="string">cartId, addressId</XPD:ATTR>
<XPD:ATTR name="Branch" type="string">1</XPD:ATTR>
<XPD:REF name="Sender">OBJ_A</XPD:REF>
<XPD:REF name="Receiver">OBJ_B</XPD:REF>
<XPD:REF name="CommunicationLink">LINK</XPD:REF>
<XPD:REF name="InteractionInstanceSet">INTERACTION</XPD:REF>
<XPD:ATTR name="#Views" type="integer">…</XPD:ATTR>
…
<XPD:OBJ name="Action" type="UMLCallAction" guid="…">
<XPD:REF name="Stimulus">STIM</XPD:REF>
</XPD:OBJ>
</XPD:OBJ>
```

`Arguments` and `Branch` are optional strings. `CommunicationLink` is present
when the stimulus is placed on a communication link; a sequence-only stimulus
may omit it. Keep one source sequence table and use the same operation name,
arguments, sender and receiver when producing both diagrams. If the two diagrams
use separate interaction instance sets, their stimulus GUIDs may differ; the
logical rows must still correspond one-for-one.

## Combined fragment (`alt`)

The installed StarUML 5.0 metamodel defines these twelve
`UMLInteractionOperatorKind` literals:

| Operator | Meaning |
| --- | --- |
| `iokSeq` | sequence |
| `iokAlt` | alternative branches |
| `iokOpt` | optional fragment |
| `iokBreak` | break |
| `iokPar` | parallel |
| `iokStrict` | strict order |
| `iokLoop` | loop |
| `iokRegion` | critical region |
| `iokNeg` | negative |
| `iokAssert` | assertion |
| `iokIgnore` | ignore |
| `iokConsider` | consider |

Use the matching lower-case operator name in `FrameTypeLabel` (`iokAlt` →
`alt`, `iokLoop` → `loop`, and so on).

```xml
<XPD:OBJ name="Fragments[0]" type="UMLCombinedFragment" guid="FRAGMENT">
<XPD:ATTR name="InteractionOperator"
          type="UMLInteractionOperatorKind">iokAlt</XPD:ATTR>
<XPD:REF name="EnclosingInteractionInstanceSet">INTERACTION</XPD:REF>
<XPD:ATTR name="#Operands" type="integer">2</XPD:ATTR>
<XPD:OBJ name="Operands[0]" type="UMLInteractionOperand" guid="OPERAND_1">
<XPD:ATTR name="Guard" type="string">cardValid &amp;&amp; inStock</XPD:ATTR>
<XPD:REF name="CombinedFragment">FRAGMENT</XPD:REF>
</XPD:OBJ>
<XPD:OBJ name="Operands[1]" type="UMLInteractionOperand" guid="OPERAND_2">
<XPD:ATTR name="Guard" type="string">!cardValid || !inStock</XPD:ATTR>
<XPD:REF name="CombinedFragment">FRAGMENT</XPD:REF>
</XPD:OBJ>
</XPD:OBJ>
```

The diagram side uses one frame and one contained view per operand:

```xml
<XPD:OBJ name="OwnedViews[5]" type="UMLCombinedFragmentView" guid="FRAME_VIEW">
<XPD:REF name="Model">FRAGMENT</XPD:REF>
<XPD:OBJ name="NameLabel" type="LabelView">…</XPD:OBJ>
<XPD:OBJ name="FrameTypeLabel" type="LabelView">
<XPD:ATTR name="Text" type="string">alt</XPD:ATTR>
</XPD:OBJ>
<XPD:ATTR name="#ContainedViews" type="integer">2</XPD:ATTR>
<XPD:OBJ name="ContainedViews[0]" type="UMLInteractionOperandView"
         guid="OPERAND_VIEW_1">
<XPD:REF name="Model">OPERAND_1</XPD:REF>
<XPD:REF name="ContainerView">FRAME_VIEW</XPD:REF>
<XPD:OBJ name="GuardLabel" type="LabelView">
<XPD:ATTR name="Text" type="string">[cardValid &amp;&amp; inStock]</XPD:ATTR>
</XPD:OBJ>
</XPD:OBJ>
<XPD:OBJ name="ContainedViews[1]" type="UMLInteractionOperandView"
         guid="OPERAND_VIEW_2">
<XPD:REF name="Model">OPERAND_2</XPD:REF>
<XPD:REF name="ContainerView">FRAME_VIEW</XPD:REF>
<XPD:OBJ name="GuardLabel" type="LabelView">…</XPD:OBJ>
</XPD:OBJ>
</XPD:OBJ>
```

Emit `ContainerView` for every member of `ContainedViews`, pointing back to the
actual containing `UMLCombinedFragmentView`. This is the metamodel inverse and
keeps the document build-independent. One observed 5.0 build tolerated the
missing back-reference and still rendered the operands, so do not describe that
omission as universally fatal; the static validator still requires it.

Use adjacent operand rows whose guards are mutually understandable and whose
model text corresponds exactly to the visible `GuardLabel`. For `alt`, the first
operand is the success branch and the second is the failure/alternate branch.

`UMLInteractionOperand.Fragments` contains nested
`UMLInteractionFragment` elements, such as another `UMLCombinedFragment`. A
message is a `UMLStimulus` and belongs to
`UMLInteractionInstanceSet.ParticipatingStimuli`; never place a Stimulus in
operand `Fragments`.

For messages inside an operand, keep each `UMLSeqStimulusView` in
`UMLSequenceDiagramView.OwnedViews`. Place its `Points` over the operand's
geometry. Nesting the message view under `UMLInteractionOperandView` can load
without an error but make the message disappear.

## Sequence diagram views

### Object and life line

One `UMLSeqObjectView` represents the object head and contains its own
`UMLLifeLineView`:

```xml
<XPD:OBJ name="OwnedViews[0]" type="UMLSeqObjectView" guid="SEQ_OBJ_VIEW">
<XPD:ATTR name="Left" type="integer">30</XPD:ATTR>
<XPD:ATTR name="Top" type="integer">20</XPD:ATTR>
<XPD:ATTR name="Width" type="integer">110</XPD:ATTR>
<XPD:ATTR name="Height" type="integer">525</XPD:ATTR>
<XPD:REF name="Model">OBJ_A</XPD:REF>
<XPD:OBJ name="NameCompartment" type="UMLNameCompartmentView" guid="…">
<XPD:OBJ name="NameLabel" type="LabelView" guid="…">
<XPD:ATTR name="Text" type="string">c:Customer</XPD:ATTR>
</XPD:OBJ>
<XPD:OBJ name="StereotypeLabel" type="LabelView">…</XPD:OBJ>
<XPD:OBJ name="PropertyLabel" type="LabelView">…</XPD:OBJ>
</XPD:OBJ>
<XPD:OBJ name="LifeLine" type="UMLLifeLineView" guid="LIFELINE_A">
<XPD:REF name="Model">OBJ_A</XPD:REF>
</XPD:OBJ>
</XPD:OBJ>
```

`UMLSeqObjectView` is the object's rectangle. Messages do **not** attach to it.
The renderer casts message endpoints to `UMLLifeLineView`.

### Stimulus edge

```xml
<XPD:OBJ name="OwnedViews[6]" type="UMLSeqStimulusView"
         guid="SEQ_STIM_VIEW">
<XPD:ATTR name="LineStyle" type="LineStyleKind">lsRectilinear</XPD:ATTR>
<XPD:ATTR name="Points" type="Points">85,100;263,100</XPD:ATTR>
<XPD:REF name="Model">STIM</XPD:REF>
<XPD:REF name="Head">LIFELINE_B</XPD:REF>
<XPD:REF name="Tail">LIFELINE_A</XPD:REF>
<XPD:OBJ name="NameLabel" type="EdgeLabelView" guid="…">
<XPD:ATTR name="Text" type="string">1 : submitOrder(cartId, addressId)</XPD:ATTR>
<XPD:REF name="Model">STIM</XPD:REF>
<XPD:REF name="HostEdge">SEQ_STIM_VIEW</XPD:REF>
</XPD:OBJ>
…
<XPD:OBJ name="Activation" type="UMLActivationView" guid="…">
<XPD:ATTR name="Left" type="integer">256</XPD:ATTR>
<XPD:ATTR name="Top" type="integer">100</XPD:ATTR>
<XPD:ATTR name="Width" type="integer">14</XPD:ATTR>
<XPD:ATTR name="Height" type="integer">34</XPD:ATTR>
</XPD:OBJ>
</XPD:OBJ>
```

- `Head` is the receiver life line; `Tail` is the sender life line. A self-call
  may use the same life line for both.
- `Head` and `Tail` must be `UMLLifeLineView` GUIDs. Pointing at
  `UMLSeqObjectView` can leave the diagram empty even though the process starts.
- Use integer points. A normal horizontal call has two points with equal Y. A
  self-call is a rectilinear loop with every consecutive segment horizontal or
  vertical.
- `NameLabel`, `StereotypeLabel`, and `PropertyLabel` are `EdgeLabelView`s with
  `Model=STIM` and `HostEdge=SEQ_STIM_VIEW`. Keep hidden labels present and
  `Visible=False`.
- `Activation` is nested inside the stimulus view, not in the diagram's
  `OwnedViews`. When the sequence diagram has `ShowActivation=True`, each
  `UMLSeqStimulusView` must contain one `UMLActivationView` with integer
  `Left/Top/Width/Height`; omitting it has produced
  `Access violation ... read of address 00000038`.

## Communication diagram views

### Object and link

`UMLColObjectView` is the object rectangles; `UMLLinkView` is the connector:

```xml
<XPD:OBJ name="OwnedViews[0]" type="UMLColObjectView" guid="COL_OBJ_A">
<XPD:REF name="Model">OBJ_A</XPD:REF>
<XPD:OBJ name="NameCompartment" type="UMLNameCompartmentView">
<XPD:OBJ name="NameLabel" type="LabelView">
<XPD:ATTR name="Text" type="string">c:Customer</XPD:ATTR>
</XPD:OBJ>
…
</XPD:OBJ>
</XPD:OBJ>

<XPD:OBJ name="OwnedViews[6]" type="UMLLinkView" guid="LINK_VIEW">
<XPD:ATTR name="LineStyle" type="LineStyleKind">lsRectilinear</XPD:ATTR>
<XPD:ATTR name="Points" type="Points">70,54;70,115;320,115;320,200</XPD:ATTR>
<XPD:REF name="Model">LINK</XPD:REF>
<XPD:REF name="Head">COL_OBJ_B</XPD:REF>
<XPD:REF name="Tail">COL_OBJ_A</XPD:REF>
<XPD:OBJ name="NameLabel" type="EdgeLabelView">…</XPD:OBJ>
<XPD:OBJ name="StereotypeLabel" type="EdgeLabelView">…</XPD:OBJ>
<XPD:OBJ name="PropertyLabel" type="EdgeLabelView">…</XPD:OBJ>
<XPD:OBJ name="HeadEndLabel" type="EdgeLabelView">…</XPD:OBJ>
<XPD:OBJ name="TailEndLabel" type="EdgeLabelView">…</XPD:OBJ>
</XPD:OBJ>
```

Every consecutive pair in `Points` must share X or share Y. The start and end
must meet the two object borders; route corners through free channels rather
than across object boxes. `Head` and `Tail` point at `UMLColObjectView`s. Emit
all five edge labels, including hidden ones.

The model link is:

```xml
<XPD:OBJ name="ParticipatingLinks[0]" type="UMLLink" guid="LINK">
<XPD:REF name="CollaborationInstanceSet">COLLAB</XPD:REF>
<XPD:ATTR name="#Connections" type="integer">2</XPD:ATTR>
<XPD:OBJ name="Connections[0]" type="UMLLinkEnd" guid="LINK_END_A">
<XPD:REF name="Instance">OBJ_A</XPD:REF>
<XPD:REF name="Link">LINK</XPD:REF>
</XPD:OBJ>
<XPD:OBJ name="Connections[1]" type="UMLLinkEnd" guid="LINK_END_B">
<XPD:REF name="Instance">OBJ_B</XPD:REF>
<XPD:REF name="Link">LINK</XPD:REF>
</XPD:OBJ>
<XPD:ATTR name="#Stimuli" type="integer">…</XPD:ATTR>
…
</XPD:OBJ>
```

Each `UMLStimulus` used on this link points to it with
`<XPD:REF name="CommunicationLink">LINK</XPD:REF>`; the link lists those
stimulus GUIDs back through `Stimuli`.

### Stimulus label

```xml
<XPD:OBJ name="OwnedViews[12]" type="UMLColStimulusView"
         guid="COL_STIM_VIEW">
<XPD:ATTR name="Width" type="integer">44</XPD:ATTR>
<XPD:ATTR name="Height" type="integer">18</XPD:ATTR>
<XPD:ATTR name="Alpha" type="real">1.5707963267949</XPD:ATTR>
<XPD:ATTR name="Distance" type="real">12</XPD:ATTR>
<XPD:REF name="Model">STIM</XPD:REF>
<XPD:REF name="HostEdge">LINK_VIEW</XPD:REF>
<XPD:OBJ name="NameLabel" type="NodeLabelView" guid="…">
<XPD:ATTR name="Text" type="string">[1] : submitOrder(cartId, addressId)</XPD:ATTR>
<XPD:REF name="Model">STIM</XPD:REF>
</XPD:OBJ>
<XPD:OBJ name="StereotypeLabel" type="NodeLabelView">…</XPD:OBJ>
<XPD:OBJ name="PropertyLabel" type="NodeLabelView">…</XPD:OBJ>
</XPD:OBJ>
```

`HostEdge` must be the connector's `UMLLinkView` GUID. Sequence numbers express
the call hierarchy: top-level calls are `1`, `2`; nested calls under call 1 are
`1.1`, `1.2`; nested calls under `1.1` are `1.1.1`. `Branch` can store the same
number in the model. Use `ShowSequenceNumber` plus generated labels according to
the build, or store complete visible `[n] : message(...)` text explicitly; do not
assume a hidden flag alone guarantees the intended numbering.

## Layout and color

Build the layout from a fixed grid before writing XML:

- Put the active initiating actor/executor in the upper-left. Sequence objects
  follow in columns; communication objects are nodes on a grid.
- Keep sequence message Y values strictly increasing through time and reserve a
  larger vertical span for each `alt` operand.
- Keep communication connectors on shared horizontal/vertical channels; when a
  route needs a bend, use an elbow rather than a diagonal.
- Leave room for argument text, return values, guards, and activation bars.
  Integer geometry is mandatory.
- Keep sequence message views at diagram level. The visual operand is selected
  by coordinates; it is not the message view's `ContainerView`.

StarUML stores colors as a Delphi `TColor` string, not CSS `#RRGGBB`. The bytes
after `$00` are BGR:

| Requested RGB | StarUML string |
| --- | --- |
| `#870e0e` line | `$000E0E87` |
| `#ffffb9` fill | `$00B9FFFF` |
| `#000001` text | `$00010000` |

`scripts/xpd.js` exports `bgrColor('#870e0e')` for this conversion.
Call `xpd.applyDefaultDiagramPalette(project)` before writing. It adds the three
default colors to every View and preserves explicit user overrides.

## Failure catalogue

| Symptom | Check first |
| --- | --- |
| Process starts, title stays only `StarUML`, empty canvas | `NO-DOCUMENT`; validate endpoints, parent views, counters and references; then retry the identical bytes under an ASCII basename. |
| Sequence diagram blank or messages absent | Every `UMLSeqStimulusView.Head/Tail` must reference `UMLLifeLineView`, not `UMLSeqObjectView`. |
| Combined frame opens incorrectly or canvas stays blank | Every operand view should carry `ContainerView` = its actual `UMLCombinedFragmentView` GUID, and the model operand needs `CombinedFragment` back-reference. Also check the operator literal and `FrameTypeLabel` text. |
| `Access violation ... read of address 00000038` on a sequence diagram | Add the missing nested `UMLActivationView` when `ShowActivation=True`; also check message endpoints and association labels. |
| Message exists in the model but is missing inside an operand | Reparent the message view to `DiagramView.OwnedViews`, remove operand `ContainerView`, and place it over the operand with `Points`. |
| Communication lines cross objects or show diagonals | Use `LineStyle=lsRectilinear` and points with equal X or equal Y on every segment. |
| Two diagrams do not correspond | Rebuild both from one message table; verify operation name, arguments, sender, receiver, branch number and action subtype one row at a time. |
| Parallel live checks give contradictory results | `open_check.ps1` kills all StarUML instances. Stop parallel checks and rerun sequentially. |
| Older samples use another XPD namespace | Keep newly generated projects on `http://www.staruml.com`; changing to the old sample's namespace was not the fix for interaction loading. |
