import "@/styles/globals.css";
import { useEffect } from 'react';

export default function App({ Component, pageProps }) {
  // Update favicon dynamically if a custom one exists
  useEffect(() => {
    async function checkFavicon() {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const data = await res.json();
          if (data.branding?.hasFavicon) {
            // Update favicon
            const link = document.querySelector("link[rel*='icon']") || document.createElement('link');
            link.type = 'image/x-icon';
            link.rel = 'shortcut icon';
            link.href = '/api/branding/serve?type=favicon';
            document.getElementsByTagName('head')[0].appendChild(link);
          }
        }
      } catch (err) {
        console.error('Failed to load favicon:', err);
      }
    }
    checkFavicon();
  }, []);

  return <Component {...pageProps} />;
}
