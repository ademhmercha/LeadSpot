import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import Navbar from "@/app/components/Navbar";
import SearchForm from "@/app/components/SearchForm";
import UsageMeter from "@/app/components/UsageMeter";

export default async function SearchPage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-xl px-4 py-6">
        <h1 className="mb-1 text-xl font-bold text-gray-800 dark:text-gray-100">Rechercher des leads</h1>
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          Trouvez les établissements locaux sans site web (ou avec seulement une page Facebook/Instagram).
        </p>
        <div className="mb-4">
          <UsageMeter />
        </div>
        <SearchForm />
      </main>
    </div>
  );
}
