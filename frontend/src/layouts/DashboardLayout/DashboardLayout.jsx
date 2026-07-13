import "./DashboardLayout.css";
import { motion } from "framer-motion";

import Navbar from "./Navbar";
import Sidebar from "./Sidebar";

const DashboardLayout = ({ children }) => {
  return (
    <div className="dashboard-layout">
      <Navbar />

      <div className="dashboard-container">
        <Sidebar />

        <motion.main 
          className="dashboard-main"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
};

export default DashboardLayout;