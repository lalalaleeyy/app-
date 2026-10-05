import React from 'react';

interface EmailPreviewFrameProps {
  html: string;
  title?: string;
  className?: string;
}

/**
 * Renders stored email HTML inside a fully sandboxed iframe (no scripts, no
 * same-origin access), so a malicious or malformed value can never run code
 * in the dashboard's origin.
 */
export const EmailPreviewFrame: React.FC<EmailPreviewFrameProps> = ({
  html,
  title = 'Email preview',
  className = ''
}) => (
  <iframe
    title={title}
    sandbox=""
    referrerPolicy="no-referrer"
    srcDoc={`<!doctype html><html><head><meta charset="utf-8"><base target="_blank"></head><body style="margin:0;padding:16px;background:#fff">${html}</body></html>`}
    className={`w-full min-h-[420px] border-0 bg-white ${className}`}
  />
);
