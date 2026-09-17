import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import "./DashboardLayout.css";

const DashboardLayout = ({ children }) => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const location = useLocation();

  // Close mobile sidebar on route transition
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  // Close mobile sidebar on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setMobileSidebarOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="app-layout">
      {/* Desktop Sidebar */}
      <aside className="desktop-sidebar-wrapper">
        <Sidebar />
      </aside>

      {/* Mobile Drawer Backdrop */}
      {mobileSidebarOpen && (
        <div
          className="mobile-sidebar-backdrop"
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile Drawer Sidebar */}
      <aside className={`mobile-sidebar-drawer ${mobileSidebarOpen ? "open" : ""}`}>
        <Sidebar onCloseMobile={() => setMobileSidebarOpen(false)} isMobile />
      </aside>

      {/* Main Content Area */}
      <div className="main-content-area">
        <Navbar onToggleMobileMenu={() => setMobileSidebarOpen(!mobileSidebarOpen)} />

        <main className="main-page-content">
          <div className="page-content-container">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;