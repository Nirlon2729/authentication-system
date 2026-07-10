import { useEffect, useState } from "react";

import {
    getUserSessions,
    logoutSession,
} from "../../services/sessionService";

const formatLastActive = (date) => {
    const now = new Date();
    const last = new Date(date);

    const seconds = Math.floor(
        (now - last) / 1000
    );

    if (seconds < 60) {
        return "Just now";
    }

    const minutes = Math.floor(
        seconds / 60
    );

    if (minutes < 60) {
        return `${minutes} minute${minutes > 1 ? "s" : ""
            } ago`;
    }

    const hours = Math.floor(
        minutes / 60
    );

    if (hours < 24) {
        return `${hours} hour${hours > 1 ? "s" : ""
            } ago`;
    }

    const days = Math.floor(
        hours / 24
    );

    if (days === 1) {
        return "Yesterday";
    }

    return `${days} days ago`;
};
const ActiveSessions = () => {
    const [sessions, setSessions] =
        useState([]);
    const handleLogoutSession = async (
        sessionId
    ) => {
        try {
            await logoutSession(sessionId);

            setSessions((prev) =>
                prev.filter(
                    (session) =>
                        session._id !== sessionId
                )
            );
        } catch (error) {
            console.error(error);
        }
    };
    useEffect(() => {
        const loadSessions = async () => {
            try {
                const response =
                    await getUserSessions();

                setSessions(response.sessions);
            } catch (error) {
                console.error(error);
            }
        };

        loadSessions();
    }, []);

    return (
        <div
            style={{
                marginTop: "40px",
            }}
        >
            <h2>Active Sessions</h2>

            <hr />

            {sessions.map((session) => (
                <div
                    key={session._id}
                    style={{
                        marginTop: "20px",
                        padding: "24px",
                        borderRadius: "16px",
                        border: session.isCurrent
                            ? "2px solid #22c55e"
                            : "1px solid #ddd",
                        background: session.isCurrent
                            ? "#f0fdf4"
                            : "#ffffff",
                        boxShadow:
                            "0 8px 20px rgba(0,0,0,.06)",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: "20px",
                        }}
                    >
                        <h3
                            style={{
                                margin: 0,
                            }}
                        >
                            {session.isCurrent
                                ? "🟢 CURRENT DEVICE"
                                : "💻 DEVICE"}
                        </h3>

                        {session.rememberMe && (
                            <span
                                style={{
                                    background: "#2563eb",
                                    color: "#fff",
                                    padding: "5px 12px",
                                    borderRadius: "20px",
                                    fontSize: "12px",
                                    fontWeight: "bold",
                                }}
                            >
                                Remember Me
                            </span>
                        )}
                    </div>

                    <p>
                        🌐 <strong>{session.browser}</strong>
                    </p>

                    <p>
                        💻 {session.operatingSystem} • {session.device}
                    </p>

                    <p>
                        🕒 {formatLastActive(session.lastActive)}
                    </p>

                    {!session.isCurrent && (
                        <button
                            onClick={() =>
                                handleLogoutSession(
                                    session._id
                                )
                            }
                            style={{
                                marginTop: "15px",
                                padding: "10px 20px",
                                border: "none",
                                borderRadius: "8px",
                                background: "#dc2626",
                                color: "#fff",
                                cursor: "pointer",
                                fontWeight: "600",
                            }}
                        >
                            Logout
                        </button>
                    )}
                </div>
            ))}
        </div>
    );
};

export default ActiveSessions;