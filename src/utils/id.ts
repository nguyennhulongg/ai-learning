export function generateId(): string {
  return Math.random().toString(16).substring(2, 11);
}
