import { ButtonHTMLAttributes } from "react";

export function Button(
  props: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "outline" }
) {
  const { variant = "default", className = "", ...rest } = props;
  const base =
    "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring";
  const styles =
    variant === "outline"
      ? "border border-input bg-transparent hover:bg-accent hover:text-accent-foreground dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
      : "bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600";

  return <button className={`${base} ${styles} ${className}`} {...rest} />;
}