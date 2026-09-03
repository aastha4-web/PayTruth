const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const pool = new Pool({
    user: "postgres",
    host: "localhost",
    database: "paytruth",
    password: "paytruth@123",
    port: 5432,
});
// ==================================================
// AUDIT TRAIL ENGINE — STEP 56
// ==================================================

async function createAuditLog({
    caseId = null,
    actionId = null,
    eventType,
    actor = "SYSTEM",
    description,
    oldStatus = null,
    newStatus = null,
    metadata = {}
}) {

    try {

        await pool.query(
            `
            INSERT INTO audit_logs
            (
                case_id,
                action_id,
                event_type,
                actor,
                description,
                old_status,
                new_status,
                metadata
            )
            VALUES
            (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                $8
            )
            `,
            [
                caseId,
                actionId,
                eventType,
                actor,
                description,
                oldStatus,
                newStatus,
                metadata
            ]
        );

    } catch (error) {
    console.error("Audit log error:", error);
    throw error;
}
}

// ==================================================
// HOME
// ==================================================

app.get("/", (req, res) => {
    res.send("PayTruth AI Backend is Running 🚀");
});


// ==================================================
// TEST DATABASE
// ==================================================

app.get("/test-db", async (req, res) => {
    try {
        const result = await pool.query("SELECT NOW()");

        res.json({
            message: "PayTruth database connected successfully!",
            time: result.rows[0].now
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Database connection failed"
        });
    }
});


// ==================================================
// RECONCILIATION
// ==================================================

app.get("/reconciliation", async (req, res) => {

    try {

        const result = await pool.query(`
            SELECT
                t.transaction_id,
                t.merchant_id,
                t.transaction_amount,
                s.settlement_amount,

                ABS(
                    t.transaction_amount - s.settlement_amount
                ) AS difference,

                CASE

                    WHEN t.transaction_amount = s.settlement_amount
                        THEN 'MATCHED'

                    WHEN ABS(
                        t.transaction_amount - s.settlement_amount
                    ) <= 100
                        THEN 'LOW'

                    WHEN ABS(
                        t.transaction_amount - s.settlement_amount
                    ) <= 1000
                        THEN 'MEDIUM'

                    ELSE 'HIGH'

                END AS risk_level

            FROM transactions t

            JOIN settlements s
            ON t.transaction_id = s.transaction_id

            ORDER BY difference DESC;
        `);


        for (const item of result.rows) {

            if (item.risk_level !== "MATCHED") {

                await pool.query(
                    `
                    INSERT INTO mismatch_cases
                    (
                        transaction_id,
                        difference,
                        risk_level
                    )

                    VALUES
                    ($1, $2, $3)

                    ON CONFLICT (transaction_id)

                    DO UPDATE SET

                        difference = EXCLUDED.difference,

                        risk_level = EXCLUDED.risk_level
                    `,
                    [
                        item.transaction_id,
                        item.difference,
                        item.risk_level
                    ]
                );
            }
        }


        res.json(result.rows);


    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Reconciliation failed"
        });
    }
});


// ==================================================
// SUMMARY
// ==================================================

const PORT = 5000;

app.get("/summary", async (req, res) => {

    try {

        const result = await pool.query(`
            SELECT

                COUNT(*) AS total_transactions,

                COUNT(*) FILTER (
                    WHERE t.transaction_amount != s.settlement_amount
                ) AS mismatches,

                COALESCE(

                    SUM(
                        ABS(
                            t.transaction_amount -
                            s.settlement_amount
                        )
                    )

                    FILTER (
                        WHERE t.transaction_amount != s.settlement_amount
                    ),

                    0

                ) AS money_at_risk

            FROM transactions t

            JOIN settlements s
            ON t.transaction_id = s.transaction_id
        `);


        res.json(result.rows[0]);


    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Could not fetch summary"
        });
    }
});


// ==================================================
// UPDATE CASE STATUS
// ==================================================

app.patch("/cases/:transaction_id", async (req, res) => {

    try {

        const { transaction_id } = req.params;

        const { status } = req.body;


        const allowedStatuses = [
            "OPEN",
            "INVESTIGATING",
            "RESOLVED"
        ];


        if (!allowedStatuses.includes(status)) {

            return res.status(400).json({
                message: "Invalid status"
            });
        }


        const result = await pool.query(
            `
            UPDATE mismatch_cases

            SET case_status = $1

            WHERE transaction_id = $2

            RETURNING *
            `,
            [
                status,
                transaction_id
            ]
        );


        if (result.rows.length === 0) {

            return res.status(404).json({
                message: "Case not found"
            });
        }


        res.json(result.rows[0]);


    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Could not update case"
        });
    }
});


// ==================================================
// GET CASES
// ==================================================

app.get("/cases", async (req, res) => {

    try {

        const result = await pool.query(`
            SELECT

                id,
                transaction_id,
                difference,
                risk_level,
                case_status,
                created_at

            FROM mismatch_cases

            ORDER BY

                CASE risk_level

                    WHEN 'HIGH' THEN 1
                    WHEN 'MEDIUM' THEN 2
                    WHEN 'LOW' THEN 3
                    ELSE 4

                END,

                created_at DESC
        `);


        res.json(result.rows);


    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Could not fetch cases"
        });
    }
});


// ==================================================
// APPROVE / REJECT ACTION
// ==================================================

app.patch("/approval-actions/:id", async (req, res) => {

    try {

        const { id } = req.params;

        const {
            decision,
            approved_by
        } = req.body;


        if (
            !["APPROVED", "REJECTED"]
            .includes(decision)
        ) {

            return res.status(400).json({
                message: "Invalid decision"
            });
        }


        const result = await pool.query(
            `
            UPDATE approval_actions

            SET

                approval_status = $1,

                approved_by = $2,

                approved_at = CURRENT_TIMESTAMP

            WHERE id = $3

            AND approval_status = 'PENDING'

            RETURNING *
            `,
            [
                decision,
                approved_by || "Merchant",
                id
            ]
        );


        if (result.rows.length === 0) {

            return res.status(404).json({
                message:
                    "Pending approval action not found"
            });
        }
        // ==========================================
// AUDIT APPROVAL DECISION
// ==========================================

const updatedAction = result.rows[0];

await createAuditLog({

    caseId: updatedAction.case_id,

    actionId: updatedAction.id,

    eventType:
        decision === "APPROVED"
            ? "ACTION_APPROVED"
            : "ACTION_REJECTED",

    actor:
        updatedAction.approved_by || "Merchant",

    description:
        decision === "APPROVED"
            ? "Merchant approved the proposed PayTruth action."
            : "Merchant rejected the proposed PayTruth action.",

    oldStatus:
        "PENDING",

    newStatus:
        decision,

    metadata: {

        action_type:
            updatedAction.action_type,

        proposed_action:
            updatedAction.proposed_action

    }

});


        res.json(result.rows[0]);


    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Could not update approval"
        });
    }
});


// ==================================================
// GET APPROVAL ACTIONS
// ==================================================

app.get("/approval-actions", async (req, res) => {

    try {

        const result = await pool.query(`
            SELECT

                id,
                case_id,
                payment_failure_case_id,
                action_type,
                ai_reason,
                proposed_action,
                approval_status,
                approved_by,
                approved_at,
                execution_status,
                verification_status,
                created_at

            FROM approval_actions

            ORDER BY created_at DESC
        `);


        res.json(result.rows);


    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Could not fetch approval actions"
        });
    }
});


// ==================================================
// CREATE APPROVAL ACTION
// ==================================================
app.post("/approval-actions/create", async (req, res) => {

    try {

        const {
            case_id,
            payment_failure_case_id,
            fraud_case_id,
            action_type,
            ai_reason,
            proposed_action
        } = req.body || {};


        // ==========================================
        // 1. VALIDATE REQUEST
        // ==========================================

        if (
            !action_type ||
            !ai_reason ||
            !proposed_action
        ) {

            return res.status(400).json({

                message:
                    "action_type, ai_reason and proposed_action are required"

            });
        }


        // Count how many case types were provided

        const caseReferenceCount =
            [case_id, payment_failure_case_id, fraud_case_id]
                .filter(value => value !== undefined && value !== null)
                .length;


        if (caseReferenceCount === 0) {

            return res.status(400).json({

                message:
                    "Either case_id, payment_failure_case_id or fraud_case_id is required"

            });
        }


        if (caseReferenceCount > 1) {

            return res.status(400).json({

                message:
                    "Provide only one of case_id, payment_failure_case_id or fraud_case_id"

            });
        }


        // ==========================================
        // 2. SETTLEMENT CASE APPROVAL
        // ==========================================

        if (case_id) {

            const caseResult = await pool.query(
                `
                SELECT *
                FROM mismatch_cases
                WHERE id = $1
                `,
                [case_id]
            );


            if (caseResult.rows.length === 0) {

                return res.status(404).json({

                    message:
                        "Mismatch case not found"

                });

            }


            const existingResult = await pool.query(
                `
                SELECT *
                FROM approval_actions
                WHERE case_id = $1
                AND approval_status = 'PENDING'
                `,
                [case_id]
            );


            if (existingResult.rows.length > 0) {

                return res.status(409).json({

                    message:
                        "A pending approval already exists for this case.",

                    action:
                        existingResult.rows[0]

                });

            }

        }


        // ==========================================
        // 3. PAYMENT FAILURE CASE APPROVAL
        // ==========================================

        if (payment_failure_case_id) {

            const failureCaseResult = await pool.query(
                `
                SELECT *
                FROM payment_failure_cases
                WHERE id = $1
                `,
                [payment_failure_case_id]
            );


            if (failureCaseResult.rows.length === 0) {

                return res.status(404).json({

                    message:
                        "Payment failure case not found"

                });

            }


            const existingResult = await pool.query(
                `
                SELECT *
                FROM approval_actions
                WHERE payment_failure_case_id = $1
                AND approval_status = 'PENDING'
                `,
                [payment_failure_case_id]
            );


            if (existingResult.rows.length > 0) {

                return res.status(409).json({

                    message:
                        "A pending approval already exists for this payment failure case.",

                    action:
                        existingResult.rows[0]

                });

            }

        }


        // ==========================================
        // 4. FRAUD CASE APPROVAL
        // ==========================================

        if (fraud_case_id) {

            const fraudCaseResult = await pool.query(
                `
                SELECT *
                FROM fraud_cases
                WHERE id = $1
                `,
                [fraud_case_id]
            );


            if (fraudCaseResult.rows.length === 0) {

                return res.status(404).json({

                    message:
                        "Fraud case not found"

                });

            }


            const existingResult = await pool.query(
                `
                SELECT *
                FROM approval_actions
                WHERE fraud_case_id = $1
                AND approval_status = 'PENDING'
                `,
                [fraud_case_id]
            );


            if (existingResult.rows.length > 0) {

                return res.status(409).json({

                    message:
                        "A pending approval already exists for this fraud case.",

                    action:
                        existingResult.rows[0]

                });

            }

        }


        // ==========================================
        // 5. CREATE APPROVAL REQUEST
        // ==========================================

        const result = await pool.query(
            `
            INSERT INTO approval_actions
            (
                case_id,
                payment_failure_case_id,
                fraud_case_id,
                action_type,
                ai_reason,
                proposed_action,
                approval_status,
                execution_status,
                verification_status
            )

            VALUES
            (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                'PENDING',
                'NOT_EXECUTED',
                'NOT_VERIFIED'
            )

            RETURNING *
            `,
            [
                case_id || null,
                payment_failure_case_id || null,
                fraud_case_id || null,
                action_type,
                ai_reason,
                proposed_action
            ]
        );


        // ==========================================
        // 6. RESPONSE
        // ==========================================

        res.status(201).json({

            message:
                "Approval request created successfully.",

            action:
                result.rows[0]

        });


    } catch (error) {

        console.error(
            "Approval creation error:",
            error
        );


        res.status(500).json({

            message:
                "Could not create approval request",

            error:
                error.message

        });

    }

});

