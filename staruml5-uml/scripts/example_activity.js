#!/usr/bin/env node
'use strict';

/**
 * Worked example: build the 借书流程 activity diagram with the xpd.js library.
 * Copy this file, replace the node/flow tables with the diagram you need, and
 * keep the surrounding structure.
 *
 *   node example_activity.js out.uml
 *   python validate_xpd.py out.uml
 *
 * The same shape works for statechart diagrams: swap UMLActivityGraph for
 * UMLStateMachine, UMLActionState for UMLSimpleState/UMLCompositeState, and the
 * view types accordingly.
 */

const xpd = require('./xpd');

const out = process.argv[2] || 'activity.uml';

/* ------------------------------------------------------------------ content */

// kind: action | initial | decision | final
const NODES = [
  { key: 'n0', kind: 'initial', name: '', left: 370, top: 30, width: 20, height: 20 },
  { key: 'a1', kind: 'action', name: '读者出示图书和借书证', left: 280, top: 80, width: 200, height: 50 },
  { key: 'a2', kind: 'action', name: '扫描借书证，验证身份', left: 280, top: 160, width: 200, height: 50 },
  { key: 'd1', kind: 'decision', name: '', left: 360, top: 240, width: 40, height: 40 },
  { key: 'a3', kind: 'action', name: '提示“读者身份无效”', left: 40, top: 330, width: 200, height: 50 },
  { key: 'a4', kind: 'action', name: '扫描图书条码', left: 280, top: 330, width: 200, height: 50 },
  { key: 'd2', kind: 'decision', name: '', left: 360, top: 410, width: 40, height: 40 },
  { key: 'a5', kind: 'action', name: '提示“图书不可借及原因”', left: 560, top: 490, width: 220, height: 50 },
  { key: 'a6', kind: 'action', name: '创建借阅记录，更新库存', left: 280, top: 490, width: 220, height: 50 },
  { key: 'a7', kind: 'action', name: '打印借书凭证', left: 280, top: 580, width: 220, height: 50 },
  { key: 'nf', kind: 'final', name: '', left: 370, top: 680, width: 30, height: 30 }
];

// guard text is what the user types in the Guard property, brackets included
const FLOWS = [
  { from: 'n0', to: 'a1', points: '380,50;380,80' },
  { from: 'a1', to: 'a2', points: '380,130;380,160' },
  { from: 'a2', to: 'd1', points: '380,210;380,240' },
  { from: 'd1', to: 'a3', points: '360,260;240,355', guard: '[无效]', alpha: -1.5707963267949 },
  { from: 'd1', to: 'a4', points: '380,280;380,330', guard: '[有效]' },
  { from: 'a4', to: 'd2', points: '380,380;380,410' },
  { from: 'd2', to: 'a5', points: '400,430;560,515', guard: '[不可借]' },
  { from: 'd2', to: 'a6', points: '380,450;390,490', guard: '[可借]' },
  { from: 'a6', to: 'a7', points: '390,540;390,580' },
  { from: 'a7', to: 'nf', points: '390,630;385,680' },
  { from: 'a3', to: 'nf', points: '140,380;140,695;370,695', rectilinear: true },
  { from: 'a5', to: 'nf', points: '670,540;670,695;400,695', rectilinear: true }
];

const MODEL_TYPE = { action: 'UMLActionState', initial: 'UMLPseudostate', decision: 'UMLPseudostate', final: 'UMLFinalState' };
const VIEW_TYPE = { action: 'UMLActionStateView', initial: 'UMLPseudostateView', decision: 'UMLPseudostateView', final: 'UMLFinalStateView' };

/* ------------------------------------------------------------------ build */

const project = new xpd.Elem('DocumentElement', 'UMLProject');
project.attr('Documentation', 'string', '借书流程活动图')
  .attr('Title', 'string', '图书馆借阅系统')
  .attr('Author', 'string', '').attr('Company', 'string', '').attr('Copyright', 'string', '');

const model = new xpd.Elem('OwnedElements', 'UMLModel');
model.attr('Name', 'string', '图书馆借阅系统').ref('Namespace', project.id);
project.add(model);

const graph = new xpd.Elem('OwnedElements', 'UMLActivityGraph');
graph.attr('Name', 'string', '借书流程').ref('Namespace', model.id);
model.add(graph);

