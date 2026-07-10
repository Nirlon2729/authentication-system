const SecurityCard = ({
  icon,
  title,
  subtitle,
  onClick,
  disabled = false,
}) => {
  return (
    <div
      onClick={
        disabled
          ? undefined
          : onClick
      }
      style={{
        display: "flex",
        justifyContent:
          "space-between",
        alignItems: "center",

        padding: "20px",

        marginBottom: "18px",

        borderRadius: "14px",

        border: "1px solid #e5e7eb",

        background: "#fff",

        cursor: disabled
          ? "default"
          : "pointer",

        opacity: disabled
          ? 0.6
          : 1,

        transition:
          "all .25s ease",

        boxShadow:
          "0 2px 8px rgba(0,0,0,.05)",
      }}
    >
      <div>
        <div
          style={{
            fontSize: "18px",
            fontWeight: "600",
          }}
        >
          {icon} {title}
        </div>

        {subtitle && (
          <div
            style={{
              marginTop: "6px",
              color: "#6b7280",
              fontSize: "14px",
            }}
          >
            {subtitle}
          </div>
        )}
      </div>

      <span
        style={{
          fontSize: "26px",
          color: "#9ca3af",
        }}
      >
        ›
      </span>
    </div>
  );
};

export default SecurityCard;