app.post("/approval-actions/:id/execute", async (req, res) => {

    const client = await pool.connect();

    try {

        const { id } = req.params;

        // ==========================================
        // 1. START DATABASE TRANSACTION
        // ==========================================

        await client.query("BEGIN");


        // ==========================================
        // 2. GET APPROVED ACTION
        // ==========================================

        const actionResult = await client.query(
            `
            SELECT
                id,
                case_id,
                payment_failure_case_id,
                fraud_case_id,
                action_type,
                approval_status,
                execution_status
            FROM approval_actions
            WHERE id = $1
            FOR UPDATE
            `,
            [id]
        );


        if (actionResult.rows.length === 0) {

            await client.query("ROLLBACK");

            return res.status(404).json({

                message:
                    "Approval action not found"

            });

        }


        const action =
            actionResult.rows[0];


        // ==========================================
        // 3. SAFETY CHECK
        // ==========================================

        if (
            action.approval_status !== "APPROVED" ||
            action.execution_status !== "NOT_EXECUTED"
        ) {

            await client.query("ROLLBACK");

            return res.status(400).json({

                message:
                    "Action cannot be executed. It must be approved and not already executed."

            });

        }


        // ==========================================
        // 4A. SETTLEMENT CASE
        // ==========================================

       if (action.case_id && action.action_type !== "VERIFY_REFUND") {

            const caseResult = await client.query(
                `
                SELECT
                    id,
                    transaction_id,
                    case_status
                FROM mismatch_cases
                WHERE id = $1
                FOR UPDATE
                `,
                [action.case_id]
            );


            if (caseResult.rows.length === 0) {

                await client.query("ROLLBACK");

                return res.status(404).json({

                    message:
                        "Related mismatch case not found"

                });

            }


            const mismatchCase =
                caseResult.rows[0];


            // Move settlement case into investigation

            const updatedCase =
                await client.query(
                    `
                    UPDATE mismatch_cases
                    SET case_status = 'INVESTIGATING'
                    WHERE id = $1
                    RETURNING *
                    `,
                    [mismatchCase.id]
                );


            // Mark action as executed

            const updatedAction =
                await client.query(
                    `
                    UPDATE approval_actions
                    SET execution_status = 'EXECUTED'
                    WHERE id = $1
                    RETURNING *
                    `,
                    [id]
                );


            await client.query("COMMIT");


            // ==========================================
            // AUDIT
            // ==========================================

            await createAuditLog({

                caseId:
                    action.case_id,

                actionId:
                    action.id,

                eventType:
                    "ACTION_EXECUTED",

                actor:
                    "SYSTEM",

                description:
                    "Approved PayTruth settlement action was executed in the controlled workflow.",

                oldStatus:
                    "NOT_EXECUTED",

                newStatus:
                    "EXECUTED",

                metadata: {

                    action_type:
                        action.action_type,

                    execution_mode:
                        "SIMULATED / SANDBOX",

                    real_money_movement:
                        false

                }

            });


            return res.json({

                message:
                    "Settlement investigation executed successfully",

                action:
                    updatedAction.rows[0],

                case:
                    updatedCase.rows[0]

            });

        }


        // ==========================================
        // 4B. PAYMENT FAILURE CASE
        // ==========================================

        if (action.payment_failure_case_id) {

            const failureCaseResult =
                await client.query(
                    `
                    SELECT
                        id,
                        payment_id,
                        failure_reason,
                        amount,
                        risk_level,
                        case_status,
                        recommended_action
                    FROM payment_failure_cases
                    WHERE id = $1
                    FOR UPDATE
                    `,
                    [action.payment_failure_case_id]
                );


            if (
                failureCaseResult.rows.length === 0
            ) {

                await client.query("ROLLBACK");

                return res.status(404).json({

                    message:
                        "Related payment failure case not found"

                });

            }


            const failureCase =
                failureCaseResult.rows[0];


            // ==========================================
            // CONTROLLED / SIMULATED EXECUTION
            // ==========================================

            const updatedFailureCase =
                await client.query(
                    `
                    UPDATE payment_failure_cases

                    SET case_status = 'INVESTIGATING'

                    WHERE id = $1

                    RETURNING *
                    `,
                    [failureCase.id]
                );


            // Mark approval action as executed

            const updatedAction =
                await client.query(
                    `
                    UPDATE approval_actions

                    SET execution_status = 'EXECUTED'

                    WHERE id = $1

                    RETURNING *
                    `,
                    [id]
                );


            await client.query("COMMIT");


            // ==========================================
            // AUDIT PAYMENT FAILURE EXECUTION
            // ==========================================

            await createAuditLog({

                caseId:
                    null,

                actionId:
                    action.id,

                eventType:
                    "ACTION_EXECUTED",

                actor:
                    "SYSTEM",

                description:
                    "Approved payment failure recovery action was executed in the controlled workflow.",

                oldStatus:
                    "NOT_EXECUTED",

                newStatus:
                    "EXECUTED",

                metadata: {

                    payment_failure_case_id:
                        action.payment_failure_case_id,
                    payment_id:
                        failureCase.payment_id,

                    action_type:
                        action.action_type,

                    execution_mode:
                        "SIMULATED / SANDBOX",

                    real_money_movement:
                        false

                }

            });


            return res.json({

                message:
                    "Payment failure recovery action executed successfully",

                action:
                    updatedAction.rows[0],

                payment_failure_case:
                    updatedFailureCase.rows[0],

                execution: {

                    mode:
                        "SIMULATED / SANDBOX",

                    real_money_movement:
                        false

                }

            });

        }


        // ==========================================
        // 4C. FRAUD CASE
        // ==========================================

        if (action.fraud_case_id) {

            const fraudCaseResult =
                await client.query(
                    `
                    SELECT
                        id,
                        payment_id,
                        order_id,
                        amount,
                        fraud_score,
                        risk_level,
                        recommended_action,
                        case_status
                    FROM fraud_cases
                    WHERE id = $1
                    FOR UPDATE
                    `,
                    [action.fraud_case_id]
                );


            if (
                fraudCaseResult.rows.length === 0
            ) {

                await client.query("ROLLBACK");

                return res.status(404).json({

                    message:
                        "Related fraud case not found"

                });

            }


            const fraudCase =
                fraudCaseResult.rows[0];


            // ==========================================
            // FRAUD SAFETY CHECK
            // ==========================================

            if (
                fraudCase.case_status === "RESOLVED"
            ) {

                await client.query("ROLLBACK");

                return res.status(400).json({

                    message:
                        "Fraud case is already resolved and cannot be executed again."

                });

            }


            // ==========================================
            // CONTROLLED FRAUD INVESTIGATION
            // ==========================================

            const updatedFraudCase =
                await client.query(
                    `
                    UPDATE fraud_cases

                    SET case_status = 'INVESTIGATING'

                    WHERE id = $1

                    RETURNING *
                    `,
                    [fraudCase.id]
                );


            // ==========================================
            // MARK APPROVAL ACTION EXECUTED
            // ==========================================

            const updatedAction =
                await client.query(
                    `
                    UPDATE approval_actions

                    SET execution_status = 'EXECUTED'

                    WHERE id = $1

                    RETURNING *
                    `,
                    [id]
                );


            await client.query("COMMIT");


            // ==========================================
            // AUDIT FRAUD EXECUTION
            // ==========================================

            await createAuditLog({

                caseId:
                    null,

                actionId:
                    action.id,

                eventType:
                    "ACTION_EXECUTED",

                actor:
                    "SYSTEM",

                description:
                    "Approved fraud investigation was executed in the controlled workflow.",

                oldStatus:
                    "NOT_EXECUTED",

                newStatus:
                    "EXECUTED",

                metadata: {

                    fraud_case_id:
                        action.fraud_case_id,

                    payment_id:
                        fraudCase.payment_id,

                    order_id:
                        fraudCase.order_id,

                    fraud_score:
                        fraudCase.fraud_score,

                    risk_level:
                        fraudCase.risk_level,

                    action_type:
                        action.action_type,

                    execution_mode:
                        "SIMULATED / SANDBOX",

                    investigation_only:
                        true,

                    real_money_movement:
                        false

                }

            });


            return res.json({

                message:
                    "Fraud investigation executed successfully",

                action:
                    updatedAction.rows[0],

                fraud_case:
                    updatedFraudCase.rows[0],

                execution: {

                    mode:
                        "SIMULATED / SANDBOX",

                    investigation_only:
                        true,

                    real_money_movement:
                        false

                }

            });

        }
        // ==========================================
// 4D. REFUND VERIFICATION
// ==========================================

if (
    action.case_id &&
    action.action_type === "VERIFY_REFUND"
) {

    // ==========================================
    // GET MISMATCH CASE
    // ==========================================

    const caseResult =
        await client.query(
            `
            SELECT
                id,
                transaction_id,
                difference,
                case_status
            FROM mismatch_cases
            WHERE id = $1
            FOR UPDATE
            `,
            [action.case_id]
        );


    if (caseResult.rows.length === 0) {

        await client.query("ROLLBACK");

        return res.status(404).json({

            message:
                "Related refund mismatch case not found"

        });

    }


    const refundCase =
        caseResult.rows[0];


    // ==========================================
    // GET TRANSACTION
    // ==========================================

    const transactionResult =
        await client.query(
            `
            SELECT
                transaction_id,
                transaction_amount
            FROM transactions
            WHERE transaction_id = $1
            `,
            [refundCase.transaction_id]
        );


    if (transactionResult.rows.length === 0) {

        await client.query("ROLLBACK");

        return res.status(404).json({

            message:
                "Related transaction not found"

        });

    }


    const transaction =
        transactionResult.rows[0];


    // ==========================================
    // GET REFUND ADJUSTMENT
    // ==========================================

    const refundResult =
        await client.query(
            `
            SELECT
                id,
                transaction_id,
                adjustment_type,
                amount,
                reason,
                created_at
            FROM settlement_adjustments
            WHERE transaction_id = $1
            AND adjustment_type = 'REFUND'
            ORDER BY created_at DESC
            LIMIT 1
            `,
            [refundCase.transaction_id]
        );


    if (refundResult.rows.length === 0) {

        await client.query("ROLLBACK");

        return res.status(409).json({

            message:
                "Refund verification cannot proceed because no refund adjustment was found."

        });

    }


    const refund =
        refundResult.rows[0];


    // ==========================================
    // SAFETY CHECK
    // ==========================================

    const transactionAmount =
        Number(transaction.transaction_amount);

    const mismatchDifference =
        Number(refundCase.difference);

    const refundAmount =
        Number(refund.amount);


    const explainedAmount =
        Math.min(
            refundAmount,
            mismatchDifference
        );


    const unexplainedAmount =
        mismatchDifference -
        explainedAmount;


    if (unexplainedAmount > 0) {

        await client.query("ROLLBACK");

        return res.status(409).json({

            message:
                "Refund cannot be executed because the settlement difference is not fully explained.",

            financial_analysis: {

                transaction_amount:
                    transactionAmount,

                settlement_difference:
                    mismatchDifference,

                refund_amount:
                    refundAmount,

                explained_amount:
                    explainedAmount,

                unexplained_amount:
                    unexplainedAmount

            },

            safety:
                "PayTruth will not approve a refund workflow when an unexplained financial difference remains."

        });

    }


    // ==========================================
    // MOVE CASE TO INVESTIGATING
    // ==========================================

    const updatedCase =
        await client.query(
            `
            UPDATE mismatch_cases

            SET case_status = 'INVESTIGATING'

            WHERE id = $1

            RETURNING *
            `,
            [refundCase.id]
        );


    // ==========================================
    // MARK ACTION EXECUTED
    // ==========================================

    const updatedAction =
        await client.query(
            `
            UPDATE approval_actions

            SET execution_status = 'EXECUTED'

            WHERE id = $1

            RETURNING *
            `,
            [id]
        );


    await client.query("COMMIT");


    // ==========================================
    // AUDIT REFUND EXECUTION
    // ==========================================

    await createAuditLog({

        caseId:
            action.case_id,

        actionId:
            action.id,

        eventType:
            "ACTION_EXECUTED",

        actor:
            "SYSTEM",

        description:
            "Approved refund verification action was executed in the controlled workflow. No refund or real money movement was performed.",

        oldStatus:
            "NOT_EXECUTED",

        newStatus:
            "EXECUTED",

        metadata: {

            transaction_id:
                refundCase.transaction_id,

            refund_adjustment_id:
                refund.id,

            refund_amount:
                refundAmount,

            explained_amount:
                explainedAmount,

            unexplained_amount:
                unexplainedAmount,

            action_type:
                action.action_type,

            execution_mode:
                "SIMULATED / SANDBOX",

            real_money_movement:
                false

        }

    });


    return res.json({

        message:
            "Refund verification action executed successfully",

        action:
            updatedAction.rows[0],

        case:
            updatedCase.rows[0],

        refund_analysis: {

            transaction_amount:
                transactionAmount,

            settlement_difference:
                mismatchDifference,

            refund_amount:
                refundAmount,

            explained_amount:
                explainedAmount,

            unexplained_amount:
                unexplainedAmount

        },

        execution: {

            mode:
                "SIMULATED / SANDBOX",

            refund_performed:
                false,

            real_money_movement:
                false

        }

    });

}


        // ==========================================
        // 5. INVALID ACTION REFERENCE
        // ==========================================

        await client.query("ROLLBACK");

        return res.status(400).json({

            message:
                "Action is not linked to a valid settlement case, payment failure case, or fraud case."

        });


    } catch (error) {

        try {

            await client.query("ROLLBACK");

        } catch (rollbackError) {

            console.error(
                "Rollback error:",
                rollbackError
            );

        }


        console.error(
            "Execution error:",
            error
        );


        res.status(500).json({

            message:
                "Could not execute action",

            error:
                error.message

        });


    } finally {

        client.release();

    }

});



