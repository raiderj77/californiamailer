import { ReserveInterestForm } from '@/components/public/ReserveInterestForm';
import { getPublicPlanningPriceVisibility } from '@/lib/publicPlanningPriceVisibility';

export default async function ReservePage() {
  const priceVisibility = await getPublicPlanningPriceVisibility();
  return <ReserveInterestForm priceVisibility={priceVisibility} />;
}
