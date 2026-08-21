export const CRM_PIPELINE_STAGES = [
  {
    id: 'inbound',
    label: 'Inbound',
    description: 'Unpromoted reservation interest or a new lead awaiting owner review.',
  },
  {
    id: 'qualification',
    label: 'Qualification',
    description: 'Research and source verification are still required.',
  },
  {
    id: 'ready',
    label: 'Ready',
    description: 'Qualified for a manual, owner-controlled sales action.',
  },
  {
    id: 'follow_up',
    label: 'Follow-up',
    description: 'A factual next action is due; no automated outreach is implied.',
  },
  {
    id: 'interested',
    label: 'Interested',
    description: 'Interest was recorded, but no reservation or payment is inferred.',
  },
  {
    id: 'reservation',
    label: 'Reservation',
    description: 'System-managed invitation, hold, or pending-payment state.',
  },
  {
    id: 'paid',
    label: 'Paid',
    description: 'Read-only payment-backed stage; CRM actions cannot manufacture it.',
  },
  {
    id: 'renewal',
    label: 'Renewal',
    description: 'A future owner-reviewed renewal opportunity.',
  },
  {
    id: 'closed',
    label: 'Closed',
    description: 'Not interested, poor fit, lost, dismissed, or suppressed.',
  },
] as const;

export type CrmStageId = (typeof CRM_PIPELINE_STAGES)[number]['id'];

export const CRM_NEXT_ACTION_TYPES = [
  { id: 'research', label: 'Research business' },
  { id: 'write_email', label: 'Prepare written outreach' },
  { id: 'prepare_sample', label: 'Prepare private fit preview' },
  { id: 'review_reply', label: 'Review reply' },
  { id: 'prepare_offer', label: 'Prepare offer' },
  { id: 'review_interest', label: 'Review inbound interest' },
  { id: 'verify_payment', label: 'Verify payment state' },
  { id: 'request_materials', label: 'Request creative materials' },
  { id: 'review_proof', label: 'Review proof' },
  { id: 'renewal', label: 'Review renewal' },
  { id: 'other', label: 'Other owner task' },
] as const;

export type CrmNextActionType = (typeof CRM_NEXT_ACTION_TYPES)[number]['id'];

export const CRM_ADDONS = [
  {
    id: 'crm',
    name: 'CRM workspace',
    description: 'Unified owner view over existing prospects, interests, and activities.',
    href: '/crm',
    externalCostNote: 'No external provider is required for the internal record view.',
  },
  {
    id: 'pipeline',
    name: 'Opportunity pipeline',
    description: 'Stage, search, and filter the same source records without copying them.',
    href: '/crm#pipeline',
    externalCostNote: 'No external provider is required for the internal pipeline.',
  },
  {
    id: 'tasks',
    name: 'Next-action tasks',
    description: 'Schedule owner follow-ups directly on prospect records.',
    href: '/crm#tasks',
    externalCostNote: 'No external provider is required for internal tasks.',
  },
  {
    id: 'templates',
    name: 'Written templates',
    description: 'Use reviewed copy in the manual sales desk; sending remains disabled here.',
    href: '/sales-desk',
    externalCostNote: 'An email provider may charge separately only if a future owner-approved send flow is activated.',
  },
  {
    id: 'economics',
    name: 'Economics',
    description: 'Open the existing cost, margin, and print-gate workspace.',
    href: '/economics',
    externalCostNote: 'Printing, postage, payment processing, and supplier charges remain separate.',
  },
  {
    id: 'proofs',
    name: 'Proof workflow',
    description: 'Link to the existing private material and proof ledger.',
    href: '/proof-workflow',
    externalCostNote: 'File storage or design-provider usage may incur separate provider costs.',
  },
  {
    id: 'refunds',
    name: 'Refund review',
    description: 'Link to the existing owner-controlled refund review queue.',
    href: '/refunds',
    externalCostNote: 'Processor fees and refund effects are external costs, not included services.',
  },
  {
    id: 'tracking',
    name: 'Tracking and reports',
    description: 'Link to existing first-party redirect and delivery reporting tools.',
    href: '/tracking',
    externalCostNote: 'Third-party analytics or messaging services, if later connected, bill separately.',
  },
] as const;

export type CrmAddonId = (typeof CRM_ADDONS)[number]['id'];

export const DEFAULT_CRM_ADDON_STATE: Readonly<Record<CrmAddonId, boolean>> = Object.freeze(
  Object.fromEntries(CRM_ADDONS.map((addon) => [addon.id, true])) as Record<CrmAddonId, boolean>,
);

export const CRM_AUTOMATION_POLICY = Object.freeze({
  outboundEmail: 'disabled',
  sms: 'disabled',
  calls: 'disabled',
  voicemail: 'disabled',
  socialMessages: 'disabled',
  openRelay: false,
  clientDirectWrites: false,
  mode: 'manual_owner_only',
} as const);
