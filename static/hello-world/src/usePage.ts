import { useCallback, useEffect, useState } from "react";
export function usePage(pages: string[]) {
  const read = useCallback(() => {
    try {
      const name = decodeURIComponent(location.hash.slice(1));
      return pages.includes(name) ? name : pages[0];
    } catch {
      return pages[0];
    }
  }, [pages]);
  const [page, setPage] = useState(read);
  useEffect(() => {
    const update = () => setPage(read());
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, [read]);
  return [page, setPage] as const;
}
