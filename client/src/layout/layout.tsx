import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./sidebar";
import Header from "./header";

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-100">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="md:ml-[260px]">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="pt-[61px] p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
