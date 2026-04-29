import { describe, expect, it } from 'vitest';
import {
    SearchQuerySchema,
    PositiveIntIdSchema,
    LoginBodySchema,
    RegisterBodySchema,
    ClassChangeLimitSchema,
    MsvSchema,
} from '@/app/api/bff/_utils';

describe('Security validation schemas', () => {
    it('rejects SQL injection patterns in search query', () => {
        const result = SearchQuerySchema.safeParse("' OR 1=1 --");
        expect(result.success).toBe(false);
    });

    it('accepts normal search query', () => {
        const result = SearchQuerySchema.safeParse('lop cntt k66');
        expect(result.success).toBe(true);
    });

    it('rejects invalid positive integer ids', () => {
        expect(PositiveIntIdSchema.safeParse('-1').success).toBe(false);
        expect(PositiveIntIdSchema.safeParse('abc').success).toBe(false);
    });

    it('accepts valid positive integer id', () => {
        const parsed = PositiveIntIdSchema.safeParse('42');
        expect(parsed.success).toBe(true);
        if (parsed.success) {
            expect(parsed.data).toBe(42);
        }
    });

    it('enforces login payload requirements', () => {
        expect(LoginBodySchema.safeParse({ username: '', password: '12345678' }).success).toBe(false);
        expect(LoginBodySchema.safeParse({ username: 'admin', password: '12345678' }).success).toBe(true);
    });

    it('enforces register payload requirements', () => {
        expect(RegisterBodySchema.safeParse({ username: 'u', password: '12345678', age: 17 }).success).toBe(false);
        expect(RegisterBodySchema.safeParse({ username: 'user', password: '12345678', age: 18 }).success).toBe(true);
    });

    it('validates class change limit range', () => {
        expect(ClassChangeLimitSchema.safeParse({ limit: -1 }).success).toBe(false);
        expect(ClassChangeLimitSchema.safeParse({ limit: 100 }).success).toBe(true);
    });

    it('accepts obfuscated student id token format', () => {
        const token = 'T_gAAAAABp8bZ0g1M9I-cV-Fsusfb_ucp0J36MCFk_ruNNQIqKxSxjRj28qkR5cFxOynMKaZF95e9UTGtgxotgtwEZ9vZt0qSy4g';
        expect(MsvSchema.safeParse(token).success).toBe(true);
    });

    it('rejects malformed obfuscated student id token', () => {
        expect(MsvSchema.safeParse('T_invalid$token').success).toBe(false);
    });
});
