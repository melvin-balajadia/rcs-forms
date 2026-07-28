import React from "react";

type ButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  className?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  variant?:
    | "buttonMain"
    | "buttonLogin"
    | "buttonMainNegative"
    | "buttonLoginNegative";
};

export default function Button({
  children,
  onClick,
  type = "button",
  className = "",
  disabled = false,
  icon,
  variant = "buttonMain", // default variant
}: ButtonProps) {
  const base = "inline-flex items-center px-4 py-1 rounded-sm transition";

  const variants: Record<string, string> = {
    buttonMain:
      "bg-button-main text-white hover:bg-button-main-hover disabled:bg-gray-400",
    buttonLogin:
      "bg-button-login text-white border text-center py-2 border-blue-600 hover:bg-button-login-hover disabled:opacity-50 disabled:cursor-not-allowed",
    buttonMainNegative:
      "bg-white text-button-main hover:bg-button-main-hover hover:text-white disabled:bg-gray-100 border border-gray-200",
    buttonLoginNegative:
      "bg-white text-button-login text-center py-2 hover:bg-button-login hover:text-white disabled:bg-gray-100 border border-button-login",
  };

  const variantClasses = variants[variant];

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variantClasses} ${className}`}
    >
      {icon && <span className="mr-1 flex-shrink-0">{icon}</span>}
      <span>{children}</span>
    </button>
  );
}
