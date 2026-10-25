// Ids never reach the logs (rule: no user ids). Item, trade and user ids
// are all UUIDs, so every UUID in a path or query string becomes `:id`.

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

export function maskIds(url: string): string {
   return url.replace(UUID, ':id');
}
