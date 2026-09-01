import { useEffect, useState } from "react";

function App() {
  const [summary, setSummary] = useState(null);
  const [reconciliation, setReconciliation] = useState([]);
  const [cases, setCases] = useState([]);
  const [approvalActions, setApprovalActions] = useState([]);
  const [investigation, setInvestigation] = useState(null);
  const [caseHistory, setCaseHistory] = useState(null);
  const [paymentHealth, setPaymentHealth] = useState(null);
  const [riskPrioritization, setRiskPrioritization] = useState([]);

  // ==========================================
  // APPROVE / REJECT ACTION
  // ==========================================

  const handleApproval = async (actionId, decision) => {
    try {
      const response = await fetch(
        `http://localhost:5000/approval-actions/${actionId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            decision: decision,
            approved_by: "Merchant",
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        alert(data.message);
        return;
      }

      // Update approval status
      setApprovalActions((currentActions) =>
        currentActions.map((action) =>
          action.id === actionId ? data : action
        )
      );

      // ==========================================
      // IF APPROVED → EXECUTE ACTION
      // ==========================================

      if (decision === "APPROVED") {
        const executeResponse = await fetch(
          `http://localhost:5000/approval-actions/${actionId}/execute`,
          {
            method: "POST",
          }
        );

        const executeData = await executeResponse.json();

        if (!executeResponse.ok) {
          alert(executeData.message);
          return;
        }

        // Update execution status
        setApprovalActions((currentActions) =>
          currentActions.map((action) =>
            action.id === actionId
              ? executeData.action
              : action
          )
        );

        alert("Action approved and executed successfully!");
      } else {
        alert("Action rejected.");
      }

    } catch (error) {
      console.error("Approval error:", error);
      alert("Could not process action.");
    }
  };

  // ==========================================
  // VERIFY ACTION
  // ==========================================

  const handleVerification = async (actionId, caseId) => {
    try {
      // Verify the action
      const response = await fetch(
        `http://localhost:5000/approval-actions/${actionId}/verify`,
        {
          method: "POST",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        alert(data.message);
        return;
      }

      // Update verification status
      setApprovalActions((currentActions) =>
        currentActions.map((action) =>
          action.id === actionId ? data.action : action
        )
      );

      // Resolve related case
      const caseResponse = await fetch(
        `http://localhost:5000/cases/${caseId}/resolve`,
        {
          method: "PATCH",
        }
      );

      const updatedCase = await caseResponse.json();

      if (!caseResponse.ok) {
        alert(updatedCase.message);
        return;
      }

      // Update case on dashboard
      setCases((currentCases) =>
        currentCases.map((item) =>
          item.id === caseId ? updatedCase : item
        )
      );

      alert("Action verified and case resolved successfully!");

    } catch (error) {
      console.error("Verification error:", error);
      alert("Could not verify action.");
    }
  };

  // ==========================================
  // LOAD DATA FROM BACKEND
  // ==========================================
// ==========================================
// ==========================================
// LOAD CASE HISTORY
// ==========================================

const handleCaseHistory = async (caseId) => {
  try {
    const response = await fetch(
      `http://localhost:5000/cases/${caseId}/history`
    );

    const data = await response.json();

    if (!response.ok) {
      alert(data.message);
      return;
    }

    setCaseHistory(data);

  } catch (error) {
    console.error("Case history error:", error);
    alert("Could not load case history.");
  }
};
// INVESTIGATE TRANSACTION
// ==========================================

const handleInvestigation = async (transactionId) => {
  try {
    const response = await fetch(
      `http://localhost:5000/investigate/${transactionId}`
    );

    const data = await response.json();

    if (!response.ok) {
      alert(data.message);
      return;
    }

    setInvestigation(data);

  } catch (error) {
    console.error("Investigation error:", error);
    alert("Could not investigate transaction.");
  }
};
  useEffect(() => {

    // Summary
    fetch("http://localhost:5000/summary")
      .then((response) => response.json())
      .then((data) => setSummary(data))
      .catch((error) =>
        console.error("Summary error:", error)
      );

    // Reconciliation
    fetch("http://localhost:5000/reconciliation")
      .then((response) => response.json())
      .then((data) => setReconciliation(data))
      .catch((error) =>
        console.error("Reconciliation error:", error)
      );

    // Mismatch Cases
    fetch("http://localhost:5000/cases")
      .then((response) => response.json())
      .then((data) => setCases(data))
      .catch((error) =>
        console.error("Cases error:", error)
      );

    // AI Approval Actions
    fetch("http://localhost:5000/approval-actions")
      .then((response) => response.json())
      .then((data) => setApprovalActions(data))
      .catch((error) =>
        console.error("Approval actions error:", error)
      );
      // Payment Health
fetch("http://localhost:5000/payment-health")
  .then((response) => response.json())
  .then((data) => setPaymentHealth(data))
  .catch((error) =>
    console.error("Payment health error:", error)
  );
  // AI Risk Prioritization
fetch("http://localhost:5000/risk-prioritization")
  .then((response) => response.json())
  .then((data) => setRiskPrioritization(data))
  .catch((error) =>
    console.error("Risk prioritization error:", error)
  );
      
  }, []);

  // ==========================================
  // DASHBOARD
  // ==========================================

  return (
    <div>

      <h1>PayTruth AI</h1>

      <p>
        Payment & Settlement Intelligence Dashboard
      </p>

      <hr />

      {/* ======================================
          OVERVIEW
      ====================================== */}

      <h2>Overview</h2>

      {summary ? (
        <div>

          <h3>Total Transactions</h3>
          <p>{summary.total_transactions}</p>

          <h3>Mismatches</h3>
          <p>{summary.mismatches}</p>

          <h3>Money at Risk</h3>
          <p>₹{summary.money_at_risk}</p>

        </div>
      ) : (
        <p>Loading...</p>
      )}

      <hr />
      <hr />

<h2>❤️ Payment Health</h2>

{paymentHealth ? (
  <div>

    <h3>Total Transactions</h3>
    <p>{paymentHealth.total_transactions}</p>

    <h3>Successful Payments</h3>
    <p>{paymentHealth.successful_payments}</p>

    <h3>Failed Payments</h3>
    <p>{paymentHealth.failed_payments}</p>

    <h3>Total Transaction Value</h3>
    <p>₹{paymentHealth.total_transaction_value}</p>

    <h3>Total Settlement Value</h3>
    <p>₹{paymentHealth.total_settlement_value}</p>

    <h3>Mismatches</h3>
    <p>{paymentHealth.mismatches}</p>

    <h3>Money at Risk</h3>
    <p>₹{paymentHealth.money_at_risk}</p>

    <h3>Resolved Cases</h3>
    <p>{paymentHealth.resolved_cases}</p>

    <h3>Total Cases</h3>
    <p>{paymentHealth.total_cases}</p>

  </div>
) : (
  <p>Loading payment health...</p>
)}

      {/* ======================================
          RECONCILIATION
      ====================================== */}

      <h2>Reconciliation</h2>

      <table border="1" cellPadding="10">

        <thead>
          <tr>
            <th>Transaction</th>
            <th>Merchant</th>
            <th>Transaction Amount</th>
            <th>Settlement</th>
            <th>Difference</th>
            <th>Risk</th>
          </tr>
        </thead>

        <tbody>

          {reconciliation.map((item) => (

            <tr key={item.transaction_id}>

              <td>{item.transaction_id}</td>

              <td>{item.merchant_id}</td>

              <td>
                ₹{item.transaction_amount}
              </td>

              <td>
                ₹{item.settlement_amount}
              </td>

              <td>
                ₹{item.difference}
              </td>

              <td>
                {item.risk_level}
              </td>

            </tr>

          ))}

        </tbody>

      </table>

      <hr />

      {/* ======================================
          MISMATCH CASES
      ====================================== */}

      <h2>🚨 Mismatch Cases</h2>

      <table border="1" cellPadding="10">

        <thead>

          <tr>
  <th>Case ID</th>
  <th>Transaction</th>
  <th>Difference</th>
  <th>Risk</th>
  <th>Status</th>
  <th>Action</th>
</tr>

        </thead>

        <tbody>

          {cases.map((item) => (

            <tr key={item.id}>

              <td>{item.id}</td>

              <td>{item.transaction_id}</td>

              <td>₹{item.difference}</td>

              <td>{item.risk_level}</td>

              <td>{item.case_status}</td>
              <td>
  <button
    onClick={() =>
      handleInvestigation(item.transaction_id)
    }
  >
    🔍 Investigate
  </button>
  {" "}

<button
  onClick={() =>
    handleCaseHistory(item.id)
  }
>
  📜 History
</button>
</td>

            </tr>

          ))}

        </tbody>

      </table>

      <hr />

      {/* ======================================
          AI RECOMMENDATIONS
      ====================================== */}
      <hr />
      <hr />

{/* ======================================
    AI RISK PRIORITIZATION
====================================== */}

<h2>🎯 AI Risk Prioritization</h2>

{riskPrioritization.length === 0 ? (

  <p>No mismatch cases available for prioritization.</p>

) : (

  <table border="1" cellPadding="10">

    <thead>

      <tr>
        <th>Case ID</th>
        <th>Transaction</th>
        <th>Difference</th>
        <th>Risk Level</th>
        <th>Case Status</th>
        <th>AI Priority</th>
        <th>Priority Score</th>
      </tr>

    </thead>

    <tbody>

      {riskPrioritization.map((item) => (

        <tr key={item.id}>

          <td>{item.id}</td>

          <td>{item.transaction_id}</td>

          <td>₹{item.difference}</td>

          <td>{item.risk_level}</td>

          <td>{item.case_status}</td>

          <td>
            {item.priority}
          </td>

          <td>
            {item.priority_score}
          </td>

        </tr>

      ))}

    </tbody>

  </table>

)}

{/* ======================================
    AI INVESTIGATION
====================================== */}

<h2>🧠 AI Investigation</h2>

{investigation ? (

  <div>

    <h3>
      Transaction: {investigation.transaction_id}
    </h3>

    <p>
      <strong>Investigation Status:</strong>{" "}
      {investigation.investigation_status}
    </p>

    <p>
      <strong>Transaction Amount:</strong>{" "}
      ₹{investigation.transaction.amount}
    </p>

    <p>
      <strong>Settlement Amount:</strong>{" "}
      ₹{investigation.settlement.amount}
    </p>

    <p>
      <strong>Difference:</strong>{" "}
      ₹{investigation.mismatch.difference}
    </p>

    <p>
      <strong>Root Cause Type:</strong>{" "}
      {investigation.root_cause_type}
    </p>

    <p>
      <strong>Root Cause:</strong>{" "}
      {investigation.root_cause}
    </p>

    <p>
      <strong>Confidence:</strong>{" "}
      {investigation.confidence}%
    </p>

    <p>
      <strong>Unexplained Difference:</strong>{" "}
      ₹{investigation.unexplained_difference}
    </p>

    <p>
      <strong>Recommended Action:</strong>{" "}
      {investigation.recommended_action}
    </p>

    <p>
      <strong>Human Approval Required:</strong>{" "}
      {investigation.human_approval_required
        ? "YES"
        : "NO"}
    </p>

    <h3>Financial Evidence</h3>

    {investigation.financial_evidence.map(
      (evidence, index) => (

        <div key={index}>

          <p>
            <strong>
              {evidence.check}
            </strong>
          </p>

          {evidence.adjustment_type && (
            <p>
              Adjustment:{" "}
              {evidence.adjustment_type}
            </p>
          )}

          {evidence.amount !== undefined && (
            <p>
              Amount: ₹{evidence.amount}
            </p>
          )}

          {evidence.difference !== undefined && (
            <p>
              Difference: ₹{evidence.difference}
            </p>
          )}

          <p>
            Result: {evidence.result}
          </p>

          <hr />

        </div>

      )
    )}

  </div>

) : (

  <p>Loading AI investigation...</p>

)}
<hr />

{/* ======================================
    CASE HISTORY
====================================== */}

<h2>📜 Case History</h2>

{caseHistory ? (

  <div>

    <h3>
      Case #{caseHistory.case.id}
    </h3>

    <p>
      <strong>Transaction:</strong>{" "}
      {caseHistory.case.transaction_id}
    </p>

    <p>
      <strong>Difference:</strong>{" "}
      ₹{caseHistory.case.difference}
    </p>

    <p>
      <strong>Risk Level:</strong>{" "}
      {caseHistory.case.risk_level}
    </p>

    <p>
      <strong>Current Status:</strong>{" "}
      {caseHistory.case.case_status}
    </p>

    <h3>Action History</h3>

    {caseHistory.actions.map((action) => (

      <div key={action.id}>

        <p>
          <strong>Action:</strong>{" "}
          {action.action_type}
        </p>

        <p>
          <strong>Approval:</strong>{" "}
          {action.approval_status}
        </p>

        <p>
          <strong>Execution:</strong>{" "}
          {action.execution_status}
        </p>

        <p>
          <strong>Verification:</strong>{" "}
          {action.verification_status}
        </p>

        <p>
          <strong>Approved By:</strong>{" "}
          {action.approved_by || "Not available"}
        </p>

        <hr />

      </div>

    ))}

  </div>

) : (

  <p>Select a case and click 📜 History.</p>

)}

      <h2>🤖 AI Recommendations</h2>

      {approvalActions.length === 0 ? (

        <p>No AI recommendations available.</p>

      ) : (

        approvalActions.map((action) => (

          <div key={action.id}>

            <h3>
              {action.action_type}
            </h3>

            <p>
              <strong>Case ID:</strong>{" "}
              {action.case_id}
            </p>

            <p>
              <strong>AI Reason:</strong>{" "}
              {action.ai_reason}
            </p>

            <p>
              <strong>Proposed Action:</strong>{" "}
              {action.proposed_action}
            </p>

            <p>
              <strong>Approval Status:</strong>{" "}
              {action.approval_status}
            </p>

            <p>
              <strong>Execution Status:</strong>{" "}
              {action.execution_status}
            </p>

            <p>
              <strong>Verification Status:</strong>{" "}
              {action.verification_status}
            </p>

            {/* ==============================
                APPROVE / REJECT
            ============================== */}

            {action.approval_status === "PENDING" && (

              <div>

                <button
                  onClick={() =>
                    handleApproval(
                      action.id,
                      "APPROVED"
                    )
                  }
                >
                  ✅ APPROVE
                </button>

                {" "}

                <button
                  onClick={() =>
                    handleApproval(
                      action.id,
                      "REJECTED"
                    )
                  }
                >
                  ❌ REJECT
                </button>

              </div>

            )}

            {/* ==============================
                VERIFY
            ============================== */}

            {action.approval_status === "APPROVED" &&
              action.execution_status === "EXECUTED" &&
              action.verification_status === "NOT_VERIFIED" && (

                <button
                  onClick={() =>
                    handleVerification(
                      action.id,
                      action.case_id
                    )
                  }
                >
                  🔍 VERIFY ACTION
                </button>

              )}

            <hr />

          </div>

        ))

      )}

    </div>
  );
}

export default App;