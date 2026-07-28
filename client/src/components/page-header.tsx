// PageHeader.tsx
import React from "react";
import Button from "./button";

interface PageHeaderProps {
  icon?: React.ReactNode;
  title: string;
  buttonText?: string;
  onButtonClick?: () => void;
  variant?: "default" | "compact";
}

export default function PageHeader({
  icon,
  title,
  buttonText,
  onButtonClick,
  variant = "default",
}: PageHeaderProps) {
  const variants = {
    default: "p-4 rounded",
    compact: "p-2 rounded-lg",
  };

  return (
    <div className="w-full">
      <div
        className={`w-full h-auto flex items-center justify-between bg-white shadow-md ${variants[variant]}`}
      >
        <div className="flex items-center gap-2">
          {icon}
          <h1 className="text-2xl font-bold text-font-main">{title}</h1>
        </div>
        {buttonText && (
          <Button
            variant="buttonMain"
            className="rounded-lg shadow-sm"
            onClick={onButtonClick}
          >
            {buttonText}
          </Button>
        )}
      </div>
    </div>
  );
}
