"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

const LINKS = [
  { href: "/search", label: "Rechercher" },
  { href: "/dashboard", label: "Mes leads" },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="sticky top-0 z-20 border-b border-gray-200 bg-white/90 backdrop-blur">
      <div className="safe-top mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/dashboard" className="text-base font-bold text-brand-700 sm:text-lg">
          LeadSpot
        </Link>
        <div className="flex items-center gap-0.5 sm:gap-1">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-lg px-2.5 py-1.5 text-sm font-medium transition sm:px-3 ${
                pathname.startsWith(link.href) ? "bg-brand-50 text-brand-700" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <button
            onClick={handleLogout}
            title="Se déconnecter"
            className="ml-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-100 sm:ml-2 sm:px-3"
          >
            <span className="hidden sm:inline">Déconnexion</span>
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4 sm:hidden"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M3 4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h4v-2H3V6h4V4H3Zm10.293.293a1 1 0 0 1 1.414 0l5 5a1 1 0 0 1 0 1.414l-5 5a1 1 0 0 1-1.414-1.414L16.586 11H8a1 1 0 0 1 0-2h8.586l-3.293-3.293a1 1 0 0 1 0-1.414Z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>
    </nav>
  );
}
