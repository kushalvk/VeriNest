import { client } from './client';
import type { Pagination, Property, PropertyVerification } from './propertyApi';

export type AdminPropertyStatus = 'pending' | 'verified' | 'rejected';
export type AdminPropertyCounts = Record<AdminPropertyStatus, number>;

export interface AdminLandlord {
    _id: string;
    fullName?: string;
    email?: string;
}

/** landlordId is populated on the list endpoint, a bare id on the decision response. */
export interface AdminProperty extends Omit<Property, 'landlordId' | 'verification'> {
    landlordId: AdminLandlord | string | null;
    verification: PropertyVerification;
}

export const listAdminProperties = async (
    status: AdminPropertyStatus,
    page = 1,
    limit = 20
) => {
    const { data } = await client.get<{
        properties: AdminProperty[];
        counts: AdminPropertyCounts;
        pagination: Pagination;
    }>('/admin/properties', { params: { status, page, limit } });
    return data;
};

/** remarks is required by the backend when rejecting. */
export const decideProperty = async (
    id: string,
    status: 'verified' | 'rejected',
    remarks?: string
) => {
    const { data } = await client.patch<{ property: AdminProperty }>(
        `/admin/properties/${id}`,
        { status, remarks }
    );
    return data.property;
};