// ==================================================
// INDEPENDENT VERIFICATION — STEP 54
// ==================================================

app.post("/approval-actions/:id/verify", async (req, res) => {

    try {

        const { id } = req.params;

        // ==========================================
        // 1. GET APPROVAL ACTION
        // ==========================================

        const actionResult = await pool.query(
            `
            SELECT
                id,
                case_id,
                payment_failure_case_id,
                fraud_case_id,
                action_type,
                approval_status,
                execution_status,
                verification_status
            FROM approval_actions
            WHERE id = $1
            `,
            [id]
        );

        if (actionResult.rows.length === 0) {

            return res.status(404).json({
                message: "Approval action not found."
            });

        }

        const action = actionResult.rows[0];


        // ==========================================
        // 2. APPROVAL SAFETY CHECK
        // ==========================================

        if (action.approval_status !== "APPROVED") {

            return res.status(400).json({
                message:
                    "Action must be approved before verification."
            });

        }


        // ==========================================
        // 3. EXECUTION SAFETY CHECK
        // ==========================================

        if (action.execution_status !== "EXECUTED") {

            return res.status(400).json({
                message:
                    "Action must be executed before verification."
            });

        }


        // ==========================================
        // 4. PREVENT DUPLICATE VERIFICATION
        // ==========================================

        if (action.verification_status === "VERIFIED") {

            return res.status(400).json({
                message:
                    "Action has already been verified."
            });

        }


        // ==================================================
        // 5. FRAUD CASE VERIFICATION
        // ==================================================

        if (action.fraud_case_id) {

            const fraudCaseResult =
                await pool.query(
                    `
                    SELECT
                        id,
                        payment_id,
                        order_id,
                        amount,
                        fraud_score,
                        risk_level,
                        recommended_action,
                        case_status,
                        signals,
                        ai_reason
                    FROM fraud_cases
                    WHERE id = $1
                    `,
                    [action.fraud_case_id]
                );


            if (fraudCaseResult.rows.length === 0) {

                return res.status(404).json({

                    message:
                        "Related fraud case not found."

                });

            }


            const fraudCase =
                fraudCaseResult.rows[0];


            // ==========================================
            // FRAUD CASE MUST BE UNDER INVESTIGATION
            // ==========================================

            if (
                fraudCase.case_status !==
                "INVESTIGATING"
            ) {

                return res.status(409).json({

                    message:
                        "Fraud verification failed. Fraud case is not in INVESTIGATING state.",

                    verification: {

                        result:
                            "NOT_VERIFIED",

                        fraud_case_id:
                            fraudCase.id,

                        case_status:
                            fraudCase.case_status

                    },

                    safety:
                        "Fraud case must remain unverified until controlled execution places it under investigation."

                });

            }


            // ==========================================
            // GET ACTUAL PAYMENT RECORD
            // ==========================================

            const paymentResult =
                await pool.query(
                    `
                    SELECT
                        payment_id,
                        order_id,
                        amount,
                        payment_status,
                        failure_reason,
                        created_at
                    FROM payments
                    WHERE payment_id = $1
                    `,
                    [fraudCase.payment_id]
                );


            if (paymentResult.rows.length === 0) {

                return res.status(409).json({

                    message:
                        "Verification failed. Payment record not found.",

                    safety:
                        "Fraud investigation must not be marked verified without a valid underlying payment record."

                });

            }


            const payment =
                paymentResult.rows[0];


            // ==========================================
            // VERIFY PAYMENT RECORD AGAINST FRAUD CASE
            // ==========================================

            const paymentAmount =
                Number(payment.amount);

            const caseAmount =
                Number(fraudCase.amount);


            const paymentRecordMatchesCase =
                payment.payment_id ===
                    fraudCase.payment_id &&

                payment.order_id ===
                    fraudCase.order_id &&

                paymentAmount ===
                    caseAmount;


            // ==========================================
            // VERIFY FRAUD INVESTIGATION ACTION
            // ==========================================

            const investigationActionRecorded =
                action.action_type ===
                    "FRAUD_INVESTIGATION" &&

                action.execution_status ===
                    "EXECUTED";


            // ==========================================
            // SAFETY DECISION
            // ==========================================

            if (
                !paymentRecordMatchesCase ||
                !investigationActionRecorded
            ) {

                return res.status(409).json({

                    message:
                        "Independent fraud verification failed. The fraud case, payment record, or investigation action does not match.",

                    verification: {

                        result:
                            "NOT_VERIFIED",

                        fraud_case_id:
                            fraudCase.id,

                        payment_id:
                            payment.payment_id,

                        order_id:
                            payment.order_id,

                        payment_amount:
                            paymentAmount,

                        case_amount:
                            caseAmount,

                        payment_record_matches_case:
                            paymentRecordMatchesCase,

                        investigation_action_recorded:
                            investigationActionRecorded

                    },

                    safety:
                        "Fraud case must not be marked verified until the underlying records and approved investigation action match."

                });

            }


            // ==========================================
            // MARK ACTION VERIFIED
            // ==========================================

            const verificationUpdate =
                await pool.query(
                    `
                    UPDATE approval_actions

                    SET
                        verification_status =
                            'VERIFIED'

                    WHERE id = $1

                    AND approval_status =
                        'APPROVED'

                    AND execution_status =
                        'EXECUTED'

                    AND verification_status =
                        'NOT_VERIFIED'

                    RETURNING *
                    `,
                    [id]
                );


            if (verificationUpdate.rows.length === 0) {

                return res.status(400).json({

                    message:
                        "Action could not be marked as verified."

                });

            }


            // ==========================================
            // AUDIT FRAUD VERIFICATION
            // ==========================================

            await createAuditLog({

                caseId:
                    null,

                actionId:
                    action.id,

                eventType:
                    "ACTION_VERIFIED",

                actor:
                    "SYSTEM",

                description:
                    "PayTruth independently verified the fraud investigation workflow against the underlying payment record.",

                oldStatus:
                    "NOT_VERIFIED",

                newStatus:
                    "VERIFIED",

                metadata: {

                    fraud_case_id:
                        fraudCase.id,

                    payment_id:
                        payment.payment_id,

                    order_id:
                        payment.order_id,

                    fraud_score:
                        fraudCase.fraud_score,

                    risk_level:
                        fraudCase.risk_level,

                    verification_type:
                        "INDEPENDENT_FRAUD_PAYMENT_RECORD_CHECK",

                    payment_record_checked:
                        true,

                    payment_record_matches_case:
                        true,

                    investigation_action_recorded:
                        true,

                    investigation_only:
                        true,

                    real_money_movement:
                        false

                }

            });


            // ==========================================
            // SUCCESS RESPONSE
            // ==========================================

            return res.json({

                message:
                    "Fraud investigation independently verified successfully.",

                action:
                    verificationUpdate.rows[0],

                fraud_case: {

                    id:
                        fraudCase.id,

                    payment_id:
                        fraudCase.payment_id,

                    order_id:
                        fraudCase.order_id,

                    amount:
                        caseAmount,

                    fraud_score:
                        fraudCase.fraud_score,

                    risk_level:
                        fraudCase.risk_level,

                    recommended_action:
                        fraudCase.recommended_action,

                    case_status:
                        fraudCase.case_status

                },

                verification: {

                    result:
                        "VERIFIED",

                    reason:
                        "The fraud case matches the underlying payment record and the approved fraud investigation was executed in the controlled workflow.",

                    payment_record_checked:
                        true,

                    payment_record_matches_case:
                        true,

                    investigation_action_recorded:
                        true,

                    independently_verified:
                        true

                },

                safety: {

                    real_money_movement:
                        false,

                    human_approval:
                        true,

                    independently_verified:
                        true,

                    investigation_only:
                        true,

                    fraud_proven:
                        false

                }

            });

        }


        // ==================================================
        // 6. PAYMENT FAILURE ACTION VERIFICATION
        // ==================================================

        if (action.payment_failure_case_id) {

            const failureCaseResult = await pool.query(
                `
                SELECT
                    id,
                    payment_id,
                    failure_reason,
                    amount,
                    risk_level,
                    case_status,
                    recommended_action
                FROM payment_failure_cases
                WHERE id = $1
                `,
                [action.payment_failure_case_id]
            );


            if (failureCaseResult.rows.length === 0) {

                return res.status(404).json({
                    message:
                        "Related payment failure case not found."
                });

            }


            const failureCase =
                failureCaseResult.rows[0];


            const paymentResult = await pool.query(
                `
                SELECT
                    payment_id,
                    order_id,
                    amount,
                    payment_status,
                    failure_reason,
                    created_at
                FROM payments
                WHERE payment_id = $1
                `,
                [failureCase.payment_id]
            );


            if (paymentResult.rows.length === 0) {

                return res.status(409).json({

                    message:
                        "Verification failed. Payment record not found.",

                    safety:
                        "Payment failure case must not be resolved without a valid payment record."

                });

            }


            const payment =
                paymentResult.rows[0];


            const paymentAmount =
                Number(payment.amount);

            const caseAmount =
                Number(failureCase.amount);


            const paymentRecordMatchesCase =
                payment.payment_id ===
                    failureCase.payment_id &&

                paymentAmount ===
                    caseAmount &&

                payment.payment_status ===
                    "FAILED" &&

                payment.failure_reason ===
                    failureCase.failure_reason;


            const recoveryActionRecorded =
                action.execution_status ===
                "EXECUTED";


            if (
                !paymentRecordMatchesCase ||
                !recoveryActionRecorded
            ) {

                return res.status(409).json({

                    message:
                        "Independent verification failed. Payment failure records do not match the expected recovery state.",

                    verification: {

                        result:
                            "NOT_VERIFIED",

                        payment_id:
                            payment.payment_id,

                        payment_status:
                            payment.payment_status,

                        failure_reason:
                            payment.failure_reason,

                        payment_amount:
                            paymentAmount,

                        case_amount:
                            caseAmount,

                        payment_record_matches_case:
                            paymentRecordMatchesCase,

                        recovery_action_recorded:
                            recoveryActionRecorded

                    },

                    safety:
                        "Payment failure case must not be resolved until verification succeeds."

                });

            }


            const verificationUpdate =
                await pool.query(
                    `
                    UPDATE approval_actions

                    SET
                        verification_status =
                            'VERIFIED'

                    WHERE id = $1

                    AND approval_status =
                        'APPROVED'

                    AND execution_status =
                        'EXECUTED'

                    AND verification_status =
                        'NOT_VERIFIED'

                    RETURNING *
                    `,
                    [id]
                );


            if (verificationUpdate.rows.length === 0) {

                return res.status(400).json({
                    message:
                        "Action could not be marked as verified."
                });

            }


            await createAuditLog({

                caseId: null,

                actionId: action.id,

                eventType:
                    "ACTION_VERIFIED",

                actor:
                    "SYSTEM",

                description:
                    "PayTruth independently verified the payment failure recovery workflow against the underlying payment record.",

                oldStatus:
                    "NOT_VERIFIED",

                newStatus:
                    "VERIFIED",

                metadata: {

                    payment_failure_case_id:
                        failureCase.id,

                    payment_id:
                        payment.payment_id,

                    verification_type:
                        "INDEPENDENT_PAYMENT_RECORD_CHECK",

                    payment_record_checked:
                        true,

                    recovery_action_recorded:
                        true,

                    real_money_movement:
                        false

                }

            });


            return res.json({

                message:
                    "Payment failure recovery action independently verified successfully.",

                action:
                    verificationUpdate.rows[0],

                verification: {

                    result:
                        "VERIFIED",

                    reason:
                        "The payment record matches the failure case and the approved recovery action was executed in the controlled workflow.",

                    payment_failure_case_id:
                        failureCase.id,

                    payment_id:
                        payment.payment_id,

                    order_id:
                        payment.order_id,

                    payment_amount:
                        paymentAmount,

                    payment_status:
                        payment.payment_status,

                    failure_reason:
                        payment.failure_reason,

                    payment_record_checked:
                        true,

                    payment_record_matches_case:
                        true,

                    recovery_action_recorded:
                        true

                },

                safety: {

                    real_money_movement:
                        false,

                    human_approval:
                        true,

                    independently_verified:
                        true,

                    payment_status_changed:
                        false

                }

            });

        }


        // ==================================================
        // 7. SETTLEMENT / MISMATCH ACTION VERIFICATION
        // ==================================================

        const caseResult = await pool.query(
            `
            SELECT
                id,
                transaction_id,
                difference,
                risk_level,
                case_status,
                created_at
            FROM mismatch_cases
            WHERE id = $1
            `,
            [action.case_id]
        );


        if (caseResult.rows.length === 0) {

            return res.status(404).json({
                message:
                    "Related mismatch case not found."
            });

        }


        const mismatchCase =
            caseResult.rows[0];


        const transactionResult = await pool.query(
            `
            SELECT
                transaction_id,
                merchant_id,
                transaction_amount,
                payment_status
            FROM transactions
            WHERE transaction_id = $1
            `,
            [mismatchCase.transaction_id]
        );


        if (transactionResult.rows.length === 0) {

            return res.status(400).json({
                message:
                    "Verification failed. Transaction record not found."
            });

        }


        const transaction =
            transactionResult.rows[0];


        const transactionAmount =
            Number(transaction.transaction_amount);


        const settlementResult = await pool.query(
            `
            SELECT
                settlement_id,
                transaction_id,
                settlement_amount,
                settlement_status,
                settlement_date
            FROM settlements
            WHERE transaction_id = $1
            ORDER BY settlement_date DESC
            LIMIT 1
            `,
            [mismatchCase.transaction_id]
        );


        if (settlementResult.rows.length === 0) {

            return res.status(400).json({
                message:
                    "Verification failed. Settlement record not found."
            });

        }


        const settlement =
            settlementResult.rows[0];


        const settlementAmount =
            Number(settlement.settlement_amount);


        const actualDifference =
            Math.abs(
                transactionAmount -
                settlementAmount
            );


        const adjustmentResult = await pool.query(
            `
            SELECT
                id,
                transaction_id,
                adjustment_type,
                amount,
                reason,
                created_at
            FROM settlement_adjustments
            WHERE transaction_id = $1
            ORDER BY created_at
            `,
            [mismatchCase.transaction_id]
        );


        const adjustments =
            adjustmentResult.rows.map(
                adjustment => ({

                    id:
                        adjustment.id,

                    adjustment_type:
                        adjustment.adjustment_type,

                    amount:
                        Number(
                            adjustment.amount
                        ),

                    reason:
                        adjustment.reason,

                    created_at:
                        adjustment.created_at

                })
            );


        const totalAdjustments =
            adjustments.reduce(
                (
                    sum,
                    adjustment
                ) =>
                    sum +
                    adjustment.amount,
                0
            );


        const adjustmentAmounts =
            adjustments.map(
                adjustment =>
                    adjustment.amount
            );


        const uniqueAmounts =
            [
                ...new Set(
                    adjustmentAmounts
                )
            ];


        const contradictionDetected =
            uniqueAmounts.length > 1 &&
            adjustments.length > 1;


        let explainedDifference = 0;

        let unexplainedDifference =
            actualDifference;


        if (!contradictionDetected) {

            if (
                totalAdjustments <=
                actualDifference
            ) {

                explainedDifference =
                    totalAdjustments;

                unexplainedDifference =
                    actualDifference -
                    totalAdjustments;

            } else {

                explainedDifference =
                    actualDifference;

                unexplainedDifference =
                    0;

            }

        }


        let verificationPassed =
            false;

        let verificationReason;


        if (actualDifference === 0) {

            verificationPassed =
                true;

            verificationReason =
                "Transaction and settlement records now match.";

        }

        else if (
            !contradictionDetected &&
            adjustments.length > 0 &&
            unexplainedDifference === 0
        ) {

            verificationPassed =
                true;

            verificationReason =
                "The actual settlement difference is fully supported by recorded financial adjustment evidence.";

        }

        else if (contradictionDetected) {

            verificationPassed =
                false;

            verificationReason =
                "Verification failed because conflicting financial adjustment records were detected.";

        }

        else if (
            unexplainedDifference > 0 &&
            adjustments.length > 0
        ) {

            verificationPassed =
                false;

            verificationReason =
                "Verification failed because part of the actual financial difference remains unexplained.";

        }

        else {

            verificationPassed =
                false;

            verificationReason =
                "Verification failed because no supporting financial evidence was found.";

        }


        if (!verificationPassed) {

            return res.status(409).json({

                message:
                    "Independent verification failed. The action remains unverified.",

                verification: {

                    result:
                        "NOT_VERIFIED",

                    reason:
                        verificationReason,

                    transaction_id:
                        mismatchCase.transaction_id,

                    transaction_amount:
                        transactionAmount,

                    settlement_amount:
                        settlementAmount,

                    actual_difference:
                        actualDifference,

                    total_adjustments:
                        totalAdjustments,

                    explained_difference:
                        explainedDifference,

                    unexplained_difference:
                        unexplainedDifference,

                    contradiction_detected:
                        contradictionDetected

                },

                safety:
                    "Case must not be resolved until financial verification succeeds."

            });

        }


        const verificationUpdate =
            await pool.query(
                `
                UPDATE approval_actions

                SET
                    verification_status =
                        'VERIFIED'

                WHERE id = $1

                AND approval_status =
                    'APPROVED'

                AND execution_status =
                    'EXECUTED'

                AND verification_status =
                    'NOT_VERIFIED'

                RETURNING *
                `,
                [id]
            );


        if (verificationUpdate.rows.length === 0) {

            return res.status(400).json({
                message:
                    "Action could not be marked as verified."
            });

        }


        await createAuditLog({

            caseId:
                action.case_id,

            actionId:
                action.id,

            eventType:
                "ACTION_VERIFIED",

            actor:
                "SYSTEM",

            description:
                "PayTruth independently verified the settlement action against the underlying financial records.",

            oldStatus:
                "NOT_VERIFIED",

            newStatus:
                "VERIFIED",

            metadata: {

                verification_type:
                    "INDEPENDENT_FINANCIAL_RECORD_CHECK",

                independently_verified:
                    true,

                real_money_movement:
                    false

            }

        });


        return res.json({

            message:
                "Independent financial verification completed successfully.",

            action:
                verificationUpdate.rows[0],

            verification: {

                result:
                    "VERIFIED",

                reason:
                    verificationReason,

                case_id:
                    mismatchCase.id,

                transaction_id:
                    mismatchCase.transaction_id,

                transaction_amount:
                    transactionAmount,

                settlement_amount:
                    settlementAmount,

                actual_difference:
                    actualDifference,

                total_adjustments:
                    totalAdjustments,

                explained_difference:
                    explainedDifference,

                unexplained_difference:
                    unexplainedDifference,

                contradiction_detected:
                    contradictionDetected,

                transaction_record_checked:
                    true,

                settlement_record_checked:
                    true,

                adjustment_records_checked:
                    true

            },

            safety: {

                real_money_movement:
                    false,

                human_approval:
                    true,

                independently_verified:
                    true

            }

        });


    } catch (error) {

        console.error(
            "Independent verification error:",
            error
        );

        res.status(500).json({

            message:
                "Could not independently verify action",

            error:
                error.message

        });

    }

});


