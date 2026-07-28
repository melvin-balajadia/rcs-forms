"use client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { LuPencil, LuEye, LuArchiveX } from "react-icons/lu";
import { Link } from "react-router-dom";

type Option = { label: string; value: string; link?: string };

type DropdownProps = {
  label?: string;
  options: Option[];
  value?: string | number | null; // allow null
  onChange?: (value: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  variant?: "dropdownRemarks" | "dropdownMain" | "dropdownActions";
  customTrigger?: React.ReactNode;
};

export default function Dropdown({
  label,
  options,
  value,
  onChange,
  disabled = false,
  className = "",
  placeholder = "Select…",
  variant = "dropdownMain",
  customTrigger,
}: DropdownProps) {
  const variants: Record<string, string> = {
    dropdownRemarks:
      "mt-3 justify-between px-4 py-2 rounded-md border border-gray-300 shadow-sm text-sm bg-gray-100 " +
      "transition focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed w-full",
    dropdownMain:
      "justify-between px-4 py-2 rounded-md border border-gray-300 shadow-sm text-sm bg-gray-100 " +
      "transition focus:ring-2 focus:ring-blue-600 disabled:bg-gray-100 disabled:cursor-not-allowed w-full",
    dropdownActions: "",
  };

  const triggerClasses = `${variants[variant]} ${className}`;

  const currentLabel = value
    ? options.find((opt) => opt.value === value)?.label ?? placeholder
    : placeholder;

  return (
    <div
      className={`flex flex-col gap-1 text-sm ${
        variant === "dropdownActions" ? "inline-flex" : ""
      }`}
    >
      {label && variant !== "dropdownActions" && (
        <label className="text-font-main font-medium">{label}</label>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={disabled}>
          {variant === "dropdownActions" && customTrigger ? (
            customTrigger
          ) : (
            <Button variant="outline" className={triggerClasses}>
              <span className="text-font-main">{currentLabel}</span>
              <svg
                className="h-4 w-4 text-gray-500 ml-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </Button>
          )}
        </DropdownMenuTrigger>

        <DropdownMenuContent
          className={variant === "dropdownActions" ? "w-40 p-0" : "w-96 p-0"}
          align="end"
        >
          {options.map((opt) => (
            <DropdownMenuItem
              key={opt.value}
              onSelect={() => onChange?.(opt.value)}
              asChild={variant === "dropdownActions"}
              className={`flex items-center gap-2 ${
                opt.value === "delete"
                  ? "text-red-600 hover:bg-red-50"
                  : "hover:bg-gray-100"
              } ${value === opt.value ? "bg-blue-50" : ""}`}
            >
              {variant === "dropdownActions" ? (
                <Link
                  to={opt.link || "#"}
                  className="w-full flex items-center gap-2"
                >
                  {opt.value === "manage" && <LuPencil className="w-3 h-3" />}
                  {opt.value === "details" && <LuEye className="w-3 h-3" />}
                  {opt.value === "delete" && <LuArchiveX className="w-3 h-3" />}
                  {opt.label}
                </Link>
              ) : (
                opt.label
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
