#!/usr/bin/env node
'use strict';

/**
 * Worked example: activity diagram with three vertical swimlanes (Partitions).
 *
 *   node example_swimlane.js out.uml
 *   python validate_xpd.py out.uml --require-standard-palette
 *
 * The business content is deliberately generic (after-sales ticket flow); it
 * exists to demonstrate structure, not to be reused as a course deliverable.
 *
 * Facts this example encodes (learned from StarUML 5.0.2, none of them obvious
 * from the metamodel):
 *
 *   1. A lane is a `UMLPartition` stored in the activity graph's `Partitions`
 *      collection, and it points back with an **`ActivityGraph`** reference -
 *      NOT `Namespace`. Using `Namespace` (or emitting the partition as a plain
 *      owned element) makes the whole diagram render blank.
 *   2. The view is `UMLSwimlaneView`, it carries a single `NameLabel`
 *      (a `LabelView`) - NOT a `NameCompartment`/`UMLNameCompartmentView`.
 *      A NameCompartment child makes the file fail to load.
 *   3. There is no `Direction` attribute on `UMLSwimlaneView`. The direction enum
 *      in the binary is not stored on the view; writing it is rejected.
 *   4. Let `applyDefaultDiagramPalette` own the colours, and emit the lane views
 *      before the node views so the lanes paint behind the activities.
 *   5. Lanes are **decoration only**. StarUML 5.0.2 writes no container link:
 *      no `ContainedViews` on the lane, no `ContainerView` on the activities,
 *      no `OwnerPartitions` on the vertices. Activities are positioned *inside*
 *      the lane rectangle but stay owned by the activity graph's `Top` state.
 *      Dragging a lane therefore does not move the activities.
 *   6. The app paints a small circled "M" marker on every swimlane view. It is
 *      cosmetic and cannot be removed from the file.
 */

const xpd = require('./xpd');

const out = process.argv[2] || 'activity-with-swimlanes.uml';
const A = 1.5707963267949;

const project = new xpd.Elem('DocumentElement', 'UMLProject');
project.attr('Title', 'string', '带泳道的售后工单流程')
  .attr('Author', 'string', '').attr('Company', 'string', '').attr('Copyright', 'string', '');

const model = new xpd.Elem('OwnedElements', 'UMLModel');
model.attr('Name', 'string', '售后系统').ref('Namespace', project.id);
project.add(model);

const graph = new xpd.Elem('OwnedElements', 'UMLActivityGraph');
graph.attr('Name', 'string', '工单处理').ref('Namespace', model.id);
model.add(graph);

const top = new xpd.Elem('Top', 'UMLCompositeState');
top.attr('Name', 'string', 'TOP').ref('StateMachine', graph.id);
graph.add(top);

/* ------------------------------------------------------------------ content */

// lane rectangles: 客服 | 工程师 | 系统
const LANES = [
  { name: '客服', x: 20, y: 20, w: 180, h: 430 },
  { name: '工程师', x: 200, y: 20, w: 200, h: 430 },
  { name: '系统', x: 400, y: 20, w: 330, h: 430 }
];

// kind: action | initial | decision | final
const NODES = [
  { key: 'i', kind: 'initial', x: 290, y: 40, w: 16, h: 16 },
  { key: 'a1', kind: 'action', name: '登记工单', x: 40, y: 90, w: 140, h: 34 },
  { key: 'a2', kind: 'action', name: '核对保修信息', x: 225, y: 90, w: 150, h: 34 },
  { key: 'a3', kind: 'action', name: '查询保修状态', x: 430, y: 90, w: 180, h: 34 },
  { key: 'd1', kind: 'decision', x: 506, y: 150, w: 28, h: 28 },
  { key: 'a4', kind: 'action', name: '生成收费单', x: 430, y: 210, w: 180, h: 34 },
  { key: 'a5', kind: 'action', name: '上门处理', x: 225, y: 210, w: 150, h: 34 },
  { key: 'a6', kind: 'action', name: '关闭工单', x: 225, y: 300, w: 150, h: 34 },
  { key: 'f1', kind: 'final', x: 289, y: 370, w: 22, h: 22 }
];

const FLOWS = [
  { from: 'i', to: 'a1', points: '298,56;110,90' },
  { from: 'a1', to: 'a2', points: '180,107;225,107' },
  { from: 'a2', to: 'a3', points: '375,107;430,107' },
  { from: 'a3', to: 'd1', points: '520,124;520,150' },
  { from: 'd1', to: 'a4', points: '506,164;430,227', guard: '[已过保]', alpha: -A, distance: -30 },
  { from: 'd1', to: 'a5', points: '506,178;410,227', guard: '[在保]', alpha: -A, distance: 30 },
  { from: 'a4', to: 'a5', points: '430,227;375,227' },
  { from: 'a5', to: 'a6', points: '300,244;300,300' },
  { from: 'a6', to: 'f1', points: '300,334;300,370' }
];