// ==================================================
// SECURE CASE RESOLUTION — STEP 55
// ==================================================

app.patch("/cases/:id/resolve", async (req, res) => {

    try {

        const { id } = req.params;


        // ==========================================
        // 1. CHECK CASE
        // ==========================================

        const caseResult = await pool.query(
            `
            SELECT
                id,
                transaction_id,
                difference,
                risk_level,
                case_status,
                created_at
            FROM mismatch_cases
            WHERE id = $1
            `,
            [id]
        );


        if (caseResult.rows.length === 0) {

            return res.status(404).json({

                message:
                    "Case not found"

            });

        }


        const mismatchCase =
            caseResult.rows[0];


        // ==========================================
        // 2. CHECK VERIFIED ACTION
        // ==========================================

        const actionResult = await pool.query(
            `
            SELECT
                id,
                case_id,
                action_type,
                approval_status,
                execution_status,
                verification_status,
                approved_by,
                approved_at
            FROM approval_actions
            WHERE case_id = $1

            AND approval_status = 'APPROVED'

            AND execution_status = 'EXECUTED'

            AND verification_status = 'VERIFIED'

            ORDER BY created_at DESC

            LIMIT 1
            `,
            [id]
        );


        if (actionResult.rows.length === 0) {

            return res.status(409).json({

                message:
                    "Case cannot be resolved because no successfully verified action exists.",

                case_id:
                    mismatchCase.id,

                transaction_id:
                    mismatchCase.transaction_id,

                safety:
                    "Human approval, execution and independent verification are required before case resolution."

            });

        }


        const verifiedAction =
            actionResult.rows[0];


        // ==========================================
        // 3. CHECK CURRENT CASE STATUS
        // ==========================================

        if (
            mismatchCase.case_status ===
            "RESOLVED"
        ) {

            return res.status(400).json({

                message:
                    "Case is already resolved.",

                case:
                    mismatchCase

            });

        }


        // ==========================================
        // 4. RESOLVE CASE
        // ==========================================

        const result = await pool.query(
            `
            UPDATE mismatch_cases

            SET case_status = 'RESOLVED'

            WHERE id = $1

            AND case_status != 'RESOLVED'

            RETURNING *
            `,
            [id]
        );


        if (result.rows.length === 0) {

            return res.status(400).json({

                message:
                    "Case could not be resolved."

            });

        }
        // ==========================================
// AUDIT CASE RESOLUTION
// ==========================================

const resolvedCase = result.rows[0];

await createAuditLog({

    caseId:
        resolvedCase.id,

    actionId:
        verifiedAction.id,

    eventType:
        "CASE_RESOLVED",

    actor:
        "SYSTEM",

    description:
        "PayTruth resolved the mismatch case after human approval, controlled execution and independent verification.",

    oldStatus:
        "INVESTIGATING",

    newStatus:
        "RESOLVED",

    metadata: {

        transaction_id:
            resolvedCase.transaction_id,

        human_approval:
            true,

        action_executed:
            true,

        independently_verified:
            true,

        real_money_movement:
            false

    }

});


        // ==========================================
        // 5. SUCCESS RESPONSE
        // ==========================================

        res.json({

            message:
                "Case resolved successfully after verified financial action.",

            case:
                result.rows[0],

            verified_action: {

                id:
                    verifiedAction.id,

                action_type:
                    verifiedAction.action_type,

                approval_status:
                    verifiedAction.approval_status,

                execution_status:
                    verifiedAction.execution_status,

                verification_status:
                    verifiedAction.verification_status

            },

            workflow: {

                human_approved:
                    true,

                action_executed:
                    true,

                independently_verified:
                    true,

                case_resolved:
                    true

            }

        });


    } catch (error) {

        console.error(
            "Case resolution error:",
            error
        );


        res.status(500).json({

            message:
                "Could not resolve case",

            error:
                error.message

        });

    }

});


// ==================================================
// INVESTIGATION ENGINE — STEP 39
// ==================================================


// ==========================================
// CASE HISTORY
// ==========================================

