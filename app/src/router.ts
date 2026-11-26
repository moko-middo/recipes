import { useEffect, useState } from 'react';

/** #/r/abc/edit のようなハッシュで画面を切り替える（ホスティングの設定が要らない） */
export function useRoute(): string[] {
  const read = () => decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('/').filter(Boolean);
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => {
      setRoute(read());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function go(path: string) {
  location.hash = '#/' + path.replace(/^\//, '');
}

export function back(fallback = '') {
  if (history.length > 1) history.back();
  else go(fallback);
}
