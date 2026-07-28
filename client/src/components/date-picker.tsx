"use client";
import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

type DatePickerProps = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  variant?: "datePickerMain" | "datePickerRemarks";
};

export default function DatePicker({
  label,
  value,
  onChange,
  disabled = false,
  className = "",
  placeholder = "Select Date",
  variant = "datePickerMain",
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  // Convert the string date to a Date object
  const parseDate = (dateString: string): Date => {
    const parsedDate = new Date(dateString);
    return isValidDate(parsedDate) ? parsedDate : new Date();
  };

  const [date, setDate] = React.useState<Date>(parseDate(value));
  const [month, setMonth] = React.useState<Date>(new Date(date));

  // Validate if the date is valid
  function isValidDate(date: Date): boolean {
    return date instanceof Date && !isNaN(date.getTime());
  }

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString("en-US", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const variants: Record<string, string> = {
    datePickerMain:
      "w-96 justify-between w-60 px-4 py-2 rounded-md border border-gray-300 shadow-sm text-sm bg-gray-100" +
      "transition focus:ring-2 focus:ring-blue-600 disabled:bg-gray-100 disabled:cursor-not-allowed",
  };

  const triggerClasses = `${variants[variant]} ${className}`;

  return (
    <div className="space-y-1">
      {label && (
        <label
          htmlFor="date"
          className="block mt-2 text-sm font-medium text-font-main"
        >
          {label}
        </label>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild disabled={disabled}>
          <Button variant="outline" className={triggerClasses}>
            <span className={value ? "text-font-main" : "text-font-main"}>
              {value ? value : placeholder}
            </span>
            <span className="group inline-flex items-center">
              <CalendarIcon className="h-4 w-4 text-gray-500 transition-all duration-300 transform group-hover:scale-110 group-hover:text-blue-600 group-hover:shadow-lg" />
            </span>
          </Button>
        </PopoverTrigger>

        <PopoverContent
          className="w-auto overflow-hidden p-0"
          align="end"
          alignOffset={-8}
          sideOffset={10}
        >
          <Calendar
            mode="single"
            selected={date}
            captionLayout="dropdown"
            month={month}
            onMonthChange={(newMonth) => setMonth(newMonth)}
            onSelect={(selectedDate) => {
              if (selectedDate && isValidDate(selectedDate)) {
                setDate(selectedDate);
                setMonth(selectedDate);
                const formattedDate = formatDate(selectedDate);
                onChange(formattedDate);
                setOpen(false);
              }
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
