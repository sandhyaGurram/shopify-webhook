const express = require("express");
const crypto = require("crypto");
require("dotenv").config();

const app = express();

app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));

function verifyWebhook(req) {
    const hmacHeader = req.get("X-Shopify-Hmac-Sha256");

    const generatedHash = crypto
        .createHmac("sha256", process.env.SHOPIFY_WEBHOOK_SECRET)
        .update(req.rawBody, "utf8")
        .digest("base64");

    return generatedHash === hmacHeader;
}

app.post("/webhooks/checkout-create", (req, res) => {
    try {
        if (!verifyWebhook(req)) {
            return res.status(401).send("Webhook verification failed");
        }

        const checkoutData = req.body;

        console.log("Checkout webhook received:");
        console.log(checkoutData);

        const phone =
            checkoutData.phone ||
            checkoutData.customer?.phone ||
            checkoutData.billing_address?.phone;

        console.log("Customer Phone:", phone);

        res.status(200).send("Webhook received successfully");

    } catch (error) {
        console.log(error);
        res.status(500).send("Server error");
    }
});

app.listen(3000, () => {
    console.log("Server running on port 3000");
});