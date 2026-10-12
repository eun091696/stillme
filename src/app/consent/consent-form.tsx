"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { acceptRequiredPolicies } from "@/app/auth/actions";
import {
  PrivacyPolicyContent,
  TermsPolicyContent,
} from "@/app/policy-content";

function ConsentSubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      aria-disabled={disabled || pending}
      className={disabled ? "consent-submit-disabled" : undefined}
      disabled={disabled || pending}
      type="submit"
    >
      {pending ? (
        <>
          <span aria-hidden="true" className="auth-spinner" />
          <span>동의 저장 중</span>
        </>
      ) : "동의하고 계속하기"}
    </button>
  );
}

type PolicyAgreementProps = {
  checked: boolean;
  children: ReactNode;
  content: ReactNode;
  inputName: string;
  label: string;
  onCheckedChange: (checked: boolean) => void;
  open: boolean;
  panelId: string;
  toggleLabel: string;
  onToggle: () => void;
};

function PolicyAgreement({
  checked,
  children,
  content,
  inputName,
  label,
  onCheckedChange,
  open,
  panelId,
  toggleLabel,
  onToggle,
}: PolicyAgreementProps) {
  return (
    <div className="consent-policy-item">
      <div className="consent-policy-row">
        <label className="policy-consent-check">
          <input
            checked={checked}
            name={inputName}
            onChange={(event) => onCheckedChange(event.target.checked)}
            required
            type="checkbox"
          />
          <span>{label}</span>
        </label>
        <button
          aria-controls={panelId}
          aria-expanded={open}
          className="consent-policy-toggle"
          onClick={onToggle}
          type="button"
        >
          <span>{open ? `${toggleLabel} 닫기` : `${toggleLabel} 보기`}</span>
          <span aria-hidden="true" className="consent-policy-chevron">⌄</span>
        </button>
      </div>
      <div
        aria-hidden={!open}
        className="consent-policy-panel"
        data-open={open ? "true" : "false"}
        id={panelId}
      >
        <div className="consent-policy-panel-clip">
          <div className="consent-policy-content" tabIndex={open ? 0 : -1}>
            <h2>{children}</h2>
            {content}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ConsentForm({ destination }: { destination: string }) {
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);

  return (
    <form action={acceptRequiredPolicies} className="auth-form consent-form">
      <input name="next" type="hidden" value={destination} />
      <PolicyAgreement
        checked={termsAccepted}
        content={<TermsPolicyContent />}
        inputName="termsAccepted"
        label="이용약관에 동의합니다. (필수)"
        onCheckedChange={setTermsAccepted}
        onToggle={() => setTermsOpen((current) => !current)}
        open={termsOpen}
        panelId="terms-policy-content"
        toggleLabel="약관"
      >
        이용약관
      </PolicyAgreement>
      <PolicyAgreement
        checked={privacyAccepted}
        content={<PrivacyPolicyContent />}
        inputName="privacyAccepted"
        label="개인정보처리방침에 동의합니다. (필수)"
        onCheckedChange={setPrivacyAccepted}
        onToggle={() => setPrivacyOpen((current) => !current)}
        open={privacyOpen}
        panelId="privacy-policy-content"
        toggleLabel="정책"
      >
        개인정보처리방침
      </PolicyAgreement>
      <ConsentSubmitButton disabled={!termsAccepted || !privacyAccepted} />
    </form>
  );
}
