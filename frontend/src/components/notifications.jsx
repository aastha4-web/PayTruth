import { useEffect, useState } from "react";

export default function Notifications() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadNotifications = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/notifications");

      if (!response.ok) {
        throw new Error("Could not load notifications.");
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error("Notifications error:", err);
      setError("Unable to load notifications.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const markAsRead = async (id) => {
    try {
      setBusy(true);

      const response = await fetch(`/notifications/${id}/read`, {
        method: "PATCH",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.message || "Could not mark notification as read."
        );
      }

      await loadNotifications();
    } catch (err) {
      console.error("Notification update error:", err);
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <section className="workspace">
        <div className="loading-state">Loading notifications...</div>
      </section>
    );
  }

  const notifications = data?.notifications || [];
  const summary = data?.summary || {};

  return (
    <section className="workspace">
      <div className="workspace-header">
        <div>
          <div className="eyebrow">PAYTRUTH / ALERTS</div>
          <h1>Notifications</h1>
          <p>
            Monitor important payment, fraud, and financial intelligence
            alerts in one place.
          </p>
        </div>

        <div className="status-pill">
          Internal intelligence queue
        </div>
      </div>

      {error && (
        <div className="error-banner">
          {error}
        </div>
      )}

      <div className="metric-grid">
        <div className="metric-card">
          <span>Total Alerts</span>
          <strong>{summary.total_notifications || 0}</strong>
        </div>

        <div className="metric-card">
          <span>Critical</span>
          <strong>{summary.critical_notifications || 0}</strong>
        </div>

        <div className="metric-card">
          <span>High</span>
          <strong>{summary.high_notifications || 0}</strong>
        </div>

        <div className="metric-card">
          <span>Unread</span>
          <strong>{summary.unread_notifications || 0}</strong>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-kicker">ALERT CENTER</div>
            <h2>Active intelligence alerts</h2>
          </div>

          <span className="panel-count">
            {notifications.length} alerts
          </span>
        </div>

        {notifications.length === 0 ? (
          <div className="empty-state">
            <strong>No active alerts</strong>
            <p>
              PayTruth has no current notification requiring attention.
            </p>
          </div>
        ) : (
          <div className="notification-list">
            {notifications.map((item) => (
              <div
                className={`notification-item ${
                  item.status === "UNREAD"
                    ? "notification-unread"
                    : ""
                }`}
                key={item.id}
              >
                <div className="notification-main">
                  <div className="notification-top">
                    <span
                      className={`risk-badge risk-${String(
                        item.severity || ""
                      ).toLowerCase()}`}
                    >
                      {item.severity}
                    </span>

                    <span className="notification-type">
                      {item.notification_type}
                    </span>
                  </div>

                  <h3>{item.title}</h3>

                  <p>{item.message}</p>

                  <div className="notification-meta">
                    <span>
                      Source: {item.source || "PayTruth"}
                    </span>

                    {item.payment_id && (
                      <span>
                        Payment: {item.payment_id}
                      </span>
                    )}
                  </div>
                </div>

                <div className="notification-action">
                  <span className="notification-status">
                    {item.status}
                  </span>

                  {item.status === "UNREAD" && (
                    <button
                      className="secondary-button"
                      disabled={busy}
                      onClick={() => markAsRead(item.id)}
                    >
                      Mark as read
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="safety-banner">
        <div>
          <strong>Protected notification mode</strong>
          <p>
            Alerts provide intelligence and prioritization. Financial
            actions still require human authorization.
          </p>
        </div>

        <span>NO AUTOMATIC MONEY MOVEMENT</span>
      </div>
    </section>
  );
}