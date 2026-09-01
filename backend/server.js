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
            action_type,
            ai_reason,
            proposed_action
        } = req.body;


        if (
            !case_id ||
            !action_type ||
            !ai_reason ||
            !proposed_action
        ) {

            return res.status(400).json({

                message:
                    "case_id, action_type, ai_reason and proposed_action are required"

            });
        }


        // Check mismatch case

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


        // Prevent duplicate pending approval

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


        // Create approval request

        const result = await pool.query(
            `
            INSERT INTO approval_actions
            (
                case_id,
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
                'PENDING',
                'NOT_EXECUTED',
                'NOT_VERIFIED'
            )

            RETURNING *
            `,
            [
                case_id,
                action_type,
                ai_reason,
                proposed_action
            ]
        );


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


// ==================================================
// CONTROLLED EXECUTION
// ==================================================

app.post("/approval-actions/:id/execute", async (req, res) => {
    const client = await pool.connect();

    try {
        const { id } = req.params;

        // Start a database transaction
        await client.query("BEGIN");

        // 1. Get the approved action
        const actionResult = await client.query(
            `
            SELECT
                id,
                case_id,
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
                message: "Approval action not found"
            });
        }

        const action = actionResult.rows[0];

        // 2. Safety check
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

        // 3. Find the related mismatch case
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
                message: "Related mismatch case not found"
            });
        }

        const mismatchCase = caseResult.rows[0];

        // 4. Move the case into investigation
        const updatedCase = await client.query(
            `
            UPDATE mismatch_cases
            SET case_status = 'INVESTIGATING'
            WHERE id = $1
            RETURNING *
            `,
            [mismatchCase.id]
        );

        // 5. Mark the approval action as executed
        const updatedAction = await client.query(
            `
            UPDATE approval_actions
            SET execution_status = 'EXECUTED'
            WHERE id = $1
            RETURNING *
            `,
            [id]
        );

        // 6. Commit both changes together
        await client.query("COMMIT");

        res.json({
            message: "Settlement investigation executed successfully",
            action: updatedAction.rows[0],
            case: updatedCase.rows[0]
        });

    } catch (error) {

        await client.query("ROLLBACK");

        console.error("Execution error:", error);

        res.status(500).json({
            message: "Could not execute action",
            error: error.message
        });

    } finally {
        client.release();
    }
});

// ==================================================
// INDEPENDENT VERIFICATION
// ==================================================

app.post("/approval-actions/:id/verify", async (req, res) => {

    try {

        const { id } = req.params;


        // 1. Get action

        const actionResult = await pool.query(
            `
            SELECT *

            FROM approval_actions

            WHERE id = $1
            `,
            [id]
        );


        if (actionResult.rows.length === 0) {

            return res.status(404).json({

                message:
                    "Approval action not found."

            });
        }


        const action =
            actionResult.rows[0];


        // 2. Approval check

        if (
            action.approval_status !==
            "APPROVED"
        ) {

            return res.status(400).json({

                message:
                    "Action must be approved before verification."

            });
        }


        // 3. Execution check

        if (
            action.execution_status !==
            "EXECUTED"
        ) {

            return res.status(400).json({

                message:
                    "Action must be executed before verification."

            });
        }


        // 4. Get actual case

        const caseResult = await pool.query(
            `
            SELECT *

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


        // 5. Independently verify
        // actual business result

        if (
            mismatchCase.case_status !==
            "INVESTIGATING"
        ) {

            return res.status(400).json({

                message:
                    "Verification failed. The local case is not in INVESTIGATING status."

            });
        }


        // 6. Mark verified

        const verificationResult =
            await pool.query(
                `
                UPDATE approval_actions

                SET verification_status =
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


        if (
            verificationResult.rows.length === 0
        ) {

            return res.status(400).json({

                message:
                    "Action could not be marked as verified."

            });
        }


        res.json({

            message:
                "Action independently verified successfully.",

            action:
                verificationResult.rows[0],

            verification: {

                case_id:
                    mismatchCase.id,

                transaction_id:
                    mismatchCase.transaction_id,

                case_status:
                    mismatchCase.case_status,

                result:
                    "VERIFIED"

            }

        });


    } catch (error) {

        console.error(
            "Verification error:",
            error
        );


        res.status(500).json({

            message:
                "Could not verify action",

            error:
                error.message

        });
    }
});


// ==================================================
// RESOLVE CASE
// ==================================================

app.patch("/cases/:id/resolve", async (req, res) => {

    try {

        const { id } = req.params;


        const result = await pool.query(
            `
            UPDATE mismatch_cases

            SET case_status =
                'RESOLVED'

            WHERE id = $1

            RETURNING *
            `,
            [id]
        );


        if (result.rows.length === 0) {

            return res.status(404).json({

                message:
                    "Case not found"

            });
        }


        res.json(result.rows[0]);


    } catch (error) {

        console.error(error);


        res.status(500).json({

            message:
                "Could not resolve case"

        });
    }
});


// ==================================================
// INVESTIGATION ENGINE — STEP 39
// ==================================================

app.get("/investigate/:transaction_id", async (req, res) => {

    try {

        const { transaction_id } =
            req.params;


        // ==================================================
        // 1. GET TRANSACTION
        // ==================================================

        const transactionResult =
            await pool.query(
                `
                SELECT

                    id,
                    transaction_id,
                    merchant_id,
                    transaction_amount,
                    transaction_date,
                    payment_status

                FROM transactions

                WHERE transaction_id = $1
                `,
                [transaction_id]
            );


        if (
            transactionResult.rows.length === 0
        ) {

            return res.status(404).json({

                message:
                    "Transaction not found"

            });
        }


        const transaction =
            transactionResult.rows[0];


        const transactionAmount =
            Number(
                transaction.transaction_amount
            );


        // ==================================================
        // 2. GET SETTLEMENT
        // ==================================================

        const settlementResult =
            await pool.query(
                `
                SELECT

                    id,
                    settlement_id,
                    transaction_id,
                    settlement_amount,
                    settlement_date,
                    settlement_status

                FROM settlements

                WHERE transaction_id = $1

                ORDER BY settlement_date DESC

                LIMIT 1
                `,
                [transaction_id]
            );


        if (
            settlementResult.rows.length === 0
        ) {

            return res.status(404).json({

                message:
                    "Settlement record not found"

            });
        }


        const settlement =
            settlementResult.rows[0];


        const settlementAmount =
            Number(
                settlement.settlement_amount
            );


        // ==================================================
        // 3. CALCULATE MISMATCH
        // ==================================================

        const difference =
            Number(
                (
                    transactionAmount -
                    settlementAmount
                ).toFixed(2)
            );


        // ==================================================
        // 4. GET FINANCIAL ADJUSTMENTS
        // ==================================================

        const adjustmentResult =
            await pool.query(
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

                ORDER BY created_at DESC
                `,
                [transaction_id]
            );


        const adjustments =
            adjustmentResult.rows;


        // ==================================================
        // 5. CALCULATE TOTAL ADJUSTMENTS
        // ==================================================

        const totalAdjustments =
            Number(

                adjustments
                    .reduce(

                        (total, item) =>
                            total +
                            Number(item.amount),

                        0
                    )

                    .toFixed(2)

            );


        // ==================================================
        // 6. PREPARE INVESTIGATION
        // ==================================================

        const investigation = {

            transaction_id:
                transaction.transaction_id,

            merchant_id:
                transaction.merchant_id,

            investigation_status:
                null,

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

                difference:
                    difference

            },

            financial_evidence: [],

            root_cause_type:
                null,

            root_cause:
                null,

            confidence:
                0,

            unexplained_difference:
                difference,

            recommended_action:
                null,

            human_approval_required:
                true,

            automatic_action:
                false

        };


        // ==================================================
        // 7. NO MISMATCH
        // ==================================================

        if (difference === 0) {

            investigation.investigation_status =
                "NO_MISMATCH";


            investigation.root_cause_type =
                "NO_DISCREPANCY";


            investigation.root_cause =
                "Transaction amount and settlement amount match.";


            investigation.financial_evidence.push({

                check:
                    "Transaction vs settlement",

                transaction_amount:
                    transactionAmount,

                settlement_amount:
                    settlementAmount,

                difference:
                    0,

                result:
                    "MATCH"

            });


            investigation.unexplained_difference =
                0;


            investigation.confidence =
                100;


            investigation.recommended_action =
                "No corrective action required.";

        }


        // ==================================================
        // 8. MISMATCH EXISTS
        // ==================================================

        else {

            investigation.investigation_status =
                "MISMATCH_FOUND";


            investigation.financial_evidence.push({

                check:
                    "Transaction amount",

                value:
                    transactionAmount,

                result:
                    "RECORDED"

            });


            investigation.financial_evidence.push({

                check:
                    "Settlement amount",

                value:
                    settlementAmount,

                result:
                    "RECORDED"

            });


            investigation.financial_evidence.push({

                check:
                    "Amount difference",

                calculation:
                    `${transactionAmount} - ${settlementAmount}`,

                difference:
                    difference,

                result:
                    "MISMATCH"

            });


            // ==================================================
            // 9. CHECK FINANCIAL ADJUSTMENTS
            // ==================================================

            if (
                adjustments.length > 0
            ) {

                adjustments.forEach(
                    adjustment => {

                        investigation.financial_evidence.push({

                            check:
                                "Financial adjustment",

                            adjustment_type:
                                adjustment.adjustment_type,

                            amount:
                                Number(
                                    adjustment.amount
                                ),

                            reason:
                                adjustment.reason,

                            result:
                                "FOUND"

                        });

                    }
                );


                // FULLY EXPLAINED

                if (

                    Number(
                        totalAdjustments.toFixed(2)
                    )

                    ===

                    Math.abs(difference)

                ) {

                    const types =
                        [
                            ...new Set(

                                adjustments.map(
                                    item =>
                                        item.adjustment_type
                                )

                            )
                        ];


                    investigation.root_cause_type =
                        "FINANCIAL_ADJUSTMENT";


                    investigation.root_cause =
                        `The ₹${Math.abs(difference)} settlement difference is fully explained by recorded financial adjustment(s): ${types.join(", ")}.`;


                    investigation.unexplained_difference =
                        0;


                    investigation.confidence =
                        98;


                    investigation.financial_evidence.push({

                        check:
                            "Adjustment reconciliation",

                        total_adjustments:
                            totalAdjustments,

                        mismatch_amount:
                            Math.abs(difference),

                        result:
                            "FULLY_EXPLAINED"

                    });


                    investigation.recommended_action =
                        "Review the identified financial adjustment and proceed with correction only after human approval.";

                }


                // PARTIALLY EXPLAINED

                else if (

                    totalAdjustments <
                    Math.abs(difference)

                ) {

                    const remainingDifference =
                        Number(

                            (

                                Math.abs(difference) -
                                totalAdjustments

                            ).toFixed(2)

                        );


                    investigation.root_cause_type =
                        "PARTIALLY_EXPLAINED";


                    investigation.root_cause =
                        `Recorded financial adjustments explain ₹${totalAdjustments} of the ₹${Math.abs(difference)} mismatch. ₹${remainingDifference} remains unexplained.`;


                    investigation.unexplained_difference =
                        remainingDifference;


                    investigation.confidence =
                        90;


                    investigation.financial_evidence.push({

                        check:
                            "Partial reconciliation",

                        total_adjustments:
                            totalAdjustments,

                        mismatch_amount:
                            Math.abs(difference),

                        unexplained:
                            remainingDifference,

                        result:
                            "PARTIALLY_EXPLAINED"

                    });


                    investigation.recommended_action =
                        "Investigate the remaining unexplained amount before making any financial correction.";

                }


                // ADJUSTMENT GREATER THAN MISMATCH

                else {

                    const excess =
                        Number(

                            (

                                totalAdjustments -
                                Math.abs(difference)

                            ).toFixed(2)

                        );


                    investigation.root_cause_type =
                        "ADJUSTMENT_REQUIRES_REVIEW";


                    investigation.root_cause =
                        `Financial adjustments total ₹${totalAdjustments}, which is greater than the ₹${Math.abs(difference)} mismatch. The records require human review.`;


                    investigation.unexplained_difference =
                        difference;


                    investigation.confidence =
                        85;


                    investigation.financial_evidence.push({

                        check:
                            "Adjustment consistency",

                        total_adjustments:
                            totalAdjustments,

                        mismatch_amount:
                            Math.abs(difference),

                        excess:
                            excess,

                        result:
                            "REQUIRES_REVIEW"

                    });


                    investigation.recommended_action =
                        "Do not automatically correct the settlement. Human review is required.";

                }

            }


            // ==================================================
            // 10. NO FINANCIAL EVIDENCE
            // ==================================================

            else {

                investigation.root_cause_type =
                    "UNEXPLAINED_SETTLEMENT_DIFFERENCE";


                investigation.root_cause =
                    `A ₹${Math.abs(difference)} difference exists between the transaction and settlement records, but no financial adjustment record explains the difference.`;


                investigation.unexplained_difference =
                    Math.abs(difference);


                investigation.confidence =
                    70;


                investigation.financial_evidence.push({

                    check:
                        "Financial adjustments",

                    result:
                        "NOT_FOUND",

                    explanation:
                        "No fee, refund, tax, adjustment, chargeback, or other financial adjustment record was found."

                });


                investigation.recommended_action =
                    "Raise a settlement investigation and request human review.";

            }

        }


        // ==================================================
        // 11. SAFETY RULE
        // ==================================================

        if (

            investigation.confidence < 95

            ||

            investigation.unexplained_difference !== 0

        ) {

            investigation.human_approval_required =
                true;


            investigation.automatic_action =
                false;


            investigation.recommended_action +=
                " Automatic financial execution is blocked until human approval and verification.";

        }


        // ==================================================
        // 12. FINAL RESPONSE
        // ==================================================

        res.json(
            investigation
        );


    } catch (error) {

        console.error(
            "Investigation error:",
            error
        );


        res.status(500).json({

            message:
                "Investigation failed",

            error:
                error.message

        });
    }
});
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
                COUNT(*) AS total_transactions,

                COUNT(*) FILTER (
                    WHERE payment_status = 'SUCCESS'
                ) AS successful_payments,

                COUNT(*) FILTER (
                    WHERE payment_status != 'SUCCESS'
                ) AS failed_payments,

                COALESCE(
                    SUM(transaction_amount),
                    0
                ) AS total_transaction_value

            FROM transactions
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


// ==================================================
// START SERVER
// ==================================================

app.listen(PORT, () => {

    console.log(
        `PayTruth AI server running on http://localhost:${PORT}`
    );

});