import {
  LuUser,
  LuLogOut,
  LuPhone,
  LuInfo,
  LuChevronDown,
  LuMenu,
} from "react-icons/lu";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/context/AuthContext";
import { useLogout } from "@/services/useAuthActions";

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { user } = useAuth();
  const logoutMutation = useLogout();

  return (
    <header className="fixed top-0 left-0 md:left-[260px] right-0 z-40 bg-white border-b border-gray-200 flex items-center justify-between px-4 py-3 gap-4">
      {/* Left: Hamburger + Search */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <button
          className="md:hidden shrink-0 p-2 rounded-md hover:bg-gray-100"
          onClick={onMenuClick}
          aria-label="Open menu"
        >
          <LuMenu className="text-xl text-gray-600" />
        </button>

        <input
          className="flex-1 max-w-sm px-3 py-2 text-sm border border-gray-200 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-gray-300 rounded-md min-w-0"
          type="text"
          placeholder="Search"
        />
      </div>

      {/* Right: Avatar / Name / Dropdown */}
      <div className="flex items-center gap-2 md:gap-3 shrink-0">
        <div className="cursor-default flex h-9 w-9 md:h-11 md:w-11 items-center justify-center rounded-full text-gray-600 bg-gray-200 shrink-0">
          <LuUser className="text-base md:text-lg" />
        </div>

        <div className="hidden sm:block text-left">
          <span className="block font-semibold text-gray-800 text-sm md:text-base leading-tight">
            {user?.fullname ?? "Unknown User"}
          </span>
          <span className="block text-xs md:text-sm text-gray-500">
            {user?.department ?? "No Department"}
          </span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Open user menu"
              className="p-1.5 md:p-2 rounded-md hover:bg-gray-100"
            >
              <LuChevronDown className="text-gray-600" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            side="bottom"
            align="end"
            sideOffset={6}
            className="w-48"
          >
            <DropdownMenuItem disabled className="flex items-center gap-2">
              <LuUser className="text-gray-400" />
              My Account
            </DropdownMenuItem>

            <DropdownMenuItem disabled className="flex items-center gap-2">
              <LuPhone className="text-gray-400" />
              Support
            </DropdownMenuItem>

            <DropdownMenuItem disabled className="flex items-center gap-2">
              <LuInfo className="text-gray-400" />
              About
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              className="flex items-center gap-2 text-red-600 focus:text-red-700 focus:bg-red-50"
            >
              <LuLogOut />
              {logoutMutation.isPending ? "Logging out..." : "Logout"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
