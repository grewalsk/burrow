"use client";

import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import {
  DOC_TYPE_LABELS,
  MVC_DOC_TYPES,
  P2_DOC_TYPES,
  P3_DOC_TYPES,
  type DocType,
} from "@/lib/docTypes";

type Variant = "onboarding" | "full";

export function DocTypeSelector({
  value,
  onChange,
  variant = "onboarding",
  disabled,
}: {
  value: DocType | null;
  onChange: (next: DocType) => void;
  variant?: Variant;
  disabled?: boolean;
}) {
  const items: DocType[] =
    variant === "onboarding" ? MVC_DOC_TYPES : [...MVC_DOC_TYPES, ...P2_DOC_TYPES, ...P3_DOC_TYPES];
  return (
    <Select.Root
      value={value ?? undefined}
      onValueChange={(v) => onChange(v as DocType)}
      disabled={disabled}
    >
      <Select.Trigger
        aria-label="Document type"
        style={{
          height: 28,
          fontSize: 13,
          fontWeight: 500,
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-default)",
          borderRadius: 4,
          padding: "0 8px",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          color: value ? "var(--text-primary)" : "var(--text-tertiary)",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
          minWidth: 140,
          justifyContent: "space-between",
        }}
      >
        <Select.Value placeholder="Select type" />
        <Select.Icon>
          <ChevronDown size={14} color="var(--text-tertiary)" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={4}
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-default)",
            borderRadius: 6,
            padding: 4,
            minWidth: 200,
            boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
            zIndex: 50,
          }}
        >
          <Select.Viewport>
            {variant === "full" ? (
              <>
                {MVC_DOC_TYPES.map((dt) => (
                  <DocOption key={dt} value={dt} />
                ))}
                <Select.Separator
                  style={{ height: 1, background: "var(--border-subtle)", margin: "4px 2px" }}
                />
                {[...P2_DOC_TYPES, ...P3_DOC_TYPES].map((dt) => (
                  <DocOption key={dt} value={dt} />
                ))}
              </>
            ) : (
              items.map((dt) => <DocOption key={dt} value={dt} />)
            )}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

function DocOption({ value }: { value: DocType }) {
  return (
    <Select.Item
      value={value}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 8px",
        borderRadius: 4,
        fontSize: 13,
        color: "var(--text-primary)",
        cursor: "pointer",
        outline: "none",
      }}
      className="docType-item"
    >
      <Select.ItemIndicator>
        <Check size={14} color="var(--ink)" />
      </Select.ItemIndicator>
      <Select.ItemText>{DOC_TYPE_LABELS[value]}</Select.ItemText>
      <style>{`
        .docType-item[data-highlighted] {
          background: var(--bg-surface);
        }
      `}</style>
    </Select.Item>
  );
}
