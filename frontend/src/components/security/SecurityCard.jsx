import { ChevronRight } from "lucide-react";

const SecurityCard = ({
  icon,
  title,
  subtitle,
  badge,
  badgeType = "neutral",
  onClick,
  disabled = false,
}) => {
  const getBadgeStyle = () => {
    switch (badgeType) {
      case "success":
        return {
          background: "rgba(16, 185, 129, 0.1)",
          color: "#10b981",
          border: "1px solid rgba(16, 185, 129, 0.2)",
        };
      case "warning":
        return {
          background: "rgba(245, 158, 11, 0.1)",
          color: "#f59e0b",
          border: "1px solid rgba(245, 158, 11, 0.2)",
        };
      default:
        return {
          background: "var(--bg-hover)",
          color: "var(--text-muted)",
          border: "1px solid var(--border-color)",
        };
    }
  };

  return (
    <div
      onClick={disabled ? undefined : onClick}
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "1.35rem 1.5rem",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--border-color)",
        background: "var(--bg-card)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        transition: "var(--transition-fast)",
        boxShadow: "var(--shadow-sm)",
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow = "var(--shadow-md)";
          e.currentTarget.style.borderColor = "var(--primary-500)";
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.transform = "none";
          e.currentTarget.style.boxShadow = "var(--shadow-sm)";
          e.currentTarget.style.borderColor = "var(--border-color)";
        }
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "1.1rem" }}>
        <div
          style={{
            width: "44px",
            height: "44px",
            borderRadius: "12px",
            background: "var(--bg-hover)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            border: "1px solid var(--border-color)",
          }}
        >
          {icon}
        </div>

        <div>
          <div
            style={{
              fontSize: "1rem",
              fontWeight: "700",
              color: "var(--text-primary)",
              display: "flex",
              alignItems: "center",
              gap: "0.6rem",
            }}
          >
            <span>{title}</span>
            {badge && (
              <span
                style={{
                  fontSize: "0.72rem",
                  fontWeight: "700",
                  padding: "0.2rem 0.6rem",
                  borderRadius: "var(--radius-full)",
                  ...getBadgeStyle(),
                }}
              >
                {badge}
              </span>
            )}
          </div>

          {subtitle && (
            <div
              style={{
                marginTop: "0.25rem",
                color: "var(--text-secondary)",
                fontSize: "0.82rem",
                lineHeight: 1.4,
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
      </div>

      <ChevronRight
        size={20}
        style={{
          color: "var(--text-muted)",
          flexShrink: 0,
        }}
      />
    </div>
  );
};

export default SecurityCard;