import { PolicyPage } from "@/app/policy-page";
import { TermsPolicyContent } from "@/app/policy-content";

export const metadata = { title: "STILLME | 이용약관" };

export default function TermsPage() {
  return (
    <PolicyPage eyebrow="TERMS" title="이용약관" updatedAt="2026년 9월 27일">
      <TermsPolicyContent />
    </PolicyPage>
  );
}
