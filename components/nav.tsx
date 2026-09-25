"use client";
import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";

const GROUPS: { label: string; items: [string, string][] }[] = [
  { label: "Clinical work", items: [["/", "Dashboard"], ["/cases/new", "New case"], ["/cases", "Cases"], ["/recommendations", "Recommendations"]] },
  { label: "Reference", items: [["/search", "Search"], ["/medicines", "Medicines"], ["/repertory", "Repertory"], ["/ayurveda", "Ayurveda explorer"], ["/sources", "Sources & licences"]] },
  { label: "Administration", items: [["/admin", "Data health"], ["/settings", "Settings"]] },
];

export function Nav() {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" : href === "/cases" ? path === "/cases" || (path.startsWith("/cases/") && !path.startsWith("/cases/new")) : path.startsWith(href));
  return (
    <nav aria-label="Main" className="space-y-5">
      {GROUPS.map((g) => (
        <div key={g.label}>
          <p className="mb-1 px-3 text-xs font-medium text-ink-faint">{g.label}</p>
          <ul>
            {g.items.map(([href, label]) => (
              <li key={href}>
                <Link href={href} aria-current={active(href) ? "page" : undefined}
                  className={clsx("block rounded-[3px] px-3 py-1.5 text-[0.93rem] hover:no-underline", active(href) ? "bg-ink text-white" : "text-ink hover:bg-wash")}>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