app.get("/cases/:id/history", async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `
            SELECT
                mc.id AS case_id,
                mc.transaction_id,
                mc.difference,
                mc.risk_level,
                mc.case_status,
                mc.created_at AS case_created_at,

                aa.id AS action_id,
                aa.action_type,
                aa.ai_reason,
                aa.proposed_action,
                aa.approval_status,
                aa.approved_by,
                aa.approved_at,
                aa.execution_status,
                aa.verification_status,
                aa.created_at AS action_created_at

            FROM mismatch_cases mc

            LEFT JOIN approval_actions aa
                ON mc.id = aa.case_id

            WHERE mc.id = $1

            ORDER BY aa.created_at ASC
            `,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Case not found"
            });
        }

        res.json({
            case: {
                id: result.rows[0].case_id,
                transaction_id: result.rows[0].transaction_id,
                difference: result.rows[0].difference,
                risk_level: result.rows[0].risk_level,
                case_status: result.rows[0].case_status,
                created_at: result.rows[0].case_created_at
            },

            actions: result.rows
                .filter(row => row.action_id !== null)
                .map(row => ({
                    id: row.action_id,
                    action_type: row.action_type,
                    ai_reason: row.ai_reason,
                    proposed_action: row.proposed_action,
                    approval_status: row.approval_status,
                    approved_by: row.approved_by,
                    approved_at: row.approved_at,
                    execution_status: row.execution_status,
                    verification_status: row.verification_status,
                    created_at: row.action_created_at
                }))
        });

    } catch (error) {

        console.error("Case history error:", error);

        res.status(500).json({
            message: "Could not fetch case history"
        });
    }
});
app.get("/payment-health", async (req, res) => {
    try {
        const result = await pool.query(`
    SELECT
        (SELECT COUNT(*) FROM transactions) AS total_transactions,

        (SELECT COUNT(*) FROM transactions
         WHERE payment_status = 'SUCCESS') AS successful_payments,

        (SELECT COUNT(*) FROM payments
         WHERE payment_status = 'FAILED') AS failed_payments,

        (SELECT COALESCE(SUM(transaction_amount),0)
         FROM transactions) AS total_transaction_value
`);

        const settlementResult = await pool.query(`
            SELECT
                COALESCE(SUM(settlement_amount), 0)
                AS total_settlement_value
            FROM settlements
        `);

        const mismatchResult = await pool.query(`
    SELECT
        COUNT(*) AS mismatches,

        COUNT(*) FILTER (
            WHERE case_status != 'RESOLVED'
        ) AS unresolved_mismatches,

        COUNT(*) FILTER (
            WHERE case_status = 'RESOLVED'
        ) AS resolved_mismatches,

        COALESCE(
            SUM(difference) FILTER (
                WHERE case_status != 'RESOLVED'
            ),
            0
        ) AS money_at_risk

    FROM mismatch_cases
`);
const resolutionResult = await pool.query(`
    SELECT
        COUNT(*) FILTER (
            WHERE case_status = 'RESOLVED'
        ) AS resolved_cases,

        COUNT(*) AS total_cases

    FROM mismatch_cases
`);

        const health = {
            total_transactions:
                Number(result.rows[0].total_transactions),

            successful_payments:
                Number(result.rows[0].successful_payments),

            failed_payments:
                Number(result.rows[0].failed_payments),

            total_transaction_value:
                Number(result.rows[0].total_transaction_value),

            total_settlement_value:
                Number(
                    settlementResult.rows[0]
                        .total_settlement_value
                ),

            mismatches:
                Number(
                    mismatchResult.rows[0].mismatches
                ),

            money_at_risk:
                Number(
                    mismatchResult.rows[0].money_at_risk
                ),

            resolved_cases:
                Number(
                    resolutionResult.rows[0].resolved_cases
                ),

            total_cases:
                Number(
                    resolutionResult.rows[0].total_cases
                )
        };

        res.json(health);

    } catch (error) {

        console.error(
            "Payment health error:",
            error
        );

        res.status(500).json({
            message: "Could not calculate payment health"
        });
    }
});
// ==========================================
// AI RISK PRIORITIZATION ENGINE
// ==========================================

app.get("/risk-prioritization", async (req, res) => {
    try {

        const result = await pool.query(`
            SELECT
                id,
                transaction_id,
                difference,
                risk_level,
                case_status,
                created_at,

                CASE
                    WHEN case_status = 'RESOLVED'
                        THEN 'COMPLETED'

                    WHEN risk_level = 'HIGH'
                         AND difference >= 1000
                        THEN 'CRITICAL'

                    WHEN risk_level = 'HIGH'
                        THEN 'HIGH'

                    WHEN risk_level = 'MEDIUM'
                        THEN 'MEDIUM'

                    WHEN risk_level = 'LOW'
                        THEN 'LOW'

                    ELSE 'REVIEW'
                END AS priority,

                CASE
                    WHEN case_status = 'RESOLVED'
                        THEN 0

                    WHEN risk_level = 'HIGH'
                         AND difference >= 1000
                        THEN 100

                    WHEN risk_level = 'HIGH'
                        THEN 80

                    WHEN risk_level = 'MEDIUM'
                        THEN 50

                    WHEN risk_level = 'LOW'
                        THEN 25

                    ELSE 10
                END AS priority_score

            FROM mismatch_cases

            ORDER BY priority_score DESC, difference DESC
        `);

        res.json(result.rows);

    } catch (error) {

        console.error(
            "Risk prioritization error:",
            error
        );

        res.status(500).json({
            message: "Could not calculate risk prioritization"
        });
    }
});
app.get("/investigate/:transaction_id", async (req, res) => {
    try {
        const { transaction_id } = req.params;

        // ==========================================
        // 1. GET TRANSACTION
        // ==========================================

        const transactionResult = await pool.query(`
            SELECT
                transaction_id,
                merchant_id,
                transaction_amount,
                transaction_date,
                payment_status
            FROM transactions
            WHERE transaction_id = $1
        `, [transaction_id]);

        if (transactionResult.rows.length === 0) {
            return res.status(404).json({
                message: "Transaction not found"
            });
        }

        const transaction = transactionResult.rows[0];

        const transactionAmount =
            Number(transaction.transaction_amount);


        // ==========================================
        // 2. GET SETTLEMENT
        // ==========================================

        const settlementResult = await pool.query(`
            SELECT
                settlement_id,
                transaction_id,
                settlement_amount,
                settlement_date,
                settlement_status
            FROM settlements
            WHERE transaction_id = $1
            ORDER BY settlement_date DESC
            LIMIT 1
        `, [transaction_id]);

        if (settlementResult.rows.length === 0) {
            return res.json({
                transaction_id,
                investigation_status: "INCOMPLETE",

                root_cause_type:
                    "MISSING_SETTLEMENT",

                root_cause:
                    "No settlement record was found for this transaction.",

                confidence: 100,

                recommended_action:
                    "Investigate the missing settlement record.",

                human_approval_required: true,

                automatic_action: false
            });
        }

        const settlement = settlementResult.rows[0];

        const settlementAmount =
            Number(settlement.settlement_amount);


        // ==========================================
        // 3. CALCULATE DIFFERENCE
        // ==========================================

        const difference =
            Math.abs(
                transactionAmount -
                settlementAmount
            );


        // ==========================================
        // 4. GET FINANCIAL ADJUSTMENTS
        // ==========================================

        const adjustmentResult = await pool.query(`
            SELECT
                id,
                transaction_id,
                adjustment_type,
                amount,
                reason,
                created_at
            FROM settlement_adjustments
            WHERE transaction_id = $1
            ORDER BY created_at
        `, [transaction_id]);

        const adjustments =
            adjustmentResult.rows.map(row => ({
                id: row.id,
                adjustment_type:
                    row.adjustment_type,
                amount:
                    Number(row.amount),
                reason:
                    row.reason,
                created_at:
                    row.created_at
            }));


        // ==========================================
        // 5. TOTAL ADJUSTMENTS
        // ==========================================

        const totalAdjustments =
            adjustments.reduce(
                (sum, adjustment) =>
                    sum + adjustment.amount,
                0
            );


        // ==========================================
        // 6. CONTRADICTION DETECTION
        // ==========================================

        const adjustmentAmounts =
            adjustments.map(
                adjustment =>
                    adjustment.amount
            );

        const uniqueAmounts =
            [...new Set(adjustmentAmounts)];

        const contradictionDetected =
            uniqueAmounts.length > 1 &&
            adjustments.length > 1;


        // ==========================================
        // 7. EXPLAINED / UNEXPLAINED AMOUNT
        // ==========================================

        let explainedDifference = 0;
        let unexplainedDifference = difference;

        if (!contradictionDetected) {

            if (totalAdjustments <= difference) {

                explainedDifference =
                    totalAdjustments;

                unexplainedDifference =
                    difference -
                    totalAdjustments;

            } else {

                explainedDifference =
                    difference;

                unexplainedDifference = 0;
            }
        }


        // ==========================================
        // // ==========================================
// 8. CONFIDENCE + ACCURACY ENGINE
// ==========================================

let rootCauseType;
let rootCause;
let confidence;
let investigationStatus;

let confidenceStatus;
let abstained;
let abstainReason;
let recommendationAllowed;
let evidenceCoverage;




// ------------------------------------------
// CALCULATE EVIDENCE COVERAGE
// ------------------------------------------

if (difference === 0) {

    evidenceCoverage = 100;

} else if (difference > 0) {

    evidenceCoverage =
        Math.min(
            100,
            Math.round(
                (explainedDifference / difference) * 100
            )
        );

} else {

    evidenceCoverage = 0;
}


// ------------------------------------------
// CASE A: NO MISMATCH
// ------------------------------------------

if (difference === 0) {

    investigationStatus =
        "NO_MISMATCH";

    rootCauseType =
        "NO_DISCREPANCY";

    rootCause =
        "Transaction amount and settlement amount match.";

    confidence =
        100;

    confidenceStatus =
        "HIGH";

    abstained =
        false;

    abstainReason =
        null;

    recommendationAllowed =
        false;

    

}


// ------------------------------------------
// CASE B: CONTRADICTION
// ------------------------------------------

else if (contradictionDetected) {

    investigationStatus =
        "CONTRADICTION_DETECTED";

    rootCauseType =
        "ADJUSTMENT_REQUIRES_REVIEW";

    rootCause =
        "Conflicting financial adjustment records were detected. A reliable root cause cannot be determined.";

    confidence =
        0;

    confidenceStatus =
        "ABSTAIN";

    abstained =
        true;

    abstainReason =
        "Conflicting financial evidence prevents reliable root-cause determination.";

    recommendationAllowed =
        false;

    

}


// ------------------------------------------
// CASE C: FULLY EXPLAINED
// ------------------------------------------

else if (
    unexplainedDifference === 0 &&
    adjustments.length > 0
) {

    investigationStatus =
        "FULLY_EXPLAINED";

    const adjustmentTypes =
        [
            ...new Set(
                adjustments.map(
                    adjustment =>
                        adjustment.adjustment_type
                )
            )
        ];

    rootCauseType =
        "FINANCIAL_ADJUSTMENT";

    rootCause =
        `The ₹${difference} settlement difference is fully explained by recorded financial adjustment(s): ${adjustmentTypes.join(", ")}.`;

    /*
     * High confidence requires:
     *
     * 1. Difference exists
     * 2. Evidence exists
     * 3. Evidence completely explains difference
     * 4. No contradiction
     */

    confidence =
        evidenceCoverage === 100 &&
        !contradictionDetected
            ? 98
            : 90;

    confidenceStatus =
        confidence >= 95
            ? "HIGH"
            : "MEDIUM";

    abstained =
        false;

    abstainReason =
        null;

    recommendationAllowed =
        confidence >= 95;

    

}


// ------------------------------------------
// CASE D: PARTIALLY EXPLAINED
// ------------------------------------------

else if (
    unexplainedDifference > 0 &&
    adjustments.length > 0
) {

    investigationStatus =
        "PARTIALLY_EXPLAINED";

    rootCauseType =
        "INSUFFICIENT_EVIDENCE";

    rootCause =
        `Recorded financial adjustments explain ₹${explainedDifference}, but ₹${unexplainedDifference} remains unexplained.`;

    /*
     * Partial evidence is not enough to
     * establish a reliable root cause.
     */

    confidence =
        evidenceCoverage;

    confidenceStatus =
        confidence >= 80
            ? "MEDIUM"
            : "LOW";

    abstained =
        true;

    abstainReason =
        "Evidence explains only part of the financial difference.";

    recommendationAllowed =
        false;

    

}


// ------------------------------------------
// CASE E: NO SUPPORTING EVIDENCE
// ------------------------------------------

else {

    investigationStatus =
        "UNEXPLAINED_MISMATCH";

    rootCauseType =
        "UNKNOWN";

    rootCause =
        `A ₹${difference} settlement mismatch was detected, but no financial adjustment evidence was found to explain it.`;

    confidence =
        0;

    confidenceStatus =
        "ABSTAIN";

    abstained =
        true;

    abstainReason =
        "No supporting financial evidence was found to determine the root cause.";

    recommendationAllowed =
        false;
}

    // ==========================================
// ==========================================
// 9. RECOMMENDATION ENGINE
// ==========================================

let recommendationType;
let proposedAction;
let recommendationReason;
let recommendationPriority;
let requiresHumanApproval;
let allowedToExecute;
let blockedReason;


// ------------------------------------------
// CASE A: NO MISMATCH
// ------------------------------------------

if (investigationStatus === "NO_MISMATCH") {

    recommendationType =
        "NO_ACTION";

    proposedAction =
        "No corrective action required.";

    recommendationReason =
        "Transaction and settlement amounts match.";

    recommendationPriority =
        "LOW";

    requiresHumanApproval =
        false;

    allowedToExecute =
        false;

    blockedReason =
        "No financial discrepancy exists.";

}


// ------------------------------------------
// CASE B: CONTRADICTION
// ------------------------------------------

else if (
    investigationStatus ===
    "CONTRADICTION_DETECTED"
) {

    recommendationType =
        "HUMAN_INVESTIGATION";

    proposedAction =
        "Investigate the conflicting financial records before taking corrective action.";

    recommendationReason =
        "Conflicting financial evidence prevents reliable root-cause determination.";

    recommendationPriority =
        "HIGH";

    requiresHumanApproval =
        true;

    allowedToExecute =
        false;

    blockedReason =
        "Recommendation blocked because the investigation engine abstained due to contradictory evidence.";

}


// ------------------------------------------
// CASE C: FULLY EXPLAINED
// ------------------------------------------

else if (
    investigationStatus ===
        "FULLY_EXPLAINED" &&
    confidenceStatus ===
        "HIGH" &&
    !abstained &&
    recommendationAllowed
) {

    recommendationType =
        "REVIEW_FINANCIAL_ADJUSTMENT";

    proposedAction =
        "Review the identified financial adjustment and proceed with the appropriate corrective action after human approval.";

    recommendationReason =
        rootCause;

    recommendationPriority =
        "MEDIUM";

    requiresHumanApproval =
        true;

    allowedToExecute =
        true;

    blockedReason =
        null;

}


// ------------------------------------------
// CASE D: PARTIALLY EXPLAINED
// ------------------------------------------

else if (
    investigationStatus ===
    "PARTIALLY_EXPLAINED"
) {

    recommendationType =
        "ADDITIONAL_INVESTIGATION";

    proposedAction =
        "Collect additional financial evidence before taking corrective action.";

    recommendationReason =
        `Only ₹${explainedDifference} of the ₹${difference} difference is explained.`;

    recommendationPriority =
        "HIGH";

    requiresHumanApproval =
        true;

    allowedToExecute =
        false;

    blockedReason =
        "Insufficient evidence to establish a reliable root cause.";

}


// ------------------------------------------
// CASE E: UNEXPLAINED MISMATCH
// ------------------------------------------

else if (
    investigationStatus ===
    "UNEXPLAINED_MISMATCH"
) {

    recommendationType =
        "INVESTIGATE_MISMATCH";

    proposedAction =
        "Investigate the transaction, settlement and related financial records.";

    recommendationReason =
        rootCause;

    recommendationPriority =
        "HIGH";

    requiresHumanApproval =
        true;

    allowedToExecute =
        false;

    blockedReason =
        "No supporting financial evidence was found.";

}


// ------------------------------------------
// SAFETY FALLBACK
// ------------------------------------------

else {

    recommendationType =
        "HUMAN_REVIEW";

    proposedAction =
        "Human review is required before taking any financial action.";

    recommendationReason =
        "The recommendation engine could not establish a safe recommendation.";

    recommendationPriority =
        "HIGH";

    requiresHumanApproval =
        true;

    allowedToExecute =
        false;

    blockedReason =
        "Unknown investigation state.";

}

        // ==========================================
        // 9. RETURN INVESTIGATION + ROOT CAUSE
        // ==========================================

        res.json({

            transaction_id,

            merchant_id:
                transaction.merchant_id,

            investigation_status:
                investigationStatus,


            transaction: {

                amount:
                    transactionAmount,

                date:
                    transaction.transaction_date,

                payment_status:
                    transaction.payment_status

            },


            settlement: {

                settlement_id:
                    settlement.settlement_id,

                amount:
                    settlementAmount,

                date:
                    settlement.settlement_date,

                status:
                    settlement.settlement_status

            },


            mismatch: {

                detected:
                    difference !== 0,

                transaction_amount:
                    transactionAmount,

                settlement_amount:
                    settlementAmount,

                difference

            },


            financial_evidence: [

                {

                    check:
                        "Transaction amount",

                    value:
                        transactionAmount,

                    result:
                        "RECORDED"

                },

                {

                    check:
                        "Settlement amount",

                    value:
                        settlementAmount,

                    result:
                        "RECORDED"

                },

                {

                    check:
                        "Amount difference",

                    calculation:
                        `${transactionAmount} - ${settlementAmount}`,

                    difference,

                    result:
                        difference === 0
                            ? "MATCH"
                            : "MISMATCH"

                },

                ...adjustments.map(
                    adjustment => ({

                        check:
                            "Financial adjustment",

                        adjustment_type:
                            adjustment.adjustment_type,

                        amount:
                            adjustment.amount,

                        reason:
                            adjustment.reason,

                        result:
                            "FOUND"

                    })
                ),

                {

                    check:
                        "Adjustment reconciliation",

                    total_adjustments:
                        totalAdjustments,

                    mismatch_amount:
                        difference,

                    unexplained_difference:
                        unexplainedDifference,

                    result:
                        contradictionDetected
                            ? "REQUIRES_REVIEW"
                            : unexplainedDifference === 0
                                ? "FULLY_EXPLAINED"
                                : "PARTIALLY_EXPLAINED"

                }

            ],


            root_cause_type:
                rootCauseType,

            root_cause:
                rootCause,

            

            confidence,

confidence_status:
    confidenceStatus,

evidence_coverage:
    evidenceCoverage,

abstained,

abstain_reason:
    abstainReason,

recommendation: {

    type:
        recommendationType,

    proposed_action:
        proposedAction,

    reason:
        recommendationReason,

    priority:
        recommendationPriority,

    requires_human_approval:
        requiresHumanApproval,

    allowed_to_execute:
        allowedToExecute,

    blocked_reason:
        blockedReason

},

recommendation_allowed:
    recommendationAllowed,

explained_difference:
    explainedDifference,

            unexplained_difference:
                unexplainedDifference,

            contradiction_detected:
                contradictionDetected,

            

            explanation: {
                summary:
                    rootCause,

    transaction_amount:
        transactionAmount,

    settlement_amount:
        settlementAmount,

    detected_difference:
        difference,

    explained_difference:
        explainedDifference,

    unexplained_difference:
        unexplainedDifference,

    evidence_count:
        adjustments.length,

    evidence: adjustments.map(
        adjustment => ({
            type:
                adjustment.adjustment_type,

            amount:
                adjustment.amount,

            reason:
                adjustment.reason
        })
    ),

    contradiction_detected:
        contradictionDetected,

    evidence_sufficient:
    recommendationAllowed,

confidence:
    confidence,

confidence_status:
    confidenceStatus,

evidence_coverage:
    evidenceCoverage,

abstained,

abstain_reason:
    abstainReason,

recommendation_allowed:
    recommendationAllowed,

explained_difference:
    explainedDifference,

unexplained_difference:
    unexplainedDifference,

contradiction_detected:
    contradictionDetected,
},  

            human_approval_required:
                difference !== 0,

            automatic_action:
                false

        });

    } catch (error) {

        console.error(
            "Investigation error:",
            error
        );

        res.status(500).json({

            message:
                "Could not investigate transaction"

        });

    }
});
// ==================================================
// GET AUDIT LOGS — STEP 56
// ==================================================

