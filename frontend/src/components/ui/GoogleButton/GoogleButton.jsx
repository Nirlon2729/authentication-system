import "./GoogleButton.css";

const GoogleButton = ({
  onClick,
  loading = false,
}) => {
  return (
    <button
      type="button"
      className="google-btn"
      onClick={onClick}
      disabled={loading}
    >
      <img
        src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
        alt="Google"
      />

      {loading
        ? "Please wait..."
        : "Continue with Google"}
    </button>
  );
};

export default GoogleButton;