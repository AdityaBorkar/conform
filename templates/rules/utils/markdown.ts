export function hasHeading(content: string, ...titles: string[]): boolean {
  const headingRe = /^#{1,4}\s+(.+)$/gm;
  const matches = [...content.matchAll(headingRe)];
  for (const m of matches) {
    const heading = m[1]?.toLowerCase().trim();
    if (heading && titles.some((t) => heading.includes(t))) {
      return true;
    }
  }
  return false;
}
