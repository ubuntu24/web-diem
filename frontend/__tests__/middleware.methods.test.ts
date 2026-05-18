import { describe, expect, it } from 'vitest';
import { resolveAllowedMethods } from '@/proxy';

describe('HTTP method policy', () => {
    it('uses default allow-list on public routes', () => {
        const methods = resolveAllowedMethods('/dashboard');
        expect(methods).toEqual(['GET', 'POST', 'HEAD', 'OPTIONS']);
    });

    it('allows PATCH for profile update endpoint override', () => {
        const methods = resolveAllowedMethods('/api/bff/update-user-profile');
        expect(methods).toContain('PATCH');
    });

    it('allows DELETE for admin ban id endpoint override', () => {
        const methods = resolveAllowedMethods('/api/bff/admin/ban/15');
        expect(methods).toContain('DELETE');
    });

    it('disallows PATCH on generic routes by default', () => {
        const methods = resolveAllowedMethods('/');
        expect(methods).not.toContain('PATCH');
    });
});
