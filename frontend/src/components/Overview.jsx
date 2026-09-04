import React from "react";

function formatCurrency(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

function getHealthTone(status) {
  if (status === "CRITICAL") return "critical";
  if (status === "HIGH RISK") return "high";
  if (status === "MONITOR") return "monitor";
  return "healthy";
}

function Overview({
  summary,
  paymentHealth,
  riskPrioritization,
  paymentFailures
}) {
  const totalTransactions =
    Number(summary?.total_transactions || 0);

  const successfulPayments =
    Number(summary?.successful_payments || 0);

  const totalTransactionValue =
    Number(summary?.total_transaction_value || 0);

  const totalSettlementValue =
    Number(summary?.total_settlement_value || 0);

  const mismatches =
    Number(summary?.mismatches || 0);

  const moneyAtRisk =
    Number(summary?.money_at_risk || 0);

  const failedPayments =
    Number(paymentHealth?.failed_payments || 0);

  const paymentFailureRate =
    totalTransactions > 0
      ? Math.round(
          (failedPayments / totalTransactions) * 100
        )
      : 0;

  const unresolvedCases =
    (riskPrioritization || []).filter(
      item => item.case_status !== "RESOLVED"
    ).length;

  const criticalCases =
    (riskPrioritization || []).filter(
      item =>
        item.case_status !== "RESOLVED" &&
        item.risk_level === "HIGH"
    ).length;

  const highRiskFailures =
    (paymentFailures || []).filter(
      item =>
        item.risk_level === "HIGH" ||
        item.risk_level === "CRITICAL"
    ).length;

  let healthScore = 100;

  if (moneyAtRisk > 0) {
    healthScore -= 25;
  }

  if (mismatches > 0) {
    healthScore -= 10;
  }

  if (paymentFailureRate >= 50) {
    healthScore -= 20;
  } else if (paymentFailureRate >= 20) {
    healthScore -= 10;
  }

  if (criticalCases > 0) {
    healthScore -= 25;
  }

  if (highRiskFailures > 0) {
    healthScore -= 10;
  }

  healthScore = Math.max(0, healthScore);

  let healthStatus = "HEALTHY";

  if (healthScore < 50) {
    healthStatus = "CRITICAL";
  } else if (healthScore < 70) {
    healthStatus = "HIGH RISK";
  } else if (healthScore < 90) {
    healthStatus = "MONITOR";
  }

  const healthTone =
    getHealthTone(healthStatus);

  const attentionItems = [];

  if (criticalCases > 0) {
    attentionItems.push({
      tone: "critical",
      title: "Critical settlement risk",
      text: `${criticalCases} high-risk settlement case requires attention.`
    });
  }

  if (highRiskFailures > 0) {
    attentionItems.push({
      tone: "high",
      title: "Payment failures need review",
      text: `${highRiskFailures} high-risk payment failure requires attention.`
    });
  }

  if (unresolvedCases > 0) {
    attentionItems.push({
      tone: "monitor",
      title: "Open financial cases",
      text: `${unresolvedCases} financial case is still unresolved.`
    });
  }

  if (moneyAtRisk > 0) {
    attentionItems.push({
      tone: "critical",
      title: "Money at risk",
      text: `${formatCurrency(moneyAtRisk)} remains financially exposed.`
    });
  }

  if (attentionItems.length === 0) {
    attentionItems.push({
      tone: "healthy",
      title: "No unresolved financial risk",
      text: "Current monitored financial cases are under control."
    });
  }

  return (
    <div className="overview">

      <div className="overview-heading">

        <div>
          <div className="section-kicker">
            OVERVIEW
          </div>

          <h2>
            Your financial ecosystem at a glance.
          </h2>

          <p>
            PayTruth continuously monitors payments,
            settlements, risk and financial actions.
          </p>
        </div>

        <div className="overview-live">
          <span></span>
          Intelligence systems active
        </div>

      </div>


      <div className="metric-grid">

        <div className="metric-card">

          <div className="metric-icon metric-icon-purple">
            ◇
          </div>

          <div>
            <div className="small-label">
              TRANSACTIONS
            </div>

            <div className="metric-value">
              {totalTransactions}
            </div>

            <div className="metric-description">
              Processed transactions
            </div>
          </div>

        </div>


        <div className="metric-card">

          <div className="metric-icon metric-icon-sage">
            ✓
          </div>

          <div>
            <div className="small-label">
              TRANSACTION VALUE
            </div>

            <div className="metric-value">
              {formatCurrency(totalTransactionValue)}
            </div>

            <div className="metric-description">
              Total payment value
            </div>
          </div>

        </div>


        <div className="metric-card metric-card-dark">

          <div className="metric-icon metric-icon-gold">
            ₹
          </div>

          <div>
            <div className="small-label">
              SETTLEMENT VALUE
            </div>

            <div className="metric-value">
              {formatCurrency(totalSettlementValue)}
            </div>

            <div className="metric-description">
              Merchant settlement value
            </div>
          </div>

        </div>


        <div className="metric-card metric-card-risk">

          <div className="metric-icon metric-icon-coral">
            !
          </div>

          <div>
            <div className="small-label">
              MONEY AT RISK
            </div>

            <div className="metric-value">
              {formatCurrency(moneyAtRisk)}
            </div>

            <div className="metric-description">
              Currently unresolved exposure
            </div>
          </div>

        </div>

      </div>


      <div className="command-grid">

        <div className="health-card">

          <div className="health-card-top">

            <div>
              <div className="section-kicker">
                FINANCIAL HEALTH
              </div>

              <h3>
                Merchant control status
              </h3>
            </div>

            <span
              className={`status-pill ${healthTone}`}
            >
              {healthStatus}
            </span>

          </div>


          <div className="health-score-row">

            <div>
              <span className="health-score">
                {healthScore}
              </span>

              <span className="health-score-max">
                /100
              </span>
            </div>

            <div className="health-score-label">
              Overall intelligence score
            </div>

          </div>


          <div className="health-bar">

            <div
              className={`health-bar-fill ${healthTone}`}
              style={{
                width: `${healthScore}%`
              }}
            ></div>

          </div>


          <div className="health-breakdown">

            <div>
              <span>Successful payments</span>
              <strong>{successfulPayments}</strong>
            </div>

            <div>
              <span>Open cases</span>
              <strong>{unresolvedCases}</strong>
            </div>

            <div>
              <span>Failure rate</span>
              <strong>{paymentFailureRate}%</strong>
            </div>

          </div>

        </div>


        <div className="risk-summary-card">

          <div className="section-kicker">
            RISK SNAPSHOT
          </div>

          <h3>
            What needs attention?
          </h3>

          <div className="attention-list">

            {attentionItems.map(
              (item, index) => (

                <div
                  className={`attention-item ${item.tone}`}
                  key={index}
                >

                  <div className="attention-marker">
                    {item.tone === "healthy"
                      ? "✓"
                      : "!"}
                  </div>

                  <div>
                    <strong>
                      {item.title}
                    </strong>

                    <p>
                      {item.text}
                    </p>
                  </div>

                </div>

              )
            )}

          </div>

        </div>

      </div>


      <div className="insight-grid">

        <div className="insight-card">

          <div className="insight-card-icon purple">
            ✦
          </div>

          <div>
            <div className="small-label">
              AI INTELLIGENCE
            </div>

            <h3>
              Explain before acting
            </h3>

            <p>
              PayTruth analyzes financial evidence
              before recommending an action.
            </p>
          </div>

        </div>


        <div className="insight-card">

          <div className="insight-card-icon coral">
            ◉
          </div>

          <div>
            <div className="small-label">
              CONTROLLED ACTIONS
            </div>

            <h3>
              Human approval first
            </h3>

            <p>
              Financial actions require approval
              before sandbox execution.
            </p>
          </div>

        </div>


        <div className="insight-card">

          <div className="insight-card-icon sage">
            ✓
          </div>

          <div>
            <div className="small-label">
              VERIFICATION
            </div>

            <h3>
              Verify before resolving
            </h3>

            <p>
              Actions are independently verified
              before a financial case is resolved.
            </p>
          </div>

        </div>

      </div>


      <div className="reconciliation-strip">

        <div>
          <div className="small-label">
            RECONCILIATION
          </div>

          <strong>
            {mismatches} mismatch detected
          </strong>

          <span>
            Settlement monitoring is active.
          </span>
        </div>

        <div className="reconciliation-value">
          {formatCurrency(
            totalTransactionValue -
            totalSettlementValue
          )}
        </div>

      </div>

    </div>
  );
}

export default Overview;