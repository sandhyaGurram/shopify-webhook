const express = require("express");
const crypto = require("crypto");
const axios = require("axios");
require("dotenv").config();

const app = express();

// Capture raw body for Shopify verification
app.use(
    express.json({
        verify: (req, res, buf) => {
            req.rawBody = buf;
        },
    })
);

// Verify Shopify webhook
function verifyWebhook(req) {
    const hmacHeader = req.get("X-Shopify-Hmac-Sha256");

    const generatedHash = crypto
        .createHmac("sha256", process.env.SHOPIFY_WEBHOOK_SECRET)
        .update(req.rawBody, "utf8")
        .digest("base64");

    return generatedHash === hmacHeader;
}

// Send data to Interakt
async function sendToInterakt(phone, name, recoveryUrl) {
    try {
        const response = await axios.post(
            "https://api.interakt.ai/v1/public/message/",
            {
                countryCode: "+91",
                phoneNumber: phone,
                type: "Template",
                template: {
                    name: "abandoned_cart", // Replace with your approved template name
                    languageCode: "en"
                },
                bodyValues: [
                    name || "Customer",
                    recoveryUrl
                ]
            },
            {
                headers: {
                    Authorization: `Basic ${process.env.INTERAKT_API_KEY}`,
                    "Content-Type": "application/json"
                }
            }
        );

        console.log("Interakt Success:", response.data);

    } catch (error) {
        console.log(
            "Interakt Error:",
            error.response?.data || error.message
        );
    }
}

// Shopify checkout update webhook
app.post("/webhooks/checkout-update", async (req, res) => {
    try {
        if (!verifyWebhook(req)) {
            return res.status(401).send("Webhook verification failed");
        }

        const checkoutData = req.body;

        console.log("Checkout Update Received:");
        console.log(checkoutData);

        const phone =
            checkoutData.phone ||
            checkoutData.customer?.phone ||
            checkoutData.billing_address?.phone;

        const name =
            checkoutData.customer?.first_name ||
            checkoutData.billing_address?.first_name ||
            "Customer";

        const recoveryUrl =
            checkoutData.abandoned_checkout_url;

        console.log("Customer Phone:", phone);
        console.log("Customer Name:", name);
        console.log("Recovery URL:", recoveryUrl);

        if (phone && recoveryUrl) {
            await sendToInterakt(
                phone,
                name,
                recoveryUrl
            );
        } else {
            console.log(
                "Phone or recovery URL missing"
            );
        }

        res
            .status(200)
            .send("Webhook processed successfully");

    } catch (error) {
        console.log("Server Error:", error);
        res.status(500).send("Server error");
    }
});

// Health route
app.get("/", (req, res) => {
    res.send("Webhook server running");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(
        `Server running on port ${PORT}`
    );
});