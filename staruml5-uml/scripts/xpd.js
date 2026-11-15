#!/usr/bin/env node
'use strict';

/**
 * XPD writer for classic StarUML 5.x project files (.uml).
 *
 * Usage:
 *   const xpd = require('./xpd');
 *   const project = new xpd.Elem('DocumentElement', 'UMLProject');
 *   project.attr('Title', 'string', 'My project');
 *   const model = new xpd.Elem('OwnedElements', 'UMLModel');
 *   model.attr('Name', 'string', 'Model').ref('Namespace', project.id);
 *   project.add(model);
 *   xpd.writeFile('out.uml', project);
 *
 * Children are declared with their *field* name ('OwnedElements', 'Attributes',
 * 'Subvertices', …). Collection members are numbered automatically at emit time
 * and get the '<XPD:ATTR name="#Field">N</XPD:ATTR>' counter in front of them.
 * Inverse collections (Views / Associations / Outgoings / Incomings and the
 * interaction stimulus/link collections) are derived from the tree, so they can
 * never disagree with the references.
 *
 * Self-check: node xpd.js --self-test
 */

const fs = require('fs');

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const usedIds = new Set();

/** StarUML writes 24 base64 characters, its own ids always ending with "AA". */
function guid () {
  let id;
  do {
    let s = '';
    for (let i = 0; i < 22; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    id = s + 'AA';
  } while (usedIds.has(id));
  usedIds.add(id);
  return id;
}

function escapeXml (value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Convert a CSS/RGB color (#RRGGBB) to StarUML's Delphi TColor spelling.
 * StarUML stores Windows BGR bytes after an alpha byte: #870e0e -> $000E0E87.
 */
function bgrColor (rgb) {
  const value = String(rgb).trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(value)) {
    throw new Error(`color must be six hex digits, for example #870e0e, got "${rgb}"`);
  }
  return `$00${value.slice(4, 6)}${value.slice(2, 4)}${value.slice(0, 2)}`.toUpperCase();
}

class Elem {
  constructor (name, type, id) {
    this.name = name;
    this.type = type;
    this.id = id || guid();
    this.attrs = [];
    this.refs = [];
    this.children = [];
  }

  attr (name, type, value) {
    this.attrs.push({ name, type, value });
    return this;
  }

  ref (name, target) {
    this.refs.push({ name, target });
    return this;
  }

  add (child) {
    this.children.push(child);
    return child;
  }
}

const DEFAULT_ARRAY_FIELDS = [
  'OwnedElements', 'OwnedDiagrams', 'OwnedViews', 'Connections', 'Attributes',
  'Operations', 'Parameters', 'Subvertices', 'Transitions', 'TaggedValues',
  'OwnedCollaborationInstanceSets', 'InteractionInstanceSets',
  'ParticipatingInstances', 'ParticipatingLinks', 'ParticipatingStimuli',
  'Fragments', 'Operands', 'ContainedViews', 'Messages', 'OwnedFrames'
];

const CLASSIFIERS = [
  'UMLActor', 'UMLUseCase', 'UMLClass', 'UMLInterface', 'UMLDataType', 'UMLPrimitiveType',
  'UMLEnumeration', 'UMLSignal', 'UMLComponent', 'UMLNode', 'UMLArtifact', 'UMLSubsystem'
];
const STATE_VERTICES = [
  'UMLSimpleState', 'UMLCompositeState', 'UMLSubmachineState', 'UMLPseudostate',
  'UMLActionState', 'UMLFinalState', 'UMLSubactivityState', 'UMLSignalAcceptState',
  'UMLSignalSendState', 'UMLCallState', 'UMLObjectFlowState'
];

const DEFAULT_INVERSES = [
  { collection: 'Views', via: 'Model' },
  { collection: 'Associations', via: 'Participant', only: CLASSIFIERS },
  { collection: 'Outgoings', via: 'Source', only: STATE_VERTICES },
  { collection: 'Incomings', via: 'Target', only: STATE_VERTICES },
  { collection: 'SendingStimuli', via: 'Sender', only: ['UMLObject'] },
  { collection: 'ReceivingStimuli', via: 'Receiver', only: ['UMLObject'] },
  { collection: 'Stimuli', via: 'CommunicationLink', only: ['UMLLink'] }
];

function walk (elem, out = []) {
  out.push(elem);
  for (const child of elem.children) walk(child, out);
  return out;
}

/* ------------------------------------------------------------------- lint */

/** Integer coordinate pairs only: "120,80;340,80". StarUML parses these as integers. */
const POINTS_RE = /^-?\d+(,-?\d+)*(;-?\d+(,-?\d+)*)*$/;

/**
 * Catch the two mistakes that cost hours in practice, before anything is written:
 *   - decimal / NaN coordinates: StarUML shows "'291.13' is not a valid integer value."
 *   - lowercase booleans: the document loads with no diagram (or drops the attribute)
 */
function lint (root) {
  const problems = [];
  for (const elem of walk(root)) {
    for (const a of elem.attrs) {
      const value = String(a.value);
      // attr(name, type, value) is easy to call with two arguments by mistake:
      // that writes the intended value into @type and serializes "undefined".
      if (!/^[A-Za-z][A-Za-z0-9]*$/.test(String(a.type))) {
        problems.push(
          `${elem.type}.${elem.name}: attribute "${a.name}" has type "${a.type}" - ` +
          'expected an XPD type name such as string/integer/boolean/Points'
        );
      }
      if (value === 'undefined' || value === 'null') {
        problems.push(
          `${elem.type}.${elem.name}: attribute "${a.name}" is ${value} - ` +
          'did you call attr(name, type, value) with the value missing?'
        );
      }
      if (a.type === 'Points' && !POINTS_RE.test(value.trim())) {
        problems.push(
          `${elem.type}.${elem.name}: Points must be integer pairs like "120,80;340,80" ` +
          `(round them), got "${value}"`
        );
      }
      if (a.type === 'boolean' && value !== 'True' && value !== 'False') {
        problems.push(
          `${elem.type}.${elem.name}: boolean "${a.name}" must be True or False, got "${value}"`
        );
      }
    }
  }
  return problems;
}

/** Map<collection, Map<elemId, guid[]>> in document order, matching StarUML's own files. */
function collectInverses (root, inverses) {
  const byCollection = new Map();
  for (const rule of inverses) byCollection.set(rule.collection, new Map());
  const byId = new Map();
  for (const elem of walk(root)) byId.set(elem.id, elem);
  for (const elem of walk(root)) {
    for (const rule of inverses) {
      for (const ref of elem.refs) {
        if (ref.name !== rule.via) continue;
        const owner = byId.get(ref.target);
        if (!owner) continue;
        if (rule.only && !rule.only.includes(owner.type)) continue;
        const map = byCollection.get(rule.collection);
        if (!map.has(owner.id)) map.set(owner.id, []);
        map.get(owner.id).push(elem.id);
      }
    }
  }
  return byCollection;
}

function emit (elem, ctx) {
  const lines = [];
  lines.push(`<XPD:OBJ name="${escapeXml(elem.name)}" type="${escapeXml(elem.type)}" guid="${elem.id}">`);
  for (const a of elem.attrs) {
    lines.push(`<XPD:ATTR name="${escapeXml(a.name)}" type="${escapeXml(a.type)}">${escapeXml(a.value)}</XPD:ATTR>`);
  }
  for (const r of elem.refs) {
    lines.push(`<XPD:REF name="${escapeXml(r.name)}">${r.target}</XPD:REF>`);
  }

  for (const rule of ctx.inverses) {
    const ids = ctx.collected.get(rule.collection).get(elem.id);
    if (!ids || ids.length === 0) continue;
    lines.push(`<XPD:ATTR name="#${rule.collection}" type="integer">${ids.length}</XPD:ATTR>`);
    ids.forEach((id, i) => lines.push(`<XPD:REF name="${rule.collection}[${i}]">${id}</XPD:REF>`));
  }

  const groups = new Map();
  for (const child of elem.children) {
    const field = child.name.replace(/\[\d+\]$/, '');
    if (!groups.has(field)) groups.set(field, []);
    groups.get(field).push(child);
  }
  for (const [field, items] of groups) {
    const isArray = ctx.arrayFields.has(field);
    if (isArray) {
      lines.push(`<XPD:ATTR name="#${field}" type="integer">${items.length}</XPD:ATTR>`);
    }
    items.forEach((child, i) => {
      if (isArray) child.name = `${field}[${i}]`;
      lines.push(...emit(child, ctx));
    });
  }

  lines.push('</XPD:OBJ>');
  return lines;
}

/** Serialize an XPD element tree into the XML text StarUML 5 writes. */
function writeProject (root, options = {}) {
  if (options.lint !== false) {
    const problems = lint(root);
    if (problems.length) {
      throw new Error('XPD lint failed:\n  - ' + problems.join('\n  - '));
    }
  }
  const inverses = options.inverses || DEFAULT_INVERSES;
  const ctx = {
    inverses,
    collected: collectInverses(root, inverses),
    arrayFields: new Set(options.arrayFields || DEFAULT_ARRAY_FIELDS)
  };
  const body = emit(root, ctx).join('\n');
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<XPD:PROJECT xmlns:XPD="http://www.staruml.com" version="1">\n' +
    '<XPD:HEADER>\n<XPD:SUBUNITS>\n</XPD:SUBUNITS>\n<XPD:PROFILES>\n' +
    '<XPD:PROFILE>UMLStandard</XPD:PROFILE>\n</XPD:PROFILES>\n</XPD:HEADER>\n' +
    `<XPD:BODY>\n${body}\n</XPD:BODY>\n</XPD:PROJECT>\n`;
}

function writeFile (file, root, options = {}) {
  fs.writeFileSync(file, writeProject(root, options), 'utf8');
  return file;
}

/* ------------------------------------------------------------------ self-test */

/** Structural scan: nesting, child field names and '#Field' counters per element. */
function scan (xml) {
  const stack = [];
  const elems = [];
  for (const line of xml.split('\n')) {
    let m = /^<XPD:OBJ name="([^"]*)" type="([^"]*)" guid="([^"]*)"\s*>$/.exec(line);
    if (m) {
      const elem = {
        name: m[1],
        type: m[2],
        guid: m[3],
        children: [],
        counters: {},
        refNames: [],
        parent: stack[stack.length - 1] || null
      };
      if (elem.parent) elem.parent.children.push(elem);
      stack.push(elem);
      elems.push(elem);
      continue;
    }
    if (/^<\/XPD:OBJ>$/.test(line)) {
      stack.pop();
      continue;
    }
    m = /^<XPD:ATTR name="#([^"]*)" type="integer">(\d+)<\/XPD:ATTR>$/.exec(line);
    if (m && stack.length) stack[stack.length - 1].counters[m[1]] = Number(m[2]);
    m = /^<XPD:REF name="([^"]*)"/.exec(line);
    if (m && stack.length) stack[stack.length - 1].refNames.push(m[1]);
  }
  return elems;
}