app.get("/audit-logs", async (req, res) => {

    try {

        const result = await pool.query(
            `
            SELECT
                id,
                case_id,
                action_id,
                event_type,
                actor,
                description,
                old_status,
                new_status,
                metadata,
                created_at
            FROM audit_logs
            ORDER BY created_at DESC
            `
        );

        res.json({
            total_logs: result.rows.length,
            audit_logs: result.rows
        });

    } catch (error) {

        console.error(
            "Audit log fetch error:",
            error
        );

        res.status(500).json({
            message: "Could not fetch audit logs",
            error: error.message
        });

    }

});
// ==================================================
// PAYMENT FAILURE INTELLIGENCE — STEP 57
// ==================================================

app.get("/payment-failures", async (req, res) => {

    try {

        const result = await pool.query(`
            SELECT
                id,
                payment_id,
                order_id,
                amount,
                payment_status,
                failure_reason,
                created_at
            FROM payments
            WHERE payment_status = 'FAILED'
            ORDER BY created_at DESC
        `);

        const failedPayments = result.rows.map(payment => {

            const amount = Number(payment.amount);

            let riskLevel;
            let recommendationType;
            let proposedAction;
            let recommendationReason;

            // ==========================================
            // FAILURE REASON ANALYSIS
            // ==========================================

            switch (payment.failure_reason) {

                case "INSUFFICIENT_FUNDS":

                    riskLevel = "MEDIUM";

                    recommendationType =
                        "PAYMENT_RETRY";

                    proposedAction =
                        "Request the customer to retry the payment using an available payment method.";

                    recommendationReason =
                        "The payment failed because sufficient funds were not available.";

                    break;


                case "BANK_DECLINED":

                    riskLevel = "HIGH";

                    recommendationType =
                        "ALTERNATIVE_PAYMENT_METHOD";

                    proposedAction =
                        "Request the customer to retry using another payment method.";

                    recommendationReason =
                        "The payment was declined by the bank.";

                    break;


                case "AUTHENTICATION_FAILED":

                    riskLevel = "MEDIUM";

                    recommendationType =
                        "AUTHENTICATION_RETRY";

                    proposedAction =
                        "Ask the customer to retry the payment and complete authentication successfully.";

                    recommendationReason =
                        "Payment authentication was unsuccessful.";

                    break;


                default:

                    riskLevel = "HIGH";

                    recommendationType =
                        "HUMAN_REVIEW";

                    proposedAction =
                        "Investigate the failed payment before attempting recovery.";

                    recommendationReason =
                        "The payment failure reason is unknown or unsupported.";

                    break;
            }


            // ==========================================
            // HIGH-VALUE PAYMENT ESCALATION
            // ==========================================

            if (amount >= 5000 && riskLevel !== "HIGH") {

                riskLevel = "HIGH";

                recommendationType =
                    "HUMAN_REVIEW";

                proposedAction =
                    "Review the high-value failed payment before attempting recovery.";

                recommendationReason =
                    "The payment amount requires additional human review before recovery.";

            }


            return {

                payment_id:
                    payment.payment_id,

                order_id:
                    payment.order_id,

                amount,

                payment_status:
                    payment.payment_status,

                failure_reason:
                    payment.failure_reason,

                risk_level:
                    riskLevel,

                analysis: {

                    failure_detected: true,

                    root_cause:
                        recommendationReason,

                    recommendation: {

                        type:
                            recommendationType,

                        proposed_action:
                            proposedAction,

                        reason:
                            recommendationReason,

                        requires_human_approval:
                            true,

                        automatic_action:
                            false

                    }

                },

                created_at:
                    payment.created_at

            };

        });


        res.json({

            total_failed_payments:
                failedPayments.length,

            payment_failures:
                failedPayments

        });

    } catch (error) {

        console.error(
            "Payment failure intelligence error:",
            error
        );

        res.status(500).json({

            message:
                "Could not analyze failed payments",

            error:
                error.message

        });

    }

});
// ==================================================
// FRAUD & ANOMALY INTELLIGENCE
// ==================================================

// ==================================================
// FRAUD & ANOMALY INTELLIGENCE ENGINE
// ==================================================

// ==================================================
// FRAUD & ANOMALY INTELLIGENCE
// ==================================================

