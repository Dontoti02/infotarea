import { ParentLayout } from "@/modules/parent/components/ParentLayout";
import { CommunicationHub } from "@/shared/components/communication/CommunicationHub";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Comunicación con Docentes | InfoTarea",
  description: "Chat directo entre padres de familia y docentes de sus hijos",
};

export default async function ParentCommunicationPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  let parentName = "Padre de Familia";
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  if (profile?.full_name) {
    parentName = profile.full_name;
  }

  return (
    <ParentLayout>
      <div className="space-y-2 mb-6">
        <h1 className="text-2xl font-bold text-on-surface">Comunicación con Docentes</h1>
        <p className="text-sm text-on-surface-variant">
          Canal directo de mensajes con los profesores a cargo de las asignaturas de tus hijos
        </p>
      </div>

      <CommunicationHub
        userRole="parent"
        userId={user.id}
        userName={parentName}
      />
    </ParentLayout>
  );
}
