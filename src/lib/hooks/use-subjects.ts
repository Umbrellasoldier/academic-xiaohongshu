import useSWRImmutable from "swr/immutable";
import type { SubjectData } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useSubjects() {
  const { data, error, isLoading } = useSWRImmutable<{
    subjects: SubjectData[];
  }>("/api/subjects", fetcher);

  return {
    subjects: data?.subjects,
    error,
    isLoading,
  };
}

/** Flatten subjects tree into a single array of all level-1 and level-2 subjects */
export function flattenSubjects(subjects: SubjectData[]): SubjectData[] {
  const result: SubjectData[] = [];
  for (const s of subjects) {
    result.push(s);
    if (s.children) {
      for (const c of s.children) {
        result.push(c);
      }
    }
  }
  return result;
}

/** Find a subject by slug in the tree (checks both level-1 and level-2) */
export function findSubjectBySlug(
  subjects: SubjectData[],
  slug: string
): SubjectData | undefined {
  for (const s of subjects) {
    if (s.slug === slug) return s;
    if (s.children) {
      for (const c of s.children) {
        if (c.slug === slug) return c;
      }
    }
  }
  return undefined;
}

/** Find the parent level-1 subject that owns a given slug */
export function findParentSubject(
  subjects: SubjectData[],
  slug: string
): SubjectData | undefined {
  for (const s of subjects) {
    if (s.slug === slug) return s; // slug IS a level-1
    if (s.children?.some((c) => c.slug === slug)) return s;
  }
  return undefined;
}
