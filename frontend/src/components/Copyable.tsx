import { useState } from 'react';

interface CopyableProps {
  value: string;
  display?: string;
  prefix?: string;
  suffix?: string;
}

export function Copyable({ value, display, prefix = '', suffix = '' }: CopyableProps) {
  const [copied, setCopied] = useState(false);
  const text = display ?? value;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <span
      onClick={copy}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && copy()}
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 13,
        color: 'var(--color-accent)',
        cursor: 'pointer',
      }}
    >
      {prefix}{text}{suffix}
      {copied && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--color-success)' }}>✓ Copied</span>}
    </span>
  );
}
