// js/checkout-paypal.js

const backendUrl = "https://api.hochzeitsapp.com";

window.setBillingInfo = info => { window.flutterBillingInfo = info; };
window.setTotalCost   = total => { window.flutterTotalCost = Number(total); };
window.setChosenAddons = info => { window.flutterChosenAddons = info; };

function renderPayPalButtons() {
  paypal.Buttons({
    style: {
      shape: "pill",
      layout: "vertical",
      color: "white",
      label: "pay",
    },

    // 1) Create a PayPal order
    createOrder: (data, actions) =>
      fetch(`${backendUrl}/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price: window.flutterTotalCost })
      })
      .then(resp => {
        if (!resp.ok) {
          return resp.text().then(txt => { throw new Error(`create-order failed: ${txt}`); });
        }
        return resp.json();
      })
      .then(orderData => orderData.id),

    // 2) On approval, chain pending-order + capture-order
    onApprove: async data => {
      try {
        // Gather data from Flutter
        const billing = window.flutterBillingInfo
          ? JSON.parse(window.flutterBillingInfo)
          : { name: "", mobile: "", email: "", city: "", state: "", zip: "", address: "" };
        const chosenAddons = window.flutterChosenAddons
          ? JSON.parse(window.flutterChosenAddons)
          : {};
        const config = JSON.stringify({ configurationID: window.configurationID || "default" });
        const orderID = data.orderID;
        const idempotencyKey = generateIdempotencyKey();
        const price = window.flutterTotalCost || 0;

        // 2a) Create pending order
        let resp = await fetch(`${backendUrl}/create-pending-order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderID, billing, config, chosenAddons, idempotencyKey, price })
        });
        if (!resp.ok) {
          const txt = await resp.text();
          throw new Error(`create-pending-order failed: ${txt}`);
        }

        // 2b) Capture the PayPal order
        resp = await fetch(`${backendUrl}/capture-order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderID, billing, config, chosenAddons })
        });
        if (!resp.ok) {
          const txt = await resp.text();
          throw new Error(`capture-order failed: ${txt}`);
        }
        const captureData = await resp.json();

        // 3) Only on full success do we call the Flutter callback
        if (window.flutterPaymentSuccess) {
          window.flutterPaymentSuccess(captureData);
        } else {
          alert("Thank you! Order ID: " + captureData.id);
        }
      } catch (err) {
        console.error("Error processing payment:", err);
        alert("Payment failed: " + err.message);
      }
    },

    onError: err => {
      console.error('PayPal Buttons error:', err);
      alert('PayPal error – please try again.');
    }

  }).render('#paypal-button-container');
}

function generateIdempotencyKey() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random()*16|0;
    const v = c==='x' ? r : (r&0x3|0x8);
    return v.toString(16);
  });
}

window.renderPayPalButtons = renderPayPalButtons;
