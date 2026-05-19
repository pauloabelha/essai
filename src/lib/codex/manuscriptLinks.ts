import type { ManuscriptSection } from "@/lib/projects/templates";

export function flattenManuscriptSections(
  sections: ManuscriptSection[] = [],
): ManuscriptSection[] {
  return sections.flatMap((section) => [
    section,
    ...flattenManuscriptSections(section.children ?? []),
  ]);
}

export function chapterExists(
  sections: ManuscriptSection[] = [],
  chapterPath: string,
) {
  return flattenManuscriptSections(sections).some(
    (section) => section.path === chapterPath,
  );
}

export function normalizeChapterLinks(chapters: string[] = []) {
  return [...new Set(chapters.map((chapter) => chapter.trim()).filter(Boolean))];
}
