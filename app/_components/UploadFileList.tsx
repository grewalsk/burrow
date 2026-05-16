"use client";

import { UploadFileRow, type UploadFile } from "./UploadFileRow";
import type { DocType } from "@/lib/docTypes";

export function UploadFileList({
  items,
  onChangeDocType,
  onRemove,
  onRetry,
  selectorVariant = "onboarding",
}: {
  items: UploadFile[];
  onChangeDocType: (id: string, docType: DocType) => void;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
  selectorVariant?: "onboarding" | "full";
}) {
  if (items.length === 0) return null;
  return (
    <ul
      role="list"
      style={{
        listStyle: "none",
        padding: 0,
        margin: 0,
        border: "1px solid var(--border-subtle)",
        borderRadius: 6,
        background: "var(--bg-elevated)",
      }}
    >
      {items.map((item) => (
        <UploadFileRow
          key={item.id}
          item={item}
          onChangeDocType={(dt) => onChangeDocType(item.id, dt)}
          onRemove={() => onRemove(item.id)}
          onRetry={() => onRetry(item.id)}
          selectorVariant={selectorVariant}
        />
      ))}
    </ul>
  );
}