function selfTest () {
  const project = new Elem('DocumentElement', 'UMLProject');
  project.attr('Title', 'string', 'self test');
  const model = new Elem('OwnedElements', 'UMLModel');
  model.attr('Name', 'string', 'Model').ref('Namespace', project.id);
  project.add(model);

  const graph = new Elem('OwnedElements', 'UMLActivityGraph');
  graph.attr('Name', 'string', '借书流程').ref('Namespace', model.id);
  model.add(graph);
  const top = new Elem('Top', 'UMLCompositeState');
  top.attr('Name', 'string', 'TOP').ref('StateMachine', graph.id);
  graph.add(top);

  const initial = new Elem('Subvertices', 'UMLPseudostate');
  initial.attr('PseudostateKind', 'UMLPseudostateKind', 'pkInitial').ref('ContainerState', top.id);
  top.add(initial);
  const action = new Elem('Subvertices', 'UMLActionState');
  action.attr('Name', 'string', '扫描图书条码').ref('ContainerState', top.id);
  top.add(action);
  const flow = new Elem('Transitions', 'UMLTransition');
  flow.ref('StateMachine', graph.id).ref('Source', initial.id).ref('Target', action.id);
  graph.add(flow);

  const diagram = new Elem('OwnedDiagrams', 'UMLActivityDiagram');
  diagram.attr('Name', 'string', 'Main').attr('DefaultDiagram', 'boolean', 'True').ref('DiagramOwner', graph.id);
  graph.add(diagram);
  const diagramView = new Elem('DiagramView', 'UMLActivityDiagramView');
  diagramView.ref('Diagram', diagram.id);
  diagram.add(diagramView);

  const initialView = new Elem('OwnedViews', 'UMLPseudostateView');
  initialView.attr('Left', 'integer', 40).attr('Top', 'integer', 40)
    .attr('Width', 'integer', 20).attr('Height', 'integer', 20).ref('Model', initial.id);
  diagramView.add(initialView);
  const actionView = new Elem('OwnedViews', 'UMLActionStateView');
  actionView.attr('Left', 'integer', 120).attr('Top', 'integer', 30)
    .attr('Width', 'integer', 160).attr('Height', 'integer', 40).ref('Model', action.id);
  const nameCompartment = new Elem('NameCompartment', 'UMLNameCompartmentView');
  nameCompartment.add(new Elem('NameLabel', 'LabelView').attr('FontStyle', 'integer', 1).attr('Text', 'string', '扫描图书条码'));
  nameCompartment.add(new Elem('StereotypeLabel', 'LabelView').attr('Visible', 'boolean', 'False'));
  nameCompartment.add(new Elem('PropertyLabel', 'LabelView').attr('Visible', 'boolean', 'False'));
  actionView.add(nameCompartment);
  diagramView.add(actionView);
  const flowView = new Elem('OwnedViews', 'UMLTransitionView');
  flowView.attr('LineStyle', 'LineStyleKind', 'lsOblique').attr('Points', 'Points', '60,50;120,50')
    .ref('Model', flow.id).ref('Head', actionView.id).ref('Tail', initialView.id);
  flowView.add(new Elem('NameLabel', 'EdgeLabelView').attr('Visible', 'boolean', 'False').ref('Model', flow.id));
  flowView.add(new Elem('StereotypeLabel', 'EdgeLabelView').attr('Visible', 'boolean', 'False').ref('Model', flow.id));
  flowView.add(new Elem('PropertyLabel', 'EdgeLabelView').attr('Visible', 'boolean', 'False'));
  diagramView.add(flowView);

  const xml = writeProject(project);
  const problems = [];
  const elems = scan(xml);
  const guids = new Set(elems.map(e => e.guid));

  for (const ref of xml.matchAll(/<XPD:REF name="[^"]*">([^<]*)<\/XPD:REF>/g)) {
    if (!guids.has(ref[1])) problems.push(`dangling reference ${ref[1]}`);
  }
  for (const elem of elems) {
    for (const [field, count] of Object.entries(elem.counters)) {
      const kids = elem.children.filter(c => c.name.split('[')[0] === field).length;
      const refs = elem.refNames.filter(n => n.startsWith(`${field}[`)).length;
      const actual = field === 'Views' || field === 'Associations' || field === 'Outgoings' || field === 'Incomings'
        ? refs
        : kids;
      if (count !== actual) problems.push(`${elem.type}.${field} counter ${count} != ${actual}`);
    }
  }
  const topIndex = xml.indexOf('type="UMLCompositeState"');
  const transitionIndex = xml.indexOf('name="Transitions[0]"');
  if (transitionIndex > 0 && transitionIndex < xml.indexOf('</XPD:OBJ>', topIndex)) {
    problems.push('transition emitted inside the composite state');
  }
  if (!/name="Views\[0\]"/.test(xml)) problems.push('inverse Views collection missing');
  if (!/name="Outgoings\[0\]"/.test(xml)) problems.push('inverse Outgoings collection missing');
  if (bgrColor('#870e0e') !== '$000E0E87') problems.push('BGR color conversion failed');

  // Interaction inverses are stored too: the sender/receiver and communication
  // link must list their stimuli without hand-written back-references.
  const ip = new Elem('DocumentElement', 'UMLProject').attr('Title', 'string', 'interaction self test');
  const im = new Elem('OwnedElements', 'UMLModel').attr('Name', 'string', 'Model')
    .ref('Namespace', ip.id);
  ip.add(im);
  const cls = new Elem('OwnedElements', 'UMLClass').attr('Name', 'string', 'Catalog')
    .ref('Namespace', im.id);
  im.add(cls);
  const op = new Elem('Operations', 'UMLOperation').attr('Name', 'string', 'checkout')
    .ref('Owner', cls.id);
  cls.add(op);
  const collab = new Elem('OwnedCollaborationInstanceSets', 'UMLCollaborationInstanceSet')
    .attr('Name', 'string', 'Collaboration').ref('RepresentedOperation', op.id);
  op.add(collab);
  const customer = new Elem('ParticipatingInstances', 'UMLObject')
    .attr('Name', 'string', 'c:Customer').ref('CollaborationInstanceSet', collab.id);
  const catalog = new Elem('ParticipatingInstances', 'UMLObject')
    .attr('Name', 'string', 'o:Catalog').ref('CollaborationInstanceSet', collab.id);
  collab.add(customer);
  collab.add(catalog);
  const interaction = new Elem('InteractionInstanceSets', 'UMLInteractionInstanceSet')
    .attr('Name', 'string', 'Checkout').ref('Context', collab.id);
  collab.add(interaction);
  const link = new Elem('ParticipatingLinks', 'UMLLink')
    .ref('CollaborationInstanceSet', collab.id);
  for (const instance of [customer, catalog]) {
    link.add(new Elem('Connections', 'UMLLinkEnd')
      .ref('Instance', instance.id).ref('Link', link.id));
  }
  collab.add(link);
  const stimulus = new Elem('ParticipatingStimuli', 'UMLStimulus')
    .attr('Name', 'string', 'checkout').ref('Sender', customer.id)
    .ref('Receiver', catalog.id).ref('CommunicationLink', link.id)
    .ref('InteractionInstanceSet', interaction.id);
  stimulus.add(new Elem('Action', 'UMLCallAction').ref('Stimulus', stimulus.id));
  interaction.add(stimulus);
  const interactionXml = writeProject(ip);
  for (const inverse of ['SendingStimuli[0]', 'ReceivingStimuli[0]', 'Stimuli[0]']) {
    if (!interactionXml.includes(`name="${inverse}"`)) {
      problems.push(`interaction inverse ${inverse} missing`);
    }
  }

  // lint must reject the three mistakes that make StarUML 5 choke
  for (const [name, type, value] of [
    ['Points', 'Points', '10.5,20;30,40'],
    ['Visible', 'boolean', 'false'],
    ['Title', '图书管理系统用例图', 'x']
  ]) {
    const bad = new Elem('DocumentElement', 'UMLProject');
    bad.attr(name, type, value);
    let rejected = false;
    try { writeProject(bad); } catch (err) { rejected = true; }
    if (!rejected) problems.push(`lint accepted ${name} type=${type} value=${value}`);
  }

  if (problems.length) {
    console.error('SELF-TEST FAILED');
    problems.forEach(p => console.error('  - ' + p));
    process.exit(1);
  }
  const views = scan(xml).filter(e => e.type.endsWith('View')).length;
  console.log(`SELF-TEST OK — ${elems.length} objects, ${views} views, ${xml.length} bytes`);
}

module.exports = {
  Elem,
  guid,
  escapeXml,
  bgrColor,
  lint,
  writeProject,
  writeFile,
  DEFAULT_ARRAY_FIELDS,
  DEFAULT_INVERSES
};

if (require.main === module && process.argv.includes('--self-test')) selfTest();
