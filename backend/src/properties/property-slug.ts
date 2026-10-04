import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { isUUID } from 'class-validator';

export function propertySlug(name: string) {
  const slug =
    name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'cho-nghi';
  return isUUID(slug) ? `cho-nghi-${slug}` : slug;
}

export function propertyIdFromSlug(slug: string) {
  const separator = slug.lastIndexOf('--');
  const id = separator === -1 ? slug : slug.slice(separator + 2);
  if (
    !isUUID(id) ||
    (separator !== -1 &&
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug.slice(0, separator)))
  ) {
    throw new BadRequestException('Đường dẫn chỗ nghỉ không hợp lệ.');
  }
  return id;
}

export function propertyLookup(
  slug: string,
): { id: string } | { slug: string } {
  if (isUUID(slug) || slug.includes('--')) {
    return { id: propertyIdFromSlug(slug) };
  }
  if (slug.length > 191 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new BadRequestException('Đường dẫn chỗ nghỉ không hợp lệ.');
  }
  return { slug };
}

// The unique index handles both existing names and concurrent host requests.
export async function withPropertySlug<T>(
  name: string,
  save: (slug: string) => Promise<T>,
) {
  const base = propertySlug(name);
  for (let suffix = 1; ; suffix++) {
    const slug = suffix === 1 ? base : `${base}-${suffix}`;
    try {
      return await save(slug);
    } catch (error) {
      const target =
        error instanceof Prisma.PrismaClientKnownRequestError
          ? error.meta?.target
          : undefined;
      const slugConflict = Array.isArray(target)
        ? target.includes('slug')
        : target === 'slug' || target === 'Property_slug_key';
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2002' ||
        !slugConflict
      ) {
        throw error;
      }
    }
  }
}
