import { ReserveInterestForm } from '@/components/public/ReserveInterestForm';
import {
  FOUNDING_CAMPAIGN,
  getApprovedCampaignContractVersions,
} from '@/config/foundingCampaign';
import { getPublicPlanningPriceVisibility } from '@/lib/publicPlanningPriceVisibility';

export default async function ReservePage() {
  const priceVisibility = await getPublicPlanningPriceVisibility();
  const approvedContractVersions = getApprovedCampaignContractVersions(FOUNDING_CAMPAIGN);
  return (
    <ReserveInterestForm
      priceVisibility={priceVisibility}
      approvedContractVersions={approvedContractVersions}
    />
  );
}
