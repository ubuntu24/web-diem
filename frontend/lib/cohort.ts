/**
 * Cohort helper to group class names into K16, K17, or Other.
 * 
 * Rules:
 * - Class names containing 16 or 116 (e.g. DHTI16A1, DHTin116A4, DHTI16A2CL) -> K16
 * - Class names containing 17 or 117 (e.g. DHTI17A4, DHTin117A4, DHTin17A1) -> K17
 */

export type CohortType = 'ALL' | 'K16' | 'K17' | 'OTHER';

export function parseCohort(className: string): 'K16' | 'K17' | 'OTHER' {
    if (!className) return 'OTHER';
    const norm = className.trim().toUpperCase();

    // Check for 17 / 117 patterns (e.g. DHTI17A4, DHTin117A4)
    const matches17 = norm.includes('17') || norm.includes('117');
    const matches16 = norm.includes('16') || norm.includes('116');

    if (matches17 && !matches16) return 'K17';
    if (matches16 && !matches17) return 'K16';

    // If both numbers exist, check longer pattern first (117 vs 116)
    if (norm.includes('117')) return 'K17';
    if (norm.includes('116')) return 'K16';
    if (norm.includes('17')) return 'K17';
    if (norm.includes('16')) return 'K16';

    return 'OTHER';
}

export function groupClassesByCohort(classes: string[]): Record<'K16' | 'K17' | 'OTHER', string[]> {
    const result: Record<'K16' | 'K17' | 'OTHER', string[]> = {
        K16: [],
        K17: [],
        OTHER: []
    };

    for (const cls of classes) {
        const cohort = parseCohort(cls);
        result[cohort].push(cls);
    }

    return result;
}
