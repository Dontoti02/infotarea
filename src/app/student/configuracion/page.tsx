import { StudentLayout } from "@/modules/student/components/StudentLayout";
import { ProfileSettings } from "@/shared/components/ProfileSettings";

export default function StudentSettingsPage() {
  return (
    <StudentLayout>
      <ProfileSettings />
    </StudentLayout>
  );
}
