import { useEffect, useMemo, useState } from "react";

function formatCurrency(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

function getRiskClass(risk) {
  return String(risk || "").toLowerCase().replace(/\s+/g, "-");
}

function PaymentIntelligence() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPayment, setSelectedPayment] = useState(null);

  const loadIntelligence = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/payment-failures");

      if (!response.ok) {
        throw new Error("Could not load payment failure intelligence.");
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error("Payment intelligence error:", err);
      setError("Could not load payment failure intelligence.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIntelligence();
  }, []);

  const payments = data?.payment_failures || data?.failures || [];

  const summary = useMemo(() => {
    const total = payments.length;

    const highRisk = payments.filter(
      (payment) =>
        String(payment.risk_level).toUpperCase() === "HIGH"
    ).length;

    const mediumRisk = payments.filter(
      (payment) =>
        String(payment.risk_level).toUpperCase() === "MEDIUM"
    ).length;

    const criticalRisk = payments.filter(
      (payment) =>
        String(payment.risk_level).toUpperCase() === "CRITICAL"
    ).length;

    const totalValue = payments.reduce(
      (sum, payment) => sum + Number(payment.amount || 0),
      0
    );

    return {
      total,
      highRisk,
      mediumRisk,
      criticalRisk,
      totalValue
    };
  }, [payments]);

  if (loading) {
    return (
      <section className="workspace payment-workspace">
        <div className="workspace-header">
          <div>
            <span className="eyebrow">Payment Intelligence</span>
            <h1>Payment Health</h1>
            <p>
              Loading payment failure intelligence...
            </p>
          </div>
        </div>

        <div className="loading-card">
          <div className="loading-spinner"></div>
          <span>Analyzing payment activity</span>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="workspace payment-workspace">
        <div className="workspace-header">
          <div>
            <span className="eyebrow">Payment Intelligence</span>
            <h1>Payment Health</h1>
            <p>
              Monitor failed payments and AI recovery recommendations.
            </p>
          </div>

          <button
            className="primary-button"
            onClick={loadIntelligence}
          >
            Refresh Intelligence
          </button>
        </div>

        <div className="error-banner">
          <strong>Intelligence error</strong>
          <span>{error}</span>
        </div>
      </section>
    );
  }

  return (
    <section className="workspace payment-workspace">

      {/* HEADER */}
      <div className="workspace-header">
        <div>
          <span className="eyebrow">
            Payment Intelligence
          </span>

          <h1>Payment Health</h1>

          <p>
            Detect failed payments, understand why they failed,
            and prioritize safe AI-assisted recovery.
          </p>
        </div>

        <button
          className="primary-button"
          onClick={loadIntelligence}
        >
          ↻ Refresh Intelligence
        </button>
      </div>

      {/* SAFETY STRIP */}
      <div className="reconciliation-strip">
        <div className="strip-item">
          <span className="strip-dot sage"></span>
          <div>
            <strong>AI analysis active</strong>
            <small>Failure patterns are continuously evaluated</small>
          </div>
        </div>

        <div className="strip-item">
          <span className="strip-dot amber"></span>
          <div>
            <strong>Human approval required</strong>
            <small>Financial actions never execute automatically</small>
          </div>
        </div>

        <div className="strip-item">
          <span className="strip-dot lavender"></span>
          <div>
            <strong>Sandbox execution</strong>
            <small>No real money movement</small>
          </div>
        </div>
      </div>

      {/* METRICS */}
      <div className="metric-grid">

        <div className="metric-card">
          <div className="metric-card-top">
            <span className="metric-label">
              Failed Payments
            </span>
            <span className="metric-icon terracotta">!</span>
          </div>

          <strong className="metric-value">
            {summary.total}
          </strong>

          <span className="metric-meta">
            Detected by payment intelligence
          </span>
        </div>

        <div className="metric-card">
          <div className="metric-card-top">
            <span className="metric-label">
              Failed Value
            </span>
            <span className="metric-icon gold">₹</span>
          </div>

          <strong className="metric-value">
            {formatCurrency(summary.totalValue)}
          </strong>

          <span className="metric-meta">
            Total value of failed payments
          </span>
        </div>

        <div className="metric-card">
          <div className="metric-card-top">
            <span className="metric-label">
              High Risk
            </span>
            <span className="metric-icon coral">↑</span>
          </div>

          <strong className="metric-value">
            {summary.highRisk + summary.criticalRisk}
          </strong>

          <span className="metric-meta">
            High + critical payment risks
          </span>
        </div>

        <div className="metric-card">
          <div className="metric-card-top">
            <span className="metric-label">
              Medium Risk
            </span>
            <span className="metric-icon lavender">◇</span>
          </div>

          <strong className="metric-value">
            {summary.mediumRisk}
          </strong>

          <span className="metric-meta">
            Requires monitored recovery
          </span>
        </div>

      </div>

      {/* AI SUMMARY */}
      <div className="insight-card lavender-insight">

        <div className="insight-icon">
          ✦
        </div>

        <div className="insight-content">
          <span className="eyebrow">
            AI Decision Layer
          </span>

          <h3>
            Payment recovery recommendations are human-gated
          </h3>

          <p>
            PayTruth analyzes failure reasons and proposes the
            safest next action. No financial action is executed
            without merchant approval.
          </p>
        </div>

      </div>

      {/* FAILED PAYMENT TABLE */}
      <div className="panel">

        <div className="panel-header">
          <div>
            <span className="eyebrow">
              Failure Queue
            </span>

            <h2>Failed Payment Intelligence</h2>
          </div>

          <span className="panel-count">
            {payments.length} cases
          </span>
        </div>

        {payments.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">✓</div>

            <h3>No failed payments detected</h3>

            <p>
              Payment intelligence currently has no active
              failure records requiring attention.
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">

              <thead>
                <tr>
                  <th>Payment</th>
                  <th>Amount</th>
                  <th>Failure Reason</th>
                  <th>Risk</th>
                  <th>AI Recommendation</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.payment_id || payment.id}>

                    <td>
                      <strong>
                        {payment.payment_id || "—"}
                      </strong>
                    </td>

                    <td>
                      {formatCurrency(payment.amount)}
                    </td>

                    <td>
                      <span className="reason-text">
                        {payment.failure_reason || "Unknown"}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`risk-badge ${getRiskClass(
                          payment.risk_level
                        )}`}
                      >
                        {payment.risk_level || "REVIEW"}
                      </span>
                    </td>

                    <td>
                      <span className="recommendation-text">
                        {payment.recommended_action ||
                          "HUMAN_REVIEW"}
                      </span>
                    </td>

                    <td>
                      <button
                        className="secondary-button small-button"
                        onClick={() =>
                          setSelectedPayment(payment)
                        }
                      >
                        Inspect
                      </button>
                    </td>

                  </tr>
                ))}
              </tbody>

            </table>
          </div>
        )}

      </div>

      {/* DETAIL PANEL */}
      {selectedPayment && (
        <div className="panel payment-detail-panel">

          <div className="panel-header">
            <div>
              <span className="eyebrow">
                AI Analysis
              </span>

              <h2>
                {selectedPayment.payment_id}
              </h2>
            </div>

            <button
              className="secondary-button"
              onClick={() => setSelectedPayment(null)}
            >
              Close
            </button>
          </div>

          <div className="detail-grid">

            <div className="detail-item">
              <span>Amount</span>
              <strong>
                {formatCurrency(selectedPayment.amount)}
              </strong>
            </div>

            <div className="detail-item">
              <span>Failure reason</span>
              <strong>
                {selectedPayment.failure_reason || "Unknown"}
              </strong>
            </div>

            <div className="detail-item">
              <span>Risk level</span>
              <strong>
                {selectedPayment.risk_level || "REVIEW"}
              </strong>
            </div>

            <div className="detail-item">
              <span>Recommended action</span>
              <strong>
                {selectedPayment.recommended_action ||
                  "HUMAN_REVIEW"}
              </strong>
            </div>

          </div>

          <div className="approval-note">
            <span>●</span>

            <div>
              <strong>Human approval required</strong>

              <p>
                PayTruth will never execute a financial action
                automatically. A merchant must approve the proposed
                action before sandbox execution.
              </p>
            </div>
          </div>

          <div className="payment-decision-grid">

            <div className="decision-item">
              <span>AI decision</span>
              <strong>
                {selectedPayment.recommended_action ||
                  "HUMAN_REVIEW"}
              </strong>
            </div>

            <div className="decision-item">
              <span>Execution mode</span>
              <strong>SIMULATED / SANDBOX</strong>
            </div>

            <div className="decision-item">
              <span>Automatic action</span>
              <strong>DISABLED</strong>
            </div>

            <div className="decision-item">
              <span>Real money movement</span>
              <strong>NOT PERMITTED</strong>
            </div>

          </div>

          <div className="payment-action-row">

            <button
              className="primary-button"
              onClick={() => {
                console.log(
                  "Payment action sent to Action Center:",
                  selectedPayment.payment_id
                );
              }}
            >
              Send to Action Center →
            </button>

            <span className="action-helper">
              Requires merchant approval
            </span>

          </div>

        </div>
      )}

    </section>
  );
}

export default PaymentIntelligence;