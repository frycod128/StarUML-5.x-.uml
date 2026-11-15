#!/usr/bin/env node
'use strict';

/**
 * Complete sequence diagram with a CombinedFragment (`alt`) and messages inside
 * both operands.
 *
 * Important StarUML 5 rendering rules demonstrated here:
 *   - every UMLSeqStimulusView has a nested UMLActivationView when the diagram
 *     has ShowActivation=True; omitting it raises an access violation;
 *   - message views stay in UMLSequenceDiagramView.OwnedViews. Operand
 *     containment is expressed by coordinates, not by nesting the message view
 *     under UMLInteractionOperandView.ContainedViews;
 *   - UMLStimulus is not a UMLInteractionFragment, so it is not stored in
 *     UMLInteractionOperand.Fragments;
 *   - xpd.applyDefaultDiagramPalette() writes the standard line/fill/text colors.
 *
 * Usage: node example_sequence.js [out.uml]
 */

const path = require('path');
const xpd = require('./xpd');

/* ------------------------------------------------------------------ model */

const project = new xpd.Elem('DocumentElement', 'UMLProject')
  .attr('Documentation', 'string', 'Sequence diagram with an alt combined fragment')
  .attr('Title', 'string', 'Order sequence')
  .attr('Author', 'string', '')
  .attr('Company', 'string', '')
  .attr('Copyright', 'string', '');

const model = new xpd.Elem('OwnedElements', 'UMLModel')
  .attr('Name', 'string', 'Order system')
  .ref('Namespace', project.id);
project.add(model);

const controller = new xpd.Elem('OwnedElements', 'UMLClass')
  .attr('Name', 'string', 'OrderController')
  .ref('Namespace', model.id);
model.add(controller);

const operation = new xpd.Elem('Operations', 'UMLOperation')
  .attr('Name', 'string', 'submitOrder')
  .ref('Owner', controller.id);
controller.add(operation);

const collaboration = new xpd.Elem('OwnedCollaborationInstanceSets', 'UMLCollaborationInstanceSet')
  .attr('Name', 'string', 'Submit order collaboration')
  .ref('RepresentedOperation', operation.id);
operation.add(collaboration);

const customer = new xpd.Elem('ParticipatingInstances', 'UMLObject')
  .attr('Name', 'string', 'c:Customer')
  .ref('CollaborationInstanceSet', collaboration.id);
const orderSystem = new xpd.Elem('ParticipatingInstances', 'UMLObject')
  .attr('Name', 'string', 'o:OrderSystem')
  .ref('CollaborationInstanceSet', collaboration.id);
collaboration.add(customer);
collaboration.add(orderSystem);

const interaction = new xpd.Elem('InteractionInstanceSets', 'UMLInteractionInstanceSet')
  .attr('Name', 'string', 'Submit order interaction')
  .ref('Context', collaboration.id);
collaboration.add(interaction);

const fragment = new xpd.Elem('Fragments', 'UMLCombinedFragment')
  .attr('InteractionOperator', 'UMLInteractionOperatorKind', 'iokAlt')
  .ref('EnclosingInteractionInstanceSet', interaction.id);
interaction.add(fragment);

const operandSpecs = [
  { guard: 'cardValid && inStock' },
  { guard: '!cardValid || !inStock' }
];
for (const operandSpec of operandSpecs) {
  const operand = new xpd.Elem('Operands', 'UMLInteractionOperand')
    .attr('Guard', 'string', operandSpec.guard)
    .ref('CombinedFragment', fragment.id);
  fragment.add(operand);
  operandSpec.elem = operand;
}

const messageSpecs = [
  {
    name: 'submitOrder',
    branch: '1',
    sender: customer,
    receiver: orderSystem,
    text: '1 : submitOrder()',
    y: 235,
    operand: 0
  },
  {
    name: 'orderAccepted',
    branch: '1.1',
    sender: orderSystem,
    receiver: customer,
    text: '1.1 : orderAccepted()',
    y: 270,
    operand: 0
  },
  {
    name: 'rejectOrder',
    branch: '2',
    sender: orderSystem,
    receiver: customer,
    text: '2 : rejectOrder()',
    y: 375,
    operand: 1
  }
];
for (const messageSpec of messageSpecs) {
  const stimulus = new xpd.Elem('ParticipatingStimuli', 'UMLStimulus')
    .attr('Name', 'string', messageSpec.name)
    .attr('Branch', 'string', messageSpec.branch)
    .ref('Sender', messageSpec.sender.id)
    .ref('Receiver', messageSpec.receiver.id)
    .ref('InteractionInstanceSet', interaction.id);
  stimulus.add(new xpd.Elem('Action', 'UMLCallAction').ref('Stimulus', stimulus.id));
  interaction.add(stimulus);
  messageSpec.elem = stimulus;
}

const diagram = new xpd.Elem('OwnedDiagrams', 'UMLSequenceDiagram')
  .attr('Name', 'string', 'Submit order sequence')
  .attr('DefaultDiagram', 'boolean', 'True')
  .attr('ShowActivation', 'boolean', 'True')
  .attr('ShowSequenceNumber', 'boolean', 'True')
  .attr('MessageSignature', 'UMLMessageSignatureKind', 'mskNameOnly')
  .ref('DiagramOwner', interaction.id);
