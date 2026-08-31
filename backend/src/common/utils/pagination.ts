/**
 * Pagination parity helper.
 *
 * Drop-in replacement for the inline `const skip = (page - 1) * limit;` +
 * `take: limit` pattern. It reproduces that formula EXACTLY for every input
 * (no clamping of page or limit) so paginated queries keep byte-identical
 * Prisma arguments.
 */
export function computeSkipTake(
  page: number,
  limit: number,
): { skip: number; take: number } {
  return { skip: (page - 1) * limit, take: limit };
}