app.get("/fraud-intelligence", async (req, res) => {

    try {

        // ==========================================
        // 1. GET ALL PAYMENT RECORDS
        // ==========================================

        const paymentResult = await pool.query(`
            SELECT
                payment_id,
                order_id,
                amount,
                payment_status,
                failure_reason,
                created_at
            FROM payments
            ORDER BY created_at DESC
        `);

        const fraudResults = [];

        // ==========================================
        // 2. ANALYZE EACH PAYMENT
        // ==========================================

        for (const payment of paymentResult.rows) {

            const amount = Number(payment.amount || 0);

            let fraudScore = 0;

            const signals = [];

            // ==========================================
            // SIGNAL 1 — FAILED PAYMENT
            // ==========================================

            if (payment.payment_status === "FAILED") {

                fraudScore += 20;

                signals.push({
                    type: "FAILED_PAYMENT",
                    severity: "MEDIUM",
                    score: 20,
                    explanation:
                        "The payment failed and requires additional risk analysis."
                });
            }

            // ==========================================
            // SIGNAL 2 — ELEVATED VALUE
            // ==========================================

            if (amount >= 10000) {

                fraudScore += 30;

                signals.push({
                    type: "HIGH_VALUE_PAYMENT",
                    severity: "HIGH",
                    score: 30,
                    explanation:
                        `The payment amount of ₹${amount} is unusually high for the current risk model.`
                });

            } else if (amount >= 5000) {

                fraudScore += 15;

                signals.push({
                    type: "ELEVATED_VALUE_PAYMENT",
                    severity: "MEDIUM",
                    score: 15,
                    explanation:
                        `The payment amount of ₹${amount} requires additional monitoring.`
                });
            }

            // ==========================================
            // SIGNAL 3 — RISKY FAILURE REASON
            // ==========================================

            if (
                payment.payment_status === "FAILED" &&
                (
                    payment.failure_reason === "BANK_DECLINED" ||
                    payment.failure_reason === "AUTHENTICATION_FAILED"
                )
            ) {

                fraudScore += 15;

                signals.push({
                    type: "PAYMENT_RISK_FAILURE",
                    severity: "MEDIUM",
                    score: 15,
                    explanation:
                        `The payment failed because of ${payment.failure_reason}.`
                });
            }

            // ==========================================
            // SIGNAL 4 — UNKNOWN FAILURE REASON
            // ==========================================

            if (
                payment.payment_status === "FAILED" &&
                ![
                    "INSUFFICIENT_FUNDS",
                    "BANK_DECLINED",
                    "AUTHENTICATION_FAILED"
                ].includes(payment.failure_reason)
            ) {

                fraudScore += 20;

                signals.push({
                    type: "UNKNOWN_FAILURE_REASON",
                    severity: "HIGH",
                    score: 20,
                    explanation:
                        "The payment contains an unknown or unsupported failure reason."
                });
            }

            // ==========================================
            // SIGNAL 5 — REPEATED PAYMENT ATTEMPTS
            // ==========================================

            if (payment.order_id) {

                const repeatResult = await pool.query(
                    `
                    SELECT COUNT(*) AS attempt_count
                    FROM payments
                    WHERE order_id = $1
                    `,
                    [payment.order_id]
                );

                const attemptCount =
                    Number(repeatResult.rows[0].attempt_count || 0);

                if (attemptCount >= 3) {

                    fraudScore += 25;

                    signals.push({
                        type: "REPEATED_PAYMENT_ATTEMPTS",
                        severity: "HIGH",
                        score: 25,
                        explanation:
                            `The order has ${attemptCount} payment attempts, indicating unusual payment activity.`
                    });

                } else if (attemptCount === 2) {

                    fraudScore += 10;

                    signals.push({
                        type: "MULTIPLE_PAYMENT_ATTEMPTS",
                        severity: "LOW",
                        score: 10,
                        explanation:
                            "The order has multiple payment attempts."
                    });
                }
            }

            // ==========================================
            // 3. CAP FRAUD SCORE
            // ==========================================

            fraudScore = Math.min(fraudScore, 100);

            // ==========================================
            // 4. DETERMINE RISK LEVEL
            // ==========================================

            let riskLevel;

            if (fraudScore >= 75) {

                riskLevel = "CRITICAL";

            } else if (fraudScore >= 50) {

                riskLevel = "HIGH";

            } else if (fraudScore >= 25) {

                riskLevel = "MEDIUM";

            } else {

                riskLevel = "LOW";
            }

            // ==========================================
            // 5. DETERMINE RECOMMENDATION
            // ==========================================

            let recommendedAction;
            let requiresHumanApproval;

            if (riskLevel === "CRITICAL") {

                recommendedAction = "FRAUD_INVESTIGATION";
                requiresHumanApproval = true;

            } else if (riskLevel === "HIGH") {

                recommendedAction = "ENHANCED_REVIEW";
                requiresHumanApproval = true;

            } else if (riskLevel === "MEDIUM") {

                recommendedAction = "MONITOR_AND_REVIEW";
                requiresHumanApproval = true;

            } else {

                recommendedAction = "NO_ACTION";
                requiresHumanApproval = false;
            }

            // ==========================================
            // 6. AI EXPLANATION
            // ==========================================

            let aiReason;

            if (signals.length === 0) {

                aiReason =
                    "No significant fraud or anomaly signals were detected.";

            } else {

                const signalNames = signals
                    .map(signal => signal.type)
                    .join(", ");

                aiReason =
                    `${signals.length} risk signal(s) detected: ${signalNames}. PayTruth recommends ${recommendedAction}.`;
            }

            // ==========================================
            // 7. BUILD RESULT
            // ==========================================

            fraudResults.push({

                payment_id: payment.payment_id,

                order_id: payment.order_id,

                amount,

                payment_status:
                    payment.payment_status,

                failure_reason:
                    payment.failure_reason,

                fraud_score:
                    fraudScore,

                risk_level:
                    riskLevel,

                signals,

                signal_count:
                    signals.length,

                ai_reason:
                    aiReason,

                recommendation: {

                    type:
                        recommendedAction,

                    requires_human_approval:
                        requiresHumanApproval,

                    automatic_action:
                        false
                },

                case_status:
                    "OPEN",

                created_at:
                    payment.created_at
            });
        }

        // ==========================================
        // 8. STORE HIGH-RISK CASES
        // ==========================================

        for (const fraudCase of fraudResults) {

            if (fraudCase.fraud_score >= 50) {

                const existingResult = await pool.query(
                    `
                    SELECT id
                    FROM fraud_cases
                    WHERE payment_id = $1
                    `,
                    [fraudCase.payment_id]
                );

                if (existingResult.rows.length === 0) {

                    await pool.query(
                        `
                        INSERT INTO fraud_cases
                        (
                            payment_id,
                            order_id,
                            amount,
                            fraud_score,
                            risk_level,
                            signals,
                            ai_reason,
                            recommended_action
                        )
                        VALUES
                        (
                            $1,
                            $2,
                            $3,
                            $4,
                            $5,
                            $6,
                            $7,
                            $8
                        )
                        `,
                        [
                            fraudCase.payment_id,
                            fraudCase.order_id,
                            fraudCase.amount,
                            fraudCase.fraud_score,
                            fraudCase.risk_level,
                            JSON.stringify(fraudCase.signals),
                            fraudCase.ai_reason,
                            fraudCase.recommendation.type
                        ]
                    );
                }
            }
        }

        // ==========================================
        // 9. SUMMARY
        // ==========================================

        const summary = {

            total_payments:
                fraudResults.length,

            low_risk:
                fraudResults.filter(
                    item => item.risk_level === "LOW"
                ).length,

            medium_risk:
                fraudResults.filter(
                    item => item.risk_level === "MEDIUM"
                ).length,

            high_risk:
                fraudResults.filter(
                    item => item.risk_level === "HIGH"
                ).length,

            critical_risk:
                fraudResults.filter(
                    item => item.risk_level === "CRITICAL"
                ).length,

            suspicious_payments:
                fraudResults.filter(
                    item => item.fraud_score >= 50
                ).length
        };

        // ==========================================
        // 10. RESPONSE
        // ==========================================

        return res.json({

            engine:
                "PayTruth Fraud & Anomaly Intelligence",

            summary,

            fraud_analysis:
                fraudResults
        });

    } catch (error) {

        console.error(
            "Fraud intelligence error:",
            error
        );

        return res.status(500).json({

            message:
                "Could not analyze fraud and anomaly intelligence",

            error:
                error.message
        });
    }
});


// ==================================================
// FRAUD CASE RESOLUTION
// ==================================================

app.patch("/fraud-cases/:id/resolve", async (req, res) => {

    try {

        const { id } = req.params;

        // ==========================================
        // 1. GET FRAUD CASE
        // ==========================================

        const fraudCaseResult = await pool.query(
            `
            SELECT
                id,
                payment_id,
                order_id,
                fraud_score,
                risk_level,
                recommended_action,
                case_status
            FROM fraud_cases
            WHERE id = $1
            `,
            [id]
        );

        if (fraudCaseResult.rows.length === 0) {

            return res.status(404).json({
                message: "Fraud case not found."
            });
        }

        const fraudCase =
            fraudCaseResult.rows[0];

        // ==========================================
        // 2. PREVENT DUPLICATE RESOLUTION
        // ==========================================

        if (fraudCase.case_status === "RESOLVED") {

            return res.status(400).json({
                message:
                    "Fraud case is already resolved."
            });
        }

        // ==========================================
        // 3. CHECK VERIFIED FRAUD ACTION
        // ==========================================

        const actionResult = await pool.query(
            `
            SELECT
                id,
                action_type,
                approval_status,
                execution_status,
                verification_status
            FROM approval_actions
            WHERE fraud_case_id = $1
              AND action_type = 'FRAUD_INVESTIGATION'
              AND approval_status = 'APPROVED'
              AND execution_status = 'EXECUTED'
              AND verification_status = 'VERIFIED'
            ORDER BY created_at DESC
            LIMIT 1
            `,
            [id]
        );

        if (actionResult.rows.length === 0) {

            return res.status(409).json({

                message:
                    "Fraud case cannot be resolved because no approved, executed and independently verified fraud investigation exists.",

                safety:
                    "Fraud cases must not be resolved before human approval, controlled execution and independent verification."
            });
        }

        const verifiedAction =
            actionResult.rows[0];

        // ==========================================
        // 4. RESOLVE CASE
        // ==========================================

        const updateResult = await pool.query(
            `
            UPDATE fraud_cases
            SET case_status = 'RESOLVED'
            WHERE id = $1
              AND case_status <> 'RESOLVED'
            RETURNING *
            `,
            [id]
        );

        if (updateResult.rows.length === 0) {

            return res.status(400).json({
                message:
                    "Fraud case could not be resolved."
            });
        }

        // ==========================================
        // 5. AUDIT TRAIL
        // ==========================================

        await createAuditLog({

            caseId: null,

            actionId:
                verifiedAction.id,

            eventType:
                "FRAUD_CASE_RESOLVED",

            actor:
                "MERCHANT",

            description:
                "Fraud investigation was resolved after human approval, controlled execution and independent verification. Resolution does not represent a confirmed fraud determination.",

            oldStatus:
                fraudCase.case_status,

            newStatus:
                "RESOLVED",

            metadata: {

                fraud_case_id:
                    fraudCase.id,

                payment_id:
                    fraudCase.payment_id,

                fraud_score:
                    fraudCase.fraud_score,

                risk_level:
                    fraudCase.risk_level,

                resolution_type:
                    "VERIFIED_FRAUD_INVESTIGATION",

                human_approval:
                    true,

                independently_verified:
                    true,

                real_money_movement:
                    false
            }
        });

        // ==========================================
        // 6. RESPONSE
        // ==========================================

        return res.json({

            message:
                "Fraud investigation resolved successfully.",

            fraud_case:
                updateResult.rows[0],

            verified_action:
                verifiedAction,

            safety: {

                fraud_confirmed:
                    false,

                investigation_verified:
                    true,

                human_approval:
                    true,

                real_money_movement:
                    false
            }
        });

    } catch (error) {

        console.error(
            "Fraud case resolution error:",
            error
        );

        return res.status(500).json({

            message:
                "Could not resolve fraud case",

            error:
                error.message
        });
    }
});


// ==================================================
// REFUND & ADJUSTMENT INTELLIGENCE
// ==================================================

