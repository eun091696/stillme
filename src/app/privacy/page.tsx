import { PolicyPage } from "@/app/policy-page";
import { PrivacyPolicyContent } from "@/app/policy-content";

export const metadata = { title: "STILLME | 개인정보처리방침" };

export default function PrivacyPage() {
  return (
    <PolicyPage eyebrow="PRIVACY" title="개인정보처리방침" updatedAt="2026년 9월 27일">
      <PrivacyPolicyContent />
    </PolicyPage>
  );
}
