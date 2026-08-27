# 03 — Advanced Facility Platform

## Core principle

A vendor/device is never the domain model.

Incorrect: `InBodyTest`, `NeubieBooking`, `ValdJumpPage`.

Correct: `AssessmentDefinition`, `AssessmentSession`, `MetricResult`, `EquipmentAsset`, `TherapyProtocol`, with vendor adapters.

## Equipment

### EquipmentModel

manufacturer, model, category, description, capabilities, integrationProviderKey, regulatoryNotes, active.

### EquipmentAsset

- tenantId;
- branchId;
- roomId;
- equipmentModelId;
- name;
- assetCode;
- serialNumber;
- status;
- purchaseDate/cost optional;
- warrantyEndsAt;
- last/next service;
- last/next calibration;
- notes.

Statuses: available, reserved, in_use, maintenance, calibration_due, out_of_service, retired.

### Equipment pools

Example: Pilates Reformers — Kilimani containing 12 individual reformers. Pools can constrain capacity while individual assets retain maintenance history.

## Service resource requirements

A service may require room type, room, equipment pool quantity, specific device, credential, role, pre/post buffers and consumable BOM.

Example Reformer Pilates: 1 reformer per attendee + Pilates room + qualified instructor.

Example VO2: metabolic analyzer + treadmill/cycle + qualified tester + calibration buffer + respiratory consumables.

Effective capacity is constrained by the scarcest required resource.

## Assessment families

### Body composition

Generic metrics can cover weight, skeletal muscle mass, body fat mass/percentage, fat-free mass, total/intracellular/extracellular water, ECW/TBW, visceral fat area, BMR, segmental composition and phase angle.

### Metabolic

VO2, VCO2, VO2max, RER, RMR, aerobic/anaerobic thresholds, ventilation, substrate utilization and zones.

### Strength/performance

Jump height, peak force, peak power, impulse, RSI, asymmetry, isometric force, hamstring strength, ROM, sprint time and agility splits.

### Mobility/wellness

ROM, movement screens and configurable non-diagnostic wellness measures.

## Therapy engine

TherapyModality, TherapyProtocol, TherapyProtocolVersion, TherapySession, TherapySessionParameter, TherapySessionEquipment, SafetyChecklistTemplate/Response and ConsentRecord.

Examples: rehab, neuromuscular stimulation, compression, assisted running, manual therapy, mobility and recovery.

## Device/system examples

### InBody 970/970S style

Use generic body-composition metrics and an authorized LookinBody integration later. Do not scrape proprietary reports.

### VALD

Use one VALD adapter and map supported ForceDecks/DynaMo/NordBord/ForceFrame/SmartSpeed results to generic metrics.

### COSMED / metabolic carts

Manual/file import first, then approved interoperability if available.

### PNOE

Manual/report import first, cloud sync only with vendor access.

### NEUBIE / NeuFit

Track asset, qualified practitioner, protocol, body region, session parameters, checklist and outcomes. No autonomous diagnosis/prescription or remote device control.

### AlterG

Record body-weight support, speed, incline, duration and optional imported gait metrics.

### Normatec-style pneumatic compression

Record garment/body region, pressure level, duration, protocol and outcome notes.

## Staff credentials

Credential examples: physiotherapist, sports scientist, NeuFit-certified practitioner, CPET/metabolic testing competency, first aid, specialized equipment training.

Service scheduling must validate required credentials. A staff role label is not automatically a clinical credential.

## Inventory

Separate reusable assets from stock.

Inventory examples: electrode pads, respiratory filters, mouthpieces, gloves, disinfectant, lactate strips, lancets, tape, wipes, nutrition products and merchandise.

Support lot and expiry where useful.

## Session BOM

Each service can define expected consumables. Session completion proposes consumption; staff confirms/edits; stock movement is created and alerts update.

## Member Performance Profile

Add Assessments, Therapy and Progress tabs. Show latest, baseline, delta, date and source. Avoid opaque medical-style readiness claims unless transparently tenant-defined and non-diagnostic.

## Assessment batteries

Examples: Athlete Baseline, Weight Management Baseline, Return to Sport. A battery creates linked child assessments, can reserve required resources and tracks retest intervals.

## Provenance

Every imported result should retain provider, device model/serial where available, external subject/test IDs, captured/imported timestamps, raw payload hash, mapping version, quality flags, reviewer and review state.
