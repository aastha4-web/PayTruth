import { useEffect, useState } from "react";

export default function AuditTrail() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAuditTrail = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/audit-logs");

      if (!response.ok) {
        throw new Error("Could not load audit trail.");
      }

      const result = await response.json();

      setLogs(
        Array.isArray(result)
          ? result
          : result?.audit_logs || result?.logs || []
      );
    } catch (err) {
      console.error("Audit trail error:", err);
      setError("Unable to load audit trail.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditTrail();
  }, []);

  if (loading) {
    return (
      <section className="workspace">
        <div className="loading-state">
          Loading audit trail...
        </div>
      </section>
    );
  }

  return (
    <section className="workspace">
      <div className="workspace-header">
        <div>
          <div className="eyebrow">PAYTRUTH / CONTROL</div>
          <h1>Audit Trail</h1>
          <p>
            Review every important AI decision, approval, execution,
            verification, and resolution event.
          </p>
        </div>

        <div className="status-pill">
          Immutable intelligence history
        </div>
      </div>

      {error && (
        <div className="error-banner">
          {error}
        </div>
      )}

      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-kicker">AUDIT HISTORY</div>
            <h2>System activity</h2>
          </div>

          <span className="panel-count">
            {logs.length} events
          </span>
        </div>

        {logs.length === 0 ? (
          <div className="empty-state">
            <strong>No audit events found</strong>
            <p>
              Important PayTruth workflow events will appear here.
            </p>
          </div>
        ) : (
          <div className="audit-list">
            {logs.map((log) => (
              <div className="audit-item" key={log.id}>
                <div className="audit-marker" />

                <div className="audit-content">
                  <div className="audit-top">
                    <span className="audit-event">
                      {log.event_type}
                    </span>

                    <span className="audit-time">
                      {log.created_at
                        ? new Date(
                            log.created_at
                          ).toLocaleString()
                        : "—"}
                    </span>
                  </div>

                  <h3>
                    {log.description || "PayTruth system event"}
                  </h3>

                  <div className="audit-meta">
                    <span>
                      Actor: {log.actor || "SYSTEM"}
                    </span>

                    {log.action_id && (
                      <span>
                        Action #{log.action_id}
                      </span>
                    )}

                    {log.case_id && (
                      <span>
                        Case #{log.case_id}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="safety-banner">
        <div>
          <strong>Auditable by design</strong>
          <p>
            PayTruth records approval, execution, verification, and
            resolution events for controlled financial workflows.
          </p>
        </div>

        <span>HUMAN-IN-THE-LOOP</span>
      </div>
    </section>
  );
}