import { useEffect, useState } from "react";

export default function RiskPrioritization() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadRisk = async () => {
      try {
        const response = await fetch(
          "/risk-prioritization"
        );

        if (!response.ok) {
          throw new Error(
            "Could not load risk prioritization."
          );
        }

        const result = await response.json();
        setCases(Array.isArray(result) ? result : []);
      } catch (err) {
        console.error(err);
        setError(
          "Unable to load risk prioritization."
        );
      } finally {
        setLoading(false);
      }
    };

    loadRisk();
  }, []);

  if (loading) {
    return (
      <section className="workspace">
        <div className="loading-state">
          Loading risk prioritization...
        </div>
      </section>
    );
  }

  return (
    <section className="workspace">
      <div className="workspace-header">
        <div>
          <div className="eyebrow">
            PAYTRUTH / AI INTELLIGENCE
          </div>

          <h1>Risk Prioritization</h1>

          <p>
            Prioritize financial cases according to risk,
            exposure, and current workflow state.
          </p>
        </div>

        <div className="status-pill">
          AI prioritization
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
            <div className="panel-kicker">
              RISK ENGINE
            </div>

            <h2>Prioritized cases</h2>
          </div>

          <span className="panel-count">
            {cases.length} cases
          </span>
        </div>

        {cases.length === 0 ? (
          <div className="empty-state">
            No active risk cases found.
          </div>
        ) : (
          <div className="notification-list">
            {cases.map((item) => (
              <div
                className="notification-item"
                key={item.id}
              >
                <div className="notification-main">
                  <div className="notification-top">
                    <span className="risk-badge">
                      {item.risk_level}
                    </span>

                    <span className="notification-type">
                      {item.priority}
                    </span>
                  </div>

                  <h3>
                    {item.transaction_id}
                  </h3>

                  <p>
                    Difference detected in settlement
                    reconciliation.
                  </p>

                  <div className="notification-meta">
                    <span>
                      Difference: ₹
                      {Number(
                        item.difference
                      ).toLocaleString()}
                    </span>

                    <span>
                      Case: {item.case_status}
                    </span>
                  </div>
                </div>

                <div className="notification-action">
                  <span className="notification-status">
                    Score{" "}
                    {item.priority_score}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="safety-banner">
        <div>
          <strong>AI prioritization only</strong>

          <p>
            Risk ranking helps humans decide what requires
            attention. It does not authorize financial action.
          </p>
        </div>

        <span>HUMAN DECISION REQUIRED</span>
      </div>
    </section>
  );
}