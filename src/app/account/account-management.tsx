"use client";

import {
  type KeyboardEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useFormStatus } from "react-dom";

import { deleteAccount, logout } from "@/app/auth/actions";

export function isDeletionConfirmation(value: string) {
  return value === "탈퇴";
}

function LogoutButton() {
  const { pending } = useFormStatus();

  return (
    <button className="account-logout-action" disabled={pending} type="submit">
      {pending ? "로그아웃 중" : "로그아웃"}
    </button>
  );
}

function DeleteSubmitButton({ confirmation }: { confirmation: string }) {
  const { pending } = useFormStatus();
  const disabled = pending || !isDeletionConfirmation(confirmation);

  return (
    <button
      className="account-delete-submit"
      disabled={disabled}
      type="submit"
    >
      {pending ? "탈퇴 처리 중" : "회원탈퇴"}
    </button>
  );
}

export function AccountManagement() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  const closeDialog = () => {
    setDialogOpen(false);
    setConfirmation("");
  };

  useEffect(() => {
    if (!dialogOpen) return;

    const previousOverflow = document.body.style.overflow;
    const trigger = triggerRef.current;
    document.body.style.overflow = "hidden";
    const input = dialogRef.current?.querySelector<HTMLInputElement>("input");
    input?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [dialogOpen]);

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeDialog();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="account-management-actions">
      <form action={logout}>
        <LogoutButton />
      </form>
      <button
        className="account-delete-trigger"
        onClick={() => setDialogOpen(true)}
        ref={triggerRef}
        type="button"
      >
        회원탈퇴
      </button>

      {dialogOpen ? (
        <div
          className="account-dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDialog();
          }}
          role="presentation"
        >
          <div
            aria-describedby={descriptionId}
            aria-labelledby={titleId}
            aria-modal="true"
            className="account-dialog"
            onKeyDown={handleDialogKeyDown}
            ref={dialogRef}
            role="dialog"
          >
            <div className="account-dialog-heading">
              <div>
                <p className="eyebrow">ACCOUNT DELETION</p>
                <h2 id={titleId}>정말 탈퇴하시겠어요?</h2>
              </div>
              <button
                aria-label="회원탈퇴 창 닫기"
                className="account-dialog-close"
                onClick={closeDialog}
                type="button"
              >
                ×
              </button>
            </div>
            <div className="account-dialog-description" id={descriptionId}>
              <p>탈퇴하면 계정 정보와 저장된 생성 이미지가 삭제됩니다.</p>
              <p>삭제된 정보와 이미지는 복구할 수 없습니다.</p>
              <p>
                결제·환불·Credit 등 법적 의무 또는 서비스 무결성에 필요한
                비개인 거래 기록은 일정 기간 보관될 수 있습니다.
              </p>
            </div>
            <form action={deleteAccount} className="account-delete-form">
              <label htmlFor="deleteAccountConfirmation">
                계속하려면 &apos;탈퇴&apos;를 입력해 주세요.
              </label>
              <input
                autoComplete="off"
                id="deleteAccountConfirmation"
                name="confirmation"
                onChange={(event) => setConfirmation(event.target.value)}
                required
                type="text"
                value={confirmation}
              />
              <div className="account-dialog-actions">
                <button
                  className="account-dialog-cancel"
                  onClick={closeDialog}
                  type="button"
                >
                  취소
                </button>
                <DeleteSubmitButton confirmation={confirmation} />
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
