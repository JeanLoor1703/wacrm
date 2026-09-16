import type { Deal } from '@/types';

export interface ContactCommercialSummary {
  total: number;
  open: number;
  won: number;
  notConverted: number;
  actualVolumeM3: number;
  soldValues: { currency: string; value: number }[];
  lastSaleDate: string | null;
  nextFollowUpAt: string | null;
}

export function summarizeContactDeals(deals: Deal[]): ContactCommercialSummary {
  const sold = new Map<string, number>();
  let volume = 0;
  let lastSaleDate: string | null = null;
  let nextFollowUpAt: string | null = null;

  for (const deal of deals) {
    if (deal.sale_evidence === 'confirmed_sale') {
      volume += Number(deal.actual_volume_m3 || 0);
      const currency = deal.currency || 'USD';
      sold.set(
        currency,
        (sold.get(currency) || 0) + Number(deal.final_sale_value || 0)
      );
      if (deal.sale_date && (!lastSaleDate || deal.sale_date > lastSaleDate))
        lastSaleDate = deal.sale_date;
    }
    if (
      deal.follow_up_status === 'pending' &&
      deal.next_follow_up_at &&
      (!nextFollowUpAt || deal.next_follow_up_at < nextFollowUpAt)
    ) {
      nextFollowUpAt = deal.next_follow_up_at;
    }
  }

  return {
    total: deals.length,
    open: deals.filter((deal) => deal.status === 'open').length,
    won: deals.filter((deal) => deal.status === 'won').length,
    notConverted: deals.filter((deal) => deal.status === 'lost').length,
    actualVolumeM3: volume,
    soldValues: [...sold].map(([currency, value]) => ({ currency, value })),
    lastSaleDate,
    nextFollowUpAt,
  };
}