const top = new xpd.Elem('Top', 'UMLCompositeState');
top.attr('Name', 'string', 'TOP').ref('StateMachine', graph.id);
graph.add(top);

const nodeElems = {};
for (const n of NODES) {
  const el = new xpd.Elem('Subvertices', MODEL_TYPE[n.kind]);
  if (n.name) el.attr('Name', 'string', n.name);
  if (n.kind === 'initial') el.attr('PseudostateKind', 'UMLPseudostateKind', 'pkInitial');
  if (n.kind === 'decision') el.attr('PseudostateKind', 'UMLPseudostateKind', 'pkDecision');
  el.ref('ContainerState', top.id);
  top.add(el);
  nodeElems[n.key] = el;
}

for (const f of FLOWS) {
  const el = new xpd.Elem('Transitions', 'UMLTransition');
  el.ref('StateMachine', graph.id).ref('Source', nodeElems[f.from].id).ref('Target', nodeElems[f.to].id);
  if (f.guard) el.attr('GuardCondition', 'string', f.guard);
  graph.add(el);          // transitions belong to the state machine, not to Top
  f.elem = el;
}

const diagram = new xpd.Elem('OwnedDiagrams', 'UMLActivityDiagram');
diagram.attr('Name', 'string', '借书流程活动图').attr('DefaultDiagram', 'boolean', 'True').ref('DiagramOwner', graph.id);
graph.add(diagram);
const diagramView = new xpd.Elem('DiagramView', 'UMLActivityDiagramView');
diagramView.ref('Diagram', diagram.id);
diagram.add(diagramView);

const nodeViews = {};
for (const n of NODES) {
  const v = new xpd.Elem('OwnedViews', VIEW_TYPE[n.kind]);
  v.attr('Left', 'integer', n.left).attr('Top', 'integer', n.top)
    .attr('Width', 'integer', n.width).attr('Height', 'integer', n.height)
    .ref('Model', nodeElems[n.key].id);
  if (n.kind === 'action') {   // action views show a name compartment; control nodes do not
    const nc = new xpd.Elem('NameCompartment', 'UMLNameCompartmentView');
    nc.add(new xpd.Elem('NameLabel', 'LabelView').attr('FontStyle', 'integer', 1).attr('Text', 'string', n.name));
    nc.add(new xpd.Elem('StereotypeLabel', 'LabelView').attr('Visible', 'boolean', 'False'));
    nc.add(new xpd.Elem('PropertyLabel', 'LabelView').attr('Visible', 'boolean', 'False'));
    v.add(nc);
  }
  diagramView.add(v);
  nodeViews[n.key] = v;
}

for (const f of FLOWS) {
  const v = new xpd.Elem('OwnedViews', 'UMLTransitionView');
  v.attr('LineStyle', 'LineStyleKind', f.rectilinear ? 'lsRectilinear' : 'lsOblique')
    .attr('Points', 'Points', f.points)
    .ref('Model', f.elem.id).ref('Head', nodeViews[f.to].id).ref('Tail', nodeViews[f.from].id);
  const nameLabel = new xpd.Elem('NameLabel', 'EdgeLabelView');
  if (f.guard) {
    nameLabel.attr('Alpha', 'real', f.alpha === undefined ? 1.5707963267949 : f.alpha)
      .attr('Distance', 'real', 30).attr('Text', 'string', f.guard);
  } else {
    nameLabel.attr('Visible', 'boolean', 'False')
      .attr('Alpha', 'real', 1.5707963267949).attr('Distance', 'real', 30);
  }
  nameLabel.ref('Model', f.elem.id);
  v.add(nameLabel);
  const stereo = new xpd.Elem('StereotypeLabel', 'EdgeLabelView');
  stereo.attr('Visible', 'boolean', 'False').attr('Alpha', 'real', 1.5707963267949)
    .attr('Distance', 'real', 30).ref('Model', f.elem.id);
  v.add(stereo);
  const prop = new xpd.Elem('PropertyLabel', 'EdgeLabelView');
  prop.attr('Visible', 'boolean', 'False').attr('Alpha', 'real', -1.5707963267949).attr('Distance', 'real', 15);
  v.add(prop);
  diagramView.add(v);
}

xpd.applyDefaultDiagramPalette(project);
xpd.writeFile(out, project);
console.log(`wrote ${out} (${NODES.length} nodes, ${FLOWS.length} flows)`);
