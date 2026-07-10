import DashboardLayout from "../../layouts/DashboardLayout/DashboardLayout";
import ProfileCard from "../../components/common/ProfileCard/ProfileCard";
import AccountCard from "../../components/common/AccountCard/AccountCard";
import "../../styles/pages/dashboard.css";
import { useAuth } from "../../context/AuthContext";
const Dashboard = () => {
  const { user } = useAuth();
  return (
    <DashboardLayout>
      <section className="dashboard-banner">

  <div>

    <h1 className="dashboard-title">
      Welcome back,
      <br />
      {user?.fullName} 👋
    </h1>

    <p className="dashboard-subtitle">
      Manage your account, security and profile settings.
    </p>

  </div>

  <div className="dashboard-last-login">

    <p>Last Login</p>

    <h3>
      {user?.lastLogin
        ? new Date(
            user.lastLogin
          ).toLocaleString()
        : "First Login"}
    </h3>

  </div>

</section>

      <div className="dashboard-grid">
        <ProfileCard />

        <AccountCard />
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;