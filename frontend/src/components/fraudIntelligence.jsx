import { useEffect, useState } from "react";

function FraudIntelligence() {
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadFraudIntelligence = async () => {
      try {
        setLoading(true);

        const response = await fetch("/fraud-intelligence");

        if (!response.ok) {
          throw new Error("Could not load fraud intelligence.");
        }

        const result = await response.json();

        setData(result);

        const fraudItems =
          result?.fraud_analysis ||
          result?.fraud_cases ||
          result?.payments ||
          [];

        if (fraudItems.length > 0) {
          setSelected(fraudItems[0]);
        }
      } catch (err) {
        console.error(err);
        setError("Unable to load fraud intelligence.");
      } finally {
        setLoading(false);
      }
    };

    loadFraudIntelligence();
  }, []);

  if (loading) {
    return (
      <section className="workspace">
        <div className="page-heading">
          <div>
            <span className="eyebrow">AI Fraud Intelligence</span>
            <h1>Fraud & Anomaly</h1>
            <p>Analyzing payment behaviour and suspicious patterns.</p>
          </div>
        </div>

        <div className="panel">
          <p>Loading fraud intelligence...</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="workspace">
        <div className="page-heading">
          <div>
            <span className="eyebrow">AI Fraud Intelligence</span>
            <h1>Fraud & Anomaly</h1>
          </div>
        </div>

        <div className="panel">
          <p>{error}</p>
        </div>
      </section>
    );
  }

  const fraudItems =
    data?.fraud_analysis ||
    data?.fraud_cases ||
    data?.payments ||
    [];

  const summary = data?.summary || {};
  const criticalCount = fraudItems.filter(
  (item) =>
    String(
      item.risk_level ||
      item.risk ||
      ""
    ).toUpperCase() === "CRITICAL"
).length;

const highCount = fraudItems.filter(
  (item) =>
    String(
      item.risk_level ||
      item.risk ||
      ""
    ).toUpperCase() === "HIGH"
).length;

const suspiciousCount = fraudItems.filter(
  (item) => Number(
    item.fraud_score ??
    item.score ??
    0
  ) >= 40
).length;

  return (
    <section className="workspace">

      <div className="page-heading">
        <div>
          <span className="eyebrow">AI Fraud Intelligence</span>

          <h1>Fraud & Anomaly</h1>

          <p>
            Detect suspicious payment patterns, prioritize risk,
            and route important decisions through human approval.
          </p>
        </div>

        <div className="status-pill">
          ● Investigation mode
        </div>
      </div>

      <div className="metric-grid">

        <div className="metric-card">
          <span>Total Payments</span>
          <strong>
            {summary.total_payments ?? fraudItems.length}
          </strong>
          <small>Analyzed by PayTruth AI</small>
        </div>

        <div className="metric-card">
          <span>Critical Risk</span>
          <strong>
            {summary.critical ?? summary.critical_cases ?? criticalCount}
          </strong>
          <small>Requires investigation</small>
        </div>

        <div className="metric-card">
          <span>High Risk</span>
          <strong>
            {summary.high ?? summary.high_risk ?? highCount}
          </strong>
          <small>Elevated attention</small>
        </div>

        <div className="metric-card">
          <span>Suspicious</span>
          <strong>
            {summary.suspicious ?? suspiciousCount}
          </strong>
          <small>Patterns requiring review</small>
        </div>

      </div>

      <div className="workspace-grid">

        <div className="panel">

          <div className="panel-header">
            <div>
              <span className="eyebrow">Detected Patterns</span>
              <h2>Payment Risk Queue</h2>
            </div>

            <span className="panel-count">
              {fraudItems.length} items
            </span>
          </div>

          <div className="risk-list">

            {fraudItems.map((item, index) => {

              const paymentId =
                item.payment_id ||
                item.paymentId ||
                `Payment ${index + 1}`;

              const score =
                Number(
                  item.fraud_score ??
                  item.score ??
                  0
                );

              const risk =
                item.risk_level ||
                item.risk ||
                "LOW";

              const action =
                item.recommended_action ||
                item.recommendation?.type ||
                "HUMAN_REVIEW";

              return (
                <button
                  key={paymentId}
                  type="button"
                  className={`risk-row ${
                    selected === item ? "selected" : ""
                  }`}
                  onClick={() => setSelected(item)}
                >

                  <div className="risk-main">

                    <strong>{paymentId}</strong>

                    <span>
                      Risk score {score}
                    </span>

                  </div>

                  <span
                    className={`risk-badge risk-${risk.toLowerCase()}`}
                  >
                    {risk}
                  </span>

                </button>
              );
            })}

            {fraudItems.length === 0 && (
              <div className="empty-state">
                No suspicious payment patterns detected.
              </div>
            )}

          </div>

        </div>

        <div className="panel">

          <div className="panel-header">
            <div>
              <span className="eyebrow">AI Analysis</span>
              <h2>Investigation Details</h2>
            </div>
          </div>

          {selected ? (
            <div className="investigation-detail">

              <div className="detail-title">
                <div>
                  <span className="eyebrow">Payment</span>
                  <h3>
                    {selected.payment_id ||
                      selected.paymentId ||
                      "Unknown payment"}
                  </h3>
                </div>

                <span
                  className={`risk-badge risk-${String(
                    selected.risk_level ||
                    selected.risk ||
                    "LOW"
                  ).toLowerCase()}`}
                >
                  {selected.risk_level ||
                    selected.risk ||
                    "LOW"}
                </span>
              </div>

              <div className="decision-grid">

                <div>
                  <span>Fraud Score</span>
                  <strong>
                    {selected.fraud_score ??
                      selected.score ??
                      0}
                  </strong>
                </div>

                <div>
                  <span>Recommended Action</span>
                  <strong>
                    {selected.recommended_action ||
                      selected.recommendation?.type ||
                      "HUMAN_REVIEW"}
                  </strong>
                </div>

                <div>
                  <span>Human Approval</span>
                  <strong>REQUIRED</strong>
                </div>

                <div>
                  <span>Automatic Action</span>
                  <strong>DISABLED</strong>
                </div>

              </div>

              <div className="detail-section">

                <span className="eyebrow">
                  AI Reason
                </span>

                <p>
                  {selected.ai_reason ||
                    selected.reason ||
                    "PayTruth detected a suspicious payment pattern that requires human investigation."}
                </p>

              </div>

              <div className="detail-section">

                <span className="eyebrow">
                  Safety Controls
                </span>

                <div className="safety-list">

                  <div>
                    <span>Fraud confirmation</span>
                    <strong>NOT CONFIRMED</strong>
                  </div>

                  <div>
                    <span>Financial action</span>
                    <strong>HUMAN APPROVAL</strong>
                  </div>

                  <div>
                    <span>Real money movement</span>
                    <strong>NOT PERMITTED</strong>
                  </div>

                </div>

              </div>

            </div>
          ) : (
            <div className="empty-state">
              Select a payment to inspect its AI analysis.
            </div>
          )}

        </div>

      </div>

    </section>
  );
}

export default FraudIntelligence;