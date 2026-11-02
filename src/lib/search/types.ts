/** Response of GET /api/search. */
export interface SearchResults {
  students: { id: string; name: string; studentId: string | null; cohortYear: number | null }[];
  classes: { id: string; code: string; title: string; period: string }[];
  courses: { id: string; code: string; title: string }[];
}
