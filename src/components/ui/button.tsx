import { ButtonHTMLAttributes } from "react";

export function Button(
  props: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "outline"; size?: "sm" | "md" | "lg" }
) {
  const { variant = "default", size = "md", className = "", ...rest } = props;
  const base =
    "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring";
  const sizeClass =
    size === 'sm' ? 'px-2 py-1 text-sm' : size === 'lg' ? 'px-6 py-3 text-base' : 'px-4 py-2 text-sm';
  const styles =
    variant === "outline"
      ? "border border-input bg-transparent hover:bg-accent hover:text-accent-foreground dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
      : "bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600";

  return <button className={`${base} ${sizeClass} ${styles} ${className}`} {...rest} />;
}