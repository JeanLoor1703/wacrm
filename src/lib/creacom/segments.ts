import type { Contact, Deal } from '@/types';

export type CampaignSegmentKey =
  | 'buyers_30_days'
  | 'buyers_90_days'
  | 'inactive_buyers_90_days'
  | 'quoted_not_bought'
  | 'buyers_h240'
  | 'buyers_h280'
  | 'by_location'
  | 'recurring_builders'
  | 'lost_by_price'
  | 'follow_up';

export interface SegmentInput {
  contacts: Contact[];
  deals: Deal[];
  now?: Date;
  location?: string;
  priceLossReasonId?: string;
}

export function calculateSegment(
  key: CampaignSegmentKey,
  input: SegmentInput
): Contact[] {
  const now = input.now ?? new Date();
  const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000);
  const byContact = new Map<string, Deal[]>();
  for (const deal of input.deals) {
    if (!deal.contact_id) continue;
    byContact.set(deal.contact_id, [
      ...(byContact.get(deal.contact_id) ?? []),
      deal,
    ]);
  }
  const confirmed = (deal: Deal) =>
    deal.sale_evidence === 'confirmed_sale' && Boolean(deal.sale_date);
  const after = (deal: Deal, date: Date) =>
    confirmed(deal) && new Date(`${deal.sale_date}T12:00:00`) >= date;

  return input.contacts.filter((contact) => {
    const deals = byContact.get(contact.id) ?? [];
    switch (key) {
      case 'buyers_30_days':
        return deals.some((deal) => after(deal, daysAgo(30)));
      case 'buyers_90_days':
        return deals.some((deal) => after(deal, daysAgo(90)));
      case 'inactive_buyers_90_days':
        return (
          deals.some(confirmed) &&
          !deals.some((deal) => after(deal, daysAgo(90)))
        );
      case 'quoted_not_bought':
        return (
          deals.some((deal) => deal.stage?.semantic_key === 'quote_sent') &&
          !deals.some(confirmed)
        );
      case 'buyers_h240':
        return deals.some(
          (deal) => confirmed(deal) && deal.concrete_strength === 'H-240'
        );
      case 'buyers_h280':
        return deals.some(
          (deal) => confirmed(deal) && deal.concrete_strength === 'H-280'
        );
      case 'by_location':
        return (
          Boolean(input.location) &&
          deals.some((deal) =>
            deal.work_location
              ?.toLocaleLowerCase()
              .includes(input.location!.toLocaleLowerCase())
          )
        );
      case 'recurring_builders':
        return deals.filter(confirmed).length >= 2;
      case 'lost_by_price':
        return deals.some(
          (deal) =>
            deal.status === 'lost' &&
            deal.loss_reason_id === input.priceLossReasonId
        );
      case 'follow_up':
        return deals.some((deal) => deal.follow_up_status === 'pending');
    }
  });
}
