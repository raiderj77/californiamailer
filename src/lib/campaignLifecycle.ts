import type { CampaignStatus } from '@/config/foundingCampaign';

export const CAMPAIGN_TRANSITIONS: Readonly<Record<CampaignStatus, readonly CampaignStatus[]>> = {
  draft: ['pre_launch', 'cancelled'],
  pre_launch: ['accepting_reservations', 'cancelled'],
  accepting_reservations: ['partially_funded', 'fully_funded', 'cancelled', 'refunding'],
  partially_funded: ['accepting_reservations', 'fully_funded', 'cancelled', 'refunding'],
  fully_funded: ['partially_funded', 'proofing', 'cancelled', 'refunding'],
  proofing: ['scheduled_for_print', 'cancelled', 'refunding'],
  scheduled_for_print: ['printed'],
  printed: ['delivered'],
  delivered: ['completed'],
  completed: [],
  cancelled: [],
  refunding: ['cancelled'],
};

export function canTransitionCampaign(from: string, to: string): boolean {
  if (!(from in CAMPAIGN_TRANSITIONS) || !(to in CAMPAIGN_TRANSITIONS)) return false;
  return CAMPAIGN_TRANSITIONS[from as CampaignStatus].includes(to as CampaignStatus);
}

const CREATIVE_INPUT_LOCKED_STATUSES = new Set<CampaignStatus>([
  'printed',
  'delivered',
  'completed',
]);

export function campaignCreativeInputsLocked(status: unknown): boolean {
  return typeof status === 'string'
    && CREATIVE_INPUT_LOCKED_STATUSES.has(status as CampaignStatus);
}
