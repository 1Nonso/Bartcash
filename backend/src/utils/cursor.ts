// Composite (timestamp, id) cursor. Ids are random v4 UUIDs, so an id-only
// cursor can't follow chronological order.
export function encodeCursor(
   date: Date,
   id: string,
): string {
   return Buffer.from(
      `${date.toISOString()}|${id}`,
   ).toString('base64url');
}

export function decodeCursor(
   cursor: string,
): { date: Date; id: string } | null {
   try {
      const [iso, id] = Buffer.from(
         cursor,
         'base64url',
      )
         .toString()
         .split('|');
      if (!iso || !id) return null;
      const date = new Date(iso);
      if (Number.isNaN(date.getTime()))
         return null;
      return { date, id };
   } catch {
      return null;
   }
}
