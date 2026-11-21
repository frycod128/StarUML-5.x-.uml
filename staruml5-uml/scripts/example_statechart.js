#!/usr/bin/env node
'use strict';

/**
 * Worked example: statechart diagram with internal activities, plus the only
 * form of "internal transition" StarUML 5.0.2 actually supports.
 *
 *   node example_statechart.js out.uml
 *   python validate_xpd.py out.uml --require-standard-palette
 *
 * The business content is deliberately generic (order lifecycle); it exists to
 * demonstrate structure, not to be reused as a course deliverable.
 *
 * Facts this example encodes:
 *
 *   1. `EntryActions` / `DoActivities` / `ExitActions` are **not** in
 *      `xpd.DEFAULT_ARRAY_FIELDS`. If you add them as children without listing
 *      them in `arrayFields`, no `#EntryActions` counter is written and the app
 *      silently drops the whole collection: the state box renders without any
 *      "entry / ..." line. This is the single most common silent failure.
 *   2. Items of those collections are `UMLUninterpretedAction` with a `Name`,
 *      and they carry `<XPD:REF name="Owner">` back to the state.
 *   3. They render inside the state box, prefixed by the app ("entry / ...",
 *      "do / ...", "exit / ..."). No view is needed; the compartment does it.
 *   4. StarUML 5.0.2 has **no internal-transition feature**. The state's
 *      collection editor offers only entry / do / exit actions plus a read-only
 *      relationship list, and the app never writes an `InternalTransitions`
 *      field - a hand-written one is ignored. A transition whose Source and
 *      Target are the same state is stored as an ordinary `UMLTransition` in the
 *      state machine's `Transitions`; with a view it draws a self-loop arrow and
 *      a label outside the box, never an in-box row.
 *   5. Therefore a "state unchanged, no arrow" entry can only be recorded as a
 *      view-less self-transition: it appears in the state's relationship list but
 *      is not painted. This example emits one that way and keeps its text in
 *      `Name`, so a report table can quote it verbatim.
 */

const xpd = require('./xpd');

const out = process.argv[2] || 'statechart-example.uml';
const A = 1.5707963267949;

// EntryActions / ExitActions / DoActivities must be declared as collections
const ARRAYS = xpd.DEFAULT_ARRAY_FIELDS.concat(['EntryActions', 'ExitActions', 'DoActivities']);

const project = new xpd.Elem('DocumentElement', 'UMLProject');
project.attr('Title', 'string', '订单生命周期')
  .attr('Author', 'string', '').attr('Company', 'string', '').attr('Copyright', 'string', '');

const model = new xpd.Elem('OwnedElements', 'UMLModel');
model.attr('Name', 'string', '订单系统').ref('Namespace', project.id);
project.add(model);

const sm = new xpd.Elem('OwnedElements', 'UMLStateMachine');
sm.attr('Name', 'string', '订单生命周期').ref('Namespace', model.id);
model.add(sm);

const top = new xpd.Elem('Top', 'UMLCompositeState');
top.attr('Name', 'string', 'TOP').ref('StateMachine', sm.id);
sm.add(top);

/* ------------------------------------------------------------------ content */

// entry / exit are written into the state's action compartments;
// `internal` is a view-less self-transition (see note 5 above)
const STATES = [
  { key: 'i', kind: 'initial', x: 60, y: 30, w: 18, h: 18 },
  { key: 's1', kind: 'state', name: '待支付', x: 120, y: 80, w: 170, h: 96,
    entry: ['生成支付截止时间'] },
  { key: 's2', kind: 'state', name: '已支付', x: 120, y: 250, w: 200, h: 110,
    entry: ['记录支付时间'], exit: ['释放库存锁定'],
    internal: ['修改收货地址 [未发货] / 更新运单'] },
  { key: 's3', kind: 'state', name: '已发货', x: 430, y: 250, w: 190, h: 110,
    entry: ['生成运单号'], exit: ['回写物流状态'] },
  { key: 's4', kind: 'state', name: '已关闭', x: 430, y: 450, w: 190, h: 96,
    entry: ['记录关闭原因'] },
  { key: 'f', kind: 'final', x: 513, y: 590, w: 24, h: 24 }
];

const FLOWS = [
  { from: 'i', to: 's1', points: '69,48;115,120' },
  { from: 's1', to: 's2', points: '205,176;205,250', label: '支付 / 登记支付流水', alpha: A, distance: 16 },
  { from: 's2', to: 's3', points: '320,290;430,290', label: '发货 [库存充足] / 扣减库存', alpha: -A, distance: -40 },
  { from: 's3', to: 's2', points: '430,330;320,330', label: '拒收 / 回滚运单', alpha: A, distance: 40 },
  { from: 's3', to: 's4', points: '525,360;525,450', label: '确认收货 / 关闭订单', alpha: A, distance: 16 },
  { from: 's4', to: 'f', points: '525,546;525,590' }
];

/* ------------------------------------------------------------------- build */

