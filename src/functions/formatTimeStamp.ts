export function formatTimeStamp (time: bigint): string {
    const date = new Date(Number(time) * 1000);
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
}