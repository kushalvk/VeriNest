import { client } from './client';

export interface RentalRecord {
  _id: string;
  tenantId: string;
  landlordId: string;
  propertyId: string | { _id: string; title: string; address?: { city?: string } };
  agreementId: string;
  moveInDate?: string;
  moveOutDate?: string;
  rentAmount?: number;
  securityDeposit?: number;
  /** landlord's rating OF the tenant */
  tenantRating?: number;
  /** tenant's rating OF the landlord */
  landlordRating?: number;
  tenantReview?: string;
  landlordReview?: string;
  paymentStatus: 'clear' | 'pending' | 'default';
  createdAt: string;
}

export const getMyRentalHistory = async () => {
  const { data } = await client.get<{ rentalHistory: RentalRecord[] }>(
    '/rental-history/mine',
    { params: { limit: 100 } }
  );
  return data.rentalHistory;
};

export const completeRental = async (id: string, moveOutDate: string) => {
  const { data } = await client.patch<{ rentalHistory: RentalRecord }>(
    `/rental-history/${id}/complete`,
    { moveOutDate }
  );
  return data.rentalHistory;
};

export const submitRating = async (id: string, rating: number, review?: string) => {
  const { data } = await client.patch<{ rentalHistory: RentalRecord }>(
    `/rental-history/${id}/rate`,
    { rating, ...(review?.trim() ? { review: review.trim() } : {}) }
  );
  return data.rentalHistory;
};
