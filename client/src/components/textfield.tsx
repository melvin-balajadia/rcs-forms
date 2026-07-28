import React from "react";

type TextFieldProps = {
  label?: string;
  value?: string | number | null; // allow null
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: React.HTMLInputTypeAttribute;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  variant?: "textFieldMain" | "textFieldLogin" | "textFieldRemarks";
  error?: string;
};

export default function TextField({
  label,
  value,
  onChange,
  type = "text",
  placeholder = "",
  disabled = false,
  className = "",
  variant = "textFieldMain",
  error,
}: TextFieldProps) {
  const base =
    "block rounded-sm px-3 py-2 text-sm transition placeholder-gray-400";

  const variants: Record<string, string> = {
    textFieldMain:
      "px-4 py-2 border rounded-md shadow-sm border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition disabled:bg-gray-100 disabled:cursor-not-allowed w-full",
    textFieldLogin:
      "px-4 py-2 border rounded-md shadow-sm border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition disabled:bg-gray-100 disabled:cursor-not-allowed w-full",
    textFieldRemarks:
      "px-4 py-2 mt-2 rounded-md border border-gray-300 shadow-sm placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition disabled:bg-gray-100 disabled:cursor-not-allowed w-full",
  };

  const inputClasses = `${base} ${variants[variant]} ${className}`;

  return (
    <div className="space-y-1">
      {label && (
        <label className="text-sm font-medium text-font-main">{label}</label>
      )}

      <input
        type={type}
        value={value ?? ""}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className={inputClasses}
      />

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
