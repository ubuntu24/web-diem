import { describe, it, expect } from 'vitest';
import { parseCohort, groupClassesByCohort } from '../lib/cohort';

describe('parseCohort', () => {
    it('correctly identifies K16 classes', () => {
        expect(parseCohort('DHTI16A1')).toBe('K16');
        expect(parseCohort('DHTin116A1')).toBe('K16');
        expect(parseCohort('DHTI16A2CL')).toBe('K16');
        expect(parseCohort('16A1')).toBe('K16');
    });

    it('correctly identifies K17 classes', () => {
        expect(parseCohort('DHTI17A4')).toBe('K17');
        expect(parseCohort('DHTin117A4')).toBe('K17');
        expect(parseCohort('DHTin17A1')).toBe('K17');
        expect(parseCohort('17A4')).toBe('K17');
    });

    it('handles other class names gracefully', () => {
        expect(parseCohort('DHTI15A1')).toBe('OTHER');
        expect(parseCohort('')).toBe('OTHER');
    });

    it('groups classes by cohort', () => {
        const input = ['DHTI16A1', 'DHTI17A4', 'DHTin117A4', 'DHTin116A1', 'KhacClass'];
        const grouped = groupClassesByCohort(input);
        expect(grouped.K16).toEqual(['DHTI16A1', 'DHTin116A1']);
        expect(grouped.K17).toEqual(['DHTI17A4', 'DHTin117A4']);
        expect(grouped.OTHER).toEqual(['KhacClass']);
    });
});
