import { client } from './client';

export interface PropertyAddress {
  addressLine?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

export interface Property {
  _id: string;
  landlordId: string;
  title: string;
  description?: string;
  propertyType?: string;
  rent: number;
  securityDeposit?: number;
  furnishing?: string;
  bedrooms?: number;
  bathrooms?: number;
  area?: number;
  amenities?: string[];
  address: PropertyAddress;
  images?: Array<{ publicId?: string; url?: string }>;
  availability?: string;
  rules?: string[];
  status: 'available' | 'occupied' | 'inactive';
  createdAt: string;
}

export type PropertyInput = Omit<Partial<Property>, '_id' | 'landlordId' | 'status' | 'createdAt'>;

export interface SearchFilters {
  city?: string;
  minRent?: string;
  maxRent?: string;
  bedrooms?: string;
  furnishing?: string;
  propertyType?: string;
  page?: number;
  limit?: number;
}

export interface SearchResult {
  results: Property[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export const createProperty = async (input: PropertyInput) => {
  const { data } = await client.post<{ property: Property }>('/properties', input);
  return data.property;
};

export const updateProperty = async (id: string, input: PropertyInput) => {
  const { data } = await client.put<{ property: Property }>(`/properties/${id}`, input);
  return data.property;
};

/** Soft delete — the backend marks the listing "inactive". */
export const deleteProperty = async (id: string) => {
  const { data } = await client.delete<{ property: Property }>(`/properties/${id}`);
  return data.property;
};

export const uploadPropertyImages = async (id: string, files: File[]) => {
  const form = new FormData();
  files.forEach((f) => form.append('images', f));
  const { data } = await client.post<{ property: Property }>(
    `/properties/${id}/images`,
    form
  );
  return data.property;
};

export const getProperty = async (id: string) => {
  const { data } = await client.get<{ property: Property }>(`/properties/${id}`);
  return data.property;
};

export const searchProperties = async (filters: SearchFilters) => {
  const params: Record<string, string | number> = {};
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params[key] = value;
  });
  const { data } = await client.get<SearchResult>('/properties', { params });
  return data;
};

export const getMyProperties = async () => {
  const { data } = await client.get<{ properties: Property[]; pagination: Pagination }>(
    '/properties/mine',
    { params: { limit: 100 } }
  );
  return data.properties;
};
