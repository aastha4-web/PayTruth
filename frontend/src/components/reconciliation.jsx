import { useEffect, useState } from "react";

function formatCurrency(value) {
  const amount = Number(value || 0);

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(amount);
}

function getRiskClass(risk) {
  const value = String(risk || "").toUpperCase();

  if (value === "HIGH") return "risk-badge high";
  if (value === "MEDIUM") return "risk-badge medium";
  if (value === "LOW") return "risk-badge low";
  if (value === "CRITICAL") return "risk-badge critical";

  return "risk-badge neutral";
}

function getStatusClass(status) {
  const value = String(status || "").toUpperCase();

  if (value === "MATCHED") return "status-badge matched";
  if (value === "RESOLVED") return "status-badge resolved";
  if (value === "INVESTIGATING") return "status-badge investigating";
  if (value === "OPEN") return "status-badge open";

  return "status-badge neutral";
}

function Reconciliation({ onInvestigate, onHistory }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReconciliation = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/reconciliation");

      if (!response.ok) {
        throw new Error(
          `Reconciliation API returned ${response.status}`
        );
      }

      const data = await response.json();

      /*
       * Backend normally returns:
       * {
       *   reconciliation: [...]
       * }
       *
       * This also safely supports an array response.
       */
      const reconciliationData = Array.isArray(data)
        ? data
        : data.reconciliation || [];

      setRecords(reconciliationData);
    } catch (err) {
      console.error("Reconciliation loading error:", err);

      setError(
        "Could not load reconciliation intelligence. Make sure the PayTruth backend is running."
      );

      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReconciliation();
  }, []);

  const totalTransactions = records.length;

  const mismatchRecords = records.filter((item) => {
    return Number(item.difference || 0) > 0;
  });

  const totalDifference = mismatchRecords.reduce(
    (sum, item) =>
      sum + Number(item.difference || 0),
    0
  );

  const openCases = records.filter((item) => {
    const status = String(
      item.case_status || ""
    ).toUpperCase();

    return (
      status === "OPEN" ||
      status === "INVESTIGATING"
    );
  }).length;

  const highRiskCases = records.filter((item) => {
    const risk = String(
      item.risk_level || ""
    ).toUpperCase();

    return risk === "HIGH" || risk === "CRITICAL";
  }).length;

  return (
    <div className="workspace reconciliation-workspace">

      {/* HEADER */}
      <div className="workspace-heading">
        <div>
          <div className="section-kicker">
            SETTLEMENT INTELLIGENCE
          </div>

          <h2>Reconciliation workspace</h2>

          <p>
            Compare merchant transactions against settlement
            records and investigate financial differences.
          </p>
        </div>

        <button
          className="primary-action-button"
          onClick={loadReconciliation}
          disabled={loading}
        >
          {loading
            ? "Refreshing..."
            : "↻ Refresh Intelligence"}
        </button>
      </div>

      {/* ERROR */}
      {error && (
        <div className="intelligence-error">
          <div>
            <strong>Intelligence error</strong>
            <span>{error}</span>
          </div>

          <button
            className="dismiss-error"
            onClick={() => setError("")}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* SUMMARY CARDS */}
      <div className="reconciliation-metrics">

        <div className="recon-metric-card">
          <span className="metric-label">
            TRANSACTIONS
          </span>

          <strong>
            {loading ? "—" : totalTransactions}
          </strong>

          <small>
            Records analysed
          </small>
        </div>

        <div className="recon-metric-card">
          <span className="metric-label">
            MISMATCHES
          </span>

          <strong>
            {loading ? "—" : mismatchRecords.length}
          </strong>

          <small>
            Settlement deviations
          </small>
        </div>

        <div className="recon-metric-card dark">
          <span className="metric-label">
            DIFFERENCE
          </span>

          <strong>
            {loading
              ? "—"
              : formatCurrency(totalDifference)}
          </strong>

          <small>
            Total settlement variance
          </small>
        </div>

        <div className="recon-metric-card">
          <span className="metric-label">
            OPEN CASES
          </span>

          <strong>
            {loading ? "—" : openCases}
          </strong>

          <small>
            Require investigation
          </small>
        </div>

        <div className="recon-metric-card">
          <span className="metric-label">
            HIGH RISK
          </span>

          <strong>
            {loading ? "—" : highRiskCases}
          </strong>

          <small>
            Priority cases
          </small>
        </div>

      </div>

      {/* RECORD COMPARISON */}
      <div className="reconciliation-panel">

        <div className="panel-heading">
          <div>
            <div className="section-kicker">
              RECORD COMPARISON
            </div>

            <h3>
              Transaction reconciliation
            </h3>

            <p>
              Live transaction and settlement records
              from the PayTruth database.
            </p>
          </div>

          <div className="live-indicator">
            <span></span>
            Live backend data
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="loading-orb"></div>

            <h3>
              Analysing financial records
            </h3>

            <p>
              PayTruth is comparing transactions
              against settlement records.
            </p>
          </div>
        ) : records.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              ◇
            </div>

            <h3>
              No reconciliation records
            </h3>

            <p>
              No transaction records were returned
              by the intelligence engine.
            </p>
          </div>
        ) : (
          <div className="table-wrapper">

            <table className="intelligence-table">

              <thead>
                <tr>
                  <th>Transaction</th>
                  <th>Transaction amount</th>
                  <th>Settlement amount</th>
                  <th>Difference</th>
                  <th>Risk</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {records.map((item, index) => {

                  const transactionId =
                    item.transaction_id ||
                    item.transactionId ||
                    `TXN-${index + 1}`;

                  const transactionAmount =
                    Number(
                      item.transaction_amount ||
                      item.transactionAmount ||
                      0
                    );

                  const settlementAmount =
                    Number(
                      item.settlement_amount ||
                      item.settlementAmount ||
                      0
                    );

                  const difference =
                    Number(item.difference || 0);

                  const riskLevel =
                    item.risk_level ||
                    item.riskLevel ||
                    "LOW";

                  const caseStatus =
                    item.case_status ||
                    item.caseStatus ||
                    (difference > 0
                      ? "OPEN"
                      : "MATCHED");

                  return (
                    <tr key={`${transactionId}-${index}`}>

                      <td>
                        <div className="transaction-cell">
                          <strong>
                            {transactionId}
                          </strong>

                          <span>
                            Payment record
                          </span>
                        </div>
                      </td>

                      <td>
                        {formatCurrency(
                          transactionAmount
                        )}
                      </td>

                      <td>
                        {formatCurrency(
                          settlementAmount
                        )}
                      </td>

                      <td>
                        <strong
                          className={
                            difference > 0
                              ? "difference-value"
                              : "difference-zero"
                          }
                        >
                          {formatCurrency(difference)}
                        </strong>
                      </td>

                      <td>
                        <span
                          className={getRiskClass(
                            riskLevel
                          )}
                        >
                          {riskLevel}
                        </span>
                      </td>

                      <td>
                        <span
                          className={getStatusClass(
                            caseStatus
                          )}
                        >
                          {caseStatus}
                        </span>
                      </td>

                      <td>
                        <div className="row-actions">

                          {difference > 0 && (
                            <button
                              className="table-action primary"
                              onClick={() =>
                                onInvestigate &&
                                onInvestigate(
                                  transactionId
                                )
                              }
                            >
                              Investigate
                            </button>
                          )}

                          {difference > 0 && (
                            <button
                              className="table-action secondary"
                              onClick={() =>
                                onHistory &&
                                onHistory(item.id)
                              }
                            >
                              History
                            </button>
                          )}

                          {difference === 0 && (
                            <span className="matched-label">
                              ✓ Matched
                            </span>
                          )}

                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>

            </table>
          </div>
        )}

      </div>

      {/* EXPLANATION STRIP */}
      <div className="reconciliation-explanation">

        <div className="explanation-icon">
          ✦
        </div>

        <div>
          <div className="section-kicker">
            HOW PAYTRUTH WORKS
          </div>

          <h3>
            Detect → explain → control
          </h3>

          <p>
            PayTruth compares transaction and settlement
            records, identifies financial deviations,
            prioritizes risk and routes important cases
            into the human approval workflow.
          </p>
        </div>

      </div>

    </div>
  );
}

export default Reconciliation;