const stateModel = new Map();
for (const n of STATES) {
  let el;
  if (n.kind === 'state') {
    // the toolbox state tool creates UMLCompositeState in 5.0.2, but a plain
    // UMLSimpleState renders the same compartments; either works here
    el = new xpd.Elem('Subvertices', 'UMLCompositeState');
    el.attr('Name', 'string', n.name);
    for (const t of (n.entry || [])) {
      const a = new xpd.Elem('EntryActions', 'UMLUninterpretedAction');
      a.attr('Name', 'string', t).ref('Owner', el.id);
      el.add(a);
    }
    for (const t of (n.do || [])) {
      const a = new xpd.Elem('DoActivities', 'UMLUninterpretedAction');
      a.attr('Name', 'string', t).ref('Owner', el.id);
      el.add(a);
    }
    for (const t of (n.exit || [])) {
      const a = new xpd.Elem('ExitActions', 'UMLUninterpretedAction');
      a.attr('Name', 'string', t).ref('Owner', el.id);
      el.add(a);
    }
  } else if (n.kind === 'initial') {
    el = new xpd.Elem('Subvertices', 'UMLPseudostate');
    el.attr('PseudostateKind', 'UMLPseudostateKind', 'pkInitial');
  } else {
    el = new xpd.Elem('Subvertices', 'UMLFinalState');
  }
  el.ref('ContainerState', top.id);
  top.add(el);
  stateModel.set(n.key, el);
}

for (const f of FLOWS) {
  const el = new xpd.Elem('Transitions', 'UMLTransition');
  el.ref('StateMachine', sm.id)
    .ref('Source', stateModel.get(f.from).id)
    .ref('Target', stateModel.get(f.to).id);
  if (f.label) el.attr('Name', 'string', f.label);
  sm.add(el);
  f.elem = el;
}

// view-less self-transition: the only honest way to record "state unchanged"
for (const n of STATES) {
  if (n.kind !== 'state' || !n.internal) continue;
  for (const txt of n.internal) {
    const el = new xpd.Elem('Transitions', 'UMLTransition');
    el.ref('StateMachine', sm.id)
      .ref('Source', stateModel.get(n.key).id)
      .ref('Target', stateModel.get(n.key).id);
    el.attr('Name', 'string', txt);
    sm.add(el);   // no matching UMLTransitionView -> nothing is painted
  }
}

const diagram = new xpd.Elem('OwnedDiagrams', 'UMLStatechartDiagram');
diagram.attr('Name', 'string', '订单状态图')
  .attr('DefaultDiagram', 'boolean', 'True').ref('DiagramOwner', sm.id);
sm.add(diagram);
const dv = new xpd.Elem('DiagramView', 'UMLStatechartDiagramView');
dv.ref('Diagram', diagram.id);
diagram.add(dv);

const stateView = new Map();
for (const n of STATES) {
  const vt = n.kind === 'state' ? 'UMLStateView'
    : n.kind === 'initial' ? 'UMLPseudostateView' : 'UMLFinalStateView';
  const v = new xpd.Elem('OwnedViews', vt);
  v.attr('Left', 'integer', n.x).attr('Top', 'integer', n.y)
    .attr('Width', 'integer', n.w).attr('Height', 'integer', n.h)
    .ref('Model', stateModel.get(n.key).id);
  if (n.kind === 'state') {
    const nc = new xpd.Elem('NameCompartment', 'UMLNameCompartmentView');
    nc.add(new xpd.Elem('NameLabel', 'LabelView').attr('Text', 'string', n.name));
    nc.add(new xpd.Elem('StereotypeLabel', 'LabelView').attr('Visible', 'boolean', 'False'));
    nc.add(new xpd.Elem('PropertyLabel', 'LabelView').attr('Visible', 'boolean', 'False'));
    v.add(nc);
    // the compartment that paints entry / do / exit
    const itc = new xpd.Elem('InternalTransitionCompartment', 'UMLInternalTransitionCompartmentView');
    itc.ref('Model', stateModel.get(n.key).id);
    v.add(itc);
  }
  dv.add(v);
  stateView.set(n.key, v);
}

for (const f of FLOWS) {
  const v = new xpd.Elem('OwnedViews', 'UMLTransitionView');
  v.attr('LineStyle', 'LineStyleKind', 'lsOblique')
    .attr('Points', 'Points', f.points)
    .ref('Model', f.elem.id)
    .ref('Head', stateView.get(f.to).id).ref('Tail', stateView.get(f.from).id);
  const nl = new xpd.Elem('NameLabel', 'EdgeLabelView');
  nl.attr('Alpha', 'real', f.alpha === undefined ? A : f.alpha)
    .attr('Distance', 'real', f.distance === undefined ? 16 : f.distance);
  if (f.label) nl.attr('Text', 'string', f.label);
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
xpd.writeFile(out, project, { arrayFields: ARRAYS });
console.log(`wrote ${out} (${STATES.length} vertices, ${FLOWS.length} flows + 1 internal)`);
