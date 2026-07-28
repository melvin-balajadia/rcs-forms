import { NavLink } from "react-router-dom";
import {
  LuLayoutDashboard,
  LuX,
  LuUsers,
  LuUser,
  LuMapPinHouse,
  LuNotepadText,
  LuNotebookPen,
  LuFileChartColumnIncreasing,
} from "react-icons/lu";
import logo from "../assets/logo2.png";
import { getAuth } from "@/context/AuthContext";
import { canAccess } from "@/config/routePermissions";

const allSidebarItems = [
  { item: "Dashboard", location: "/", icon: <LuLayoutDashboard /> },
  { item: "Forms", location: "/forms", icon: <LuNotepadText /> },
  { item: "Form Entry", location: "/form-entry", icon: <LuNotebookPen /> },
  {
    item: "Reports",
    location: "/reports",
    icon: <LuFileChartColumnIncreasing />,
  },
  { item: "Clients", location: "/clients", icon: <LuUsers /> },
  { item: "Rooms", location: "/rooms", icon: <LuMapPinHouse /> },
  { item: "User Management", location: "/user-management", icon: <LuUser /> },
  {
    item: "Group Management",
    location: "/group-management",
    icon: <LuUsers />,
  },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user } = getAuth();

  const userRoles: string[] = Array.isArray(user?.user_groups)
    ? user.user_groups
    : [];

  const sidebarItems = allSidebarItems.filter((item) =>
    canAccess(item.location, userRoles),
  );

  return (
    <>
      {/* Backdrop — mobile only */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <div
        className={`fixed left-0 top-0 h-screen w-[260px] bg-white border-r border-gray-100 z-50 flex flex-col overflow-y-auto transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
      >
        <div className="flex items-center justify-between px-4 py-4">
          <img src={logo} className="w-32 object-contain" alt="Logo" />
          <button
            className="md:hidden p-1 rounded hover:bg-gray-100"
            onClick={onClose}
          >
            <LuX className="text-xl text-gray-500" />
          </button>
        </div>

        <nav className="p-4 space-y-1.5 flex-1">
          {sidebarItems.map((item, index) => (
            <NavLink
              key={index}
              to={item.location}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center space-x-3 font-semibold px-4 py-2 rounded text-font-main ${
                  isActive
                    ? "bg-button-active text-font-active"
                    : "hover:bg-button-active"
                }`
              }
            >
              {item.icon}
              <span>{item.item}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </>
  );
}
