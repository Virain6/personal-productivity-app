import type { ButtonHTMLAttributes } from "react";
export function Button({
  variant = "secondary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const styles = {
    primary: "bg-accent text-background hover:bg-accent-hover font-semibold",
    secondary: "bg-elevated border border-border hover:bg-border",
    ghost: "hover:bg-elevated text-muted hover:text-foreground",
    danger: "text-danger border border-border hover:bg-elevated",
  };
  return (
    <button
      type="button"
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
      {...props}
    />
  );
}
