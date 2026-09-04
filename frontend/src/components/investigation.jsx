import { useEffect, useState } from "react";

export default function Investigation() {
  const [transactionId, setTransactionId] = useState("TXN1004");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [investigating, setInvestigating] = useState(false);
  const [error, setError] = useState("");

  const investigate = async (id = transactionId) => {
    const cleanId = id.trim().toUpperCase();

    if (!cleanId) {
      setError("Please enter a transaction ID.");
      return;
    }

    try {
      setInvestigating(true);
      setError("");

      const response = await fetch(`/investigate/${cleanId}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.message || "Could not investigate transaction."
        );
      }

      setData(result);
    } catch (err) {
      console.error(err);
      setError(err.message || "Unable to investigate transaction.");
      setData(null);
    } finally {
      setInvestigating(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    investigate("TXN1004");
  }, []);

  if (loading) {
    return (
      <section className="workspace">
        <div className="loading-state">
          Running AI investigation...
        </div>
      </section>
    );
  }

  const transaction = data?.transaction || {};
  const settlement = data?.settlement || {};
  const mismatch = data?.mismatch || {};
  const recommendation = data?.recommendation || {};
  const explanation = data?.explanation || {};

  const difference = Number(mismatch?.difference || 0);
  const confidence = Number(data?.confidence ?? 0);

  const isContradiction = Boolean(data?.contradiction_detected);
  const hasMismatch = Boolean(mismatch?.detected);

  const explainedDifference = Number(
    data?.explained_difference ?? difference
  );

  const unexplainedDifference = Number(
    data?.unexplained_difference ?? 0
  );

  const evidenceCoverage = Number(
    data?.evidence_coverage ?? 0
  );

  return (
    <section className="workspace">

      {/* HEADER */}
      <div className="workspace-header">
        <div>
          <div className="eyebrow">
            PAYTRUTH / AI INTELLIGENCE
          </div>

          <h1>AI Investigation</h1>

          <p>
            Investigate transaction discrepancies using evidence,
            contradiction detection, confidence, and AI abstention.
          </p>
        </div>

        <div className="status-pill">
          Evidence-driven analysis
        </div>
      </div>

      {/* SEARCH */}
      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-kicker">
              INVESTIGATION ENGINE
            </div>

            <h2>Investigate a transaction</h2>
          </div>
        </div>

        <div className="search-row">
          <input
            className="search-input"
            value={transactionId}
            onChange={(e) =>
              setTransactionId(e.target.value.toUpperCase())
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                investigate(transactionId);
              }
            }}
            placeholder="Transaction ID"
          />

          <button
            className="primary-button"
            onClick={() => investigate(transactionId)}
            disabled={investigating}
          >
            {investigating ? "Investigating..." : "Investigate"}
          </button>
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div className="error-banner">
          {error}
        </div>
      )}

      {/* INVESTIGATION RESULT */}
      {data && (
        <>
          {/* TRANSACTION SNAPSHOT */}
          <div className="metric-grid">

            <div className="metric-card">
              <span>Transaction</span>
              <strong>
                {transaction.transaction_id || transactionId}
              </strong>
            </div>

            <div className="metric-card">
              <span>Transaction Amount</span>
              <strong>
                ₹{Number(transaction.amount || 0).toLocaleString()}
              </strong>
            </div>

            <div className="metric-card">
              <span>Settlement</span>
              <strong>
                ₹{Number(settlement.amount || 0).toLocaleString()}
              </strong>
            </div>

            <div className="metric-card">
              <span>Difference</span>
              <strong>
                ₹{difference.toLocaleString()}
              </strong>
            </div>

          </div>

          {/* INVESTIGATION STATUS */}
          <div className="panel">
            <div className="panel-header">
              <div>
                <div className="panel-kicker">
                  INVESTIGATION STATUS
                </div>

                <h2>
                  {isContradiction
                    ? "Contradictory evidence detected"
                    : hasMismatch
                    ? "Settlement discrepancy detected"
                    : "No settlement discrepancy detected"}
                </h2>
              </div>

              <span className="panel-count">
                {data?.investigation_status || "ANALYZED"}
              </span>
            </div>

            <div className="notification-item">
              <div className="notification-main">

                <h3>
                  {hasMismatch
                    ? `₹${difference.toLocaleString()} difference identified`
                    : "Transaction and settlement are aligned"}
                </h3>

                <p>
                  {hasMismatch
                    ? "PayTruth compared the transaction, settlement, and related financial records to determine whether the difference is explained."
                    : "PayTruth found no financial discrepancy requiring investigation."}
                </p>

              </div>
            </div>
          </div>

          {/* EVIDENCE TRAIL */}
          <div className="panel">

            <div className="panel-header">
              <div>
                <div className="panel-kicker">
                  EVIDENCE TRAIL
                </div>

                <h2>What PayTruth found</h2>
              </div>
            </div>

            <div className="investigation-evidence">

              <div className="evidence-step">
                <div className="evidence-marker">1</div>

                <div>
                  <span className="small-label">
                    TRANSACTION RECORD
                  </span>

                  <h3>
                    ₹{Number(transaction.amount || 0).toLocaleString()}
                  </h3>

                  <p>
                    {transaction.transaction_id || transactionId}
                    {" · "}
                    {transaction.payment_status || "Payment recorded"}
                  </p>
                </div>
              </div>

              <div className="evidence-connector" />

              <div className="evidence-step">
                <div className="evidence-marker">2</div>

                <div>
                  <span className="small-label">
                    SETTLEMENT RECORD
                  </span>

                  <h3>
                    ₹{Number(settlement.amount || 0).toLocaleString()}
                  </h3>

                  <p>
                    Settlement amount identified by PayTruth.
                  </p>
                </div>
              </div>

              <div className="evidence-connector" />

              <div className="evidence-step">
                <div className="evidence-marker">3</div>

                <div>
                  <span className="small-label">
                    FINANCIAL ADJUSTMENT
                  </span>

                  <h3>
                    ₹{explainedDifference.toLocaleString()}
                  </h3>

                  <p>
                    {data?.root_cause ||
                      explanation?.root_cause ||
                      "Related financial adjustment identified."}
                  </p>
                </div>
              </div>

            </div>

            <div className="investigation-summary-row">

              <div>
                <span>Explained difference</span>
                <strong>
                  ₹{explainedDifference.toLocaleString()}
                </strong>
              </div>

              <div>
                <span>Unexplained difference</span>
                <strong>
                  ₹{unexplainedDifference.toLocaleString()}
                </strong>
              </div>

              <div>
                <span>Evidence coverage</span>
                <strong>
                  {evidenceCoverage}%
                </strong>
              </div>

            </div>

          </div>

          {/* ROOT CAUSE + CONFIDENCE */}
          <div className="investigation-two-column">

            <div className="panel">

              <div className="panel-kicker">
                ROOT-CAUSE ANALYSIS
              </div>

              <h2>
                {data?.root_cause_type ||
                  "Financial adjustment"}
              </h2>

              <p className="investigation-body">
                {data?.root_cause ||
                  recommendation?.reason ||
                  "PayTruth analyzed the available financial evidence."}
              </p>

              {data?.explained_difference !== undefined && (
                <div className="insight-highlight">
                  <strong>
                    ₹{explainedDifference.toLocaleString()}
                  </strong>

                  <span>
                    of the difference is explained by available evidence.
                  </span>
                </div>
              )}

            </div>

            <div className="panel">

              <div className="panel-kicker">
                AI CONFIDENCE
              </div>

              <div className="confidence-display">
                <strong>{confidence}%</strong>

                <span>
                  {data?.confidence_status || "REVIEW"}
                </span>
              </div>

              <div className="confidence-bar">
                <div
                  className="confidence-fill"
                  style={{
                    width: `${Math.min(
                      Math.max(confidence, 0),
                      100
                    )}%`,
                  }}
                />
              </div>

              <p className="investigation-body">
                {data?.confidence_status === "ABSTAIN"
                  ? data?.abstain_reason ||
                    "PayTruth does not have sufficient confidence to recommend an automatic action."
                  : `PayTruth reached this conclusion using the available transaction, settlement, and adjustment evidence.`}
              </p>

            </div>

          </div>

          {/* AI DECISION */}
          <div className="panel">

            <div className="panel-header">
              <div>
                <div className="panel-kicker">
                  AI DECISION
                </div>

                <h2>
                  {recommendation?.type ||
                    data?.recommendation ||
                    "REVIEW"}
                </h2>
              </div>

              <span className="panel-count">
                {data?.recommendation_allowed
                  ? "ACTION AVAILABLE"
                  : "CONTROLLED"}
              </span>
            </div>

            <div className="decision-card">

              <div>
                <span className="small-label">
                  PROPOSED ACTION
                </span>

                <h3>
                  {recommendation?.proposed_action ||
                    "Review the financial records"}
                </h3>

                <p>
                  {recommendation?.reason ||
                    data?.root_cause ||
                    "PayTruth completed the investigation and generated a recommendation based on the available evidence."}
                </p>
              </div>

            </div>

          </div>

          {/* SAFETY + APPROVAL */}
          <div className="safety-banner">

            <div>

              <strong>
                🛡️ Controlled financial action
              </strong>

              <p>
                {isContradiction
                  ? "Evidence is contradictory. PayTruth abstains from recommending an automatic financial action and requires human review."
                  : "PayTruth can analyze and recommend an action, but financial actions require human authorization. Approved actions run only in sandbox mode and are independently verified."}
              </p>

            </div>

            <span>
              HUMAN APPROVAL REQUIRED
            </span>

          </div>

        </>
      )}

    </section>
  );
}