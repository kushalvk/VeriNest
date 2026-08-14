import { Link } from 'react-router-dom';
import { HouseArtwork } from './Artwork';
import type { Property } from '../api/propertyApi';

const statusStyles: Record<Property['status'], string> = {
  available: 'bg-green-100 text-green-800',
  occupied: 'bg-line text-ink-muted',
  inactive: 'bg-red-100 text-red-700',
};

interface Props {
  property: Property;
  /** "owner" shows status + management actions; "public" links to detail */
  variant: 'public' | 'owner';
  onEdit?: (p: Property) => void;
  onDelete?: (p: Property) => void;
  onManageImages?: (p: Property) => void;
}

export default function PropertyCard({ property, variant, onEdit, onDelete, onManageImages }: Props) {
  const thumb = property.images?.[0]?.url;
  const body = (
    <div className="flex gap-4">
      <div className="flex h-24 w-32 shrink-0 items-center justify-center overflow-hidden rounded-md bg-canvas">
        {thumb ? (
          <img src={thumb} alt={property.title} className="h-full w-full object-cover" />
        ) : (
          <HouseArtwork className="h-16 w-auto text-ink-faint" title="No photo yet" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate font-semibold text-ink">{property.title}</h3>
          {variant === 'owner' && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusStyles[property.status]}`}>
              {property.status}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-sm font-semibold text-primary-700" data-testid="card-rent">
          Rs. {property.rent.toLocaleString('en-IN')}/month
        </p>
        <p className="mt-0.5 text-sm text-ink-faint">
          {property.address?.city}
          {property.bedrooms != null && ` · ${property.bedrooms} BHK`}
          {property.bathrooms != null && ` · ${property.bathrooms} bath`}
          {property.furnishing && ` · ${property.furnishing}`}
        </p>
      </div>
    </div>
  );

  return (
    <div data-testid="property-card" data-title={property.title}
      className="rounded-lg border border-line bg-surface p-4 transition hover:shadow-sm">
      {variant === 'public' ? (
        <Link to={`/properties/${property._id}`} className="block">{body}</Link>
      ) : (
        <>
          {body}
          <div className="mt-3 flex gap-2 border-t border-line pt-3">
            <button type="button" onClick={() => onEdit?.(property)} data-testid="edit-property"
              className="rounded-md border border-line-strong px-3 py-1.5 text-xs font-medium text-ink-muted hover:bg-surface-muted">
              Edit
            </button>
            <button type="button" onClick={() => onManageImages?.(property)} data-testid="manage-images"
              className="rounded-md border border-line-strong px-3 py-1.5 text-xs font-medium text-ink-muted hover:bg-surface-muted">
              Manage images ({property.images?.length ?? 0})
            </button>
            <Link to={`/properties/${property._id}`}
              className="rounded-md border border-line-strong px-3 py-1.5 text-xs font-medium text-ink-muted hover:bg-surface-muted">
              Public view
            </Link>
            {property.status !== 'inactive' && (
              <button type="button" onClick={() => onDelete?.(property)} data-testid="delete-property"
                className="ml-auto rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">
                Delete
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
