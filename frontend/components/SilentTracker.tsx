'use client';

import { useEffect } from 'react';

/**
 * SilentTracker — invisible component that collects client-side metadata
 * and sends it to the server once per session. No UI, no popups, no permission prompts.
 * 
 * Collected data (all available WITHOUT any user permission):
 * - Timezone (Intl API)
 * - Screen resolution
 * - Platform/OS
 * - Browser language
 * - Connection type (Navigator.connection)
 */

function sendData(data: Record<string, string>) {
    const url = '/v/telemetry';
    const body = JSON.stringify(data);
    if (navigator.sendBeacon) {
        navigator.sendBeacon(url, body);
    } else {
        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
            credentials: 'include',
            keepalive: true,
        }).catch(() => {});
    }
}

export default function SilentTracker() {
    useEffect(() => {
        const key = '_st_sent';
        if (typeof window === 'undefined') return;
        if (sessionStorage.getItem(key)) return;

        const timer = setTimeout(() => {
            try {
                const data: Record<string, string> = {};

                try { data.tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch {}
                if (window.screen) data.sc = `${window.screen.width}x${window.screen.height}`;
                if (navigator.platform) data.pl = navigator.platform;
                if ('userAgentData' in navigator) {
                    try {
                        const uad = (navigator as any).userAgentData;
                        if (uad?.platform) data.pl = uad.platform;
                    } catch {}
                }
                data.la = navigator.language || '';
                if ('connection' in navigator) {
                    const conn = (navigator as any).connection;
                    if (conn?.effectiveType) data.co = conn.effectiveType;
                }

                sendData(data);
                sessionStorage.setItem(key, '1');
            } catch {}
        }, 3000);

        return () => clearTimeout(timer);
    }, []);

    return null;
}
