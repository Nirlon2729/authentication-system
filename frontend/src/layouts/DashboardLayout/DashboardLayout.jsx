import "./DashboardLayout.css";

import Navbar from "./Navbar";
import Sidebar from "./Sidebar";

const DashboardLayout = ({ children }) => {
  return (
    <div className="dashboard-layout">
      <Navbar />

      <div className="dashboard-container">
        <Sidebar />

        <main className="dashboard-main">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;