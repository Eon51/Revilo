import { Stack } from 'expo-router';
import { useEffect } from 'react';

export default function Layout() {
  useEffect(() => {
    if (
      typeof window !== 'undefined'
      && 'serviceWorker' in navigator
      && window.location.protocol !== 'file:'
    ) {
      if (!document.querySelector('link[rel="manifest"]')) {
        const manifest = document.createElement('link');
        manifest.rel = 'manifest';
        manifest.href = '/manifest.json';
        document.head.appendChild(manifest);
      }
      if (!document.querySelector('meta[name="theme-color"]')) {
        const theme = document.createElement('meta');
        theme.name = 'theme-color';
        theme.content = '#6657F4';
        document.head.appendChild(theme);
      }
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
