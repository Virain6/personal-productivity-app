"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { sendCommand } from "@/lib/api";
import {
  emptyReflection,
  reflectionDirty,
  reflectionText,
  recoverDraft,
  type Reflection,
  type ReflectionText,
} from "@/lib/weekly-review";
import styles from "./weekly-review.module.css";
export function ReflectionEditor({
  week,
  saved,
  onDirty,
  onSaved,
}: {
  week: string;
  saved: Reflection | null;
  onDirty: (dirty: boolean) => void;
  onSaved: () => void;
}) {
  const key = `planner:review-draft:${week}`;
  const [recovery] = useState(() => {
    try {
      return recoverDraft(sessionStorage.getItem(key), week);
    } catch {
      return null;
    }
  });
  const [text, setText] = useState<ReflectionText>(
    recovery?.text ?? (saved ? reflectionText(saved) : emptyReflection),
  );
  const [baseline, setBaseline] = useState<ReflectionText>(
    saved ? reflectionText(saved) : emptyReflection,
  );
  const [version, setVersion] = useState(
    recovery?.version ?? saved?.version ?? 0,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(
    recovery ? "Recovered an unsaved draft from this tab." : "",
  );
  const dirty = reflectionDirty(text, baseline);
  useEffect(() => {
    onDirty(dirty);
    return () => onDirty(false);
  }, [dirty, onDirty]);
  useEffect(() => {
    if (!dirty) return;
    const unload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const link = (e: MouseEvent) => {
      const a = (e.target as Element)?.closest?.("a[href]");
      if (
        a &&
        !a.getAttribute("href")?.startsWith("#") &&
        !window.confirm(
          "Leave with unsaved reflections? Your draft stays in this tab; it is not saved to Planner.",
        )
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", link, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", link, true);
    };
  }, [dirty]);
  function change(field: keyof ReflectionText, value: string) {
    const next = { ...text, [field]: value };
    setText(next);
    setNotice("");
    try {
      sessionStorage.setItem(
        key,
        JSON.stringify({ week, text: next, version }),
      );
    } catch {
      setNotice(
        "Draft recovery is unavailable in this browser. Save before leaving.",
      );
    }
  }
  function loadSaved() {
    if (
      dirty &&
      !window.confirm("Discard this unsaved draft and load the saved review?")
    )
      return;
    setText(saved ? reflectionText(saved) : emptyReflection);
    setBaseline(saved ? reflectionText(saved) : emptyReflection);
    setVersion(saved?.version ?? 0);
    setError("");
    setNotice("Loaded saved version.");
    try {
      sessionStorage.removeItem(key);
    } catch {}
  }
  async function save() {
    setBusy(true);
    setError("");
    try {
      await sendCommand({
        action: "weeklyReviewSave",
        week,
        version,
        ...reflectionText(text),
      });
      setBaseline(text);
      setVersion(version + 1);
      setNotice("Saved to Planner.");
      try {
        sessionStorage.removeItem(key);
      } catch {}
      onSaved();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not save. Your text is retained.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={styles.panel} aria-labelledby="reflection-title">
      <div className={styles.sectionHeader}>
        <div>
          <p className={styles.eyebrow}>Make space to reflect</p>
          <h2 id="reflection-title">Your weekly reflection</h2>
        </div>
        <span role="status">
          {busy
            ? "Saving…"
            : dirty
              ? "Unsaved changes"
              : saved || version
                ? "Saved"
                : "No saved reflection yet"}
        </span>
      </div>
      <p className={styles.note}>
        A few sentences are enough. These reflections are yours; nothing is
        generated automatically.
      </p>
      {(saved?.version ?? 0) > version && (
        <p role="status" className={styles.note}>
          A newer saved review is available. Your draft has not been replaced.
        </p>
      )}
      {(["wins", "challenges", "priorities"] as const).map((field, i) => (
        <label className={styles.field} key={field}>
          <span>{["Wins", "Challenges", "Next Week’s Priorities"][i]}</span>
          <textarea
            disabled={busy}
            rows={3}
            maxLength={3000}
            value={text[field]}
            onChange={(e) => change(field, e.target.value)}
            placeholder={
              [
                "What went well this week?",
                "What was difficult?",
                "What should I focus on next?",
              ][i]
            }
          />
          <small aria-hidden="true">{text[field].length}/3000</small>
        </label>
      ))}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className={styles.note}>
          {notice}
        </p>
      )}
      <div className={styles.actions}>
        <Button
          variant="primary"
          disabled={busy || !dirty}
          onClick={() => void save()}
        >
          Save reflection
        </Button>
        <Button disabled={busy} onClick={loadSaved}>
          Load saved / discard draft
        </Button>
      </div>
      <p className={styles.note}>
        Unsaved text is recoverable in this browser tab only. Save to keep it
        across devices. Returning to a week never creates an empty review.
      </p>
    </section>
  );
}