const NODE_MODEL = {
  action: 'UMLActionState', initial: 'UMLPseudostate',
  decision: 'UMLPseudostate', final: 'UMLFinalState'
};
const NODE_VIEW = {
  action: 'UMLActionStateView', initial: 'UMLPseudostateView',
  decision: 'UMLPseudostateView', final: 'UMLFinalStateView'
};

/* ------------------------------------------------------------------- build */

// lanes: UMLPartition in graph.Partitions + ActivityGraph reference
for (const lane of LANES) {
  const part = new xpd.Elem('Partitions', 'UMLPartition');
  part.attr('Name', 'string', lane.name).ref('ActivityGraph', graph.id);
  graph.add(part);
  lane.model = part;
}

const nodeModel = new Map();
for (const n of NODES) {
  const el = new xpd.Elem('Subvertices', NODE_MODEL[n.kind]);
  if (n.name) el.attr('Name', 'string', n.name);
  if (n.kind === 'initial') el.attr('PseudostateKind', 'UMLPseudostateKind', 'pkInitial');
  if (n.kind === 'decision') el.attr('PseudostateKind', 'UMLPseudostateKind', 'pkDecision');
  el.ref('ContainerState', top.id);
  top.add(el);
  nodeModel.set(n.key, el);
}

for (const f of FLOWS) {
  const el = new xpd.Elem('Transitions', 'UMLTransition');
  el.ref('StateMachine', graph.id)
    .ref('Source', nodeModel.get(f.from).id)
    .ref('Target', nodeModel.get(f.to).id);
  if (f.guard) el.attr('GuardCondition', 'string', f.guard);
  graph.add(el);
  f.elem = el;
}

const diagram = new xpd.Elem('OwnedDiagrams', 'UMLActivityDiagram');
diagram.attr('Name', 'string', '泳道示例')
  .attr('DefaultDiagram', 'boolean', 'True').ref('DiagramOwner', graph.id);
graph.add(diagram);
const dv = new xpd.Elem('DiagramView', 'UMLActivityDiagramView');
dv.ref('Diagram', diagram.id);
diagram.add(dv);

// lane views first, so they paint behind the nodes
for (const lane of LANES) {
  const v = new xpd.Elem('OwnedViews', 'UMLSwimlaneView');
  v.attr('Left', 'integer', lane.x).attr('Top', 'integer', lane.y)
    .attr('Width', 'integer', lane.w).attr('Height', 'integer', lane.h)
    .ref('Model', lane.model.id);
  const nl = new xpd.Elem('NameLabel', 'LabelView');
  nl.attr('Text', 'string', lane.name);
  v.add(nl);
  dv.add(v);
}

const nodeView = new Map();
for (const n of NODES) {
  const v = new xpd.Elem('OwnedViews', NODE_VIEW[n.kind]);
  v.attr('Left', 'integer', n.x).attr('Top', 'integer', n.y)
    .attr('Width', 'integer', n.w).attr('Height', 'integer', n.h)
    .ref('Model', nodeModel.get(n.key).id);
  if (n.kind === 'action') {
    const nc = new xpd.Elem('NameCompartment', 'UMLNameCompartmentView');
    nc.add(new xpd.Elem('NameLabel', 'LabelView').attr('Text', 'string', n.name));
    nc.add(new xpd.Elem('StereotypeLabel', 'LabelView').attr('Visible', 'boolean', 'False'));
    nc.add(new xpd.Elem('PropertyLabel', 'LabelView').attr('Visible', 'boolean', 'False'));
    v.add(nc);
  }
  dv.add(v);
  nodeView.set(n.key, v);
}

for (const f of FLOWS) {
  const v = new xpd.Elem('OwnedViews', 'UMLTransitionView');
  v.attr('LineStyle', 'LineStyleKind', 'lsOblique')
    .attr('Points', 'Points', f.points)
    .ref('Model', f.elem.id).ref('Head', nodeView.get(f.to).id).ref('Tail', nodeView.get(f.from).id);
  const nl = new xpd.Elem('NameLabel', 'EdgeLabelView');
  nl.attr('Alpha', 'real', f.alpha === undefined ? A : f.alpha)
    .attr('Distance', 'real', f.distance === undefined ? 16 : f.distance);
  if (f.guard) nl.attr('Text', 'string', f.guard);
  else nl.attr('Visible', 'boolean', 'False');
  nl.ref('Model', f.elem.id);
  v.add(nl);
  v.add(new xpd.Elem('StereotypeLabel', 'EdgeLabelView')
    .attr('Visible', 'boolean', 'False').attr('Alpha', 'real', A).attr('Distance', 'real', 30)
    .ref('Model', f.elem.id));
  v.add(new xpd.Elem('PropertyLabel', 'EdgeLabelView')
    .attr('Visible', 'boolean', 'False').attr('Alpha', 'real', -A).attr('Distance', 'real', 15));
  dv.add(v);
}

xpd.applyDefaultDiagramPalette(project);
xpd.writeFile(out, project);
console.log(`wrote ${out} (${LANES.length} lanes, ${NODES.length} nodes, ${FLOWS.length} flows)`);
