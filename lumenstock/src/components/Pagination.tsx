import Link from "next/link";

const PAGE_SIZE = 20;

export { PAGE_SIZE };

type Props = {
  page: number;
  total: number;
  /** Build href for a page number while keeping other filters */
  hrefForPage: (page: number) => string;
};

export function Pagination({ page, total, hrefForPage }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (totalPages <= 1) return null;

  const current = Math.min(Math.max(1, page), totalPages);
  const windowStart = Math.max(1, current - 2);
  const windowEnd = Math.min(totalPages, windowStart + 4);
  const pages: number[] = [];
  for (let p = windowStart; p <= windowEnd; p += 1) pages.push(p);

  return (
    <nav className="pagination" aria-label="Pagination">
      <Link
        href={hrefForPage(Math.max(1, current - 1))}
        className={`page-btn${current <= 1 ? " disabled" : ""}`}
        aria-disabled={current <= 1}
      >
        Prev
      </Link>
      {windowStart > 1 && (
        <>
          <Link href={hrefForPage(1)} className="page-btn">
            1
          </Link>
          {windowStart > 2 && <span className="page-ellipsis">…</span>}
        </>
      )}
      {pages.map((p) => (
        <Link key={p} href={hrefForPage(p)} className={`page-btn${p === current ? " active" : ""}`}>
          {p}
        </Link>
      ))}
      {windowEnd < totalPages && (
        <>
          {windowEnd < totalPages - 1 && <span className="page-ellipsis">…</span>}
          <Link href={hrefForPage(totalPages)} className="page-btn">
            {totalPages}
          </Link>
        </>
      )}
      <Link
        href={hrefForPage(Math.min(totalPages, current + 1))}
        className={`page-btn${current >= totalPages ? " disabled" : ""}`}
        aria-disabled={current >= totalPages}
      >
        Next
      </Link>
    </nav>
  );
}

export function paginate<T>(items: T[], page: number, pageSize = PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(Math.max(1, page), totalPages);
  const start = (current - 1) * pageSize;
  return {
    page: current,
    totalPages,
    slice: items.slice(start, start + pageSize),
  };
}
