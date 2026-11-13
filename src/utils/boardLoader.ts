export interface BoardFileEntry {
  filename: string;
  content: string;
}

const rawBoards = import.meta.glob('../../boards/*.{yaml,yml}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export function getAvailableBoards(): BoardFileEntry[] {
  const entries: BoardFileEntry[] = Object.entries(rawBoards).map(
    ([filePath, content]) => {
      const parts = filePath.split('/');
      const filename = parts[parts.length - 1] || filePath;
      return {
        filename,
        content,
      };
    }
  );

  // Sort alphabetically by filename, keeping board.yaml / board.yml first if present
  entries.sort((a, b) => {
    const aIsDefault = /^board\.ya?ml$/i.test(a.filename);
    const bIsDefault = /^board\.ya?ml$/i.test(b.filename);
    if (aIsDefault && !bIsDefault) return -1;
    if (!aIsDefault && bIsDefault) return 1;
    return a.filename.localeCompare(b.filename);
  });

  return entries;
}
