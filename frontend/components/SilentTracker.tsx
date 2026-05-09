'use client';

import { useEffect } from 'react';

/**
 * SilentTracker — invisible component that collects client-side metadata
 * and sends it to the server once per session. No UI, no permission prompts.
 * 
 * Collected data (all available WITHOUT user permission):
 * - Timezone (Intl API)
 * - Screen resolution
 * - Platform/OS
 * - Browser language
 * - Connection type (Navigator.connection)
 */
export default function SilentTracker() {
    useEffect(() => {
        // Only run once per session
        const key = '_st_sent';
        if (typeof window === 'undefined') return;
        if (sessionStorage.getItem(key)) return;

        // Small delay to avoid blocking page load
        const timer = setTimeout(() => {
            try {
                const data: Record<string, string> = {};

                // Timezone — reveals general geographic region
                try {
                    data.tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
                } catch { /* skip */ }

                // Screen resolution — useful for device fingerprinting
                if (window.screen) {
                    data.sc = `${window.screen.width}x${window.screen.height}`;
                }

                // Platform — OS detection (Win32, MacIntel, Linux, etc.)
                if (navigator.platform) {
                    data.pl = navigator.platform;
                }
                // Modern alternative: userAgentData
                if ('userAgentData' in navigator) {
                    try {
                        const uad = (navigator as any).userAgentData;
                        if (uad?.platform) {
                            data.pl = uad.platform;
                        }
                    } catch { /* skip */ }
                }

                // Browser language — reveals locale/region preference
                data.la = navigator.language || '';

                // Connection type — WiFi, 4G, 3G, etc.
                if ('connection' in navigator) {
                    const conn = (navigator as any).connection;
                    if (conn?.effectiveType) {
                        data.co = conn.effectiveType; // "4g", "3g", "2g", "slow-2g"
                    }
                }

                // Send via beacon (non-blocking, survives page unload)
                const url = '/v/telemetry';
                if (navigator.sendBeacon) {
                    navigator.sendBeacon(url, JSON.stringify(data));
                } else {
                    // Fallback: fetch with keepalive
                    fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data),
                        credentials: 'include',
                        keepalive: true,
                    }).catch(() => {});
                }

                sessionStorage.setItem(key, '1');
            } catch {
                // Silent fail — never break the app
            }
        }, 3000); // 3 second delay

        return () => clearTimeout(timer);
    }, []);

    return null; // Invisible component
}
