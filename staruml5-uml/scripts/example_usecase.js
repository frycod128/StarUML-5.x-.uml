#!/usr/bin/env node
'use strict';

/**
 * Complete use case diagram generator - the use case counterpart of
 * example_activity.js. Demonstrates every construct this skill needs:
 *
 *   - system boundary      UMLSubsystem + UMLSubsystemView (renders its name)
 *   - actor / use case     UMLActorView / UMLUseCaseView with compartments
 *   - association          full label set is mandatory (see ASSOCIATION_LABELS)
 *   - include              Base = including use case, Addition = included one
 *   - extend               Base = extended use case, Extension = extending one
 *   - generalization       Child -> Parent between actors
 *   - several diagrams     one project, each with its own DiagramView
 *                          (overview / borrow-with-include-extend / actor inheritance)
 *
 * The checked-in output is assets/use-case-diagram-full.uml.
 *
 * Usage:  node example_usecase.js [out.uml]
 */

const path = require('path');
const xpd = require('./xpd');

/* --------------------------------------------------------------- geometry */

const UC = { w: 180, h: 64 };
const ACTOR = { w: 70, h: 100 };

function box (n) {
  if (n.kind === 'boundary') return { x: n.x, y: n.y, w: n.w, h: n.h };
  if (n.kind === 'actor') return { x: n.x, y: n.y, w: ACTOR.w, h: ACTOR.h };
  return { x: n.x, y: n.y, w: UC.w, h: UC.h };
}

/** Actors are drawn inside the top ~60px of their box, the name sits below. */
function shapeCenter (n) {
  const b = box(n);
  if (n.kind === 'actor') return { cx: b.x + b.w / 2, cy: b.y + 30, rx: 20, ry: 25 };
  return { cx: b.x + b.w / 2, cy: b.y + b.h / 2, rx: b.w / 2, ry: b.h / 2 };
}

/** Point on the shape border along the ray from its centre to (tx, ty). */
function borderPoint (n, tx, ty) {
  const b = box(n);
  if (n.kind === 'boundary') {
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const dx = tx - cx, dy = ty - cy;
    const sx = dx === 0 ? Infinity : (b.w / 2) / Math.abs(dx);
    const sy = dy === 0 ? Infinity : (b.h / 2) / Math.abs(dy);
    const k = Math.min(sx, sy);
    return [cx + dx * k, cy + dy * k];
  }
  const { cx, cy, rx, ry } = shapeCenter(n);
  const dx = tx - cx, dy = ty - cy;
  if (dx === 0 && dy === 0) return [cx, cy];
  const k = 1 / Math.sqrt((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry));
  return [cx + dx * k, cy + dy * k];
}

/** StarUML parses Points as integers - never emit 291.13 or NaN. */
const int = v => Math.round(v);

/** StarUML stores a label's position as alpha/distance from the segment middle. */
function labelAngle (tail, head, target) {
  const mid = [(tail[0] + head[0]) / 2, (tail[1] + head[1]) / 2];
  const th = Math.atan2(tail[1] - head[1], tail[0] - head[0]);
  const dx = target[0] - mid[0], dy = target[1] - mid[1];
  let alpha = Math.atan2(-dy, dx) - th;
  while (alpha > Math.PI) alpha -= 2 * Math.PI;
  while (alpha < -Math.PI) alpha += 2 * Math.PI;
  return {
    alpha: Math.round(alpha * 100) / 100,
    distance: Math.round(Math.sqrt(dx * dx + dy * dy) * 100) / 100
  };
}

/* ------------------------------------------------------------------- data */

const actor = (name, x, y) => ({ kind: 'actor', name, x, y });
const usecase = (name, x, y) => ({ kind: 'usecase', name, x, y });
const boundary = (name, x, y, w, h) => ({ kind: 'boundary', name, x, y, w, h });
const assoc = (from, to) => ({ kind: 'association', from, to });
const include = (from, to) => ({ kind: 'include', from, to });
const extend = (from, to) => ({ kind: 'extend', from, to });
const general = (child, parent) => ({ kind: 'generalization', from: child, to: parent });

