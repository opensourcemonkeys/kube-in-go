import { describe, it, expect, vi, afterEach } from 'vitest';
import { humanAge, absTime } from './time';

// A fixed "now" so the age thresholds are asserted, not the wall clock.
const NOW = new Date('2026-08-02T12:00:00Z');

function at(offsetMs: number): string {
    return new Date(NOW.getTime() - offsetMs).toISOString();
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('humanAge', () => {
    afterEach(() => vi.useRealTimers());

    function freeze() {
        vi.useFakeTimers();
        vi.setSystemTime(NOW);
    }

    it('renders an em dash for missing or unparseable input', () => {
        expect(humanAge(undefined)).toBe('—');
        expect(humanAge('')).toBe('—');
        expect(humanAge('not-a-date')).toBe('—');
    });

    it('steps through seconds, minutes, hours and days', () => {
        freeze();
        expect(humanAge(at(5 * SECOND))).toBe('5s');
        expect(humanAge(at(90 * SECOND))).toBe('1m');
        expect(humanAge(at(3 * HOUR))).toBe('3h');
        expect(humanAge(at(10 * DAY))).toBe('10d');
    });

    it('switches unit exactly at each boundary', () => {
        freeze();
        expect(humanAge(at(59 * SECOND))).toBe('59s');
        expect(humanAge(at(60 * SECOND))).toBe('1m');
        expect(humanAge(at(59 * MINUTE))).toBe('59m');
        expect(humanAge(at(60 * MINUTE))).toBe('1h');
        expect(humanAge(at(23 * HOUR))).toBe('23h');
        expect(humanAge(at(24 * HOUR))).toBe('1d');
    });

    it('clamps future timestamps to zero rather than emitting a negative age', () => {
        // Clock skew between the cluster and the desktop is routine; a pod
        // showing "-3s" old would look like a bug to the user.
        freeze();
        expect(humanAge(new Date(NOW.getTime() + 5 * MINUTE).toISOString())).toBe('0s');
    });
});

describe('absTime', () => {
    it('returns an empty string for missing input', () => {
        expect(absTime(undefined)).toBe('');
        expect(absTime('')).toBe('');
    });

    it('passes unparseable input through untouched', () => {
        expect(absTime('whenever')).toBe('whenever');
    });

    it('formats a valid timestamp', () => {
        const out = absTime('2026-08-02T12:00:00Z');
        expect(out).not.toBe('');
        expect(out).not.toBe('2026-08-02T12:00:00Z');
    });
});
