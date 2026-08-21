import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, ArrowLeft, ArrowUpDown, BarChart3, Bell, Bot, CheckCircle2, ClipboardList, Clock3, Copy, Download, ExternalLink, FileSpreadsheet, FileText, Headphones, ImageIcon, Link2, MessageCircle, Paperclip, RefreshCw, Search, Send, Settings, ShieldCheck, StickyNote, Timer, Trash2, UserCheck, UserRoundCheck, Users, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { Enums } from "@/integrations/supabase/types";
import { getCategoryForService, type WizardEntityType, type WizardService } from "@/lib/requestWizard";
import { formatServiceRequestLabel, serviceNeededOptions } from "@/lib/serviceRequests";
import {
  buildWhatsAppMissingInfoReply,
  formatWhatsAppMissingFieldLabel,
  getWhatsAppLeadGate,
  getWhatsAppLeadQuality,
  getWhatsAppLeadQualityBadgeClass,
  getWhatsAppLeadQualityCardClass,
} from "@/lib/whatsappLeadQuality";
import { useSearchParams } from "react-router-dom";

type Conversation = {
  id: string;
  wa_id: string;
  display_name: string | null;
  linked_client_id: string | null;
  linked_client_profile_id: string | null;
  linked_client_at: string | null;
  linked_client_by: string | null;
  status: string;
  inbox_status: "new" | "unassigned" | "assigned" | "waiting_client" | "resolved";
  priority_level: "normal" | "high" | "urgent";
  ai_enabled: boolean;
  human_handoff_requested_at: string | null;
  service_request_id: string | null;
  ai_summary: string | null;
  submission_state: string;
  intake_payload: Record<string, unknown> | null;
  intake_missing_fields: string[];
  intake_ready: boolean;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  assigned_staff_id: string | null;
  assigned_staff_name: string | null;
  assigned_at: string | null;
  last_staff_reply_at: string | null;
  first_staff_reply_at: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  unread_count: number;
  created_at: string;
  updated_at: string;
};

type Message = {
  id: string;
  conversation_id: string;
  direction: "inbound" | "outbound";
  sender_type: string;
  message_type: string;
  content: string | null;
  delivery_status: string | null;
  media_mime_type: string | null;
  media_filename: string | null;
  media_size_bytes: number | null;
  media_storage_path: string | null;
  attachment_url: string | null;
  staff_sender_id: string | null;
  staff_sender_name: string | null;
  created_at: string;
};

type StaffProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
};

type FeedPayload = {
  evaluations: Evaluation[];
  staff: StaffProfile[];
  currentStaff: StaffProfile | null;
  alerts: WhatsAppAlert[];
  notes: WhatsAppNote[];
  staffActions: WhatsAppStaffAction[];
  clientMatches: ClientMatch[];
  relatedServiceRequests: RelatedServiceRequest[];
  inboxReady: boolean;
};

type WhatsAppAlert = {
  id: string;
  conversation_id: string;
  alert_type: string;
  severity: "info" | "warning" | "critical";
  title: string;
  body: string | null;
  assigned_staff_id: string | null;
  created_at: string;
};

type WhatsAppNote = {
  id: string;
  conversation_id: string;
  author_id: string;
  author_name: string;
  body: string;
  mentioned_staff_ids: string[];
  created_at: string;
};

type WhatsAppStaffAction = {
  id: string;
  conversation_id: string;
  actor_id: string;
  actor_name: string;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
};

type ClientMatch = {
  conversation_id: string;
  client_id: string;
  profile_id: string;
  client_code: string | null;
  client_type: string | null;
  label: string;
  company_name: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  province: string | null;
  confidence: number;
  reason: string;
  linked: boolean;
  updated_at: string | null;
};

type RelatedServiceRequest = {
  conversation_id: string;
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  client_profile_id: string | null;
  service_needed: string | null;
  status: string | null;
  lifecycle_stage: string | null;
  priority_level: string | null;
  confidence: number;
  reason: string;
  created_at: string | null;
  updated_at: string | null;
};

type RuleResult = {
  key: string;
  label: string;
  detail: string;
  passed: boolean;
  critical?: boolean;
};

type Evaluation = {
  conversation: Conversation;
  messages: Message[];
  rules: RuleResult[];
  passed: number;
  score: number;
  status: "passed" | "needs_attention" | "failed";
};

type WhatsAppAction = "assign" | "reply" | "return_to_ai" | "mark_read" | "resolve" | "reopen" | "create_service_request" | "add_note" | "link_client" | "unlink_client";
type ReplyTemplateKey = "missing_info" | "document_request" | "appointment" | "handoff" | "follow_up";
type QueueFilter = "all" | "needs_response" | "needs_info" | "ready_leads" | "human" | "new" | "unassigned" | "assigned" | "waiting" | "resolved" | "unread" | "mine" | "passed" | "failed" | "failed_delivery" | "converted";
type ConversationSort = "priority" | "newest" | "oldest" | "name" | "messages";
type LeadSort = "newest" | "oldest" | "name" | "debt";
type ReviewTab = "overview" | "client" | "analysis" | "crm" | "team";
type WhatsAppPlatformTab = "inbox" | "leads" | "ai" | "reports" | "settings";
const WHATSAPP_PLATFORM_TAB_KEYS: WhatsAppPlatformTab[] = ["inbox", "leads", "ai", "reports", "settings"];
type SavedQueueViewKey = "my_inbox" | "urgent_sars" | "needs_info" | "marketplace_ready" | "overdue" | "created_leads";
type ReplyTemplateMeta = {
  value: ReplyTemplateKey;
  label: string;
  detail: string;
};

const QA_FEED_URL = import.meta.env.VITE_WHATSAPP_QA_FEED_URL || "/api/whatsapp-qa-feed";
const QA_LEAD_LINK_URL = import.meta.env.VITE_WHATSAPP_LEAD_LINK_URL || "/api/whatsapp-lead-link";
const MAIN_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://frormnagythfpiuzgfkz.supabase.co";
const MAIN_SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
const MAIN_LEAD_SYNC_URL = `${MAIN_SUPABASE_URL}/functions/v1/whatsapp-lead-sync`;
const SERVICE_OPTIONS = new Set<string>(serviceNeededOptions.map((option) => option.value));
const CLIENT_TYPES = new Set(["individual", "company", "trust", "npo_organisation"]);
const PRIORITY_VALUES = new Set(["low", "medium", "high", "urgent"]);
const RISK_VALUES = new Set(["low", "medium", "high"]);
const QA_ACTION_BUTTON_CLASS = "w-full min-w-0 justify-center gap-2 !h-auto min-h-10 !whitespace-normal break-words px-3 py-2 text-center text-sm leading-snug [&_svg]:shrink-0 [&>span]:min-w-0 [&>span]:break-words";
const QA_INLINE_ACTION_BUTTON_CLASS = "w-full min-w-0 justify-center gap-2 !h-auto min-h-10 !whitespace-normal break-words px-3 py-2 text-center text-sm leading-snug [&_svg]:shrink-0 [&>span]:min-w-0 [&>span]:break-words";
const QA_NARROW_ACTION_GRID_CLASS = "grid grid-cols-1 gap-2";
const REPLY_TEMPLATE_DETAILS: Record<ReplyTemplateKey, Omit<ReplyTemplateMeta, "value">> = {
  missing_info: { label: "Missing info", detail: "Collect the fields blocking lead quality." },
  document_request: { label: "Request documents", detail: "Ask for SARS letters, notices, and account statements." },
  appointment: { label: "Book consultation", detail: "Move a strong lead toward a consult time." },
  handoff: { label: "Human takeover", detail: "Introduce staff control after AI handoff." },
  follow_up: { label: "Follow up", detail: "Nudge a quiet client for outstanding details." },
};
const REPLY_TEMPLATES: ReplyTemplateMeta[] = (Object.entries(REPLY_TEMPLATE_DETAILS) as [ReplyTemplateKey, Omit<ReplyTemplateMeta, "value">][])
  .map(([value, meta]) => ({ value, ...meta }));
const QUEUE_FILTER_LABELS: Record<QueueFilter, string> = {
  all: "All chats",
  needs_response: "Needs response",
  needs_info: "Needs info",
  ready_leads: "Quality leads",
  human: "Human chats",
  new: "New",
  unassigned: "Unassigned",
  assigned: "Assigned",
  waiting: "Waiting for client",
  resolved: "Resolved",
  unread: "Unread",
  mine: "Assigned to me",
  passed: "Passed QA",
  failed: "Critical failures",
  failed_delivery: "Failed sends",
  converted: "Lead created",
};

const SAVED_QUEUE_VIEWS: { key: SavedQueueViewKey; label: string; filter: QueueFilter; sort: ConversationSort; search?: string }[] = [
  { key: "my_inbox", label: "My inbox", filter: "mine", sort: "priority" },
  { key: "urgent_sars", label: "Urgent SARS", filter: "human", sort: "priority", search: "sars" },
  { key: "needs_info", label: "Needs info", filter: "needs_info", sort: "newest" },
  { key: "marketplace_ready", label: "Quality leads", filter: "ready_leads", sort: "newest" },
  { key: "overdue", label: "Overdue", filter: "needs_response", sort: "priority" },
  { key: "created_leads", label: "Lead created", filter: "converted", sort: "newest" },
];

const CITY_PROVINCE: Record<string, string> = {
  pretoria: "Gauteng",
  tshwane: "Gauteng",
  johannesburg: "Gauteng",
  sandton: "Gauteng",
  midrand: "Gauteng",
  durban: "KwaZulu-Natal",
  pietermaritzburg: "KwaZulu-Natal",
  "cape town": "Western Cape",
  bloemfontein: "Free State",
  mbombela: "Mpumalanga",
  nelspruit: "Mpumalanga",
  polokwane: "Limpopo",
  rustenburg: "North West",
  kimberley: "Northern Cape",
  gqeberha: "Eastern Cape",
  "east london": "Eastern Cape",
};

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

function requestsHuman(text: string) {
  return /\b(speak|talk|chat|connect|transfer|hand\s*over|put me through|call)\b.{0,50}\b(human|person|someone|practitioner|consultant|advisor|agent|team|staff)\b/i.test(text)
    || /\b(human|person|practitioner|consultant)\b.{0,35}\b(please|now|assist|help|speak|talk|chat)\b/i.test(text);
}

function hasDuplicateQuestion(text: string) {
  const questions = text
    .split(/(?<=\?)/)
    .filter((part) => part.includes("?"))
    .map(normalize)
    .filter(Boolean);
  return questions.some((question, index) => questions.indexOf(question) !== index);
}

function evaluateConversation(conversation: Conversation, messages: Message[]): Evaluation {
  const inbound = messages.filter((message) => message.direction === "inbound");
  const outbound = messages.filter((message) => message.direction === "outbound");
  const outboundText = outbound.map((message) => message.content || "");
  const allInboundText = normalize(inbound.map((message) => message.content || "").join(" "));
  const intake = conversation.intake_payload || {};

  const identitySafe = !outboundText.some((text) =>
    /\bmy (full )?name is\b/i.test(text)
    || /\b(?:i am|i'm)\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b/.test(text),
  );
  const noInventedWorkflow = !outboundText.some((text) =>
    /\bmandate|engagement letter|authority form\b/i.test(text)
    || /\b(i('|’)ll|we('|’)ll|i will|we will)\s+(prepare|send|issue|email|submit|file|lodge|contact|assign|connect)\b/i.test(text),
  );
  const shortReplies = outboundText.every((text) => text.length <= 360 && text.split(/\n\s*\n/).filter(Boolean).length <= 2);
  const noDuplicateQuestions = outboundText.every((text) => !hasDuplicateQuestion(text));

  const handoffRequests = messages.filter((message) => message.direction === "inbound" && requestsHuman(message.content || ""));
  const handoffPassed = handoffRequests.every((request) => {
    const requestIndex = messages.findIndex((message) => message.id === request.id);
    const laterAutomated = messages.slice(requestIndex + 1).filter((message) =>
      message.direction === "outbound" && message.sender_type !== "staff",
    );
    if (laterAutomated.length !== 1) return false;
    return /hand this chat over|acapolite team|someone can assist/i.test(laterAutomated[0].content || "");
  }) && (handoffRequests.length === 0 || conversation.status === "human_handoff" && conversation.ai_enabled === false);

  const fullName = typeof intake.full_name === "string" ? normalize(intake.full_name) : "";
  const groundedName = !fullName || allInboundText.includes(fullName);
  const city = typeof intake.city === "string" ? intake.city.trim() : "";
  const province = typeof intake.province === "string" ? intake.province.trim() : "";
  const expectedProvince = city ? CITY_PROVINCE[city.toLowerCase()] : undefined;
  const locationCorrect = !expectedProvince || expectedProvince.toLowerCase() === province.toLowerCase();
  const submittedAt = conversation.submission_state === "submitted"
    ? messages.findIndex((message) => message.direction === "outbound" && /request has been created/i.test(message.content || ""))
    : -1;
  const noRepeatSubmission = submittedAt < 0 || !messages.slice(submittedAt + 1).some((message) =>
    message.direction === "outbound" && /\b(?:submit|create|open|send)\b.{0,45}\b(?:case|request|matter)\b/i.test(message.content || ""),
  );

  const rules: RuleResult[] = [
    { key: "identity", label: "Identity safety", detail: "No fabricated personal name or human identity.", passed: identitySafe, critical: true },
    { key: "workflow", label: "No invented actions", detail: "No mandate or unsupported operational claims.", passed: noInventedWorkflow, critical: true },
    { key: "handoff", label: "Human handoff", detail: "Immediate handoff reply followed by complete AI silence.", passed: handoffPassed, critical: true },
    { key: "brevity", label: "WhatsApp brevity", detail: "Replies stay within 360 characters and two paragraphs.", passed: shortReplies },
    { key: "duplicates", label: "No duplicate questions", detail: "The same question is not repeated in one reply.", passed: noDuplicateQuestions },
    { key: "name", label: "Grounded client name", detail: "Saved names must appear in a customer message.", passed: groundedName, critical: true },
    { key: "location", label: "Location normalization", detail: "Known cities resolve to the correct province.", passed: locationCorrect },
    { key: "repeat-submission", label: "No repeat submission", detail: "An existing request is never offered for creation again.", passed: noRepeatSubmission, critical: true },
  ];

  const passed = rules.filter((rule) => rule.passed).length;
  const score = Math.round((passed / rules.length) * 100);
  const criticalFailure = rules.some((rule) => rule.critical && !rule.passed);
  const status = criticalFailure ? "failed" : score === 100 ? "passed" : "needs_attention";
  return { conversation, messages, rules, passed, score, status };
}

function statusBadge(status: Evaluation["status"]) {
  if (status === "passed") return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Passed</Badge>;
  if (status === "failed") return <Badge variant="destructive">Failed</Badge>;
  return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Needs attention</Badge>;
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b py-3 last:border-0 sm:grid-cols-[minmax(110px,0.85fr)_minmax(0,1.15fr)] sm:items-start sm:gap-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words text-sm font-medium sm:text-right">{value || "—"}</span>
    </div>
  );
}

function intakeValue(value: unknown) {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value.toLocaleString("en-ZA");
  return typeof value === "string" && value.trim() ? value : "—";
}

function staffLabel(staff: StaffProfile) {
  return staff.full_name?.trim() || staff.email?.trim() || "Acapolite staff";
}

function fileSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function recordString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

function recordBoolean(record: Record<string, unknown>, key: string) {
  return typeof record[key] === "boolean" ? record[key] as boolean : null;
}