app.get("/refund-intelligence", async (req, res) => {

    try {

        // ==========================================
        // 1. GET ADJUSTMENTS WITH FINANCIAL RECORDS
        // ==========================================

        const result = await pool.query(
            `
            SELECT
                sa.id AS adjustment_id,
                sa.transaction_id,
                sa.adjustment_type,
                sa.amount AS adjustment_amount,
                sa.reason AS adjustment_reason,
                sa.created_at,

                t.transaction_amount,

                s.settlement_amount

            FROM settlement_adjustments sa

            LEFT JOIN transactions t
                ON t.transaction_id = sa.transaction_id

            LEFT JOIN settlements s
                ON s.transaction_id = sa.transaction_id

            ORDER BY sa.created_at DESC
            `
        );

        // ==========================================
        // 2. ANALYZE EACH ADJUSTMENT
        // ==========================================

        const analysis = result.rows.map(adjustment => {

            const transactionAmount =
                Number(adjustment.transaction_amount || 0);

            const settlementAmount =
                Number(adjustment.settlement_amount || 0);

            const adjustmentAmount =
                Number(adjustment.adjustment_amount || 0);

            // ======================================
            // FINANCIAL DIFFERENCE
            // ======================================

            const difference =
                Math.abs(
                    transactionAmount -
                    settlementAmount
                );

            // ======================================
            // EXPLAINED / UNEXPLAINED
            // ======================================

            let explainedAmount = 0;

            let unexplainedAmount =
                difference;

            if (adjustment.adjustment_type === "REFUND") {

                explainedAmount =
                    Math.min(
                        adjustmentAmount,
                        difference
                    );

                unexplainedAmount =
                    difference -
                    explainedAmount;
            }

            // ======================================
            // RISK CLASSIFICATION
            // ======================================

            let riskLevel = "LOW";

            if (unexplainedAmount > 1000) {

                riskLevel = "HIGH";

            } else if (unexplainedAmount > 0) {

                riskLevel = "MEDIUM";
            }

            // ======================================
            // RECOMMENDATION
            // ======================================

            let recommendationType =
                "NO_ACTION";

            let proposedAction =
                "No further action is required.";

            let explanation =
                "The adjustment has been recorded and the financial impact is explained.";

            // Fully explained
            if (
                difference > 0 &&
                unexplainedAmount === 0
            ) {

                recommendationType =
                    "VERIFY_REFUND";

                proposedAction =
                    "Verify that the recorded refund is correctly reflected in the settlement.";

                explanation =
                    "The settlement difference is fully explained by the recorded refund.";

                riskLevel =
                    "LOW";
            }

            // Partially explained
            else if (
                explainedAmount > 0 &&
                unexplainedAmount > 0
            ) {

                recommendationType =
                    "INVESTIGATE_UNEXPLAINED_AMOUNT";

                proposedAction =
                    "Investigate the remaining unexplained settlement difference.";

                explanation =
                    "The refund explains part of the settlement difference, but an unexplained amount remains.";

                riskLevel =
                    unexplainedAmount > 1000
                        ? "HIGH"
                        : "MEDIUM";
            }

            // No explanation
            else if (difference > 0) {

                recommendationType =
                    "INVESTIGATE_ADJUSTMENT";

                proposedAction =
                    "Investigate the settlement difference and verify the adjustment.";

                explanation =
                    "A settlement difference exists but the recorded adjustment does not explain it.";

                riskLevel =
                    difference > 1000
                        ? "HIGH"
                        : "MEDIUM";
            }

            return {

                adjustment_id:
                    adjustment.adjustment_id,

                transaction_id:
                    adjustment.transaction_id,

                adjustment_type:
                    adjustment.adjustment_type,

                adjustment_amount:
                    adjustmentAmount,

                transaction_amount:
                    transactionAmount,

                settlement_amount:
                    settlementAmount,

                settlement_difference:
                    difference,

                explained_amount:
                    explainedAmount,

                unexplained_amount:
                    unexplainedAmount,

                reason:
                    adjustment.adjustment_reason,

                risk_level:
                    riskLevel,

                analysis: {

                    adjustment_detected:
                        true,

                    financial_impact_analyzed:
                        true,

                    explanation,

                    recommendation: {

                        type:
                            recommendationType,

                        proposed_action:
                            proposedAction,

                        requires_human_approval:
                            true,

                        automatic_action:
                            false
                    }
                },

                created_at:
                    adjustment.created_at
            };
        });

        // ==========================================
        // 3. SUMMARY
        // ==========================================

        const totalAdjustments =
            analysis.length;

        const totalRefunds =
            analysis.filter(
                item =>
                    item.adjustment_type === "REFUND"
            ).length;

        const totalRefundAmount =
            analysis
                .filter(
                    item =>
                        item.adjustment_type === "REFUND"
                )
                .reduce(
                    (sum, item) =>
                        sum + item.adjustment_amount,
                    0
                );

        const totalExplainedAmount =
            analysis.reduce(
                (sum, item) =>
                    sum + item.explained_amount,
                0
            );

        const totalUnexplainedAmount =
            analysis.reduce(
                (sum, item) =>
                    sum + item.unexplained_amount,
                0
            );

        // ==========================================
        // 4. RESPONSE
        // ==========================================

        return res.json({

            engine:
                "PayTruth Refund & Adjustment Intelligence",

            summary: {

                total_adjustments:
                    totalAdjustments,

                total_refunds:
                    totalRefunds,

                total_refund_amount:
                    totalRefundAmount,

                total_explained_amount:
                    totalExplainedAmount,

                total_unexplained_amount:
                    totalUnexplainedAmount
            },

            refund_analysis:
                analysis
        });

    } catch (error) {

        console.error(
            "Refund intelligence error:",
            error
        );

        return res.status(500).json({

            message:
                "Could not analyze refunds and adjustments",

            error:
                error.message
        });
    }
});


// ==================================================
// PAYMENT & SETTLEMENT ANOMALY INTELLIGENCE
// ==================================================

app.get("/anomaly-intelligence", async (req, res) => {

    try {

        // ==========================================
        // 1. GET PAYMENT + SETTLEMENT DATA
        // ==========================================

        const result = await pool.query(`
            SELECT
                t.transaction_id,
                t.merchant_id,
                t.transaction_amount,
                t.payment_status,

                s.settlement_amount,
                s.settlement_status,

                COALESCE(
                    SUM(
                        sa.amount
                    ) FILTER (
                        WHERE sa.adjustment_type = 'REFUND'
                    ),
                    0
                ) AS refund_amount,

                COUNT(sa.id) AS adjustment_count

            FROM transactions t

            LEFT JOIN settlements s
                ON s.transaction_id = t.transaction_id

            LEFT JOIN settlement_adjustments sa
                ON sa.transaction_id = t.transaction_id

            GROUP BY
                t.transaction_id,
                t.merchant_id,
                t.transaction_amount,
                t.payment_status,
                s.settlement_amount,
                s.settlement_status

            ORDER BY
                t.transaction_id
        `);

        // ==========================================
        // 2. ANALYZE EACH TRANSACTION
        // ==========================================

        const anomalies = result.rows.map(row => {

            const transactionAmount =
                Number(row.transaction_amount || 0);

            const settlementAmount =
                Number(row.settlement_amount || 0);

            const refundAmount =
                Number(row.refund_amount || 0);

            const adjustmentCount =
                Number(row.adjustment_count || 0);

            // ======================================
            // FINANCIAL DIFFERENCE
            // ======================================

            const settlementDifference =
                Math.abs(
                    transactionAmount -
                    settlementAmount
                );

            // ======================================
            // EXPLAINED / UNEXPLAINED
            // ======================================

            const explainedAmount =
                Math.min(
                    refundAmount,
                    settlementDifference
                );

            const unexplainedAmount =
                settlementDifference -
                explainedAmount;

            // ======================================
            // ANOMALY SCORING
            // ======================================

            let anomalyScore = 0;

            const signals = [];

            // High-value transaction
            if (transactionAmount >= 10000) {

                anomalyScore += 20;

                signals.push({

                    type:
                        "HIGH_VALUE_TRANSACTION",

                    score:
                        20,

                    explanation:
                        "Transaction amount is at or above the high-value threshold."
                });
            }

            // Settlement deviation
            if (settlementDifference > 0) {

                anomalyScore += 30;

                signals.push({

                    type:
                        "SETTLEMENT_DEVIATION",

                    score:
                        30,

                    explanation:
                        "Settlement amount differs from the transaction amount."
                });
            }

            // Large unexplained amount
            if (unexplainedAmount > 1000) {

                anomalyScore += 30;

                signals.push({

                    type:
                        "LARGE_UNEXPLAINED_DIFFERENCE",

                    score:
                        30,

                    explanation:
                        "A significant portion of the settlement difference remains unexplained."
                });
            }

            // Adjustment activity
            if (adjustmentCount > 0) {

                anomalyScore += 10;

                signals.push({

                    type:
                        "ADJUSTMENT_ACTIVITY",

                    score:
                        10,

                    explanation:
                        "One or more financial adjustments are recorded."
                });
            }

            // Refund explains deviation
            if (
                settlementDifference > 0 &&
                unexplainedAmount === 0 &&
                refundAmount > 0
            ) {

                anomalyScore =
                    Math.max(
                        0,
                        anomalyScore - 20
                    );

                signals.push({

                    type:
                        "REFUND_EXPLAINS_DIFFERENCE",

                    score:
                        -20,

                    explanation:
                        "The recorded refund fully explains the settlement difference."
                });
            }

            // ======================================
            // RISK LEVEL
            // ======================================

            let riskLevel;

            if (anomalyScore >= 70) {

                riskLevel =
                    "CRITICAL";

            } else if (anomalyScore >= 40) {

                riskLevel =
                    "HIGH";

            } else if (anomalyScore >= 20) {

                riskLevel =
                    "MEDIUM";

            } else {

                riskLevel =
                    "LOW";
            }

            // ======================================
            // RECOMMENDATION
            // ======================================

            let recommendedAction =
                "NO_ACTION";

            let requiresHumanApproval =
                false;

            if (unexplainedAmount > 1000) {

                recommendedAction =
                    "INVESTIGATE_UNEXPLAINED_ANOMALY";

                requiresHumanApproval =
                    true;

            } else if (
                settlementDifference > 0 &&
                unexplainedAmount > 0
            ) {

                recommendedAction =
                    "REVIEW_SETTLEMENT_ANOMALY";

                requiresHumanApproval =
                    true;

            } else if (
                settlementDifference > 0 &&
                unexplainedAmount === 0
            ) {

                recommendedAction =
                    "VERIFY_FINANCIAL_ADJUSTMENT";

                requiresHumanApproval =
                    true;
            }

            // ======================================
            // AI EXPLANATION
            // ======================================

            let aiReason;

            if (
                settlementDifference === 0 &&
                anomalyScore === 0
            ) {

                aiReason =
                    "No payment or settlement anomaly was detected.";

            } else if (
                settlementDifference === 0 &&
                adjustmentCount === 0 &&
                transactionAmount >= 10000
            ) {

                aiReason =
                    "The transaction is high value, but payment and settlement records are consistent.";

            } else if (
                unexplainedAmount === 0 &&
                settlementDifference > 0
            ) {

                aiReason =
                    "A settlement deviation was detected, but recorded financial adjustment evidence fully explains the difference.";

            } else if (
                unexplainedAmount > 0
            ) {

                aiReason =
                    "A settlement deviation was detected and part of the difference remains unexplained.";

            } else {

                aiReason =
                    "An unusual payment or settlement signal was detected and should be reviewed.";
            }

            // ======================================
            // BUILD RESULT
            // ======================================

            return {

                transaction_id:
                    row.transaction_id,

                merchant_id:
                    row.merchant_id,

                transaction_amount:
                    transactionAmount,

                payment_status:
                    row.payment_status,

                settlement_amount:
                    settlementAmount,

                settlement_status:
                    row.settlement_status,

                settlement_difference:
                    settlementDifference,

                refund_amount:
                    refundAmount,

                explained_amount:
                    explainedAmount,

                unexplained_amount:
                    unexplainedAmount,

                adjustment_count:
                    adjustmentCount,

                anomaly_score:
                    anomalyScore,

                risk_level:
                    riskLevel,

                signals,

                ai_reason:
                    aiReason,

                recommended_action:
                    recommendedAction,

                requires_human_approval:
                    requiresHumanApproval,

                automatic_action:
                    false
            };
        });

        // ==========================================
        // 3. SUMMARY
        // ==========================================

        const summary = {

            total_transactions:
                anomalies.length,

            low_risk:
                anomalies.filter(
                    item =>
                        item.risk_level === "LOW"
                ).length,

            medium_risk:
                anomalies.filter(
                    item =>
                        item.risk_level === "MEDIUM"
                ).length,

            high_risk:
                anomalies.filter(
                    item =>
                        item.risk_level === "HIGH"
                ).length,

            critical_risk:
                anomalies.filter(
                    item =>
                        item.risk_level === "CRITICAL"
                ).length,

            total_unexplained_amount:
                anomalies.reduce(
                    (sum, item) =>
                        sum + item.unexplained_amount,
                    0
                )
        };

        // ==========================================
        // 4. RESPONSE
        // ==========================================

        return res.json({

            engine:
                "PayTruth Payment & Settlement Anomaly Intelligence",

            summary,

            anomalies
        });

    } catch (error) {

        console.error(
            "Anomaly intelligence error:",
            error
        );

        return res.status(500).json({

            message:
                "Could not calculate payment and settlement anomalies",

            error:
                error.message
        });
    }
});

// ==================================================
// START SERVER
// ==================================================

app.listen(PORT, () => {

    console.log(
        `PayTruth AI server running on http://localhost:${PORT}`
    );

});