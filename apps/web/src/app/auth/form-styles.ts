/** Shared styles for the auth and onboarding forms. */
export const formStyles = `
  h2 { font-size: 24px; font-weight: 600; margin-bottom: 6px; }
  .lead { color: var(--ai-muted); margin: 0 0 24px; }
  form { display: flex; flex-direction: column; gap: 4px; }
  .actions { display: flex; flex-direction: column; gap: 12px; margin-top: 8px; }
  .actions button { height: 44px; }
  .divider { display: flex; align-items: center; gap: 12px; color: var(--ai-muted); font-size: 12px; margin: 8px 0; }
  .divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: var(--ai-border); }
  .switch { margin-top: 24px; font-size: 14px; color: var(--ai-muted); }
  .row { display: flex; justify-content: flex-end; margin: -4px 0 8px; font-size: 13px; }
  .notice { background: var(--ai-primary-soft); border-radius: 8px; padding: 16px; line-height: 1.5; }
`;
