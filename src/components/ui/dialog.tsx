"use client";
import * as Primitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Primitive.Root open={open} onOpenChange={onOpenChange}>
      <Primitive.Portal>
        <Primitive.Overlay className="fixed inset-0 z-40 bg-black/65" />
        <Primitive.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-surface p-5 shadow-xl">
          <Primitive.Title className="pr-10 text-lg font-semibold">
            {title}
          </Primitive.Title>
          <Primitive.Description className="mb-5 mt-2 text-sm text-muted">
            {description}
          </Primitive.Description>
          {children}
          <Primitive.Close
            aria-label="Close dialog"
            className="absolute right-2 top-2 flex size-11 items-center justify-center rounded-lg hover:bg-elevated"
          >
            <X size={18} />
          </Primitive.Close>
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
