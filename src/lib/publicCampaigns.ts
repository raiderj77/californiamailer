'use client';

import { collection, getDocs, query, where } from 'firebase/firestore';
import { clientFirebaseConfigured, db } from '@/lib/firebase';
import type { PublicCampaign } from '@/lib/campaignTypes';

export interface PublicCampaignResult {
  campaigns: PublicCampaign[];
  error: string | null;
}

export async function getPublishedCampaigns(): Promise<PublicCampaignResult> {
  if (!clientFirebaseConfigured()) {
    return { campaigns: [], error: 'Live campaign data is unavailable because the public database connection is not configured. No availability or funding state is being inferred.' };
  }
  try {
    const snapshot = await Promise.race([
      getDocs(query(collection(db, 'publiccampaigns'), where('published', '==', true))),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('campaign-read-timeout')), 5_000)),
    ]);
    return {
      campaigns: snapshot.docs.map((campaign) => ({
        id: campaign.id,
        ...campaign.data(),
      })) as PublicCampaign[],
      error: null,
    };
  } catch {
    return {
      campaigns: [],
      error: 'Live campaign data is unavailable. No availability or funding state is being inferred.',
    };
  }
}
