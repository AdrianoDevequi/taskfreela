const webpush = require('web-push');

const vapidKeys = webpush.generateVAPIDKeys();

console.log("=========================================");
console.log("VAPID PUBLIC KEY:");
console.log(vapidKeys.publicKey);
console.log("\nVAPID PRIVATE KEY:");
console.log(vapidKeys.privateKey);
console.log("=========================================");
console.log("\nPlease add these to your .env file as:");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY="${vapidKeys.publicKey}"`);
console.log(`VAPID_PRIVATE_KEY="${vapidKeys.privateKey}"`);