const DIAGRAMS = [
  {
    name: '图书管理系统总体用例图',
    nodes: [
      boundary('图书管理系统', 400, 60, 320, 440),
      usecase('用户管理', 470, 110),
      usecase('图书管理', 470, 200),
      usecase('借阅管理', 470, 290),
      usecase('系统管理', 470, 380),
      actor('读者', 140, 190),
      actor('图书管理员', 140, 340),
      actor('系统管理员', 830, 190)
    ],
    edges: [
      assoc('读者', '用户管理'),
      assoc('读者', '借阅管理'),
      assoc('图书管理员', '图书管理'),
      assoc('图书管理员', '借阅管理'),
      assoc('系统管理员', '用户管理'),
      assoc('系统管理员', '系统管理')
    ]
  },
  {
    name: '借阅管理子用例图',
    nodes: [
      boundary('借阅管理子系统', 370, 50, 530, 530),
      usecase('借书', 410, 100),
      usecase('还书', 410, 180),
      usecase('续借', 410, 260),
      usecase('查询借阅记录', 410, 340),
      usecase('验证用户身份', 680, 110),
      usecase('查询库存', 680, 190),
      usecase('缴纳罚款', 680, 340),
      actor('读者', 120, 200),
      actor('图书管理员', 120, 430)
    ],
    edges: [
      assoc('读者', '借书'),
      assoc('读者', '还书'),
      assoc('读者', '续借'),
      assoc('读者', '查询借阅记录'),
      assoc('图书管理员', '借书'),
      assoc('图书管理员', '还书'),
      include('借书', '验证用户身份'),
      include('借书', '查询库存'),
      extend('缴纳罚款', '还书')
    ]
  },
  {
    name: '参与者继承关系',
    nodes: [
      actor('读者', 480, 90),
      actor('本科生', 240, 330),
      actor('研究生', 480, 330),
      actor('教师', 720, 330)
    ],
    edges: [
      general('本科生', '读者'),
      general('研究生', '读者'),
      general('教师', '读者')
    ]
  }
];

/* ------------------------------------------------------------ XPD helpers */

function nameCompartment (text) {
  const nc = new xpd.Elem('NameCompartment', 'UMLNameCompartmentView');
  nc.add(new xpd.Elem('NameLabel', 'LabelView').attr('FontStyle', 'integer', 1).attr('Text', 'string', text));
  nc.add(new xpd.Elem('StereotypeLabel', 'LabelView').attr('Visible', 'boolean', 'False'));
  nc.add(new xpd.Elem('PropertyLabel', 'LabelView').attr('Visible', 'boolean', 'False'));
  return nc;
}

function hidden (field, type, modelId) {
  const c = new xpd.Elem(field, type);
  c.attr('Visible', 'boolean', 'False');
  if (modelId) c.ref('Model', modelId);
  return c;
}

function edgeLabel (field, modelId, options = {}) {
  const v = new xpd.Elem(field, 'EdgeLabelView');
  v.attr('Visible', 'boolean', options.visible ? 'True' : 'False');
  if (options.alpha !== undefined) v.attr('Alpha', 'real', options.alpha);
  if (options.distance !== undefined) v.attr('Distance', 'real', options.distance);
  if (options.text) v.attr('Text', 'string', options.text);
  if (options.edgePosition) v.attr('EdgePosition', 'EdgePositionKind', options.edgePosition);
  if (modelId) v.ref('Model', modelId);
  return v;
}

/**
 * StarUML 5 raises an access violation when an association view is missing these.
 * PropertyLabel is optional; the official samples omit it in places.
 */
function addAssociationLabels (view, assocId, headEndId, tailEndId) {
  view.add(edgeLabel('NameLabel', assocId, { alpha: 1.5707963267949, distance: 15 }));
  view.add(edgeLabel('StereotypeLabel', assocId, { alpha: 1.5707963267949, distance: 30 }));
  view.add(edgeLabel('PropertyLabel', assocId, { alpha: -1.5707963267949, distance: 15 }));
  view.add(edgeLabel('HeadRoleNameLabel', headEndId, { alpha: -0.523598775598299, distance: 30, edgePosition: 'epHead' }));
  view.add(edgeLabel('TailRoleNameLabel', tailEndId, { alpha: 0.523598775598299, distance: 30, edgePosition: 'epTail' }));
  view.add(edgeLabel('HeadMultiplicityLabel', headEndId, { alpha: 0.523598775598299, distance: 25, edgePosition: 'epHead' }));
  view.add(edgeLabel('TailMultiplicityLabel', tailEndId, { alpha: -0.523598775598299, distance: 25, edgePosition: 'epTail' }));
  view.add(edgeLabel('HeadPropertyLabel', headEndId, { alpha: -0.785398163397448, distance: 40, edgePosition: 'epHead' }));
  view.add(edgeLabel('TailPropertyLabel', tailEndId, { alpha: 0.785398163397448, distance: 40, edgePosition: 'epTail' }));
  for (const [field, endId] of [['HeadQualifierCompartment', headEndId], ['TailQualifierCompartment', tailEndId]]) {
    const q = new xpd.Elem(field, 'UMLQualifierCompartmentView');
    q.attr('Visible', 'boolean', 'False');
    q.attr('Left', 'integer', 0).attr('Top', 'integer', 0)
      .attr('Width', 'integer', 50).attr('Height', 'integer', 8);
    q.ref('Model', endId);
    view.add(q);
  }
}

