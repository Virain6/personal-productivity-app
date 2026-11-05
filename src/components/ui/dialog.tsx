"use client";
import * as Primitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  layout = "dialog",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
  layout?: "dialog" | "panel" | "calendar";
}) {
  const content = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open || layout !== "calendar") return;
    const viewport = window.visualViewport;
    function fit() {
      if (!viewport || !content.current) return;
      content.current.style.setProperty(
        "--dialog-height",
        `${viewport.height * 0.9}px`,
      );
      content.current.style.setProperty(
        "--dialog-top",
        `${viewport.offsetTop + viewport.height / 2}px`,
      );
    }
    fit();
    viewport?.addEventListener("resize", fit);
    viewport?.addEventListener("scroll", fit);
    return () => {
      viewport?.removeEventListener("resize", fit);
      viewport?.removeEventListener("scroll", fit);
    };
  }, [open, layout]);
  return (
    <Primitive.Root open={open} onOpenChange={onOpenChange}>
      <Primitive.Portal>
        <Primitive.Overlay className="fixed inset-0 z-40 bg-black/65" />
        <Primitive.Content
          ref={content}
          onOpenAutoFocus={() => {
            opener.current =
              document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;
          }}
          onCloseAutoFocus={(event) => {
            if (layout === "calendar" && opener.current?.isConnected) {
              event.preventDefault();
              opener.current.focus();
            }
          }}
          className={
            layout === "panel"
              ? "fixed inset-y-0 right-0 z-50 h-dvh w-full overflow-y-auto border-l border-border bg-surface px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-6 shadow-xl md:max-w-lg"
              : `${layout === "calendar" ? "calendar-dialog " : ""}fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-surface p-5 shadow-xl`
          }
        >
          <div
            className={
              layout === "calendar" ? "calendar-dialog-heading" : undefined
            }
          >
            <Primitive.Title className="pr-10 text-lg font-semibold">
              {title}
            </Primitive.Title>
            <Primitive.Description className="mb-5 mt-2 text-sm text-muted">
              {description}
            </Primitive.Description>
            {layout === "calendar" && (
              <Primitive.Close
                aria-label="Close dialog"
                className="absolute right-2 top-2 flex size-11 items-center justify-center rounded-lg hover:bg-elevated"
              >
                <X size={18} />
              </Primitive.Close>
            )}
          </div>
          {children}
          {layout !== "calendar" && (
            <Primitive.Close
              aria-label="Close dialog"
              className="absolute right-2 top-2 flex size-11 items-center justify-center rounded-lg hover:bg-elevated"
            >
              <X size={18} />
            </Primitive.Close>
          )}
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
