import { describe, it, expect } from 'vitest';
import { redact, maskKey } from '@/lib/llm/redact';

describe('redact & maskKey (SPEC §7.1 & AGENTS.md §1.3)', () => {
  describe('maskKey', () => {
    it('returns *** for short or empty keys', () => {
      expect(maskKey('')).toBe('***');
      expect(maskKey('short')).toBe('***');
      expect(maskKey('12345678')).toBe('***');
    });

    it('keeps first 3 and last 4 chars for valid keys', () => {
      // 9 chars: "123456789" -> "123…6789"
      expect(maskKey('123456789')).toBe('123…6789');
      // OpenAI format
      expect(maskKey('sk-proj-1234567890abcdef')).toBe('sk-…cdef');
    });
  });

  describe('redact', () => {
    it('returns empty string for falsy or invalid input', () => {
      expect(redact('')).toBe('');
      // @ts-expect-error - testing invalid runtime input
      expect(redact(null)).toBe('');
      // @ts-expect-error - testing invalid runtime input
      expect(redact(undefined)).toBe('');
    });

    it('redacts OpenAI / Claude sk- keys', () => {
      const raw = 'Error connecting with key sk-12345678901234567890 to API';
      const safe = redact(raw);
      expect(safe).not.toContain('sk-12345678901234567890');
      expect(safe).toContain('sk-…7890');
    });

    it('redacts Google Gemini AIza and AQ. keys', () => {
      const raw =
        'Request to https://gemini.api?key=AIzaSyABCDEF1234567890123456 and AQ.Ab8RN6ABCDEF1234567890 failed';
      const safe = redact(raw);
      expect(safe).not.toContain('AIzaSyABCDEF1234567890123456');
      expect(safe).not.toContain('AQ.Ab8RN6ABCDEF1234567890');
      expect(safe).toContain('AIz…3456');
      expect(safe).toContain('AQ.…7890');
    });

    it('redacts Bearer authorization tokens', () => {
      const raw = 'Headers: Bearer mySecretTokenLongerThanExpected12345';
      const safe = redact(raw);
      expect(safe).not.toContain('mySecretTokenLongerThanExpected12345');
      expect(safe).toContain('Bearer myS…2345');
    });

    it('redacts multiple keys in a single message', () => {
      const raw = 'Old: sk-11112222333344445555, New: sk-99998888777766665555';
      const safe = redact(raw);
      expect(safe).not.toContain('sk-11112222333344445555');
      expect(safe).not.toContain('sk-99998888777766665555');
      expect(safe).toContain('sk-…5555');
    });

    it('leaves text without secrets untouched', () => {
      const normal = 'Normal status update with no tokens: hello world!';
      expect(redact(normal)).toBe(normal);
    });
  });
});
