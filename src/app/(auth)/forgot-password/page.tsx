import { ForgotPasswordForm } from "@/modules/auth/components/ForgotPasswordForm";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-md md:p-xl font-sans">
      <ForgotPasswordForm linkError={params.error === "enlace"} />
    </main>
  );
}
