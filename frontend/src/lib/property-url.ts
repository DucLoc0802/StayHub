import type { Property } from './types';

export function propertyPath(property: Pick<Property, 'name' | 'slug'>) {
  const slug =
    property.slug ||
    property.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') ||
    'cho-nghi';
  return `/properties/${slug}`;
}
