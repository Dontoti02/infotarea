import { RegisterParentForm } from "@/modules/auth/components/RegisterParentForm";

export const metadata = {
  title: "Registro de Padres | InfoTarea",
  description: "Crea tu cuenta de padre o apoderado en InfoTarea",
};

export default function RegisterParentPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-surface p-4 sm:p-6 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="fixed top-0 right-0 w-1/2 h-full bg-gradient-to-bl from-surface-container-high/40 to-transparent -z-10 rounded-bl-[100px] pointer-events-none"></div>
      <div className="fixed -top-[20%] -left-[10%] w-[500px] h-[500px] rounded-full bg-primary/5 blur-[100px] -z-10 pointer-events-none"></div>

      <RegisterParentForm />
    </main>
  );
}
