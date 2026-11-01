import { useEffect, useState } from 'react';
export function usePage(pages: string[]) {
 function read() { try { const name = decodeURIComponent(location.hash.slice(1)); return pages.includes(name) ? name : pages[0]; } catch { return pages[0]; } }
 const [page, setPage] = useState(read);
 useEffect(() => { const update = () => {setPage(read());}; window.addEventListener('hashchange',update); return () => window.removeEventListener('hashchange',update); }, []);
 return [page, setPage] as const;
}