interaction.add(diagram);

const diagramView = new xpd.Elem('DiagramView', 'UMLSequenceDiagramView')
  .ref('Diagram', diagram.id);
diagram.add(diagramView);

/* ------------------------------------------------------------------ views */

function nameCompartment (name, modelElement) {
  const compartment = new xpd.Elem('NameCompartment', 'UMLNameCompartmentView');
  compartment.add(new xpd.Elem('NameLabel', 'LabelView')
    .attr('Text', 'string', name)
    .ref('Model', modelElement.id));
  compartment.add(new xpd.Elem('StereotypeLabel', 'LabelView')
    .attr('Visible', 'boolean', 'False')
    .ref('Model', modelElement.id));
  compartment.add(new xpd.Elem('PropertyLabel', 'LabelView')
    .attr('Visible', 'boolean', 'False')
    .ref('Model', modelElement.id));
  return compartment;
}

function objectView (modelObject, name, left, width) {
  const view = new xpd.Elem('OwnedViews', 'UMLSeqObjectView')
    .attr('Left', 'integer', left)
    .attr('Top', 'integer', 24)
    .attr('Width', 'integer', width)
    .attr('Height', 'integer', 600)
    .ref('Model', modelObject.id);
  view.add(nameCompartment(name, modelObject));
  const lifeLine = new xpd.Elem('LifeLine', 'UMLLifeLineView')
    .ref('Model', modelObject.id);
  view.add(lifeLine);
  diagramView.add(view);
  return { view, lifeLine };
}

const customerViews = objectView(customer, 'c:Customer', 30, 130);
const orderViews = objectView(orderSystem, 'o:OrderSystem', 420, 140);

function label (name, text, modelElement) {
  return new xpd.Elem(name, 'EdgeLabelView')
    .attr('Text', 'string', text)
    .ref('Model', modelElement.id);
}

function hiddenLabel (name, modelElement) {
  return new xpd.Elem(name, 'EdgeLabelView')
    .attr('Visible', 'boolean', 'False')
    .ref('Model', modelElement.id);
}

const fragmentView = new xpd.Elem('OwnedViews', 'UMLCombinedFragmentView')
  .attr('Left', 'integer', 55)
  .attr('Top', 'integer', 170)
  .attr('Width', 'integer', 505)
  .attr('Height', 'integer', 300)
  .ref('Model', fragment.id);
fragmentView.add(new xpd.Elem('NameLabel', 'LabelView')
  .attr('Visible', 'boolean', 'False')
  .ref('Model', fragment.id));
fragmentView.add(new xpd.Elem('FrameTypeLabel', 'LabelView')
  .attr('Text', 'string', 'alt')
  .ref('Model', fragment.id));
diagramView.add(fragmentView);

const operandViewSpecs = [
  { top: 205, height: 110, label: '[cardValid && inStock]' },
  { top: 325, height: 125, label: '[!cardValid || !inStock]' }
];
operandSpecs.forEach((operandSpec, index) => {
  const spec = operandViewSpecs[index];
  const view = new xpd.Elem('ContainedViews', 'UMLInteractionOperandView')
    .attr('Left', 'integer', 64)
    .attr('Top', 'integer', spec.top)
    .attr('Width', 'integer', 486)
    .attr('Height', 'integer', spec.height)
    .ref('Model', operandSpec.elem.id)
    .ref('ContainerView', fragmentView.id);
  view.add(new xpd.Elem('GuardLabel', 'LabelView')
    .attr('Text', 'string', spec.label)
    .ref('Model', operandSpec.elem.id));
  fragmentView.add(view);
});

for (const messageSpec of messageSpecs) {
  const from = messageSpec.sender === customer ? customerViews : orderViews;
  const to = messageSpec.receiver === customer ? customerViews : orderViews;
  const centerX = view => {
    const left = view.attrs.find(attr => attr.name === 'Left').value;
    const width = view.attrs.find(attr => attr.name === 'Width').value;
    return left + Math.round(width / 2);
  };
  const tailX = centerX(from.view);
  const headX = centerX(to.view);

  const view = new xpd.Elem('OwnedViews', 'UMLSeqStimulusView')
    .attr('LineStyle', 'LineStyleKind', 'lsRectilinear')
    .attr('Points', 'Points', `${tailX},${messageSpec.y};${headX},${messageSpec.y}`)
    .ref('Model', messageSpec.elem.id)
    .ref('Head', to.lifeLine.id)
    .ref('Tail', from.lifeLine.id);
  view.add(label('NameLabel', messageSpec.text, messageSpec.elem));
  view.add(hiddenLabel('StereotypeLabel', messageSpec.elem));
  view.add(hiddenLabel('PropertyLabel', messageSpec.elem));
  view.add(new xpd.Elem('Activation', 'UMLActivationView')
    .attr('Left', 'integer', headX - 7)
    .attr('Top', 'integer', messageSpec.y)
    .attr('Width', 'integer', 14)
    .attr('Height', 'integer', 40));
  diagramView.add(view);
}

xpd.applyDefaultDiagramPalette(project);

const out = path.resolve(process.argv[2] || 'sequence-example.uml');
xpd.writeFile(out, project);
console.log('written', out);
