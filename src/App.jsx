import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  Eye,
  EyeOff,
  GripVertical,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Sun,
  Moon,
  Download,
  Upload,
  Layers,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  X,
  GitBranch,
  FileCode,
  Sparkles,
  Play,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Boxes,
  Columns3,
  MessageSquarePlus,
  CheckSquare,
  FileText,
  Scale,
  Plus,
  Check,
  Palette,
} from 'lucide-react';

// ============================================================================
// 1. PRELOADED MULTI-DIALECT SAMPLES (PLANTUML & MERMAID)
// ============================================================================

const PRESET_DIAGRAMS = {
  plantuml_checkout: {
    name: 'PlantUML: Checkout & Payment Auth',
    dialect: 'plantuml',
    description:
      'PlantUML showcase with box groups, stereotypes, participant/arrow/activation/fragment/note colors, return, dividers, and @contract / @question / @decision metadata.',
    code: `@startuml CheckoutAndPaymentAuth
title Checkout & Payment Authorization Flow
autonumber

actor Customer

box "Edge & Experience" #0ea5e9
  boundary "API Gateway" as GW
end box

box "Core Commerce" #6366f1
  control "Order Service" as OrderSvc
  database "Orders DB" as OrdersDB #10b981
  control "Inventory Service" as InvSvc
end box

box "Payments & Risk" #10b981
  control "Payment Service" as PaySvc
  queue "Kafka Event Bus" as Kafka #a855f7
end box

== Checkout & Fraud Check ==

' @contract: POST /api/v1/checkout | Auth: Bearer JWT | Idempotency-Key required
' @question[open]: Should edge rate-limiting enforce 10 req/min per customerId or IP?
Customer -> GW ++ : POST /api/v1/checkout

' @contract: gRPC OrderService.CreateOrder(cartId, paymentToken) | Timeout: 1200ms
GW -> OrderSvc ++ : createOrder(cartId, paymentToken)

OrderSvc <-> OrdersDB : verifyIdempotencyLock(cartId)
OrderSvc -> OrdersDB ++ : INSERT order (status=PENDING)
OrdersDB --> OrderSvc -- : orderId: "ORD-9042"

opt #0ea5e9 [High-Value Order > $500]
  ' @contract: Sync Risk Scoring | SLA: p99 < 180ms | Fallback: Soft-approve
  ' @decision: Run synchronous fraud check inline before card capture for orders > $500
  OrderSvc -[#f59e0b]> PaySvc ++ #f59e0b : runFraudRiskCheck(customerId, amount)
  note right of PaySvc #f59e0b : Inline check < 180ms p99
  PaySvc -> PaySvc : evaluateVelocityRules()
  return riskScore: 12 (APPROVED)
end

== Payment & Stock Reservation ==

' @contract: POST /internal/v2/payments/authorize | Retry: None (non-idempotent)
' @question[resolved]: Which gateway handles 3DS2 challenge redirects? -> Delegated to PaySvc token vault
OrderSvc -> PaySvc ++ : authorizeAndCapture(orderId, amount)

alt [Payment Method == Card]
  PaySvc -> OrdersDB ++ : fetchSavedCardToken(customerId)
  OrdersDB --> PaySvc -- : tok_visa_4242
  PaySvc -> PaySvc : chargeCardGateway(tok_visa_4242)
else #ec4899 [Payment Method == Digital Wallet]
  PaySvc -> PaySvc : verifyApplePayCryptogram()
  PaySvc -\\ Kafka : publish("wallet.auth.audit")
end

PaySvc --> OrderSvc -- : paymentReceipt(txId="TX-771")

loop [Retry up to 3x on Lock Contention]
  OrderSvc -> InvSvc ++ : reserveStock(orderId, lineItems)
  InvSvc -> OrdersDB ++ : SELECT FOR UPDATE stock_ledger
  OrdersDB --> InvSvc -- : rowsLocked
  InvSvc --> OrderSvc -- : reservationConfirmed
end

OrderSvc -> OrdersDB ++ : UPDATE order SET status=CONFIRMED
OrdersDB --> OrderSvc -- : updated(1)

' @contract: Topic: order.confirmed.v1 | Schema: Avro v3 | PartitionKey: orderId
OrderSvc -[#a855f7]\\ Kafka : publish("order.confirmed.v1")
Kafka -\\ InvSvc : consume("order.confirmed.v1")

OrderSvc --> GW -- : 201 Created { orderId, txId }
GW --> Customer -- : Render Order Confirmation
@enduml`,
  },

  mermaid_fulfillment: {
    name: 'Mermaid: Order Fulfillment Pipeline',
    dialect: 'mermaid',
    description:
      'Mermaid sequenceDiagram showcase with box groups, @{ "type": ... } stereotypes, create/destroy, <<->> bidirectional, rect phase shading, par/and, critical/option, and %% review tags.',
    code: `sequenceDiagram
  title Order Fulfillment Pipeline
  autonumber 1 1
  actor Ops as Warehouse Ops

  box rgba(99, 102, 241, 0.14) Order & Warehouse
    participant OMS as Fulfillment Orchestrator
    participant WMS@{ "type": "control", "alias": "Warehouse WMS" }
    participant Inv@{ "type": "database", "alias": "Stock Ledger" }
  end

  box rgba(16, 185, 129, 0.14) Logistics & Comms
    participant Carrier@{ "type": "boundary", "alias": "Carrier Gateway" }
    participant Notify@{ "type": "queue", "alias": "Notification Hub" }
  end

  link Carrier: Carrier API Docs @ https://carriers.example.com/v1

  %% @contract: Event: order.confirmed.v1 | Consumer Group: fulfillment-workers
  %% @question[open]: What is the dead-letter replay SLA if WMS is undergoing maintenance?
  OMS->>+WMS: allocateWarehouse(orderId, skuList)
  WMS->>+Inv: decrementAvailableStock(skuList)
  Inv-->>-WMS: allocationToken("ALLOC-309")
  WMS<<->>Inv: reconcileBinLocks(skuList)
  WMS-->>-OMS: warehouseAssigned("US-EAST-2")

  rect rgba(56, 189, 248, 0.08)
    Note over OMS,Carrier: Phase 2 — Parallel Label Generation & Dispatch<br/>SLA Target: < 2.5s
    par Generate Shipping Label
      %% @contract: POST /carriers/v1/labels | Timeout: 2500ms | Format: ZPL
      %% @decision: Use async fallback queue if primary carrier API exceeds 2.5s
      create participant LabelWorker@{ "type": "control", "alias": "Label Worker" }
      OMS->>+LabelWorker: renderZplPayload(orderId, weightOz)
      LabelWorker->>+Carrier: requestShippingLabel(orderId, zpl)
      Carrier-->>-LabelWorker: trackingNumber("1Z999AA10123456784")
      LabelWorker-->>-OMS: labelArtifact(zplUrl)
      destroy LabelWorker
    and Send Dispatch Notice
      OMS-)Notify: emit("shipment.label.created")
      Notify-)Ops: pushPickListAlert("US-EAST-2")
    end
  end

  alt International Customs Required
    %% @question[resolved]: Which HS tariff lookup table is authoritative? -> TradeCompliance v3
    OMS->>+Carrier: submitCommercialInvoice(orderId, hsCodes)
    Carrier-->>-OMS: customsClearanceId("CUST-882")
  else Domestic Ground Shipment
    OMS->>OMS: attachStandardManifest()
  end

  critical Carrier Pickup Cutoff
    %% @contract: POST /wms/v1/pick-waves | Idempotent via allocationToken
    OMS->>+WMS: releasePickWave(allocationToken, trackingNumber)
    WMS-->>-OMS: waveQueued(waveId="W-44")
  option Cutoff Window Missed
    Carrier--xOMS: pickupWindowExpired(nextSlot="06:00")
  end

  OMS-)Notify: emit("order.fulfillment.ready")`,
  },
};

// ============================================================================
// 2. DIALECT AUTO-DETECTOR & UNIFIED AST PARSERS (PLANTUML + MERMAID)
// ============================================================================

const PUML_PARTICIPANT_KEYWORDS = new Set([
  'participant',
  'actor',
  'boundary',
  'control',
  'entity',
  'database',
  'collections',
  'queue',
]);

const FRAGMENT_KEYWORDS = new Set([
  'alt',
  'opt',
  'loop',
  'par',
  'break',
  'critical',
  'group',
]);

/**
 * Automatically detects whether raw source text is PlantUML or Mermaid sequence syntax.
 */
function detectDialect(sourceText) {
  const lines = sourceText.split(/\r?\n/);
  let pumlScore = 0;
  let mermaidScore = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (/^sequenceDiagram\b/i.test(line)) mermaidScore += 10;
    if (/^%%/.test(line)) mermaidScore += 3;
    if (/^rect\s+(rgb|rgba|#)/i.test(line)) mermaidScore += 4;
    if (/(->>\+|-->>-|-\)|--\)|<<-->>|<<->>)/.test(line)) mermaidScore += 3;
    if (/@\{[^}]*\}/.test(line) || /^create\s+(participant|actor)\b/i.test(line)) mermaidScore += 4;

    if (/^@startuml\b/i.test(line)) pumlScore += 10;
    if (/^'/.test(line)) pumlScore += 3;
    if (/^(boundary|control|database|collections|queue|entity)\s+/i.test(line)) pumlScore += 4;
    if (/\s(\+\+|--)\s*(:|$)/.test(line)) pumlScore += 3;
    if (/^end\s+box\b/i.test(line)) pumlScore += 4;
    if (/^return(?:\s+|$)/i.test(line)) pumlScore += 3;
  }

  return mermaidScore > pumlScore ? 'mermaid' : 'plantuml';
}