/* ------------------------------------------------------------- the builder */

function buildProject (diagrams = DIAGRAMS) {
  const project = new xpd.Elem('DocumentElement', 'UMLProject');
  project.attr('Documentation', 'string', 'Use case example');
  project.attr('Title', 'string', '图书管理系统用例图');
  project.attr('Author', 'string', '');
  project.attr('Company', 'string', '');
  project.attr('Copyright', 'string', '');

  const model = new xpd.Elem('OwnedElements', 'UMLModel');
  model.attr('Name', 'string', '图书管理系统');
  model.ref('Namespace', project.id);
  project.add(model);

  const actors = new Map();
  const useCases = new Map();
  const subsystems = new Map();
  const relationships = new Map();
  const ends = new Map();

  const ensure = (map, type, name) => {
    if (!map.has(name)) {
      const e = new xpd.Elem('OwnedElements', type);
      e.attr('Name', 'string', name);
      e.ref('Namespace', model.id);
      model.add(e);
      map.set(name, e);
    }
    return map.get(name);
  };

  // 1) model elements first - views need something to reference
  for (const diagram of diagrams) {
    for (const node of diagram.nodes) {
      if (node.kind === 'actor') ensure(actors, 'UMLActor', node.name);
      else if (node.kind === 'usecase') ensure(useCases, 'UMLUseCase', node.name);
      else ensure(subsystems, 'UMLSubsystem', node.name);
    }

    for (const edge of diagram.edges) {
      const key = `${edge.kind}|${edge.from}|${edge.to}`;
      if (relationships.has(key)) continue;

      if (edge.kind === 'association') {
        const assoc = new xpd.Elem('OwnedElements', 'UMLAssociation');
        assoc.ref('Namespace', model.id);
        // Connections[0] = head, [1] = tail; StarUML matches ends by Participant,
        // the order itself is not significant (its own samples use both).
        const head = new xpd.Elem('Connections', 'UMLAssociationEnd');
        head.ref('Association', assoc.id);
        head.ref('Participant', (actors.get(edge.to) || useCases.get(edge.to)).id);
        assoc.add(head);
        const tail = new xpd.Elem('Connections', 'UMLAssociationEnd');
        tail.ref('Association', assoc.id);
        tail.ref('Participant', (actors.get(edge.from) || useCases.get(edge.from)).id);
        assoc.add(tail);
        ends.set(key, { head, tail });
        model.add(assoc);
        relationships.set(key, assoc);
      } else if (edge.kind === 'include') {
        const rel = new xpd.Elem('OwnedElements', 'UMLInclude');
        rel.ref('Namespace', model.id);
        rel.ref('Base', useCases.get(edge.from).id);       // including use case
        rel.ref('Addition', useCases.get(edge.to).id);     // included use case
        model.add(rel);
        relationships.set(key, rel);
      } else if (edge.kind === 'extend') {
        const rel = new xpd.Elem('OwnedElements', 'UMLExtend');
        rel.ref('Namespace', model.id);
        rel.ref('Base', useCases.get(edge.to).id);         // extended use case
        rel.ref('Extension', useCases.get(edge.from).id);  // extending use case
        model.add(rel);
        relationships.set(key, rel);
      } else {
        const rel = new xpd.Elem('OwnedElements', 'UMLGeneralization');
        rel.ref('Namespace', model.id);
        rel.ref('Child', actors.get(edge.from).id);
        rel.ref('Parent', actors.get(edge.to).id);
        model.add(rel);
        relationships.set(key, rel);
      }
    }
  }

  // 2) diagrams and their views
  diagrams.forEach((diagram, index) => {
    const d = new xpd.Elem('OwnedDiagrams', 'UMLUseCaseDiagram');
    d.attr('Name', 'string', diagram.name);
    d.attr('DefaultDiagram', 'boolean', index === 0 ? 'True' : 'False');
    d.ref('DiagramOwner', model.id);
    model.add(d);

    const dv = new xpd.Elem('DiagramView', 'UMLUseCaseDiagramView');
    dv.ref('Diagram', d.id);
    d.add(dv);

    const viewOf = new Map();

    // boundary first so it sits behind everything
    for (const node of diagram.nodes.filter(n => n.kind === 'boundary')) {
      const b = box(node);
      const v = new xpd.Elem('OwnedViews', 'UMLSubsystemView');
      v.attr('Left', 'integer', b.x).attr('Top', 'integer', b.y)
        .attr('Width', 'integer', b.w).attr('Height', 'integer', b.h)
        .ref('Model', subsystems.get(node.name).id);
      v.add(nameCompartment(node.name));
      v.add(hidden('AttributeCompartment', 'UMLAttributeCompartmentView', subsystems.get(node.name).id));
      v.add(hidden('OperationCompartment', 'UMLOperationCompartmentView', subsystems.get(node.name).id));
      dv.add(v);
      viewOf.set(node.name, v);
    }

    for (const node of diagram.nodes.filter(n => n.kind !== 'boundary')) {
      const b = box(node);
      const modelElement = node.kind === 'actor'
        ? actors.get(node.name)
        : useCases.get(node.name);
      const v = new xpd.Elem('OwnedViews', node.kind === 'actor' ? 'UMLActorView' : 'UMLUseCaseView');
      v.attr('Left', 'integer', b.x).attr('Top', 'integer', b.y)
        .attr('Width', 'integer', b.w).attr('Height', 'integer', b.h)
        .ref('Model', modelElement.id);
      v.add(nameCompartment(node.name));
      v.add(hidden('AttributeCompartment', 'UMLAttributeCompartmentView', modelElement.id));
      v.add(hidden('OperationCompartment', 'UMLOperationCompartmentView', modelElement.id));
      if (node.kind === 'usecase') {
        v.add(hidden('ExtensionPointCompartment', 'UMLExtensionPointCompartmentView', null));
      }
      dv.add(v);
      viewOf.set(node.name, v);
    }

    for (const edge of diagram.edges) {
      const from = diagram.nodes.find(n => n.name === edge.from);
      const to = diagram.nodes.find(n => n.name === edge.to);
      const cFrom = shapeCenter(from);
      const cTo = shapeCenter(to);
      const tail = borderPoint(from, cTo.cx, cTo.cy);
      const head = borderPoint(to, cFrom.cx, cFrom.cy);
      const key = `${edge.kind}|${edge.from}|${edge.to}`;
      const rel = relationships.get(key);
      const viewType = {
        association: 'UMLAssociationView',
        include: 'UMLIncludeView',
        extend: 'UMLExtendView',
        generalization: 'UMLGeneralizationView'
      }[edge.kind];
      const v = new xpd.Elem('OwnedViews', viewType);
      // Points : first = Tail, last = Head. Integers only.
      v.attr('Points', 'Points', `${int(tail[0])},${int(tail[1])};${int(head[0])},${int(head[1])}`)
        .ref('Model', rel.id)
        .ref('Head', viewOf.get(edge.to).id)
        .ref('Tail', viewOf.get(edge.from).id);

      if (edge.kind === 'association') {
        const pair = ends.get(key);
        addAssociationLabels(v, rel.id, pair.head.id, pair.tail.id);
      } else {
        const stereo = edge.kind === 'include' ? '<<include>>' : edge.kind === 'extend' ? '<<extend>>' : null;
        const mid = [(tail[0] + head[0]) / 2, (tail[1] + head[1]) / 2];
        const pos = labelAngle(tail, head, [mid[0], mid[1] + 16]);
        v.add(edgeLabel('NameLabel', rel.id, { alpha: pos.alpha, distance: pos.distance }));
        v.add(edgeLabel('StereotypeLabel', rel.id, {
          visible: Boolean(stereo),
          text: stereo || undefined,
          alpha: pos.alpha,
          distance: pos.distance + 12
        }));
        v.add(edgeLabel('PropertyLabel', rel.id, { alpha: -pos.alpha, distance: 15 }));
      }
      dv.add(v);
    }
  });

  return project;
}

module.exports = { buildProject, DIAGRAMS };

if (require.main === module) {
  const out = path.resolve(process.argv[2] || 'use-case-example.uml');
  xpd.writeFile(out, buildProject());
  console.log('written', out);
}