function recordNumber(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function recordArray(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") as string[] : [];
}

function isWizardService(value: string): value is WizardService {
  return SERVICE_OPTIONS.has(value);
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizePhone(waId: string) {
  const digits = waId.replace(/\D/g, "");
  return digits ? `+${digits}` : "";
}

function chooseLeadClientType(intake: Record<string, unknown>): WizardEntityType {
  const explicit = recordString(intake, "client_type");
  if (CLIENT_TYPES.has(explicit)) return explicit as WizardEntityType;
  if (recordString(intake, "company_name") || recordString(intake, "company_registration_number")) return "company";
  const service = recordString(intake, "service_needed");
  if (service.startsWith("business_") || service.startsWith("support_") || service.startsWith("accounting_")) return "company";
  if (service.startsWith("trust_")) return "trust";
  if (service.startsWith("npo_")) return "npo_organisation";
  return "individual";
}

function chooseLeadService(intake: Record<string, unknown>, clientType: WizardEntityType): WizardService {
  const explicit = recordString(intake, "service_needed");
  if (isWizardService(explicit)) return explicit;
  const text = [
    recordString(intake, "description"),
    recordString(intake, "tax_types"),
    recordString(intake, "enforcement_stage"),
    recordString(intake, "desired_outcome"),
  ].join(" ").toLowerCase();
  const hasDebt = recordBoolean(intake, "has_debt_flag") === true
    || recordNumber(intake, "sars_debt_amount") > 0
    || /\bdebt|arrangement|compromise|owe|owed|outstanding\b/.test(text);
  if (clientType === "company" && hasDebt) return text.includes("compromise") ? "business_tax_debt_compromise" : "business_sars_debt_arrangements";
  if (clientType === "individual" && hasDebt) return "individual_sars_debt_assistance";
  if (clientType === "trust") return "trust_sars_assistance";
  if (clientType === "npo_organisation") return "npo_sars_compliance";
  if (clientType === "company") return "business_tax_other";
  return "individual_other";
}

function chooseLeadPriority(intake: Record<string, unknown>, debtAmount: number): Enums<"service_request_priority"> {
  const explicit = recordString(intake, "priority_level").toLowerCase();
  if (PRIORITY_VALUES.has(explicit)) return explicit as Enums<"service_request_priority">;
  const urgency = recordString(intake, "urgency").toLowerCase();
  const enforcement = recordString(intake, "enforcement_stage").toLowerCase();
  if (urgency.includes("urgent") || debtAmount >= 1_000_000 || /(final demand|bank|attachment|judgment|levy|collection)/i.test(enforcement)) return "urgent";
  if (debtAmount >= 250_000) return "high";
  return "medium";
}

function chooseLeadRisk(intake: Record<string, unknown>, priority: string, debtAmount: number): Enums<"service_request_risk_indicator"> {
  const explicit = recordString(intake, "risk_indicator").toLowerCase();
  if (RISK_VALUES.has(explicit)) return explicit as Enums<"service_request_risk_indicator">;
  if (priority === "urgent" || debtAmount >= 1_000_000) return "high";
  if (priority === "high" || debtAmount > 0) return "medium";
  return "low";
}

function buildLeadDescription(conversation: Conversation, intake: Record<string, unknown>, service: WizardService) {
  const description = recordString(intake, "description");
  if (description) return description;
  const pieces = [
    conversation.ai_summary,
    recordString(intake, "document_summary"),
    recordString(intake, "desired_outcome") ? `Desired outcome: ${recordString(intake, "desired_outcome")}` : "",
    recordString(intake, "enforcement_stage") ? `Enforcement stage: ${recordString(intake, "enforcement_stage")}` : "",
  ].filter(Boolean);
  return pieces.join("\n") || `WhatsApp lead for ${formatServiceRequestLabel(service)}. Staff review is needed because the WhatsApp intake is still incomplete.`;
}

function buildLeadPayload(conversation: Conversation, messages: Message[] = []) {
  const intake = asRecord(conversation.intake_payload);
  const clientType = chooseLeadClientType(intake);
  const service = chooseLeadService(intake, clientType);
  const category = getCategoryForService(service);
  const leadQuality = getConversationLeadQuality(conversation, messages);
  const leadGate = getWhatsAppLeadGate(leadQuality);
  const debtAmount = recordNumber(intake, "sars_debt_amount");
  const priority = chooseLeadPriority(intake, debtAmount);
  const risk = chooseLeadRisk(intake, priority, debtAmount);
  const phone = recordString(intake, "phone") || normalizePhone(conversation.wa_id);
  const capturedEmail = recordString(intake, "email").toLowerCase();
  const hasRealEmail = isValidEmail(capturedEmail);
  const email = hasRealEmail ? capturedEmail : `whatsapp-${conversation.wa_id.replace(/\D/g, "") || conversation.id.slice(0, 8)}@acapolite.local`;
  const fullName = recordString(intake, "full_name")
    || conversation.display_name?.trim()
    || `WhatsApp ${phone || conversation.wa_id}`;
  const returnsFiled = recordBoolean(intake, "returns_filed");
  const missingFields = Array.isArray(conversation.intake_missing_fields) ? conversation.intake_missing_fields : [];
  const description = buildLeadDescription(conversation, intake, service);
  const services = Array.from(new Set([service, ...recordArray(intake, "service_needed_list").filter(isWizardService)]));
  const categories = Array.from(new Set([category, ...services.map((item) => getCategoryForService(item))]));

  return {
    full_name: fullName,
    email,
    phone,
    client_type: clientType,
    company_name: clientType === "company" ? recordString(intake, "company_name") || conversation.display_name?.trim() || null : null,
    company_registration_number: clientType === "company" ? recordString(intake, "company_registration_number") || null : null,
    service_category: category,
    service_categories: categories,
    service_needed: service,
    service_needed_list: services,
    description,
    province: recordString(intake, "province") || null,
    city: recordString(intake, "city") || null,
    priority_level: priority,
    risk_indicator: risk,
    sars_debt_amount: debtAmount,
    has_debt_flag: recordBoolean(intake, "has_debt_flag") === true || debtAmount > 0,
    returns_filed: returnsFiled ?? true,
    missing_returns_flag: returnsFiled === false,
    missing_documents_flag: leadQuality.status !== "ready" || missingFields.includes("documents") || !conversation.intake_ready,
    has_sars_audit: /\baudit|verification\b/i.test(description),
    has_adr: /\badr\b/i.test(description),
    has_vat_investigation: /\bvat\b/i.test(description) && /\binvestigation|audit|verification\b/i.test(description),
    has_payroll_dispute: /\bpaye|emp201|emp501|payroll\b/i.test(description) && /\bdispute|audit|verification\b/i.test(description),
    has_multiple_tax_types: /\b(vat|paye|income tax|cit|payroll)\b.*\b(vat|paye|income tax|cit|payroll)\b/i.test(recordString(intake, "tax_types")),
    has_legal_complexity: /\bjudgment|attorney|court|sheriff|legal|summons\b/i.test(description),
    status: leadGate.serviceRequestStatus,
    lifecycle_stage: leadGate.lifecycleStage,
    contact_preference: "WhatsApp",
    marketing_consent: false,
    submitted_with_account: false,
    client_profile_id: null,
    intake_payload: {
      who: { entityType: clientType, province: recordString(intake, "province") || null, city: recordString(intake, "city") || "" },
      what: { selectedServices: services.map((item) => ({ value: item, label: formatServiceRequestLabel(item), category: getCategoryForService(item) })), otherDetails: {} },
      details: {
        answers: {
          efilingAccess: recordString(intake, "efiling_access") || null,
          taxTypes: recordString(intake, "tax_types") || null,
          enforcementStage: recordString(intake, "enforcement_stage") || null,
          desiredOutcome: recordString(intake, "desired_outcome") || null,
          authorisedRepresentative: recordBoolean(intake, "authorised_representative"),
        },
        additionalNotes: description,
        questions: [],
      },
      contact: {
        fullName,
        email: hasRealEmail ? email : "",
        phone,
        province: recordString(intake, "province") || null,
        city: recordString(intake, "city") || "",
        contactPreference: "WhatsApp",
        marketingConsent: false,
      },
      whatsapp: {
        source: "whatsapp_qa_inbox",
        sourceProject: "whatsapp-admin-ai-test",
        qaConversationId: conversation.id,
        waId: conversation.wa_id,
        displayName: conversation.display_name,
        aiSummary: conversation.ai_summary,
        submissionState: conversation.submission_state || "collecting",
        intakeReady: Boolean(conversation.intake_ready),
        missingFields,
        leadQuality: {
          score: leadQuality.score,
          status: leadQuality.status,
          label: leadQuality.label,
          missingFields: leadQuality.missingFields,
          blockingFields: leadQuality.blockingFields,
          nextAction: leadQuality.nextAction,
          evaluatedAt: new Date().toISOString(),
        },
        leadGate: {
          label: leadGate.label,
          marketplaceVisible: leadGate.marketplaceVisible,
          serviceRequestStatus: leadGate.serviceRequestStatus,
          lifecycleStage: leadGate.lifecycleStage,
          evaluatedAt: new Date().toISOString(),
        },
        placeholderEmail: hasRealEmail ? null : email,
        allCapturedDetails: intake,
        createdFrom: "staff_whatsapp_qa",
      },
    },
  };
}

function buildLeadAttachments(messages: Message[]) {
  return messages
    .filter((message) => message.direction === "inbound" && message.attachment_url && message.media_storage_path)
    .slice(0, 10)
    .map((message) => {
      const sourcePath = message.media_storage_path || "";
      const fileName = message.media_filename || sourcePath.split("/").pop() || "whatsapp-document";
      return {
        source_path: sourcePath,
        signed_url: message.attachment_url,
        file_name: fileName,
        title: message.media_filename || "WhatsApp document",
        mime_type: message.media_mime_type || null,
        file_size: message.media_size_bytes || null,
        uploaded_at: message.created_at || null,
      };
    });
}

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function firstNameForConversation(conversation: Conversation) {
  const intake = asRecord(conversation.intake_payload);
  const name = recordString(intake, "full_name") || conversation.display_name || "";
  return name.trim().split(/\s+/)[0] || "";
}

function getDeliverySummary(messages: Message[]) {
  const outbound = messages.filter((message) => message.direction === "outbound");
  const statusCounts = outbound.reduce<Record<string, number>>((counts, message) => {
    const status = (message.delivery_status || "unknown").toLowerCase();
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {});
  const failed = Object.entries(statusCounts)
    .filter(([status]) => /fail|error|undeliver|rejected/.test(status))
    .reduce((sum, [, count]) => sum + count, 0);
  const read = statusCounts.read || 0;
  const delivered = (statusCounts.delivered || 0) + read;
  const sent = (statusCounts.sent || 0) + delivered;
  const pending = Math.max(0, outbound.length - sent - failed);
  return { outbound: outbound.length, sent, delivered, read, failed, pending };
}

function deliveryLabel(status: string | null) {
  if (!status) return "Status pending";
  if (status === "saved_local") return "Saved in Acapolite";
  return status.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function deliveryTone(status: string | null) {
  const value = (status || "").toLowerCase();
  if (/read|delivered/.test(value)) return "text-emerald-600";
  if (/saved_local|sending|submitted|queued/.test(value)) return "text-amber-700";
  if (/fail|error|undeliver|rejected/.test(value)) return "text-red-600";
  return "text-muted-foreground";
}

function latestInboundAt(conversation: Conversation, messages: Message[]) {
  const inboundTimes = messages
    .filter((message) => message.direction === "inbound")
    .map((message) => new Date(message.created_at).getTime())
    .filter(Number.isFinite);
  const latestMessageTime = inboundTimes.length ? Math.max(...inboundTimes) : null;
  const conversationTime = conversation.last_inbound_at ? new Date(conversation.last_inbound_at).getTime() : null;
  const candidates = [latestMessageTime, conversationTime].filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return candidates.length ? Math.max(...candidates) : null;
}

function latestStaffReplyAt(conversation: Conversation, messages: Message[]) {
  const staffTimes = messages
    .filter((message) => message.direction === "outbound" && message.sender_type === "staff")
    .map((message) => new Date(message.created_at).getTime())
    .filter(Number.isFinite);
  const latestMessageTime = staffTimes.length ? Math.max(...staffTimes) : null;
  const conversationTime = conversation.last_staff_reply_at ? new Date(conversation.last_staff_reply_at).getTime() : null;
  const candidates = [latestMessageTime, conversationTime].filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return candidates.length ? Math.max(...candidates) : null;
}

function getConversationSla(conversation: Conversation, messages: Message[]) {
  if (conversation.inbox_status === "resolved") {
    return { status: "closed", label: "Resolved", detail: "No staff response is pending.", minutesLeft: null };
  }
  const inboundAt = latestInboundAt(conversation, messages);
  if (!inboundAt) {
    return { status: "none", label: "No inbound message", detail: "SLA starts after a client message.", minutesLeft: null };
  }
  const staffReplyAt = latestStaffReplyAt(conversation, messages);
  const waitingForStaff = conversation.unread_count > 0 || !staffReplyAt || staffReplyAt < inboundAt;
  if (!waitingForStaff) {
    return { status: "ok", label: "Staff replied", detail: "Latest client message has a staff response.", minutesLeft: null };
  }
  const limitMinutes = conversation.priority_level === "urgent" ? 15 : conversation.priority_level === "high" ? 30 : 60;
  const ageMinutes = Math.floor((Date.now() - inboundAt) / 60_000);
  const minutesLeft = limitMinutes - ageMinutes;
  if (minutesLeft <= 0) return { status: "overdue", label: "Response overdue", detail: `${Math.abs(minutesLeft)} min past target.`, minutesLeft };
  if (minutesLeft <= 10) return { status: "due_soon", label: "Due soon", detail: `${minutesLeft} min left to respond.`, minutesLeft };
  return { status: "ok", label: "On track", detail: `${minutesLeft} min left to respond.`, minutesLeft };
}

function slaTone(status: string) {
  if (status === "overdue") return "border-red-200 bg-red-50 text-red-700";
  if (status === "due_soon") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "closed") return "border-slate-200 bg-slate-50 text-slate-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function getConversationLeadQuality(conversation: Conversation, messages: Message[] = []) {
  return getWhatsAppLeadQuality({
    intakePayload: conversation.intake_payload,
    displayName: conversation.display_name,
    waId: conversation.wa_id,
    aiSummary: conversation.ai_summary,
    intakeReady: conversation.intake_ready,
    missingFields: conversation.intake_missing_fields,
    hasAttachments: messages.some((message) => message.direction === "inbound" && Boolean(message.media_storage_path || message.attachment_url)),
  });
}

function buildMissingInfoReplyForEvaluation(evaluation: Evaluation, leadQuality = getConversationLeadQuality(evaluation.conversation, evaluation.messages)) {
  return buildWhatsAppMissingInfoReply({
    intakePayload: evaluation.conversation.intake_payload,
    displayName: evaluation.conversation.display_name,
    waId: evaluation.conversation.wa_id,
    aiSummary: evaluation.conversation.ai_summary,
    intakeReady: evaluation.conversation.intake_ready,
    missingFields: evaluation.conversation.intake_missing_fields,
    hasAttachments: evaluation.messages.some((item) => item.direction === "inbound" && Boolean(item.media_storage_path || item.attachment_url)),
  }, leadQuality);
}

function buildReplyTemplate(template: ReplyTemplateKey, evaluation: Evaluation, leadQuality = getConversationLeadQuality(evaluation.conversation, evaluation.messages)) {
  const firstName = firstNameForConversation(evaluation.conversation);
  const greeting = `Thanks${firstName ? ` ${firstName}` : ""}.`;
  if (template === "missing_info") return buildMissingInfoReplyForEvaluation(evaluation, leadQuality);
  if (template === "document_request") {
    return `${greeting} Please send any SARS letter, bank notice, statement of account, or demand linked to this matter so we can review the details accurately.`;
  }
  if (template === "appointment") {
    return `${greeting} We can arrange a consultation for this matter. Please send two times that work for you, and confirm the best email address for the booking.`;
  }
  if (template === "handoff") {
    return `${greeting} I am taking over from the Acapolite assistant now. I will review your details and come back with the next step.`;
  }
  return `${greeting} Just following up on your Acapolite request. Please send the outstanding details when you are ready so we can move this forward.`;
}

function getRecommendedReplyTemplates(evaluation: Evaluation, leadQuality: ReturnType<typeof getConversationLeadQuality>, sla: ReturnType<typeof getConversationSla> | null) {
  const text = normalize([
    evaluation.conversation.ai_summary,
    evaluation.conversation.intake_payload?.description,
    evaluation.messages.map((message) => message.content || "").join(" "),
  ].filter(Boolean).join(" "));
  const missingFields = new Set(leadQuality.followUpFields);
  const recommendations: ReplyTemplateKey[] = [];

  if (leadQuality.followUpFields.length) recommendations.push("missing_info");
  if (
    missingFields.has("documents")
    || /\b(letter|notice|statement|bank|attachment|document|demand|audit|verification|assessment)\b/.test(text)
  ) {
    recommendations.push("document_request");
  }
  if (evaluation.conversation.status === "human_handoff" || evaluation.conversation.ai_enabled) recommendations.push("handoff");
  if (leadQuality.status === "ready") recommendations.push("appointment");
  if (sla?.status === "overdue" || sla?.status === "due_soon") recommendations.push("follow_up");

  return [...new Set([...recommendations, "missing_info", "document_request", "appointment"])]
    .slice(0, 4)
    .map((value) => ({ value, ...REPLY_TEMPLATE_DETAILS[value] }));
}

function formatStaffActionLabel(action: string) {
  const labels: Record<string, string> = {
    assigned: "Assigned",
    reassigned: "Reassigned",
    staff_reply: "Staff reply",
    returned_to_ai: "Returned to AI",
    resolved: "Resolved",
    reopened: "Reopened",
    service_request_created: "Lead created",
    service_request_synced: "Lead refreshed",
    internal_note_added: "Private note",
    client_linked: "Client linked",
    client_unlinked: "Client unlinked",
  };
  return labels[action] || action.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatNullableDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : "—";
}

function isWhatsAppReplyRestrictionError(message: string) {
  return /whatsapp rejected|rejected the reply|rejected.*400|customer[-\s]?care|customer service|approved follow[-\s]?up|approved template|normal reply|normal message|outside.*window|reply window|window has (?:closed|passed)|24[-\s]?hour|131047|400/i.test(message);
}

function friendlyWhatsAppActionError(action: WhatsAppAction, message: string) {
  if (action !== "reply") return message;
  if (isWhatsAppReplyRestrictionError(message)) {
    return "Reply saved in Acapolite for staff follow-up. It is recorded on this chat even if WhatsApp delivery is unavailable.";
  }
  return message;
}

function leadGateActionLabel(gate: ReturnType<typeof getWhatsAppLeadGate> | null) {
  if (!gate) return "Send request";
  if (gate.qualityStatus === "needs_info") return "Hold lead";
  if (gate.qualityStatus === "weak") return "Park lead";
  return gate.actionLabel;
}

async function mainSupabaseRestMutation(token: string, path: string, method: "POST" | "PATCH", body: Record<string, unknown>) {
  if (!MAIN_SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("The main Acapolite connection is not configured");
  }

  const response = await fetch(`${MAIN_SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: MAIN_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { message?: string; error?: string } | null;
    throw new Error(payload?.message || payload?.error || `Database update failed (${response.status})`);
  }
}

export default function AdminWhatsAppQA() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [actionPending, setActionPending] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [draftRequestedFor, setDraftRequestedFor] = useState<string | null>(null);
  const [replyTemplate, setReplyTemplate] = useState<ReplyTemplateKey>("missing_info");
  const [queueFilter, setQueueFilter] = useState<QueueFilter>("all");
  const [conversationSearch, setConversationSearch] = useState("");
  const [conversationSort, setConversationSort] = useState<ConversationSort>("newest");
  const [leadSearch, setLeadSearch] = useState("");
  const [leadSort, setLeadSort] = useState<LeadSort>("newest");
  const [reviewTab, setReviewTab] = useState<ReviewTab>("overview");
  const [platformTab, setPlatformTab] = useState<WhatsAppPlatformTab>("inbox");
  const [internalNote, setInternalNote] = useState("");
  const [mobileWorkspaceView, setMobileWorkspaceView] = useState<"conversations" | "chat">("conversations");
  const { session, loading: authLoading } = useAuth();
  const conversationIdFromQuery = searchParams.get("conversationId");
  const draftIntent = searchParams.get("draft");
  const platformSectionFromQuery = searchParams.get("section");
  const query = useQuery({
    queryKey: ["whatsapp-qa-scorecard", session?.user.id],
    queryFn: async () => {
      const token = session?.access_token;
      if (!token) throw new Error("Admin session is unavailable");
      const response = await fetch(QA_FEED_URL, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error(`QA feed failed (${response.status})`);
      const payload = await response.json();
      const allMessages = (payload.messages || []) as Message[];
      const readTimes = new Map<string, string>((payload.reads || []).map((read: { conversation_id: string; last_read_at: string }) => [read.conversation_id, read.last_read_at]));
      return {
        evaluations: ((payload.conversations || []) as Conversation[]).map((conversation) => {
          const conversationMessages = allMessages.filter((message) => message.conversation_id === conversation.id);
          const lastReadAt = readTimes.get(conversation.id);
          const unreadCount = conversationMessages.filter((message) => message.direction === "inbound" && (!lastReadAt || new Date(message.created_at) > new Date(lastReadAt))).length;
          const inboxStatus = conversation.inbox_status || (conversation.status === "human_handoff" ? conversation.assigned_staff_id ? "assigned" : "unassigned" : "resolved");
          return evaluateConversation({
            ...conversation,
            linked_client_id: conversation.linked_client_id || null,
            linked_client_profile_id: conversation.linked_client_profile_id || null,
            linked_client_at: conversation.linked_client_at || null,
            linked_client_by: conversation.linked_client_by || null,
            inbox_status: inboxStatus,
            priority_level: conversation.priority_level || "normal",
            first_staff_reply_at: conversation.first_staff_reply_at || null,
            resolved_at: conversation.resolved_at || null,
            resolved_by: conversation.resolved_by || null,
            unread_count: unreadCount,
          }, conversationMessages);
        }),
        staff: (payload.staff || []) as StaffProfile[],
        currentStaff: (payload.current_staff || null) as StaffProfile | null,
        alerts: (payload.alerts || []) as WhatsAppAlert[],
        notes: (payload.notes || []) as WhatsAppNote[],
        staffActions: (payload.staff_actions || []) as WhatsAppStaffAction[],
        clientMatches: (payload.client_matches || []) as ClientMatch[],
        relatedServiceRequests: (payload.related_service_requests || []) as RelatedServiceRequest[],
        inboxReady: payload.features?.inbox_v2 === true,
      } satisfies FeedPayload;
    },
    enabled: !authLoading && Boolean(session?.access_token),
    refetchInterval: 30_000,
  });

  const evaluations = useMemo(() => query.data?.evaluations || [], [query.data?.evaluations]);
  const staff = query.data?.staff || [];
  const alerts = query.data?.alerts || [];
  const visibleEvaluations = useMemo(() => {
    const needle = normalize(conversationSearch);
    const filtered = evaluations.filter((evaluation) => {
      const { conversation, messages } = evaluation;
      const leadQuality = getConversationLeadQuality(conversation, messages);
      const sla = getConversationSla(conversation, messages);
      const delivery = getDeliverySummary(messages);
      const matchesQueue = queueFilter === "all"
        || queueFilter === "human" && conversation.status === "human_handoff"
        || queueFilter === "needs_info" && leadQuality.status !== "ready"
        || queueFilter === "ready_leads" && leadQuality.status === "ready"
        || queueFilter === "needs_response" && ["overdue", "due_soon"].includes(sla.status)
        || queueFilter === "new" && conversation.inbox_status === "new"
        || queueFilter === "unassigned" && conversation.inbox_status === "unassigned"
        || queueFilter === "assigned" && conversation.inbox_status === "assigned"
        || queueFilter === "waiting" && conversation.inbox_status === "waiting_client"
        || queueFilter === "resolved" && conversation.inbox_status === "resolved"
        || queueFilter === "mine" && conversation.assigned_staff_id === query.data?.currentStaff?.id
        || queueFilter === "unread" && conversation.unread_count > 0
        || queueFilter === "passed" && evaluation.status === "passed"
        || queueFilter === "failed" && evaluation.status === "failed"
        || queueFilter === "failed_delivery" && delivery.failed > 0
        || queueFilter === "converted" && Boolean(conversation.service_request_id);
      const intake = conversation.intake_payload || {};
      const haystack = normalize([conversation.display_name, conversation.wa_id, intake.full_name, intake.company_name, intake.email, intake.service_needed, intake.tax_types, intake.province, intake.city, conversation.ai_summary].filter(Boolean).join(" "));
      return matchesQueue && (!needle || haystack.includes(needle));
    });
    return [...filtered].sort((a, b) => {
      if (conversationSort === "priority") {
        const rank = { urgent: 3, high: 2, normal: 1 };
        return rank[b.conversation.priority_level] - rank[a.conversation.priority_level] || b.conversation.unread_count - a.conversation.unread_count;
      }
      if (conversationSort === "oldest") return new Date(a.conversation.updated_at).getTime() - new Date(b.conversation.updated_at).getTime();
      if (conversationSort === "name") return (a.conversation.display_name || a.conversation.wa_id).localeCompare(b.conversation.display_name || b.conversation.wa_id);
      if (conversationSort === "messages") return b.messages.length - a.messages.length;
      return new Date(b.conversation.updated_at).getTime() - new Date(a.conversation.updated_at).getTime();
    });
  }, [conversationSearch, conversationSort, evaluations, query.data?.currentStaff?.id, queueFilter]);
  useEffect(() => {
    if (!conversationIdFromQuery || selectedId === conversationIdFromQuery) return;
    if (evaluations.some((evaluation) => evaluation.conversation.id === conversationIdFromQuery)) {
      setSelectedId(conversationIdFromQuery);
      setQueueFilter("all");
      setReviewTab("overview");
      setPlatformTab("inbox");
      setMobileWorkspaceView("chat");
    }
  }, [conversationIdFromQuery, evaluations, selectedId]);
  useEffect(() => {
    if (!platformSectionFromQuery) return;
    if (!WHATSAPP_PLATFORM_TAB_KEYS.includes(platformSectionFromQuery as WhatsAppPlatformTab)) return;

    const nextTab = platformSectionFromQuery as WhatsAppPlatformTab;
    setPlatformTab(nextTab);
    if (nextTab === "ai") setConversationSearch("");
    if (nextTab === "leads") setLeadSearch("");
    if (nextTab === "inbox" && !conversationIdFromQuery) {
      setMobileWorkspaceView("conversations");
    }
  }, [conversationIdFromQuery, platformSectionFromQuery]);
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [platformTab]);
  const filteredLeadEvaluations = useMemo(() => {
    const needle = normalize(leadSearch);
    const filtered = evaluations.filter(({ conversation }) => {
      const intake = conversation.intake_payload || {};
      return !needle || normalize([conversation.display_name, conversation.wa_id, intake.full_name, intake.company_name, intake.email, intake.city, intake.service_needed].filter(Boolean).join(" ")).includes(needle);
    });
    return [...filtered].sort((a, b) => {
      if (leadSort === "oldest") return new Date(a.conversation.updated_at).getTime() - new Date(b.conversation.updated_at).getTime();
      if (leadSort === "name") return (a.conversation.display_name || a.conversation.wa_id).localeCompare(b.conversation.display_name || b.conversation.wa_id);
      if (leadSort === "debt") return Number(b.conversation.intake_payload?.sars_debt_amount || 0) - Number(a.conversation.intake_payload?.sars_debt_amount || 0);
      return new Date(b.conversation.updated_at).getTime() - new Date(a.conversation.updated_at).getTime();
    });
  }, [evaluations, leadSearch, leadSort]);
  const selectedVisibleLeadIds = useMemo(
    () => new Set(filteredLeadEvaluations.filter((evaluation) => selectedLeadIds.has(evaluation.conversation.id)).map((evaluation) => evaluation.conversation.id)),
    [filteredLeadEvaluations, selectedLeadIds],
  );
  const selectedVisibleLeadCount = selectedVisibleLeadIds.size;
  const allVisibleLeadsSelected = filteredLeadEvaluations.length > 0 && selectedVisibleLeadCount === filteredLeadEvaluations.length;
  const leadExportActionLabel = selectedVisibleLeadCount
    ? `Export selected (${selectedVisibleLeadCount})`
    : leadSearch
      ? "Export filtered"
      : "Export shown";
  const leadDeleteActionLabel = selectedVisibleLeadCount
    ? `Delete selected (${selectedVisibleLeadCount})`
    : "Select leads to delete";
  const aiControlEvaluations = useMemo(() => {
    const rank = { urgent: 3, high: 2, normal: 1 };

    return [...evaluations].sort((a, b) => (
      rank[b.conversation.priority_level] - rank[a.conversation.priority_level]
      || b.conversation.unread_count - a.conversation.unread_count
      || new Date(b.conversation.updated_at).getTime() - new Date(a.conversation.updated_at).getTime()
    ));
  }, [evaluations]);
  const visibleAiControlEvaluations = useMemo(() => {
    const needle = normalize(conversationSearch);
    if (!needle) return aiControlEvaluations;
    return aiControlEvaluations.filter(({ conversation, messages }) => {
      const intake = conversation.intake_payload || {};
      const latestMessage = messages[messages.length - 1];
      const haystack = normalize([
        conversation.display_name,
        conversation.wa_id,
        intake.full_name,
        intake.company_name,
        intake.email,
        intake.service_needed,
        intake.tax_types,
        conversation.ai_summary,
        latestMessage?.content,
      ].filter(Boolean).join(" "));
      return haystack.includes(needle);
    });
  }, [aiControlEvaluations, conversationSearch]);
  const fallbackSelected = platformTab === "ai"
    ? visibleAiControlEvaluations[0]
    : platformTab === "leads"
      ? filteredLeadEvaluations[0]
      : visibleEvaluations[0];
  const selected = (selectedId ? evaluations.find((evaluation) => evaluation.conversation.id === selectedId) : null) || fallbackSelected || evaluations[0] || null;
  const selectedLeadQuality = selected ? getConversationLeadQuality(selected.conversation, selected.messages) : null;
  const displayedLeadQualityChecks = selectedLeadQuality?.checks || getWhatsAppLeadQuality({}).checks;
  const selectedLeadGate = selectedLeadQuality ? getWhatsAppLeadGate(selectedLeadQuality) : null;
  const selectedSla = selected ? getConversationSla(selected.conversation, selected.messages) : null;
  const selectedDelivery = selected ? getDeliverySummary(selected.messages) : null;
  const notes = query.data?.notes || [];
  const staffActions = query.data?.staffActions || [];
  const clientMatches = query.data?.clientMatches || [];
  const relatedServiceRequests = query.data?.relatedServiceRequests || [];
  const selectedNotes = selected ? notes.filter((note) => note.conversation_id === selected.conversation.id) : [];
  const selectedStaffActions = selected ? staffActions.filter((action) => action.conversation_id === selected.conversation.id) : [];
  const selectedClientMatches = selected ? clientMatches.filter((match) => match.conversation_id === selected.conversation.id) : [];
  const selectedRelatedServiceRequests = selected ? relatedServiceRequests.filter((request) => request.conversation_id === selected.conversation.id) : [];
  const linkedClientMatch = selected
    ? selectedClientMatches.find((match) => match.client_id === selected.conversation.linked_client_id) || selectedClientMatches.find((match) => match.linked) || null
    : null;
  const bestClientMatch = linkedClientMatch || selectedClientMatches[0] || null;
  const selectedReplyTemplates = useMemo(
    () => selected && selectedLeadQuality ? getRecommendedReplyTemplates(selected, selectedLeadQuality, selectedSla) : [],
    [selected, selectedLeadQuality, selectedSla],
  );
  useEffect(() => {
    if (draftIntent !== "missing_info" || !selected || !selectedLeadQuality) return;
    if (conversationIdFromQuery && selected.conversation.id !== conversationIdFromQuery) return;
    if (draftRequestedFor === selected.conversation.id) return;
    if (!selectedLeadQuality.followUpFields.length) return;

    setReply(buildMissingInfoReplyForEvaluation(selected, selectedLeadQuality));
    setDraftRequestedFor(selected.conversation.id);
    toast.message("Missing-info reply drafted from the lead dashboard.");
  }, [conversationIdFromQuery, draftIntent, draftRequestedFor, selected, selectedLeadQuality]);
  useEffect(() => {
    setInternalNote("");
  }, [selected?.conversation.id]);
  useEffect(() => {
    setSelectedLeadIds((current) => {
      if (!current.size) return current;
      const visibleIds = new Set(filteredLeadEvaluations.map((evaluation) => evaluation.conversation.id));
      const next = new Set([...current].filter((id) => visibleIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [filteredLeadEvaluations]);
  const totals = useMemo(() => ({
    conversations: evaluations.length,
    passed: evaluations.filter((evaluation) => evaluation.status === "passed").length,
    failed: evaluations.filter((evaluation) => evaluation.status === "failed").length,
    average: evaluations.length ? Math.round(evaluations.reduce((sum, evaluation) => sum + evaluation.score, 0) / evaluations.length) : 0,
    human: evaluations.filter((evaluation) => evaluation.conversation.status === "human_handoff").length,
    unassigned: evaluations.filter((evaluation) => evaluation.conversation.inbox_status === "unassigned").length,
    unread: evaluations.reduce((sum, evaluation) => sum + evaluation.conversation.unread_count, 0),
    resolved: evaluations.filter((evaluation) => evaluation.conversation.status === "human_handoff" && evaluation.conversation.inbox_status === "resolved").length,
    needsInfo: evaluations.filter((evaluation) => getConversationLeadQuality(evaluation.conversation, evaluation.messages).status !== "ready").length,
    qualityLeads: evaluations.filter((evaluation) => getConversationLeadQuality(evaluation.conversation, evaluation.messages).status === "ready").length,
    needsResponse: evaluations.filter((evaluation) => ["overdue", "due_soon"].includes(getConversationSla(evaluation.conversation, evaluation.messages).status)).length,
    failedDeliveries: evaluations.reduce((sum, evaluation) => sum + getDeliverySummary(evaluation.messages).failed, 0),
  }), [evaluations]);

  const reports = useMemo(() => {
    const handoffs = evaluations.filter(({ conversation }) => conversation.human_handoff_requested_at);
    const responseMinutes = handoffs.flatMap(({ conversation }) => conversation.first_staff_reply_at && conversation.human_handoff_requested_at
      ? [(new Date(conversation.first_staff_reply_at).getTime() - new Date(conversation.human_handoff_requested_at).getTime()) / 60000]
      : []).filter((minutes) => minutes >= 0);
    const serviceCounts = new Map<string, number>();
    const staffStats = new Map<string, { replies: number; conversations: Set<string> }>();
    evaluations.forEach(({ conversation, messages }) => {
      const service = String(conversation.intake_payload?.service_needed || "Not classified").replace(/_/g, " ");
      serviceCounts.set(service, (serviceCounts.get(service) || 0) + 1);
      messages.filter((message) => message.sender_type === "staff").forEach((message) => {
        const name = message.staff_sender_name || "Unknown staff";
        const stat = staffStats.get(name) || { replies: 0, conversations: new Set<string>() };
        stat.replies += 1;
        stat.conversations.add(conversation.id);
        staffStats.set(name, stat);
      });
    });
    const byDay = new Map<string, number>();
    handoffs.forEach(({ conversation }) => {
      const day = new Date(conversation.human_handoff_requested_at!).toLocaleDateString("en-ZA", { month: "short", day: "numeric" });
      byDay.set(day, (byDay.get(day) || 0) + 1);
    });
    return {
      averageFirstResponse: responseMinutes.length ? Math.round(responseMinutes.reduce((sum, value) => sum + value, 0) / responseMinutes.length) : null,
      converted: evaluations.filter(({ conversation }) => conversation.service_request_id).length,
      conversionRate: evaluations.length ? Math.round(evaluations.filter(({ conversation }) => conversation.service_request_id).length / evaluations.length * 100) : 0,
      services: [...serviceCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
      byDay: [...byDay.entries()].slice(-7),
      staff: [...staffStats.entries()].map(([name, stat]) => ({ name, replies: stat.replies, conversations: stat.conversations.size })).sort((a, b) => b.replies - a.replies),
    };
  }, [evaluations]);

  const leadFunnel = useMemo(() => {
    const total = Math.max(1, totals.conversations);
    return [
      { label: "Chats captured", count: totals.conversations, filter: "all" as QueueFilter },
      { label: "Human handoffs", count: totals.human, filter: "human" as QueueFilter },
      { label: "Quality leads", count: totals.qualityLeads, filter: "ready_leads" as QueueFilter },
      { label: "Lead records", count: reports.converted, filter: "converted" as QueueFilter },
      { label: "Needs response", count: totals.needsResponse, filter: "needs_response" as QueueFilter },
    ].map((item) => ({ ...item, percent: Math.round((item.count / total) * 100) }));
  }, [reports.converted, totals.conversations, totals.human, totals.needsResponse, totals.qualityLeads]);

  const setConversationQueueFilter = (filter: QueueFilter) => {
    setQueueFilter(filter);
    setSelectedId(null);
    setReviewTab("overview");
    setPlatformTab("inbox");
    setMobileWorkspaceView("conversations");
  };

  const toggleQueueFilter = (filter: QueueFilter) => {
    setConversationQueueFilter(queueFilter === filter ? "all" : filter);
  };

  const inspectConversation = (conversationId: string, tab: ReviewTab = "overview") => {
    if (!visibleEvaluations.some((evaluation) => evaluation.conversation.id === conversationId)) {
      setQueueFilter("all");
    }
    setSelectedId(conversationId);
    setReviewTab(tab);
  };

  const openConversation = (conversationId: string, tab: ReviewTab = "overview") => {
    inspectConversation(conversationId, tab);
    setPlatformTab("inbox");
    setMobileWorkspaceView("chat");
  };

  const filterCardClass = (filter: QueueFilter) => queueFilter === filter
    ? "border-primary ring-1 ring-primary"
    : "transition-colors hover:border-primary/50";

  const openLead = (requestId: string) => {
    window.location.assign(`/dashboard/staff/service-requests?leadId=${encodeURIComponent(requestId)}`);
  };

  const openClient = (clientId: string) => {
    window.location.assign(`/dashboard/staff/client-workspace?clientId=${encodeURIComponent(clientId)}`);
  };

  const saveReplyLocallyAfterDeliveryBlock = async (message: string) => {
    if (!session?.access_token || !selected) return;
    const currentStaff = query.data?.currentStaff;
    const sentAt = new Date().toISOString();
    const staffId = currentStaff?.id || session.user.id;
    const staffName = currentStaff ? staffLabel(currentStaff) : "Acapolite staff";

    await mainSupabaseRestMutation(session.access_token, "whatsapp_messages", "POST", {
      conversation_id: selected.conversation.id,
      direction: "outbound",
      sender_type: "staff",
      message_type: "text",
      content: message,
      delivery_status: "saved_local",
      staff_sender_id: staffId,
      staff_sender_name: staffName,
      created_at: sentAt,
    });

    const assignmentPatch = selected.conversation.assigned_staff_id ? {} : {
      assigned_staff_id: staffId,
      assigned_staff_name: staffName,
      assigned_at: sentAt,
      assigned_by: staffId,
    };

    await mainSupabaseRestMutation(session.access_token, `whatsapp_conversations?id=eq.${encodeURIComponent(selected.conversation.id)}`, "PATCH", {
      ...assignmentPatch,
      status: "human_handoff",
      inbox_status: "waiting_client",
      ai_enabled: false,
      first_staff_reply_at: selected.conversation.first_staff_reply_at || sentAt,
      last_outbound_at: sentAt,
      last_staff_reply_at: sentAt,
      updated_at: sentAt,
    });
  };

  const applySavedQueueView = (viewKey: SavedQueueViewKey) => {
    const view = SAVED_QUEUE_VIEWS.find((item) => item.key === viewKey);
    if (!view) return;
    setQueueFilter(view.filter);
    setConversationSort(view.sort);
    setConversationSearch(view.search || "");
    setSelectedId(null);
    setReviewTab("overview");
    setPlatformTab("inbox");
    setMobileWorkspaceView("conversations");
  };

  const runAction = async (action: WhatsAppAction, values: Record<string, unknown> = {}) => {
    if (!session?.access_token || !selected) return null;
    if (["mark_read", "resolve", "reopen"].includes(action) && !query.data?.inboxReady) {
      toast.error("This inbox action will be available after the WhatsApp backend upgrade");
      return null;
    }
    setActionPending(true);
    try {
      const response = await fetch(QA_FEED_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action, conversation_id: selected.conversation.id, ...values }),
      });
      const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
      if (!response.ok) {
        throw new Error(typeof payload.error === "string" ? payload.error : `Action failed (${response.status})`);
      }
      if (action === "reply") setReply("");
      const replyDeliveryStatus = typeof payload.delivery_status === "string" ? payload.delivery_status : "";
      const message = action === "reply"
        ? ["failed", "saved_local"].includes(replyDeliveryStatus)
          ? "Reply saved in Acapolite for staff follow-up."
          : payload.delivery_method === "template" ? "Follow-up template sent on WhatsApp" : "Reply sent on WhatsApp"
        : action === "assign"
          ? "Chat assigned"
          : action === "resolve"
            ? "Chat resolved"
            : action === "reopen"
              ? "Chat reopened"
              : action === "mark_read"
                ? "Chat marked as read"
                : action === "create_service_request"
                  ? payload.created === true ? "Lead sent to dashboard" : "Lead refreshed in dashboard"
                  : action === "add_note"
                    ? "Private note saved"
                    : action === "link_client"
                      ? "Client linked to this WhatsApp chat"
                      : action === "unlink_client"
                        ? "Client link removed"
                        : "AI replies restored";
      toast.success(message);
      if (typeof payload.warning === "string" && payload.warning && !(action === "reply" && replyDeliveryStatus === "saved_local")) {
        toast.message(friendlyWhatsAppActionError(action, payload.warning));
      }
      if (typeof payload.link_warning === "string" && payload.link_warning) toast.warning(payload.link_warning);
      if (action === "create_service_request") {
        const skippedDocuments = typeof payload.skipped_documents === "number" ? payload.skipped_documents : 0;
        if (skippedDocuments > 0) toast.warning(`${skippedDocuments} WhatsApp attachment${skippedDocuments === 1 ? "" : "s"} could not be copied to the lead`);
        const warnings = Array.isArray(payload.warnings) ? payload.warnings.filter((warning) => typeof warning === "string") : [];
        if (typeof warnings[0] === "string") toast.warning(warnings[0]);
      }
      await query.refetch();
      return payload;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update this chat";
      if (action === "reply" && isWhatsAppReplyRestrictionError(message)) {
        const replyMessage = String(values.message || "").replace(/\s+/g, " ").trim();
        if (replyMessage) {
          try {
            await saveReplyLocallyAfterDeliveryBlock(replyMessage);
            setReply("");
            await query.refetch();
            toast.success("Reply saved in Acapolite for staff follow-up.");
            return { ok: true, delivery_status: "saved_local" };
          } catch (fallbackError) {
            toast.error(fallbackError instanceof Error ? fallbackError.message : "The reply could not be saved in Acapolite");
            return null;
          }
        }
      }
      toast.error(friendlyWhatsAppActionError(action, message));
      return null;
    } finally {
      setActionPending(false);
    }
  };

  const saveInternalNote = async () => {
    const note = internalNote.trim();
    if (!note) return toast.error("Write a private note first");
    const mentionedStaffIds = staff
      .filter((person) => {
        const name = staffLabel(person);
        return note.toLowerCase().includes(`@${name.toLowerCase()}`) || Boolean(person.email && note.toLowerCase().includes(`@${person.email.toLowerCase()}`));
      })
      .map((person) => person.id);
    const payload = await runAction("add_note", { note, mentioned_staff_ids: mentionedStaffIds });
    if (payload) setInternalNote("");
  };

  const linkClientMatch = async (match: ClientMatch) => {
    await runAction("link_client", {
      client_id: match.client_id,
      client_profile_id: match.profile_id,
      client_label: match.label,
    });
  };

  const sendSelectedToLeads = async () => {
    if (!session?.access_token || !selected) return;
    if (!MAIN_SUPABASE_PUBLISHABLE_KEY) {
      toast.error("The main Acapolite connection is not configured");
      return;
    }
    const leadQuality = getConversationLeadQuality(selected.conversation, selected.messages);
    const leadGate = getWhatsAppLeadGate(leadQuality);
    if (leadGate.qualityStatus !== "ready") {
      const missing = leadQuality.followUpFields.length
        ? `\n\nMissing: ${leadQuality.followUpFields.map(formatWhatsAppMissingFieldLabel).join(", ")}.`
        : "";
      const confirmed = window.confirm(`${leadGate.confirmTitle}\n\n${leadGate.confirmBody}${missing}`);
      if (!confirmed) return;
    }

    setActionPending(true);
    try {
      const response = await fetch(MAIN_LEAD_SYNC_URL, {
        method: "POST",
        headers: {
          apikey: MAIN_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "upsert_lead",
          service_request_id: selected.conversation.service_request_id,
          payload: buildLeadPayload(selected.conversation, selected.messages),
          attachments: buildLeadAttachments(selected.messages),
        }),
      });
      const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
      const leadId = typeof payload.service_request_id === "string"
        ? payload.service_request_id
        : typeof payload.id === "string"
          ? payload.id
          : "";
      if (!response.ok || !leadId) {
        throw new Error(typeof payload.error === "string" ? payload.error : `Lead sync failed (${response.status})`);
      }

      const linkResponse = await fetch(QA_LEAD_LINK_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: selected.conversation.id,
          service_request_id: leadId,
          created: payload.created === true,
          updated: payload.updated === true,
          synced_documents: typeof payload.synced_documents === "number" ? payload.synced_documents : 0,
          skipped_documents: typeof payload.skipped_documents === "number" ? payload.skipped_documents : 0,
          warnings: Array.isArray(payload.warnings) ? payload.warnings.filter((warning) => typeof warning === "string") : [],
        }),
      });
      const linkPayload = await linkResponse.json().catch(() => ({})) as Record<string, unknown>;
      if (!linkResponse.ok) {
        toast.warning(typeof linkPayload.error === "string" ? linkPayload.error : "Lead created, but the WhatsApp chat link could not be saved automatically");
      }

      toast.success(payload.created === true ? leadGate.savedMessage : "Lead refreshed in dashboard");
      if (!leadGate.marketplaceVisible) toast.message("This lead is hidden from practitioners until staff approves it.");
      const skippedDocuments = typeof payload.skipped_documents === "number" ? payload.skipped_documents : 0;
      if (skippedDocuments > 0) toast.warning(`${skippedDocuments} WhatsApp attachment${skippedDocuments === 1 ? "" : "s"} could not be copied to the lead`);
      const warnings = Array.isArray(payload.warnings) ? payload.warnings.filter((warning) => typeof warning === "string") : [];
      if (typeof warnings[0] === "string") toast.warning(warnings[0]);
      await query.refetch();
      openLead(leadId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to send this chat to the leads dashboard");
    } finally {
      setActionPending(false);
    }
  };

  const draftMissingInfoReply = () => {
    if (!selected || !selectedLeadQuality) {
      toast.error("Select a WhatsApp conversation before drafting a reply.");
      return;
    }
    if (selectedLeadQuality.followUpFields.length === 0) {
      toast.success("This lead already has the main details.");
      return;
    }
    const message = buildMissingInfoReplyForEvaluation(selected, selectedLeadQuality);
    setReply(message);
    if (selected.conversation.ai_enabled) {
      toast.message("Missing-info reply drafted. Take over the chat before sending.");
      return;
    }
    toast.message("Missing-info reply drafted.");
  };

  const applyReplyTemplate = (templateKey: ReplyTemplateKey = replyTemplate) => {
    if (!selected || !selectedLeadQuality) {
      toast.error("Select a WhatsApp conversation before using a reply template.");
      return;
    }
    setReplyTemplate(templateKey);
    setReply(buildReplyTemplate(templateKey, selected, selectedLeadQuality));
    if (selected.conversation.ai_enabled) {
      toast.message("Reply drafted. Take over the chat before sending.");
      return;
    }
    toast.message("Reply template drafted.");
  };

  const draftReengagementReply = () => {
    if (!selected || !selectedLeadQuality) {
      toast.error("Select a WhatsApp conversation before drafting a follow-up.");
      return;
    }
    if (selectedLeadQuality.followUpFields.length) {
      draftMissingInfoReply();
      return;
    }
    applyReplyTemplate("follow_up");
  };

  const exportLeadData = () => {
    const rows = filteredLeadEvaluations.filter((evaluation) => selectedVisibleLeadIds.size === 0 || selectedVisibleLeadIds.has(evaluation.conversation.id));
    if (!rows.length) return toast.error("There is no client data to export");
    const headers = ["WhatsApp name", "Full name", "Phone", "Email", "Client type", "Company", "City", "Province", "Service", "Tax types", "SARS debt", "Enforcement stage", "Urgency", "Lead quality", "Lead quality score", "Missing fields", "eFiling access", "Desired outcome", "Conversation status", "Submission state", "Assigned staff", "Service request ID", "Summary", "Started", "Last activity"];
    const data = rows.map(({ conversation, messages }) => {
      const intake = conversation.intake_payload || {};
      const leadQuality = getConversationLeadQuality(conversation, messages);
      return [
        conversation.display_name,
        intake.full_name,
        `+${conversation.wa_id}`,
        intake.email,
        intake.client_type,
        intake.company_name,
        intake.city,
        intake.province,
        intake.service_needed,
        intake.tax_types,
        intake.sars_debt_amount,
        intake.enforcement_stage,
        intake.urgency,
        leadQuality.label,
        leadQuality.score,
        leadQuality.missingFields.map(formatWhatsAppMissingFieldLabel).join(", "),
        intake.efiling_access,
        intake.desired_outcome,
        conversation.status,
        conversation.submission_state,
        conversation.assigned_staff_name,
        conversation.service_request_id,
        conversation.ai_summary || intake.description,
        conversation.created_at,
        conversation.updated_at,
      ];
    });
    const csv = `\uFEFF${[headers, ...data].map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `acapolite-whatsapp-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`${rows.length} client record${rows.length === 1 ? "" : "s"} exported for Excel`);
  };

  const deleteSelectedLeads = async () => {
    if (!session?.access_token || selectedVisibleLeadIds.size === 0) return;
    const selectedIds = [...selectedVisibleLeadIds];
    const count = selectedIds.length;
    const confirmed = window.confirm(`Permanently delete ${count} selected WhatsApp client record${count === 1 ? "" : "s"}, including chat messages and stored attachments? Linked service requests will be preserved.`);
    if (!confirmed) return;
    setActionPending(true);
    try {
      const response = await fetch(QA_FEED_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_conversations", conversation_ids: selectedIds }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `Deletion failed (${response.status})`);
      setSelectedLeadIds(new Set());
      setSelectedId(null);
      toast.success(`${payload.deleted || count} client record${(payload.deleted || count) === 1 ? "" : "s"} deleted`);
      if (payload.attachment_cleanup_warning) toast.warning(payload.attachment_cleanup_warning);
      await query.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete the selected records");
    } finally {
      setActionPending(false);
    }
  };

  const operationalAlertsCard = (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3 text-base">
          <span className="flex items-center gap-2"><Bell className="h-4 w-4" />Operational alerts</span>
          <Badge variant={alerts.some((alert) => alert.severity === "critical") ? "destructive" : "secondary"}>{alerts.length} open</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className={alerts.length === 0 ? "px-4 pb-4" : "max-h-56 space-y-2 overflow-y-auto px-4 pb-4"}>
        {alerts.length === 0 ? <p className="rounded-lg border border-dashed bg-muted/20 px-4 py-4 text-center text-xs text-muted-foreground">No open WhatsApp alerts.</p> : alerts.map((alert) => (
          <button key={alert.id} type="button" onClick={() => openConversation(alert.conversation_id, "overview")} className={`w-full rounded-lg border p-3 text-left ${alert.severity === "critical" ? "border-red-200 bg-red-50/60" : alert.severity === "warning" ? "border-amber-200 bg-amber-50/60" : "bg-muted/20"}`}>
            <div className="flex items-start justify-between gap-2"><p className="text-sm font-medium">{alert.title}</p><span className="shrink-0 text-[10px] text-muted-foreground">{new Date(alert.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></div>
            {alert.body ? <p className="mt-1 text-xs text-muted-foreground">{alert.body}</p> : null}
          </button>
        ))}
      </CardContent>
    </Card>
  );

  const humanChatReportingCard = (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><BarChart3 className="h-4 w-4" />Human chat reporting</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className={`rounded-lg border p-3 text-left ${filterCardClass("needs_response")}`} onClick={() => toggleQueueFilter("needs_response")} aria-pressed={queueFilter === "needs_response"}><p className="text-[11px] text-muted-foreground">Needs response</p><p className="mt-1 text-xl font-semibold">{totals.needsResponse}</p></button>
          <button type="button" className={`rounded-lg border p-3 text-left ${filterCardClass("human")}`} onClick={() => toggleQueueFilter("human")} aria-pressed={queueFilter === "human"}><p className="text-[11px] text-muted-foreground">Avg response</p><p className="mt-1 text-xl font-semibold">{reports.averageFirstResponse === null ? "—" : `${reports.averageFirstResponse} min`}</p></button>
          <button type="button" className={`rounded-lg border p-3 text-left ${filterCardClass("unassigned")}`} onClick={() => toggleQueueFilter("unassigned")} aria-pressed={queueFilter === "unassigned"}><p className="text-[11px] text-muted-foreground">Unassigned</p><p className="mt-1 text-xl font-semibold">{totals.unassigned}</p></button>
          <button type="button" className={`rounded-lg border p-3 text-left ${filterCardClass("converted")}`} onClick={() => toggleQueueFilter("converted")} aria-pressed={queueFilter === "converted"}><p className="text-[11px] text-muted-foreground">Lead conversion</p><p className="mt-1 text-xl font-semibold">{reports.conversionRate}%</p><p className="text-[10px] text-muted-foreground">{reports.converted} requests</p></button>
        </div>
        <div className="rounded-lg border bg-muted/20 p-3">
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lead funnel</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {leadFunnel.map((item) => (
              <button key={item.label} type="button" onClick={() => setConversationQueueFilter(item.filter)} className={`min-w-0 rounded-lg border bg-background p-3 text-left transition-colors hover:border-primary/50 ${queueFilter === item.filter ? "border-primary ring-1 ring-primary" : ""}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 text-[11px] text-muted-foreground">{item.label}</span>
                  <span className="text-[11px] font-semibold">{item.percent}%</span>
                </div>
                <p className="mt-1 text-xl font-semibold">{item.count}</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, item.percent)}%` }} />
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
          <div><p className="mb-2 text-xs font-semibold">Handoffs by day</p>{reports.byDay.length ? reports.byDay.map(([day, count]) => <div key={day} className="flex justify-between border-b py-1.5 text-xs"><span>{day}</span><span className="font-medium">{count}</span></div>) : <p className="text-xs text-muted-foreground">No handoffs yet.</p>}</div>
          <div><p className="mb-2 text-xs font-semibold">Common services</p>{reports.services.map(([service, count]) => <div key={service} className="flex justify-between gap-3 border-b py-1.5 text-xs"><span className="truncate capitalize">{service}</span><span className="font-medium">{count}</span></div>)}</div>
          <div><p className="mb-2 text-xs font-semibold">Admin responses</p>{reports.staff.length ? reports.staff.map((stat) => <div key={stat.name} className="border-b py-1.5 text-xs"><div className="flex justify-between gap-3"><span className="truncate">{stat.name}</span><span className="font-medium">{stat.replies}</span></div><p className="text-[10px] text-muted-foreground">{stat.conversations} chats</p></div>) : <p className="text-xs text-muted-foreground">No staff replies yet.</p>}</div>
        </div>
      </CardContent>
    </Card>
  );

  const renderConversationActions = () => {
    if (!selected) {
      return <p className="rounded-lg border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">Select a conversation to manage the chat.</p>;
    }

    const requiredChecks = selectedLeadQuality?.checks.filter((check) => check.required) ?? [];
    const passedRequired = requiredChecks.filter((check) => check.passed).length;

    return (
      <div className="space-y-3">
        {selectedLeadQuality ? (
          <button type="button" onClick={() => setReviewTab("overview")} className={`w-full rounded-lg border p-3 text-left transition-colors hover:border-primary/50 ${getWhatsAppLeadQualityCardClass(selectedLeadQuality.status)}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Lead quality</p>
                <p className="mt-1 text-sm font-semibold">{selectedLeadQuality.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{selectedLeadQuality.nextAction}</p>
                {selectedLeadGate ? (
                  <p className="mt-1 text-xs font-medium">
                    {selected.conversation.service_request_id
                      ? "Linked to Service Request."
                      : selectedLeadGate.qualityStatus === "ready"
                        ? "Ready to send for admin review."
                        : selectedLeadGate.qualityStatus === "needs_info"
                          ? "Hold until missing details are collected."
                          : "Parked for staff review."}
                  </p>
                ) : null}
              </div>
              <div className="flex max-w-[45%] flex-col items-end gap-1">
                <Badge variant="outline" className={`whitespace-nowrap ${getWhatsAppLeadQualityBadgeClass(selectedLeadQuality.status)}`}>{selectedLeadQuality.score}%</Badge>
                {selectedLeadGate ? <Badge variant="outline" className="w-full justify-center whitespace-normal break-words bg-background/80 text-center text-[10px] leading-snug">{selectedLeadGate.label}</Badge> : null}
              </div>
            </div>
            {selectedLeadQuality.followUpFields.length ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {selectedLeadQuality.followUpFields.slice(0, 5).map((field) => (
                  <Badge key={field} variant="outline" className="bg-background/80 text-[10px]">
                    {formatWhatsAppMissingFieldLabel(field)}
                  </Badge>
                ))}
              </div>
            ) : null}
          </button>
        ) : null}

        {selectedLeadQuality && selectedSla && selectedDelivery ? (
          <div className="rounded-lg border bg-muted/20 p-3 text-sm">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Quick status</p>
            <div className="divide-y rounded-md border bg-background">
              <button type="button" onClick={() => setReviewTab("client")} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-muted/40">
                <span className="flex min-w-0 items-center gap-2 text-muted-foreground"><ClipboardList className="h-3.5 w-3.5" />Intake</span>
                <span className="shrink-0 font-semibold">{passedRequired}/{requiredChecks.length} required</span>
              </button>
              <button type="button" onClick={() => setReviewTab("analysis")} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-muted/40">
                <span className="flex min-w-0 items-center gap-2 text-muted-foreground"><Timer className="h-3.5 w-3.5" />SLA</span>
                <span className={`shrink-0 font-semibold ${selectedSla.status === "overdue" ? "text-red-700" : selectedSla.status === "due_soon" ? "text-amber-700" : "text-emerald-700"}`}>{selectedSla.label}</span>
              </button>
              <button type="button" onClick={() => setReviewTab("analysis")} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-muted/40">
                <span className="flex min-w-0 items-center gap-2 text-muted-foreground"><CheckCircle2 className="h-3.5 w-3.5" />Delivery</span>
                <span className={`shrink-0 font-semibold ${selectedDelivery.failed ? "text-red-700" : "text-emerald-700"}`}>
                  {selectedDelivery.failed ? `${selectedDelivery.failed} failed` : `${selectedDelivery.delivered}/${selectedDelivery.outbound} delivered`}
                </span>
              </button>
              <button type="button" onClick={() => setReviewTab("crm")} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-muted/40">
                <span className="flex min-w-0 items-center gap-2 text-muted-foreground"><Link2 className="h-3.5 w-3.5" />CRM</span>
                <span className={`shrink-0 font-semibold ${linkedClientMatch || bestClientMatch ? "text-sky-800" : ""}`}>{linkedClientMatch ? "Linked" : bestClientMatch ? "Match found" : "No match"}</span>
              </button>
              <button type="button" onClick={() => setReviewTab("team")} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-muted/40">
                <span className="flex min-w-0 items-center gap-2 text-muted-foreground"><StickyNote className="h-3.5 w-3.5" />Team notes</span>
                <span className="shrink-0 font-semibold">{selectedNotes.length}</span>
              </button>
            </div>
          </div>
        ) : null}

        <div className="grid gap-2">
          <Select
            value={selected.conversation.assigned_staff_id || "unassigned"}
            onValueChange={(staffId) => staffId !== "unassigned" && runAction("assign", { staff_id: staffId })}
            disabled={actionPending}
          >
            <SelectTrigger><SelectValue placeholder="Assign to staff" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned" disabled>Assign to staff</SelectItem>
              {staff.map((person) => <SelectItem key={person.id} value={person.id}>{staffLabel(person)}</SelectItem>)}
            </SelectContent>
          </Select>
          {selected.conversation.ai_enabled ? (
            <Button className={QA_ACTION_BUTTON_CLASS} variant="outline" onClick={() => query.data?.currentStaff && runAction("assign", { staff_id: query.data.currentStaff.id })} disabled={actionPending || !query.data?.currentStaff}>
              <UserRoundCheck className="h-4 w-4" /><span>Take over</span>
            </Button>
          ) : (
            <Button className={QA_ACTION_BUTTON_CLASS} variant="outline" onClick={() => window.confirm("Return this chat to AI? Staff replies will stop controlling the conversation.") && runAction("return_to_ai")} disabled={actionPending}>
              <Bot className="h-4 w-4" /><span>Return to AI</span>
            </Button>
          )}
        </div>

        <div className="grid gap-2">
          <Button className={QA_ACTION_BUTTON_CLASS} size="sm" variant="outline" onClick={draftMissingInfoReply} disabled={actionPending || !selectedLeadQuality?.followUpFields.length}>
            <MessageCircle className="h-4 w-4" /><span>Ask missing info</span>
          </Button>
          <Button
            className={QA_ACTION_BUTTON_CLASS}
            size="sm"
            variant={selected.conversation.service_request_id ? "outline" : "default"}
            onClick={() => selected.conversation.service_request_id ? openLead(selected.conversation.service_request_id) : void sendSelectedToLeads()}
            disabled={actionPending}
          >
            {selected.conversation.service_request_id ? <ExternalLink className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
            <span>{selected.conversation.service_request_id ? "Open request" : leadGateActionLabel(selectedLeadGate)}</span>
          </Button>
          {selected.conversation.unread_count > 0 ? (
            <Button className={QA_ACTION_BUTTON_CLASS} size="sm" variant="outline" onClick={() => runAction("mark_read")} disabled={actionPending || !query.data?.inboxReady} title={query.data?.inboxReady ? undefined : "Requires the WhatsApp backend upgrade"}>
              <CheckCircle2 className="h-4 w-4" /><span>Mark read</span>
            </Button>
          ) : null}
          {selected.conversation.inbox_status === "resolved" ? (
            <Button className={QA_ACTION_BUTTON_CLASS} size="sm" variant="outline" onClick={() => runAction("reopen")} disabled={actionPending || !query.data?.inboxReady}>
              <RefreshCw className="h-4 w-4" /><span>Reopen chat</span>
            </Button>
          ) : (
            <Button className={QA_ACTION_BUTTON_CLASS} size="sm" variant="outline" onClick={() => window.confirm("Mark this human chat as resolved? AI will remain silent.") && runAction("resolve")} disabled={actionPending || selected.conversation.ai_enabled || !query.data?.inboxReady}>
              <CheckCircle2 className="h-4 w-4" /><span>Resolve</span>
            </Button>
          )}
        </div>

        {!query.data?.inboxReady ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Inbox read and resolution controls are waiting for the WhatsApp backend upgrade.
          </div>
        ) : null}

        <div className={`rounded-lg border px-3 py-2 text-xs ${selected.conversation.ai_enabled ? "border-amber-200 bg-amber-50 text-amber-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
          {selected.conversation.ai_enabled
            ? "AI is active. Take over or assign the chat before replying."
            : `Human control is active${selected.conversation.assigned_staff_name ? `, assigned to ${selected.conversation.assigned_staff_name}` : ""}. AI replies are locked.`}
        </div>

        {selectedReplyTemplates.length ? (
          <div className="rounded-lg border bg-muted/20 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Recommended replies</p>
              <Badge variant="outline" className="bg-background text-[10px]">Templates</Badge>
            </div>
            <div className="grid gap-2">
              {selectedReplyTemplates.map((template) => (
                <button
                  key={template.value}
                  type="button"
                  onClick={() => applyReplyTemplate(template.value)}
                  className={`rounded-lg border bg-background p-3 text-left transition-colors hover:border-primary/50 ${replyTemplate === template.value ? "border-primary ring-1 ring-primary" : ""}`}
                  disabled={actionPending}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{template.label}</span>
                    <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{template.detail}</p>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid gap-2">
          <Select value={replyTemplate} onValueChange={(value) => setReplyTemplate(value as ReplyTemplateKey)}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Choose reply template" />
            </SelectTrigger>
            <SelectContent>
              {REPLY_TEMPLATES.map((template) => (
                <SelectItem key={template.value} value={template.value}>{template.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" className={QA_ACTION_BUTTON_CLASS} variant="outline" onClick={() => applyReplyTemplate()} disabled={actionPending}>
            <Copy className="h-4 w-4" />
            <span>Use template</span>
          </Button>
        </div>
      </div>
    );
  };

  const platformTabs: Array<{ key: WhatsAppPlatformTab; label: string; detail: string; icon: typeof MessageCircle; count?: number }> = [
    { key: "inbox", label: "Inbox", detail: "Live chats", icon: MessageCircle, count: totals.conversations },
    { key: "leads", label: "Leads", detail: "Intake quality", icon: ClipboardList, count: totals.qualityLeads },
    { key: "ai", label: "AI Control", detail: "Handoff and replies", icon: Bot, count: totals.human },
    { key: "reports", label: "Reports", detail: "Performance", icon: BarChart3, count: reports.converted },
    { key: "settings", label: "Settings", detail: "Templates and rules", icon: Settings },
  ];

  const selectPlatformTab = (tab: WhatsAppPlatformTab) => {
    setPlatformTab(tab);
    if (tab === "ai") setConversationSearch("");
    if (tab === "leads") setLeadSearch("");
    if (tab === "inbox") setMobileWorkspaceView("conversations");

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("section", tab);
    setSearchParams(nextParams, { replace: true });
  };

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-4 px-4 py-5 md:px-5 md:py-6 lg:overflow-hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">WhatsApp QA</h1>
          <p className="text-sm text-muted-foreground">WhatsApp inbox, lead intake, AI handoff, reporting, and operating controls.</p>
        </div>
        <Button variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}>
          <RefreshCw className={`mr-2 h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} />
          Refresh WhatsApp data
        </Button>
      </div>

        <main className="min-h-0 flex flex-1 flex-col gap-4 overflow-hidden">
          <div className="flex shrink-0 gap-2 overflow-x-auto pb-1 lg:hidden">
            {platformTabs.map((tab) => {
              const Icon = tab.icon;
              const active = platformTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => selectPlatformTab(tab.key)}
                  className={`flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${active ? "border-primary bg-primary text-primary-foreground" : "bg-background"}`}
                  aria-pressed={active}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                  {typeof tab.count === "number" ? <span className="text-xs opacity-80">{tab.count}</span> : null}
                </button>
              );
            })}
          </div>

      {platformTab === "inbox" ? (
      <div className="hidden grid-cols-2 gap-3 sm:grid-cols-3 lg:grid lg:grid-cols-4 xl:grid-cols-7">
        <button type="button" className="text-left" onClick={() => setConversationQueueFilter("all")} aria-pressed={queueFilter === "all"}>
          <Card className={filterCardClass("all")}><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Conversations</CardTitle></CardHeader><CardContent className="text-3xl font-semibold">{totals.conversations}</CardContent></Card>
        </button>
        <button type="button" className="text-left" onClick={() => toggleQueueFilter("human")} aria-pressed={queueFilter === "human"}>
          <Card className={filterCardClass("human")}><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Human chats</CardTitle></CardHeader><CardContent className="flex items-center gap-2 text-3xl font-semibold text-primary"><Headphones className="h-6 w-6" />{totals.human}<span className="ml-auto text-xs font-normal text-muted-foreground">{totals.unassigned} unassigned</span></CardContent></Card>
        </button>
        <button type="button" className="text-left" onClick={() => toggleQueueFilter("unread")} aria-pressed={queueFilter === "unread"}>
          <Card className={filterCardClass("unread")}><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Unread messages</CardTitle></CardHeader><CardContent className="flex items-center gap-2 text-3xl font-semibold"><Bell className="h-6 w-6 text-amber-600" />{totals.unread}</CardContent></Card>
        </button>
        <button type="button" className="text-left" onClick={() => toggleQueueFilter("needs_info")} aria-pressed={queueFilter === "needs_info"}>
          <Card className={filterCardClass("needs_info")}><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Needs info</CardTitle></CardHeader><CardContent className="flex items-center gap-2 text-3xl font-semibold text-amber-700"><Clock3 className="h-6 w-6" />{totals.needsInfo}</CardContent></Card>
        </button>
        <button type="button" className="text-left" onClick={() => toggleQueueFilter("ready_leads")} aria-pressed={queueFilter === "ready_leads"}>
          <Card className={filterCardClass("ready_leads")}><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Quality leads</CardTitle></CardHeader><CardContent className="flex items-center gap-2 text-3xl font-semibold text-emerald-700"><CheckCircle2 className="h-6 w-6" />{totals.qualityLeads}</CardContent></Card>
        </button>
        <button type="button" className="text-left" onClick={() => toggleQueueFilter("passed")} aria-pressed={queueFilter === "passed"}>
          <Card className={filterCardClass("passed")}><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Passed QA</CardTitle></CardHeader><CardContent className="flex items-center gap-2 text-3xl font-semibold text-emerald-700"><CheckCircle2 className="h-6 w-6" />{totals.passed}</CardContent></Card>
        </button>
        <button type="button" className="text-left" onClick={() => toggleQueueFilter("failed")} aria-pressed={queueFilter === "failed"}>
          <Card className={filterCardClass("failed")}><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Critical failures</CardTitle></CardHeader><CardContent className="flex items-center gap-2 text-3xl font-semibold text-destructive"><XCircle className="h-6 w-6" />{totals.failed}</CardContent></Card>
        </button>
      </div>
      ) : null}

      {query.error ? (
        <Card className="border-destructive/40"><CardContent className="flex gap-3 p-5 text-sm text-destructive"><AlertTriangle className="h-5 w-5 shrink-0" /><span>Unable to load WhatsApp QA data. {query.error instanceof Error ? query.error.message : "Please try again."}</span></CardContent></Card>
      ) : null}

      {platformTab === "inbox" ? (
      <div className="min-h-0 space-y-4 md:grid md:flex-1 md:grid-cols-[minmax(220px,32%)_minmax(0,1fr)] md:items-stretch md:gap-4 md:space-y-0 lg:grid-cols-[minmax(210px,22%)_minmax(0,1fr)_minmax(220px,23%)] 2xl:grid-cols-[minmax(300px,22%)_minmax(0,1fr)_minmax(340px,22%)]">
        <div className={`${mobileWorkspaceView === "chat" ? "hidden md:flex" : "flex"} min-w-0 flex-col md:min-h-0`}>
        <Card className="flex min-h-[520px] flex-1 flex-col md:min-h-0">
          <CardHeader className="space-y-3 pb-3"><CardTitle className="flex items-center gap-2 text-base"><MessageCircle className="h-4 w-4" />Conversation results</CardTitle>
            <div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={conversationSearch} onChange={(event) => setConversationSearch(event.target.value)} placeholder="Name or WhatsApp number" className="h-9 pl-8 text-xs" /></div>
            <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 md:grid-cols-1 2xl:grid-cols-2">
              <Select value={queueFilter} onValueChange={(value) => setConversationQueueFilter(value as QueueFilter)}><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All chats</SelectItem><SelectItem value="needs_response">Needs response</SelectItem><SelectItem value="needs_info">Needs info</SelectItem><SelectItem value="ready_leads">Quality leads</SelectItem><SelectItem value="human">Human chats</SelectItem><SelectItem value="new">New</SelectItem><SelectItem value="unassigned">Unassigned</SelectItem><SelectItem value="assigned">Assigned</SelectItem><SelectItem value="waiting">Waiting for client</SelectItem><SelectItem value="resolved">Resolved</SelectItem><SelectItem value="unread">Unread</SelectItem><SelectItem value="mine">Assigned to me</SelectItem><SelectItem value="passed">Passed QA</SelectItem><SelectItem value="failed">Critical failures</SelectItem><SelectItem value="failed_delivery">Failed sends</SelectItem><SelectItem value="converted">Lead created</SelectItem></SelectContent></Select>
              <Select value={conversationSort} onValueChange={(value) => setConversationSort(value as ConversationSort)}><SelectTrigger className="h-9 text-xs"><ArrowUpDown className="mr-1 h-3.5 w-3.5" /><SelectValue /></SelectTrigger><SelectContent><SelectItem value="priority">Urgent first</SelectItem><SelectItem value="newest">Newest</SelectItem><SelectItem value="oldest">Oldest waiting</SelectItem><SelectItem value="name">Name</SelectItem><SelectItem value="messages">Most messages</SelectItem></SelectContent></Select>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SAVED_QUEUE_VIEWS.map((view) => (
                <Button key={view.key} type="button" size="sm" variant={queueFilter === view.filter && conversationSort === view.sort && conversationSearch === (view.search || "") ? "default" : "outline"} className="h-7 rounded-full px-2 text-[10px]" onClick={() => applySavedQueueView(view.key)}>
                  {view.label}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 pb-3">
            {queueFilter !== "all" ? (
              <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs">
                <span>Showing {QUEUE_FILTER_LABELS[queueFilter]}</span>
                <button type="button" className="font-medium text-primary hover:underline" onClick={() => setConversationQueueFilter("all")}>Clear</button>
              </div>
            ) : null}
            {authLoading || query.isLoading ? <p className="py-8 text-center text-sm text-muted-foreground">Evaluating conversations…</p> : null}
            {!authLoading && !query.isLoading && visibleEvaluations.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No matching WhatsApp conversations.</p> : null}
	            {visibleEvaluations.map((evaluation) => {
	              const leadQuality = getConversationLeadQuality(evaluation.conversation, evaluation.messages);
	              const leadGate = getWhatsAppLeadGate(leadQuality);
	              const sla = getConversationSla(evaluation.conversation, evaluation.messages);
	              const latestMessage = evaluation.messages[evaluation.messages.length - 1];
	              const preview = latestMessage?.content?.replace(/\s+/g, " ").trim()
	                || (latestMessage?.attachment_url ? "Attachment received" : "No message preview");
	              return (
	                <button key={evaluation.conversation.id} type="button" onClick={() => openConversation(evaluation.conversation.id, "overview")} className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${selected?.conversation.id === evaluation.conversation.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}>
	                  <div className="flex items-start justify-between gap-2">
	                    <div className="min-w-0">
	                      <p className="truncate text-sm font-medium">{evaluation.conversation.display_name || `+${evaluation.conversation.wa_id}`}</p>
	                      <p className="truncate text-[11px] font-medium text-primary">+{evaluation.conversation.wa_id}</p>
	                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{preview}</p>
	                    </div>
	                    <div className="flex shrink-0 flex-col items-end gap-1">
	                      <div className="flex items-center gap-1">
	                        {evaluation.conversation.unread_count > 0 ? <Badge className="h-5 min-w-5 justify-center rounded-full bg-primary px-1.5 text-[10px]">{evaluation.conversation.unread_count}</Badge> : null}
	                        <Badge variant="outline" className={`h-6 px-2 text-[10px] font-semibold ${getWhatsAppLeadQualityBadgeClass(leadQuality.status)}`}>
	                          {leadQuality.score}%
	                        </Badge>
	                      </div>
	                    </div>
	                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Badge variant="outline" className={`h-5 px-1.5 text-[9px] ${getWhatsAppLeadQualityBadgeClass(leadQuality.status)}`}>
                      {leadQuality.label}
                    </Badge>
                    <Badge variant="outline" className="h-5 bg-background/80 px-1.5 text-[9px]">
                      {leadGate.label}
                    </Badge>
                    {["overdue", "due_soon"].includes(sla.status) ? (
                      <Badge variant="outline" className={`h-5 px-1.5 text-[9px] ${slaTone(sla.status)}`}>
                        {sla.label}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-muted-foreground"><span>{evaluation.messages.length} messages · {new Date(evaluation.conversation.updated_at).toLocaleDateString()}</span><div className="flex gap-1">{evaluation.conversation.priority_level !== "normal" ? <Badge variant="destructive" className="h-5 px-1.5 text-[9px]">{evaluation.conversation.priority_level}</Badge> : null}<Badge variant="outline" className="h-5 px-1.5 text-[9px] capitalize">{evaluation.conversation.inbox_status.replace(/_/g, " ")}</Badge></div></div>
                </button>
              );
            })}
          </CardContent>
        </Card>
        </div>

        <Card className={`${mobileWorkspaceView === "chat" ? "flex" : "hidden md:flex"} min-w-0 flex-col md:min-h-0`}>
          <CardHeader className="shrink-0 border-b">
            <Button type="button" variant="ghost" size="sm" className="w-fit px-0 md:hidden" onClick={() => setMobileWorkspaceView("conversations")}>
              <ArrowLeft className="mr-2 h-4 w-4" />Back to conversations
            </Button>
            <CardTitle className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2"><MessageCircle className="h-5 w-5 shrink-0" /><span className="truncate">Conversation</span></span>
              {selected ? <span className="shrink-0">{statusBadge(selected.status)}</span> : null}
            </CardTitle>
            {selected ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>{selected.conversation.display_name || selected.conversation.wa_id}</span>
                <span>{selected.messages.length} messages</span>
                <span>{new Date(selected.conversation.updated_at).toLocaleString()}</span>
              </div>
            ) : null}
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col p-0">
            {!selected ? (
              <p className="px-6 py-12 text-center text-sm text-muted-foreground">Select a conversation to read its transcript.</p>
            ) : selected.messages.length === 0 ? (
              <p className="px-6 py-12 text-center text-sm text-muted-foreground">No messages were recorded for this conversation.</p>
            ) : (
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-muted/20 p-4 md:p-5">
                {selected.messages.map((message) => {
                  const customer = message.direction === "inbound";
                  const sender = customer
                    ? "Customer"
                    : message.sender_type === "staff"
                      ? message.staff_sender_name || "Acapolite staff"
                      : message.sender_type === "system"
                        ? "Acapolite system"
                        : "Acapolite assistant";
                  return (
                    <div key={message.id} className={`flex ${customer ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[88%] ${customer ? "text-right" : "text-left"}`}>
                        <div className="mb-1 flex items-center gap-2 text-[11px] text-muted-foreground" style={{ justifyContent: customer ? "flex-end" : "flex-start" }}>
                          <span className="font-medium">{sender}</span>
                          <span>{new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                        <div className={`space-y-3 whitespace-pre-wrap rounded-2xl px-4 py-3 text-left text-sm leading-relaxed shadow-sm ${customer ? "rounded-br-md bg-emerald-700 text-white" : "rounded-bl-md border bg-background text-foreground"}`}>
                          {message.attachment_url ? (
                            <div className="overflow-hidden rounded-xl border border-white/20 bg-background/95 text-foreground">
                              {message.media_mime_type?.startsWith("image/") ? (
                                <a href={message.attachment_url} target="_blank" rel="noreferrer" className="block">
                                  <img src={message.attachment_url} alt={message.media_filename || "WhatsApp attachment"} className="max-h-72 w-full object-contain" />
                                </a>
                              ) : (
                                <div className="flex items-center gap-3 p-4"><FileText className="h-8 w-8 text-primary" /><div className="min-w-0"><p className="truncate font-medium">{message.media_filename || "Attached document"}</p><p className="text-xs text-muted-foreground">{message.media_mime_type || "Document"} {fileSize(message.media_size_bytes)}</p></div></div>
                              )}
                              <a href={message.attachment_url} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 border-t px-3 py-2 text-xs font-medium text-primary hover:bg-muted/50">
                                {message.media_mime_type?.startsWith("image/") ? <ImageIcon className="h-4 w-4" /> : <Download className="h-4 w-4" />} Open attachment
                              </a>
                            </div>
                          ) : message.message_type === "image" || message.message_type === "document" ? (
                            <div className="flex items-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-xs"><Paperclip className="h-4 w-4" />Attachment link expired. Refresh the conversation.</div>
                          ) : null}
                          {message.content && !/^\[(?:Image|Document) attached\]$/i.test(message.content) ? <div>{message.content}</div> : null}
                          {!customer ? <p className={`text-[10px] ${deliveryTone(message.delivery_status)}`}>{deliveryLabel(message.delivery_status)}</p> : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
	            {selected ? (
	              <div className="shrink-0 space-y-3 border-t bg-background p-4">
	                <details className="rounded-lg border bg-muted/20 p-3 lg:hidden">
	                  <summary className="cursor-pointer text-sm font-semibold">Actions / AI controls</summary>
	                  <div className="mt-3">{renderConversationActions()}</div>
	                </details>

	                <Textarea
	                  value={reply}
	                  onChange={(event) => setReply(event.target.value)}
	                  placeholder="Write a WhatsApp reply..."
	                  maxLength={1000}
	                  rows={3}
	                  disabled={selected.conversation.ai_enabled || actionPending}
	                />
	                <div className="grid gap-2">
	                  <p className="text-xs text-muted-foreground">{reply.length}/1000 · Staff reply</p>
	                  <div className="grid min-w-0 gap-2 min-[420px]:grid-cols-2 md:grid-cols-1 2xl:grid-cols-2">
	                    <Button type="button" className={QA_INLINE_ACTION_BUTTON_CLASS} variant="outline" onClick={draftReengagementReply} disabled={actionPending || !selectedLeadQuality}>
	                      <FileText className="h-4 w-4" /><span>Draft follow-up</span>
	                    </Button>
	                    <Button className={QA_INLINE_ACTION_BUTTON_CLASS} onClick={() => runAction("reply", { message: reply })} disabled={selected.conversation.ai_enabled || actionPending || !reply.trim()}>
	                      <Send className="h-4 w-4" /><span>{selected.conversation.ai_enabled ? "Take over first" : "Send reply"}</span>
	                    </Button>
	                  </div>
	                </div>
	              </div>
	            ) : null}
          </CardContent>
        </Card>

        <div className="hidden min-w-0 flex-col gap-4 overflow-y-auto lg:flex lg:min-h-0">
        <Card className="min-w-0 shrink-0">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><Bot className="h-4 w-4" />Actions / AI controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {renderConversationActions()}
          </CardContent>
        </Card>
        <Card className="min-w-0">
          {!selected ? (
            <CardContent><p className="py-8 text-center text-sm text-muted-foreground">Select a conversation to inspect its details.</p></CardContent>
          ) : (
            <Tabs value={reviewTab} onValueChange={(value) => setReviewTab(value as ReviewTab)}>
              <CardHeader className="border-b pb-0">
                <CardTitle className="flex items-center gap-2 pb-4"><ShieldCheck className="h-5 w-5" />Review</CardTitle>
                <TabsList className="grid h-auto w-full grid-cols-5 rounded-b-none bg-transparent p-0">
                  <TabsTrigger value="overview" className="rounded-b-none border-b-2 border-transparent px-1 py-3 text-xs data-[state=active]:border-primary data-[state=active]:shadow-none">Overview</TabsTrigger>
                  <TabsTrigger value="client" className="rounded-b-none border-b-2 border-transparent px-1 py-3 text-xs data-[state=active]:border-primary data-[state=active]:shadow-none">Client</TabsTrigger>
                  <TabsTrigger value="analysis" className="rounded-b-none border-b-2 border-transparent px-1 py-3 text-xs data-[state=active]:border-primary data-[state=active]:shadow-none">Quality</TabsTrigger>
                  <TabsTrigger value="crm" className="rounded-b-none border-b-2 border-transparent px-1 py-3 text-xs data-[state=active]:border-primary data-[state=active]:shadow-none">CRM</TabsTrigger>
                  <TabsTrigger value="team" className="rounded-b-none border-b-2 border-transparent px-1 py-3 text-xs data-[state=active]:border-primary data-[state=active]:shadow-none">Team</TabsTrigger>
                </TabsList>
              </CardHeader>
              <CardContent className="max-h-[720px] overflow-y-auto pt-4">
                <TabsContent value="overview" className="mt-0 space-y-5">
                  <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/60 p-3"><div className="min-w-0"><p className="truncate font-medium">{selected.conversation.display_name || selected.conversation.wa_id}</p><p className="text-xs text-muted-foreground">{selected.messages.length} messages</p></div><span className="shrink-0">{statusBadge(selected.status)}</span></div>
                  {selectedLeadQuality ? (
                    <div className={`rounded-lg border p-4 ${getWhatsAppLeadQualityCardClass(selectedLeadQuality.status)}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lead quality</p>
                          <p className="mt-1 text-base font-semibold">{selectedLeadQuality.label}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{selectedLeadQuality.description}</p>
                          {selectedLeadGate ? <p className="mt-1 text-sm">{selectedLeadGate.description}</p> : null}
	                      </div>
	                      <span className="shrink-0 text-xl font-semibold">{selectedLeadQuality.score}%</span>
	                    </div>
                      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Why this score?</p>
	                      <div className="mt-3 grid max-h-56 gap-2 overflow-y-auto pr-1 [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
	                        {selectedLeadQuality.checks.map((check) => (
	                          <div key={check.key} className="flex min-h-10 items-center gap-2 rounded-lg border bg-background/70 px-3 py-2 text-xs">
	                            {check.passed ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />}
	                            <span className="min-w-0 flex-1 leading-snug">{check.label}</span>
                              <span className="shrink-0 text-[10px] text-muted-foreground">{check.passed ? `+${check.weight}` : "missing"}</span>
	                          </div>
	                        ))}
	                      </div>
                    </div>
                  ) : null}
                  <div><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Summary</p><p className="max-h-44 overflow-y-auto rounded-lg border bg-muted/20 p-4 text-sm leading-relaxed">{selected.conversation.ai_summary || intakeValue(selected.conversation.intake_payload?.description)}</p></div>
                  <div>
                    <DetailRow label="Conversation status" value={selected.conversation.status.replace(/_/g, " ")} />
                    <DetailRow label="Inbox status" value={selected.conversation.inbox_status.replace(/_/g, " ")} />
                    <DetailRow label="Priority" value={selected.conversation.priority_level} />
                    <DetailRow label="Unread for me" value={selected.conversation.unread_count} />
                    <DetailRow label="AI responding" value={selected.conversation.ai_enabled ? "Yes" : "No"} />
                    <DetailRow label="Submission state" value={selected.conversation.submission_state.replace(/_/g, " ")} />
                    <DetailRow label="Intake complete" value={selected.conversation.intake_ready ? "Yes" : "No"} />
                    <DetailRow label="Missing fields" value={selected.conversation.intake_missing_fields?.length ? selected.conversation.intake_missing_fields.join(", ") : "None"} />
                    <DetailRow label="Human handoff" value={selected.conversation.human_handoff_requested_at ? new Date(selected.conversation.human_handoff_requested_at).toLocaleString() : "Not requested"} />
                    <DetailRow label="Assigned staff" value={selected.conversation.assigned_staff_name || "Unassigned"} />
                    <DetailRow label="Assigned at" value={selected.conversation.assigned_at ? new Date(selected.conversation.assigned_at).toLocaleString() : "—"} />
	                    <DetailRow label="Last staff reply" value={selected.conversation.last_staff_reply_at ? new Date(selected.conversation.last_staff_reply_at).toLocaleString() : "—"} />
	                    <DetailRow label="First staff reply" value={selected.conversation.first_staff_reply_at ? new Date(selected.conversation.first_staff_reply_at).toLocaleString() : "—"} />
	                    <DetailRow label="Resolved" value={selected.conversation.resolved_at ? new Date(selected.conversation.resolved_at).toLocaleString() : "No"} />
	                    <DetailRow
	                      label="Service request"
	                      value={selected.conversation.service_request_id ? (
		                        <button type="button" onClick={() => selected.conversation.service_request_id && openLead(selected.conversation.service_request_id)} className="inline-flex items-center justify-end gap-1 text-primary hover:underline">
		                          Open lead <ExternalLink className="h-3.5 w-3.5" />
		                        </button>
	                      ) : "Not created"}
	                    />
	                    <DetailRow label="Started" value={new Date(selected.conversation.created_at).toLocaleString()} />
	                    <DetailRow label="Last activity" value={new Date(selected.conversation.updated_at).toLocaleString()} />
	                  </div>
                </TabsContent>
                <TabsContent value="client" className="mt-0 space-y-6">
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Selected client</p>
                    <DetailRow label="Full name" value={intakeValue(selected.conversation.intake_payload?.full_name)} />
                    <DetailRow label="WhatsApp name" value={selected.conversation.display_name || "—"} />
                    <DetailRow label="Phone" value={`+${selected.conversation.wa_id}`} />
                    <DetailRow label="Email" value={intakeValue(selected.conversation.intake_payload?.email)} />
                    <DetailRow label="Client type" value={intakeValue(selected.conversation.intake_payload?.client_type)} />
                    <DetailRow label="Company" value={intakeValue(selected.conversation.intake_payload?.company_name)} />
                    <DetailRow label="City" value={intakeValue(selected.conversation.intake_payload?.city)} />
                    <DetailRow label="Province" value={intakeValue(selected.conversation.intake_payload?.province)} />
                    <DetailRow label="Service" value={intakeValue(selected.conversation.intake_payload?.service_needed)} />
                    <DetailRow label="Tax types" value={intakeValue(selected.conversation.intake_payload?.tax_types)} />
                    <DetailRow label="SARS debt" value={selected.conversation.intake_payload?.sars_debt_amount ? `R${intakeValue(selected.conversation.intake_payload.sars_debt_amount)}` : "—"} />
                    <DetailRow label="Enforcement stage" value={intakeValue(selected.conversation.intake_payload?.enforcement_stage)} />
                    <DetailRow label="Urgency" value={intakeValue(selected.conversation.intake_payload?.urgency)} />
                    <DetailRow label="eFiling access" value={intakeValue(selected.conversation.intake_payload?.efiling_access)} />
                    <DetailRow label="Desired outcome" value={intakeValue(selected.conversation.intake_payload?.desired_outcome)} />
                  </div>

                </TabsContent>
                <TabsContent value="crm" className="mt-0 space-y-5">
                  <div className="rounded-xl border bg-muted/20 p-4">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contact profile</p>
                        <p className="mt-1 text-base font-semibold">{selected.conversation.intake_payload?.full_name ? String(selected.conversation.intake_payload.full_name) : selected.conversation.display_name || `+${selected.conversation.wa_id}`}</p>
                      </div>
                      <Badge variant="outline" className={bestClientMatch ? "border-sky-200 bg-sky-50 text-sky-800" : "bg-background"}>
                        {linkedClientMatch ? "Linked" : bestClientMatch ? "Match found" : "No CRM link"}
                      </Badge>
                    </div>
                    <DetailRow label="WhatsApp" value={`+${selected.conversation.wa_id}`} />
                    <DetailRow label="Email" value={intakeValue(selected.conversation.intake_payload?.email)} />
                    <DetailRow label="Company" value={intakeValue(selected.conversation.intake_payload?.company_name)} />
                    <DetailRow label="Location" value={[selected.conversation.intake_payload?.city, selected.conversation.intake_payload?.province].filter(Boolean).join(", ") || "—"} />
                    <DetailRow label="Linked client" value={linkedClientMatch?.label || selected.conversation.linked_client_id || "Not linked"} />
                    <DetailRow label="Linked at" value={formatNullableDate(selected.conversation.linked_client_at)} />
                    <div className={`mt-4 ${QA_NARROW_ACTION_GRID_CLASS}`}>
                      {linkedClientMatch ? (
                        <Button type="button" size="sm" className={QA_ACTION_BUTTON_CLASS} variant="default" onClick={() => openClient(linkedClientMatch.client_id)}>
                          <UserCheck className="h-4 w-4" /><span>Open Client 360</span>
                        </Button>
                      ) : bestClientMatch ? (
                        <Button type="button" size="sm" className={QA_ACTION_BUTTON_CLASS} variant="default" onClick={() => linkClientMatch(bestClientMatch)} disabled={actionPending}>
                          <Link2 className="h-4 w-4" /><span>Link best match</span>
                        </Button>
                      ) : null}
                      {selected.conversation.service_request_id ? (
                        <Button type="button" size="sm" className={QA_ACTION_BUTTON_CLASS} variant="outline" onClick={() => selected.conversation.service_request_id && openLead(selected.conversation.service_request_id)}>
                          <FileText className="h-4 w-4" /><span>Open request</span>
                        </Button>
                      ) : (
                        <Button type="button" size="sm" className={QA_ACTION_BUTTON_CLASS} variant="outline" onClick={() => void sendSelectedToLeads()} disabled={actionPending}>
                          <FileText className="h-4 w-4" /><span>{leadGateActionLabel(selectedLeadGate)}</span>
                        </Button>
                      )}
                      {selected.conversation.linked_client_id ? (
                        <Button type="button" size="sm" className={QA_ACTION_BUTTON_CLASS} variant="outline" onClick={() => runAction("unlink_client")} disabled={actionPending}>
                          <span>Remove link</span>
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Client 360 matches</p>
                      <Badge variant="outline">{selectedClientMatches.length}</Badge>
                    </div>
                    {selectedClientMatches.length ? (
                      <div className="space-y-2">
                        {selectedClientMatches.map((match) => (
                          <div key={`${match.client_id}-${match.profile_id}`} className={`rounded-xl border p-3 ${match.linked || match.client_id === selected.conversation.linked_client_id ? "border-sky-200 bg-sky-50" : "bg-background"}`}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold">{match.label}</p>
                                <p className="truncate text-xs text-muted-foreground">{[match.email, match.phone].filter(Boolean).join(" · ") || "No contact details"}</p>
                                <p className="mt-1 text-xs text-muted-foreground">{match.reason}</p>
                              </div>
                              <Badge variant="outline" className="shrink-0">{match.confidence}%</Badge>
                            </div>
                            <div className={`mt-3 ${QA_NARROW_ACTION_GRID_CLASS}`}>
                              <Button type="button" size="sm" className={QA_ACTION_BUTTON_CLASS} variant="outline" onClick={() => openClient(match.client_id)}>
                                <ExternalLink className="h-4 w-4" /><span>Open</span>
                              </Button>
                              {match.client_id === selected.conversation.linked_client_id || match.linked ? (
                                <Badge variant="outline" className="flex min-h-10 items-center justify-center rounded-md border-sky-200 bg-sky-50 px-3 text-center text-sky-800">Current link</Badge>
                              ) : (
                                <Button type="button" size="sm" className={QA_ACTION_BUTTON_CLASS} variant="default" onClick={() => linkClientMatch(match)} disabled={actionPending}>
                                  <Link2 className="h-4 w-4" /><span>Link</span>
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">No exact CRM match yet. Send the chat to leads, then create or merge the client from the Service Request workflow.</p>
                    )}
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Related Service Requests</p>
                      <Badge variant="outline">{selectedRelatedServiceRequests.length}</Badge>
                    </div>
                    {selectedRelatedServiceRequests.length ? (
                      <div className="space-y-2">
                        {selectedRelatedServiceRequests.map((request) => (
                          <button key={request.id} type="button" onClick={() => openLead(request.id)} className="w-full rounded-xl border bg-background p-3 text-left transition-colors hover:border-primary/50">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold">{request.full_name || request.company_name || "Service request"}</p>
                                <p className="truncate text-xs text-muted-foreground">{request.service_needed ? request.service_needed.replace(/_/g, " ") : "Service not classified"}</p>
                                <p className="mt-1 text-xs text-muted-foreground">{request.reason}</p>
                              </div>
                              <div className="flex shrink-0 flex-col items-end gap-1">
                                <Badge variant="outline">{request.confidence}%</Badge>
                                <Badge variant="outline" className="capitalize">{(request.status || "new").replace(/_/g, " ")}</Badge>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">No related lead records found yet.</p>
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="analysis" className="mt-0 space-y-3">
                  <div className="mb-5 flex items-center justify-between rounded-xl bg-muted/60 p-4"><div><p className="font-medium">Quality score</p><p className="text-xs text-muted-foreground">{selected.passed} of {selected.rules.length} checks passed</p></div><span className="text-3xl font-semibold">{selected.score}%</span></div>
                  {selected.rules.map((rule) => (
                    <div key={rule.key} className={`rounded-xl border p-4 ${rule.passed ? "border-emerald-200 bg-emerald-50/50" : "border-red-200 bg-red-50/60"}`}>
                      <div className="flex items-start gap-3">
                        {rule.passed ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />}
                        <div><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{rule.label}</p>{rule.critical ? <Badge variant="outline" className="text-[10px]">Critical</Badge> : null}</div><p className="mt-1 text-xs text-muted-foreground">{rule.detail}</p></div>
                      </div>
                    </div>
                  ))}
                </TabsContent>
                <TabsContent value="team" className="mt-0 space-y-5">
                  <div className="rounded-xl border bg-muted/20 p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <StickyNote className="h-4 w-4 text-primary" />
                      <p className="text-sm font-semibold">Private team note</p>
                    </div>
                    <Textarea
                      value={internalNote}
                      onChange={(event) => setInternalNote(event.target.value)}
                      placeholder="Add an internal note. This is not sent to WhatsApp."
                      maxLength={2000}
                      rows={3}
                      disabled={actionPending}
                    />
                    <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(140px,auto)] sm:items-center">
                      <p className="text-xs text-muted-foreground">{internalNote.length}/2000</p>
                      <Button type="button" size="sm" className={QA_INLINE_ACTION_BUTTON_CLASS} onClick={saveInternalNote} disabled={actionPending || !internalNote.trim()}>
                        <StickyNote className="h-4 w-4" /><span>Save note</span>
                      </Button>
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notes</p>
                      <Badge variant="outline">{selectedNotes.length}</Badge>
                    </div>
                    {selectedNotes.length ? (
                      <div className="space-y-2">
                        {selectedNotes.map((note) => (
                          <div key={note.id} className="rounded-xl border bg-background p-3">
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-sm font-semibold">{note.author_name}</p>
                              <span className="shrink-0 text-[11px] text-muted-foreground">{formatNullableDate(note.created_at)}</span>
                            </div>
                            <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{note.body}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">No private notes yet.</p>
                    )}
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Action history</p>
                      <Badge variant="outline">{selectedStaffActions.length}</Badge>
                    </div>
                    {selectedStaffActions.length ? (
                      <div className="space-y-2">
                        {selectedStaffActions.map((action) => (
                          <div key={action.id} className="rounded-xl border bg-background p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold">{formatStaffActionLabel(action.action)}</p>
                                <p className="text-xs text-muted-foreground">{action.actor_name}</p>
                              </div>
                              <span className="shrink-0 text-[11px] text-muted-foreground">{formatNullableDate(action.created_at)}</span>
                            </div>
                            {action.details && typeof action.details.preview === "string" ? (
                              <p className="mt-2 rounded-lg bg-muted/40 p-2 text-xs text-muted-foreground">{action.details.preview}</p>
                            ) : null}
                            {action.details && typeof action.details.staff_name === "string" ? (
                              <p className="mt-2 text-xs text-muted-foreground">Staff: {action.details.staff_name}</p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">No staff actions logged yet.</p>
                    )}
                  </div>
                </TabsContent>
              </CardContent>
            </Tabs>
          )}
	        </Card>
	        </div>
      </div>
      ) : null}

      {platformTab === "leads" ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid gap-4 xl:grid-cols-[minmax(340px,0.4fr)_minmax(0,0.6fr)]">
            <Card className="flex min-h-[640px] min-w-0 flex-col overflow-hidden">
              <CardHeader className="space-y-3 pb-3">
                <CardTitle className="flex items-center justify-between gap-3 text-base">
                  <span className="flex items-center gap-2"><ClipboardList className="h-4 w-4" />Lead intake</span>
                  <Badge variant="outline">{filteredLeadEvaluations.length} records</Badge>
                </CardTitle>
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px]">
                  <div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={leadSearch} onChange={(event) => setLeadSearch(event.target.value)} placeholder="Search WhatsApp leads" className="h-9 pl-8 text-xs" /></div>
                  <Select value={leadSort} onValueChange={(value) => setLeadSort(value as LeadSort)}><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="newest">Newest</SelectItem><SelectItem value="oldest">Oldest</SelectItem><SelectItem value="name">Name</SelectItem><SelectItem value="debt">Highest debt</SelectItem></SelectContent></Select>
                </div>
                <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-3">
                  <Checkbox
                    checked={allVisibleLeadsSelected}
                    onCheckedChange={(checked) => setSelectedLeadIds((current) => {
                      if (checked === true) return new Set([...current, ...filteredLeadEvaluations.map((evaluation) => evaluation.conversation.id)]);
                      const next = new Set(current);
                      filteredLeadEvaluations.forEach((evaluation) => next.delete(evaluation.conversation.id));
                      return next;
                    })}
                    aria-label="Select all WhatsApp leads"
                  />
                  <span className="text-sm">Select visible leads</span>
                  <span className="ml-auto rounded-full bg-background px-2 py-1 text-xs font-medium text-muted-foreground">
                    {selectedVisibleLeadCount} selected
                  </span>
                </div>
                <div className="grid gap-2">
                  <Button className={QA_ACTION_BUTTON_CLASS} variant="outline" onClick={exportLeadData} disabled={!filteredLeadEvaluations.length}>
                    <FileSpreadsheet className="h-4 w-4" /><span>{leadExportActionLabel}</span>
                  </Button>
                  <Button className={QA_ACTION_BUTTON_CLASS} variant="destructive" onClick={deleteSelectedLeads} disabled={selectedVisibleLeadCount === 0 || actionPending}>
                    <Trash2 className="h-4 w-4" /><span>{leadDeleteActionLabel}</span>
                  </Button>
                </div>
                <p className="text-[11px] leading-snug text-muted-foreground">Tick boxes for export/delete. Click a card to review the lead details.</p>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-3">
                {filteredLeadEvaluations.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">No WhatsApp leads match this search.</p> : null}
                {filteredLeadEvaluations.map((evaluation) => {
                  const conversation = evaluation.conversation;
                  const leadQuality = getConversationLeadQuality(conversation, evaluation.messages);
                  const leadGate = getWhatsAppLeadGate(leadQuality);
                  return (
                    <div key={conversation.id} className={`flex gap-3 rounded-lg border p-3 ${selected?.conversation.id === conversation.id ? "border-primary bg-primary/5" : "bg-background"}`}>
                      <Checkbox
                        checked={selectedLeadIds.has(conversation.id)}
                        onCheckedChange={(checked) => setSelectedLeadIds((current) => {
                          const next = new Set(current);
                          if (checked) next.add(conversation.id); else next.delete(conversation.id);
                          return next;
                        })}
                        aria-label={`Select ${conversation.display_name || conversation.wa_id}`}
                      />
                      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => inspectConversation(conversation.id, "client")}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{conversation.display_name || intakeValue(conversation.intake_payload?.full_name)}</p>
                            <p className="truncate text-xs text-primary">+{conversation.wa_id}</p>
                          </div>
                          <Badge variant="outline" className={getWhatsAppLeadQualityBadgeClass(leadQuality.status)}>{leadQuality.score}%</Badge>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Badge variant="outline" className={getWhatsAppLeadQualityBadgeClass(leadQuality.status)}>{leadQuality.label}</Badge>
                          <Badge variant="outline" className="bg-background/80">{leadGate.label}</Badge>
                          {conversation.service_request_id ? <Badge variant="outline">Request created</Badge> : null}
                        </div>
                        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{leadQuality.nextAction}</p>
                      </button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <div className="min-w-0 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" />Selected lead</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!selected || !selectedLeadQuality ? (
                    <p className="rounded-lg border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">Choose a WhatsApp lead to review its collected details.</p>
                  ) : (
                    <>
                      <div className={`rounded-lg border p-4 ${getWhatsAppLeadQualityCardClass(selectedLeadQuality.status)}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lead quality</p>
                            <p className="mt-1 text-lg font-semibold">{selectedLeadQuality.label}</p>
                            <p className="mt-1 text-sm text-muted-foreground">{selectedLeadQuality.description}</p>
                          </div>
                          <Badge variant="outline" className={getWhatsAppLeadQualityBadgeClass(selectedLeadQuality.status)}>{selectedLeadQuality.score}%</Badge>
                        </div>
                        {selectedLeadQuality.followUpFields.length ? (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {selectedLeadQuality.followUpFields.map((field) => <Badge key={field} variant="outline" className="bg-background/80">{formatWhatsAppMissingFieldLabel(field)}</Badge>)}
                          </div>
                        ) : null}
                      </div>

                      <div className={QA_NARROW_ACTION_GRID_CLASS}>
                        <Button className={QA_ACTION_BUTTON_CLASS} variant="outline" onClick={draftMissingInfoReply} disabled={actionPending || !selectedLeadQuality.followUpFields.length}>
                          <MessageCircle className="h-4 w-4" /><span>Ask missing info</span>
                        </Button>
                        <Button className={QA_ACTION_BUTTON_CLASS} onClick={() => selected.conversation.service_request_id ? openLead(selected.conversation.service_request_id) : void sendSelectedToLeads()} disabled={actionPending}>
                          {selected.conversation.service_request_id ? <ExternalLink className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                          <span>{selected.conversation.service_request_id ? "Open request" : leadGateActionLabel(selectedLeadGate)}</span>
                        </Button>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <div>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Client data</p>
                          <DetailRow label="Full name" value={intakeValue(selected.conversation.intake_payload?.full_name)} />
                          <DetailRow label="Phone" value={`+${selected.conversation.wa_id}`} />
                          <DetailRow label="Email" value={intakeValue(selected.conversation.intake_payload?.email)} />
                          <DetailRow label="Client type" value={intakeValue(selected.conversation.intake_payload?.client_type)} />
                          <DetailRow label="Company" value={intakeValue(selected.conversation.intake_payload?.company_name)} />
                          <DetailRow label="Location" value={[selected.conversation.intake_payload?.city, selected.conversation.intake_payload?.province].filter(Boolean).join(", ") || "—"} />
                        </div>
                        <div>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tax request</p>
                          <DetailRow label="Service" value={intakeValue(selected.conversation.intake_payload?.service_needed)} />
                          <DetailRow label="Tax types" value={intakeValue(selected.conversation.intake_payload?.tax_types)} />
                          <DetailRow label="SARS debt" value={selected.conversation.intake_payload?.sars_debt_amount ? `R${intakeValue(selected.conversation.intake_payload.sars_debt_amount)}` : "—"} />
                          <DetailRow label="Enforcement" value={intakeValue(selected.conversation.intake_payload?.enforcement_stage)} />
                          <DetailRow label="Urgency" value={intakeValue(selected.conversation.intake_payload?.urgency)} />
                          <DetailRow label="Desired outcome" value={intakeValue(selected.conversation.intake_payload?.desired_outcome)} />
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

            </div>
          </div>
        </div>
      ) : null}

      {platformTab === "ai" ? (
        <div className="min-h-0 flex-1 overflow-hidden">
      <div className="grid h-full min-h-[640px] gap-4 md:grid-cols-[minmax(220px,32%)_minmax(0,1fr)] lg:grid-cols-[minmax(210px,22%)_minmax(0,1fr)_minmax(220px,23%)] 2xl:grid-cols-[minmax(300px,22%)_minmax(0,1fr)_minmax(340px,22%)]">
            <Card className="flex min-w-0 flex-col overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between gap-3 text-base">
                  <span className="flex min-w-0 items-center gap-2"><Headphones className="h-4 w-4" />WhatsApp chats / people</span>
                  <Badge variant="outline">{visibleAiControlEvaluations.length}</Badge>
                </CardTitle>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input value={conversationSearch} onChange={(event) => setConversationSearch(event.target.value)} placeholder="Name or WhatsApp number" className="h-9 pl-8 text-xs" />
                </div>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-3">
                {visibleAiControlEvaluations.length === 0 ? (
                  <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                    <p>{conversationSearch ? "No WhatsApp chats match this search." : "No WhatsApp chats loaded yet."}</p>
                    {conversationSearch ? (
                      <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => setConversationSearch("")}>
                        Clear search
                      </Button>
                    ) : null}
                  </div>
                ) : null}
                {visibleAiControlEvaluations.map((evaluation) => {
                  const leadQuality = getConversationLeadQuality(evaluation.conversation, evaluation.messages);
                  const sla = getConversationSla(evaluation.conversation, evaluation.messages);
                  const latestMessage = evaluation.messages[evaluation.messages.length - 1];
                  const preview = latestMessage?.content?.replace(/\s+/g, " ").trim()
                    || (latestMessage?.attachment_url ? "Attachment received" : "No message preview");
                  const isSelected = selected?.conversation.id === evaluation.conversation.id;

                  return (
                    <button
                      key={evaluation.conversation.id}
                      type="button"
                      onClick={() => inspectConversation(evaluation.conversation.id, "overview")}
                      className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${isSelected ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "bg-background hover:border-primary/50"}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{evaluation.conversation.display_name || `+${evaluation.conversation.wa_id}`}</p>
                          <p className="truncate text-[11px] font-medium text-primary">+{evaluation.conversation.wa_id}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          {evaluation.conversation.unread_count > 0 ? (
                            <Badge className="h-5 min-w-5 justify-center rounded-full bg-primary px-1.5 text-[10px]">{evaluation.conversation.unread_count}</Badge>
                          ) : null}
                          <Badge variant="outline" className={`h-6 px-2 text-[10px] ${getWhatsAppLeadQualityBadgeClass(leadQuality.status)}`}>{leadQuality.score}%</Badge>
                        </div>
                      </div>
                      <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{preview}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Badge variant="outline" className="h-5 bg-background/80 px-1.5 text-[9px]">
                          {evaluation.conversation.ai_enabled ? "AI active" : "Human control"}
                        </Badge>
                        <Badge variant="outline" className={`h-5 px-1.5 text-[9px] ${getWhatsAppLeadQualityBadgeClass(leadQuality.status)}`}>
                          {leadQuality.label}
                        </Badge>
                        {["overdue", "due_soon"].includes(sla.status) ? (
                          <Badge variant="outline" className={`h-5 px-1.5 text-[9px] ${slaTone(sla.status)}`}>{sla.label}</Badge>
                        ) : null}
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                        <span>{evaluation.messages.length} messages</span>
                        <span>{new Date(evaluation.conversation.updated_at).toLocaleDateString()}</span>
                      </div>
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            <Card className="flex min-w-0 flex-col overflow-hidden">
              <CardHeader className="shrink-0 border-b">
                <CardTitle className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2"><MessageCircle className="h-5 w-5 shrink-0" /><span className="truncate">Selected WhatsApp chat</span></span>
                  {selected ? <span className="shrink-0">{statusBadge(selected.status)}</span> : null}
                </CardTitle>
                {selected ? (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{selected.conversation.display_name || selected.conversation.wa_id}</span>
                    <span>{selected.messages.length} messages</span>
                    <span>{new Date(selected.conversation.updated_at).toLocaleString()}</span>
                  </div>
                ) : null}
              </CardHeader>
              <CardContent className="min-h-0 flex-1 overflow-y-auto bg-muted/20 p-4 md:p-5">
                {!selected ? (
                  <p className="rounded-lg border border-dashed bg-background px-4 py-12 text-center text-sm text-muted-foreground">Select a WhatsApp chat to view the transcript.</p>
                ) : selected.messages.length === 0 ? (
                  <p className="rounded-lg border border-dashed bg-background px-4 py-12 text-center text-sm text-muted-foreground">No messages were recorded for this chat.</p>
                ) : (
                  <div className="space-y-4">
                    {selected.messages.map((message) => {
                      const customer = message.direction === "inbound";
                      const sender = customer
                        ? "Customer"
                        : message.sender_type === "staff"
                          ? message.staff_sender_name || "Acapolite staff"
                          : message.sender_type === "system"
                            ? "Acapolite system"
                            : "Acapolite assistant";
                      return (
                        <div key={message.id} className={`flex ${customer ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[88%] ${customer ? "text-right" : "text-left"}`}>
                            <div className="mb-1 flex items-center gap-2 text-[11px] text-muted-foreground" style={{ justifyContent: customer ? "flex-end" : "flex-start" }}>
                              <span className="font-medium">{sender}</span>
                              <span>{new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                            </div>
                            <div className={`space-y-3 whitespace-pre-wrap rounded-2xl px-4 py-3 text-left text-sm leading-relaxed shadow-sm ${customer ? "rounded-br-md bg-emerald-700 text-white" : "rounded-bl-md border bg-background text-foreground"}`}>
                              {message.attachment_url ? (
                                <div className="overflow-hidden rounded-xl border border-white/20 bg-background/95 text-foreground">
                                  {message.media_mime_type?.startsWith("image/") ? (
                                    <a href={message.attachment_url} target="_blank" rel="noreferrer" className="block">
                                      <img src={message.attachment_url} alt={message.media_filename || "WhatsApp attachment"} className="max-h-72 w-full object-contain" />
                                    </a>
                                  ) : (
                                    <div className="flex items-center gap-3 p-4"><FileText className="h-8 w-8 text-primary" /><div className="min-w-0"><p className="truncate font-medium">{message.media_filename || "Attached document"}</p><p className="text-xs text-muted-foreground">{message.media_mime_type || "Document"} {fileSize(message.media_size_bytes)}</p></div></div>
                                  )}
                                  <a href={message.attachment_url} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 border-t px-3 py-2 text-xs font-medium text-primary hover:bg-muted/50">
                                    {message.media_mime_type?.startsWith("image/") ? <ImageIcon className="h-4 w-4" /> : <Download className="h-4 w-4" />} Open attachment
                                  </a>
                                </div>
                              ) : message.message_type === "image" || message.message_type === "document" ? (
                                <div className="flex items-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-xs"><Paperclip className="h-4 w-4" />Attachment link expired. Refresh the conversation.</div>
                              ) : null}
                              {message.content && !/^\[(?:Image|Document) attached\]$/i.test(message.content) ? <div>{message.content}</div> : null}
                              {!customer ? <p className={`text-[10px] ${deliveryTone(message.delivery_status)}`}>{deliveryLabel(message.delivery_status)}</p> : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="min-h-0 min-w-0 space-y-4 overflow-y-auto md:col-span-2 lg:col-span-1">
              <Card className="min-w-0">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base"><Copy className="h-4 w-4" />Reply studio</CardTitle>
                  {selected ? (
                    <p className="text-xs text-muted-foreground">
                      Replying to {selected.conversation.display_name || `+${selected.conversation.wa_id}`}
                    </p>
                  ) : null}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-2">
                    {REPLY_TEMPLATES.map((template) => (
                      <button key={template.value} type="button" onClick={() => applyReplyTemplate(template.value)} className={`rounded-lg border bg-background p-3 text-left transition-colors hover:border-primary/50 ${replyTemplate === template.value ? "border-primary ring-1 ring-primary" : ""}`}>
                        <p className="text-sm font-semibold">{template.label}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{template.detail}</p>
                      </button>
                    ))}
                  </div>
	                  <Textarea value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Write or edit a WhatsApp reply..." maxLength={1000} rows={4} disabled={!selected || selected.conversation.ai_enabled || actionPending} />
	                  <div className="grid gap-2">
	                    <p className="text-xs text-muted-foreground">
	                      {!selected ? "Select a conversation to reply." : `${reply.length}/1000 · Staff reply`}
	                    </p>
	                    <div className="grid min-w-0 gap-2">
	                      <Button type="button" className={QA_INLINE_ACTION_BUTTON_CLASS} variant="outline" onClick={draftReengagementReply} disabled={actionPending || !selectedLeadQuality}>
	                        <FileText className="h-4 w-4" /><span>Draft follow-up</span>
	                      </Button>
	                      <Button className={QA_INLINE_ACTION_BUTTON_CLASS} onClick={() => runAction("reply", { message: reply })} disabled={!selected || selected.conversation.ai_enabled || actionPending || !reply.trim()}>
	                        <Send className="h-4 w-4" /><span>{selected?.conversation.ai_enabled ? "Take over first" : "Send reply"}</span>
	                      </Button>
	                    </div>
	                  </div>
                </CardContent>
              </Card>

              <Card className="min-w-0">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base"><Bot className="h-4 w-4" />Actions / AI controls</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {renderConversationActions()}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      ) : null}

      {platformTab === "reports" ? (
        <div className="min-h-0 flex-1 overflow-y-auto space-y-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(320px,0.38fr)_minmax(0,0.62fr)]">
            {operationalAlertsCard}
            {humanChatReportingCard}
          </div>
        </div>
      ) : null}

      {platformTab === "settings" ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid gap-4 xl:grid-cols-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><Copy className="h-4 w-4" />Reply templates</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {REPLY_TEMPLATES.map((template) => (
                  <button
                    key={template.value}
                    type="button"
                    onClick={() => {
                      applyReplyTemplate(template.value);
                      if (selected && selectedLeadQuality) selectPlatformTab("ai");
                    }}
                    className="w-full rounded-lg border p-3 text-left transition-colors hover:border-primary/50"
                  >
                    <p className="text-sm font-semibold">{template.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{template.detail}</p>
                  </button>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4" />Lead quality score rules</CardTitle>
                <p className="text-xs text-muted-foreground">These numbers are score weights, not chat totals.</p>
              </CardHeader>
              <CardContent className="space-y-2">
                {!selectedLeadQuality ? (
                  <p className="rounded-lg border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground">
                    No chat is selected, so this shows the baseline scoring rules.
                  </p>
                ) : null}
                {displayedLeadQualityChecks.slice(0, 8).map((check) => (
                  <button
                    key={check.key}
                    type="button"
                    onClick={() => {
                      if (!selected) {
                        selectPlatformTab("leads");
                        return;
                      }
                      selectPlatformTab("inbox");
                      setReviewTab("analysis");
                      setMobileWorkspaceView("chat");
                    }}
                    className="flex w-full items-center gap-2 rounded-lg border bg-muted/20 p-3 text-left text-sm transition-colors hover:border-primary/50 hover:bg-background"
                  >
                    {!selectedLeadQuality ? <ShieldCheck className="h-4 w-4 shrink-0 text-primary" /> : check.passed ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />}
                    <span className="min-w-0 flex-1">{check.label}</span>
                    <span className="text-xs text-muted-foreground">{!selectedLeadQuality ? `+${check.weight} pts` : check.passed ? `+${check.weight} pts` : `missing +${check.weight}`}</span>
                  </button>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><Settings className="h-4 w-4" />Workflow status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <button type="button" onClick={() => selectPlatformTab("inbox")} className="w-full rounded-lg border bg-muted/20 p-3 text-left transition-colors hover:border-primary/50 hover:bg-background">
                  <p className="font-semibold">Inbox actions</p>
                  <p className="mt-1 text-xs text-muted-foreground">{query.data?.inboxReady ? "Read and resolution controls are active." : "Read and resolution controls are waiting for the backend upgrade."}</p>
                </button>
                <button type="button" onClick={() => selectPlatformTab("leads")} className="w-full rounded-lg border bg-muted/20 p-3 text-left transition-colors hover:border-primary/50 hover:bg-background">
                  <p className="font-semibold">Lead workflow</p>
                  <p className="mt-1 text-xs text-muted-foreground">WhatsApp intake connects to Service Requests for admin review and marketplace visibility.</p>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!selected) return;
                    openConversation(selected.conversation.id, "overview");
                  }}
                  className="w-full rounded-lg border bg-muted/20 p-3 text-left transition-colors hover:border-primary/50 hover:bg-background disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!selected}
                >
                  <p className="font-semibold">Selected chat</p>
                  <p className="mt-1 text-xs text-muted-foreground">{selected ? selected.conversation.service_request_id ? "Linked to a Service Request." : "Ready to send when lead quality allows." : "No conversation selected."}</p>
                </button>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}
        </main>
    </div>
  );
}