function unquote(str) {
  if (!str) return '';
  const trimmed = str.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function normalizeUmlColor(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(trimmed)) {
    return trimmed;
  }
  if (/^(?:rgba?|hsla?)\(/i.test(trimmed)) {
    return trimmed;
  }
  if (/^#[a-zA-Z][a-zA-Z0-9]*$/.test(trimmed)) {
    return trimmed.slice(1);
  }
  return trimmed;
}

function parseHexToRgb(hex) {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return null;
  const h = hex.slice(1);
  if (h.length === 3 || h.length === 4) {
    return {
      r: parseInt(h[0] + h[0], 16),
      g: parseInt(h[1] + h[1], 16),
      b: parseInt(h[2] + h[2], 16),
    };
  }
  if (h.length === 6 || h.length === 8) {
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }
  return null;
}

function applyAlphaToColor(color, alpha) {
  if (!color) return null;
  if (/^rgba\(/i.test(color) || /^hsla\(/i.test(color)) return color;
  const rgbMatch = color.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
  if (rgbMatch) {
    return `rgba(${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]}, ${alpha})`;
  }
  const rgb = parseHexToRgb(color);
  if (rgb) {
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
  }
  const pct = Math.round(alpha * 100);
  return `color-mix(in srgb, ${color} ${pct}%, transparent)`;
}

function blendWithBg(color, bgHex, weight) {
  if (!color) return bgHex;
  const fgRgb = parseHexToRgb(color);
  const bgRgb = parseHexToRgb(bgHex);
  if (fgRgb && bgRgb) {
    const r = Math.round(fgRgb.r * weight + bgRgb.r * (1 - weight));
    const g = Math.round(fgRgb.g * weight + bgRgb.g * (1 - weight));
    const b = Math.round(fgRgb.b * weight + bgRgb.b * (1 - weight));
    return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  }
  const pct = Math.round(weight * 100);
  return `color-mix(in srgb, ${color} ${pct}%, ${bgHex})`;
}

/**
 * Parses structured metadata tags inside single-line comments:
 *   ' @contract: ...   or   %% @contract: ...
 *   ' @question[open]: ...  /  ' @question[resolved]: ...
 *   ' @decision: ...
 */
function parseMetadataDirective(commentBody, lineNum, pendingMeta) {
  const trimmed = commentBody.trim();
  const contractMatch = trimmed.match(/^@contract\s*:\s*(.+)$/i);
  if (contractMatch) {
    pendingMeta.contract = contractMatch[1].trim();
    return true;
  }

  const questionMatch = trimmed.match(/^@question(?:\[(open|resolved)\])?\s*:\s*(.+)$/i);
  if (questionMatch) {
    pendingMeta.questions.push({
      id: `q_${lineNum}_${pendingMeta.questions.length}`,
      status: (questionMatch[1] || 'open').toLowerCase(),
      text: questionMatch[2].trim(),
      lineNum,
    });
    return true;
  }

  const decisionMatch = trimmed.match(/^@decision\s*:\s*(.+)$/i);
  if (decisionMatch) {
    pendingMeta.decisions.push({
      id: `d_${lineNum}_${pendingMeta.decisions.length}`,
      text: decisionMatch[1].trim(),
      lineNum,
    });
    return true;
  }

  return false;
}

function createEmptyPendingMeta() {
  return {
    contract: null,
    questions: [],
    decisions: [],
  };
}

function consumePendingMeta(pendingMeta) {
  const snapshot = {
    contract: pendingMeta.contract,
    questions: [...pendingMeta.questions],
    decisions: [...pendingMeta.decisions],
  };
  pendingMeta.contract = null;
  pendingMeta.questions = [];
  pendingMeta.decisions = [];
  return snapshot;
}

// ----------------------------------------------------------------------------
// 2A. PLANTUML SEQUENCE PARSER -> UNIFIED AST
// ----------------------------------------------------------------------------

function parsePlantUMLParticipantLine(line) {
  const tokens = [];
  const tokenRegex = /"[^"]*"|<<[^>]+>>|#[a-zA-Z0-9]+|\S+/g;
  let m;
  while ((m = tokenRegex.exec(line)) !== null) {
    tokens.push(m[0]);
  }
  if (tokens.length < 2) return null;

  const kind = tokens[0].toLowerCase();
  if (!PUML_PARTICIPANT_KEYWORDS.has(kind)) return null;

  let stereotype = null;
  let color = null;
  const coreTokens = [];

  for (let i = 1; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.startsWith('<<') && t.endsWith('>>')) {
      stereotype = t.slice(2, -2);
    } else if (t.startsWith('#')) {
      color = normalizeUmlColor(t);
    } else {
      coreTokens.push(t);
    }
  }

  let id = '';
  let label = '';
  const asIndex = coreTokens.findIndex((t) => t.toLowerCase() === 'as');

  if (asIndex !== -1 && coreTokens[asIndex + 1]) {
    const left = unquote(coreTokens[0]);
    const right = unquote(coreTokens[asIndex + 1]);
    if (coreTokens[0].startsWith('"') && !coreTokens[asIndex + 1].startsWith('"')) {
      label = left;
      id = right;
    } else if (!coreTokens[0].startsWith('"') && coreTokens[asIndex + 1].startsWith('"')) {
      id = left;
      label = right;
    } else {
      label = left;
      id = right;
    }
  } else if (coreTokens.length >= 1) {
    const val = unquote(coreTokens[0]);
    id = val;
    label = val;
  }

  if (!id) return null;
  return { id, label: label || id, kind, stereotype, color, explicit: true };
}

function parsePlantUMLMessageLine(line) {
  const msgRegex =
    /^("[^"]+"|[\w.]+(?:-[\w.]+)*)\s*((?:<<|<|\\|\/|x|o)?-(?:\[[^\]]+\])?-?(?:>>|>|\\|\/|x|o)?)\s*("[^"]+"|[\w.]+(?:-[\w.]+)*)\s*((?:\+\+|--|\*\*|!!|\s|#[\w]+)*)(?::\s*(.*))?$/;

  const match = line.match(msgRegex);
  if (!match) return null;

  const rawLeft = unquote(match[1]);
  const arrow = match[2];
  const rawRight = unquote(match[3]);
  const modifiersRaw = (match[4] || '').trim();
  const label = (match[5] || '').trim();

  const hasArrowHead = /[<>\\/]/.test(arrow);
  if (!hasArrowHead) return null;

  const isDashed =
    arrow.includes('--') ||
    /-\[[^\]]+\]-/.test(arrow) ||
    /\[[^\]]*\bdashed\b[^\]]*\]/i.test(arrow);
  const isBidirectional = arrow.startsWith('<') && arrow.endsWith('>');
  const isLeftPointing = arrow.startsWith('<') && !arrow.endsWith('>');
  const isHalfAsync = arrow.includes('\\') || arrow.includes('/') || arrow.includes('>>');

  const colorMatch = arrow.match(/\[(#?[a-zA-Z0-9]+)(?:,[^\]]*)?\]/);
  const arrowColor = colorMatch ? normalizeUmlColor(colorMatch[1]) : null;
  const modColorMatch = modifiersRaw.match(/(#[a-zA-Z0-9]+)/);
  const activationColor = modColorMatch ? normalizeUmlColor(modColorMatch[1]) : null;

  const from = isLeftPointing ? rawRight : rawLeft;
  const to = isLeftPointing ? rawLeft : rawRight;

  return {
    from,
    to,
    arrow,
    label,
    isDashed,
    isLeftPointing,
    isBidirectional,
    isHalfAsync,
    arrowColor,
    activationColor,
    activateTarget: modifiersRaw.includes('++'),
    deactivateSource: modifiersRaw.includes('--'),
  };
}

function parsePlantUML(sourceText) {
  const lines = sourceText.split(/\r?\n/);
  const participantsMap = new Map();
  const boxes = [];
  const boxesMap = new Map();
  const warnings = [];
  let title = '';
  let autoNumberEnabled = false;
  let autoNumberCounter = 1;
  let currentBox = null;

  const ensureParticipant = (id) => {
    if (!participantsMap.has(id)) {
      const p = {
        id,
        label: id,
        kind: 'participant',
        stereotype: null,
        color: null,
        boxId: currentBox ? currentBox.id : null,
        explicit: false,
      };
      participantsMap.set(id, p);
      if (currentBox && !currentBox.participantIds.includes(id)) {
        currentBox.participantIds.push(id);
      }
    }
    return participantsMap.get(id);
  };

  const rootChildren = [];
  const blockStack = []; // { type: 'fragment', node }

  const getCurrentContainer = () => {
    if (blockStack.length === 0) return rootChildren;
    const top = blockStack[blockStack.length - 1];
    return top.node.branches[top.node.branches.length - 1].children;
  };

  const getPathPrefix = () => {
    if (blockStack.length === 0) return 'root';
    return blockStack
      .map((b) => `${b.node.id}.b${b.node.branches.length - 1}`)
      .join('.');
  };

  let inMultiLineComment = false;
  let pendingNote = null;
  let pendingMeta = createEmptyPendingMeta();
  let itemCounter = 0;

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const raw = lines[i].trim();

    if (inMultiLineComment) {
      if (raw.includes("'/")) inMultiLineComment = false;
      continue;
    }
    if (raw.startsWith("/'")) {
      if (!raw.includes("'/")) inMultiLineComment = true;
      continue;
    }

    if (pendingNote) {
      if (/^end\s*note$/i.test(raw)) {
        getCurrentContainer().push(pendingNote);
        pendingNote = null;
      } else {
        pendingNote.lines.push(raw);
      }
      continue;
    }

    if (!raw) continue;

    // Single-line comment & @contract / @question / @decision directives
    if (raw.startsWith("'")) {
      parseMetadataDirective(raw.slice(1), lineNum, pendingMeta);
      continue;
    }

    if (/^@startuml/i.test(raw) || /^@enduml/i.test(raw)) continue;
    if (/^(skinparam|hide|show|scale|newpage)\b/i.test(raw)) continue;

    // Box swimlane start: box "Group Name" #Color | box Group Name #Color
    if (/^box\b/i.test(raw)) {
      const rest = raw.slice(3).trim();
      let color = null;
      let label = '';
      if (rest) {
        const trailingColorMatch = rest.match(
          /^(.+?)\s+(#[a-zA-Z0-9]+|(?:rgba?|hsla?)\([^)]+\))$/i
        );
        if (trailingColorMatch) {
          label = unquote(trailingColorMatch[1]);
          color = normalizeUmlColor(trailingColorMatch[2]);
        } else {
          const quotedWithNamed = rest.match(/^("[^"]+")\s+([a-zA-Z]+)$/);
          if (quotedWithNamed) {
            label = unquote(quotedWithNamed[1]);
            color = normalizeUmlColor(quotedWithNamed[2]);
          } else {
            label = unquote(rest);
          }
        }
      }
      const boxId = `box_${boxes.length}`;
      const boxObj = {
        id: boxId,
        label: label || `Group ${boxes.length + 1}`,
        color,
        participantIds: [],
      };
      boxes.push(boxObj);
      boxesMap.set(boxId, boxObj);
      currentBox = boxObj;
      continue;
    }

    // Box swimlane end: end box / endbox
    if (/^end\s*box$/i.test(raw)) {
      currentBox = null;
      continue;
    }

    // Title
    const titleMatch = raw.match(/^title\s+(.+)$/i);
    if (titleMatch) {
      title = titleMatch[1].trim();
      continue;
    }

    // Autonumber
    const autoNumMatch = raw.match(/^autonumber(?:\s+(\d+))?(?:\s+(stop|resume))?$/i);
    if (autoNumMatch) {
      if (autoNumMatch[2]?.toLowerCase() === 'stop') {
        autoNumberEnabled = false;
      } else {
        autoNumberEnabled = true;
        if (autoNumMatch[1]) autoNumberCounter = parseInt(autoNumMatch[1], 10);
      }
      continue;
    }

    // Divider == Text ==
    const dividerMatch = raw.match(/^==\s*(.*?)\s*==$/);
    if (dividerMatch) {
      getCurrentContainer().push({
        type: 'divider',
        id: `${getPathPrefix()}.div_${itemCounter++}`,
        lineNum,
        label: dividerMatch[1] || 'Section',
      });
      continue;
    }

    // Participant declaration
    const firstWord = raw.split(/\s+/)[0].toLowerCase();
    if (PUML_PARTICIPANT_KEYWORDS.has(firstWord)) {
      const p = parsePlantUMLParticipantLine(raw);
      if (p) {
        const boxId = currentBox ? currentBox.id : null;
        if (participantsMap.has(p.id)) {
          const existing = participantsMap.get(p.id);
          participantsMap.set(p.id, { ...existing, ...p, boxId: boxId || existing.boxId });
        } else {
          participantsMap.set(p.id, { ...p, boxId });
        }
        if (currentBox && !currentBox.participantIds.includes(p.id)) {
          currentBox.participantIds.push(p.id);
        }
      } else {
        warnings.push({ lineNum, message: `Could not parse participant: "${raw}"` });
      }
      continue;
    }

    // Explicit activate / deactivate / destroy
    const actMatch = raw.match(/^(activate|deactivate|destroy)\s+("[^"]+"|[\w.-]+)(?:\s+(#[a-zA-Z0-9]+))?$/i);
    if (actMatch) {
      const action = actMatch[1].toLowerCase();
      const target = unquote(actMatch[2]);
      const color = actMatch[3] ? normalizeUmlColor(actMatch[3]) : null;
      ensureParticipant(target);
      getCurrentContainer().push({
        type: 'activation_cmd',
        id: `${getPathPrefix()}.act_${itemCounter++}`,
        lineNum,
        action,
        target,
        color,
      });
      continue;
    }

    // Combined Fragments
    if (FRAGMENT_KEYWORDS.has(firstWord)) {
      let rest = raw.slice(firstWord.length).trim();
      let fragColor = null;
      const colorPrefix = rest.match(
        /^(#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8}|[a-zA-Z][a-zA-Z0-9]*))(?:\s+(.*))?$/
      );
      if (colorPrefix) {
        fragColor = normalizeUmlColor(colorPrefix[1]);
        rest = (colorPrefix[2] || '').trim();
      }
      const fragId = `${getPathPrefix()}.frag_${itemCounter++}`;
      const fragNode = {
        type: 'fragment',
        id: fragId,
        lineNum,
        keyword: firstWord,
        color: fragColor,
        branches: [
          {
            id: `${fragId}.branch_0`,
            keyword: firstWord,
            color: fragColor,
            label: rest,
            children: [],
          },
        ],
      };
      getCurrentContainer().push(fragNode);
      blockStack.push({ type: 'fragment', node: fragNode });
      continue;
    }

    if (firstWord === 'else') {
      if (blockStack.length === 0) {
        warnings.push({ lineNum, message: `'else' without matching fragment block.` });
        continue;
      }
      const topFrag = blockStack[blockStack.length - 1].node;
      let rest = raw.slice(4).trim();
      let branchColor = null;
      const colorPrefix = rest.match(
        /^(#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8}|[a-zA-Z][a-zA-Z0-9]*))(?:\s+(.*))?$/
      );
      if (colorPrefix) {
        branchColor = normalizeUmlColor(colorPrefix[1]);
        rest = (colorPrefix[2] || '').trim();
      }
      const branchIdx = topFrag.branches.length;
      topFrag.branches.push({
        id: `${topFrag.id}.branch_${branchIdx}`,
        keyword: 'else',
        color: branchColor,
        label: rest,
        children: [],
      });
      continue;
    }

    if (/^end$/i.test(raw)) {
      if (blockStack.length === 0) {
        warnings.push({ lineNum, message: `'end' without open fragment block.` });
      } else {
        blockStack.pop();
      }
      continue;
    }

    // Notes
    const noteMatch = raw.match(
      /^note\s+(left\s+of|right\s+of|over)\s+("[^"]+"|[\w.-]+)(?:\s*,\s*("[^"]+"|[\w.-]+))?(?:\s+(#[a-zA-Z0-9]+))?\s*(?::\s*(.*))?$/i
    );
    if (noteMatch) {
      const placement = noteMatch[1].toLowerCase().replace(/\s+/g, ' ');
      const p1 = unquote(noteMatch[2]);
      const p2 = noteMatch[3] ? unquote(noteMatch[3]) : null;
      const noteColor = noteMatch[4] ? normalizeUmlColor(noteMatch[4]) : null;
      ensureParticipant(p1);
      if (p2) ensureParticipant(p2);

      const inlineText = noteMatch[5];
      const noteObj = {
        type: 'note',
        id: `${getPathPrefix()}.note_${itemCounter++}`,
        lineNum,
        placement,
        color: noteColor,
        participants: p2 ? [p1, p2] : [p1],
        lines: inlineText !== undefined ? [inlineText] : [],
      };

      if (inlineText !== undefined) {
        getCurrentContainer().push(noteObj);
      } else {
        pendingNote = noteObj;
      }
      continue;
    }

    // PlantUML `return [label]` (pops active frame and emits return arrow to caller)
    const returnMatch = raw.match(/^return(?:\s+(.*))?$/i);
    if (returnMatch) {
      const metadata = consumePendingMeta(pendingMeta);
      getCurrentContainer().push({
        type: 'return_cmd',
        id: `${getPathPrefix()}.msg_${itemCounter++}`,
        lineNum,
        label: (returnMatch[1] || '').trim(),
        autoNumber: autoNumberEnabled ? autoNumberCounter++ : null,
        metadata,
      });
      continue;
    }

    // Message line
    const parsedMsg = parsePlantUMLMessageLine(raw);
    if (parsedMsg) {
      const fromP = ensureParticipant(parsedMsg.from);
      const toP = ensureParticipant(parsedMsg.to);
      const metadata = consumePendingMeta(pendingMeta);

      getCurrentContainer().push({
        type: 'message',
        id: `${getPathPrefix()}.msg_${itemCounter++}`,
        lineNum,
        ...parsedMsg,
        toKind: toP.kind,
        fromKind: fromP.kind,
        autoNumber: autoNumberEnabled ? autoNumberCounter++ : null,
        metadata,
      });
      continue;
    }

    warnings.push({ lineNum, message: `Unrecognized syntax: "${raw}"` });
  }

  return finalizeUnifiedAST({
    dialect: 'plantuml',
    title,
    boxes,
    boxesMap,
    participantsMap,
    rootChildren,
    warnings,
  });
}

// ----------------------------------------------------------------------------
// 2B. MERMAID SEQUENCE PARSER -> UNIFIED AST
// ----------------------------------------------------------------------------

const MERMAID_PARTICIPANT_TYPES = new Set([
  'participant',
  'actor',
  'boundary',
  'control',
  'entity',
  'database',
  'collections',
  'queue',
]);

function parseMermaidParticipantLine(line) {
  // participant OMS as Fulfillment Orchestrator
  // actor Ops as "Warehouse Ops"
  // participant DB@{ "type": "database", "alias": "Orders DB" }
  let working = line.trim();
  let metaObj = null;

  const metaMatch = working.match(/@\{([\s\S]*)\}\s*$/);
  if (metaMatch) {
    working = working.slice(0, metaMatch.index).trim();
    try {
      metaObj = JSON.parse(`{${metaMatch[1]}}`);
    } catch {
      const typeM = metaMatch[1].match(/type\s*:\s*["']?([a-zA-Z]+)["']?/i);
      const aliasM = metaMatch[1].match(/alias\s*:\s*["']([^"']+)["']/i);
      metaObj = {
        ...(typeM ? { type: typeM[1] } : {}),
        ...(aliasM ? { alias: aliasM[1] } : {}),
      };
    }
  }

  const match = working.match(/^(participant|actor)\s+("[^"]+"|[\w.-]+)(?:\s+as\s+(.+))?$/i);
  if (!match) return null;

  let kind = match[1].toLowerCase();
  const id = unquote(match[2]);
  let label = match[3] ? unquote(match[3].trim()) : id;

  if (metaObj) {
    if (typeof metaObj.type === 'string') {
      const normalizedType = metaObj.type.toLowerCase();
      if (MERMAID_PARTICIPANT_TYPES.has(normalizedType)) {
        kind = normalizedType;
      }
    }
    if (!match[3] && typeof metaObj.alias === 'string' && metaObj.alias.trim()) {
      label = metaObj.alias.trim();
    }
  }

  return {
    id,
    label: label || id,
    kind,
    stereotype: null,
    color: null,
    explicit: true,
  };
}

function parseMermaidMessageLine(line) {
  // Supports Mermaid arrows:
  // ->>  (solid sync), -->> (dashed return/async), -> (solid), --> (dashed),
  // -)   (solid async), --)  (dashed async), -x (solid cross), --x (dashed cross),
  // <<->> (bidirectional solid), <<-->> (bidirectional dashed)
  // Plus inline activation suffixes + or - immediately after the arrow head (e.g. ->>+ or -->>-)
  const msgRegex =
    /^("[^"]+"|[\w.]+(?:-[\w.]+)*)\s*(<<-->>|<<->>|-->>|->>|-->|->|--\)|-\)|--x|-x)\s*([+-])?\s*("[^"]+"|[\w.]+(?:-[\w.]+)*)\s*(?::\s*(.*))?$/;

  const match = line.match(msgRegex);
  if (!match) return null;

  const from = unquote(match[1]);
  const arrow = match[2];
  const actModifier = match[3] || '';
  const to = unquote(match[4]);
  const label = (match[5] || '').trim();

  const isDashed = arrow.startsWith('--') || arrow.startsWith('<<--');
  const isBidirectional = arrow.startsWith('<<');
  const isHalfAsync = arrow.endsWith(')');

  return {
    from,
    to,
    arrow,
    label,
    isDashed,
    isLeftPointing: false,
    isBidirectional,
    isHalfAsync,
    arrowColor: null,
    activateTarget: actModifier === '+',
    deactivateSource: actModifier === '-',
  };
}

function parseMermaid(sourceText) {
  const lines = sourceText.split(/\r?\n/);
  const participantsMap = new Map();
  const boxes = [];
  const boxesMap = new Map();
  const warnings = [];
  let title = '';
  let autoNumberEnabled = false;
  let autoNumberCounter = 1;
  let autoNumberStep = 1;
  let currentBox = null;

  const ensureParticipant = (id) => {
    if (!participantsMap.has(id)) {
      const p = {
        id,
        label: id,
        kind: 'participant',
        stereotype: null,
        color: null,
        boxId: currentBox ? currentBox.id : null,
        explicit: false,
      };
      participantsMap.set(id, p);
      if (currentBox && !currentBox.participantIds.includes(id)) {
        currentBox.participantIds.push(id);
      }
    }
    return participantsMap.get(id);
  };

  const rootChildren = [];
  // Stack holds either { type: 'fragment', node } or { type: 'highlight_band', node }
  const blockStack = [];

  const getCurrentContainer = () => {
    if (blockStack.length === 0) return rootChildren;
    const top = blockStack[blockStack.length - 1];
    if (top.type === 'highlight_band') return top.node.children;
    return top.node.branches[top.node.branches.length - 1].children;
  };

  const getPathPrefix = () => {
    if (blockStack.length === 0) return 'root';
    return blockStack
      .map((b) =>
        b.type === 'highlight_band'
          ? b.node.id
          : `${b.node.id}.b${b.node.branches.length - 1}`
      )
      .join('.');
  };

  let pendingMeta = createEmptyPendingMeta();
  let itemCounter = 0;

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const raw = lines[i].trim();

    if (!raw) continue;

    // Mermaid comments %% and structured metadata tags
    if (raw.startsWith('%%')) {
      parseMetadataDirective(raw.slice(2), lineNum, pendingMeta);
      continue;
    }

    if (/^sequenceDiagram\b/i.test(raw)) continue;

    // Title
    const titleMatch = raw.match(/^title\s*:?\s*(.+)$/i);
    if (titleMatch) {
      title = titleMatch[1].trim();
      continue;
    }

    // Autonumber (supports: autonumber | autonumber off | autonumber <start> [step])
    if (/^autonumber\b/i.test(raw)) {
      if (/^autonumber\s+off\b/i.test(raw)) {
        autoNumberEnabled = false;
      } else {
        autoNumberEnabled = true;
        const numMatch = raw.match(/^autonumber\s+(\d+)(?:\s+(\d+))?/i);
        if (numMatch) {
          autoNumberCounter = parseInt(numMatch[1], 10);
          autoNumberStep = numMatch[2] ? parseInt(numMatch[2], 10) || 1 : 1;
        }
      }
      continue;
    }

    // Box swimlane start: box rgba(...) Team Name | box "Team Name" | box Team Name
    if (/^box\b/i.test(raw)) {
      const rest = raw.slice(3).trim();
      let color = null;
      let label = '';

      if (rest) {
        const explicitColorMatch = rest.match(
          /^((?:rgba?|hsla?)\([^)]+\)|#[0-9a-fA-F]{3,8}|transparent)(?:\s+(.*))?$/i
        );
        if (explicitColorMatch) {
          color = explicitColorMatch[1];
          label = explicitColorMatch[2] ? unquote(explicitColorMatch[2].trim()) : '';
        } else if (rest.startsWith('"')) {
          label = unquote(rest);
        } else {
          const spaceIdx = rest.search(/\s/);
          if (spaceIdx !== -1) {
            const firstToken = rest.slice(0, spaceIdx);
            const remaining = rest.slice(spaceIdx + 1).trim();
            const isNamedColor =
              typeof CSS !== 'undefined' &&
              typeof CSS.supports === 'function' &&
              CSS.supports('color', firstToken);
            if (isNamedColor) {
              color = firstToken;
              label = unquote(remaining);
            } else {
              label = unquote(rest);
            }
          } else {
            label = unquote(rest);
          }
        }
      }

      const boxId = `box_${boxes.length}`;
      const boxObj = {
        id: boxId,
        label: label || `Group ${boxes.length + 1}`,
        color: normalizeUmlColor(color),
        participantIds: [],
      };
      boxes.push(boxObj);
      boxesMap.set(boxId, boxObj);
      currentBox = boxObj;
      continue;
    }

    // Create participant / actor  OR  Participant / Actor (including @{ "type": ... })
    const createMatch = raw.match(/^create\s+((?:participant|actor)\s+.+)$/i);
    const firstWord = raw.split(/\s+/)[0].toLowerCase();
    if (createMatch || firstWord === 'participant' || firstWord === 'actor') {
      const p = parseMermaidParticipantLine(createMatch ? createMatch[1] : raw);
      if (p) {
        const boxId = currentBox ? currentBox.id : null;
        if (participantsMap.has(p.id)) {
          const existing = participantsMap.get(p.id);
          participantsMap.set(p.id, { ...existing, ...p, boxId: boxId || existing.boxId });
        } else {
          participantsMap.set(p.id, { ...p, boxId });
        }
        if (currentBox && !currentBox.participantIds.includes(p.id)) {
          currentBox.participantIds.push(p.id);
        }
      } else {
        warnings.push({ lineNum, message: `Could not parse Mermaid participant: "${raw}"` });
      }
      continue;
    }

    // Participant link / links directives: link A: Label @ URL | links A: { ... }
    const linkMatch = raw.match(/^links?\s+("[^"]+"|[\w.-]+)\s*:\s*(.+)$/i);
    if (linkMatch) {
      const targetId = unquote(linkMatch[1]);
      const p = ensureParticipant(targetId);
      const body = linkMatch[2].trim();
      const existingLinks = p.links ? [...p.links] : [];
      if (raw.toLowerCase().startsWith('links')) {
        try {
          const parsedLinks = JSON.parse(body);
          Object.entries(parsedLinks).forEach(([label, url]) => {
            existingLinks.push({ label, url: String(url) });
          });
        } catch {
          // Ignore malformed JSON links payload without blocking diagram render
        }
      } else {
        const singleMatch = body.match(/^(.+?)\s*@\s*(\S+)$/);
        if (singleMatch) {
          existingLinks.push({ label: singleMatch[1].trim(), url: singleMatch[2].trim() });
        }
      }
      p.links = existingLinks;
      continue;
    }

    // Explicit activate / deactivate / destroy
    const actMatch = raw.match(/^(activate|deactivate|destroy)\s+("[^"]+"|[\w.-]+)$/i);
    if (actMatch) {
      const action = actMatch[1].toLowerCase();
      const target = unquote(actMatch[2]);
      ensureParticipant(target);
      getCurrentContainer().push({
        type: 'activation_cmd',
        id: `${getPathPrefix()}.act_${itemCounter++}`,
        lineNum,
        action,
        target,
      });
      continue;
    }

    // Mermaid `rect rgba(...) ... end` non-branching highlight band
    if (firstWord === 'rect') {
      const rest = raw.slice(4).trim();
      const colorMatch = rest.match(/^(rgba?\([^)]+\)|#[0-9a-fA-F]{3,8}|[a-zA-Z]+)(?:\s+(.*))?$/);
      const bandColor = colorMatch ? colorMatch[1] : 'rgba(99, 102, 241, 0.08)';
      const bandLabel = colorMatch && colorMatch[2] ? colorMatch[2].trim() : '';
      const bandNode = {
        type: 'highlight_band',
        id: `${getPathPrefix()}.rect_${itemCounter++}`,
        lineNum,
        color: bandColor,
        label: bandLabel,
        children: [],
      };
      getCurrentContainer().push(bandNode);
      blockStack.push({ type: 'highlight_band', node: bandNode });
      continue;
    }

    // Combined Fragments: alt, opt, loop, par, break, critical
    if (FRAGMENT_KEYWORDS.has(firstWord)) {
      const condition = raw.slice(firstWord.length).trim();
      const fragId = `${getPathPrefix()}.frag_${itemCounter++}`;
      const fragNode = {
        type: 'fragment',
        id: fragId,
        lineNum,
        keyword: firstWord,
        branches: [
          {
            id: `${fragId}.branch_0`,
            keyword: firstWord,
            label: condition,
            children: [],
          },
        ],
      };
      getCurrentContainer().push(fragNode);
      blockStack.push({ type: 'fragment', node: fragNode });
      continue;
    }

    // Branch dividers: else (alt), and (par), option (critical)
    if (firstWord === 'else' || firstWord === 'and' || firstWord === 'option') {
      // Find innermost fragment on blockStack
      let fragIdx = -1;
      for (let s = blockStack.length - 1; s >= 0; s--) {
        if (blockStack[s].type === 'fragment') {
          fragIdx = s;
          break;
        }
      }
      if (fragIdx === -1) {
        warnings.push({ lineNum, message: `'${firstWord}' without matching fragment block.` });
        continue;
      }
      const topFrag = blockStack[fragIdx].node;
      const condition = raw.slice(firstWord.length).trim();
      const branchIdx = topFrag.branches.length;
      topFrag.branches.push({
        id: `${topFrag.id}.branch_${branchIdx}`,
        keyword: firstWord,
        label: condition,
        children: [],
      });
      continue;
    }

    // Unified `end` closes innermost rect/fragment OR open `box`
    if (/^end$/i.test(raw)) {
      if (blockStack.length > 0) {
        blockStack.pop();
      } else if (currentBox) {
        currentBox = null;
      } else {
        warnings.push({ lineNum, message: `'end' without open block.` });
      }
      continue;
    }

    // Notes: Note left of A: text | Note right of A: text | Note over A,B: text
    const noteMatch = raw.match(
      /^note\s+(left\s+of|right\s+of|over)\s+("[^"]+"|[\w.-]+)(?:\s*,\s*("[^"]+"|[\w.-]+))?\s*:\s*(.*)$/i
    );
    if (noteMatch) {
      const placement = noteMatch[1].toLowerCase().replace(/\s+/g, ' ');
      const p1 = unquote(noteMatch[2]);
      const p2 = noteMatch[3] ? unquote(noteMatch[3]) : null;
      ensureParticipant(p1);
      if (p2) ensureParticipant(p2);

      const textLines = (noteMatch[4] || '').split(/<br\s*\/?>/i);
      getCurrentContainer().push({
        type: 'note',
        id: `${getPathPrefix()}.note_${itemCounter++}`,
        lineNum,
        placement,
        participants: p2 ? [p1, p2] : [p1],
        lines: textLines,
      });
      continue;
    }

    // Message line
    const parsedMsg = parseMermaidMessageLine(raw);
    if (parsedMsg) {
      const fromP = ensureParticipant(parsedMsg.from);
      const toP = ensureParticipant(parsedMsg.to);
      const metadata = consumePendingMeta(pendingMeta);
      let nextAutoNum = null;
      if (autoNumberEnabled) {
        nextAutoNum = autoNumberCounter;
        autoNumberCounter += autoNumberStep;
      }

      getCurrentContainer().push({
        type: 'message',
        id: `${getPathPrefix()}.msg_${itemCounter++}`,
        lineNum,
        ...parsedMsg,
        toKind: toP.kind,
        fromKind: fromP.kind,
        autoNumber: nextAutoNum,
        metadata,
      });
      continue;
    }

    warnings.push({ lineNum, message: `Unrecognized Mermaid syntax: "${raw}"` });
  }

  return finalizeUnifiedAST({
    dialect: 'mermaid',
    title,
    boxes,
    boxesMap,
    participantsMap,
    rootChildren,
    warnings,
  });
}

// ----------------------------------------------------------------------------
// 2C. SHARED CALL-TREE PAIRING & UNIFIED AST FINALIZER
// ----------------------------------------------------------------------------

function finalizeUnifiedAST({
  dialect,
  title,
  boxes,
  boxesMap,
  participantsMap,
  rootChildren,
  warnings,
}) {
  const callStack = [];
  const allNodesById = new Map();
  const orderedSteps = [];

  const recordDescendant = (node) => {
    for (let i = 0; i < callStack.length; i++) {
      const frame = callStack[i];
      frame.callNode.subtreeNodeIds.push(node.id);
      if (node.type === 'message') {
        frame.callNode.descendantStepCount += 1;
      } else if (node.type === 'fragment') {
        frame.callNode.descendantFragmentCount += 1;
      }
    }
  };

  const popFramesDownTo = (targetIdx, returnNode = null) => {
    while (callStack.length - 1 >= targetIdx) {
      const frame = callStack.pop();
      const isDirectMatch = callStack.length === targetIdx && returnNode !== null;
      if (isDirectMatch) {
        frame.callNode.subtreeNodeIds.push(returnNode.id);
        frame.callNode.returnNodeId = returnNode.id;
        frame.callNode.returnLabel = returnNode.label || 'return';
        returnNode.pairedCallId = frame.callNode.id;
      }
      const c = frame.callNode;
      c.hasFoldableChildren =
        c.descendantStepCount > 0 ||
        c.descendantFragmentCount > 0 ||
        c.returnNodeId !== null ||
        frame.hasExplicitActivation;
    }
  };

  function walkNodes(nodes) {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      allNodesById.set(node.id, node);

      if (node.type === 'divider' || node.type === 'note') {
        recordDescendant(node);
        continue;
      }

      if (node.type === 'highlight_band') {
        recordDescendant(node);
        walkNodes(node.children);
        continue;
      }

      if (node.type === 'activation_cmd') {
        if (node.action === 'deactivate' || node.action === 'destroy') {
          for (let s = callStack.length - 1; s >= 0; s--) {
            if (callStack[s].callee === node.target) {
              popFramesDownTo(s, null);
              break;
            }
          }
        }
        continue;
      }

      if (node.type === 'return_cmd') {
        if (callStack.length === 0) {
          warnings.push({
            lineNum: node.lineNum,
            message: `'return' without an active call frame.`,
          });
          continue;
        }
        const topIdx = callStack.length - 1;
        const topFrame = callStack[topIdx];
        node.type = 'message';
        node.from = topFrame.callee;
        node.to = topFrame.caller;
        node.arrow = '-->';
        node.isDashed = true;
        node.isLeftPointing = false;
        node.isBidirectional = false;
        node.isHalfAsync = false;
        node.arrowColor = null;
        node.activateTarget = false;
        node.deactivateSource = true;
        node.fromKind = participantsMap.get(node.from)?.kind || 'participant';
        node.toKind = participantsMap.get(node.to)?.kind || 'participant';
        node.kind = 'return';
        node.pairedCallId = null;
        node.returnNodeId = null;
        node.returnLabel = null;
        node.subtreeNodeIds = [];
        node.descendantStepCount = 0;
        node.descendantFragmentCount = 0;
        node.hasFoldableChildren = false;

        orderedSteps.push(node);
        node.stepIndex = orderedSteps.length;

        for (let s = 0; s < topIdx; s++) {
          callStack[s].callNode.subtreeNodeIds.push(node.id);
          callStack[s].callNode.descendantStepCount += 1;
        }
        popFramesDownTo(topIdx, node);
        continue;
      }

      if (node.type === 'fragment') {
        recordDescendant(node);
        const entryStackDepth = callStack.length;
        for (let b = 0; b < node.branches.length; b++) {
          if (callStack.length > entryStackDepth) {
            popFramesDownTo(entryStackDepth, null);
          }
          walkNodes(node.branches[b].children);
        }
        if (callStack.length > entryStackDepth) {
          popFramesDownTo(entryStackDepth, null);
        }
        continue;
      }

      if (node.type === 'message') {
        // Initialize call-tree properties
        node.kind = 'call';
        node.pairedCallId = null;
        node.returnNodeId = null;
        node.returnLabel = null;
        node.subtreeNodeIds = [];
        node.descendantStepCount = 0;
        node.descendantFragmentCount = 0;
        node.hasFoldableChildren = false;

        orderedSteps.push(node);
        node.stepIndex = orderedSteps.length;

        // 1. Self message
        if (node.from === node.to) {
          node.kind = 'self';
          recordDescendant(node);
          if (node.activateTarget) {
            callStack.push({
              callNode: node,
              caller: node.from,
              callee: node.to,
              hasExplicitActivation: true,
            });
          } else if (node.deactivateSource) {
            for (let s = callStack.length - 1; s >= 0; s--) {
              if (callStack[s].callee === node.from) {
                popFramesDownTo(s, null);
                break;
              }
            }
          }
          continue;
        }

        // 2. Return arrow matching an open call frame
        let matchingFrameIdx = -1;
        if (
          (!node.isBidirectional && (node.isDashed || node.isLeftPointing)) ||
          node.deactivateSource
        ) {
          for (let s = callStack.length - 1; s >= 0; s--) {
            if (callStack[s].callee === node.from && callStack[s].caller === node.to) {
              matchingFrameIdx = s;
              break;
            }
          }
        }

        if (matchingFrameIdx !== -1) {
          node.kind = 'return';
          for (let s = 0; s < matchingFrameIdx; s++) {
            callStack[s].callNode.subtreeNodeIds.push(node.id);
            callStack[s].callNode.descendantStepCount += 1;
          }
          popFramesDownTo(matchingFrameIdx, node);
          continue;
        }

        // 3. Async message
        const isAsync =
          node.isHalfAsync || (node.toKind === 'queue' && !node.activateTarget);

        if (isAsync) {
          node.kind = 'async';
          recordDescendant(node);
          continue;
        }

        // 4. Synchronous Call
        if (callStack.length > 0 && callStack[callStack.length - 1].callee !== node.from) {
          let ancestorCalleeIdx = -1;
          for (let s = callStack.length - 1; s >= 0; s--) {
            if (callStack[s].callee === node.from) {
              ancestorCalleeIdx = s;
              break;
            }
          }
          if (ancestorCalleeIdx !== -1) {
            popFramesDownTo(ancestorCalleeIdx + 1, null);
          } else if (callStack[0].caller === node.from && !callStack[0].hasExplicitActivation) {
            popFramesDownTo(0, null);
          }
        }

        node.kind = 'call';
        recordDescendant(node);
        callStack.push({
          callNode: node,
          caller: node.from,
          callee: node.to,
          hasExplicitActivation: node.activateTarget,
        });
      }
    }
  }

  walkNodes(rootChildren);
  if (callStack.length > 0) {
    popFramesDownTo(0, null);
  }

  let fragmentCount = 0;
  let questionCount = 0;
  let decisionCount = 0;
  allNodesById.forEach((n) => {
    if (n.type === 'fragment') fragmentCount++;
    if (n.type === 'message' && n.metadata) {
      questionCount += n.metadata.questions.length;
      decisionCount += n.metadata.decisions.length;
    }
  });

  return {
    dialect,
    title,
    boxes,
    boxesMap,
    participants: Array.from(participantsMap.values()),
    participantsMap,
    rootChildren,
    allNodesById,
    orderedSteps,
    warnings,
    stats: {
      participantCount: participantsMap.size,
      boxCount: boxes.length,
      messageCount: orderedSteps.length,
      fragmentCount,
      questionCount,
      decisionCount,
    },
  };
}

// ============================================================================
// 3. UNIFIED LAYOUT ENGINE (GROUP COLLAPSE/ROLLUP + STEP-THROUGH + FOLDING)
// ============================================================================

const LAYOUT = {
  LEFT_MARGIN: 118,
  RIGHT_MARGIN: 118,
  COLUMN_SPACING: 198,
  TOP_START: 24,
  ROW_MESSAGE: 56,
  ROW_SELF_MESSAGE: 62,
  ROW_FOLDED_CALL: 46,
  ROW_HIDDEN_STUB: 44,
  ROW_COALESCED_HIDDEN: 42,
  ROW_DIVIDER: 44,
  ROW_NOTE: 54,
  FRAG_HEADER_H: 30,
  FRAG_ELSE_H: 28,
  FRAG_BOTTOM_PAD: 14,
};

/**
 * Resolves effective column entities based on per-box `collapsedBoxIds`.
 * Any participant whose `boxId` is in `collapsedBoxIds` rolls up into a single `group:${box.id}` column.
 */
function buildEffectiveColumns(ast, lifelineOrder, collapsedBoxIds) {
  const orderedParticipants = lifelineOrder
    .map((id) => ast.participantsMap.get(id))
    .filter(Boolean);

  ast.participants.forEach((p) => {
    if (!lifelineOrder.includes(p.id)) orderedParticipants.push(p);
  });

  const participantToColumnId = new Map();
  const columns = [];
  const seenCols = new Set();

  for (const p of orderedParticipants) {
    if (
      p.boxId &&
      ast.boxesMap.has(p.boxId) &&
      collapsedBoxIds &&
      collapsedBoxIds.has(p.boxId)
    ) {
      const box = ast.boxesMap.get(p.boxId);
      const colId = `group:${box.id}`;
      participantToColumnId.set(p.id, colId);
      if (!seenCols.has(colId)) {
        seenCols.add(colId);
        const count = box.participantIds.length;
        columns.push({
          id: colId,
          label: box.label,
          kind: 'group',
          stereotype: `${count} ${count === 1 ? 'member' : 'members'}`,
          color: box.color,
          boxId: box.id,
          memberIds: [...box.participantIds],
        });
      }
    } else {
      participantToColumnId.set(p.id, p.id);
      if (!seenCols.has(p.id)) {
        seenCols.add(p.id);
        columns.push({
          ...p,
          memberIds: [p.id],
        });
      }
    }
  }

  return { columns, participantToColumnId };
}

function collectNodeColumnIds(nodes, participantToColumnId) {
  const ids = new Set();
  const visit = (list) => {
    for (const n of list) {
      if (n.type === 'message') {
        const c1 = participantToColumnId.get(n.from);
        const c2 = participantToColumnId.get(n.to);
        if (c1) ids.add(c1);
        if (c2) ids.add(c2);
      } else if (n.type === 'note') {
        n.participants.forEach((p) => {
          const c = participantToColumnId.get(p);
          if (c) ids.add(c);
        });
      } else if (n.type === 'highlight_band') {
        visit(n.children);
      } else if (n.type === 'fragment') {
        n.branches.forEach((b) => visit(b.children));
      }
    }
  };
  visit(nodes);
  return ids;
}

function computeSequenceLayout({
  ast,
  lifelineOrder,
  hiddenLifelines,
  foldedCallIds,
  foldedBranchIds,
  foldedDividerIds = new Set(),
  collapsedBoxIds,
  stepLimit, // null when Step-Through is off, or 0..N when Step-Through is active
}) {
  const { columns, participantToColumnId } = buildEffectiveColumns(
    ast,
    lifelineOrder,
    collapsedBoxIds
  );

  const columnsMap = new Map(columns.map((c) => [c.id, c]));
  const orderIndexMap = new Map();
  columns.forEach((c, idx) => orderIndexMap.set(c.id, idx));

  const visibleColumns = columns.filter((c) => !hiddenLifelines.has(c.id));
  const columnXMap = new Map();

  visibleColumns.forEach((c, idx) => {
    columnXMap.set(c.id, LAYOUT.LEFT_MARGIN + idx * LAYOUT.COLUMN_SPACING);
  });

  // Compute contiguous Box Swimlane Spans for both expanded and collapsed box groups
  const boxSpans = [];
  if (ast.boxes.length > 0) {
    let currentSpan = null;
    visibleColumns.forEach((col) => {
      if (col.boxId && ast.boxesMap.has(col.boxId)) {
        const box = ast.boxesMap.get(col.boxId);
        const cx = columnXMap.get(col.id);
        const isCollapsed = col.kind === 'group';
        if (
          currentSpan &&
          currentSpan.boxId === col.boxId &&
          currentSpan.isCollapsed === isCollapsed
        ) {
          currentSpan.endX = cx + 82;
          currentSpan.count += 1;
        } else {
          if (currentSpan) boxSpans.push(currentSpan);
          currentSpan = {
            boxId: col.boxId,
            label: box.label,
            color: box.color,
            startX: cx - 82,
            endX: cx + 82,
            count: isCollapsed ? box.participantIds.length : 1,
            isCollapsed,
          };
        }
      } else {
        if (currentSpan) {
          boxSpans.push(currentSpan);
          currentSpan = null;
        }
      }
    });
    if (currentSpan) boxSpans.push(currentSpan);
  }

  const canvasWidth = Math.max(
    780,
    LAYOUT.LEFT_MARGIN +
      Math.max(0, visibleColumns.length - 1) * LAYOUT.COLUMN_SPACING +
      LAYOUT.RIGHT_MARGIN
  );

  // Build set of AST node IDs skipped due to folded call subtrees
  const skippedByFoldedCall = new Set();
  foldedCallIds.forEach((callId) => {
    const callNode = ast.allNodesById.get(callId);
    if (callNode && Array.isArray(callNode.subtreeNodeIds)) {
      callNode.subtreeNodeIds.forEach((subId) => skippedByFoldedCall.add(subId));
    }
  });

  const renderItems = [];
  const activationSpans = [];
  const openActivations = new Map();

  const startActivation = (colId, y, callId, color = null, collapsedDividerId = null) => {
    if (hiddenLifelines.has(colId)) return;
    const stack = openActivations.get(colId) || [];
    stack.push({
      startY: y,
      callId,
      depth: stack.length,
      color: color || null,
      collapsedDividerId,
    });
    openActivations.set(colId, stack);
  };

  const endActivation = (colId, y, callId = null, collapsedDividerId = null) => {
    if (hiddenLifelines.has(colId)) return;
    const stack = openActivations.get(colId);
    if (!stack || stack.length === 0) return;

    let idx = stack.length - 1;
    if (callId) {
      const found = stack.findIndex((item) => item.callId === callId);
      if (found !== -1) idx = found;
    }
    const [closed] = stack.splice(idx, 1);
    if (closed) {
      if (collapsedDividerId && closed.collapsedDividerId === collapsedDividerId) {
        return;
      }
      activationSpans.push({
        colId,
        x: columnXMap.get(colId),
        startY: closed.startY,
        endY: Math.max(closed.startY + 18, y),
        depth: closed.depth,
        callId: closed.callId,
        color: closed.color || null,
      });
    }
  };

  const countSectionItems = (list) => {
    let count = 0;
    for (const n of list) {
      if (skippedByFoldedCall.has(n.id)) continue;
      if (n.type === 'message') {
        if (stepLimit !== null && n.stepIndex > stepLimit) continue;
        count += 1;
      } else if (n.type === 'note') {
        count += 1;
      } else if (n.type === 'highlight_band') {
        count += countSectionItems(n.children);
      } else if (n.type === 'fragment') {
        for (const branch of n.branches) {
          count += countSectionItems(branch.children);
        }
      }
    }
    return count;
  };

  const processCollapsedDividerActivations = (sectionNodes, dividerId, dividerY) => {
    for (const n of sectionNodes) {
      if (skippedByFoldedCall.has(n.id)) continue;

      if (n.type === 'activation_cmd') {
        const targetCol = participantToColumnId.get(n.target) || n.target;
        if (n.action === 'activate') {
          startActivation(targetCol, dividerY, n.id, n.color || null, dividerId);
        } else {
          endActivation(targetCol, dividerY, null, dividerId);
        }
        continue;
      }

      if (n.type === 'highlight_band') {
        processCollapsedDividerActivations(n.children, dividerId, dividerY);
        continue;
      }

      if (n.type === 'fragment') {
        for (const branch of n.branches) {
          if (!foldedBranchIds.has(branch.id)) {
            processCollapsedDividerActivations(branch.children, dividerId, dividerY);
          }
        }
        continue;
      }

      if (n.type === 'message') {
        if (stepLimit !== null && n.stepIndex > stepLimit) continue;

        const fromColId = participantToColumnId.get(n.from) || n.from;
        const toColId = participantToColumnId.get(n.to) || n.to;
        const fromHidden = hiddenLifelines.has(fromColId);
        const toHidden = hiddenLifelines.has(toColId);
        const isFoldedCall = n.kind === 'call' && foldedCallIds.has(n.id);

        if (fromHidden && toHidden) continue;
        if (fromColId === toColId && fromColId.startsWith('group:') && n.from !== n.to) {
          continue;
        }

        if (fromHidden !== toHidden) {
          if (n.kind === 'call' && !isFoldedCall && fromHidden && !toHidden) {
            startActivation(toColId, dividerY, n.id, n.activationColor || null, dividerId);
          } else if (n.kind === 'return' && n.pairedCallId) {
            endActivation(fromColId, dividerY, n.pairedCallId, dividerId);
          }
          continue;
        }

        if (isFoldedCall) continue;

        if (fromColId === toColId) {
          if (n.kind === 'return' && n.pairedCallId) {
            endActivation(toColId, dividerY, n.pairedCallId, dividerId);
          }
          continue;
        }

        if (n.kind === 'call' && (n.hasFoldableChildren || n.activateTarget)) {
          startActivation(toColId, dividerY, n.id, n.activationColor || null, dividerId);
        } else if (n.kind === 'return' && n.pairedCallId) {
          endActivation(fromColId, dividerY, n.pairedCallId, dividerId);
        }
      }
    }
  };

  let cursorY = LAYOUT.TOP_START;
  let pendingHiddenCluster = null;
  let pendingGroupInternalCluster = null;

  const flushHiddenCluster = () => {
    if (!pendingHiddenCluster) return;
    const { items, startY } = pendingHiddenCluster;
    const pairLabels = Array.from(pendingHiddenCluster.pairs).slice(0, 2).join(', ');
    const columnIds = Array.from(pendingHiddenCluster.columnIds);
    const y = startY + 18;
    renderItems.push({
      type: 'coalesced_hidden',
      id: `hidden_cluster_${items[0].id}`,
      y,
      count: items.length,
      pairSummary: pairLabels,
      columnIds,
      messages: items,
    });
    cursorY = startY + LAYOUT.ROW_COALESCED_HIDDEN;
    pendingHiddenCluster = null;
  };

  const flushGroupInternalCluster = () => {
    if (!pendingGroupInternalCluster) return;
    const { items, startY, groupColId, groupLabel, groupColor } = pendingGroupInternalCluster;
    const x = columnXMap.get(groupColId);
    const y = startY + 20;
    renderItems.push({
      type: 'group_internal_cluster',
      id: `group_int_${items[0].id}`,
      y,
      x,
      groupColId,
      groupLabel,
      groupColor,
      count: items.length,
      messages: items,
    });
    cursorY = startY + 42;
    pendingGroupInternalCluster = null;
  };

  function layoutNodes(nodes, nestingDepth = 0) {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];

      if (skippedByFoldedCall.has(node.id)) continue;

      if (node.type === 'activation_cmd') {
        const targetCol = participantToColumnId.get(node.target) || node.target;
        if (node.action === 'activate') {
          startActivation(targetCol, cursorY, node.id, node.color || null);
        } else {
          endActivation(targetCol, cursorY);
        }
        continue;
      }

      if (node.type === 'divider') {
        if (stepLimit !== null && cursorY > LAYOUT.TOP_START && stepLimit === 0) continue;
        flushHiddenCluster();
        flushGroupInternalCluster();
        let nextDividerIdx = i + 1;
        while (nextDividerIdx < nodes.length && nodes[nextDividerIdx].type !== 'divider') {
          nextDividerIdx += 1;
        }
        const sectionNodes = nodes.slice(i + 1, nextDividerIdx);
        const stepCount = countSectionItems(sectionNodes);
        const isCollapsed = Boolean(foldedDividerIds && foldedDividerIds.has(node.id));
        const y = cursorY + 20;
        renderItems.push({
          type: 'divider',
          id: node.id,
          y,
          label: node.label,
          isCollapsed,
          stepCount,
        });
        cursorY += LAYOUT.ROW_DIVIDER;
        if (isCollapsed) {
          processCollapsedDividerActivations(sectionNodes, node.id, y);
          i = nextDividerIdx - 1;
        }
        continue;
      }

      if (node.type === 'note') {
        const visibleTargets = node.participants
          .map((p) => participantToColumnId.get(p) || p)
          .filter((colId) => !hiddenLifelines.has(colId));
        if (visibleTargets.length === 0) continue;
        flushHiddenCluster();
        flushGroupInternalCluster();
        const y = cursorY + 8;
        const xs = visibleTargets.map((colId) => columnXMap.get(colId));
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        renderItems.push({
          type: 'note',
          id: node.id,
          y,
          placement: node.placement,
          color: node.color || null,
          minX,
          maxX,
          lines: node.lines,
        });
        cursorY += LAYOUT.ROW_NOTE + Math.max(0, node.lines.length - 1) * 15;
        continue;
      }

      // Non-branching Mermaid `rect` Highlight Band
      if (node.type === 'highlight_band') {
        flushHiddenCluster();
        flushGroupInternalCluster();
        const bandTopY = cursorY + 4;
        const colIds = collectNodeColumnIds(node.children, participantToColumnId);
        const visibleXs = Array.from(colIds)
          .filter((cid) => !hiddenLifelines.has(cid))
          .map((cid) => columnXMap.get(cid));

        const inset = nestingDepth * 10;
        const leftX =
          visibleXs.length > 0
            ? Math.max(20 + inset, Math.min(...visibleXs) - 78 + inset)
            : 32 + inset;
        const rightX =
          visibleXs.length > 0
            ? Math.min(canvasWidth - 20 - inset, Math.max(...visibleXs) + 78 - inset)
            : canvasWidth - 32 - inset;

        cursorY = bandTopY + 8;
        layoutNodes(node.children, nestingDepth);
        flushHiddenCluster();
        flushGroupInternalCluster();
        const bandBottomY = cursorY + 8;
        cursorY = bandBottomY + 6;

        renderItems.push({
          type: 'highlight_band',
          id: node.id,
          color: node.color,
          label: node.label,
          leftX,
          rightX,
          topY: bandTopY,
          bottomY: bandBottomY,
        });
        continue;
      }

      // Combined Fragment (alt / opt / loop / par / break / critical / group)
      if (node.type === 'fragment') {
        flushHiddenCluster();
        flushGroupInternalCluster();
        const fragTopY = cursorY + 6;
        const fragColIds = collectNodeColumnIds(
          node.branches.flatMap((b) => b.children),
          participantToColumnId
        );
        const visibleFragXs = Array.from(fragColIds)
          .filter((id) => !hiddenLifelines.has(id))
          .map((id) => columnXMap.get(id));

        const inset = nestingDepth * 12;
        let leftX, rightX;
        if (visibleFragXs.length > 0) {
          leftX = Math.max(20 + inset, Math.min(...visibleFragXs) - 48 + inset);
          rightX = Math.min(
            canvasWidth - 20 - inset,
            Math.max(...visibleFragXs) + (visibleFragXs.length === 1 ? 176 : 82) - inset
          );
        } else {
          leftX = Math.max(24 + inset, canvasWidth / 2 - 180 + inset);
          rightX = Math.min(canvasWidth - 24 - inset, canvasWidth / 2 + 180 - inset);
        }

        const branchHeaders = [];
        cursorY = fragTopY;

        for (let b = 0; b < node.branches.length; b++) {
          const branch = node.branches[b];
          const isBranchFolded = foldedBranchIds.has(branch.id);
          const headerY = cursorY;
          const stepCount = branch.children.length;

          branchHeaders.push({
            branchId: branch.id,
            keyword: branch.keyword.toUpperCase(),
            label: branch.label,
            color: branch.color || null,
            y: headerY,
            isFirst: b === 0,
            isFolded: isBranchFolded,
            stepCount,
          });

          if (isBranchFolded) {
            cursorY += b === 0 ? 28 : 26;
          } else {
            cursorY += (b === 0 ? LAYOUT.FRAG_HEADER_H : LAYOUT.FRAG_ELSE_H) + 8;
            layoutNodes(branch.children, nestingDepth + 1);
            flushHiddenCluster();
            flushGroupInternalCluster();
            cursorY += 6;
          }
        }

        const lastBranch = node.branches[node.branches.length - 1];
        const isLastBranchFolded = lastBranch ? foldedBranchIds.has(lastBranch.id) : false;
        const fragBottomY = cursorY + (isLastBranchFolded ? 2 : LAYOUT.FRAG_BOTTOM_PAD);
        cursorY = fragBottomY + 8;

        renderItems.push({
          type: 'fragment',
          id: node.id,
          keyword: node.keyword.toUpperCase(),
          color: node.color || null,
          leftX,
          rightX,
          topY: fragTopY,
          bottomY: fragBottomY,
          nestingDepth,
          branchHeaders,
        });
        continue;
      }

      // Message Arrow
      if (node.type === 'message') {
        // Step-Through presentation filter
        if (stepLimit !== null && node.stepIndex > stepLimit) {
          continue;
        }

        const fromColId = participantToColumnId.get(node.from) || node.from;
        const toColId = participantToColumnId.get(node.to) || node.to;

        const fromHidden = hiddenLifelines.has(fromColId);
        const toHidden = hiddenLifelines.has(toColId);
        const isFoldedCall = node.kind === 'call' && foldedCallIds.has(node.id);

        // CASE 1: Both endpoints hidden -> Coalesce into inline badge
        if (fromHidden && toHidden) {
          flushGroupInternalCluster();
          const fromC = columnsMap.get(fromColId);
          const toC = columnsMap.get(toColId);
          const pairName =
            fromColId === toColId
              ? `${fromC?.label || fromColId} (internal)`
              : `${fromC?.label || fromColId} ↔ ${toC?.label || toColId}`;

          if (!pendingHiddenCluster) {
            pendingHiddenCluster = {
              startY: cursorY,
              items: [],
              pairs: new Set(),
              columnIds: new Set(),
            };
          }
          pendingHiddenCluster.items.push(node);
          pendingHiddenCluster.pairs.add(pairName);
          pendingHiddenCluster.columnIds.add(fromColId);
          pendingHiddenCluster.columnIds.add(toColId);
          continue;
        }

        flushHiddenCluster();

        // CASE 2: Collapsed Group where sender & receiver belong to the SAME collapsed box
        if (
          fromColId === toColId &&
          fromColId.startsWith('group:') &&
          node.from !== node.to
        ) {
          const groupCol = columnsMap.get(fromColId);
          if (
            pendingGroupInternalCluster &&
            pendingGroupInternalCluster.groupColId === fromColId
          ) {
            pendingGroupInternalCluster.items.push(node);
          } else {
            flushGroupInternalCluster();
            pendingGroupInternalCluster = {
              startY: cursorY,
              groupColId: fromColId,
              groupLabel: groupCol?.label || 'Group',
              groupColor: groupCol?.color || null,
              items: [node],
            };
          }
          continue;
        }

        flushGroupInternalCluster();

        // CASE 3: One endpoint visible, one hidden -> Compact Lifeline Stub Pill
        if (fromHidden !== toHidden) {
          const visibleColId = fromHidden ? toColId : fromColId;
          const hiddenColId = fromHidden ? fromColId : toColId;
          const hiddenCol = columnsMap.get(hiddenColId);
          const visibleX = columnXMap.get(visibleColId);

          const visOrder = orderIndexMap.get(visibleColId) ?? 0;
          const hidOrder = orderIndexMap.get(hiddenColId) ?? 0;
          const side = hidOrder >= visOrder ? 'right' : 'left';
          const direction = fromHidden ? 'incoming' : 'outgoing';

          const y = cursorY + 24;
          renderItems.push({
            type: 'hidden_stub',
            id: node.id,
            node,
            y,
            visibleColId,
            visibleX,
            hiddenColId,
            hiddenLabel: hiddenCol?.label || hiddenColId,
            side,
            direction,
            isFoldedCall,
          });

          if (node.kind === 'call' && !isFoldedCall && fromHidden && !toHidden) {
            startActivation(toColId, y, node.id, node.activationColor || null);
          } else if (node.kind === 'return' && node.pairedCallId) {
            endActivation(fromColId, y, node.pairedCallId);
          }

          cursorY += LAYOUT.ROW_HIDDEN_STUB;
          continue;
        }

        // CASE 4: Both endpoints visible
        const fromX = columnXMap.get(fromColId);
        const toX = columnXMap.get(toColId);

        if (isFoldedCall) {
          const y = cursorY + 24;
          renderItems.push({
            type: 'folded_call',
            id: node.id,
            node,
            y,
            fromX,
            toX,
          });
          cursorY += LAYOUT.ROW_FOLDED_CALL;
          continue;
        }

        if (fromColId === toColId) {
          const y = cursorY + 24;
          renderItems.push({
            type: 'self_message',
            id: node.id,
            node,
            y,
            x: fromX,
            colId: fromColId,
          });
          if (node.kind === 'return' && node.pairedCallId) {
            endActivation(toColId, y, node.pairedCallId);
          }
          cursorY += LAYOUT.ROW_SELF_MESSAGE;
          continue;
        }

        const y = cursorY + 28;
        renderItems.push({
          type: 'message',
          id: node.id,
          node,
          y,
          fromX,
          toX,
          fromColId,
          toColId,
        });

        if (node.kind === 'call' && (node.hasFoldableChildren || node.activateTarget)) {
          startActivation(toColId, y, node.id, node.activationColor || null);
        } else if (node.kind === 'return' && node.pairedCallId) {
          endActivation(fromColId, y, node.pairedCallId);
        }

        cursorY += LAYOUT.ROW_MESSAGE;
      }
    }
  }

  layoutNodes(ast.rootChildren, 0);
  flushHiddenCluster();
  flushGroupInternalCluster();

  openActivations.forEach((stack, colId) => {
    stack.forEach((item) => {
      activationSpans.push({
        colId,
        x: columnXMap.get(colId),
        startY: item.startY,
        endY: Math.max(item.startY + 22, cursorY + 6),
        depth: item.depth,
        callId: item.callId,
        color: item.color || null,
      });
    });
  });

  const totalHeight = Math.max(150, cursorY + 24);

  return {
    columns,
    columnsMap,
    visibleColumns,
    columnXMap,
    boxSpans,
    canvasWidth,
    totalHeight,
    renderItems,
    activationSpans,
  };
}

// ============================================================================
// 4. UML STEREOTYPE & GROUP ICONS
// ============================================================================

function StereotypeIcon({ kind, className = 'w-4 h-4' }) {
  switch (kind) {
    case 'group':
      return <Boxes className={className} />;
    case 'actor':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={className}>
          <circle cx="12" cy="5.5" r="3.2" />
          <path d="M12 9v6.5M7 11.5h10M12 15.5l-4 5.5M12 15.5l4 5.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'database':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
          <ellipse cx="12" cy="5.5" rx="7" ry="2.8" />
          <path d="M5 5.5v13c0 1.55 3.13 2.8 7 2.8s7-1.25 7-2.8v-13" />
          <path d="M5 12c0 1.55 3.13 2.8 7 2.8s7-1.25 7-2.8" />
        </svg>
      );
    case 'queue':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
          <ellipse cx="18.5" cy="12" rx="2.5" ry="6" />
          <path d="M18.5 6h-13C4.12 6 3 8.69 3 12s1.12 6 2.5 6h13" />
          <path d="M9 6v12M13.5 6v12" strokeOpacity="0.6" />
        </svg>
      );
    case 'boundary':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
          <circle cx="14" cy="12" r="6.5" />
          <path d="M3.5 6.5v11M3.5 12h4" strokeLinecap="round" />
        </svg>
      );
    case 'control':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
          <circle cx="12" cy="13" r="6.8" />
          <path d="M10.5 6.3L13 4M10.5 6.3L13 8.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'entity':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
          <circle cx="12" cy="11" r="6.5" />
          <path d="M5 20h14" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
          <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
          <path d="M3.5 9.5h17" strokeOpacity="0.5" />
        </svg>
      );
  }
}

function getStereotypeBadgeColors(kind, isDark) {
  const map = {
    group: isDark
      ? 'text-cyan-300 bg-cyan-500/15 border-cyan-500/35'
      : 'text-cyan-700 bg-cyan-50 border-cyan-300',
    actor: isDark
      ? 'text-amber-300 bg-amber-500/15 border-amber-500/30'
      : 'text-amber-700 bg-amber-50 border-amber-300',
    boundary: isDark
      ? 'text-sky-300 bg-sky-500/15 border-sky-500/30'
      : 'text-sky-700 bg-sky-50 border-sky-300',
    control: isDark
      ? 'text-indigo-300 bg-indigo-500/15 border-indigo-500/30'
      : 'text-indigo-700 bg-indigo-50 border-indigo-300',
    database: isDark
      ? 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30'
      : 'text-emerald-700 bg-emerald-50 border-emerald-300',
    queue: isDark
      ? 'text-purple-300 bg-purple-500/15 border-purple-500/30'
      : 'text-purple-700 bg-purple-50 border-purple-300',
    entity: isDark
      ? 'text-rose-300 bg-rose-500/15 border-rose-500/30'
      : 'text-rose-700 bg-rose-50 border-rose-300',
  };
  return (
    map[kind] ||
    (isDark
      ? 'text-slate-300 bg-slate-700/60 border-slate-600'
      : 'text-slate-700 bg-slate-100 border-slate-300')
  );
}

// ============================================================================
// 5. MAIN UMLENS APPLICATION COMPONENT
// ============================================================================

const COLOR_THEMES = {
  midnight: {
    id: 'midnight',
    label: 'Midnight Dark',
    isDark: true,
    bgApp: 'bg-zinc-950 text-zinc-100',
    bgHeader: 'bg-zinc-900/95 border-zinc-800',
    bgPanel: 'bg-zinc-900 border-zinc-800',
    bgCanvas: 'bg-zinc-950',
    textMuted: 'text-zinc-400',
    textSubtle: 'text-zinc-500',
    border: 'border-zinc-800',
    btnGhost: 'bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-200 border-zinc-700/80',
    btnAccent: 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500',
    svgBg: '#09090b',
    lifelineStroke: '#3f3f46',
    arrowSolid: '#e4e4e7',
    arrowReturn: '#94a3b8',
    arrowAsync: '#c084fc',
    pillBg: '#18181b',
    pillBorder: '#3f3f46',
    pillText: '#f4f4f5',
    activationFill: '#27272a',
    activationStroke: '#a1a1aa',
    fragStroke: '#6366f1',
    fragFill: 'rgba(99, 102, 241, 0.06)',
    fragTagFill: '#312e81',
    fragTagText: '#c7d2fe',
  },
  light: {
    id: 'light',
    label: 'Crisp Light',
    isDark: false,
    bgApp: 'bg-slate-50 text-slate-900',
    bgHeader: 'bg-white/95 border-slate-200',
    bgPanel: 'bg-white border-slate-200',
    bgCanvas: 'bg-[#f8fafc]',
    textMuted: 'text-slate-600',
    textSubtle: 'text-slate-400',
    border: 'border-slate-200',
    btnGhost: 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300',
    btnAccent: 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-600',
    svgBg: '#f8fafc',
    lifelineStroke: '#cbd5e1',
    arrowSolid: '#1e293b',
    arrowReturn: '#64748b',
    arrowAsync: '#7e22ce',
    pillBg: '#ffffff',
    pillBorder: '#cbd5e1',
    pillText: '#0f172a',
    activationFill: '#e2e8f0',
    activationStroke: '#475569',
    fragStroke: '#6366f1',
    fragFill: 'rgba(99, 102, 241, 0.04)',
    fragTagFill: '#e0e7ff',
    fragTagText: '#3730a3',
  },
  nord: {
    id: 'nord',
    label: 'Nordic Slate',
    isDark: true,
    bgApp: 'bg-slate-950 text-slate-100',
    bgHeader: 'bg-slate-900/95 border-slate-800',
    bgPanel: 'bg-slate-900 border-slate-800',
    bgCanvas: 'bg-slate-950',
    textMuted: 'text-slate-400',
    textSubtle: 'text-slate-500',
    border: 'border-slate-800',
    btnGhost: 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border-slate-700/80',
    btnAccent: 'bg-sky-600 hover:bg-sky-500 text-white border-sky-500',
    svgBg: '#0b1220',
    lifelineStroke: '#334155',
    arrowSolid: '#e2e8f0',
    arrowReturn: '#7dd3fc',
    arrowAsync: '#38bdf8',
    pillBg: '#0f172a',
    pillBorder: '#334155',
    pillText: '#f1f5f9',
    activationFill: '#1e293b',
    activationStroke: '#94a3b8',
    fragStroke: '#0284c7',
    fragFill: 'rgba(56, 189, 248, 0.05)',
    fragTagFill: '#0c4a6e',
    fragTagText: '#bae6fd',
  },
  solarized: {
    id: 'solarized',
    label: 'Warm Paper',
    isDark: false,
    bgApp: 'bg-[#fdf6e3] text-[#073642]',
    bgHeader: 'bg-[#eee8d5]/95 border-[#d5ccb4]',
    bgPanel: 'bg-[#faf4e4] border-[#ddd4bc]',
    bgCanvas: 'bg-[#fdf6e3]',
    textMuted: 'text-[#586e75]',
    textSubtle: 'text-[#839496]',
    border: 'border-[#ddd4bc]',
    btnGhost: 'bg-[#fdf6e3] hover:bg-[#eee8d5] text-[#073642] border-[#cbbda0]',
    btnAccent: 'bg-[#268bd2] hover:bg-[#1e78b8] text-white border-[#268bd2]',
    svgBg: '#fdf6e3',
    lifelineStroke: '#cbbfa4',
    arrowSolid: '#073642',
    arrowReturn: '#586e75',
    arrowAsync: '#6c71c4',
    pillBg: '#eee8d5',
    pillBorder: '#cbbfa4',
    pillText: '#073642',
    activationFill: '#e8e1cc',
    activationStroke: '#657b83',
    fragStroke: '#268bd2',
    fragFill: 'rgba(38, 139, 210, 0.05)',
    fragTagFill: '#dde9ec',
    fragTagText: '#073642',
  },
  emerald: {
    id: 'emerald',
    label: 'Forest Dark',
    isDark: true,
    bgApp: 'bg-[#040d0b] text-emerald-50',
    bgHeader: 'bg-[#071512]/95 border-emerald-950',
    bgPanel: 'bg-[#071512] border-emerald-950',
    bgCanvas: 'bg-[#040d0b]',
    textMuted: 'text-emerald-200/70',
    textSubtle: 'text-emerald-400/50',
    border: 'border-emerald-950',
    btnGhost: 'bg-emerald-950/70 hover:bg-emerald-900/70 text-emerald-100 border-emerald-800/70',
    btnAccent: 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500',
    svgBg: '#040d0b',
    lifelineStroke: '#1e3a34',
    arrowSolid: '#d1fae5',
    arrowReturn: '#6ee7b7',
    arrowAsync: '#2dd4bf',
    pillBg: '#071915',
    pillBorder: '#1e3a34',
    pillText: '#ecfdf5',
    activationFill: '#132a24',
    activationStroke: '#94a3b8',
    fragStroke: '#059669',
    fragFill: 'rgba(16, 185, 129, 0.05)',
    fragTagFill: '#065f46',
    fragTagText: '#a7f3d0',
  },
};

export default function App() {
  // Theme & Layout Drawers
  const [themeId, setThemeId] = useState('midnight');
  const theme = COLOR_THEMES[themeId] || COLOR_THEMES.midnight;
  const isDark = theme.isDark;
  const [isEditorOpen, setIsEditorOpen] = useState(true);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [showSyntaxHelp, setShowSyntaxHelp] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Source Code & Dialect Mode ('auto' | 'plantuml' | 'mermaid')
  const [selectedPreset, setSelectedPreset] = useState('plantuml_checkout');
  const [sourceCode, setSourceCode] = useState(PRESET_DIAGRAMS.plantuml_checkout.code);
  const [dialectMode, setDialectMode] = useState('auto');

  // Non-Destructive Exploration Overlay State
  const [collapsedBoxIds, setCollapsedBoxIds] = useState(() => new Set());
  const [hiddenLifelines, setHiddenLifelines] = useState(() => new Set());
  const [foldedCallIds, setFoldedCallIds] = useState(() => new Set());
  const [foldedBranchIds, setFoldedBranchIds] = useState(() => new Set());
  const [foldedDividerIds, setFoldedDividerIds] = useState(() => new Set());
  const [customLifelineOrder, setCustomLifelineOrder] = useState([]);

  // Step-Through Presentation Mode State
  const [isStepMode, setIsStepMode] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  // Selected Message Arrow for Right-Hand Inspector Drawer (tracked by source lineNum for resilience)
  const [selectedMessageLine, setSelectedMessageLine] = useState(null);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newDecisionText, setNewDecisionText] = useState('');
  const [contractDraft, setContractDraft] = useState('');
  const [isEditingContract, setIsEditingContract] = useState(false);

  // Viewport Zoom & Hover State
  const [zoom, setZoom] = useState(1);
  const [hoveredItem, setHoveredItem] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Drag-and-Drop Column State
  const [draggedColId, setDraggedColId] = useState(null);
  const [dropTargetIndex, setDropTargetIndex] = useState(null);

  const svgRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const fileInputRef = useRef(null);

  const triggerToast = useCallback((msg) => {
    setToastMessage(msg);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 3200);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // 1. Detect Active Dialect & Run Matching Parser -> Unified AST
  const detectedDialect = useMemo(() => detectDialect(sourceCode), [sourceCode]);
  const activeDialect = dialectMode === 'auto' ? detectedDialect : dialectMode;

  const ast = useMemo(() => {
    return activeDialect === 'mermaid'
      ? parseMermaid(sourceCode)
      : parsePlantUML(sourceCode);
  }, [sourceCode, activeDialect]);

  // Prune stale collapsed box IDs if source edits remove a `box` group
  useEffect(() => {
    setCollapsedBoxIds((prev) => {
      if (prev.size === 0) return prev;
      let changed = false;
      const next = new Set();
      prev.forEach((id) => {
        if (ast.boxesMap.has(id)) next.add(id);
        else changed = true;
      });
      return changed ? next : prev;
    });
  }, [ast.boxesMap]);

  // Keep currentStep within valid bounds when source edits change message count
  useEffect(() => {
    if (isStepMode && currentStep > ast.orderedSteps.length) {
      setCurrentStep(Math.max(1, ast.orderedSteps.length));
    }
  }, [isStepMode, currentStep, ast.orderedSteps.length]);

  // Reconcile custom lifeline order with parsed participants
  const effectiveLifelineOrder = useMemo(() => {
    const parsedIds = ast.participants.map((p) => p.id);
    const kept = customLifelineOrder.filter((id) => parsedIds.includes(id));
    const added = parsedIds.filter((id) => !kept.includes(id));
    return [...kept, ...added];
  }, [ast.participants, customLifelineOrder]);

  const isOrderModified = customLifelineOrder.length > 0;

  // 2. Compute Sequence Layout Geometry
  const layout = useMemo(
    () =>
      computeSequenceLayout({
        ast,
        lifelineOrder: effectiveLifelineOrder,
        hiddenLifelines,
        foldedCallIds,
        foldedBranchIds,
        foldedDividerIds,
        collapsedBoxIds,
        stepLimit: isStepMode ? currentStep : null,
      }),
    [
      ast,
      effectiveLifelineOrder,
      hiddenLifelines,
      foldedCallIds,
      foldedBranchIds,
      foldedDividerIds,
      collapsedBoxIds,
      isStepMode,
      currentStep,
    ]
  );

  // Collect unique explicit UML arrow colors for SVG <marker> definitions
  const customArrowColors = useMemo(() => {
    const map = new Map();
    let idx = 0;
    ast.orderedSteps.forEach((step) => {
      if (step.arrowColor && !map.has(step.arrowColor)) {
        map.set(step.arrowColor, {
          solidId: `arrow-solid-c-${idx}`,
          openId: `arrow-open-c-${idx}`,
        });
        idx++;
      }
    });
    return map;
  }, [ast.orderedSteps]);

  // Resolve currently selected message node for the Right-Hand Inspector Drawer
  const selectedMessage = useMemo(() => {
    if (selectedMessageLine === null) return null;
    return ast.orderedSteps.find((m) => m.lineNum === selectedMessageLine) || null;
  }, [ast.orderedSteps, selectedMessageLine]);

  // Sync contract draft when selectedMessage changes
  useEffect(() => {
    setIsEditingContract(false);
    setContractDraft(selectedMessage?.metadata?.contract || '');
  }, [selectedMessage?.id, selectedMessage?.metadata?.contract]);

  // Keyboard navigation for Step-Through Mode
  useEffect(() => {
    if (!isStepMode) return;
    const handleKeyDown = (e) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === 'textarea' || tag === 'input' || tag === 'select') return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setCurrentStep((s) => Math.min(ast.orderedSteps.length, s + 1));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentStep((s) => Math.max(0, s - 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isStepMode, ast.orderedSteps.length]);

  // Preset Selection Handler
  const handleSelectPreset = (key) => {
    const preset = PRESET_DIAGRAMS[key];
    if (!preset) return;
    setSelectedPreset(key);
    setSourceCode(preset.code);
    setDialectMode('auto');
    setCollapsedBoxIds(new Set());
    setHiddenLifelines(new Set());
    setFoldedCallIds(new Set());
    setFoldedBranchIds(new Set());
    setFoldedDividerIds(new Set());
    setCustomLifelineOrder([]);
    setIsStepMode(false);
    setCurrentStep(1);
    setSelectedMessageLine(null);
    setZoom(1);
  };

  // Toggle collapse/rollup for a single `box` group
  const toggleCollapseBox = useCallback((boxId) => {
    setCollapsedBoxIds((prev) => {
      const next = new Set(prev);
      if (next.has(boxId)) next.delete(boxId);
      else next.add(boxId);
      return next;
    });
    setHiddenLifelines((prev) => {
      const groupColId = `group:${boxId}`;
      if (!prev.has(groupColId)) return prev;
      const next = new Set(prev);
      next.delete(groupColId);
      return next;
    });
  }, []);

  const expandAllBoxes = useCallback(() => {
    setCollapsedBoxIds(new Set());
    setHiddenLifelines((prev) => {
      let changed = false;
      const next = new Set();
      prev.forEach((id) => {
        if (id.startsWith('group:')) changed = true;
        else next.add(id);
      });
      return changed ? next : prev;
    });
  }, []);

  const collapseAllBoxes = useCallback(() => {
    setCollapsedBoxIds(new Set(ast.boxes.map((b) => b.id)));
    setHiddenLifelines(new Set());
  }, [ast.boxes]);

  // Toggle Hide/Show Lifeline
  const toggleHideLifeline = useCallback((colId) => {
    setHiddenLifelines((prev) => {
      const next = new Set(prev);
      if (next.has(colId)) next.delete(colId);
      else next.add(colId);
      return next;
    });
  }, []);

  const restoreLifelines = useCallback((ids) => {
    setHiddenLifelines((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  }, []);

  // Toggle Call-Tree Folding
  const toggleFoldCall = useCallback((callId) => {
    setFoldedCallIds((prev) => {
      const next = new Set(prev);
      if (next.has(callId)) next.delete(callId);
      else next.add(callId);
      return next;
    });
  }, []);

  // Quick Fold Depth Actions
  const applyFoldDepth = useCallback(
    (maxDepth) => {
      if (maxDepth === Infinity) {
        setFoldedCallIds(new Set());
        setFoldedBranchIds(new Set());
        setFoldedDividerIds(new Set());
        return;
      }
      const nextFolded = new Set();
      const nodeDepthMap = new Map();
      ast.allNodesById.forEach((n) => {
        if (n.type === 'message' && n.kind === 'call') {
          nodeDepthMap.set(n.id, 0);
        }
      });
      ast.allNodesById.forEach((n) => {
        if (n.type === 'message' && n.kind === 'call' && Array.isArray(n.subtreeNodeIds)) {
          n.subtreeNodeIds.forEach((subId) => {
            if (nodeDepthMap.has(subId)) {
              nodeDepthMap.set(subId, nodeDepthMap.get(subId) + 1);
            }
          });
        }
      });
      nodeDepthMap.forEach((depth, id) => {
        const node = ast.allNodesById.get(id);
        if (node && node.hasFoldableChildren && depth >= maxDepth) {
          nextFolded.add(id);
        }
      });
      setFoldedCallIds(nextFolded);
    },
    [ast.allNodesById]
  );

  // Toggle Fragment Branch Folding
  const toggleFoldBranch = useCallback((branchId) => {
    setFoldedBranchIds((prev) => {
      const next = new Set(prev);
      if (next.has(branchId)) next.delete(branchId);
      else next.add(branchId);
      return next;
    });
  }, []);

  // Toggle Divider Region Folding (== Section ==)
  const toggleFoldDivider = useCallback((dividerId) => {
    setFoldedDividerIds((prev) => {
      const next = new Set(prev);
      if (next.has(dividerId)) next.delete(dividerId);
      else next.add(dividerId);
      return next;
    });
  }, []);

  // Select Arrow for Right-Hand Inspector Drawer
  const handleSelectMessage = useCallback((msgNode) => {
    if (!msgNode) return;
    setSelectedMessageLine(msgNode.lineNum);
    setIsInspectorOpen(true);
  }, []);

  // --------------------------------------------------------------------------
  // LIVE METADATA COMMENT INSERTION / TOGGLING IN SOURCE BUFFER
  // --------------------------------------------------------------------------

  const commentPrefix = activeDialect === 'mermaid' ? '%%' : "'";

  const insertDirectiveAboveSelected = (directiveText) => {
    if (!selectedMessage) return;
    const lines = sourceCode.split(/\r?\n/);
    const targetIdx = selectedMessage.lineNum - 1;
    if (targetIdx < 0 || targetIdx >= lines.length) return;

    // Match existing indentation of the arrow line
    const indentMatch = lines[targetIdx].match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1] : '';
    const newLine = `${indent}${commentPrefix} ${directiveText}`;

    lines.splice(targetIdx, 0, newLine);
    setSourceCode(lines.join('\n'));
    // Arrow shifted down by 1 line — update selectedMessageLine so selection stays locked on this arrow
    setSelectedMessageLine(selectedMessage.lineNum + 1);
  };

  const handleAddQuestion = (e) => {
    e.preventDefault();
    const text = newQuestionText.trim();
    if (!text || !selectedMessage) return;
    insertDirectiveAboveSelected(`@question[open]: ${text}`);
    setNewQuestionText('');
    triggerToast(`Inserted @question above L${selectedMessage.lineNum}`);
  };

  const handleAddDecision = (e) => {
    e.preventDefault();
    const text = newDecisionText.trim();
    if (!text || !selectedMessage) return;
    insertDirectiveAboveSelected(`@decision: ${text}`);
    setNewDecisionText('');
    triggerToast(`Inserted @decision above L${selectedMessage.lineNum}`);
  };

  const handleSaveContract = (e) => {
    e.preventDefault();
    if (!selectedMessage) return;
    const trimmed = contractDraft.trim();
    const lines = sourceCode.split(/\r?\n/);

    // Check if an existing @contract comment sits immediately above this message
    let existingContractLineIdx = -1;
    for (let idx = selectedMessage.lineNum - 2; idx >= 0; idx--) {
      const l = lines[idx].trim();
      if (!l) continue;
      if (/^('|%%)\s*@contract\s*:/i.test(l)) {
        existingContractLineIdx = idx;
        break;
      }
      if (!l.startsWith("'") && !l.startsWith('%%')) break;
    }

    if (existingContractLineIdx !== -1) {
      if (trimmed) {
        const indent = (lines[existingContractLineIdx].match(/^(\s*)/) || ['', ''])[1];
        lines[existingContractLineIdx] = `${indent}${commentPrefix} @contract: ${trimmed}`;
        setSourceCode(lines.join('\n'));
      } else {
        lines.splice(existingContractLineIdx, 1);
        setSourceCode(lines.join('\n'));
        setSelectedMessageLine(selectedMessage.lineNum - 1);
      }
    } else if (trimmed) {
      insertDirectiveAboveSelected(`@contract: ${trimmed}`);
    }

    setIsEditingContract(false);
    triggerToast('Updated @contract directive in source');
  };

  const handleToggleQuestionStatus = (questionObj) => {
    const lines = sourceCode.split(/\r?\n/);
    const idx = questionObj.lineNum - 1;
    if (idx < 0 || idx >= lines.length) return;
    const nextStatus = questionObj.status === 'open' ? 'resolved' : 'open';
    if (/@question\[(open|resolved)\]/i.test(lines[idx])) {
      lines[idx] = lines[idx].replace(/@question\[(open|resolved)\]/i, `@question[${nextStatus}]`);
    } else {
      lines[idx] = lines[idx].replace(/@question\s*:/i, `@question[${nextStatus}]:`);
    }
    setSourceCode(lines.join('\n'));
  };

  // Export All Workshop Notes (@contract, @question, @decision) as Markdown
  const handleExportNotesMarkdown = () => {
    const docTitle = ast.title || 'Architecture Sequence Review';
    const mdLines = [
      `# ${docTitle} — Architecture Review Notes`,
      ``,
      `- **Dialect:** ${activeDialect.toUpperCase()}`,
      `- **Participants:** ${ast.stats.participantCount} | **Interactions:** ${ast.stats.messageCount}`,
      `- **Open Questions:** ${
        ast.orderedSteps.reduce(
          (acc, s) => acc + s.metadata.questions.filter((q) => q.status === 'open').length,
          0
        )
      } | **Decisions:** ${ast.stats.decisionCount}`,
      ``,
      `---`,
      ``,
    ];

    let documentedCount = 0;
    ast.orderedSteps.forEach((step) => {
      const { contract, questions, decisions } = step.metadata;
      if (!contract && questions.length === 0 && decisions.length === 0) return;
      documentedCount++;

      const fromLabel = ast.participantsMap.get(step.from)?.label || step.from;
      const toLabel = ast.participantsMap.get(step.to)?.label || step.to;
      mdLines.push(`### Step ${step.stepIndex}: \`${fromLabel} → ${toLabel}\` — ${step.label || '(return)'}`);
      mdLines.push(`*Source Line ${step.lineNum}*`);
      mdLines.push(``);

      if (contract) {
        mdLines.push(`- **Contract:** \`${contract}\``);
      }
      questions.forEach((q) => {
        const badge = q.status === 'resolved' ? '[RESOLVED]' : '[OPEN]';
        mdLines.push(`- **Question ${badge}:** ${q.text}`);
      });
      decisions.forEach((d) => {
        mdLines.push(`- **Decision:** ${d.text}`);
      });
      mdLines.push(``);
    });

    if (documentedCount === 0) {
      mdLines.push(
        `_No @contract, @question, or @decision annotations documented yet. Click any arrow in UMLens to add review notes._`
      );
    }

    const blob = new Blob([mdLines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${docTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-notes.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    triggerToast('Exported review notes as Markdown (.md)');
  };

  // Drag-and-Drop Column Reordering Handlers
  const handleHeaderDragStart = (e, colId) => {
    setDraggedColId(colId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', colId);
  };

  const handleHeaderDragOver = (e, visibleIndex) => {
    e.preventDefault();
    if (!draggedColId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const insertIdx = e.clientX < midX ? visibleIndex : visibleIndex + 1;
    setDropTargetIndex(insertIdx);
  };

  const handleHeaderDrop = (e) => {
    e.preventDefault();
    if (!draggedColId || dropTargetIndex === null) {
      setDraggedColId(null);
      setDropTargetIndex(null);
      return;
    }

    const visibleIds = layout.visibleColumns.map((c) => c.id);
    const fromVisIdx = visibleIds.indexOf(draggedColId);
    if (fromVisIdx === -1) {
      setDraggedColId(null);
      setDropTargetIndex(null);
      return;
    }

    const updatedVisible = [...visibleIds];
    updatedVisible.splice(fromVisIdx, 1);
    const adjustedInsert = dropTargetIndex > fromVisIdx ? dropTargetIndex - 1 : dropTargetIndex;
    updatedVisible.splice(adjustedInsert, 0, draggedColId);

    const currentFullColIds = layout.columns.map((c) => c.id);
    let visCursor = 0;
    const mergedOrder = currentFullColIds.map((id) => {
      if (hiddenLifelines.has(id)) return id;
      return updatedVisible[visCursor++];
    });

    const expandedOrder = [];
    mergedOrder.forEach((colId) => {
      if (colId.startsWith('group:')) {
        const boxId = colId.slice(6);
        const boxMembers = effectiveLifelineOrder.filter(
          (pid) => ast.participantsMap.get(pid)?.boxId === boxId
        );
        expandedOrder.push(...boxMembers);
      } else {
        expandedOrder.push(colId);
      }
    });
    setCustomLifelineOrder(expandedOrder);

    setDraggedColId(null);
    setDropTargetIndex(null);
  };

  const handleHeaderDragEnd = () => {
    setDraggedColId(null);
    setDropTargetIndex(null);
  };

  // Fit-to-Width Zoom Calculation
  const handleFitToWidth = useCallback(() => {
    if (!scrollContainerRef.current) return;
    const containerW = scrollContainerRef.current.clientWidth - 32;
    if (containerW > 100 && layout.canvasWidth > 0) {
      const fitted = Math.min(
        1.15,
        Math.max(0.45, Number((containerW / layout.canvasWidth).toFixed(2)))
      );
      setZoom(fitted);
    }
  }, [layout.canvasWidth]);

  // Export Explored SVG
  const handleExportSVG = () => {
    if (!svgRef.current) return;
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgRef.current);
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(ast.title || 'umlens-diagram')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    triggerToast('Exported diagram as SVG');
  };

  // Import .puml / .mmd / .md File
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (typeof ev.target?.result === 'string') {
        setSelectedPreset('custom');
        setSourceCode(ev.target.result);
        setDialectMode('auto');
        setCollapsedBoxIds(new Set());
        setHiddenLifelines(new Set());
        setFoldedCallIds(new Set());
        setFoldedBranchIds(new Set());
        setFoldedDividerIds(new Set());
        setCustomLifelineOrder([]);
        setSelectedMessageLine(null);
        triggerToast(`Loaded ${file.name}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleCanvasMouseMove = (e) => {
    if (hoveredItem?.tooltip) {
      setTooltipPos({ x: e.clientX + 14, y: e.clientY + 14 });
    }
  };

  const activeColIds = useMemo(() => {
    if (!hoveredItem) return null;
    const set = new Set();
    if (hoveredItem.fromCol) set.add(hoveredItem.fromCol);
    if (hoveredItem.toCol) set.add(hoveredItem.toCol);
    if (hoveredItem.visibleColId) set.add(hoveredItem.visibleColId);
    return set;
  }, [hoveredItem]);

  const codeLines = useMemo(() => sourceCode.split(/\r?\n/), [sourceCode]);

  const activeFiltersCount =
    hiddenLifelines.size +
    foldedCallIds.size +
    foldedBranchIds.size +
    foldedDividerIds.size +
    collapsedBoxIds.size +
    (isOrderModified ? 1 : 0);

  const hasBoxSwimlanes = ast.boxes.length > 0;
  const hasVisibleBoxBanners = layout.boxSpans.length > 0;
  const headerTopHeight = hasVisibleBoxBanners ? 114 : 88;

  return (
    <div className={`flex flex-col h-screen w-full overflow-hidden select-none ${theme.bgApp}`}>
      {/* ==================================================================== */}
      {/* TOP APPLICATION HEADER BAR                                           */}
      {/* ==================================================================== */}
      <header
        className={`flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-b z-30 shrink-0 ${theme.bgHeader}`}
      >
        <div className="flex items-center gap-3">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 via-violet-500 to-cyan-500 flex items-center justify-center shadow-sm">
              <GitBranch className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-sm tracking-tight">UMLens</h1>
                <span
                  className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border ${
                    activeDialect === 'mermaid'
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                  }`}
                >
                  {dialectMode === 'auto'
                    ? `Auto: ${activeDialect === 'mermaid' ? 'Mermaid' : 'PlantUML'}`
                    : activeDialect === 'mermaid'
                    ? 'Mermaid'
                    : 'PlantUML'}
                </span>
              </div>
              <p className={`text-[11px] hidden xl:block ${theme.textMuted}`}>
                Multi-syntax sequence explorer &amp; review workbench
              </p>
            </div>
          </div>

          <div className={`h-5 w-px mx-0.5 hidden md:block ${isDark ? 'bg-zinc-800' : 'bg-slate-200'}`} />

          {/* Sample Selector Dropdown */}
          <select
            aria-label="Select Sample Sequence Diagram"
            value={selectedPreset}
            onChange={(e) => {
              if (e.target.value !== 'custom') handleSelectPreset(e.target.value);
            }}
            className={`text-xs font-medium rounded-lg px-2.5 py-1.5 border outline-none transition cursor-pointer max-w-[230px] sm:max-w-none ${theme.btnGhost}`}
          >
            {Object.entries(PRESET_DIAGRAMS).map(([key, item]) => (
              <option
                key={key}
                value={key}
                className={isDark ? 'bg-zinc-900 text-zinc-100' : 'bg-white text-slate-900'}
              >
                {item.name}
              </option>
            ))}
            {selectedPreset === 'custom' && (
              <option
                value="custom"
                className={isDark ? 'bg-zinc-900 text-zinc-100' : 'bg-white text-slate-900'}
              >
                Imported Diagram
              </option>
            )}
          </select>

          {/* Segmented Dialect Switcher (Auto | PlantUML | Mermaid) */}
          <div
            className={`hidden sm:flex items-center p-0.5 rounded-lg border text-[11px] font-medium ${
              isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-slate-100 border-slate-200'
            }`}
          >
            {[
              { id: 'auto', label: 'Auto' },
              { id: 'plantuml', label: 'PlantUML' },
              { id: 'mermaid', label: 'Mermaid' },
            ].map((tab) => {
              const active = dialectMode === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setDialectMode(tab.id)}
                  className={`px-2 py-1 rounded-md transition cursor-pointer ${
                    active
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : isDark
                      ? 'text-zinc-400 hover:text-zinc-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Global Controls */}
        <div className="flex items-center gap-1.5">
          <input
            ref={fileInputRef}
            type="file"
            accept=".puml,.plantuml,.mmd,.mermaid,.txt,.md"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Import .puml or .mmd file"
            className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition cursor-pointer ${theme.btnGhost}`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Import</span>
          </button>

          <button
            onClick={handleExportSVG}
            title="Export current explored view as SVG"
            className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition cursor-pointer ${theme.btnGhost}`}
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">SVG</span>
          </button>

          <button
            onClick={() => setIsEditorOpen((v) => !v)}
            title={isEditorOpen ? 'Hide Source Editor' : 'Show Source Editor'}
            className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition cursor-pointer ${
              isEditorOpen ? theme.btnAccent : theme.btnGhost
            }`}
          >
            {isEditorOpen ? (
              <PanelLeftClose className="w-3.5 h-3.5" />
            ) : (
              <PanelLeftOpen className="w-3.5 h-3.5" />
            )}
            <span className="hidden md:inline">Source</span>
          </button>

          <button
            onClick={() => setIsInspectorOpen((v) => !v)}
            title={isInspectorOpen ? 'Close Inspector Drawer' : 'Open Arrow & Notes Inspector'}
            className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition cursor-pointer ${
              isInspectorOpen ? theme.btnAccent : theme.btnGhost
            }`}
          >
            {isInspectorOpen ? (
              <PanelRightClose className="w-3.5 h-3.5" />
            ) : (
              <PanelRightOpen className="w-3.5 h-3.5" />
            )}
            <span className="hidden md:inline">Inspector</span>
            {(ast.stats.questionCount > 0 || ast.stats.decisionCount > 0) && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {ast.stats.questionCount + ast.stats.decisionCount}
              </span>
            )}
          </button>

          <div className={`flex items-center gap-1 rounded-lg border px-2 py-1 ${theme.btnGhost}`}>
            <Palette className="w-3.5 h-3.5 opacity-75 shrink-0" />
            <select
              aria-label="Color Theme"
              value={themeId}
              onChange={(e) => setThemeId(e.target.value)}
              className="text-xs font-medium bg-transparent outline-none cursor-pointer"
            >
              {Object.values(COLOR_THEMES).map((t) => (
                <option
                  key={t.id}
                  value={t.id}
                  className={isDark ? 'bg-zinc-900 text-zinc-100' : 'bg-white text-slate-900'}
                >
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setThemeId((id) => (COLOR_THEMES[id]?.isDark ? 'light' : 'midnight'))}
            title={isDark ? 'Quick Switch to Light Mode' : 'Quick Switch to Dark Mode'}
            className={`p-1.5 rounded-lg border transition cursor-pointer ${theme.btnGhost}`}
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700" />
            )}
          </button>
        </div>
      </header>

      {/* ==================================================================== */}
      {/* MAIN 3-PANE WORKSPACE (SOURCE EDITOR | SVG CANVAS | INSPECTOR)       */}
      {/* ==================================================================== */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ------------------------------------------------------------------ */}
        {/* LEFT PANE: LIVE SOURCE EDITOR (.PUML & .MMD)                       */}
        {/* ------------------------------------------------------------------ */}
        {isEditorOpen && (
          <aside
            className={`w-full md:w-[350px] lg:w-[395px] shrink-0 flex flex-col border-r z-20 ${theme.bgPanel}`}
          >
            <div className={`flex items-center justify-between px-3 py-2 border-b text-xs ${theme.border}`}>
              <div className="flex items-center gap-2 font-medium">
                <FileCode className="w-3.5 h-3.5 text-indigo-400" />
                <span>{activeDialect === 'mermaid' ? 'Mermaid (.mmd)' : 'PlantUML (.puml)'}</span>
              </div>

              <div className="relative">
                <button
                  onClick={() => setShowSyntaxHelp((v) => !v)}
                  className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded border transition cursor-pointer ${theme.btnGhost}`}
                >
                  <HelpCircle className="w-3 h-3" />
                  <span>Syntax</span>
                </button>

                {showSyntaxHelp && (
                  <div
                    className={`absolute right-0 mt-1.5 w-80 p-3 rounded-xl border shadow-xl z-50 text-xs select-text ${
                      isDark
                        ? 'bg-zinc-900 border-zinc-700 text-zinc-200'
                        : 'bg-white border-slate-200 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold">Dual-Syntax Reference</span>
                      <button onClick={() => setShowSyntaxHelp(false)} className="p-0.5 opacity-70 hover:opacity-100">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="space-y-2 font-mono text-[10.5px]">
                      <div className="p-2 rounded bg-indigo-500/10 border border-indigo-500/20">
                        <div className="font-bold text-indigo-400 mb-0.5">PlantUML (.puml)</div>
                        box &quot;Team&quot; #0ea5e9 ... end box
                        <br />A -&gt; B ++ : syncCall() / return Result
                        <br />alt / else / opt / loop / par / end
                        <br />&apos; @contract: ... | &apos; @question[open]: ...
                      </div>
                      <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20">
                        <div className="font-bold text-emerald-400 mb-0.5">Mermaid (.mmd)</div>
                        sequenceDiagram / box rgba(...) Team ... end
                        <br />A-&gt;&gt;+B: call / B--&gt;&gt;-A: ret / A&lt;&lt;-&gt;&gt;B: bidir
                        <br />create / destroy / participant X@&#123;&quot;type&quot;:&quot;database&quot;&#125;
                        <br />rect rgba(...) ... end | par ... and ... end
                        <br />%% @contract: ... | %% @decision: ...
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Code Textarea with Synchronized Line Numbers & Selected Arrow Highlight */}
            <div className="relative flex-1 flex min-h-0 overflow-hidden font-mono text-xs">
              <div
                aria-hidden="true"
                className={`py-3 px-2 text-right select-none overflow-hidden border-r ${
                  isDark
                    ? 'bg-zinc-900/60 text-zinc-600 border-zinc-800/80'
                    : 'bg-slate-50 text-slate-400 border-slate-200'
                }`}
              >
                {codeLines.map((_, idx) => {
                  const lineNo = idx + 1;
                  const isSelectedLine = selectedMessageLine === lineNo;
                  return (
                    <div
                      key={idx}
                      className={`leading-5 px-1 rounded ${
                        isSelectedLine ? 'bg-indigo-500/30 text-indigo-300 font-bold' : ''
                      }`}
                    >
                      {lineNo}
                    </div>
                  );
                })}
              </div>
              <textarea
                value={sourceCode}
                onChange={(e) => setSourceCode(e.target.value)}
                spellCheck={false}
                aria-label="Sequence Diagram Source Editor"
                className={`flex-1 p-3 leading-5 resize-none outline-none overflow-auto select-text whitespace-pre ${
                  isDark
                    ? 'bg-zinc-950/70 text-zinc-200 caret-indigo-400'
                    : 'bg-white text-slate-800 caret-indigo-600'
                }`}
              />
            </div>

            {/* Parse Diagnostics Footer */}
            <div
              className={`px-3 py-2 border-t text-[11px] flex flex-col gap-1 ${
                isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {ast.warnings.length === 0 ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  )}
                  <span className="font-medium">
                    {ast.stats.participantCount} lifelines · {ast.stats.messageCount} steps
                    {ast.stats.boxCount > 0 ? ` · ${ast.stats.boxCount} boxes` : ''}
                  </span>
                </div>
                {ast.warnings.length > 0 && (
                  <span className="text-amber-400 font-mono">{ast.warnings.length} warn</span>
                )}
              </div>
              {ast.warnings.length > 0 && (
                <div className="text-[10px] font-mono text-amber-400/90 truncate" title={ast.warnings[0].message}>
                  L{ast.warnings[0].lineNum}: {ast.warnings[0].message}
                </div>
              )}
            </div>
          </aside>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* CENTER PANE: INTERACTIVE SEQUENCE EXPLORER CANVAS                  */}
        {/* ------------------------------------------------------------------ */}
        <main className={`flex-1 flex flex-col min-w-0 overflow-hidden ${theme.bgCanvas}`}>
          {/* Primary Exploration Toolbar */}
          <div
            className={`flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-b z-20 ${
              isDark ? 'bg-zinc-900/75 border-zinc-800' : 'bg-white border-slate-200'
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              {/* Group Collapse / Expand Toggle (when `box` groups exist) */}
              {hasBoxSwimlanes && (
                <div
                  className={`flex items-center p-0.5 rounded-lg border text-[11px] font-medium ${
                    isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-slate-100 border-slate-200'
                  }`}
                >
                  <button
                    onClick={expandAllBoxes}
                    title="Expand all group boxes to show individual lifelines"
                    className={`flex items-center gap-1 px-2 py-1 rounded-md transition cursor-pointer ${
                      collapsedBoxIds.size === 0
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : isDark
                        ? 'text-zinc-400 hover:text-zinc-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Columns3 className="w-3 h-3" />
                    <span>Detailed</span>
                  </button>
                  <button
                    onClick={collapseAllBoxes}
                    title="Roll up every group box into a summary column (or click any group banner to collapse individually)"
                    className={`flex items-center gap-1 px-2 py-1 rounded-md transition cursor-pointer ${
                      collapsedBoxIds.size === ast.boxes.length
                        ? 'bg-cyan-600 text-white shadow-xs'
                        : isDark
                        ? 'text-zinc-400 hover:text-zinc-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Boxes className="w-3 h-3" />
                    <span>Grouped</span>
                  </button>
                </div>
              )}

              {/* Call-Tree Folding Controls */}
              <div className="flex items-center gap-1">
                <span className={`text-[11px] font-medium mr-0.5 hidden sm:flex items-center gap-1 ${theme.textMuted}`}>
                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                  Fold:
                </span>
                <button
                  onClick={() => applyFoldDepth(Infinity)}
                  className={`text-[11px] font-medium px-2 py-1 rounded-md border transition cursor-pointer ${theme.btnGhost}`}
                >
                  Expand All
                </button>
                <button
                  onClick={() => applyFoldDepth(1)}
                  title="Fold call subtrees deeper than Depth 1"
                  className={`text-[11px] font-medium px-2 py-1 rounded-md border transition cursor-pointer ${theme.btnGhost}`}
                >
                  Depth 1
                </button>
                <button
                  onClick={() => applyFoldDepth(2)}
                  title="Fold call subtrees deeper than Depth 2"
                  className={`text-[11px] font-medium px-2 py-1 rounded-md border transition cursor-pointer ${theme.btnGhost}`}
                >
                  Depth 2
                </button>
              </div>

              {/* Step-Through Presentation Mode Toggle */}
              <button
                onClick={() => {
                  setIsStepMode((prev) => {
                    const next = !prev;
                    if (next) setCurrentStep(1);
                    return next;
                  });
                }}
                title="Progressive step-by-step walkthrough mode"
                className={`flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-md border transition cursor-pointer ${
                  isStepMode
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500'
                    : theme.btnGhost
                }`}
              >
                <Play className="w-3 h-3" />
                <span>Step-Through</span>
              </button>

              {activeFiltersCount > 0 && (
                <button
                  onClick={() => {
                    setCollapsedBoxIds(new Set());
                    setHiddenLifelines(new Set());
                    setFoldedCallIds(new Set());
                    setFoldedBranchIds(new Set());
                    setFoldedDividerIds(new Set());
                    setCustomLifelineOrder([]);
                  }}
                  className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 transition cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" />
                  Reset ({activeFiltersCount})
                </button>
              )}
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setZoom((z) => Math.max(0.45, Number((z - 0.1).toFixed(2))))}
                title="Zoom Out"
                className={`p-1.5 rounded-md border transition cursor-pointer ${theme.btnGhost}`}
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setZoom(1)}
                title="Reset Zoom to 100%"
                className={`text-[11px] font-mono px-2 py-1 rounded-md border transition cursor-pointer ${theme.btnGhost}`}
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                onClick={() => setZoom((z) => Math.min(1.6, Number((z + 0.1).toFixed(2))))}
                title="Zoom In"
                className={`p-1.5 rounded-md border transition cursor-pointer ${theme.btnGhost}`}
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleFitToWidth}
                title="Fit Diagram Width"
                className={`flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md border transition cursor-pointer ml-0.5 ${theme.btnGhost}`}
              >
                <Maximize2 className="w-3 h-3" />
                <span className="hidden sm:inline">Fit</span>
              </button>
            </div>
          </div>

          {/* Step-Through Walkthrough Control Bar */}
          {isStepMode && (
            <div
              className={`flex flex-wrap items-center justify-between gap-3 px-4 py-2 border-b text-xs ${
                isDark
                  ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[11px] uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30">
                  Walkthrough
                </span>
                <span className="font-mono font-semibold">
                  Step {currentStep} of {ast.orderedSteps.length}
                </span>
                {currentStep > 0 && ast.orderedSteps[currentStep - 1] && (
                  <span className="hidden md:inline font-mono text-[11px] opacity-85 truncate max-w-md">
                    — {ast.orderedSteps[currentStep - 1].from} →{' '}
                    {ast.orderedSteps[currentStep - 1].to}:{' '}
                    {ast.orderedSteps[currentStep - 1].label || '(return)'}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentStep(0)}
                  disabled={currentStep === 0}
                  className={`flex items-center gap-1 px-2 py-1 rounded border text-[11px] font-medium disabled:opacity-40 cursor-pointer ${theme.btnGhost}`}
                >
                  <SkipBack className="w-3 h-3" />
                  Reset
                </button>
                <button
                  onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
                  disabled={currentStep === 0}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded border text-[11px] font-medium disabled:opacity-40 cursor-pointer ${theme.btnGhost}`}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Prev
                </button>
                <button
                  onClick={() =>
                    setCurrentStep((s) => Math.min(ast.orderedSteps.length, s + 1))
                  }
                  disabled={currentStep >= ast.orderedSteps.length}
                  className="flex items-center gap-1 px-2.5 py-1 rounded border border-emerald-500 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold disabled:opacity-40 cursor-pointer"
                >
                  Next
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setCurrentStep(ast.orderedSteps.length)}
                  disabled={currentStep >= ast.orderedSteps.length}
                  className={`flex items-center gap-1 px-2 py-1 rounded border text-[11px] font-medium disabled:opacity-40 cursor-pointer ${theme.btnGhost}`}
                >
                  All
                  <SkipForward className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {/* Hidden Lifelines / Teams Restore Bar */}
          {hiddenLifelines.size > 0 && (
            <div
              className={`flex flex-wrap items-center gap-2 px-4 py-2 border-b text-xs ${
                isDark
                  ? 'bg-amber-950/25 border-amber-500/25 text-amber-200'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
            >
              <span className="font-semibold flex items-center gap-1.5 text-[11px]">
                <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                Hidden ({hiddenLifelines.size}):
              </span>
              {Array.from(hiddenLifelines).map((id) => {
                const col = layout.columnsMap.get(id);
                return (
                  <button
                    key={id}
                    onClick={() => toggleHideLifeline(id)}
                    className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border transition cursor-pointer ${
                      isDark
                        ? 'bg-zinc-900 border-amber-500/40 text-amber-200 hover:bg-amber-500/20'
                        : 'bg-white border-amber-300 text-amber-900 hover:bg-amber-100'
                    }`}
                  >
                    <Eye className="w-3 h-3 text-amber-400" />
                    <span>{col?.label || id}</span>
                  </button>
                );
              })}
              <button
                onClick={() => setHiddenLifelines(new Set())}
                className="ml-auto text-[11px] font-semibold underline hover:opacity-80 cursor-pointer"
              >
                Show All
              </button>
            </div>
          )}

          {/* Scrollable Diagram Viewport */}
          <div
            ref={scrollContainerRef}
            onMouseMove={handleCanvasMouseMove}
            className="flex-1 overflow-auto relative"
          >
            {layout.visibleColumns.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <EyeOff className="w-10 h-10 text-zinc-500 mb-3" />
                <p className="text-sm font-semibold mb-1">All columns are currently hidden</p>
                <p className={`text-xs mb-4 ${theme.textMuted}`}>
                  Restore one or more hidden columns to continue exploring.
                </p>
                <button
                  onClick={() => setHiddenLifelines(new Set())}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer ${theme.btnAccent}`}
                >
                  Restore All Columns
                </button>
              </div>
            ) : (
              <div
                style={{
                  width: layout.canvasWidth * zoom,
                  minHeight: (layout.totalHeight + headerTopHeight) * zoom,
                }}
                className="relative mx-auto"
              >
                <div
                  style={{
                    width: layout.canvasWidth,
                    transform: `scale(${zoom})`,
                    transformOrigin: 'top left',
                  }}
                >
                  {/* ======================================================== */}
                  {/* STICKY HEADER: GROUP BOX BANNERS + DRAGGABLE COLUMNS     */}
                  {/* ======================================================== */}
                  <div
                    className={`sticky top-0 z-20 pt-2.5 pb-2 border-b backdrop-blur-md transition-colors ${
                      isDark
                        ? 'bg-zinc-950/90 border-zinc-800/90'
                        : 'bg-slate-50/90 border-slate-200/90'
                    }`}
                    style={{ width: layout.canvasWidth, height: headerTopHeight }}
                  >
                    {ast.title && (
                      <div
                        className={`text-[11px] font-semibold tracking-wide uppercase text-center mb-1 ${theme.textMuted}`}
                      >
                        {ast.title}
                      </div>
                    )}

                    {/* Contiguous Box Swimlane Banners (stay anchored above both expanded & collapsed groups) */}
                    {hasVisibleBoxBanners && (
                      <div className="relative w-full h-6 mb-1">
                        {layout.boxSpans.map((span, idx) => {
                          const boxColor = span.color || '#6366f1';
                          return (
                            <button
                              type="button"
                              key={`${span.boxId}_${idx}`}
                              onClick={() => toggleCollapseBox(span.boxId)}
                              title={
                                span.isCollapsed
                                  ? `Expand "${span.label}" (${span.count} ${
                                      span.count === 1 ? 'member' : 'members'
                                    })`
                                  : `Collapse "${span.label}" into a single summary column`
                              }
                              style={{
                                left: span.startX,
                                width: Math.max(120, span.endX - span.startX),
                                borderColor: boxColor,
                                backgroundColor: applyAlphaToColor(
                                  boxColor,
                                  span.isCollapsed
                                    ? isDark
                                      ? 0.24
                                      : 0.16
                                    : isDark
                                    ? 0.16
                                    : 0.11
                                ),
                              }}
                              className={`group/banner absolute top-0 h-5 rounded-md border px-2 flex items-center justify-between gap-1 text-[10px] font-bold tracking-wide truncate cursor-pointer hover:brightness-110 transition ${
                                span.isCollapsed ? 'border-dashed' : ''
                              }`}
                            >
                              <span className="flex items-center min-w-0">
                                <span
                                  className="w-2 h-2 rounded-full mr-1.5 shrink-0"
                                  style={{ backgroundColor: boxColor }}
                                />
                                <span className="truncate">{span.label}</span>
                              </span>
                              {span.isCollapsed ? (
                                <Maximize2 className="w-3 h-3 shrink-0 opacity-75 group-hover/banner:opacity-100 transition" />
                              ) : (
                                <Minimize2 className="w-3 h-3 shrink-0 opacity-55 group-hover/banner:opacity-100 transition" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Draggable Participant / Collapsed Group Column Cards */}
                    <div className="relative w-full h-14">
                      {layout.visibleColumns.map((col, visIdx) => {
                        const centerX = layout.columnXMap.get(col.id);
                        const cardWidth = 160;
                        const isDragging = draggedColId === col.id;
                        const isHighlighted = activeColIds?.has(col.id);
                        const hasExplicitColor = Boolean(col.color) && !isHighlighted && !isDragging;
                        const customCardStyle = hasExplicitColor
                          ? {
                              left: centerX - cardWidth / 2,
                              width: cardWidth,
                              borderColor: col.color,
                              backgroundColor: blendWithBg(
                                col.color,
                                isDark ? '#18181b' : '#ffffff',
                                isDark ? 0.16 : 0.1
                              ),
                            }
                          : {
                              left: centerX - cardWidth / 2,
                              width: cardWidth,
                            };

                        return (
                          <React.Fragment key={col.id}>
                            {draggedColId && dropTargetIndex === visIdx && (
                              <div
                                style={{ left: centerX - LAYOUT.COLUMN_SPACING / 2 }}
                                className="absolute top-0 bottom-0 w-1 bg-cyan-400 rounded-full shadow-[0_0_12px_rgba(34,211,238,0.8)] z-30 pointer-events-none"
                              />
                            )}

                            <div
                              draggable
                              onDragStart={(e) => handleHeaderDragStart(e, col.id)}
                              onDragOver={(e) => handleHeaderDragOver(e, visIdx)}
                              onDrop={handleHeaderDrop}
                              onDragEnd={handleHeaderDragEnd}
                              style={customCardStyle}
                              className={`group absolute top-0 h-13 rounded-xl border px-2.5 py-1.5 flex items-center justify-between gap-1 shadow-sm transition-all cursor-grab active:cursor-grabbing ${
                                isDragging
                                  ? 'opacity-45 scale-95 border-cyan-400'
                                  : isHighlighted
                                  ? isDark
                                    ? 'bg-indigo-950/80 border-indigo-400 ring-2 ring-indigo-500/30'
                                    : 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-500/20'
                                  : hasExplicitColor
                                  ? ''
                                  : col.kind === 'group'
                                  ? isDark
                                    ? 'bg-cyan-950/45 border-cyan-500/50 hover:border-cyan-400'
                                    : 'bg-cyan-50/80 border-cyan-400 hover:border-cyan-500'
                                  : isDark
                                  ? 'bg-zinc-900 border-zinc-700/90 hover:border-zinc-500'
                                  : 'bg-white border-slate-300 hover:border-slate-400'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <GripVertical
                                  className={`w-3.5 h-3.5 shrink-0 opacity-40 group-hover:opacity-90 transition ${theme.textMuted}`}
                                />
                                <div
                                  style={
                                    col.color
                                      ? {
                                          borderColor: col.color,
                                          backgroundColor: applyAlphaToColor(
                                            col.color,
                                            isDark ? 0.2 : 0.14
                                          ),
                                          color: col.color,
                                        }
                                      : undefined
                                  }
                                  className={`p-1 rounded-lg border shrink-0 ${
                                    col.color ? '' : getStereotypeBadgeColors(col.kind, isDark)
                                  }`}
                                >
                                  <StereotypeIcon kind={col.kind} className="w-3.5 h-3.5" />
                                </div>
                                <div className="min-w-0">
                                  <div className="text-xs font-semibold truncate leading-tight" title={col.label}>
                                    {col.label}
                                  </div>
                                  <div
                                    className={`text-[9px] font-mono uppercase tracking-wider truncate ${theme.textSubtle}`}
                                  >
                                    {col.stereotype || col.kind}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center shrink-0">
                                {col.kind === 'group' && col.boxId && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleCollapseBox(col.boxId);
                                    }}
                                    title={`Expand "${col.label}" group`}
                                    className={`p-1 rounded-md opacity-70 group-hover:opacity-100 transition cursor-pointer shrink-0 ${
                                      isDark
                                        ? 'hover:bg-zinc-800 text-cyan-300 hover:text-cyan-200'
                                        : 'hover:bg-slate-100 text-cyan-700 hover:text-cyan-900'
                                    }`}
                                  >
                                    <Maximize2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleHideLifeline(col.id);
                                  }}
                                  title={`Hide ${col.label}`}
                                  className={`p-1 rounded-md opacity-55 group-hover:opacity-100 transition cursor-pointer shrink-0 ${
                                    isDark
                                      ? 'hover:bg-zinc-800 text-zinc-400 hover:text-amber-300'
                                      : 'hover:bg-slate-100 text-slate-500 hover:text-amber-600'
                                  }`}
                                >
                                  <EyeOff className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {draggedColId &&
                              visIdx === layout.visibleColumns.length - 1 &&
                              dropTargetIndex === layout.visibleColumns.length && (
                                <div
                                  style={{ left: centerX + LAYOUT.COLUMN_SPACING / 2 }}
                                  className="absolute top-0 bottom-0 w-1 bg-cyan-400 rounded-full shadow-[0_0_12px_rgba(34,211,238,0.8)] z-30 pointer-events-none"
                                />
                              )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>

                  {/* ======================================================== */}
                  {/* INTERACTIVE SVG SEQUENCE CANVAS                          */}
                  {/* ======================================================== */}
                  <svg
                    ref={svgRef}
                    width={layout.canvasWidth}
                    height={layout.totalHeight}
                    viewBox={`0 0 ${layout.canvasWidth} ${layout.totalHeight}`}
                    xmlns="http://www.w3.org/2000/svg"
                    className="block"
                  >
                    <defs>
                      <marker
                        id="arrow-solid"
                        viewBox="0 0 10 10"
                        refX="10"
                        refY="5"
                        markerWidth="7"
                        markerHeight="7"
                        orient="auto-start-reverse"
                      >
                        <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill={theme.arrowSolid} />
                      </marker>
                      <marker
                        id="arrow-selected"
                        viewBox="0 0 10 10"
                        refX="10"
                        refY="5"
                        markerWidth="7"
                        markerHeight="7"
                        orient="auto-start-reverse"
                      >
                        <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#38bdf8" />
                      </marker>
                      <marker
                        id="arrow-return"
                        viewBox="0 0 10 10"
                        refX="9.5"
                        refY="5"
                        markerWidth="7"
                        markerHeight="7"
                        orient="auto-start-reverse"
                      >
                        <path
                          d="M 1 1.5 L 9 5 L 1 8.5"
                          fill="none"
                          stroke={theme.arrowReturn}
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </marker>
                      <marker
                        id="arrow-async"
                        viewBox="0 0 10 10"
                        refX="9.5"
                        refY="5"
                        markerWidth="7"
                        markerHeight="7"
                        orient="auto-start-reverse"
                      >
                        <path
                          d="M 1 1.5 L 9 5 L 1 8.5"
                          fill="none"
                          stroke={theme.arrowAsync}
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </marker>
                      {Array.from(customArrowColors.entries()).map(([colorVal, ids]) => (
                        <React.Fragment key={ids.solidId}>
                          <marker
                            id={ids.solidId}
                            viewBox="0 0 10 10"
                            refX="10"
                            refY="5"
                            markerWidth="7"
                            markerHeight="7"
                            orient="auto-start-reverse"
                          >
                            <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill={colorVal} />
                          </marker>
                          <marker
                            id={ids.openId}
                            viewBox="0 0 10 10"
                            refX="9.5"
                            refY="5"
                            markerWidth="7"
                            markerHeight="7"
                            orient="auto-start-reverse"
                          >
                            <path
                              d="M 1 1.5 L 9 5 L 1 8.5"
                              fill="none"
                              stroke={colorVal}
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </marker>
                        </React.Fragment>
                      ))}
                    </defs>

                    <rect x="0" y="0" width={layout.canvasWidth} height={layout.totalHeight} fill={theme.svgBg} />

                    {/* 1. LAYER: MERMAID `RECT` HIGHLIGHT BANDS */}
                    {layout.renderItems
                      .filter((item) => item.type === 'highlight_band')
                      .map((band) => (
                        <g key={band.id}>
                          <rect
                            x={band.leftX}
                            y={band.topY}
                            width={Math.max(140, band.rightX - band.leftX)}
                            height={Math.max(32, band.bottomY - band.topY)}
                            rx="8"
                            fill={band.color || 'rgba(56, 189, 248, 0.08)'}
                            stroke={isDark ? 'rgba(56, 189, 248, 0.25)' : 'rgba(2, 132, 199, 0.2)'}
                            strokeWidth="1"
                          />
                        </g>
                      ))}

                    {/* 2. LAYER: COMBINED FRAGMENT TRANSLUCENT BACKDROPS (BEHIND LIFELINES) */}
                    {layout.renderItems
                      .filter((item) => item.type === 'fragment')
                      .map((frag) => {
                        const width = Math.max(140, frag.rightX - frag.leftX);
                        const height = Math.max(28, frag.bottomY - frag.topY);
                        const fragBackdropFill = frag.color
                          ? applyAlphaToColor(frag.color, 0.08)
                          : theme.fragFill;

                        return (
                          <rect
                            key={`bg_${frag.id}`}
                            x={frag.leftX}
                            y={frag.topY}
                            width={width}
                            height={height}
                            rx="8"
                            fill={fragBackdropFill}
                            stroke="none"
                          />
                        );
                      })}

                    {/* 3. LAYER: VERTICAL DASHED LIFELINES */}
                    {layout.visibleColumns.map((col) => {
                      const x = layout.columnXMap.get(col.id);
                      const isHighlighted = activeColIds?.has(col.id);
                      const lifelineColor = isHighlighted
                        ? '#6366f1'
                        : col.color
                        ? applyAlphaToColor(col.color, isDark ? 0.55 : 0.65)
                        : col.kind === 'group'
                        ? isDark
                          ? '#0e7490'
                          : '#06b6d4'
                        : theme.lifelineStroke;
                      return (
                        <line
                          key={`lifeline_${col.id}`}
                          x1={x}
                          y1={0}
                          x2={x}
                          y2={layout.totalHeight - 12}
                          stroke={lifelineColor}
                          strokeWidth={isHighlighted || col.kind === 'group' ? '2.2' : '1.5'}
                          strokeDasharray="6 5"
                        />
                      );
                    })}

                    {/* 4. LAYER: ACTIVATION BARS */}
                    {layout.activationSpans.map((act, idx) => {
                      const barW = 12;
                      const offsetX = act.depth * 4;
                      const barX = act.x - barW / 2 + offsetX;
                      const barH = Math.max(18, act.endY - act.startY);
                      const callNode = ast.allNodesById.get(act.callId);
                      const canFold = callNode && callNode.kind === 'call' && callNode.hasFoldableChildren;
                      const colColor = layout.columnsMap.get(act.colId)?.color || null;
                      const explicitColor = act.color || colColor;
                      const actFill = explicitColor
                        ? blendWithBg(explicitColor, theme.svgBg, isDark ? 0.28 : 0.2)
                        : theme.activationFill;
                      const actStroke = explicitColor || theme.activationStroke;

                      return (
                        <g
                          key={`act_${act.callId}_${idx}`}
                          onClick={() => canFold && toggleFoldCall(act.callId)}
                          className={canFold ? 'cursor-pointer' : ''}
                        >
                          {canFold && (
                            <title>Click activation bar to collapse {callNode.label || 'call subtree'}</title>
                          )}
                          <rect
                            x={barX}
                            y={act.startY}
                            width={barW}
                            height={barH}
                            rx="3"
                            fill={actFill}
                            stroke={actStroke}
                            strokeWidth="1.5"
                          />
                        </g>
                      );
                    })}

                    {/* 4.5 LAYER: COMBINED FRAGMENT FRAMES, DIVIDERS, PENTAGONS & LABELS (ABOVE LIFELINES & ACTIVATIONS) */}
                    {layout.renderItems
                      .filter((item) => item.type === 'fragment')
                      .map((frag) => {
                        const width = Math.max(140, frag.rightX - frag.leftX);
                        const height = Math.max(28, frag.bottomY - frag.topY);
                        const frameStroke = frag.color || theme.fragStroke;
                        return (
                          <g key={`hdr_${frag.id}`}>
                            <rect
                              x={frag.leftX}
                              y={frag.topY}
                              width={width}
                              height={height}
                              rx="8"
                              fill="none"
                              stroke={frameStroke}
                              strokeWidth="1.4"
                            />
                            {frag.branchHeaders.map((bh) => {
                              const tagText = bh.keyword;
                              const tagW = tagText.length * 8 + 30;
                              const condText = bh.label || (bh.isFirst ? '' : 'default');
                              const maxCondChars = Math.max(12, Math.floor((width - tagW - 22) / 6.2));
                              const displayCond =
                                condText.length > maxCondChars
                                  ? `${condText.slice(0, maxCondChars - 1)}…`
                                  : condText;
                              const branchColor = bh.color || frag.color;
                              const tagFill = branchColor
                                ? blendWithBg(branchColor, theme.svgBg, isDark ? 0.35 : 0.22)
                                : theme.fragTagFill;
                              const tagStroke = branchColor || theme.fragStroke;
                              const tagTextFill = branchColor ? theme.pillText : theme.fragTagText;
                              const hitW = Math.min(
                                width,
                                tagW + 18 + (displayCond ? displayCond.length * 6.4 : 0)
                              );

                              return (
                                <g key={bh.branchId}>
                                  {!bh.isFirst && (
                                    <line
                                      x1={frag.leftX}
                                      y1={bh.y}
                                      x2={frag.rightX}
                                      y2={bh.y}
                                      stroke={tagStroke}
                                      strokeWidth="1.2"
                                      strokeDasharray="5 4"
                                    />
                                  )}
                                  <g
                                    onClick={() => toggleFoldBranch(bh.branchId)}
                                    className="cursor-pointer"
                                  >
                                    <title>
                                      {bh.isFolded
                                        ? `Expand [${tagText}] ${condText} (${bh.stepCount} ${
                                            bh.stepCount === 1 ? 'item' : 'items'
                                          } hidden)`
                                        : `Collapse [${tagText}] ${condText}`}
                                    </title>
                                    <rect
                                      x={frag.leftX}
                                      y={bh.y}
                                      width={hitW}
                                      height="22"
                                      fill="transparent"
                                    />
                                    <path
                                      d={`M ${frag.leftX} ${bh.y} H ${frag.leftX + tagW} L ${
                                        frag.leftX + tagW + 8
                                      } ${bh.y + 11} L ${frag.leftX + tagW} ${bh.y + 22} H ${frag.leftX} Z`}
                                      fill={tagFill}
                                      fillOpacity={bh.isFolded ? 0.72 : 1}
                                      stroke={tagStroke}
                                      strokeWidth="1"
                                    />
                                    <text
                                      x={frag.leftX + 8}
                                      y={bh.y + 15}
                                      fill={tagTextFill}
                                      fontSize="11"
                                      fontFamily="monospace"
                                      fontWeight="700"
                                    >
                                      {bh.isFolded ? '▸' : '▾'}
                                    </text>
                                    <text
                                      x={frag.leftX + 20}
                                      y={bh.y + 15}
                                      fill={tagTextFill}
                                      fontSize="10"
                                      fontFamily="monospace"
                                      fontWeight="700"
                                    >
                                      {tagText}
                                    </text>

                                    {displayCond && (
                                      <text
                                        x={frag.leftX + tagW + 14}
                                        y={bh.y + 15}
                                        fill={tagTextFill}
                                        fillOpacity={bh.isFolded ? 0.52 : 1}
                                        fontSize="10.5"
                                        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                                        fontWeight={bh.isFolded ? '500' : '600'}
                                      >
                                        {displayCond}
                                      </text>
                                    )}
                                  </g>
                                </g>
                              );
                            })}
                          </g>
                        );
                      })}

                    {/* 5. LAYER: MESSAGES, NOTES, DIVIDERS, FOLDED CALLS, GROUP & HIDDEN BADGES */}
                    {(() => {
                      const getColumnEdgeX = (colId, centerX, y, side) => {
                        const matching = layout.activationSpans.filter(
                          (act) => act.colId === colId && y >= act.startY - 1 && y <= act.endY + 1
                        );
                        if (matching.length === 0) return centerX;
                        if (side === 'right') {
                          return Math.max(...matching.map((act) => act.x - 6 + act.depth * 4 + 12));
                        }
                        return Math.min(...matching.map((act) => act.x - 6 + act.depth * 4));
                      };
                      return layout.renderItems.map((item) => {
                      // 5a. Divider (== Section ==) — clickable to collapse/expand its region
                      if (item.type === 'divider') {
                        const displayLabel = `${item.isCollapsed ? '▸' : '▾'} ${item.label}`;
                        const badgeW = Math.min(380, Math.max(136, displayLabel.length * 7.5 + 36));
                        const lineOpacity = item.isCollapsed ? 0.65 : 1;
                        return (
                          <g
                            key={item.id}
                            onClick={() => toggleFoldDivider(item.id)}
                            onMouseEnter={() =>
                              setHoveredItem({
                                tooltip: item.isCollapsed
                                  ? `Expand "${item.label}" (${item.stepCount} hidden)`
                                  : `Collapse "${item.label}" region (${item.stepCount} items)`,
                              })
                            }
                            onMouseLeave={() => setHoveredItem(null)}
                            className="cursor-pointer"
                          >
                            <line
                              x1={32}
                              y1={item.y - 2}
                              x2={layout.canvasWidth - 32}
                              y2={item.y - 2}
                              stroke={theme.lifelineStroke}
                              strokeWidth="1"
                              strokeOpacity={lineOpacity}
                              strokeDasharray={item.isCollapsed ? '5 4' : undefined}
                            />
                            <line
                              x1={32}
                              y1={item.y + 2}
                              x2={layout.canvasWidth - 32}
                              y2={item.y + 2}
                              stroke={theme.lifelineStroke}
                              strokeWidth="1"
                              strokeOpacity={lineOpacity}
                              strokeDasharray={item.isCollapsed ? '5 4' : undefined}
                            />
                            <rect
                              x={layout.canvasWidth / 2 - badgeW / 2}
                              y={item.y - 12}
                              width={badgeW}
                              height="24"
                              rx="12"
                              fill={isDark ? '#18181b' : '#ffffff'}
                              stroke={theme.pillBorder}
                              strokeWidth="1.2"
                              strokeDasharray={item.isCollapsed ? '4 3' : undefined}
                              strokeOpacity={item.isCollapsed ? 0.85 : 1}
                            />
                            <text
                              x={layout.canvasWidth / 2}
                              y={item.y + 4}
                              textAnchor="middle"
                              fill={theme.pillText}
                              fillOpacity={item.isCollapsed ? 0.65 : 1}
                              fontSize="11"
                              fontWeight={item.isCollapsed ? '500' : '600'}
                              fontFamily="Inter, system-ui, sans-serif"
                            >
                              {displayLabel}
                            </text>
                          </g>
                        );
                      }

                      // 5b. Note
                      if (item.type === 'note') {
                        const maxLineLen = Math.max(12, ...item.lines.map((l) => l.length));
                        const noteW = Math.min(265, Math.max(125, maxLineLen * 6.4 + 24));
                        const noteH = 22 + item.lines.length * 15;
                        let noteX = item.minX - noteW / 2;
                        if (item.placement === 'right of') noteX = item.maxX + 16;
                        else if (item.placement === 'left of') noteX = item.minX - noteW - 16;
                        else noteX = (item.minX + item.maxX) / 2 - noteW / 2;
                        noteX = Math.max(16, Math.min(layout.canvasWidth - noteW - 16, noteX));
                        const noteFill = item.color
                          ? blendWithBg(item.color, theme.svgBg, isDark ? 0.25 : 0.2)
                          : isDark
                          ? '#272012'
                          : '#fef9c3';
                        const noteStroke = item.color || (isDark ? '#b45309' : '#eab308');
                        const noteTextFill = item.color
                          ? theme.pillText
                          : isDark
                          ? '#fde68a'
                          : '#713f12';

                        return (
                          <g key={item.id}>
                            <rect
                              x={noteX}
                              y={item.y}
                              width={noteW}
                              height={noteH}
                              rx="5"
                              fill={noteFill}
                              stroke={noteStroke}
                              strokeWidth="1.2"
                            />
                            {item.lines.map((lineText, lIdx) => (
                              <text
                                key={lIdx}
                                x={noteX + 10}
                                y={item.y + 16 + lIdx * 15}
                                fill={noteTextFill}
                                fontSize="10.5"
                                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                              >
                                {lineText.length > 40 ? `${lineText.slice(0, 39)}…` : lineText}
                              </text>
                            ))}
                          </g>
                        );
                      }

                      // 5c. Collapsed Group Internal Interaction Badge
                      if (item.type === 'group_internal_cluster') {
                        const label =
                          item.count === 1
                            ? `⚙ ${item.messages[0].label || 'internal call'}`
                            : `⚙ ${item.count} internal interactions`;
                        const clipped = label.length > 32 ? `${label.slice(0, 31)}…` : label;
                        const pillW = Math.min(220, Math.max(120, clipped.length * 6.4 + 24));
                        const badgeFill = item.groupColor
                          ? blendWithBg(item.groupColor, theme.svgBg, isDark ? 0.24 : 0.14)
                          : isDark
                          ? '#083344'
                          : '#ecfeff';
                        const badgeStroke = item.groupColor || (isDark ? '#06b6d4' : '#0891b2');
                        const badgeText = item.groupColor
                          ? theme.pillText
                          : isDark
                          ? '#67e8f9'
                          : '#155e75';

                        return (
                          <g
                            key={item.id}
                            onClick={() => handleSelectMessage(item.messages[0])}
                            onMouseEnter={() =>
                              setHoveredItem({
                                tooltip: `${item.groupLabel}: ${item.count} internal interaction(s) rolled up (Click to inspect)`,
                              })
                            }
                            onMouseLeave={() => setHoveredItem(null)}
                            className="cursor-pointer"
                          >
                            <rect
                              x={item.x - pillW / 2}
                              y={item.y - 12}
                              width={pillW}
                              height="24"
                              rx="12"
                              fill={badgeFill}
                              stroke={badgeStroke}
                              strokeDasharray="3 2"
                              strokeWidth="1.2"
                            />
                            <text
                              x={item.x}
                              y={item.y + 4}
                              textAnchor="middle"
                              fill={badgeText}
                              fontSize="10.5"
                              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                              fontWeight="600"
                            >
                              {clipped}
                            </text>
                          </g>
                        );
                      }

                      // 5d. Coalesced Hidden-to-Hidden Badge
                      if (item.type === 'coalesced_hidden') {
                        const badgeText = `⬡ ${item.count} hidden ${
                          item.count === 1 ? 'interaction' : 'interactions'
                        } (${item.pairSummary})`;
                        const badgeW = Math.min(layout.canvasWidth - 64, badgeText.length * 6.4 + 34);

                        return (
                          <g
                            key={item.id}
                            onClick={() => restoreLifelines(item.columnIds)}
                            onMouseEnter={() =>
                              setHoveredItem({
                                tooltip: `Click to restore hidden lifelines: ${item.pairSummary}`,
                              })
                            }
                            onMouseLeave={() => setHoveredItem(null)}
                            className="cursor-pointer"
                          >
                            <rect
                              x={layout.canvasWidth / 2 - badgeW / 2}
                              y={item.y - 13}
                              width={badgeW}
                              height="26"
                              rx="13"
                              fill={isDark ? '#18181b' : '#f8fafc'}
                              stroke={isDark ? '#52525b' : '#cbd5e1'}
                              strokeDasharray="4 3"
                              strokeWidth="1"
                            />
                            <text
                              x={layout.canvasWidth / 2}
                              y={item.y + 4}
                              textAnchor="middle"
                              fill={isDark ? '#a1a1aa' : '#64748b'}
                              fontSize="11"
                              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                              fontWeight="600"
                            >
                              {badgeText}
                            </text>
                          </g>
                        );
                      }

                      // 5e. Hidden Lifeline Directional Stub Pill
                      if (item.type === 'hidden_stub') {
                        const dirSymbol = item.direction === 'outgoing' ? '→' : '←';
                        const rawText = `${dirSymbol} [${item.hiddenLabel}] ${item.node.label || 'msg'}`;
                        const displayText = rawText.length > 34 ? `${rawText.slice(0, 33)}…` : rawText;
                        const pillW = Math.min(230, Math.max(110, displayText.length * 6.3 + 22));
                        const stubLineLen = 14;

                        const isRight = item.side === 'right';
                        const lineX1 = getColumnEdgeX(
                          item.visibleColId,
                          item.visibleX,
                          item.y,
                          isRight ? 'right' : 'left'
                        );
                        const lineX2 = isRight ? lineX1 + stubLineLen : lineX1 - stubLineLen;
                        const pillX = isRight ? lineX2 : lineX2 - pillW;

                        return (
                          <g
                            key={item.id}
                            onClick={() => toggleHideLifeline(item.hiddenColId)}
                            onMouseEnter={() =>
                              setHoveredItem({
                                visibleColId: item.visibleColId,
                                tooltip: `${item.node.from} → ${item.node.to}: ${item.node.label} (Click to restore ${item.hiddenLabel})`,
                              })
                            }
                            onMouseLeave={() => setHoveredItem(null)}
                            className="cursor-pointer"
                          >
                            <line
                              x1={lineX1}
                              y1={item.y}
                              x2={lineX2}
                              y2={item.y}
                              stroke={item.node.arrowColor || (isDark ? '#71717a' : '#94a3b8')}
                              strokeWidth="1.3"
                              strokeDasharray={item.node.isDashed ? '3 2' : undefined}
                            />
                            <rect
                              x={pillX}
                              y={item.y - 12}
                              width={pillW}
                              height="24"
                              rx="12"
                              fill={isDark ? '#18181b' : '#f1f5f9'}
                              stroke={isDark ? '#3f3f46' : '#cbd5e1'}
                              strokeDasharray="3 2"
                              strokeWidth="1"
                            />
                            <text
                              x={pillX + pillW / 2}
                              y={item.y + 4}
                              textAnchor="middle"
                              fill={isDark ? '#a1a1aa' : '#475569'}
                              fontSize="10.5"
                              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                              fontWeight="500"
                            >
                              {displayText}
                            </text>
                          </g>
                        );
                      }

                      // 5f. Folded Call Subtree Summary Bar
                      if (item.type === 'folded_call') {
                        const leftX = Math.min(item.fromX, item.toX);
                        const rightX = Math.max(item.fromX, item.toX);
                        const spanW = Math.max(165, rightX - leftX);
                        const barX = (leftX + rightX) / 2 - spanW / 2;

                        const hiddenSteps = item.node.descendantStepCount;
                        const hiddenFrags = item.node.descendantFragmentCount;
                        const metaParts = [];
                        if (hiddenSteps > 0) metaParts.push(`+${hiddenSteps} steps`);
                        if (hiddenFrags > 0) metaParts.push(`${hiddenFrags} block`);
                        const metaBadge = metaParts.length > 0 ? ` [${metaParts.join(', ')}]` : '';
                        const returnSuffix = item.node.returnLabel ? `  ↩ ${item.node.returnLabel}` : '';

                        const fullLabel = `▸ ${item.node.label || 'call()'}${metaBadge}${returnSuffix}`;
                        const maxChars = Math.max(18, Math.floor((spanW - 18) / 6.3));
                        const clipped =
                          fullLabel.length > maxChars ? `${fullLabel.slice(0, maxChars - 1)}…` : fullLabel;

                        return (
                          <g
                            key={item.id}
                            onClick={() => toggleFoldCall(item.id)}
                            onMouseEnter={() =>
                              setHoveredItem({
                                tooltip: `Collapsed Call Subtree: ${item.node.label}${metaBadge}${returnSuffix} (Click to expand)`,
                              })
                            }
                            onMouseLeave={() => setHoveredItem(null)}
                            className="cursor-pointer"
                          >
                            <rect
                              x={barX}
                              y={item.y - 14}
                              width={spanW}
                              height="28"
                              rx="8"
                              fill={isDark ? '#1e1b4b' : '#e0e7ff'}
                              stroke="#6366f1"
                              strokeWidth="1.6"
                            />
                            <text
                              x={barX + spanW / 2}
                              y={item.y + 4}
                              textAnchor="middle"
                              fill={isDark ? '#c7d2fe' : '#312e81'}
                              fontSize="11"
                              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                              fontWeight="700"
                            >
                              {clipped}
                            </text>
                          </g>
                        );
                      }

                      // 5g. Self Message
                      if (item.type === 'self_message') {
                        const { node, x, y, colId } = item;
                        const isSelected = selectedMessageLine === node.lineNum;
                        const loopW = 42;
                        const loopH = 22;
                        const edgeX = getColumnEdgeX(colId, x, y, 'right');
                        const labelText = node.label || 'self()';
                        const clipped = labelText.length > 26 ? `${labelText.slice(0, 25)}…` : labelText;
                        const customMarkers = node.arrowColor
                          ? customArrowColors.get(node.arrowColor)
                          : null;
                        const selfStroke = isSelected
                          ? '#38bdf8'
                          : node.arrowColor || theme.arrowSolid;
                        const selfMarker = isSelected
                          ? 'url(#arrow-selected)'
                          : customMarkers
                          ? `url(#${node.isHalfAsync ? customMarkers.openId : customMarkers.solidId})`
                          : 'url(#arrow-solid)';

                        return (
                          <g
                            key={item.id}
                            onClick={() => handleSelectMessage(node)}
                            onMouseEnter={() =>
                              setHoveredItem({
                                tooltip: `Step #${node.stepIndex} · ${node.from} → ${node.to}: ${labelText} (Click to inspect)`,
                              })
                            }
                            onMouseLeave={() => setHoveredItem(null)}
                            className="cursor-pointer"
                          >
                            <path
                              d={`M ${edgeX} ${y - 8} H ${edgeX + loopW} V ${y + loopH - 8} H ${edgeX + 2}`}
                              fill="none"
                              stroke={selfStroke}
                              strokeWidth={isSelected ? '2.2' : '1.6'}
                              strokeDasharray={node.isDashed ? '5 4' : undefined}
                              markerEnd={selfMarker}
                            />
                            <text
                              x={edgeX + loopW + 8}
                              y={y + 6}
                              fill={isSelected ? '#38bdf8' : theme.pillText}
                              fontSize="11"
                              fontWeight={isSelected ? '700' : '500'}
                              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                            >
                              {clipped}
                            </text>
                          </g>
                        );
                      }

                      // 5h. Standard Visible-to-Visible Message Arrow + Pill + Metadata Badges
                      if (item.type === 'message') {
                        const { node, fromX, toX, y, fromColId, toColId } = item;
                        const isRightward = toX >= fromX;
                        const x1 = getColumnEdgeX(fromColId, fromX, y, isRightward ? 'right' : 'left');
                        const x2 = getColumnEdgeX(toColId, toX, y, isRightward ? 'left' : 'right');
                        const isReturn = node.kind === 'return';
                        const isAsync = node.kind === 'async';
                        const canFold = node.kind === 'call' && node.hasFoldableChildren;
                        const isSelected = selectedMessageLine === node.lineNum;

                        const hasContract = Boolean(node.metadata?.contract);
                        const openQCount =
                          node.metadata?.questions?.filter((q) => q.status === 'open').length || 0;
                        const decisionCount = node.metadata?.decisions?.length || 0;
                        const hasMetaBadge = hasContract || openQCount > 0 || decisionCount > 0;

                        const customMarkers = node.arrowColor
                          ? customArrowColors.get(node.arrowColor)
                          : null;
                        const strokeColor = isSelected
                          ? '#38bdf8'
                          : node.arrowColor
                          ? node.arrowColor
                          : isReturn
                          ? theme.arrowReturn
                          : isAsync
                          ? theme.arrowAsync
                          : theme.arrowSolid;
                        const markerId = isSelected
                          ? 'url(#arrow-selected)'
                          : customMarkers
                          ? `url(#${isReturn || isAsync ? customMarkers.openId : customMarkers.solidId})`
                          : isReturn
                          ? 'url(#arrow-return)'
                          : isAsync
                          ? 'url(#arrow-async)'
                          : 'url(#arrow-solid)';

                        const midX = (x1 + x2) / 2;
                        const spanDist = Math.abs(x2 - x1);
                        const numPrefix = node.autoNumber !== null ? `${node.autoNumber}. ` : '';
                        const foldPrefix = canFold ? '▾ ' : '';
                        const rawLabel = `${foldPrefix}${numPrefix}${
                          node.label || (isReturn ? 'return' : '')
                        }`;
                        const maxChars = Math.max(15, Math.floor((spanDist - 12) / 6.3));
                        const displayLabel =
                          rawLabel.length > maxChars
                            ? `${rawLabel.slice(0, maxChars - 1)}…`
                            : rawLabel;

                        const pillW = Math.min(
                          Math.max(40, spanDist - 8),
                          Math.max(40, displayLabel.length * 6.4 + 12)
                        );

                        return (
                          <g
                            key={item.id}
                            onClick={() => handleSelectMessage(node)}
                            onMouseEnter={() =>
                              setHoveredItem({
                                tooltip: `Step #${node.stepIndex} (L${node.lineNum}) · ${node.from} → ${node.to}: ${
                                  node.label || '(return)'
                                } — Click to inspect`,
                              })
                            }
                            onMouseLeave={() => setHoveredItem(null)}
                            className="cursor-pointer"
                          >
                            {/* Invisible Wide Hit Target for Effortless Arrow Clicking */}
                            <line
                              x1={x1}
                              y1={y}
                              x2={x2}
                              y2={y}
                              stroke="transparent"
                              strokeWidth="16"
                            />

                            {/* Visible Horizontal Message Arrow */}
                            <line
                              x1={x1}
                              y1={y}
                              x2={x2}
                              y2={y}
                              stroke={strokeColor}
                              strokeWidth={isSelected ? '2.4' : isReturn ? '1.4' : '1.7'}
                              strokeDasharray={node.isDashed || isReturn ? '5 4' : undefined}
                              markerStart={node.isBidirectional ? markerId : undefined}
                              markerEnd={markerId}
                            />

                            {/* Borderless Message Label Above Arrow (masks lifelines cleanly) */}
                            {displayLabel && (
                              <g>
                                <rect
                                  x={midX - pillW / 2}
                                  y={y - 22}
                                  width={pillW}
                                  height="19"
                                  rx="4"
                                  fill={
                                    isSelected
                                      ? isDark
                                        ? 'rgba(56, 189, 248, 0.16)'
                                        : 'rgba(14, 165, 233, 0.12)'
                                      : theme.svgBg
                                  }
                                  stroke="none"
                                />

                                {/* Clicking the left fold chevron folds the call subtree directly */}
                                {canFold && (
                                  <rect
                                    x={midX - pillW / 2}
                                    y={y - 22}
                                    width="20"
                                    height="19"
                                    rx="4"
                                    fill="transparent"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleFoldCall(node.id);
                                    }}
                                  >
                                    <title>Fold call subtree</title>
                                  </rect>
                                )}

                                <text
                                  x={midX}
                                  y={y - 9}
                                  textAnchor="middle"
                                  fill={
                                    isSelected
                                      ? isDark
                                        ? '#7dd3fc'
                                        : '#0369a1'
                                      : canFold
                                      ? isDark
                                        ? '#c7d2fe'
                                        : '#312e81'
                                      : isReturn
                                      ? theme.arrowReturn
                                      : theme.pillText
                                  }
                                  fontSize="10.8"
                                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                                  fontWeight={isSelected || canFold ? '600' : '500'}
                                >
                                  {displayLabel}
                                </text>
                              </g>
                            )}

                            {/* Compact Review Metadata Indicators Below Arrow (@contract / @question / @decision) */}
                            {hasMetaBadge && (
                              <g transform={`translate(${midX}, ${y + 11})`}>
                                <rect
                                  x="-34"
                                  y="-7"
                                  width="68"
                                  height="14"
                                  rx="7"
                                  fill={isDark ? '#18181b' : '#ffffff'}
                                  stroke={isDark ? '#3f3f46' : '#cbd5e1'}
                                  strokeWidth="0.9"
                                />
                                <text
                                  x="0"
                                  y="3"
                                  textAnchor="middle"
                                  fontSize="8.8"
                                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                                  fontWeight="700"
                                  fill={
                                    openQCount > 0
                                      ? '#f59e0b'
                                      : decisionCount > 0
                                      ? '#10b981'
                                      : '#38bdf8'
                                  }
                                >
                                  {[
                                    hasContract ? 'API' : null,
                                    openQCount > 0 ? `?${openQCount}` : null,
                                    decisionCount > 0 ? `✓${decisionCount}` : null,
                                  ]
                                    .filter(Boolean)
                                    .join(' · ')}
                                </text>
                              </g>
                            )}
                          </g>
                        );
                      }

                      return null;
                    });
                    })()}
                  </svg>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Interactive Legend & Hint Footer */}
          <footer
            className={`flex flex-wrap items-center justify-between gap-2 px-4 py-1.5 border-t text-[11px] shrink-0 ${
              isDark
                ? 'bg-zinc-900/90 border-zinc-800 text-zinc-400'
                : 'bg-white border-slate-200 text-slate-600'
            }`}
          >
            <div className="flex flex-wrap items-center gap-3">
              <span>
                <strong className="text-sky-400">Click arrow</strong> to inspect contract &amp; add notes
              </span>
              <span className="hidden sm:inline opacity-40">•</span>
              <span>
                <strong className="text-indigo-400">▾ / Activation bar</strong> folds call subtree
              </span>
              <span className="hidden md:inline opacity-40">•</span>
              <span className="hidden md:inline">
                <strong className="text-indigo-400">[ALT/ELSE]</strong> folds branch
              </span>
              <span className="hidden lg:inline opacity-40">•</span>
              <span className="hidden lg:inline">
                <GripVertical className="w-3 h-3 inline" /> Drag columns to reorder
              </span>
              <span className="hidden xl:inline opacity-40">•</span>
              <span className="hidden xl:inline">
                <strong className="text-indigo-400">== Section ==</strong> collapses region
              </span>
            </div>
            <div className="font-mono text-[10px] opacity-75">
              Unified AST ({activeDialect})
            </div>
          </footer>
        </main>

        {/* ------------------------------------------------------------------ */}
        {/* RIGHT PANE: COLLAPSIBLE ARROW & METADATA INSPECTOR DRAWER          */}
        {/* ------------------------------------------------------------------ */}
        {isInspectorOpen && (
          <aside
            className={`w-full sm:w-[340px] lg:w-[380px] shrink-0 flex flex-col border-l z-20 select-text ${theme.bgPanel}`}
          >
            {/* Inspector Header */}
            <div className={`flex items-center justify-between px-3.5 py-2.5 border-b ${theme.border}`}>
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-sky-400" />
                <span className="text-xs font-bold tracking-tight">Arrow &amp; Review Inspector</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleExportNotesMarkdown}
                  title="Download all @contract, @question, and @decision notes as Markdown"
                  className={`flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md border transition cursor-pointer ${theme.btnGhost}`}
                >
                  <Download className="w-3 h-3" />
                  <span>Export Notes .md</span>
                </button>
                <button
                  onClick={() => setIsInspectorOpen(false)}
                  className="p-1 rounded hover:bg-zinc-800/60 opacity-70 hover:opacity-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {!selectedMessage ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-11 h-11 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center mb-3">
                  <MessageSquarePlus className="w-5 h-5 text-sky-400" />
                </div>
                <p className="text-xs font-semibold mb-1">No Interaction Selected</p>
                <p className={`text-[11px] leading-relaxed ${theme.textMuted}`}>
                  Click any message arrow on the diagram canvas to inspect its API contract, log open
                  architecture questions, or record design decisions directly into the{' '}
                  <code className="font-mono">{activeDialect === 'mermaid' ? '.mmd' : '.puml'}</code>{' '}
                  file.
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-3.5 space-y-4 text-xs">
                {/* 1. Interaction Summary Card */}
                <div
                  className={`p-3 rounded-xl border space-y-2 ${
                    isDark ? 'bg-zinc-950/80 border-zinc-800' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-sky-500/15 text-sky-400 border border-sky-500/30 font-semibold">
                      Step #{selectedMessage.stepIndex} · Line {selectedMessage.lineNum}
                    </span>
                    <span className={`text-[10px] font-mono uppercase ${theme.textMuted}`}>
                      {selectedMessage.kind}
                    </span>
                  </div>

                  <div className="font-semibold text-xs flex items-center gap-1.5 flex-wrap">
                    <span className="text-indigo-400">
                      {ast.participantsMap.get(selectedMessage.from)?.label || selectedMessage.from}
                    </span>
                    <span className={theme.textMuted}>→</span>
                    <span className="text-emerald-400">
                      {ast.participantsMap.get(selectedMessage.to)?.label || selectedMessage.to}
                    </span>
                  </div>

                  <div
                    className={`font-mono text-[11px] p-2 rounded-lg border break-all ${
                      isDark
                        ? 'bg-zinc-900 border-zinc-800 text-zinc-200'
                        : 'bg-white border-slate-200 text-slate-800'
                    }`}
                  >
                    {selectedMessage.label || '(return)'}
                  </div>

                  {selectedMessage.kind === 'call' && selectedMessage.hasFoldableChildren && (
                    <button
                      onClick={() => toggleFoldCall(selectedMessage.id)}
                      className={`w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border text-[11px] font-medium transition cursor-pointer ${theme.btnGhost}`}
                    >
                      <Layers className="w-3.5 h-3.5 text-indigo-400" />
                      {foldedCallIds.has(selectedMessage.id)
                        ? `Expand Call Subtree (+${selectedMessage.descendantStepCount} steps)`
                        : `Fold Call Subtree (${selectedMessage.descendantStepCount} downstream steps)`}
                    </button>
                  )}
                </div>

                {/* 2. API Contract Metadata (`@contract`) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                      <FileCode className="w-3.5 h-3.5" />
                      API / Event Contract
                    </span>
                    {!isEditingContract && (
                      <button
                        onClick={() => setIsEditingContract(true)}
                        className="text-[11px] text-sky-400 hover:underline cursor-pointer"
                      >
                        {selectedMessage.metadata.contract ? 'Edit' : '+ Add @contract'}
                      </button>
                    )}
                  </div>

                  {isEditingContract ? (
                    <form onSubmit={handleSaveContract} className="space-y-1.5">
                      <input
                        type="text"
                        value={contractDraft}
                        onChange={(e) => setContractDraft(e.target.value)}
                        placeholder="e.g. POST /v1/payments | Timeout: 800ms"
                        className={`w-full px-2.5 py-1.5 rounded-lg border font-mono text-[11px] outline-none ${
                          isDark
                            ? 'bg-zinc-950 border-zinc-700 text-zinc-100 focus:border-sky-500'
                            : 'bg-white border-slate-300 text-slate-900 focus:border-sky-500'
                        }`}
                      />
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setIsEditingContract(false)}
                          className={`px-2 py-1 rounded text-[11px] border cursor-pointer ${theme.btnGhost}`}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-medium cursor-pointer"
                        >
                          Save to Source
                        </button>
                      </div>
                    </form>
                  ) : selectedMessage.metadata.contract ? (
                    <div
                      className={`p-2.5 rounded-lg border font-mono text-[11px] leading-relaxed ${
                        isDark
                          ? 'bg-sky-950/20 border-sky-500/30 text-sky-200'
                          : 'bg-sky-50 border-sky-200 text-sky-900'
                      }`}
                    >
                      {selectedMessage.metadata.contract}
                    </div>
                  ) : (
                    <p className={`text-[11px] italic ${theme.textSubtle}`}>
                      No @contract directive attached to this step.
                    </p>
                  )}
                </div>

                {/* 3. Architecture Questions (`@question[open|resolved]`) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                      <HelpCircle className="w-3.5 h-3.5" />
                      Questions ({selectedMessage.metadata.questions.length})
                    </span>
                  </div>

                  {selectedMessage.metadata.questions.length > 0 && (
                    <div className="space-y-1.5">
                      {selectedMessage.metadata.questions.map((q) => (
                        <div
                          key={q.id}
                          className={`p-2.5 rounded-lg border text-[11px] flex items-start justify-between gap-2 ${
                            q.status === 'resolved'
                              ? isDark
                                ? 'bg-zinc-950/50 border-zinc-800 text-zinc-400'
                                : 'bg-slate-50 border-slate-200 text-slate-500'
                              : isDark
                              ? 'bg-amber-950/20 border-amber-500/30 text-amber-100'
                              : 'bg-amber-50 border-amber-200 text-amber-950'
                          }`}
                        >
                          <span className="leading-snug">{q.text}</span>
                          <button
                            onClick={() => handleToggleQuestionStatus(q)}
                            title="Toggle open / resolved status in source"
                            className={`shrink-0 px-1.5 py-0.5 rounded font-mono text-[9.5px] uppercase border cursor-pointer ${
                              q.status === 'resolved'
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            }`}
                          >
                            {q.status}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <form onSubmit={handleAddQuestion} className="flex gap-1.5">
                    <input
                      type="text"
                      value={newQuestionText}
                      onChange={(e) => setNewQuestionText(e.target.value)}
                      placeholder={`Add ${commentPrefix} @question[open]: ...`}
                      className={`flex-1 px-2.5 py-1.5 rounded-lg border text-[11px] outline-none ${
                        isDark
                          ? 'bg-zinc-950 border-zinc-700 text-zinc-100 focus:border-amber-500'
                          : 'bg-white border-slate-300 text-slate-900 focus:border-amber-500'
                      }`}
                    />
                    <button
                      type="submit"
                      disabled={!newQuestionText.trim()}
                      title="Insert @question comment above arrow"
                      className="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white font-medium text-[11px] flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Ask
                    </button>
                  </form>
                </div>

                {/* 4. Recorded Decisions (`@decision`) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <Scale className="w-3.5 h-3.5" />
                      Decisions ({selectedMessage.metadata.decisions.length})
                    </span>
                  </div>

                  {selectedMessage.metadata.decisions.length > 0 && (
                    <div className="space-y-1.5">
                      {selectedMessage.metadata.decisions.map((d) => (
                        <div
                          key={d.id}
                          className={`p-2.5 rounded-lg border text-[11px] flex items-start gap-2 ${
                            isDark
                              ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-100'
                              : 'bg-emerald-50 border-emerald-200 text-emerald-950'
                          }`}
                        >
                          <CheckSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span className="leading-snug">{d.text}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <form onSubmit={handleAddDecision} className="flex gap-1.5">
                    <input
                      type="text"
                      value={newDecisionText}
                      onChange={(e) => setNewDecisionText(e.target.value)}
                      placeholder={`Add ${commentPrefix} @decision: ...`}
                      className={`flex-1 px-2.5 py-1.5 rounded-lg border text-[11px] outline-none ${
                        isDark
                          ? 'bg-zinc-950 border-zinc-700 text-zinc-100 focus:border-emerald-500'
                          : 'bg-white border-slate-300 text-slate-900 focus:border-emerald-500'
                      }`}
                    />
                    <button
                      type="submit"
                      disabled={!newDecisionText.trim()}
                      title="Insert @decision comment above arrow"
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-medium text-[11px] flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Log
                    </button>
                  </form>
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* ==================================================================== */}
      {/* FLOATING INTERACTIVE TOOLTIP & NON-BLOCKING STATUS TOAST             */}
      {/* ==================================================================== */}
      {hoveredItem?.tooltip && (
        <div
          style={{
            left: Math.min(window.innerWidth - 330, tooltipPos.x),
            top: Math.min(window.innerHeight - 64, tooltipPos.y),
          }}
          className={`fixed z-50 max-w-xs px-2.5 py-1.5 rounded-lg border shadow-lg text-[11px] font-mono pointer-events-none ${
            isDark
              ? 'bg-zinc-900/95 border-zinc-700 text-zinc-100'
              : 'bg-slate-900/95 border-slate-700 text-white'
          }`}
        >
          {hoveredItem.tooltip}
        </div>
      )}

      {toastMessage && (
        <div className="fixed bottom-10 right-5 z-50 flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-medium shadow-xl border border-indigo-400/40">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );

  // Add inside your App component in src/App.jsx
  useEffect(() => {
    // 1. Handle OS double-click / "Open With" via PWA File Handling API
    if ('launchQueue' in window) {
      window.launchQueue.setConsumer(async (launchParams) => {
        if (!launchParams.files?.length) return;
        const fileHandle = launchParams.files[0];
        const file = await fileHandle.getFile();
        const text = await file.text();
        setCode(text);
      });
    }

    // 2. Handle global paste (when not typing in the editor or an input)
    const handlePaste = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT') return;
      const text = e.clipboardData?.getData('text');
      if (text && (text.includes('@startuml') || text.includes('sequenceDiagram') || text.includes('->'))) {
        setCode(text);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);
}