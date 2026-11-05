"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button, Card, CardBody, CardHeader, Field, NumberInput } from "@/components/ui";
import { Notice, apiFetch } from "@/components/ui/client";
import { DEFAULT_THRESHOLD, isAtRisk } from "@/lib/obe/engine";
import { parseScore } from "@/lib/gradebook/parse-score";
import type { OfferingDetail } from "@/lib/obe/queries";

export function SettingsTab({ detail }: { detail: OfferingDetail }) {
  const t = useTranslations("offering.settings");
  const router = useRouter();
  const [text, setText] = useState(String(detail.threshold));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const value = parseScore(text);
  const valid = value !== null && !Number.isNaN(value) && value >= 0 && value <= 100;
  const flaggedAt = (threshold: number) =>
    detail.students.filter((s) => Object.values(detail.attainment[s.id] ?? {}).some((v) => isAtRisk(v, threshold))).length;
  const now = flaggedAt(detail.threshold);
  const next = valid ? flaggedAt(value) : now;
  const delta = next - now;
  const changed = valid && value !== detail.threshold;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || !changed) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/offerings/${detail.id}`, { method: "PATCH", body: { threshold: value } });
      toast.success(t("saved", { value }));
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="max-w-xl">
      <CardHeader title={t("title")} description={t("description")} />
      <CardBody>
        <form onSubmit={save} className="space-y-4">
          <Field label={t("label")} htmlFor="threshold" error={!valid ? t("invalid") : undefined}>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={valid ? value : detail.threshold}
                onChange={(e) => setText(e.target.value)}
                aria-label={t("label")}
                className="h-6 min-w-0 flex-1 accent-brand"
              />
              <NumberInput
                id="threshold"
                value={text}
                onChange={(e) => setText(e.target.value)}
                invalid={!valid}
                aria-describedby="threshold-preview"
                className="w-20"
              />
              <span className="text-sm text-muted">%</span>
            </div>
          </Field>
          <p id="threshold-preview" aria-live="polite" className="text-sm text-muted">
            {!changed
              ? t("previewSame", { count: now })
              : delta === 0
                ? t("previewNoChange", { value: value! })
                : delta > 0
                  ? t("previewMore", { value: value!, count: delta })
                  : t("previewFewer", { value: value!, count: -delta })}
          </p>
          {error && <Notice tone="error">{error}</Notice>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" loading={saving} disabled={!valid || !changed}>
              {t("save")}
            </Button>
            {detail.threshold !== DEFAULT_THRESHOLD && (
              <Button type="button" variant="ghost" onClick={() => setText(String(DEFAULT_THRESHOLD))}>
                {t("reset", { value: DEFAULT_THRESHOLD })}
              </Button>
            )}
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
