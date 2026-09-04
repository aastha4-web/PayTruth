import { useEffect, useState } from "react";

export default function RefundsAdjustments() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadRefunds = async () => {
      try {
        const response = await fetch("/refund-intelligence");

        if (!response.ok) {
          throw new Error("Could not load refund intelligence.");
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        console.error(err);
        setError("Unable to load refund intelligence.");
      } finally {
        setLoading(false);
      }
    };

    loadRefunds();
  }, []);

  if (loading) {
    return (
      <section className="workspace">
        <div className="loading-state">
          Loading refunds & adjustments...
        </div>
      </section>
    );
  }

  const analysis = data?.refund_analysis || [];
  const summary = data?.summary || {};

  return (
    <section className="workspace">
      <div className="workspace-header">
        <div>
          <div className="eyebrow">
            PAYTRUTH / FINANCIAL INTELLIGENCE
          </div>

          <h1>Refunds & Adjustments</h1>

          <p>
            Analyze refunds, settlement adjustments, and their
            financial impact.
          </p>
        </div>

        <div className="status-pill">
          Human approval protected
        </div>
      </div>

      {error && (
        <div className="error-banner">
          {error}
        </div>
      )}

      <div className="metric-grid">
        <div className="metric-card">
          <span>Total Adjustments</span>
          <strong>
            {summary.total_adjustments || 0}
          </strong>
        </div>

        <div className="metric-card">
          <span>Total Refunds</span>
          <strong>
            {summary.total_refunds || 0}
          </strong>
        </div>

        <div className="metric-card">
          <span>Refund Amount</span>
          <strong>
            ₹{Number(
              summary.total_refund_amount || 0
            ).toLocaleString()}
          </strong>
        </div>

        <div className="metric-card">
          <span>Unexplained Amount</span>
          <strong>
            ₹{Number(
              summary.total_unexplained_amount || 0
            ).toLocaleString()}
          </strong>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-kicker">
              REFUND INTELLIGENCE
            </div>

            <h2>Financial adjustment analysis</h2>
          </div>

          <span className="panel-count">
            {analysis.length} records
          </span>
        </div>

        {analysis.length === 0 ? (
          <div className="empty-state">
            No refund adjustments found.
          </div>
        ) : (
          <div className="notification-list">
            {analysis.map((item) => (
              <div
                className="notification-item"
                key={item.adjustment_id}
              >
                <div className="notification-main">
                  <div className="notification-top">
                    <span className="risk-badge">
                      {item.risk_level}
                    </span>

                    <span className="notification-type">
                      {item.adjustment_type}
                    </span>
                  </div>

                  <h3>
                    {item.transaction_id}
                  </h3>

                  <p>
                    {item.reason}
                  </p>

                  <div className="notification-meta">
                    <span>
                      Transaction: ₹
                      {Number(
                        item.transaction_amount
                      ).toLocaleString()}
                    </span>

                    <span>
                      Settlement: ₹
                      {Number(
                        item.settlement_amount
                      ).toLocaleString()}
                    </span>

                    <span>
                      Adjustment: ₹
                      {Number(
                        item.adjustment_amount
                      ).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="notification-action">
                  <span className="notification-status">
                    {item.analysis?.recommendation
                      ?.type || "REVIEW"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="safety-banner">
        <div>
          <strong>Protected financial workflow</strong>

          <p>
            Refund-related actions require human approval and
            independent verification.
          </p>
        </div>

        <span>NO AUTOMATIC REFUNDS</span>
      </div>
    </section>
  );
}