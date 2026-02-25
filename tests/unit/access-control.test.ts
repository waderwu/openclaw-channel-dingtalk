import { describe, expect, it } from 'vitest';
import { isSenderAllowed, isSenderGroupAllowed, normalizeAllowFrom } from '../../src/access-control';

describe('access-control', () => {
    it('normalizes allowFrom entries and strips dingtalk prefixes', () => {
        const allow = normalizeAllowFrom([' dingtalk:USER_1 ', 'dd:Group_1', '*']);

        expect(allow.entries).toEqual(['USER_1', 'Group_1']);
        expect(allow.entriesLower).toEqual(['user_1', 'group_1']);
        expect(allow.hasWildcard).toBe(true);
        expect(allow.hasEntries).toBe(true);
    });

    it('allows sender by case-insensitive match and wildcard', () => {
        const strictAllow = normalizeAllowFrom(['ding:User_A']);
        const wildcardAllow = normalizeAllowFrom(['*']);

        expect(isSenderAllowed({ allow: strictAllow, senderId: 'user_a' })).toBe(true);
        expect(isSenderAllowed({ allow: strictAllow, senderId: 'other' })).toBe(false);
        expect(isSenderAllowed({ allow: wildcardAllow, senderId: 'whatever' })).toBe(true);
    });

    it('checks group allow list with case-insensitive comparison', () => {
        const allow = normalizeAllowFrom(['cidABC123']);

        expect(isSenderGroupAllowed({ allow, groupId: 'cidabc123', senderId: 'anyone' })).toBe(true);
        expect(isSenderGroupAllowed({ allow, groupId: 'cidzzz', senderId: 'anyone' })).toBe(false);
    });

    describe('groupEntries parsing', () => {
        it('parses composite entry cidABC:user1 into groupEntries', () => {
            const allow = normalizeAllowFrom(['cidABC:user1']);

            expect(allow.groupEntries).toEqual([
                { groupLower: 'cidabc', senderLower: 'user1' },
            ]);
        });

        it('parses pure groupId as backward-compatible groupEntries with senderLower=*', () => {
            const allow = normalizeAllowFrom(['cidABC']);

            expect(allow.groupEntries).toEqual([
                { groupLower: 'cidabc', senderLower: '*' },
            ]);
        });

        it('parses wildcard * as global wildcard groupEntry', () => {
            const allow = normalizeAllowFrom(['*']);

            expect(allow.groupEntries).toEqual([
                { groupLower: '*', senderLower: '*' },
            ]);
        });

        it('parses *:user1 as any-group single-sender entry', () => {
            const allow = normalizeAllowFrom(['*:user1']);

            expect(allow.groupEntries).toEqual([
                { groupLower: '*', senderLower: 'user1' },
            ]);
        });

        it('parses cidABC:* as group-all-senders entry', () => {
            const allow = normalizeAllowFrom(['cidABC:*']);

            expect(allow.groupEntries).toEqual([
                { groupLower: 'cidabc', senderLower: '*' },
            ]);
        });

        it('strips dingtalk: prefix before parsing composite entry', () => {
            const allow = normalizeAllowFrom(['dingtalk:cidABC:user1']);

            expect(allow.groupEntries).toEqual([
                { groupLower: 'cidabc', senderLower: 'user1' },
            ]);
        });

        it('skips malformed entries with empty group or sender', () => {
            const allow = normalizeAllowFrom([':user1', 'cidABC:']);

            expect(allow.groupEntries).toEqual([]);
        });
    });

    describe('isSenderGroupAllowed with composite entries', () => {
        it('matches when both group and sender match', () => {
            const allow = normalizeAllowFrom(['cidABC:user1']);

            expect(isSenderGroupAllowed({ allow, groupId: 'cidABC', senderId: 'user1' })).toBe(true);
        });

        it('rejects when sender does not match', () => {
            const allow = normalizeAllowFrom(['cidABC:user1']);

            expect(isSenderGroupAllowed({ allow, groupId: 'cidABC', senderId: 'user2' })).toBe(false);
        });

        it('rejects when group does not match', () => {
            const allow = normalizeAllowFrom(['cidABC:user1']);

            expect(isSenderGroupAllowed({ allow, groupId: 'cidOTHER', senderId: 'user1' })).toBe(false);
        });

        it('matches case-insensitively for group and sender', () => {
            const allow = normalizeAllowFrom(['CidABC:User1']);

            expect(isSenderGroupAllowed({ allow, groupId: 'cidabc', senderId: 'USER1' })).toBe(true);
        });

        it('global wildcard * matches any group and sender', () => {
            const allow = normalizeAllowFrom(['*']);

            expect(isSenderGroupAllowed({ allow, groupId: 'anyGroup', senderId: 'anyUser' })).toBe(true);
        });

        it('*:user1 matches user1 in any group', () => {
            const allow = normalizeAllowFrom(['*:user1']);

            expect(isSenderGroupAllowed({ allow, groupId: 'groupA', senderId: 'user1' })).toBe(true);
            expect(isSenderGroupAllowed({ allow, groupId: 'groupB', senderId: 'user1' })).toBe(true);
            expect(isSenderGroupAllowed({ allow, groupId: 'groupA', senderId: 'user2' })).toBe(false);
        });

        it('cidABC:* matches any sender in cidABC', () => {
            const allow = normalizeAllowFrom(['cidABC:*']);

            expect(isSenderGroupAllowed({ allow, groupId: 'cidABC', senderId: 'anyone' })).toBe(true);
            expect(isSenderGroupAllowed({ allow, groupId: 'cidOTHER', senderId: 'anyone' })).toBe(false);
        });

        it('returns false when groupId is missing', () => {
            const allow = normalizeAllowFrom(['cidABC:user1']);

            expect(isSenderGroupAllowed({ allow, groupId: undefined, senderId: 'user1' })).toBe(false);
        });

        it('pure groupId entry matches any sender in that group (backward compat)', () => {
            const allow = normalizeAllowFrom(['cidABC']);

            expect(isSenderGroupAllowed({ allow, groupId: 'cidABC', senderId: 'anyUser' })).toBe(true);
            expect(isSenderGroupAllowed({ allow, groupId: 'cidABC' })).toBe(true);
        });
    });

    describe('DM regression — composite entries do not affect isSenderAllowed', () => {
        it('isSenderAllowed does not match composite entry as DM senderId', () => {
            const allow = normalizeAllowFrom(['cidABC:user1']);

            // 'cidabc:user1' is in entriesLower, but a real DM senderId would never be 'cidabc:user1'
            expect(isSenderAllowed({ allow, senderId: 'user1' })).toBe(false);
            expect(isSenderAllowed({ allow, senderId: 'cidABC' })).toBe(false);
        });
    });
});
