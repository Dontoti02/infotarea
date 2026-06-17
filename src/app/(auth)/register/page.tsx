import { RegisterForm } from "@/modules/auth/components/RegisterForm";

export default function RegisterPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-surface p-6 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="fixed top-0 right-0 w-1/2 h-full bg-gradient-to-bl from-surface-container-high/40 to-transparent -z-10 rounded-bl-[100px] pointer-events-none"></div>
      <div className="fixed -top-[20%] -left-[10%] w-[500px] h-[500px] rounded-full bg-primary-container/5 blur-[100px] -z-10 pointer-events-none"></div>
      
      <RegisterForm />
    </main>
  );
}
