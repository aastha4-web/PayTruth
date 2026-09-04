import { useEffect, useMemo, useState } from "react";

function ActionCenter() {
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(null);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [activeAction, setActiveAction] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [filter, setFilter] = useState("ALL");

  const [approval, setApproval] = useState(null);

  const loadActions = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/action-orchestration");

      if (!response.ok) {
        throw new Error(
          "Could not load action orchestration."
        );
      }

      const result = await response.json();

      setData(result);

      const actionQueue = result?.action_queue || [];

      if (actionQueue.length > 0) {
        setSelected(actionQueue[0]);
      } else {
        setSelected(null);
      }

      const approvalResponse =
        await fetch("/approval-actions");

      if (approvalResponse.ok) {
        const approvalData =
          await approvalResponse.json();

        const approvalList =
          Array.isArray(approvalData)
            ? approvalData
            : [];

        if (actionQueue.length > 0) {
          const firstAction = actionQueue[0];

          let existingApproval = null;

          if (
            firstAction.source ===
            "FRAUD_INTELLIGENCE"
          ) {
            existingApproval =
              approvalList.find(
                (item) =>
                  Number(item.fraud_case_id) ===
                  Number(firstAction.reference_id)
              );
          }

          if (
            firstAction.source ===
            "PAYMENT_FAILURE_INTELLIGENCE"
          ) {
            existingApproval =
              approvalList.find(
                (item) =>
                  Number(
                    item.payment_failure_case_id
                  ) ===
                  Number(firstAction.reference_id)
              );
          }

          if (
            firstAction.source ===
            "SETTLEMENT_RECONCILIATION"
          ) {
            existingApproval =
              approvalList.find(
                (item) =>
                  Number(item.case_id) ===
                  Number(firstAction.reference_id)
              );
          }

          if (existingApproval) {
            setApproval(existingApproval);
          } else {
            setApproval(null);
          }
        }
      }
    } catch (err) {
      console.error(
        "Action Center error:",
        err
      );

      setError(
        "Unable to load the AI action queue."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActions();
  }, []);

  const actions = data?.action_queue || [];
  const summary = data?.summary || {};

  const filteredActions = useMemo(() => {
    if (filter === "ALL") {
      return actions;
    }

    return actions.filter(
      (action) =>
        String(
          action.priority || ""
        ).toUpperCase() === filter
    );
  }, [actions, filter]);

  const formatAmount = (amount) => {
    const value = Number(amount || 0);

    return `₹${value.toLocaleString("en-IN")}`;
  };

  const getPriorityClass = (priority) => {
    return `priority-${String(
      priority || "MEDIUM"
    ).toLowerCase()}`;
  };

  const getActionType = (action) => {
    if (!action) {
      return "HUMAN_REVIEW";
    }

    if (action.action_type) {
      return action.action_type;
    }

    return "HUMAN_REVIEW";
  };

  const getApprovalPayload = (action) => {
    if (!action) {
      return null;
    }

    const actionType = getActionType(action);

    if (
      action.source ===
      "FRAUD_INTELLIGENCE"
    ) {
      return {
        fraud_case_id: action.reference_id,
        action_type: actionType,
        ai_reason:
          action.reason ||
          "PayTruth detected a suspicious payment pattern requiring human investigation.",
        proposed_action:
          "Investigate the suspicious payment pattern in a controlled sandbox environment."
      };
    }

    if (
      action.source ===
      "PAYMENT_FAILURE_INTELLIGENCE"
    ) {
      return {
        payment_failure_case_id:
          action.reference_id,
        action_type: actionType,
        ai_reason:
          action.reason ||
          "PayTruth detected a payment failure requiring controlled recovery.",
        proposed_action:
          "Perform the recommended payment recovery action in the sandbox."
      };
    }

    return {
      case_id: action.reference_id,
      action_type: actionType,
      ai_reason:
        action.reason ||
        "PayTruth detected a settlement-related financial issue.",
      proposed_action:
        "Investigate and review the financial discrepancy in a controlled sandbox environment."
    };
  };

  const createApproval = async () => {
    if (!selected) return;

    try {
      setBusy(true);
      setActiveAction("request");
      setError("");
      setMessage("");

      const payload =
        getApprovalPayload(selected);

      const response = await fetch(
        "/approval-actions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const text = await response.text();

      let result = {};

      try {
        result = text
          ? JSON.parse(text)
          : {};
      } catch (parseError) {
        console.error(
          "Approval response was not JSON:",
          text
        );

        throw new Error(
          "The approval server returned an invalid response."
        );
      }

      if (
        response.status === 409 &&
        result?.approval_action_id
      ) {
        const approvalResponse =
          await fetch(
            "/approval-actions"
          );

        if (!approvalResponse.ok) {
          throw new Error(
            "An approval already exists, but it could not be loaded."
          );
        }

        const approvalData =
          await approvalResponse.json();

        const approvalList =
          Array.isArray(approvalData)
            ? approvalData
            : approvalData?.approval_actions ||
              approvalData?.actions ||
              [];

        const existingApproval =
          approvalList.find(
            (item) =>
              Number(item.id) ===
              Number(
                result.approval_action_id
              )
          );

        if (!existingApproval) {
          throw new Error(
            "An approval already exists, but its details could not be found."
          );
        }

        setApproval({
          ...existingApproval,
          approval_status:
            existingApproval.approval_status ||
            "PENDING",
          execution_status:
            existingApproval.execution_status ||
            "NOT_EXECUTED",
          verification_status:
            existingApproval.verification_status ||
            "NOT_VERIFIED",
        });

        setMessage(
          `✓ Approval request #${existingApproval.id} is already pending.`
        );

        return;
      }

      if (!response.ok) {
        throw new Error(
          result?.message ||
            "Could not create approval request."
        );
      }

      const createdApproval =
        result?.action || result;

      if (!createdApproval?.id) {
        throw new Error(
          "Approval was created, but the approval record could not be read."
        );
      }

      setApproval({
        ...createdApproval,
        approval_status:
          createdApproval.approval_status ||
          "PENDING",
        execution_status:
          createdApproval.execution_status ||
          "NOT_EXECUTED",
        verification_status:
          createdApproval.verification_status ||
          "NOT_VERIFIED",
      });

      setMessage(
        `✓ Approval request #${createdApproval.id} created successfully.`
      );
    } catch (err) {
      console.error(
        "Create approval error:",
        err
      );

      setError(
        err.message ||
          "Could not create approval request."
      );
    } finally {
      setBusy(false);
      setActiveAction("");
    }
  };

  const approveAction = async () => {
    if (!approval?.id) return;

    try {
      setBusy(true);
      setActiveAction("approve");
      setError("");
      setMessage("");

      const response = await fetch(
        `/approval-actions/${approval.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            decision: "APPROVE",
            approved_by: "Merchant",
          }),
        }
      );

      const text = await response.text();

      let result = {};

      try {
        result = text
          ? JSON.parse(text)
          : {};
      } catch (parseError) {
        console.error(
          "Approve response was not JSON:",
          text
        );

        throw new Error(
          "The approval server returned an invalid response."
        );
      }

      if (!response.ok) {
        throw new Error(
          result?.message ||
            "Could not approve the action."
        );
      }

      const updatedApproval =
        result?.action || result;

      if (!updatedApproval?.id) {
        throw new Error(
          "Action was approved, but the updated approval record could not be read."
        );
      }

      setApproval({
        ...updatedApproval,
        approval_status:
          updatedApproval.approval_status ||
          "APPROVED",
        execution_status:
          updatedApproval.execution_status ||
          "NOT_EXECUTED",
        verification_status:
          updatedApproval.verification_status ||
          "NOT_VERIFIED",
      });

      setMessage(
        `✓ Action #${updatedApproval.id} approved successfully.`
      );
    } catch (err) {
      console.error(
        "Approve action error:",
        err
      );

      setError(
        err.message ||
          "Could not approve the action."
      );
    } finally {
      setBusy(false);
      setActiveAction("");
    }
  };

  const rejectAction = async () => {
    if (!approval?.id) {
      return;
    }

    try {
      setBusy(true);
      setActiveAction("reject");
      setError("");
      setMessage("");

      const response = await fetch(
        `/approval-actions/${approval.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            decision: "REJECT",
            approved_by: "Merchant"
          })
        }
      );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result?.message ||
            "Could not reject action."
        );
      }

      setApproval(
        result.action || result
      );

      setMessage(
        "✓ Action rejected. No execution occurred."
      );
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setBusy(false);
      setActiveAction("");
    }
  };

  const executeAction = async () => {
    if (!approval?.id) {
      return;
    }

    try {
      setBusy(true);
      setActiveAction("execute");
      setError("");
      setMessage("");

      const response = await fetch(
        `/approval-actions/${approval.id}/execute`,
        {
          method: "POST"
        }
      );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result?.message ||
            "Could not execute action."
        );
      }

      setApproval(
        result.action ||
        result
      );

      setMessage(
        "✓ Sandbox execution completed. Independent verification is now required."
      );
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setBusy(false);
      setActiveAction("");
    }
  };

  const verifyAction = async () => {
    if (!approval?.id) {
      return;
    }

    try {
      setBusy(true);
      setActiveAction("verify");
      setError("");
      setMessage("");

      const response = await fetch(
        `/approval-actions/${approval.id}/verify`,
        {
          method: "POST"
        }
      );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result?.message ||
            "Could not verify action."
        );
      }

      setApproval(
        result.action ||
        result
      );

      setMessage(
        "✓ Independent financial verification completed."
      );
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setBusy(false);
      setActiveAction("");
    }
  };

  const resolveAction = async () => {
    if (!selected) {
      return;
    }

    try {
      setBusy(true);
      setActiveAction("resolve");
      setError("");
      setMessage("");

      if (
        selected.source ===
        "FRAUD_INTELLIGENCE"
      ) {
        const response = await fetch(
          `/fraud-cases/${selected.reference_id}/resolve`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json"
            }
          }
        );

        const result =
          await response.json();

        if (!response.ok) {
          throw new Error(
            result?.message ||
              "Could not resolve fraud investigation."
          );
        }

        setMessage(
          "✓ Fraud investigation resolved after verified human-approved workflow."
        );
      } else if (
        selected.source ===
        "SETTLEMENT_RECONCILIATION"
      ) {
        if (!selected.transaction_id) {
          throw new Error(
            "Transaction reference is required."
          );
        }

        const response = await fetch(
          `/cases/${selected.transaction_id}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              status: "RESOLVED"
            })
          }
        );

        const result =
          await response.json();

        if (!response.ok) {
          throw new Error(
            result?.message ||
              "Could not resolve settlement case."
          );
        }

        setMessage(
          "✓ Settlement case resolved after verification."
        );
      } else if (
    selected.source ===
    "PAYMENT_FAILURE_INTELLIGENCE"
) {
    if (!selected.reference_id) {
        throw new Error(
            "Payment failure case reference is required."
        );
    }

    const response = await fetch(
        `/payment-failure-cases/${selected.reference_id}/resolve`,
        {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json"
            }
        }
    );

    const result = await response.json();

    if (!response.ok) {
        throw new Error(
            result?.message ||
            "Could not resolve payment failure case."
        );
    }

    setMessage(
        "✓ Payment failure case resolved after verified human-approved workflow."
    );
}

      await loadActions();
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setBusy(false);
      setActiveAction("");
    }
  };

  const resetApproval = () => {
    setApproval(null);
    setMessage("");
    setError("");
  };

  if (loading) {
    return (
      <section className="workspace">
        <div className="page-heading">
          <div>
            <span className="eyebrow">
              AI Control Center
            </span>

            <h1>Action Center</h1>

            <p>
              Loading PayTruth's controlled action workflow.
            </p>
          </div>
        </div>

        <div className="panel">
          <p>
            Loading AI action queue...
          </p>
        </div>
      </section>
    );
  }

  if (error && !data) {
    return (
      <section className="workspace">
        <div className="page-heading">
          <div>
            <span className="eyebrow">
              AI Control Center
            </span>

            <h1>Action Center</h1>
          </div>
        </div>

        <div className="panel">
          <p>{error}</p>

          <button
            type="button"
            className="primary-button"
            onClick={loadActions}
          >
            Retry
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="workspace">

      <div className="page-heading">

        <div>
          <span className="eyebrow">
            AI Control Center
          </span>

          <h1>Action Center</h1>

          <p>
            Review AI recommendations, authorize important
            decisions, execute them safely, and verify the result.
          </p>
        </div>

        <div className="action-mode-pill">
          <span>●</span>
          Human approval required
        </div>

      </div>

      <div className="metric-grid">

        <div className="metric-card">
          <span>Total Actions</span>

          <strong>
            {summary.total_actions ??
              actions.length}
          </strong>

          <small>
            Across PayTruth intelligence engines
          </small>
        </div>

        <div className="metric-card">
          <span>Critical</span>

          <strong>
            {summary.critical_actions ?? 0}
          </strong>

          <small>
            Immediate investigation priority
          </small>
        </div>

        <div className="metric-card">
          <span>High Priority</span>

          <strong>
            {summary.high_priority_actions ?? 0}
          </strong>

          <small>
            Elevated attention required
          </small>
        </div>

        <div className="metric-card">
          <span>Approval Required</span>

          <strong>
            {summary.human_approval_required ?? 0}
          </strong>

          <small>
            Automatic financial execution disabled
          </small>
        </div>

      </div>

      <div className="control-safety-banner">

        <div className="safety-icon">
          ✓
        </div>

        <div>
          <strong>
            PayTruth Protected Mode
          </strong>

          <p>
            Human authorization is required before controlled
            execution. Real money movement is disabled.
          </p>
        </div>

        <div className="safety-status">
          SANDBOX ONLY
        </div>

      </div>

      {message && (
        <div className="success-banner">
          {message}
        </div>
      )}

      {error && (
        <div className="error-banner">
          ⚠ {error}
        </div>
      )}

      <div className="action-filter-bar">

        <div>
          <span className="eyebrow">
            Recommended Actions
          </span>

          <h2>
            AI Action Queue
          </h2>
        </div>

        <div className="filter-buttons">

          {[
            "ALL",
            "CRITICAL",
            "HIGH",
            "MEDIUM",
            "LOW"
          ].map((item) => (

            <button
              key={item}
              type="button"
              className={
                filter === item
                  ? "filter-button active"
                  : "filter-button"
              }
              onClick={() =>
                setFilter(item)
              }
            >
              {item}
            </button>

          ))}

        </div>

      </div>

      <div className="workspace-grid action-center-grid">

        <div className="panel">

          <div className="panel-header">

            <div>
              <span className="eyebrow">
                Prioritized by AI
              </span>

              <h2>
                Action Queue
              </h2>
            </div>

            <span className="panel-count">
              {filteredActions.length} actions
            </span>

          </div>

          <div className="action-list">

            {filteredActions.map(
              (action, index) => {

                const priority =
                  String(
                    action.priority ||
                    "MEDIUM"
                  ).toUpperCase();

                return (
                  <button
                    key={`${action.source}-${action.reference_id}-${index}`}
                    type="button"
                    className={
                      selected === action
                        ? "action-row selected"
                        : "action-row"
                    }
                    onClick={() => {
                      setSelected(action);
                      resetApproval();
                    }}
                  >

                    <div className="action-row-left">

                      <div
                        className={`priority-dot ${getPriorityClass(
                          priority
                        )}`}
                      />

                      <div>

                        <strong>
                          {action.action_type ||
                            "HUMAN_REVIEW"}
                        </strong>

                        <span>
                          {action.source ||
                            "PayTruth Intelligence"}
                        </span>

                        {action.payment_id && (
                          <small>
                            Payment{" "}
                            {action.payment_id}
                          </small>
                        )}

                        {action.transaction_id && (
                          <small>
                            Transaction{" "}
                            {action.transaction_id}
                          </small>
                        )}

                      </div>

                    </div>

                    <div className="action-row-right">

                      <span
                        className={`priority-badge ${getPriorityClass(
                          priority
                        )}`}
                      >
                        {priority}
                      </span>

                      <strong>
                        {formatAmount(
                          action.amount_at_risk
                        )}
                      </strong>

                    </div>

                  </button>
                );
              }
            )}

            {filteredActions.length === 0 && (
              <div className="empty-state">
                No actions match this priority filter.
              </div>
            )}

          </div>

        </div>

        <div className="panel">

          <div className="panel-header">

            <div>
              <span className="eyebrow">
                Controlled Decision
              </span>

              <h2>
                Decision Details
              </h2>
            </div>

          </div>

          {selected ? (

            <div className="action-detail">

              <div className="action-detail-heading">

                <div>

                  <span className="eyebrow">
                    Recommended Action
                  </span>

                  <h3>
                    {selected.action_type ||
                      "HUMAN_REVIEW"}
                  </h3>

                </div>

                <span
                  className={`priority-badge ${getPriorityClass(
                    selected.priority
                  )}`}
                >
                  {selected.priority ||
                    "MEDIUM"}
                </span>

              </div>

              <div className="decision-grid">

                <div>
                  <span>Source</span>

                  <strong>
                    {selected.source}
                  </strong>
                </div>

                <div>
                  <span>Amount at Risk</span>

                  <strong>
                    {formatAmount(
                      selected.amount_at_risk
                    )}
                  </strong>
                </div>

                <div>
                  <span>Human Approval</span>

                  <strong>
                    REQUIRED
                  </strong>
                </div>

                <div>
                  <span>Automatic Action</span>

                  <strong>
                    DISABLED
                  </strong>
                </div>

              </div>

              <div className="detail-section">

                <span className="eyebrow">
                  AI Reason
                </span>

                <p>
                  {selected.reason}
                </p>

              </div>

              {selected.payment_id && (
                <div className="detail-section">

                  <span className="eyebrow">
                    Payment Reference
                  </span>

                  <p className="reference-value">
                    {selected.payment_id}
                  </p>

                </div>
              )}

              {selected.transaction_id && (
                <div className="detail-section">

                  <span className="eyebrow">
                    Transaction Reference
                  </span>

                  <p className="reference-value">
                    {selected.transaction_id}
                  </p>

                </div>
              )}

              <div className="detail-section">

                <span className="eyebrow">
                  Execution Policy
                </span>

                <div className="execution-policy">

                  <div>
                    <span>Mode</span>

                    <strong>
                      {selected.execution_mode ||
                        "SIMULATED / SANDBOX"}
                    </strong>
                  </div>

                  <div>
                    <span>Real Money</span>

                    <strong>
                      NOT PERMITTED
                    </strong>
                  </div>

                  <div>
                    <span>Verification</span>

                    <strong>
                      REQUIRED
                    </strong>
                  </div>

                </div>

              </div>

              {!approval && (

                <div className="action-decision-box">

                  <div>

                    <span className="eyebrow">
                      Step 1
                    </span>

                    <strong>
                      Request human approval
                    </strong>

                    <p>
                      PayTruth will create a pending
                      approval record. Nothing executes
                      at this stage.
                    </p>

                  </div>

                  <button
                    type="button"
                    className="primary-button"
                    disabled={busy}
                    onClick={createApproval}
                  >
                    {activeAction === "request"
                      ? "Creating..."
                      : "Request Approval →"}
                  </button>

                </div>

              )}

              {approval && (

                <div className="approval-workflow">

                  <div className="approval-status-card">

                    <span className="eyebrow">
                      Approval Request
                    </span>

                    <strong>
                      Action #{approval.id}
                    </strong>

                    <span>
                      Status:{" "}
                      {approval.approval_status ||
                        "PENDING"}
                    </span>

                  </div>

                  {approval.approval_status ===
                    "PENDING" && (

                    <div className="approval-actions">

                      <button
                        type="button"
                        className="primary-button"
                        disabled={busy}
                        onClick={approveAction}
                      >
                        {activeAction === "approve"
                          ? "Approving..."
                          : "✓ Approve Action"}
                      </button>

                      <button
                        type="button"
                        className="secondary-button danger-button"
                        disabled={busy}
                        onClick={rejectAction}
                      >
                        {activeAction === "reject"
                          ? "Rejecting..."
                          : "Reject"}
                      </button>

                    </div>

                  )}

                  {approval.approval_status ===
                    "APPROVED" &&
                    approval.execution_status ===
                      "NOT_EXECUTED" && (

                    <div className="action-decision-box">

                      <div>

                        <span className="eyebrow">
                          Step 2
                        </span>

                        <strong>
                          Execute in sandbox
                        </strong>

                        <p>
                          Human approval has been
                          recorded. Execution remains
                          simulated and cannot move real money.
                        </p>

                      </div>

                      <button
                        type="button"
                        className="primary-button"
                        disabled={busy}
                        onClick={executeAction}
                      >
                        {activeAction === "execute"
                          ? "Executing..."
                          : "Execute in Sandbox →"}
                      </button>

                    </div>

                  )}

                  {approval.execution_status ===
                    "EXECUTED" &&
                    approval.verification_status !==
                      "VERIFIED" && (

                    <div className="action-decision-box">

                      <div>

                        <span className="eyebrow">
                          Step 3
                        </span>

                        <strong>
                          Independently verify
                        </strong>

                        <p>
                          PayTruth checks the underlying
                          records independently before
                          allowing resolution.
                        </p>

                      </div>

                      <button
                        type="button"
                        className="primary-button"
                        disabled={busy}
                        onClick={verifyAction}
                      >
                        {activeAction === "verify"
                          ? "Verifying..."
                          : "Verify Result →"}
                      </button>

                    </div>

                  )}

                  {approval.verification_status ===
                    "VERIFIED" && (

                    <div className="action-decision-box">

                      <div>

                        <span className="eyebrow">
                          Step 4
                        </span>

                        <strong>
                          Verification successful
                        </strong>

                        <p>
                          The action has been independently
                          verified. The case can now be resolved.
                        </p>

                      </div>

                      <button
                        type="button"
                        className="primary-button"
                        disabled={busy}
                        onClick={resolveAction}
                      >
                        {activeAction === "resolve"
                          ? "Resolving..."
                          : "Resolve Case →"}
                      </button>

                    </div>

                  )}

                </div>

              )}

            </div>

          ) : (

            <div className="empty-state">
              Select an action from the queue.
            </div>

          )}

        </div>

      </div>

      <div className="panel workflow-panel">

        <div className="panel-header">

          <div>
            <span className="eyebrow">
              Controlled Automation
            </span>

            <h2>
              PayTruth Action Workflow
            </h2>
          </div>

        </div>

        <div className="workflow-steps">

          <div className="workflow-step completed">
            <span>01</span>
            <strong>Detect</strong>
            <small>Identify risk</small>
          </div>

          <div className="workflow-line" />

          <div className="workflow-step completed">
            <span>02</span>
            <strong>Analyze</strong>
            <small>Evaluate evidence</small>
          </div>

          <div className="workflow-line" />

          <div className="workflow-step completed">
            <span>03</span>
            <strong>Recommend</strong>
            <small>AI decision</small>
          </div>

          <div className="workflow-line" />

          <div className="workflow-step current">
            <span>04</span>
            <strong>Approve</strong>
            <small>Human decision</small>
          </div>

          <div className="workflow-line" />

          <div className="workflow-step">
            <span>05</span>
            <strong>Execute</strong>
            <small>Sandbox only</small>
          </div>

          <div className="workflow-line" />

          <div className="workflow-step">
            <span>06</span>
            <strong>Verify</strong>
            <small>Independent check</small>
          </div>

        </div>

      </div>

    </section>
  );
}

export default ActionCenter;